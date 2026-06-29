from pydantic import BaseModel
from typing import Optional, List, Literal
from datetime import datetime


class TopicBase(BaseModel):
    name: str
    description: Optional[str] = None


class TopicCreate(TopicBase):
    parent_id: Optional[str] = None


class TopicResponse(TopicBase):
    id: str
    subject_id: str
    parent_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SubjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#6366f1"
    space: Literal["private", "common"] = "private"


class SubjectCreate(SubjectBase):
    pass


class SubjectResponse(SubjectBase):
    id: str
    owner_id: str
    created_at: datetime
    topics: List[TopicResponse] = []

    class Config:
        from_attributes = True
