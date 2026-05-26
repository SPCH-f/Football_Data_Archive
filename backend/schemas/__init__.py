"""Pydantic v2 schemas for request/response validation."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


# ── Chat ─────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    session_id: Optional[uuid.UUID] = None


class ChatSessionCreate(BaseModel):
    title: Optional[str] = None
    metadata: Optional[dict] = None


class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    retrieved_docs: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatSessionResponse(BaseModel):
    id: uuid.UUID
    title: Optional[str] = None
    created_at: datetime
    messages: List[ChatMessageResponse] = []

    model_config = {"from_attributes": True}


# ── Teams ────────────────────────────────────────────────────
class TeamResponse(BaseModel):
    id: int
    name: str
    short_name: Optional[str] = None
    country: Optional[str] = None
    logo_url: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Matches ──────────────────────────────────────────────────
class MatchResponse(BaseModel):
    id: int
    competition_name: Optional[str] = None
    home_team: Optional[TeamResponse] = None
    away_team: Optional[TeamResponse] = None
    match_date: datetime
    status: str
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    venue: Optional[str] = None
    matchday: Optional[int] = None

    model_config = {"from_attributes": True}


class MatchDetailResponse(MatchResponse):
    h2h: Optional[List[dict]] = None
    home_form: Optional[List[str]] = None
    away_form: Optional[List[str]] = None


# ── Standings ────────────────────────────────────────────────
class StandingResponse(BaseModel):
    position: int
    team: TeamResponse
    played: int
    won: int
    drawn: int
    lost: int
    goals_for: int
    goals_against: int
    goal_difference: int
    points: int
    form: Optional[str] = None

    model_config = {"from_attributes": True}


class StandingsTableResponse(BaseModel):
    competition: str
    season: str
    standings: List[StandingResponse]


# ── Admin ────────────────────────────────────────────────────
class SyncStatusResponse(BaseModel):
    last_fixtures_sync: Optional[datetime] = None
    last_standings_sync: Optional[datetime] = None
    total_documents: int = 0
    total_matches: int = 0
    total_teams: int = 0


class SyncTriggerResponse(BaseModel):
    status: str
    message: str
