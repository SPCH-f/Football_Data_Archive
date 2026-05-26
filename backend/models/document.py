"""FootballDocument ORM model — pgvector-backed RAG vector store."""
from __future__ import annotations

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import Text, DateTime, Index, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base
from core.config import settings


class FootballDocument(Base):
    __tablename__ = "football_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="Human-readable chunk")
    metadata_: Mapped[dict] = mapped_column(
        "metadata", JSONB, nullable=True,
        comment="{source, type, team_ids, match_id, date, updated_at}"
    )
    embedding: Mapped[list] = mapped_column(
        Vector(settings.embedding_dimension), nullable=True
    )
    content_hash: Mapped[str | None] = mapped_column(
        Text, unique=True, nullable=True,
        comment="SHA256 hash for deduplication"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # HNSW index for fast cosine similarity search
    __table_args__ = (
        Index(
            "ix_football_documents_embedding_hnsw",
            embedding,
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )

    def __repr__(self) -> str:
        return f"<FootballDocument(id={self.id}, content='{self.content[:50]}...')>"
