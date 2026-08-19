"""Goals (hierarchical checklists), calendar (streaks + reminders) and the two-person overview."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, delete
from typing import List, Literal, Optional
from datetime import date, timedelta
from app.db.base import get_db
from app.api.deps import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.attempt import Attempt, AttemptStatus
from app.models.planner import Goal, GoalCheck, Reminder
from app.services.activity import activity_days, streaks, local_today

router = APIRouter(tags=["Planner"])

Space = Literal["private", "common"]
MAX_GOAL_DEPTH = 3  # subject > topic > sub-topic


def _visible(model, user: User):
    return or_(model.space == "common", model.owner_id == user.id)


async def _people(db: AsyncSession) -> List[User]:
    result = await db.execute(
        select(User).where(func.lower(User.username).in_([n.lower() for n in settings.USERS])).order_by(User.username)
    )
    return result.scalars().all()


# ─── Goals ─────────────────────────────────────────────────

class GoalIn(BaseModel):
    title: str
    parent_id: Optional[str] = None
    space: Space = "private"


class GoalTitle(BaseModel):
    title: str


async def _visible_goals(db: AsyncSession, user: User) -> List[Goal]:
    result = await db.execute(select(Goal).where(_visible(Goal, user)).order_by(Goal.created_at))
    return result.scalars().all()


def _subtree(goals: List[Goal], root_id: str):
    """Return (all ids under root incl. root, leaf ids under root)."""
    children = {}
    for g in goals:
        children.setdefault(g.parent_id, []).append(g.id)
    ids, leaves, stack = [], [], [root_id]
    while stack:
        gid = stack.pop()
        ids.append(gid)
        kids = children.get(gid, [])
        if kids:
            stack.extend(kids)
        else:
            leaves.append(gid)
    return ids, leaves


async def _get_goal(goal_id: str, db: AsyncSession, user: User) -> Goal:
    result = await db.execute(select(Goal).where(Goal.id == goal_id, _visible(Goal, user)))
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


@router.get("/goals", response_model=List[dict])
async def list_goals(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Flat list of goals you can see; `done_by` holds the ids of users who ticked each one."""
    goals = await _visible_goals(db, current_user)
    done = {}
    if goals:
