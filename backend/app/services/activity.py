"""Streaks are derived from real activity: a day counts if the user finished
a test attempt or ticked a goal on that (local) day."""
from datetime import datetime, timedelta, date
from typing import Set, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.models.attempt import Attempt, AttemptStatus
from app.models.planner import GoalCheck

_OFFSET = timedelta(minutes=settings.TZ_OFFSET_MINUTES)


def local_today() -> date:
    return (datetime.utcnow() + _OFFSET).date()


async def activity_days(db: AsyncSession, user_id: str) -> Set[date]:
    attempts = await db.execute(
        select(Attempt.completed_at).where(
            Attempt.user_id == user_id, Attempt.status == AttemptStatus.COMPLETED
        )
    )
    checks = await db.execute(select(GoalCheck.done_at).where(GoalCheck.user_id == user_id))
    stamps = [r[0] for r in attempts.all()] + [r[0] for r in checks.all()]
    return {(s + _OFFSET).date() for s in stamps if s}


def streaks(days: Set[date]) -> Tuple[int, int]:
    """Return (current, longest). The current streak survives until the end of today."""
    longest = run = 0
    prev = None
    for d in sorted(days):
        run = run + 1 if prev and d == prev + timedelta(days=1) else 1
        longest = max(longest, run)
        prev = d
    today = local_today()
    cursor = today if today in days else today - timedelta(days=1)
    current = 0
    while cursor in days:
        current += 1
        cursor -= timedelta(days=1)
    return current, longest
