"""
Chat API Routes — SSE streaming chat + session management.
"""
from __future__ import annotations

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.dependencies import get_db_session
from models.chat import ChatSession, ChatMessage
from schemas import ChatRequest, ChatSessionCreate, ChatSessionResponse, ChatMessageResponse
from services.rag_service import rag_service

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """SSE streaming chat response with RAG pipeline."""
    logger.info("chat_stream_request",
                session_id=str(request.session_id),
                message_preview=request.message[:80])

    async def event_generator():
        async for token in rag_service.generate_stream(
            query=request.message,
            session_id=request.session_id,
            db=db,
        ):
            # SSE format
            yield f"data: {token}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/sessions", response_model=ChatSessionResponse)
async def create_session(
    request: ChatSessionCreate,
    db: AsyncSession = Depends(get_db_session),
):
    """Create a new chat session."""
    session = ChatSession(
        title=request.title,
        metadata_=request.metadata,
    )
    db.add(session)
    await db.flush()
    await db.commit()
    await db.refresh(session)

    return ChatSessionResponse(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        messages=[],
    )


@router.get("/sessions/{session_id}", response_model=ChatSessionResponse)
async def get_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
):
    """Get chat history for a session."""
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.id == session_id)
        .options(selectinload(ChatSession.messages))
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found",
        )

    return ChatSessionResponse(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        messages=[
            ChatMessageResponse(
                id=m.id,
                role=m.role,
                content=m.content,
                retrieved_docs=m.retrieved_docs,
                created_at=m.created_at,
            )
            for m in session.messages
        ],
    )


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
):
    """Delete a chat session and all its messages."""
    session = await db.get(ChatSession, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found",
        )

    await db.delete(session)
    await db.commit()
    return {"status": "deleted", "session_id": str(session_id)}


@router.get("/sessions")
async def list_sessions(
    db: AsyncSession = Depends(get_db_session),
    limit: int = 20,
    offset: int = 0,
):
    """List recent chat sessions."""
    result = await db.execute(
        select(ChatSession)
        .order_by(ChatSession.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    sessions = result.scalars().all()

    # Get message counts
    sessions_data = []
    for s in sessions:
        count_result = await db.execute(
            select(func.count()).where(ChatMessage.session_id == s.id)
        )
        msg_count = count_result.scalar() or 0
        sessions_data.append({
            "id": str(s.id),
            "title": s.title,
            "created_at": s.created_at.isoformat(),
            "message_count": msg_count,
        })

    return {"sessions": sessions_data}
