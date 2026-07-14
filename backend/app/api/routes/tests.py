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
    if subject_id:
        query = query.where(Topic.subject_id == subject_id)
    if space:
        query = query.where(Subject.space == space)
    tests = (await db.execute(query)).scalars().all()

    # All completed attempts on these tests, oldest first, grouped per (test, user)
    stats = {}
    if tests:
        rows = await db.execute(
            select(Attempt.test_id, Attempt.user_id, Attempt.percentage)
            .where(
                Attempt.test_id.in_([t.id for t in tests]),
                Attempt.status == AttemptStatus.COMPLETED,
            )
            .order_by(Attempt.completed_at)
        )
        for test_id, user_id, pct in rows.all():
            stats.setdefault(test_id, {}).setdefault(user_id, []).append(pct or 0)

    summaries = []
    for test in tests:
        per_user = stats.get(test.id, {})
        mine = per_user.get(current_user.id, [])
        others = [p for uid, ps in per_user.items() if uid != current_user.id for p in ps]
        best = _pct(mine)
        summaries.append({
            "id": test.id,
            "name": test.name,
            "description": test.description,
            "topic_id": test.topic_id,
            "topic_name": test.topic.name,
            "subject_id": test.topic.subject_id,
            "subject_name": test.topic.subject.name,
            "space": test.topic.subject.space,
            "creator_id": test.creator_id,
            "creator_name": test.creator.full_name or test.creator.username,
            "total_questions": len(test.questions),
            "total_marks": sum(q.marks for q in test.questions),
            "time_limit_minutes": test.time_limit_minutes,
            "attempt_count": len(mine),
            "best_percentage": best,
            "last_percentage": round(mine[-1], 1) if mine else None,
            "needs_retry": best is not None and best < RETRY_BELOW,
            "partner_attempt_count": len(others),
            "partner_best_percentage": _pct(others),
            "created_at": test.created_at,
        })
    return summaries


async def _save_test(payload, db: AsyncSession, current_user: User):
    topic_result = await db.execute(
        select(Topic).join(Subject).where(
            Topic.id == payload.topic_id, can_access(current_user)
        )
    )
    if not topic_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Topic not found")

    test = Test(
        name=payload.name,
        description=payload.description,
        topic_id=payload.topic_id,
        creator_id=current_user.id,
        time_limit_minutes=payload.time_limit_minutes,
    )
    db.add(test)
    await db.flush()

    for i, q_data in enumerate(payload.questions):
        q_dict = q_data.model_dump()
        q_dict["order_index"] = i
        db.add(Question(test_id=test.id, **q_dict))

    await db.commit()
    result = await db.execute(
        select(Test).where(Test.id == test.id).options(selectinload(Test.questions))
    )
    return result.scalar_one()


@router.post("/", response_model=TestResponse, status_code=201)
async def create_test(
    payload: TestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new test with questions (used by the form and by pasted JSON)."""
    return await _save_test(payload, db, current_user)


@router.post("/import-json", response_model=TestResponse, status_code=201)
async def import_test_from_json(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import a test from a JSON file. See /api/v1/tests/example-json for the format."""
    content = await file.read()
    try:
        payload = TestImportJSON(**json.loads(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(e)}")
    return await _save_test(payload, db, current_user)


@router.get("/example-json")
async def get_example_json():
    """Returns example JSON format for test import."""
    return {
        "name": "Sample Physics Test",
        "description": "Test on Newton's Laws",
        "topic_id": "<your-topic-uuid>",
        "time_limit_minutes": 30,
        "questions": [
            {
                "question_type": "MCQ",
                "text": "Which of Newton's laws states that F = ma?",
                "options": [
                    {"id": "a", "text": "First Law", "is_correct": False},
                    {"id": "b", "text": "Second Law", "is_correct": True},
                    {"id": "c", "text": "Third Law", "is_correct": False},
                    {"id": "d", "text": "Law of Gravitation", "is_correct": False}
                ],
                "explanation": "Newton's Second Law states F = ma",
                "marks": 2,
                "negative_marks": 0
            },
            {
