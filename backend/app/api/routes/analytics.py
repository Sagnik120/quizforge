from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import List
from datetime import datetime, timedelta
from app.db.base import get_db
from app.api.deps import get_current_user
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
        .order_by(func.avg(Attempt.percentage))
        .limit(5)
    )
    weak_topics = [
        {"topic_name": r[0], "avg_score": round(r[1], 1)}
        for r in weak_topics_result.all()
    ]

    return AnalyticsSummary(
        total_attempts=total_attempts,
        total_tests_attempted=total_tests_attempted,
        average_percentage=round(avg_pct or 0, 1),
        best_percentage=round(best_pct or 0, 1),
        total_time_spent_hours=total_hours,
        current_streak=current_user.current_streak,
        longest_streak=current_user.longest_streak,
        weak_topics=weak_topics,
        recent_performance=recent_performance,
        accuracy_by_question_type={"MCQ": 0, "MSQ": 0},  # computed separately
    )


@router.get("/revision-queue", response_model=List[RevisionItem])
async def get_revision_queue(
    resolved: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get questions in revision queue (wrongly answered questions)."""
    result = await db.execute(
        select(RevisionQueue).where(
            RevisionQueue.user_id == current_user.id,
            RevisionQueue.is_resolved == resolved,
        ).order_by(RevisionQueue.wrong_count.desc(), RevisionQueue.last_wrong_at.desc())
    )
    items = result.scalars().all()
    revision_items = []
    for item in items:
        q_r = await db.execute(select(Question).where(Question.id == item.question_id))
        q = q_r.scalar_one_or_none()
        if not q:
            continue
        t_r = await db.execute(select(Test).where(Test.id == q.test_id))
        test = t_r.scalar_one()
        topic_r = await db.execute(select(Topic).where(Topic.id == test.topic_id))
        topic = topic_r.scalar_one()
        sub_r = await db.execute(select(Subject).where(Subject.id == topic.subject_id))
        subject = sub_r.scalar_one()
        revision_items.append(RevisionItem(
            id=item.id,
            question_id=q.id,
            question_text=q.text,
            question_type=q.question_type,
            test_name=test.name,
            topic_name=topic.name,
            subject_name=subject.name,
            wrong_count=item.wrong_count,
            last_wrong_at=item.last_wrong_at,
            is_resolved=item.is_resolved,
        ))
    return revision_items


@router.patch("/revision-queue/{item_id}/resolve", response_model=dict)
async def resolve_revision_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a revision queue item as resolved (understood)."""
    result = await db.execute(
        select(RevisionQueue).where(
            RevisionQueue.id == item_id,
            RevisionQueue.user_id == current_user.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Item not found")
    item.is_resolved = True
    await db.commit()
    return {"message": "Marked as resolved"}
