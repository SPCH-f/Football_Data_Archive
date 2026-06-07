#!/usr/bin/env python3
"""
Check latest data date and update if needed
"""
import asyncio
import sys
from datetime import datetime, timezone

from core.database import async_session_factory
from models.match import Match
from sqlalchemy import select, func

async def check_data_freshness():
    """Check the latest match date in database"""
    db = async_session_factory()
    
    try:
        # Get latest match date
        result = await db.execute(
            select(func.max(Match.match_date))
        )
        latest_date = result.scalar()
        
        print("=" * 70)
        print("📅 Data Freshness Check")
        print("=" * 70)
        
        if latest_date:
            print(f"\n📊 Latest match date in DB: {latest_date}")
            print(f"   Current date (UTC): {datetime.now(timezone.utc)}")
            
            # Calculate days difference
            diff = (datetime.now(timezone.utc).date() - latest_date.date()).days
            print(f"\n   Data is {diff} days old")
            
            if diff > 1:
                print(f"\n⚠️  Data is outdated! Recommend running sync.")
                print(f"\n   To update, run:")
                print(f"   $ python trigger_sync.py")
            else:
                print(f"\n✅ Data is fairly recent!")
        else:
            print("\n❌ No matches found in database!")
        
        # Get some recent matches
        print(f"\n📋 Recent matches:")
        result = await db.execute(
            select(Match)
            .order_by(Match.match_date.desc())
            .limit(5)
        )
        matches = result.scalars().all()
        
        for i, match in enumerate(matches, 1):
            print(f"  {i}. {match.match_date} - Match ID: {match.id}")
        
        return 0
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        await db.close()

if __name__ == "__main__":
    exit_code = asyncio.run(check_data_freshness())
    sys.exit(exit_code)
