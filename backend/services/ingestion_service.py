"""
Ingestion Service — Fetch → Chunk → Embed → Upsert pipeline.
Converts raw football API data into natural language chunks with embeddings
and stores them in the football_documents vector table.
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from typing import List, Optional

import structlog
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import async_session_factory
from models.document import FootballDocument
from models.team import Team
from models.competition import Competition
from models.match import Match
from models.standing import Standing
from models.player import Player
from services.football_data_client import football_data_client
from services.api_football_client import api_football_client
from services.embedding_service import EmbeddingService

logger = structlog.get_logger(__name__)


class IngestionService:
    """Orchestrates the data fetch → chunk → embed → upsert pipeline."""

    def __init__(self):
        self.embedder = EmbeddingService()

    # ── Step 1: Sync structured data from APIs ───────────────

    async def sync_competition_data(self, competition_code: str, db: AsyncSession) -> dict:
        """Sync teams, matches, standings for a competition."""
        stats = {"teams": 0, "matches": 0, "standings": 0, "documents": 0, "errors": []}

        try:
            # Get competition info
            comp = await db.execute(
                select(Competition).where(Competition.code == competition_code)
            )
            competition = comp.scalar_one_or_none()
            if not competition:
                logger.warning("competition_not_found", code=competition_code)
                return stats

            # Sync standings
            standings_data = await football_data_client.get_standings(competition_code)
            for s in standings_data:
                team = await self._upsert_team(db, s.get("team", {}))
                if team:
                    await self._upsert_standing(db, competition.id, team.id, s)
                    stats["standings"] += 1

            # Sync upcoming matches
            matches_data = await football_data_client.get_matches(competition_code)
            for m in matches_data:
                home_team = await self._upsert_team(db, m.get("homeTeam", {}))
                away_team = await self._upsert_team(db, m.get("awayTeam", {}))
                if home_team and away_team:
                    await self._upsert_match(db, competition.id, home_team.id, away_team.id, m)
                    stats["matches"] += 1

            # Sync finished matches too
            finished = await football_data_client.get_matches(competition_code, status="FINISHED")
            for m in finished[-20:]:  # Last 20 finished
                home_team = await self._upsert_team(db, m.get("homeTeam", {}))
                away_team = await self._upsert_team(db, m.get("awayTeam", {}))
                if home_team and away_team:
                    await self._upsert_match(db, competition.id, home_team.id, away_team.id, m)

            await db.commit()
            stats["teams"] = (await db.execute(select(Team))).scalars().all().__len__()

        except Exception as e:
            stats["errors"].append(str(e))
            logger.error("sync_competition_error", code=competition_code, error=str(e))
            await db.rollback()

        return stats

    # ── Step 2: Generate natural language chunks ─────────────

    async def generate_chunks(self, db: AsyncSession) -> List[dict]:
        """Convert structured data into NL chunks for embedding."""
        chunks = []

        # Standings chunks
        competitions = (await db.execute(select(Competition))).scalars().all()
        for comp in competitions:
            standings = (
                await db.execute(
                    select(Standing)
                    .where(Standing.competition_id == comp.id)
                    .order_by(Standing.position)
                )
            ).scalars().all()

            if standings:
                chunk = await self._build_standings_chunk(db, comp, standings)
                if chunk:
                    chunks.append(chunk)

        # Upcoming match chunks (with form data)
        upcoming = (
            await db.execute(
                select(Match)
                .where(Match.status == "SCHEDULED")
                .order_by(Match.match_date)
                .limit(30)
            )
        ).scalars().all()

        for match in upcoming:
            chunk = await self._build_match_chunk(db, match)
            if chunk:
                chunks.append(chunk)

        # Recent results chunks
        recent = (
            await db.execute(
                select(Match)
                .where(Match.status == "FINISHED")
                .order_by(Match.match_date.desc())
                .limit(30)
            )
        ).scalars().all()

        for match in recent:
            chunk = await self._build_result_chunk(db, match)
            if chunk:
                chunks.append(chunk)

        logger.info("chunks_generated", count=len(chunks))
        return chunks

    async def _build_standings_chunk(
        self, db: AsyncSession, comp: Competition, standings: list
    ) -> Optional[dict]:
        """Build a NL chunk for league standings."""
        lines = [f"{comp.name} Standings (Current Season):"]
        for s in standings:  # All teams
            team = await db.get(Team, s.team_id)
            name = team.name if team else f"Team {s.team_id}"
            gd = f"+{s.goal_difference}" if s.goal_difference > 0 else str(s.goal_difference)
            form_str = f" Form: {s.form}" if s.form else ""
            lines.append(
                f"  {s.position}. {name} — P:{s.played} W:{s.won} D:{s.drawn} L:{s.lost} "
                f"GF:{s.goals_for} GA:{s.goals_against} GD:{gd} Pts:{s.points}{form_str}"
            )

        content = "\n".join(lines)
        return {
            "content": content,
            "metadata": {
                "source": "football-data.org",
                "type": "standings",
                "competition": comp.code,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        }

    async def _build_match_chunk(self, db: AsyncSession, match: Match) -> Optional[dict]:
        """Build a NL chunk for an upcoming match with context."""
        home = await db.get(Team, match.home_team_id)
        away = await db.get(Team, match.away_team_id)
        comp = await db.get(Competition, match.competition_id)
        if not (home and away and comp):
            return None

        # Get standings for both teams
        home_standing = (
            await db.execute(
                select(Standing).where(
                    Standing.team_id == home.id,
                    Standing.competition_id == comp.id,
                )
            )
        ).scalar_one_or_none()

        away_standing = (
            await db.execute(
                select(Standing).where(
                    Standing.team_id == away.id,
                    Standing.competition_id == comp.id,
                )
            )
        ).scalar_one_or_none()

        date_str = match.match_date.strftime("%Y-%m-%d %H:%M UTC")
        lines = [f"{home.name} vs {away.name} on {date_str} ({comp.name})."]

        if home_standing:
            lines.append(
                f"{home.name} are {_ordinal(home_standing.position)} in {comp.name} "
                f"with {home_standing.points} pts (W{home_standing.won} D{home_standing.drawn} L{home_standing.lost})."
            )
        if away_standing:
            lines.append(
                f"{away.name} are {_ordinal(away_standing.position)} in {comp.name} "
                f"with {away_standing.points} pts (W{away_standing.won} D{away_standing.drawn} L{away_standing.lost})."
            )
        if home_standing and home_standing.form:
            lines.append(f"{home.name} recent form: {home_standing.form}")
        if away_standing and away_standing.form:
            lines.append(f"{away.name} recent form: {away_standing.form}")

        venue = f" Venue: {match.venue}." if match.venue else ""
        lines.append(f"Competition: {comp.name}, Matchday {match.matchday or 'N/A'}.{venue}")

        content = " ".join(lines)
        return {
            "content": content,
            "metadata": {
                "source": "football-data.org",
                "type": "upcoming_match",
                "competition": comp.code,
                "team_ids": [home.id, away.id],
                "match_id": match.id,
                "match_date": match.match_date.isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        }

    async def _build_result_chunk(self, db: AsyncSession, match: Match) -> Optional[dict]:
        """Build a NL chunk for a finished match."""
        home = await db.get(Team, match.home_team_id)
        away = await db.get(Team, match.away_team_id)
        comp = await db.get(Competition, match.competition_id)
        if not (home and away and comp):
            return None

        date_str = match.match_date.strftime("%Y-%m-%d")
        score = f"{match.home_score}-{match.away_score}"

        if match.home_score > match.away_score:
            result = f"{home.name} won"
        elif match.away_score > match.home_score:
            result = f"{away.name} won"
        else:
            result = "Draw"

        content = (
            f"{home.name} {score} {away.name} on {date_str} ({comp.name}). "
            f"Result: {result}."
        )

        return {
            "content": content,
            "metadata": {
                "source": "football-data.org",
                "type": "match_result",
                "competition": comp.code,
                "team_ids": [home.id, away.id],
                "match_id": match.id,
                "match_date": match.match_date.isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        }

    # ── Step 3 & 4: Embed and upsert ────────────────────────

    async def embed_and_upsert(self, chunks: List[dict], db: AsyncSession) -> int:
        """Embed chunks and upsert into football_documents. Returns count upserted."""
        if not chunks:
            return 0

        contents = [c["content"] for c in chunks]
        embeddings = await self.embedder.embed_batch(contents)

        upserted = 0
        for chunk, embedding in zip(chunks, embeddings):
            content_hash = hashlib.sha256(chunk["content"].encode()).hexdigest()

            # Check if document already exists
            existing = await db.execute(
                select(FootballDocument).where(FootballDocument.content_hash == content_hash)
            )
            doc = existing.scalar_one_or_none()

            if doc:
                doc.embedding = embedding
                doc.metadata_ = chunk["metadata"]
            else:
                doc = FootballDocument(
                    content=chunk["content"],
                    metadata_=chunk["metadata"],
                    embedding=embedding,
                    content_hash=content_hash,
                )
                db.add(doc)

            upserted += 1

        await db.commit()
        logger.info("documents_upserted", count=upserted)
        return upserted

    # ── Full pipeline ────────────────────────────────────────

    async def run_full_ingestion(self) -> dict:
        """Run complete ingestion pipeline for all tracked competitions."""
        total_stats = {
            "competitions_synced": 0,
            "chunks_generated": 0,
            "documents_upserted": 0,
            "errors": [],
        }

        # Competition metadata map (code → name)
        COMPETITION_NAMES = {
            "PL": "Premier League",
            "PD": "La Liga",
            "BL1": "Bundesliga",
            "SA": "Serie A",
            "FL1": "Ligue 1",
            "CL": "UEFA Champions League",
            "DED": "Eredivisie",
            "PPL": "Primeira Liga",
        }

        async with async_session_factory() as db:
            # ── Step 0: Seed competition rows first ──────────────
            for code in settings.competition_codes:
                try:
                    existing = (
                        await db.execute(select(Competition).where(Competition.code == code))
                    ).scalar_one_or_none()

                    if not existing:
                        # Try to fetch from API first
                        try:
                            comp_data = await football_data_client.get_competition_info(code)
                            if comp_data:
                                comp = Competition(
                                    name=comp_data.get("name", COMPETITION_NAMES.get(code, code)),
                                    code=code,
                                    country=comp_data.get("area", {}).get("name"),
                                    logo_url=comp_data.get("emblem"),
                                    api_fd_id=comp_data.get("id"),
                                )
                            else:
                                raise ValueError("No data from API")
                        except Exception:
                            # Fallback: create with known name
                            comp = Competition(
                                name=COMPETITION_NAMES.get(code, code),
                                code=code,
                            )
                        db.add(comp)
                        logger.info("competition_seeded", code=code)

                except Exception as e:
                    logger.error("competition_seed_error", code=code, error=str(e))

            await db.commit()  # Commit competitions BEFORE syncing matches

            # ── Step 1: Sync match/standing data ─────────────────
            for code in settings.competition_codes:
                try:
                    logger.info("ingestion_start", competition=code)
                    stats = await self.sync_competition_data(code, db)
                    total_stats["competitions_synced"] += 1

                    if stats.get("errors"):
                        total_stats["errors"].extend(stats["errors"])

                except Exception as e:
                    total_stats["errors"].append(f"{code}: {str(e)}")
                    logger.error("ingestion_competition_error", code=code, error=str(e))

            # ── Step 2: Generate chunks and embed ────────────────
            try:
                chunks = await self.generate_chunks(db)
                total_stats["chunks_generated"] = len(chunks)

                upserted = await self.embed_and_upsert(chunks, db)
                total_stats["documents_upserted"] = upserted

            except Exception as e:
                total_stats["errors"].append(f"embedding: {str(e)}")
                logger.error("ingestion_embedding_error", error=str(e))

        logger.info("ingestion_complete", stats=total_stats)
        return total_stats


    # ── Helper: upsert structured data ───────────────────────

    async def _upsert_team(self, db: AsyncSession, team_data: dict) -> Optional[Team]:
        """Upsert a team from API data."""
        fd_id = team_data.get("id")
        if not fd_id:
            return None

        result = await db.execute(select(Team).where(Team.api_fd_id == fd_id))
        team = result.scalar_one_or_none()

        if team:
            team.name = team_data.get("name", team.name)
            team.short_name = team_data.get("shortName") or team_data.get("tla") or team.short_name
            team.logo_url = team_data.get("crest") or team.logo_url
        else:
            team = Team(
                name=team_data.get("name", "Unknown"),
                short_name=team_data.get("shortName") or team_data.get("tla"),
                logo_url=team_data.get("crest"),
                api_fd_id=fd_id,
            )
            db.add(team)
            await db.flush()

        return team

    async def _upsert_match(
        self, db: AsyncSession, competition_id: int,
        home_team_id: int, away_team_id: int, match_data: dict
    ) -> Optional[Match]:
        """Upsert a match from API data."""
        fd_id = match_data.get("id")
        if not fd_id:
            return None

        result = await db.execute(select(Match).where(Match.api_fd_id == fd_id))
        match = result.scalar_one_or_none()

        match_date = datetime.fromisoformat(
            match_data.get("utcDate", "2025-01-01T00:00:00Z").replace("Z", "+00:00")
        )
        score = match_data.get("score", {})
        full_time = score.get("fullTime", {})

        if match:
            match.status = match_data.get("status", match.status)
            match.home_score = full_time.get("home")
            match.away_score = full_time.get("away")
            match.venue = match_data.get("venue") or match.venue
            match.matchday = match_data.get("matchday") or match.matchday
        else:
            match = Match(
                competition_id=competition_id,
                home_team_id=home_team_id,
                away_team_id=away_team_id,
                match_date=match_date,
                status=match_data.get("status", "SCHEDULED"),
                home_score=full_time.get("home"),
                away_score=full_time.get("away"),
                venue=match_data.get("venue"),
                matchday=match_data.get("matchday"),
                api_fd_id=fd_id,
            )
            db.add(match)
            await db.flush()

        return match

    async def _upsert_standing(
        self, db: AsyncSession, competition_id: int, team_id: int, standing_data: dict
    ) -> None:
        """Upsert a standing record."""
        season = str(datetime.now(timezone.utc).year)

        result = await db.execute(
            select(Standing).where(
                Standing.competition_id == competition_id,
                Standing.team_id == team_id,
                Standing.season == season,
            )
        )
        standing = result.scalar_one_or_none()

        if standing:
            standing.position = standing_data.get("position", standing.position)
            standing.played = standing_data.get("playedGames", standing.played)
            standing.won = standing_data.get("won", standing.won)
            standing.drawn = standing_data.get("draw", standing.drawn)
            standing.lost = standing_data.get("lost", standing.lost)
            standing.goals_for = standing_data.get("goalsFor", standing.goals_for)
            standing.goals_against = standing_data.get("goalsAgainst", standing.goals_against)
            standing.points = standing_data.get("points", standing.points)
            standing.form = standing_data.get("form")
        else:
            standing = Standing(
                competition_id=competition_id,
                team_id=team_id,
                season=season,
                position=standing_data.get("position", 0),
                played=standing_data.get("playedGames", 0),
                won=standing_data.get("won", 0),
                drawn=standing_data.get("draw", 0),
                lost=standing_data.get("lost", 0),
                goals_for=standing_data.get("goalsFor", 0),
                goals_against=standing_data.get("goalsAgainst", 0),
                points=standing_data.get("points", 0),
                form=standing_data.get("form"),
            )
            db.add(standing)


def _ordinal(n: int) -> str:
    """Convert number to ordinal string: 1 → '1st', 2 → '2nd', etc."""
    if 11 <= (n % 100) <= 13:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


# Singleton
ingestion_service = IngestionService()
