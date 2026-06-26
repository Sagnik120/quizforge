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

