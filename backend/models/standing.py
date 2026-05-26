"""Standing ORM model."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import String, Integer, DateTime, ForeignKey, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base

if TYPE_CHECKING:
    from models.team import Team
    from models.competition import Competition


class Standing(Base):
    __tablename__ = "standings"
    __table_args__ = (
        UniqueConstraint("competition_id", "team_id", "season", name="uq_standing_comp_team_season"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    competition_id: Mapped[int] = mapped_column(Integer, ForeignKey("competitions.id"), nullable=False, index=True)
    team_id: Mapped[int] = mapped_column(Integer, ForeignKey("teams.id"), nullable=False, index=True)
    season: Mapped[str] = mapped_column(String(20), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    played: Mapped[int] = mapped_column(Integer, default=0)
    won: Mapped[int] = mapped_column(Integer, default=0)
    drawn: Mapped[int] = mapped_column(Integer, default=0)
    lost: Mapped[int] = mapped_column(Integer, default=0)
    goals_for: Mapped[int] = mapped_column(Integer, default=0)
    goals_against: Mapped[int] = mapped_column(Integer, default=0)
    points: Mapped[int] = mapped_column(Integer, default=0)
    form: Mapped[str | None] = mapped_column(String(20), nullable=True, comment="e.g. W,W,D,L,W")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    competition: Mapped["Competition"] = relationship("Competition", back_populates="standings")
    team: Mapped["Team"] = relationship("Team", back_populates="standings")

    @property
    def goal_difference(self) -> int:
        return self.goals_for - self.goals_against

    def __repr__(self) -> str:
        return f"<Standing(#{self.position} {self.team_id} - {self.points}pts)>"
