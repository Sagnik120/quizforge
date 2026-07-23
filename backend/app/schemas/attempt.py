from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.attempt import AttemptStatus


class AnswerSubmit(BaseModel):
    question_id: str
    selected_options: List[str]  # option ids like ["a", "c"]
    time_spent_seconds: Optional[int] = None


class AttemptStart(BaseModel):
    test_id: str


class AttemptSubmit(BaseModel):
    answers: List[AnswerSubmit]


class AnswerResult(BaseModel):
    question_id: str
    selected_options: List[str]
    correct_options: List[str]
    is_correct: bool
    marks_awarded: float
    explanation: Optional[str] = None


class AttemptResult(BaseModel):
    id: str
    test_id: str
    test_name: str
    score: float
    max_score: float
    percentage: float
    correct_count: int
    wrong_count: int
    unattempted_count: int
    time_taken_seconds: Optional[int]
    completed_at: datetime
    answers: List[AnswerResult]


class AttemptSummary(BaseModel):
    id: str
    test_id: str
    test_name: str
    score: float
    max_score: float
    percentage: float
    status: AttemptStatus
    started_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class RevisionItem(BaseModel):
