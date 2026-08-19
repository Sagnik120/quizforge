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
        checks = await db.execute(
            select(GoalCheck.goal_id, GoalCheck.user_id).where(GoalCheck.goal_id.in_([g.id for g in goals]))
        )
        for goal_id, user_id in checks.all():
            done.setdefault(goal_id, []).append(user_id)
    return [
        {"id": g.id, "parent_id": g.parent_id, "title": g.title, "space": g.space,
         "owner_id": g.owner_id, "done_by": done.get(g.id, [])}
        for g in goals
    ]


@router.post("/goals", response_model=dict, status_code=201)
async def create_goal(payload: GoalIn, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    space = payload.space
    if payload.parent_id:
        parent = await _get_goal(payload.parent_id, db, current_user)
        space = parent.space
        depth, cursor = 1, parent
        while cursor.parent_id:
            cursor = await _get_goal(cursor.parent_id, db, current_user)
            depth += 1
        if depth >= MAX_GOAL_DEPTH:
            raise HTTPException(status_code=400, detail="Goals can be nested 3 levels deep at most")
        # A parent's state comes from its children, so its own ticks no longer apply
        await db.execute(delete(GoalCheck).where(GoalCheck.goal_id == parent.id))
    goal = Goal(title=title, parent_id=payload.parent_id, space=space, owner_id=current_user.id)
    db.add(goal)
    await db.commit()
    return {"id": goal.id, "parent_id": goal.parent_id, "title": goal.title, "space": goal.space,
            "owner_id": goal.owner_id, "done_by": []}


@router.put("/goals/{goal_id}", response_model=dict)
async def rename_goal(goal_id: str, payload: GoalTitle, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    goal = await _get_goal(goal_id, db, current_user)
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")
    goal.title = payload.title.strip()
    await db.commit()
    return {"id": goal.id, "title": goal.title}


@router.post("/goals/{goal_id}/toggle", response_model=dict)
async def toggle_goal(goal_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Tick/untick a goal for yourself. Ticking a parent ticks everything under it."""
    await _get_goal(goal_id, db, current_user)
    _, leaves = _subtree(await _visible_goals(db, current_user), goal_id)
    mine = await db.execute(
        select(GoalCheck.goal_id).where(GoalCheck.user_id == current_user.id, GoalCheck.goal_id.in_(leaves))
    )
    ticked = {r[0] for r in mine.all()}
    if len(ticked) == len(leaves):
        await db.execute(
            delete(GoalCheck).where(GoalCheck.user_id == current_user.id, GoalCheck.goal_id.in_(leaves))
        )
        done = False
    else:
        for leaf in leaves:
            if leaf not in ticked:
                db.add(GoalCheck(goal_id=leaf, user_id=current_user.id))
        done = True
    await db.commit()
    return {"done": done}


@router.delete("/goals/{goal_id}", status_code=204)
