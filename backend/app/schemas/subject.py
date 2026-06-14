from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class TopicBase(BaseModel):
    name: str
    description: Optional[str] = None


class TopicCreate(TopicBase):
    pass


class TopicResponse(TopicBase):
    id: str
    subject_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class SubjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#6366f1"


class SubjectCreate(SubjectBase):
    pass


class SubjectResponse(SubjectBase):
    id: str
    owner_id: str
    created_at: datetime
    topics: List[TopicResponse] = []

    class Config:
        from_attributes = True
