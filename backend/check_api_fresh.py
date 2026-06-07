#!/usr/bin/env python3
"""Check what API actually returns"""
import asyncio
import sys

from services.football_data_client import football_data_client
from core.config import settings

async def check_api_data():
    print("=" * 70)
    print("🔍 Checking Football Data API directly")
    print("=" * 70)
    
    try:
        # Check PL matches
        print(f"\n📡 Fetching Premier League (PL) data...")
        pl_matches = await football_data_client.get_matches("PL")
        
        if pl_matches:
            print(f"✅ Found {len(pl_matches)} matches")
            # Show latest
            latest = max(pl_matches, key=lambda x: x.get('utcDate', ''))
            print(f"   Latest: {latest.get('utcDate')} - {latest.get('homeTeam', {}).get('name')} vs {latest.get('awayTeam', {}).get('name')}")
        else:
            print("❌ No matches returned")
        
        # Check standings
        print(f"\n📊 Fetching Premier League standings...")
        pl_standings = await football_data_client.get_standings("PL")
        
        if pl_standings:
            print(f"✅ Found standings")
            for i, team in enumerate(pl_standings[:3], 1):
                print(f"   {i}. {team.get('team', {}).get('name')} - Pts: {team.get('points')}")
        else:
            print("❌ No standings returned")
        
        print("\n" + "=" * 70)
        print("💡 If data is not recent, it means:")
        print("   1. API itself has old data (off-season?)")
        print("   2. Most leagues ended their season")
        print("   3. Waiting for new season to start")
        print("=" * 70)
        
        return 0
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(check_api_data())
    sys.exit(exit_code)
