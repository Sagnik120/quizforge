from pydantic import BaseModel, validator
from typing import Optional, List, Any
from datetime import datetime
from app.models.test import QuestionType


class OptionSchema(BaseModel):
    id: str          # "a", "b", "c", "d"
    text: str
    is_correct: bool


class QuestionBase(BaseModel):
    question_type: QuestionType
    text: str
    options: List[OptionSchema]
    explanation: Optional[str] = None
    marks: int = 1
    negative_marks: int = 0
    order_index: int = 0

    @validator("options")
    def validate_options(cls, v, values):
        if len(v) < 2:
            raise ValueError("At least 2 options required")
        correct = [o for o in v if o.is_correct]
        qt = values.get("question_type")
        if qt == QuestionType.MCQ and len(correct) != 1:
            raise ValueError("MCQ must have exactly 1 correct option")
        if qt == QuestionType.MSQ and len(correct) < 2:
            raise ValueError("MSQ must have at least 2 correct options")
        return v


class QuestionCreate(QuestionBase):
    pass


class QuestionResponse(QuestionBase):
    id: str
    test_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class QuestionPublic(BaseModel):
    """Question without revealing correct answers — used during test attempt"""
    id: str
    question_type: QuestionType
    text: str
    options: List[dict]   # options without is_correct field
    marks: int
    negative_marks: int
    order_index: int


class TestBase(BaseModel):
    name: str
    description: Optional[str] = None
    topic_id: str
    time_limit_minutes: Optional[int] = None


class TestCreate(TestBase):
    questions: List[QuestionCreate] = []


class TestImportJSON(BaseModel):
    """Schema for importing test from JSON file"""
    name: str
    description: Optional[str] = None
    topic_id: str
    time_limit_minutes: Optional[int] = None
    questions: List[QuestionCreate]


class TestResponse(TestBase):
    id: str
    creator_id: str
    is_published: bool
    created_at: datetime
    updated_at: datetime
    questions: List[QuestionResponse] = []
    total_questions: int = 0
    total_marks: int = 0

    class Config:
        from_attributes = True


class TestSummary(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    topic_id: str
    total_questions: int
    total_marks: int
    time_limit_minutes: Optional[int] = None
    attempt_count: int = 0
    best_percentage: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True
