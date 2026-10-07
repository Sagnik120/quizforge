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

    attempt.status = AttemptStatus.COMPLETED
    attempt.score = total_score
    attempt.max_score = max_score
    attempt.percentage = percentage
    attempt.time_taken_seconds = time_taken
    attempt.completed_at = completed_at

    # Update streak
    await _update_streak(current_user, db)

    await db.commit()

    test_result = await db.execute(select(Test).where(Test.id == attempt.test_id))
    test = test_result.scalar_one()

    return AttemptResult(
        id=attempt.id,
        test_id=attempt.test_id,
        test_name=test.name,
        score=total_score,
        max_score=max_score,
        percentage=percentage,
        correct_count=correct_count,
        wrong_count=wrong_count,
        unattempted_count=unattempted_count,
        time_taken_seconds=time_taken,
        completed_at=completed_at,
        answers=answer_results,
    )


async def _update_streak(user: User, db: AsyncSession):
    current, longest = streaks(await activity_days(db, user.id))
    user.current_streak = current
    user.longest_streak = max(longest, user.longest_streak or 0)
    user.last_activity_date = datetime.utcnow()


@router.get("/my", response_model=List[AttemptSummary])
async def my_attempts(
    test_id: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all completed attempts by the current user."""
    query = select(Attempt).where(
        Attempt.user_id == current_user.id,
        Attempt.status == AttemptStatus.COMPLETED,
    ).order_by(Attempt.completed_at.desc())
    if test_id:
        query = query.where(Attempt.test_id == test_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{attempt_id}/result", response_model=AttemptResult)
async def get_attempt_result(
    attempt_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the detailed result of a completed attempt."""
    result = await db.execute(
        select(Attempt).where(
            Attempt.id == attempt_id, Attempt.user_id == current_user.id
        )
    )
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    # Build answer results
    ans_result = await db.execute(
        select(AttemptAnswer).where(AttemptAnswer.attempt_id == attempt_id)
    )
    answers = ans_result.scalars().all()
    answer_results = []
    for a in answers:
        q_r = await db.execute(select(Question).where(Question.id == a.question_id))
        q = q_r.scalar_one()
        correct_options = [o["id"] for o in q.options if o["is_correct"]]
        answer_results.append(AnswerResult(
            question_id=a.question_id,
            selected_options=a.selected_options,
            correct_options=correct_options,
            is_correct=a.is_correct,
            marks_awarded=a.marks_awarded,
            explanation=q.explanation,
        ))

    test_r = await db.execute(select(Test).where(Test.id == attempt.test_id))
    test = test_r.scalar_one()
    correct_count = sum(1 for a in answers if a.is_correct)
    wrong_count = sum(1 for a in answers if a.is_correct is False)

    return AttemptResult(
        id=attempt.id,
        test_id=attempt.test_id,
        test_name=test.name,
        score=attempt.score,
        max_score=attempt.max_score,
        percentage=attempt.percentage,
        correct_count=correct_count,
        wrong_count=wrong_count,
        unattempted_count=0,
        time_taken_seconds=attempt.time_taken_seconds,
        completed_at=attempt.completed_at,
        answers=answer_results,
    )
