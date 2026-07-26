from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from typing import List
from datetime import datetime
from app.db.base import get_db
from app.api.deps import get_current_user, can_access
from app.models.subject import Subject, Topic
from app.services.activity import activity_days, streaks
from app.models.user import User
from app.models.test import Test, Question
from app.models.attempt import Attempt, AttemptAnswer, AttemptStatus, RevisionQueue
from app.schemas.attempt import (
    AttemptStart, AttemptSubmit, AttemptResult,
    AttemptSummary, AnswerResult, RevisionItem
)

router = APIRouter(prefix="/attempts", tags=["Test Attempts"])


@router.post("/start", response_model=dict, status_code=201)
async def start_attempt(
    payload: AttemptStart,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a new attempt for a test. Returns the attempt_id to use when submitting."""
    result = await db.execute(
        select(Test).join(Topic).join(Subject).where(Test.id == payload.test_id, can_access(current_user))
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Test not found")

    attempt = Attempt(
        test_id=payload.test_id,
        user_id=current_user.id,
        status=AttemptStatus.IN_PROGRESS,
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)
    return {"attempt_id": attempt.id, "started_at": attempt.started_at}


@router.post("/{attempt_id}/submit", response_model=AttemptResult)
async def submit_attempt(
    attempt_id: str,
    payload: AttemptSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit answers for an attempt and get scored results."""
    result = await db.execute(
        select(Attempt).where(
            Attempt.id == attempt_id,
            Attempt.user_id == current_user.id
        )
    )
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.status != AttemptStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Attempt already completed")

    # Load test questions
    q_result = await db.execute(
        select(Question).where(Question.test_id == attempt.test_id)
    )
    questions = {q.id: q for q in q_result.scalars().all()}

    total_score = 0.0
    max_score = sum(q.marks for q in questions.values())
    answer_results = []
    correct_count = 0
    wrong_count = 0
    answered_ids = set()

    for ans in payload.answers:
        q = questions.get(ans.question_id)
        if not q:
            continue
        answered_ids.add(ans.question_id)
        correct_options = {o["id"] for o in q.options if o["is_correct"]}
        selected = set(ans.selected_options)

        is_correct = selected == correct_options
        marks = 0.0
        if is_correct:
            marks = q.marks
            correct_count += 1
        elif selected:
            marks = -q.negative_marks
            wrong_count += 1

        total_score += marks

        # Save answer to DB
        db.add(AttemptAnswer(
            attempt_id=attempt_id,
            question_id=q.id,
            selected_options=list(selected),
            is_correct=is_correct,
            marks_awarded=marks,
            time_spent_seconds=ans.time_spent_seconds,
        ))

        # Add to revision queue if wrong
        if not is_correct and selected:
            existing = await db.execute(
                select(RevisionQueue).where(
                    RevisionQueue.user_id == current_user.id,
                    RevisionQueue.question_id == q.id,
                )
            )
            rq = existing.scalar_one_or_none()
            if rq:
                rq.wrong_count += 1
                rq.last_wrong_at = datetime.utcnow()
                rq.is_resolved = False
            else:
                db.add(RevisionQueue(
                    user_id=current_user.id,
                    question_id=q.id,
                ))

        answer_results.append(AnswerResult(
            question_id=q.id,
            selected_options=list(selected),
            correct_options=list(correct_options),
            is_correct=is_correct,
            marks_awarded=marks,
            explanation=q.explanation,
        ))

    unattempted_count = len(questions) - len(answered_ids)
    percentage = (total_score / max_score * 100) if max_score > 0 else 0
    completed_at = datetime.utcnow()
    time_taken = int((completed_at - attempt.started_at).total_seconds())

