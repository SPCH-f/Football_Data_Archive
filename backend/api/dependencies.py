"""
API Dependencies — DB session injection, admin auth, etc.
"""
from __future__ import annotations

from fastapi import Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db


async def get_db_session() -> AsyncSession:
    """Alias for database dependency."""
    async for session in get_db():
        yield session


async def verify_admin_key(
    x_admin_key: str = Header(..., alias="X-Admin-Key")
) -> str:
    """Verify admin API key from header."""
    if x_admin_key != settings.admin_api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid admin API key",
        )
    return x_admin_key
