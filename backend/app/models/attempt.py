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
