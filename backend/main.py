"""
Football RAG Chatbot — FastAPI Application Entry Point
"""
from __future__ import annotations

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.database import init_db, dispose_db
from core.redis_client import get_redis, close_redis

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle events."""
    # ── Startup ──
    logger.info("🚀 Starting Football RAG Chatbot backend...")

    # Initialize database tables (dev mode — Alembic handles prod)
    await init_db()
    logger.info("✅ Database initialized")

    # Warm up Redis connection
    redis = await get_redis()
    await redis.ping()
    logger.info("✅ Redis connected")

    # Start APScheduler jobs
    from scheduler.jobs import setup_scheduler, shutdown_scheduler
    setup_scheduler()
    logger.info("✅ Scheduler started")

    logger.info("✅ Backend ready — all systems go!")

    yield

    # ── Shutdown ──
    logger.info("🛑 Shutting down...")
    shutdown_scheduler()
    await dispose_db()
    await close_redis()
    logger.info("👋 Goodbye!")


# ── App instance ──
app = FastAPI(
    title="Football RAG Chatbot API",
    description="RAG-powered football analyst with real-time data, match predictions, and intelligent discussions.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health check ──
@app.get("/health", tags=["system"])
async def health_check():
    return {"status": "healthy", "service": "football-rag-backend"}


# ── Route registration ──
from api.routes import chat, matches, admin  # noqa: E402

app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(matches.router, prefix="/api/matches", tags=["matches"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
