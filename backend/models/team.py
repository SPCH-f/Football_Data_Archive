"""Team ORM model."""
from __future__ import annotations

from datetime import datetime
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base

if TYPE_CHECKING:
    from models.match import Match
    from models.player import Player
    from models.standing import Standing


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    short_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    api_fd_id: Mapped[Optional[int]] = mapped_column(Integer, unique=True, nullable=True, comment="football-data.org ID")
    api_af_id: Mapped[Optional[int]] = mapped_column(Integer, unique=True, nullable=True, comment="api-football ID")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    home_matches: Mapped[List["Match"]] = relationship("Match", foreign_keys="Match.home_team_id", back_populates="home_team")
    away_matches: Mapped[List["Match"]] = relationship("Match", foreign_keys="Match.away_team_id", back_populates="away_team")
    players: Mapped[List["Player"]] = relationship("Player", back_populates="team")
    standings: Mapped[List["Standing"]] = relationship("Standing", back_populates="team")

    def __repr__(self) -> str:
        return f"<Team(id={self.id}, name='{self.name}')>"
