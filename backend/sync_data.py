#!/usr/bin/env python3
"""
Manual Data Ingestion Script — Sync standings/teams/matches into RAG documents
"""
import asyncio
import sys

from core.config import settings
from services.ingestion_service import ingestion_service
from core.database import async_session_factory

async def main():
    """Run full data ingestion"""
    print("=" * 70)
    print("🔄 Football RAG Data Ingestion — Manual Sync")
    print("=" * 70)
    
    db = async_session_factory()
    
    try:
        print(f"\n📡 Starting ingestion for competitions: {settings.tracked_competitions}")
        print(f"📊 This will create embeddings for standings, matches, and teams...\n")
        
        # Run full ingestion
        stats = await ingestion_service.run_full_ingestion()
        
        print("\n" + "=" * 70)
        print("✅ INGESTION COMPLETE!")
        print("=" * 70)
        
        # Print stats
        print(f"\n📊 Results:")
        print(f"  ├─ Competitions synced: {stats.get('competitions_processed', 0)}")
        print(f"  ├─ Teams: {stats.get('teams', 0)}")
        print(f"  ├─ Matches: {stats.get('matches', 0)}")
        print(f"  ├─ Standings: {stats.get('standings', 0)}")
        print(f"  └─ Documents (with embeddings): {stats.get('documents', 0)}")
        
        if stats.get('errors'):
            print(f"\n⚠️  Errors encountered:")
            for error in stats.get('errors', []):
                print(f"  - {error}")
        
        print("\n🎯 Next step: Try asking the chatbot about standings, matches, or teams!")
        print("   Example: 'ทีมไหนเป็นที่หนึ่งของลาลีกา?'")
        
        return 0
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        await db.close()

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
