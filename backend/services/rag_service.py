"""
RAG Service — Retriever + LangChain chain + streaming response generation.
Implements the full RAG pipeline: embed query → retrieve → rerank → generate.
"""
from __future__ import annotations

import asyncio
import re
import uuid
from datetime import datetime, timezone
from typing import AsyncIterator, List, Optional

import structlog
from openai import APIConnectionError, APIStatusError, RateLimitError
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import async_session_factory
from models.document import FootballDocument
from models.chat import ChatSession, ChatMessage
from services.embedding_service import EmbeddingService

logger = structlog.get_logger(__name__)

SYSTEM_PROMPT = """You are FootballGPT, an expert football analyst assistant.

Context from database:
{context}

⚠️ CRITICAL RULES:
1. For ANY questions about football matches, standings, scores, or teams, you MUST answer ONLY from the provided context above.
2. If the user asks about football data that is NOT in the context, respond exactly: "ขออภัย ฉันไม่มีข้อมูลเพียงพอในการตอบคำถามนี้ โปรดลองถามคำถามอื่น"
3. NEVER make up statistics, scores, or rankings.
4. You MAY answer general conversational questions (greetings, asking what you can do) naturally and politely, explaining that you can answer questions about football standings and matches based on the database.
5. ALWAYS answer in THAI language.

Today's date: {today}"""


class RAGService:
    """Orchestrates retrieval-augmented generation for football queries."""

    def __init__(self):
        self.embedder = EmbeddingService()

    # ── Retrieval ────────────────────────────────────────────

    async def retrieve_documents(
        self, query: str, db: AsyncSession,
        top_k: int | None = None,
        threshold: float | None = None,
    ) -> List[dict]:
        """Embed query and perform cosine similarity search with optional MMR reranking."""
        top_k = top_k or settings.rag_top_k
        # Use a lower threshold for Thai queries since embeddings are trained on English docs
        threshold = threshold or min(settings.rag_similarity_threshold, 0.15)

        try:
            # Step 1: Embed the user's question
            query_embedding = await self.embedder.embed_query(query)

            # Step 2: Cosine similarity search via pgvector
            embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

            result = await db.execute(
                text("""
                    SELECT
                        id, content, metadata,
                        1 - (embedding <=> (:embedding)::vector) AS similarity
                    FROM football_documents
                    WHERE embedding IS NOT NULL
                    ORDER BY embedding <=> (:embedding)::vector
                    LIMIT :limit
                """),
                {"embedding": embedding_str, "limit": top_k * 2},
            )
            rows = result.fetchall()

            docs = []
            for row in rows:
                if row.similarity >= threshold:
                    docs.append({
                        "id": str(row.id),
                        "content": row.content,
                        "metadata": row.metadata,
                        "similarity": float(row.similarity),
                    })

            if settings.rag_use_mmr and len(docs) > top_k:
                docs = self._mmr_rerank(docs, query_embedding, top_k)
            else:
                docs = docs[:top_k]

            logger.info("documents_retrieved", count=len(docs), query_preview=query[:80])
            if docs:
                return docs

        except (RateLimitError, APIStatusError, APIConnectionError) as exc:
            logger.warning(
                "openai_retrieval_fallback",
                error=str(exc),
                query_preview=query[:80],
            )
        except Exception:
            raise

        return await self.retrieve_documents_lexical(query, db, top_k)

    async def retrieve_documents_lexical(
        self, query: str, db: AsyncSession, top_k: int | None = None
    ) -> List[dict]:
        """Fallback retrieval using keyword matching over stored document text."""
        top_k = top_k or settings.rag_top_k
        terms = self._extract_search_terms(query)

        if not terms:
            return []

        result = await db.execute(select(FootballDocument))
        docs = result.scalars().all()

        ranked = []
        for doc in docs:
            content = f"{doc.content or ''} {(doc.metadata_ or {})}".lower()
            score = sum(1 for term in terms if term in content)

            if score > 0:
                similarity = min(0.99, round(score / max(len(terms), 1), 2))
                ranked.append({
                    "id": str(doc.id),
                    "content": doc.content,
                    "metadata": doc.metadata_,
                    "similarity": similarity,
                })

        ranked.sort(key=lambda item: item["similarity"], reverse=True)
        logger.info(
            "lexical_retrieval_used",
            count=len(ranked),
            query_preview=query[:80],
        )
        return ranked[:top_k]

    @staticmethod
    def _extract_search_terms(query: str) -> List[str]:
        aliases = {
            "แมนเชสเตอร์ซิตี": "manchester city",
            "แมนยู": "manchester united",
            "แมนเชสเตอร์ ยูไนเต็ด": "manchester united",
            "ลิเวอร์พูล": "liverpool",
            "เชลซี": "chelsea",
            "อาร์เซนอล": "arsenal",
            "บาร์เซโลน่า": "barcelona",
            "รีลมาดริด": "real madrid",
            "ปารีส": "paris",
            "psg": "paris saint germain",
            "นิวคาสเซิล": "newcastle",
        }

        raw_query = query.lower()
        terms = []
        for alias, replacement in aliases.items():
            if alias in raw_query:
                terms.extend(replacement.split())

        for token in re.split(r"[^a-z0-9]+", raw_query):
            if token and len(token) >= 3:
                terms.append(token)

        unique_terms = []
        for term in terms:
            if term not in unique_terms:
                unique_terms.append(term)
        return unique_terms

    @staticmethod
    def _normalize_query(query: str) -> str:
        """Normalize a query for lightweight keyword matching."""
        return " ".join(RAGService._extract_search_terms(query))

    def _build_fallback_response(self, query: str, docs: List[dict]) -> str:
        """Return a deterministic answer from retrieved documents when LLM is unavailable."""
        if not docs:
            return (
                "ขออภัย ฉันไม่มีข้อมูลเพียงพอในการตอบคำถามนี้ 💔\n\n"
                "ลองถามเกี่ยวกับ:\n"
                "• ตารางคะแนนของลีก (Premier League, La Liga, etc.)\n"
                "• ผลการแข่งขันที่ผ่านมา\n"
                "• ข้อมูลทีม"
            )

        lines = [
            "ขออภัย บริการ LLM หลักของฉันไม่สามารถใช้งานได้ชั่วคราว",
            "แต่นี่คือข้อมูลที่ฉันค้นหาได้จากฐานข้อมูล:",
            "",
        ]

        for doc in docs[:3]:
            snippet = (doc["content"] or "").replace("\n", " ").strip()
            if len(snippet) > 300:
                snippet = snippet[:300] + "..."
            lines.append(f"• {snippet}")
            lines.append("")

        lines.append(
            "ถ้าต้องการข้อมูลเชิงลึกเพิ่มเติม เช่น เปรียบเทียบทีม หรือตารางคะแนนอีกลีก สามารถถามต่อได้ครับ"
        )
        return "\n".join(lines)

    def _mmr_rerank(
        self, docs: List[dict], query_embedding: List[float],
        top_k: int, lambda_param: float | None = None,
    ) -> List[dict]:
        """Max Marginal Relevance reranking to reduce redundancy."""
        import numpy as np

        lambda_param = lambda_param or (1 - settings.rag_mmr_diversity)

        if not docs:
            return docs

        selected = []
        remaining = list(range(len(docs)))

        # First: pick the most relevant
        selected.append(remaining.pop(0))

        while len(selected) < top_k and remaining:
            best_idx = None
            best_score = -float("inf")

            for idx in remaining:
                # Relevance to query (already computed)
                relevance = docs[idx]["similarity"]

                # Max similarity to already-selected docs (diversity penalty)
                max_sim = max(
                    self._cosine_sim_from_scores(docs[idx], docs[s])
                    for s in selected
                )

                mmr_score = lambda_param * relevance - (1 - lambda_param) * max_sim

                if mmr_score > best_score:
                    best_score = mmr_score
                    best_idx = idx

            if best_idx is not None:
                selected.append(best_idx)
                remaining.remove(best_idx)

        return [docs[i] for i in selected]

    @staticmethod
    def _cosine_sim_from_scores(doc1: dict, doc2: dict) -> float:
        """Approximate similarity between two docs using their query similarities."""
        return min(doc1["similarity"], doc2["similarity"])

    # ── Generation ───────────────────────────────────────────

    async def generate_stream(
        self, query: str, session_id: uuid.UUID | None = None,
        db: AsyncSession | None = None,
    ) -> AsyncIterator[str]:
        """Full RAG pipeline: retrieve → build context → stream LLM response."""

        should_close = False
        if db is None:
            session_factory = async_session_factory
            db = session_factory()
            should_close = True

        try:
            # Get or create chat session
            if session_id:
                chat_session = await db.get(ChatSession, session_id)
            else:
                chat_session = ChatSession()
                db.add(chat_session)
                await db.flush()
                session_id = chat_session.id

            # Save user message
            user_msg = ChatMessage(
                session_id=session_id,
                role="user",
                content=query,
            )
            db.add(user_msg)
            await db.flush()

            # Retrieve relevant documents
            try:
                retrieved_docs = await self.retrieve_documents(query, db)
            except Exception as exc:
                logger.warning("retrieval_error", error=str(exc), query_preview=query[:80])
                retrieved_docs = await self.retrieve_documents_lexical(query, db, settings.rag_top_k)

            context = "\n\n---\n\n".join(
                f"[Source: {d['metadata'].get('source', 'unknown')} | "
                f"Type: {d['metadata'].get('type', 'unknown')} | "
                f"Relevance: {d['similarity']:.2f}]\n{d['content']}"
                for d in retrieved_docs
            )

            if not context:
                context = "No relevant football data found in the database. The data may not have been synced yet."

            # Build messages with chat history
            history_messages = await self._get_chat_history(db, session_id)

            system_msg = SYSTEM_PROMPT.format(
                context=context,
                today=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            )

            messages = [{"role": "system", "content": system_msg}]
            messages.extend(history_messages)
            messages.append({"role": "user", "content": query})

            # Stream response from LLM
            full_response = ""

            try:
                buffer = ""
                in_think_block = False
                think_closed = False
                
                # Select the appropriate stream generator
                if settings.llm_provider == "openai":
                    token_stream = self._stream_openai(messages)
                elif settings.llm_provider == "anthropic":
                    token_stream = self._stream_anthropic(messages)
                elif settings.llm_provider == "groq":
                    token_stream = self._stream_groq(messages)
                else:
                    token_stream = self._stream_gemini(messages)

                async for token in token_stream:
                    full_response += token
                    
                    if think_closed:
                        # Replace newlines with spaces or just yield it? 
                        # Wait, the SSE problem was newlines in a SINGLE yield. 
                        # If we yield chunk by chunk, newlines are fine, 
                        # BUT we must replace actual newlines in tokens with a special sequence if we want to avoid breaking SSE.
                        # Actually, useChat.ts parses SSE. If token contains \n, it breaks SSE.
                        # Let's replace \n with actual \n tokens safely, or just replace \n with \\n for JSON.
                        # Since chat.py does `yield f"data: {token}\n\n"`, if token has a \n, it breaks the format!
                        # So we must replace \n in the token with something else? No, we can just replace \n with \n data: 
                        # Or better, just remove newlines? No, we need newlines for formatting!
                        # The standard way to send newlines in SSE is to escape them, or just let useChat.ts handle it.
                        # Let's escape \n as \\n.
                        escaped_token = token.replace("\n", "\\n")
                        yield escaped_token
                        continue
                        
                    buffer += token
                    if not in_think_block:
                        if "<think>" in buffer:
                            in_think_block = True
                        elif len(buffer) > 20 and "<think>" not in buffer:
                            # It's not generating a think block, just yield buffer and proceed
                            think_closed = True
                            escaped_token = buffer.replace("\n", "\\n")
                            yield escaped_token
                            
                    if in_think_block:
                        if "</think>" in buffer:
                            think_closed = True
                            after_think = buffer.split("</think>")[-1]
                            if after_think:
                                escaped_token = after_think.replace("\n", "\\n")
                                yield escaped_token
                                
            except Exception as exc:
                logger.warning("llm_fallback", error=str(exc), query_preview=query[:80])
                fallback_msg = self._build_fallback_response(query, retrieved_docs)
                full_response = fallback_msg
                yield fallback_msg.replace("\n", "\\n")

            # Save assistant message with retrieved doc references
            assistant_msg = ChatMessage(
                session_id=session_id,
                role="assistant",
                content=full_response,
                retrieved_docs={
                    "doc_ids": [d["id"] for d in retrieved_docs],
                    "similarities": [d["similarity"] for d in retrieved_docs],
                },
            )
            db.add(assistant_msg)
            await db.commit()

            # Yield session_id for the client
            yield f"\n\n[SESSION_ID:{session_id}]"

        except Exception as e:
            logger.error("rag_generate_error", error=str(e))
            yield f"\n\n⚠️ An error occurred: {str(e)}"
            await db.rollback()
        finally:
            if should_close:
                await db.close()

    async def _get_chat_history(
        self, db: AsyncSession, session_id: uuid.UUID
    ) -> List[dict]:
        """Get last N messages from chat history."""
        result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(settings.chat_memory_length)
        )
        messages = result.scalars().all()
        messages.reverse()  # Chronological order

        return [
            {"role": m.role, "content": m.content}
            for m in messages
            if m.role in ("user", "assistant")
        ]

    # ── LLM Streaming ────────────────────────────────────────

    async def _stream_openai(self, messages: List[dict]) -> AsyncIterator[str]:
        """Stream tokens from OpenAI."""
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=settings.openai_api_key)

        stream = await client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            stream=True,
            temperature=0.7,
            max_tokens=2000,
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def _stream_anthropic(self, messages: List[dict]) -> AsyncIterator[str]:
        """Stream tokens from Anthropic Claude."""
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=settings.anthropic_api_key)

        # Extract system message
        system_content = ""
        chat_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_content = msg["content"]
            else:
                chat_messages.append(msg)

        async with client.messages.stream(
            model=settings.anthropic_model,
            system=system_content,
            messages=chat_messages,
            max_tokens=2000,
            temperature=0.7,
        ) as stream:
            async for text in stream.text_stream:
                yield text

    async def _stream_gemini(self, messages: List[dict]) -> AsyncIterator[str]:
        """Stream tokens from Gemini using the current SDK."""
        from google import genai

        if not settings.gemini_api_key:
            raise ValueError("GEMINI_API_KEY is not configured")

        client = genai.Client(api_key=settings.gemini_api_key)

        system_content = ""
        conversation_lines = []
        for msg in messages:
            if msg["role"] == "system":
                system_content = msg["content"]
            elif msg["role"] in ("user", "assistant"):
                speaker = "User" if msg["role"] == "user" else "Assistant"
                conversation_lines.append(f"{speaker}: {msg['content']}")

        prompt = "\n\n".join(conversation_lines)
        if system_content:
            prompt = f"{system_content}\n\n{prompt}"

        def _stream():
            response = client.models.generate_content_stream(
                model=settings.gemini_model,
                contents=prompt,
            )
            for chunk in response:
                text = getattr(chunk, "text", None)
                if text:
                    yield text

        for text in _stream():
            yield text

    async def _stream_groq(self, messages: List[dict]) -> AsyncIterator[str]:
        """Stream tokens from Groq."""
        from groq import AsyncGroq
        import httpx

        if not settings.groq_api_key:
            raise ValueError("GROQ_API_KEY is not configured")

        # Create httpx client without proxies to avoid compatibility issues
        http_client = httpx.AsyncClient()
        client = AsyncGroq(api_key=settings.groq_api_key, http_client=http_client)

        try:
            stream = await client.chat.completions.create(
                model=settings.groq_model,
                messages=messages,
                stream=True,
                temperature=0.7,
                max_tokens=2000,
            )

            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        finally:
            await http_client.aclose()


# Singleton
rag_service = RAGService()
