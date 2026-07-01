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
        .where(Subject.id == subject.id)
        .options(selectinload(Subject.topics))
    )
    result = await db.execute(
        select(Subject).where(Subject.id == subject.id).options(selectinload(Subject.topics))
    )
    return result.scalar_one()


@router.put("/{subject_id}", response_model=SubjectResponse)
async def update_subject(
    subject_id: str,
    payload: SubjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Subject)
        .where(Subject.id == subject_id, can_access(current_user))
        .options(selectinload(Subject.topics))
    )
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    for k, v in payload.model_dump().items():
        setattr(subject, k, v)
    await db.commit()
    result = await db.execute(
        select(Subject).where(Subject.id == subject_id).options(selectinload(Subject.topics))
    )
    return result.scalar_one()


@router.delete("/{subject_id}", status_code=204)
async def delete_subject(
    subject_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Subject).where(Subject.id == subject_id, can_access(current_user))
    )
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    await db.delete(subject)
    await db.commit()


# ─── Topics ────────────────────────────────────────────────

@router.post("/{subject_id}/topics", response_model=TopicResponse, status_code=201)
async def create_topic(
    subject_id: str,
    payload: TopicCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Subject).where(Subject.id == subject_id, can_access(current_user))
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Subject not found")
    if payload.parent_id:
        parent = await db.execute(
            select(Topic).where(Topic.id == payload.parent_id, Topic.subject_id == subject_id)
        )
        parent = parent.scalar_one_or_none()
        if not parent or parent.parent_id:
            raise HTTPException(status_code=400, detail="Sub-topics can only be added under a top-level topic")
    topic = Topic(**payload.model_dump(), subject_id=subject_id)
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return topic


@router.put("/{subject_id}/topics/{topic_id}", response_model=TopicResponse)
async def update_topic(
    subject_id: str,
    topic_id: str,
    payload: TopicCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
