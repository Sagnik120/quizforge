from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from app.db.base import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.attempt import Attempt, AttemptStatus

router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])


@router.get("/", response_model=List[dict])
async def get_leaderboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Personal leaderboard — your performance timeline ranked by best scores."""
    result = await db.execute(
        select(
            Attempt.test_id,
            func.max(Attempt.percentage).label("best_pct"),
            func.count(Attempt.id).label("attempt_count"),
            func.avg(Attempt.percentage).label("avg_pct"),
        )
        .where(
            Attempt.user_id == current_user.id,
            Attempt.status == AttemptStatus.COMPLETED
        )
        .group_by(Attempt.test_id)
        .order_by(func.max(Attempt.percentage).desc())
    )
    rows = result.all()
    leaderboard = []
    for row in rows:
        from app.models.test import Test
        from app.models.subject import Topic, Subject
        t_r = await db.execute(select(Test).where(Test.id == row.test_id))
        test = t_r.scalar_one_or_none()
        if not test:
            continue
        topic_r = await db.execute(select(Topic).where(Topic.id == test.topic_id))
        topic = topic_r.scalar_one()
        sub_r = await db.execute(select(Subject).where(Subject.id == topic.subject_id))
        subject = sub_r.scalar_one()
        leaderboard.append({
            "test_id": test.id,
            "test_name": test.name,
            "topic_name": topic.name,
            "subject_name": subject.name,
            "best_percentage": round(row.best_pct, 1),
            "average_percentage": round(row.avg_pct, 1),
            "attempt_count": row.attempt_count,
        })
    return leaderboard


@router.get("/profile-stats", response_model=dict)
async def profile_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stats for the profile page."""
    total = await db.execute(
        select(func.count(Attempt.id)).where(
            Attempt.user_id == current_user.id,
            Attempt.status == AttemptStatus.COMPLETED
        )
    )
    return {
        "username": current_user.username,
        "full_name": current_user.full_name,
        "institution": current_user.institution,
        "total_attempts": total.scalar() or 0,
        "current_streak": current_user.current_streak,
        "longest_streak": current_user.longest_streak,
        "member_since": current_user.created_at,
    }
