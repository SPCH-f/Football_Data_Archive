"""
APScheduler Job Definitions — background data sync on schedule.
"""
from __future__ import annotations

from datetime import datetime, timezone

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from core.config import settings
from services.ingestion_service import ingestion_service
from services.cache_service import CacheService

logger = structlog.get_logger(__name__)

scheduler = AsyncIOScheduler()


async def sync_fixtures_job():
    """Sync fixtures and generate RAG documents — runs every 6 hours."""
    logger.info("scheduler_job_start", job="sync_fixtures")
    try:
        stats = await ingestion_service.run_full_ingestion()
        await CacheService.set(
            "admin", "last_fixtures_sync",
            {"timestamp": datetime.now(timezone.utc).isoformat(), "stats": stats},
            ttl=86400 * 7,
        )
        logger.info("scheduler_job_complete", job="sync_fixtures", stats=stats)
    except Exception as e:
        logger.error("scheduler_job_error", job="sync_fixtures", error=str(e))


async def sync_standings_job():
    """Sync standings only — runs every 24 hours."""
    logger.info("scheduler_job_start", job="sync_standings")
    try:
        # Re-run full ingestion (standings are part of it)
        stats = await ingestion_service.run_full_ingestion()
        await CacheService.set(
            "admin", "last_standings_sync",
            {"timestamp": datetime.now(timezone.utc).isoformat(), "stats": stats},
            ttl=86400 * 7,
        )
        logger.info("scheduler_job_complete", job="sync_standings", stats=stats)
    except Exception as e:
        logger.error("scheduler_job_error", job="sync_standings", error=str(e))


def setup_scheduler():
    """Configure and start the APScheduler with all jobs."""
    scheduler.add_job(
        sync_fixtures_job,
        trigger=IntervalTrigger(hours=settings.sync_fixtures_interval_hours),
        id="sync_fixtures",
        name="Sync fixtures & generate documents",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.add_job(
        sync_standings_job,
        trigger=IntervalTrigger(hours=settings.sync_standings_interval_hours),
        id="sync_standings",
        name="Sync league standings",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.start()
    logger.info(
        "scheduler_started",
        fixtures_interval=f"{settings.sync_fixtures_interval_hours}h",
        standings_interval=f"{settings.sync_standings_interval_hours}h",
    )


def shutdown_scheduler():
    """Gracefully shutdown the scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("scheduler_stopped")
