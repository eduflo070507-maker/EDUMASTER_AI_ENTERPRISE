import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Integer, Float, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

def uid():
    return str(uuid.uuid4())

def utcnow():
    return datetime.now(timezone.utc)

class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(160), default="Institución educativa")
    code: Mapped[str] = mapped_column(String(40), unique=True, default="INSTITUCION")
    status: Mapped[str] = mapped_column(String(20), default="active")

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    full_name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(190), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(40), default="student")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class Student(Base):
    __tablename__ = "students"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    student_code: Mapped[str] = mapped_column(String(50), unique=True)
    full_name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(190), default="")
    district: Mapped[str] = mapped_column(String(100), default="")
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class Course(Base):
    __tablename__ = "courses"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    code: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(180))
    description: Mapped[str] = mapped_column(Text, default="")
    level: Mapped[str] = mapped_column(String(50), default="General")
    status: Mapped[str] = mapped_column(String(30), default="published")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class Assessment(Base):
    __tablename__ = "assessments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"))
    title: Mapped[str] = mapped_column(String(180))
    max_score: Mapped[float] = mapped_column(Float, default=20)
    status: Mapped[str] = mapped_column(String(30), default="draft")
    due_date: Mapped[str] = mapped_column(String(30), default="")

class LearningEvent(Base):
    __tablename__ = "learning_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    event_id: Mapped[str] = mapped_column(String(36), unique=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(80))
    course_id: Mapped[str | None] = mapped_column(ForeignKey("courses.id"), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    description: Mapped[str] = mapped_column(Text, default="")

class Recommendation(Base):
    __tablename__ = "recommendations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"))
    title: Mapped[str] = mapped_column(String(180))
    rationale: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(30), default="pending")
    source: Mapped[str] = mapped_column(String(30), default="manual_review")

class ModelVersion(Base):
    __tablename__ = "model_versions"
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), nullable=True, index=True)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(120))
    version: Mapped[str] = mapped_column(String(40), default="0.1.0")
    stage: Mapped[str] = mapped_column(String(30), default="experimental")
    approval_status: Mapped[str] = mapped_column(String(30), default="not_approved")
    description: Mapped[str] = mapped_column(Text, default="Modelo experimental pendiente de evaluación y aprobación institucional.")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    actor_email: Mapped[str] = mapped_column(String(190))
    action: Mapped[str] = mapped_column(String(100))
    resource: Mapped[str] = mapped_column(String(100))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class LearningPath(Base):
    __tablename__ = "learning_paths"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    title: Mapped[str] = mapped_column(String(180))
    description: Mapped[str] = mapped_column(Text, default="")
    level: Mapped[str] = mapped_column(String(50), default="General")
    status: Mapped[str] = mapped_column(String(30), default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class Enrollment(Base):
    __tablename__ = "enrollments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), index=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="active")
    enrolled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class AssessmentResult(Base):
    __tablename__ = "assessment_results"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    assessment_id: Mapped[str] = mapped_column(ForeignKey("assessments.id"), index=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), index=True)
    score: Mapped[float] = mapped_column(Float)
    feedback: Mapped[str] = mapped_column(Text, default="")
    graded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class Certificate(Base):
    __tablename__ = "certificates"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), index=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    certificate_code: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    status: Mapped[str] = mapped_column(String(30), default="issued")

class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(180))
    message: Mapped[str] = mapped_column(Text, default="")
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
