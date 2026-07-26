from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from typing import List
from datetime import datetime
from app.db.base import get_db
from app.api.deps import get_current_user, can_access
from app.models.subject import Subject, Topic
from app.services.activity import activity_days, streaks
from app.models.user import User
from app.models.test import Test, Question
from app.models.attempt import Attempt, AttemptAnswer, AttemptStatus, RevisionQueue
from app.schemas.attempt import (
    AttemptStart, AttemptSubmit, AttemptResult,
    AttemptSummary, AnswerResult, RevisionItem
)

router = APIRouter(prefix="/attempts", tags=["Test Attempts"])


@router.post("/start", response_model=dict, status_code=201)
async def start_attempt(
    payload: AttemptStart,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a new attempt for a test. Returns the attempt_id to use when submitting."""
    result = await db.execute(
        select(Test).join(Topic).join(Subject).where(Test.id == payload.test_id, can_access(current_user))
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Test not found")

    attempt = Attempt(
        test_id=payload.test_id,
        user_id=current_user.id,
        status=AttemptStatus.IN_PROGRESS,
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)
    return {"attempt_id": attempt.id, "started_at": attempt.started_at}


@router.post("/{attempt_id}/submit", response_model=AttemptResult)
async def submit_attempt(
    attempt_id: str,
    payload: AttemptSubmit,
    db: AsyncSession = Depends(get_db),
