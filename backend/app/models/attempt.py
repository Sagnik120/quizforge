from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Integer, Float, Boolean, JSON, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.db.base import Base


class AttemptStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class Attempt(Base):
    __tablename__ = "attempts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    test_id = Column(String(36), ForeignKey("tests.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    status = Column(SAEnum(AttemptStatus), default=AttemptStatus.IN_PROGRESS)
    score = Column(Float, nullable=True)          # raw score
    max_score = Column(Float, nullable=True)      # maximum possible score
    percentage = Column(Float, nullable=True)     # 0-100
    time_taken_seconds = Column(Integer, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    test = relationship("Test", back_populates="attempts")
    user = relationship("User", back_populates="attempts")
    answers = relationship("AttemptAnswer", back_populates="attempt", cascade="all, delete-orphan")


class AttemptAnswer(Base):
    __tablename__ = "attempt_answers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    attempt_id = Column(String(36), ForeignKey("attempts.id"), nullable=False)
    question_id = Column(String(36), ForeignKey("questions.id"), nullable=False)
    selected_options = Column(JSON, nullable=False)  # list of option ids e.g. ["a", "c"]
    is_correct = Column(Boolean, nullable=True)
    marks_awarded = Column(Float, default=0)
    time_spent_seconds = Column(Integer, nullable=True)

    attempt = relationship("Attempt", back_populates="answers")
    question = relationship("Question", back_populates="attempt_answers")


class RevisionQueue(Base):
    __tablename__ = "revision_queue"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    question_id = Column(String(36), ForeignKey("questions.id"), nullable=False)
    wrong_count = Column(Integer, default=1)       # times answered wrong
    last_wrong_at = Column(DateTime, default=datetime.utcnow)
    is_resolved = Column(Boolean, default=False)   # marked as understood
    added_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="revision_queue")
    question = relationship("Question", back_populates="revision_entries")
