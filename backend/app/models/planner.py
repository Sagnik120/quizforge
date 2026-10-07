from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Date, Boolean, UniqueConstraint
from datetime import datetime
import uuid
from app.db.base import Base


class Goal(Base):
    """A node in a goal checklist tree (subject > topic > sub-topic)."""
    __tablename__ = "goals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    space = Column(String(10), default="private", nullable=False)  # private | common
    parent_id = Column(String(36), ForeignKey("goals.id"), nullable=True)
    title = Column(String(300), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class GoalCheck(Base):
    """One user's tick on a goal. Common goals are ticked per person."""
    __tablename__ = "goal_checks"
    __table_args__ = (UniqueConstraint("goal_id", "user_id"),)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    goal_id = Column(String(36), ForeignKey("goals.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    done_at = Column(DateTime, default=datetime.utcnow)


class ReminderCheck(Base):
    """One user's tick on a reminder. Common reminders are ticked per person."""
    __tablename__ = "reminder_checks"
    __table_args__ = (UniqueConstraint("reminder_id", "user_id"),)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    reminder_id = Column(String(36), ForeignKey("reminders.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    done_at = Column(DateTime, default=datetime.utcnow)


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    space = Column(String(10), default="private", nullable=False)  # private | common
    title = Column(String(300), nullable=False)
    note = Column(Text, nullable=True)
    date = Column(Date, nullable=False)
    done = Column(Boolean, default=False)  # legacy single tick; counts for the owner only, see ReminderCheck
    created_at = Column(DateTime, default=datetime.utcnow)
