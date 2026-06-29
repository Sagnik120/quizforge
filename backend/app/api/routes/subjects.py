from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from app.db.base import get_db
from app.api.deps import get_current_user, can_access
from app.models.user import User
from app.models.subject import Subject, Topic
from app.schemas.subject import SubjectCreate, SubjectResponse, TopicCreate, TopicResponse

router = APIRouter(prefix="/subjects", tags=["Subjects & Topics"])


@router.get("/", response_model=List[SubjectResponse])
async def list_subjects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Subject)
        .where(can_access(current_user))
        .options(selectinload(Subject.topics))
    )
    return result.scalars().all()


@router.post("/", response_model=SubjectResponse, status_code=201)
async def create_subject(
    payload: SubjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    subject = Subject(**payload.model_dump(), owner_id=current_user.id)
    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    # Eagerly load topics (empty list for new subject)
    await db.execute(
        select(Subject)
