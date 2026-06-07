#!/usr/bin/env python3
"""
Test Groq integration with Football RAG
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from core.config import settings
from services.rag_service import rag_service
from core.database import async_session_factory

async def test_groq():
    """Test Groq connection and generate a response"""
    
    print("=" * 60)
    print("🧪 Groq Integration Test")
    print("=" * 60)
    
    # Check configuration
    print(f"\n📋 Configuration:")
    print(f"  LLM Provider: {settings.llm_provider}")
    print(f"  Groq Model: {settings.groq_model}")
    print(f"  API Key: {'✅ Set' if settings.groq_api_key else '❌ Missing'}")
    
    if settings.llm_provider != "groq":
        print(f"\n❌ ERROR: LLM_PROVIDER is '{settings.llm_provider}', not 'groq'")
        print("   Fix: Set LLM_PROVIDER=groq in .env file")
        return False
    
    if not settings.groq_api_key:
        print(f"\n❌ ERROR: GROQ_API_KEY is not set")
        print("   Fix: Set GROQ_API_KEY in .env file")
        return False
    
    # Test connection
    print(f"\n🔌 Testing Groq connection...")
    
    try:
        db = async_session_factory()
        
        # Simple test message
        test_query = "สวัสดี คุณตอบเรื่องอะไรได้บ้าง?"
        
        print(f"\n📤 Sending test message: {test_query}")
        print(f"\n📥 Response from Groq:")
        print("-" * 60)
        
        full_response = ""
        async for token in rag_service.generate_stream(
            query=test_query,
            db=db,
        ):
            # Filter out metadata like [SESSION_ID:...]
            if not token.startswith("[SESSION_ID"):
                print(token, end="", flush=True)
                full_response += token
        
        await db.close()
        
        print("\n" + "-" * 60)
        
        if full_response.strip():
            print(f"\n✅ SUCCESS! Groq is working properly")
            print(f"   Response length: {len(full_response)} characters")
            return True
        else:
            print(f"\n❌ ERROR: Received empty response")
            return False
            
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    success = await test_groq()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())
