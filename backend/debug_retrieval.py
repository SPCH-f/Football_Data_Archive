#!/usr/bin/env python3
"""Debug RAG retrieval issues"""
import asyncio
import sys

from core.config import settings
from services.embedding_service import EmbeddingService
from core.database import async_session_factory
from sqlalchemy import text

async def debug_retrieval():
    db = async_session_factory()
    embedder = EmbeddingService()
    
    try:
        # Check database
        result = await db.execute(text("SELECT COUNT(*) as count FROM football_documents"))
        doc_count = result.scalar()
        print(f"📊 Documents in DB: {doc_count}")
        
        # Check embedding dimensions
        result = await db.execute(text("""
            SELECT id, vector_dims(embedding) as dim, content 
            FROM football_documents LIMIT 3
        """))
        rows = result.fetchall()
        print(f"\n📐 Sample embeddings:")
        for row in rows:
            print(f"  - ID: {row[0]}, Dim: {row[1]}, Content: {row[2][:50]}...")
        
        # Test query embedding
        query = "ทีมไหนเป็นที่หนึ่องของลาลีกา"
        query_embedding = await embedder.embed_query(query)
        print(f"\n🔍 Query embedding dimension: {len(query_embedding)}")
        print(f"   First 5 values: {query_embedding[:5]}")
        
        # Try retrieval
        embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"
        result = await db.execute(text("""
            SELECT id, content,
                   1 - (embedding <=> (:embedding)::vector) AS similarity
            FROM football_documents
            ORDER BY embedding <=> (:embedding)::vector
            LIMIT 5
        """), {"embedding": embedding_str})
        
        rows = result.fetchall()
        print(f"\n🎯 Top 5 results:")
        for i, row in enumerate(rows, 1):
            print(f"  {i}. Similarity: {row[2]:.3f}, Content: {row[1][:40]}...")
        
        return 0
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        await db.close()

if __name__ == "__main__":
    exit_code = asyncio.run(debug_retrieval())
    sys.exit(exit_code)
