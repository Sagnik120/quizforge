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

    # Average and best percentage
    perf = await db.execute(
        select(func.avg(Attempt.percentage), func.max(Attempt.percentage)).where(
            Attempt.user_id == current_user.id,
            Attempt.status == AttemptStatus.COMPLETED
        )
    )
    avg_pct, best_pct = perf.first() or (0, 0)

    # Total time
    time_result = await db.execute(
        select(func.sum(Attempt.time_taken_seconds)).where(
            Attempt.user_id == current_user.id,
            Attempt.status == AttemptStatus.COMPLETED
        )
    )
    total_seconds = time_result.scalar() or 0
    total_hours = round(total_seconds / 3600, 1)

    # Performance last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent = await db.execute(
        select(Attempt.completed_at, Attempt.percentage).where(
            Attempt.user_id == current_user.id,
            Attempt.status == AttemptStatus.COMPLETED,
            Attempt.completed_at >= thirty_days_ago,
        ).order_by(Attempt.completed_at)
    )
    recent_performance = [
        {"date": r[0].strftime("%Y-%m-%d"), "percentage": round(r[1], 1)}
        for r in recent.all() if r[0] and r[1] is not None
    ]

    # Weak topics (topics where avg score < 60%)
    weak_topics_result = await db.execute(
        select(Topic.name, func.avg(Attempt.percentage).label("avg_pct"))
        .join(Test, Test.topic_id == Topic.id)
        .join(Attempt, Attempt.test_id == Test.id)
        .where(
            Attempt.user_id == current_user.id,
            Attempt.status == AttemptStatus.COMPLETED,
        )
        .group_by(Topic.id, Topic.name)
        .having(func.avg(Attempt.percentage) < 60)
