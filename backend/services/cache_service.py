"""
Cache Service — Redis helpers for get/set/invalidate with JSON serialization.
All external API responses MUST go through this layer.
"""
from __future__ import annotations

import json
from typing import Any, Optional

import structlog
from redis.asyncio import Redis

from core.redis_client import get_redis

logger = structlog.get_logger(__name__)


class CacheService:
    """Redis cache wrapper with JSON serialization and key namespacing."""

    PREFIX = "frag:"  # football-rag namespace

    @classmethod
    async def _redis(cls) -> Redis:
        return await get_redis()

    @classmethod
    def _key(cls, namespace: str, key: str) -> str:
        return f"{cls.PREFIX}{namespace}:{key}"

    @classmethod
    async def get(cls, namespace: str, key: str) -> Optional[Any]:
        """Get a cached value. Returns None if miss."""
        redis = await cls._redis()
        full_key = cls._key(namespace, key)
        raw = await redis.get(full_key)
        if raw is None:
            logger.debug("cache_miss", key=full_key)
            return None
        logger.debug("cache_hit", key=full_key)
        return json.loads(raw)

    @classmethod
    async def set(
        cls, namespace: str, key: str, value: Any, ttl: int = 3600
    ) -> None:
        """Set a cached value with TTL in seconds."""
        redis = await cls._redis()
        full_key = cls._key(namespace, key)
        await redis.set(full_key, json.dumps(value, default=str), ex=ttl)
        logger.debug("cache_set", key=full_key, ttl=ttl)

    @classmethod
    async def delete(cls, namespace: str, key: str) -> None:
        """Delete a single cached key."""
        redis = await cls._redis()
        full_key = cls._key(namespace, key)
        await redis.delete(full_key)
        logger.debug("cache_delete", key=full_key)

    @classmethod
    async def invalidate_namespace(cls, namespace: str) -> int:
        """Delete all keys in a namespace. Returns count deleted."""
        redis = await cls._redis()
        pattern = f"{cls.PREFIX}{namespace}:*"
        count = 0
        async for key in redis.scan_iter(match=pattern, count=100):
            await redis.delete(key)
            count += 1
        logger.info("cache_invalidate_namespace", namespace=namespace, deleted=count)
        return count

    @classmethod
    async def get_or_set(
        cls, namespace: str, key: str, factory, ttl: int = 3600
    ) -> Any:
        """Get from cache or call factory() to populate. Factory must be async."""
        cached = await cls.get(namespace, key)
        if cached is not None:
            return cached
        value = await factory()
        if value is not None:
            await cls.set(namespace, key, value, ttl)
        return value
