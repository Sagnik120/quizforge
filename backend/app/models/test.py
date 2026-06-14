from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Integer, Boolean, JSON, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.db.base import Base


class QuestionType(str, enum.Enum):
    MCQ = "MCQ"  # Single correct answer
    MSQ = "MSQ"  # Multiple correct answers


class Test(Base):
    __tablename__ = "tests"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    topic_id = Column(String(36), ForeignKey("topics.id"), nullable=False)
    creator_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    time_limit_minutes = Column(Integer, nullable=True)  # None = no limit
    is_published = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    topic = relationship("Topic", back_populates="tests")
    creator = relationship("User", back_populates="tests")
    questions = relationship("Question", back_populates="test", cascade="all, delete-orphan", order_by="Question.order_index")
    attempts = relationship("Attempt", back_populates="test", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    test_id = Column(String(36), ForeignKey("tests.id"), nullable=False)
    question_type = Column(SAEnum(QuestionType), nullable=False)
    text = Column(Text, nullable=False)
    options = Column(JSON, nullable=False)  # [{"id": "a", "text": "...", "is_correct": bool}]
    explanation = Column(Text, nullable=True)
    marks = Column(Integer, default=1)
    negative_marks = Column(Integer, default=0)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    test = relationship("Test", back_populates="questions")
    attempt_answers = relationship("AttemptAnswer", back_populates="question")
    revision_entries = relationship("RevisionQueue", back_populates="question")
