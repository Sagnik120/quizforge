from sqlalchemy import Column, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.db.base import Base


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(7), default="#6366f1")  # hex color for UI
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    space = Column(String(10), default="private", nullable=False, server_default="private")  # private | common
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="subjects")
    topics = relationship("Topic", back_populates="subject", cascade="all, delete-orphan")


class Topic(Base):
    __tablename__ = "topics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    subject_id = Column(String(36), ForeignKey("subjects.id"), nullable=False)
    parent_id = Column(String(36), ForeignKey("topics.id"), nullable=True)  # set => sub-topic
    created_at = Column(DateTime, default=datetime.utcnow)

    subject = relationship("Subject", back_populates="topics")
    tests = relationship("Test", back_populates="topic", cascade="all, delete-orphan")
    children = relationship("Topic", cascade="all, delete-orphan")
