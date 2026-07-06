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
