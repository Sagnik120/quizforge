from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
import json
from app.db.base import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.test import Test, Question
from app.models.subject import Subject, Topic
from app.models.attempt import Attempt
from app.schemas.test import (
    TestCreate, TestResponse, TestSummary, TestImportJSON,
    QuestionCreate, QuestionResponse, QuestionPublic
)

router = APIRouter(prefix="/tests", tags=["Tests"])


@router.get("/", response_model=List[TestSummary])
async def list_tests(
    topic_id: Optional[str] = None,
    subject_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all tests, optionally filtered by topic or subject."""
    query = (
        select(Test)
        .join(Topic)
        .join(Subject)
        .where(Test.creator_id == current_user.id)
    )
    if topic_id:
        query = query.where(Test.topic_id == topic_id)
    if subject_id:
        query = query.where(Topic.subject_id == subject_id)

    result = await db.execute(query)
    tests = result.scalars().all()

    summaries = []
    for test in tests:
        qs = await db.execute(select(Question).where(Question.test_id == test.id))
        questions = qs.scalars().all()
        at = await db.execute(
            select(func.count(Attempt.id)).where(
                Attempt.test_id == test.id, Attempt.user_id == current_user.id
            )
        )
        attempt_count = at.scalar() or 0
        summaries.append(
            TestSummary(
                id=test.id,
                name=test.name,
                description=test.description,
                topic_id=test.topic_id,
                total_questions=len(questions),
                total_marks=sum(q.marks for q in questions),
                time_limit_minutes=test.time_limit_minutes,
                attempt_count=attempt_count,
                created_at=test.created_at,
            )
        )
    return summaries


@router.post("/", response_model=TestResponse, status_code=201)
async def create_test(
    payload: TestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new test with questions."""
    # Verify topic belongs to user
    topic_result = await db.execute(
        select(Topic).join(Subject).where(
            Topic.id == payload.topic_id,
            Subject.owner_id == current_user.id
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
        question = Question(test_id=test.id, **q_dict)
        db.add(question)

    await db.commit()
    result = await db.execute(
        select(Test).where(Test.id == test.id).options(selectinload(Test.questions))
    )
    return result.scalar_one()


@router.post("/import-json", response_model=TestResponse, status_code=201)
async def import_test_from_json(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import a test from a JSON file. See /api/v1/tests/example-json for the format."""
    content = await file.read()
    try:
        data = json.loads(content)
        payload = TestImportJSON(**data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(e)}")

    topic_result = await db.execute(
        select(Topic).join(Subject).where(
            Topic.id == payload.topic_id,
            Subject.owner_id == current_user.id
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
        question = Question(test_id=test.id, **q_dict)
        db.add(question)
    await db.commit()
    result2 = await db.execute(
        select(Test).where(Test.id == test.id).options(selectinload(Test.questions))
    )
    return result2.scalar_one()


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
                "question_type": "MSQ",
                "text": "Which are scalar quantities?",
                "options": [
                    {"id": "a", "text": "Speed", "is_correct": True},
                    {"id": "b", "text": "Velocity", "is_correct": False},
                    {"id": "c", "text": "Mass", "is_correct": True},
                    {"id": "d", "text": "Force", "is_correct": False}
                ],
                "marks": 3,
                "negative_marks": 1
            }
        ]
    }


@router.get("/{test_id}", response_model=TestResponse)
async def get_test(
    test_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a test with all questions (shows correct answers — for review/edit)."""
    result = await db.execute(
        select(Test).where(Test.id == test_id, Test.creator_id == current_user.id)
        .options(selectinload(Test.questions))
    )
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    return test


@router.get("/{test_id}/attempt-view", response_model=dict)
async def get_test_for_attempt(
    test_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get test questions without revealing correct answers (for attempt mode)."""
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    q_result = await db.execute(
        select(Question).where(Question.test_id == test_id).order_by(Question.order_index)
    )
    questions = q_result.scalars().all()
    public_questions = [
        {
            "id": q.id,
            "question_type": q.question_type,
            "text": q.text,
            "options": [{"id": o["id"], "text": o["text"]} for o in q.options],
            "marks": q.marks,
            "negative_marks": q.negative_marks,
            "order_index": q.order_index,
        }
        for q in questions
    ]
    return {
        "id": test.id,
        "name": test.name,
        "description": test.description,
        "time_limit_minutes": test.time_limit_minutes,
        "total_questions": len(questions),
        "total_marks": sum(q.marks for q in questions),
        "questions": public_questions,
    }


# Replace your existing delete_test function in backend/app/api/routes/tests.py
# with this one:

@router.delete("/{test_id}", status_code=204)
async def delete_test(
    test_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import delete as sql_delete
    from app.models.attempt import Attempt, AttemptAnswer, RevisionQueue

    result = await db.execute(
        select(Test).where(Test.id == test_id, Test.creator_id == current_user.id)
    )
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    # Get all question IDs for this test
    q_result = await db.execute(select(Question).where(Question.test_id == test_id))
    question_ids = [q.id for q in q_result.scalars().all()]

    if question_ids:
        # Delete revision_queue rows referencing these questions
        await db.execute(
            sql_delete(RevisionQueue).where(RevisionQueue.question_id.in_(question_ids))
        )
        # Delete attempt_answers referencing these questions
        await db.execute(
            sql_delete(AttemptAnswer).where(AttemptAnswer.question_id.in_(question_ids))
        )

    # Delete attempts for this test
    await db.execute(sql_delete(Attempt).where(Attempt.test_id == test_id))

    await db.delete(test)
    await db.commit()