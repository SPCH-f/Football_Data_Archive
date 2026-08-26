"""Debug: what context does the RAG pull for a La Liga standings query?"""
import asyncio
from services.rag_service import RAGService
from core.database import async_session_factory

async def main():
    db = async_session_factory()
    svc = RAGService()
    # Test with both Thai and English
    for q in ["ลีกลาลีก้าทีมอะไรอยู่ลำดับที่ 4", "La Liga standings rank 4"]:
        print(f"\n{'='*60}")
        print(f"Query: {q}")
        print('='*60)
        docs = await svc.retrieve_documents(q, db)
        if not docs:
            print("  -> NO DOCUMENTS RETRIEVED")
        for d in docs:
            sim = d['similarity']
            content = d['content'][:300]
            print(f"  [{sim:.3f}] {content}")
            print()
    await db.close()

if __name__ == "__main__":
    asyncio.run(main())
