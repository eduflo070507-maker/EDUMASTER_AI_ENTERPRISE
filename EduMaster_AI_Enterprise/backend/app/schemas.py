from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    role: str
    model_config = ConfigDict(from_attributes=True)

class StudentIn(BaseModel):
    student_code: str
    full_name: str
    email: str = ""
    status: str = "active"

class CourseIn(BaseModel):
    code: str
    title: str
    description: str = ""
    level: str = "General"
    status: str = "published"

class AssessmentIn(BaseModel):
    course_id: str
    title: str
    max_score: float = 20
    status: str = "draft"
    due_date: str = ""

class EventIn(BaseModel):
    student_id: str
    event_type: str
    course_id: Optional[str] = None
    description: str = ""

class RecommendationFeedback(BaseModel):
    status: str
