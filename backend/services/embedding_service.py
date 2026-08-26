"""
Embedding Service — configurable between OpenAI and local sentence-transformers.
"""
from __future__ import annotations

from typing import List

import structlog

from core.config import settings

logger = structlog.get_logger(__name__)


class EmbeddingService:
    """Generate embeddings using OpenAI or sentence-transformers."""

    def __init__(self):
        self._model = None

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Embed a batch of texts. Returns list of embedding vectors.
        
        Uses local sentence-transformers when EMBEDDING_DIMENSION=384,
        uses OpenAI when EMBEDDING_DIMENSION=1536.
        """
        if not texts:
            return []

        # Use local model if dimension is 384 (all-MiniLM-L6-v2) or no OpenAI key
        use_local = (
            settings.embedding_dimension == 384
            or not settings.openai_api_key
            or settings.llm_provider != "openai"
        )

        if use_local:
            return self._embed_local(texts)
        else:
            return await self._embed_openai(texts)

    async def embed_query(self, text: str) -> List[float]:
        """Embed a single query string."""
        results = await self.embed_batch([text])
        return results[0] if results else []

    async def _embed_openai(self, texts: List[str]) -> List[List[float]]:
        """Use OpenAI text-embedding-ada-002."""
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=settings.openai_api_key)

        # OpenAI has a limit of ~8191 tokens per input, batch up to 2048 inputs
        all_embeddings = []
        batch_size = 100

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            # Truncate long texts
            batch = [t[:8000] for t in batch]

            response = await client.embeddings.create(
                model=settings.openai_embedding_model,
                input=batch,
            )
            batch_embeddings = [item.embedding for item in response.data]
            all_embeddings.extend(batch_embeddings)

        logger.info("openai_embeddings_created", count=len(all_embeddings))
        return all_embeddings

    def _embed_local(self, texts: List[str]) -> List[List[float]]:
        """Use local sentence-transformers model."""
        from sentence_transformers import SentenceTransformer

        if self._model is None:
            self._model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
            logger.info("local_model_loaded", model="paraphrase-multilingual-MiniLM-L12-v2")

        embeddings = self._model.encode(texts, show_progress_bar=False)
        logger.info("local_embeddings_created", count=len(embeddings))
        return embeddings.tolist()
