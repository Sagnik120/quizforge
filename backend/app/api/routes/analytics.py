from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import List
from datetime import datetime, timedelta
from app.db.base import get_db
from app.api.deps import get_current_user, can_access
from sqlalchemy.orm import selectinload
from app.models.user import User
from app.models.test import Test, Question
from app.models.attempt import Attempt, AttemptAnswer, AttemptStatus, RevisionQueue
from app.models.subject import Subject, Topic
from app.schemas.attempt import AnalyticsSummary, RevisionItem

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/summary", response_model=AnalyticsSummary)
async def get_analytics_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get comprehensive analytics for the current user."""
    # Total attempts
    total_result = await db.execute(
        select(func.count(Attempt.id)).where(
            Attempt.user_id == current_user.id,
            Attempt.status == AttemptStatus.COMPLETED
        )
    )
    total_attempts = total_result.scalar() or 0

    # Unique tests attempted
    unique_tests = await db.execute(
        select(func.count(func.distinct(Attempt.test_id))).where(
            Attempt.user_id == current_user.id,
            Attempt.status == AttemptStatus.COMPLETED
        )
    )
    total_tests_attempted = unique_tests.scalar() or 0
