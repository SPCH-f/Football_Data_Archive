"""
Matches API Routes — upcoming fixtures, match details, standings, team form.
"""
from __future__ import annotations

from typing import List

import structlog
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.dependencies import get_db_session
from models.match import Match
from models.team import Team
from models.standing import Standing
from models.competition import Competition
from schemas import MatchResponse, MatchDetailResponse, StandingResponse, StandingsTableResponse, TeamResponse

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get("/upcoming", response_model=List[MatchResponse])
async def get_upcoming_matches(
    db: AsyncSession = Depends(get_db_session),
    limit: int = Query(default=10, le=50),
    competition: str | None = Query(default=None, description="Filter by competition code"),
):
    """Get next upcoming fixtures from the database cache."""
    query = (
        select(Match)
        .where(Match.status.in_(["SCHEDULED", "TIMED"]))
        .order_by(Match.match_date)
        .limit(limit)
    )

    if competition:
        query = query.join(Competition).where(Competition.code == competition)

    result = await db.execute(query)
    matches = result.scalars().all()

    response = []
    for m in matches:
        home = await db.get(Team, m.home_team_id)
        away = await db.get(Team, m.away_team_id)
        comp = await db.get(Competition, m.competition_id)

        response.append(MatchResponse(
            id=m.id,
            competition_name=comp.name if comp else None,
            home_team=TeamResponse.model_validate(home) if home else None,
            away_team=TeamResponse.model_validate(away) if away else None,
            match_date=m.match_date,
            status=m.status,
            home_score=m.home_score,
            away_score=m.away_score,
            venue=m.venue,
            matchday=m.matchday,
        ))

    return response


@router.get("/{match_id}", response_model=MatchDetailResponse)
async def get_match_detail(
    match_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """Get detailed match info including H2H and form."""
    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found",
        )

    home = await db.get(Team, match.home_team_id)
    away = await db.get(Team, match.away_team_id)
    comp = await db.get(Competition, match.competition_id)

    # Get recent form for both teams (last 5 results)
    home_form = await _get_team_form(db, match.home_team_id)
    away_form = await _get_team_form(db, match.away_team_id)

    # Get H2H from finished matches between these teams
    h2h_data = await _get_h2h(db, match.home_team_id, match.away_team_id)

    return MatchDetailResponse(
        id=match.id,
        competition_name=comp.name if comp else None,
        home_team=TeamResponse.model_validate(home) if home else None,
        away_team=TeamResponse.model_validate(away) if away else None,
        match_date=match.match_date,
        status=match.status,
        home_score=match.home_score,
        away_score=match.away_score,
        venue=match.venue,
        matchday=match.matchday,
        h2h=h2h_data,
        home_form=home_form,
        away_form=away_form,
    )


@router.get("/standings/{competition_code}", response_model=StandingsTableResponse)
async def get_standings(
    competition_code: str,
    db: AsyncSession = Depends(get_db_session),
):
    """Get current league table for a competition."""
    comp = (
        await db.execute(
            select(Competition).where(Competition.code == competition_code.upper())
        )
    ).scalar_one_or_none()

    if not comp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Competition '{competition_code}' not found",
        )

    standings = (
        await db.execute(
            select(Standing)
            .where(Standing.competition_id == comp.id)
            .order_by(Standing.position)
        )
    ).scalars().all()

    standings_response = []
    for s in standings:
        team = await db.get(Team, s.team_id)
        if team:
            standings_response.append(StandingResponse(
                position=s.position,
                team=TeamResponse.model_validate(team),
                played=s.played,
                won=s.won,
                drawn=s.drawn,
                lost=s.lost,
                goals_for=s.goals_for,
                goals_against=s.goals_against,
                goal_difference=s.goal_difference,
                points=s.points,
                form=s.form,
            ))

    return StandingsTableResponse(
        competition=comp.name,
        season=comp.current_season or "2024/25",
        standings=standings_response,
    )


@router.get("/teams/{team_id}/form")
async def get_team_form(
    team_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """Get last 5 results for a team."""
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )

    form = await _get_team_form(db, team_id)
    return {
        "team": TeamResponse.model_validate(team),
        "form": form,
    }


# ── Helpers ──────────────────────────────────────────────────

async def _get_team_form(db: AsyncSession, team_id: int, limit: int = 5) -> List[str]:
    """Get W/D/L form from last N finished matches."""
    result = await db.execute(
        select(Match)
        .where(
            Match.status == "FINISHED",
            (Match.home_team_id == team_id) | (Match.away_team_id == team_id),
        )
        .order_by(Match.match_date.desc())
        .limit(limit)
    )
    matches = result.scalars().all()

    form = []
    for m in matches:
        if m.home_score is None or m.away_score is None:
            continue
        if team_id == m.home_team_id:
            if m.home_score > m.away_score:
                form.append("W")
            elif m.home_score < m.away_score:
                form.append("L")
            else:
                form.append("D")
        else:
            if m.away_score > m.home_score:
                form.append("W")
            elif m.away_score < m.home_score:
                form.append("L")
            else:
                form.append("D")

    return form


async def _get_h2h(
    db: AsyncSession, team1_id: int, team2_id: int, limit: int = 5
) -> List[dict]:
    """Get head-to-head results between two teams."""
    result = await db.execute(
        select(Match)
        .where(
            Match.status == "FINISHED",
            (
                (Match.home_team_id == team1_id) & (Match.away_team_id == team2_id)
            ) | (
                (Match.home_team_id == team2_id) & (Match.away_team_id == team1_id)
            ),
        )
        .order_by(Match.match_date.desc())
        .limit(limit)
    )
    matches = result.scalars().all()

    h2h = []
    for m in matches:
        home = await db.get(Team, m.home_team_id)
        away = await db.get(Team, m.away_team_id)
        h2h.append({
            "date": m.match_date.isoformat(),
            "home_team": home.name if home else str(m.home_team_id),
            "away_team": away.name if away else str(m.away_team_id),
            "home_score": m.home_score,
            "away_score": m.away_score,
        })

    return h2h
