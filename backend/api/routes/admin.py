"""
Admin API Routes — manual sync trigger, sync status, protected by API key.
"""
from __future__ import annotations

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import get_db_session, verify_admin_key
from models.document import FootballDocument
from models.match import Match
from models.team import Team
from schemas import SyncStatusResponse, SyncTriggerResponse
from services.cache_service import CacheService
from services.ingestion_service import ingestion_service

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.post("/sync", response_model=SyncTriggerResponse)
async def trigger_sync(
    _admin_key: str = Depends(verify_admin_key),
):
    """Manually trigger a full data sync. Protected by admin API key."""
    logger.info("admin_manual_sync_triggered")

    try:
        stats = await ingestion_service.run_full_ingestion()
        return SyncTriggerResponse(
            status="success",
            message=f"Sync complete. {stats['documents_upserted']} documents upserted, "
                    f"{stats['competitions_synced']} competitions synced. "
                    f"Errors: {len(stats['errors'])}",
        )
    except Exception as e:
        logger.error("admin_sync_error", error=str(e))
        return SyncTriggerResponse(
            status="error",
            message=f"Sync failed: {str(e)}",
        )


@router.get("/sync/status", response_model=SyncStatusResponse)
async def get_sync_status(
    db: AsyncSession = Depends(get_db_session),
    _admin_key: str = Depends(verify_admin_key),
):
    """Get last sync timestamps and document counts."""
    # Get last sync timestamps from Redis
    fixtures_sync = await CacheService.get("admin", "last_fixtures_sync")
    standings_sync = await CacheService.get("admin", "last_standings_sync")

    # Get counts from DB
    doc_count = (await db.execute(select(func.count(FootballDocument.id)))).scalar() or 0
    match_count = (await db.execute(select(func.count(Match.id)))).scalar() or 0
    team_count = (await db.execute(select(func.count(Team.id)))).scalar() or 0

    return SyncStatusResponse(
        last_fixtures_sync=fixtures_sync.get("timestamp") if fixtures_sync else None,
        last_standings_sync=standings_sync.get("timestamp") if standings_sync else None,
        total_documents=doc_count,
        total_matches=match_count,
        total_teams=team_count,
    )
