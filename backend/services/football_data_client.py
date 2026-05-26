"""
football-data.org API Client
Rate limit: 10 req/min — ALL responses cached in Redis.
"""
from __future__ import annotations

from typing import Any, Optional, List

import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from core.config import settings
from services.cache_service import CacheService

logger = structlog.get_logger(__name__)


class FootballDataClient:
    """Async wrapper for football-data.org v4 API."""

    BASE_URL = settings.football_data_base_url

    def __init__(self):
        self._headers = {"X-Auth-Token": settings.football_data_api_key or ""}

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.BASE_URL,
            headers=self._headers,
            timeout=30.0,
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.ConnectTimeout)),
    )
    async def _request(self, endpoint: str) -> dict:
        """Make an authenticated GET request with retry logic."""
        async with self._client() as client:
            response = await client.get(endpoint)
            if response.status_code == 429:
                logger.warning("rate_limited", endpoint=endpoint)
                raise httpx.HTTPStatusError(
                    "Rate limited", request=response.request, response=response
                )
            response.raise_for_status()
            return response.json()

    async def get_matches(self, competition_code: str, status: str = "SCHEDULED") -> List[dict]:
        """Get upcoming matches for a competition. Cached 1hr."""
        cache_key = f"matches:{competition_code}:{status}"

        async def fetch():
            data = await self._request(
                f"/competitions/{competition_code}/matches?status={status}"
            )
            return data.get("matches", [])

        return await CacheService.get_or_set(
            "fd", cache_key, fetch, ttl=settings.cache_ttl_fixtures
        )

    async def get_standings(self, competition_code: str) -> List[dict]:
        """Get current league table. Cached 24hrs."""
        cache_key = f"standings:{competition_code}"

        async def fetch():
            data = await self._request(
                f"/competitions/{competition_code}/standings"
            )
            standings_list = data.get("standings", [])
            # Return the 'TOTAL' type standings table
            for s in standings_list:
                if s.get("type") == "TOTAL":
                    return s.get("table", [])
            return standings_list[0].get("table", []) if standings_list else []

        return await CacheService.get_or_set(
            "fd", cache_key, fetch, ttl=settings.cache_ttl_standings
        )

    async def get_scorers(self, competition_code: str, limit: int = 10) -> List[dict]:
        """Get top scorers. Cached 24hrs."""
        cache_key = f"scorers:{competition_code}"

        async def fetch():
            data = await self._request(
                f"/competitions/{competition_code}/scorers?limit={limit}"
            )
            return data.get("scorers", [])

        return await CacheService.get_or_set(
            "fd", cache_key, fetch, ttl=settings.cache_ttl_standings
        )

    async def get_team_matches(self, team_id: int, limit: int = 5) -> List[dict]:
        """Get recent matches for a team (form). Cached 1hr."""
        cache_key = f"team_matches:{team_id}"

        async def fetch():
            data = await self._request(
                f"/teams/{team_id}/matches?status=FINISHED&limit={limit}"
            )
            return data.get("matches", [])

        return await CacheService.get_or_set(
            "fd", cache_key, fetch, ttl=settings.cache_ttl_team_form
        )

    async def get_competition_info(self, competition_code: str) -> Optional[dict]:
        """Get competition details. Cached 24hrs."""
        cache_key = f"comp_info:{competition_code}"

        async def fetch():
            return await self._request(f"/competitions/{competition_code}")

        return await CacheService.get_or_set(
            "fd", cache_key, fetch, ttl=settings.cache_ttl_standings
        )


# Singleton
football_data_client = FootballDataClient()
