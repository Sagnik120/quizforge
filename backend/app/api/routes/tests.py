from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
import json
from app.db.base import get_db
from app.api.deps import get_current_user, can_access
from app.models.user import User
from app.models.test import Test, Question
from app.models.subject import Subject, Topic
from app.models.attempt import Attempt, AttemptStatus
from app.schemas.test import (
    TestCreate, TestResponse, TestSummary, TestImportJSON,
    QuestionCreate, QuestionResponse, QuestionPublic
)

router = APIRouter(prefix="/tests", tags=["Tests"])

# Best score below this (percent) flags a test as "attempt again"
RETRY_BELOW = 60


def _pct(values):
    return round(max(values), 1) if values else None


@router.get("/", response_model=List[dict])
async def list_tests(
    topic_id: Optional[str] = None,
    subject_id: Optional[str] = None,
    space: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List tests you can see (your private ones + the common space) with attempt stats."""
    query = (
        select(Test)
        .join(Topic)
        .join(Subject)
        .where(can_access(current_user))
        .options(
            selectinload(Test.questions),
            selectinload(Test.topic).selectinload(Topic.subject),
            selectinload(Test.creator),
        )
        .order_by(Test.created_at.desc())
    )
    if topic_id:
        query = query.where(Test.topic_id == topic_id)
