#!/usr/bin/env python3
"""Reset embedding table schema"""
import asyncio
import sys

from sqlalchemy import text
from core.database import engine, Base
from models.document import FootballDocument

async def reset_table():
    try:
        async with engine.begin() as conn:
            # Drop old table
            await conn.execute(text('DROP TABLE IF EXISTS football_documents CASCADE'))
            print('✅ Dropped old football_documents table (1536 dimensions)')
            
            # Recreate with new dimension (384)
            await conn.run_sync(Base.metadata.create_all)
            print('✅ Created new football_documents table (384 dimensions)')
            
        return 0
    except Exception as e:
        print(f'❌ Error: {e}')
        import traceback
        traceback.print_exc()
        return 1
    finally:
        await engine.dispose()

if __name__ == "__main__":
    exit_code = asyncio.run(reset_table())
    sys.exit(exit_code)
