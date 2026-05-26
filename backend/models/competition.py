"""Competition ORM model."""
from __future__ import annotations

from datetime import datetime
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base

if TYPE_CHECKING:
    from models.match import Match
    from models.standing import Standing


class Competition(Base):
    __tablename__ = "competitions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False, index=True)
    country: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    current_season: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    api_fd_id: Mapped[Optional[int]] = mapped_column(Integer, unique=True, nullable=True)
    api_af_id: Mapped[Optional[int]] = mapped_column(Integer, unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    matches: Mapped[List["Match"]] = relationship("Match", back_populates="competition")
    standings: Mapped[List["Standing"]] = relationship("Standing", back_populates="competition")

    def __repr__(self) -> str:
        return f"<Competition(id={self.id}, code='{self.code}', name='{self.name}')>"
