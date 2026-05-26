#!/usr/bin/env python3
"""
Football RAG Chatbot — Database Initialization Script

Usage:
    python scripts/init_db.py

This script:
  1. Enables pgvector and uuid-ossp extensions
  2. Creates all ORM tables via SQLAlchemy metadata
  3. Seeds initial competition data
  4. Verifies table creation

For production, use Alembic migrations instead.
"""
from __future__ import annotations

import asyncio
import sys
import os

# Add backend to path so we can import our modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# We import these to register models with Base.metadata
from core.config import settings
from core.database import Base


async def main():
    """Initialize the database with extensions, tables, and seed data."""
    db_url = settings.async_database_url
    print(f"🔌 Connecting to: {db_url.split('@')[-1]}")  # hide credentials

    engine = create_async_engine(db_url, echo=False)

    async with engine.begin() as conn:
        # ── Step 1: Enable extensions ──
        print("📦 Enabling PostgreSQL extensions...")
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
        print("   ✅ pgvector enabled")
        print("   ✅ uuid-ossp enabled")

        # ── Step 2: Import all models to register them ──
        print("\n📋 Importing ORM models...")
        try:
            from models import team, match, document, chat  # noqa: F401
            from models import competition, player, standing  # noqa: F401
            print("   ✅ All models imported")
        except ImportError as e:
            print(f"   ⚠️  Some models not yet created (expected in Phase 2): {e}")

        # ── Step 3: Create tables ──
        print("\n🏗️  Creating tables...")
        await conn.run_sync(Base.metadata.create_all)
        print("   ✅ All tables created")

        # ── Step 4: Verify ──
        print("\n🔍 Verifying tables...")
        result = await conn.execute(
            text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' ORDER BY table_name"
            )
        )
        tables = [row[0] for row in result.fetchall()]
        if tables:
            for t in tables:
                print(f"   ✅ {t}")
        else:
            print("   ⚠️  No tables found — models not yet defined (Phase 2)")

        # ── Step 5: Verify pgvector ──
        print("\n🔍 Verifying pgvector extension...")
        result = await conn.execute(
            text("SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'")
        )
        row = result.fetchone()
        if row:
            print(f"   ✅ pgvector v{row[1]} installed")
        else:
            print("   ❌ pgvector NOT installed — check Docker image")

    await engine.dispose()

    print("\n" + "=" * 50)
    print("✅ Database initialization complete!")
    print("=" * 50)

    # ── Seed data ──
    print("\n🌱 Seeding initial competitions...")
    engine2 = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(engine2, class_=AsyncSession, expire_on_commit=False)

    competitions_data = [
        {"code": "PL", "name": "Premier League", "country": "England"},
        {"code": "PD", "name": "La Liga", "country": "Spain"},
        {"code": "BL1", "name": "Bundesliga", "country": "Germany"},
        {"code": "SA", "name": "Serie A", "country": "Italy"},
        {"code": "FL1", "name": "Ligue 1", "country": "France"},
        {"code": "CL", "name": "UEFA Champions League", "country": "Europe"},
    ]

    async with session_factory() as session:
        try:
            # Check if competitions table exists
            result = await session.execute(
                text(
                    "SELECT EXISTS ("
                    "  SELECT FROM information_schema.tables "
                    "  WHERE table_name = 'competitions'"
                    ")"
                )
            )
            table_exists = result.scalar()

            if table_exists:
                for comp in competitions_data:
                    # Upsert — skip if already exists
                    existing = await session.execute(
                        text("SELECT id FROM competitions WHERE code = :code"),
                        {"code": comp["code"]},
                    )
                    if existing.fetchone() is None:
                        await session.execute(
                            text(
                                "INSERT INTO competitions (name, code, country) "
                                "VALUES (:name, :code, :country)"
                            ),
                            comp,
                        )
                        print(f"   ✅ {comp['name']} ({comp['code']})")
                    else:
                        print(f"   ⏭️  {comp['name']} already exists")
                await session.commit()
            else:
                print("   ⚠️  Competitions table not yet created (Phase 2)")
        except Exception as e:
            print(f"   ⚠️  Seeding skipped: {e}")
            await session.rollback()

    await engine2.dispose()
    print("\n🎉 Init complete! Ready for Phase 2.")


if __name__ == "__main__":
    asyncio.run(main())
