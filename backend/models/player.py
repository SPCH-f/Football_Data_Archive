"""Player ORM model."""
from __future__ import annotations

from datetime import datetime
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import String, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base

if TYPE_CHECKING:
    from models.team import Team
    from models.player_stats import PlayerStats


class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    team_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("teams.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    position: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    nationality: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    injured: Mapped[bool] = mapped_column(default=False)
    injury_description: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    api_af_id: Mapped[Optional[int]] = mapped_column(Integer, unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    team: Mapped[Optional["Team"]] = relationship("Team", back_populates="players")
    stats: Mapped[List["PlayerStats"]] = relationship("PlayerStats", back_populates="player")

    def __repr__(self) -> str:
        return f"<Player(id={self.id}, name='{self.name}')>"
