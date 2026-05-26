"""
RAG Service — Retriever + LangChain chain + streaming response generation.
Implements the full RAG pipeline: embed query → retrieve → rerank → generate.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import AsyncIterator, List, Optional

import structlog
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import async_session_factory
from models.document import FootballDocument
from models.chat import ChatSession, ChatMessage
from services.embedding_service import EmbeddingService

logger = structlog.get_logger(__name__)

SYSTEM_PROMPT = """You are FootballGPT, an expert football analyst. Answer using ONLY the provided \
context. If predicting a match, reason step by step: consider current form (last 5), \
H2H record, home/away advantage, key absences, and league position. \
Always cite your sources (match dates, competition names). \
If context is insufficient, say so — never hallucinate statistics.

Context:
{context}

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
        threshold = threshold or settings.rag_similarity_threshold

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
            {"embedding": embedding_str, "limit": top_k * 2},  # Fetch extra for MMR
        )
        rows = result.fetchall()

        # Filter by threshold
        docs = []
        for row in rows:
            if row.similarity >= threshold:
                docs.append({
                    "id": str(row.id),
                    "content": row.content,
                    "metadata": row.metadata,
                    "similarity": float(row.similarity),
                })

        # Step 3: Optional MMR reranking
        if settings.rag_use_mmr and len(docs) > top_k:
            docs = self._mmr_rerank(docs, query_embedding, top_k)
        else:
            docs = docs[:top_k]

        logger.info("documents_retrieved", count=len(docs),
                     query_preview=query[:80])
        return docs

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
            retrieved_docs = await self.retrieve_documents(query, db)
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

            if settings.llm_provider == "openai":
                async for token in self._stream_openai(messages):
                    full_response += token
                    yield token
            else:
                async for token in self._stream_anthropic(messages):
                    full_response += token
                    yield token

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


# Singleton
rag_service = RAGService()
