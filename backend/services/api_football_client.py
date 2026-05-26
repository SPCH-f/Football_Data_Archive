"""
API-Football (api-sports.io) Client
Rate limit: 100 req/day — ALL responses cached in BOTH Redis AND PostgreSQL.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional, List

import httpx
import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from core.config import settings
from services.cache_service import CacheService

logger = structlog.get_logger(__name__)


class APIFootballClient:
    """Async wrapper for api-sports.io v3 API with dual caching."""

    BASE_URL = settings.api_football_base_url

    def __init__(self):
        self._headers = {
            "x-apisports-key": settings.api_football_key or "",
        }

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.BASE_URL,
            headers=self._headers,
            timeout=30.0,
        )

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=2, min=3, max=60),
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.ConnectTimeout)),
    )
    async def _request(self, endpoint: str, params: dict | None = None) -> dict:
        """Make an authenticated GET request."""
        async with self._client() as client:
            response = await client.get(endpoint, params=params)
            data = response.json()

            # Check API-level errors
            errors = data.get("errors", {})
            if errors:
                if "rateLimit" in str(errors):
                    logger.warning("api_football_rate_limited", errors=errors)
                    raise httpx.HTTPStatusError(
                        "Rate limited", request=response.request, response=response
                    )
                logger.error("api_football_error", errors=errors, endpoint=endpoint)

            response.raise_for_status()
            return data

    async def _cached_request(
        self, cache_key: str, endpoint: str,
        params: dict | None = None, ttl: int = 3600
    ) -> Any:
        """Request with Redis cache layer."""
        async def fetch():
            data = await self._request(endpoint, params)
            return data.get("response", [])

        return await CacheService.get_or_set("af", cache_key, fetch, ttl=ttl)

    # ── Fixture endpoints ────────────────────────────────────

    async def get_next_fixtures(self, league_id: int, count: int = 10) -> List[dict]:
        """Get next N fixtures for a league."""
        return await self._cached_request(
            f"next_fixtures:{league_id}:{count}",
            "/fixtures",
            params={"league": league_id, "next": count},
            ttl=settings.cache_ttl_fixtures,
        )

    async def get_h2h(self, team1_id: int, team2_id: int, last: int = 10) -> List[dict]:
        """Get head-to-head history. Cached 7 days."""
        # Sort IDs so cache key is consistent regardless of order
        key_pair = f"{min(team1_id, team2_id)}-{max(team1_id, team2_id)}"
        return await self._cached_request(
            f"h2h:{key_pair}",
            "/fixtures/headtohead",
            params={"h2h": f"{team1_id}-{team2_id}", "last": last},
            ttl=settings.cache_ttl_h2h,
        )

    async def get_fixture_stats(self, fixture_id: int) -> List[dict]:
        """Get match statistics for a fixture."""
        return await self._cached_request(
            f"fixture_stats:{fixture_id}",
            "/fixtures/statistics",
            params={"fixture": fixture_id},
            ttl=settings.cache_ttl_standings,
        )

    async def get_predictions(self, fixture_id: int) -> List[dict]:
        """Get prediction data for a fixture. Cached 24hrs."""
        return await self._cached_request(
            f"predictions:{fixture_id}",
            "/predictions",
            params={"fixture": fixture_id},
            ttl=settings.cache_ttl_standings,
        )

    async def get_injuries(self, league_id: int, season: int) -> List[dict]:
        """Get injury reports. Cached 6hrs."""
        return await self._cached_request(
            f"injuries:{league_id}:{season}",
            "/injuries",
            params={"league": league_id, "season": season},
            ttl=settings.cache_ttl_fixtures,
        )

    # ── PostgreSQL persistence (for expensive API-Football data) ──

    async def persist_response(
        self, db: AsyncSession, endpoint: str, params: dict, data: Any
    ) -> None:
        """Store raw API response in PostgreSQL for long-term caching."""
        try:
            await db.execute(
                text("""
                    INSERT INTO api_cache (endpoint, params, response_data, fetched_at)
                    VALUES (:endpoint, :params, :data, :fetched_at)
                    ON CONFLICT (endpoint, params)
                    DO UPDATE SET response_data = :data, fetched_at = :fetched_at
                """),
                {
                    "endpoint": endpoint,
                    "params": json.dumps(params, sort_keys=True),
                    "data": json.dumps(data, default=str),
                    "fetched_at": datetime.now(timezone.utc),
                },
            )
            await db.commit()
        except Exception as e:
            logger.error("persist_response_error", endpoint=endpoint, error=str(e))
            await db.rollback()

    async def get_persisted_response(
        self, db: AsyncSession, endpoint: str, params: dict, max_age_hours: int = 168
    ) -> Optional[Any]:
        """Retrieve cached response from PostgreSQL if fresh enough."""
        try:
            result = await db.execute(
                text("""
                    SELECT response_data FROM api_cache
                    WHERE endpoint = :endpoint AND params = :params
                    AND fetched_at > NOW() - INTERVAL ':hours hours'
                """),
                {
                    "endpoint": endpoint,
                    "params": json.dumps(params, sort_keys=True),
                    "hours": max_age_hours,
                },
            )
            row = result.fetchone()
            if row:
                return json.loads(row[0])
        except Exception as e:
            logger.error("get_persisted_error", endpoint=endpoint, error=str(e))
        return None


# Singleton
api_football_client = APIFootballClient()
