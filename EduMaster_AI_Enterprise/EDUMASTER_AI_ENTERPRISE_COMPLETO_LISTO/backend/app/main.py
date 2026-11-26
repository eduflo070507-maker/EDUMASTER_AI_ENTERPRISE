import os, uuid, json, shutil
from pathlib import Path
from datetime import datetime, timezone, timedelta
import pandas as pd
import numpy as np
import joblib
from fastapi import UploadFile, File, Form
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder, LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix, classification_report
from fastapi import FastAPI, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import func, text, inspect
from .database import Base, engine, get_db, SessionLocal
from . import models, schemas
from .security import hash_password, verify_password, create_token, decode_token

Base.metadata.create_all(bind=engine)


def ensure_model_versions_organization_column():
    """
    Actualiza de forma no destructiva instalaciones existentes.
    create_all() no agrega columnas a tablas que ya existen; por eso
    incorporamos organization_id si falta, sin eliminar ni recrear datos.
    """
    inspector = inspect(engine)
    if "model_versions" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("model_versions")
    }

    if "organization_id" not in existing_columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE model_versions "
                    "ADD COLUMN organization_id VARCHAR(36)"
                )
            )

    # Índice para que el filtro por institución sea eficiente.
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS "
                "ix_model_versions_organization_id "
                "ON model_versions (organization_id)"
            )
        )


ensure_model_versions_organization_column()

def ensure_student_location_columns():
    """Añade campos geográficos opcionales sin borrar ni recrear estudiantes."""
    inspector = inspect(engine)
    if "students" not in inspector.get_table_names():
        return
    existing = {column["name"] for column in inspector.get_columns("students")}
    additions = {
        "district": "VARCHAR(100) NOT NULL DEFAULT ''",
        "latitude": "FLOAT",
        "longitude": "FLOAT",
    }
    missing = [(name, ddl) for name, ddl in additions.items() if name not in existing]
    if missing:
        with engine.begin() as connection:
            for name, ddl in missing:
                connection.execute(text(f"ALTER TABLE students ADD COLUMN {name} {ddl}"))

ensure_student_location_columns()


app = FastAPI(title="EduMaster.ai Enterprise API", version="1.0.0", description="API inicial integrada de EduMaster.ai")

# ---------------- Configuración CORS ----------------

default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

env_origins = os.getenv("CORS_ORIGINS", "")

origins = [
    origin.strip().rstrip("/")
    for origin in env_origins.split(",")
    if origin.strip()
]

origins = list(set(default_origins + origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def bootstrap_admin():
    """Create only the first institution administrator from deployment environment."""
    email = os.getenv("BOOTSTRAP_ADMIN_EMAIL", "").strip().lower()
    password = os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "")
    org_name = os.getenv("BOOTSTRAP_ORG_NAME", "").strip()
    org_code = os.getenv("BOOTSTRAP_ORG_CODE", "").strip().upper()
    if not (email and password and org_name and org_code):
        return
    if len(password) < 12:
        raise RuntimeError("BOOTSTRAP_ADMIN_PASSWORD debe tener al menos 12 caracteres")
    db = SessionLocal()
    try:
        if db.query(models.User).count() > 0:
            return
        org = models.Organization(name=org_name, code=org_code)
        db.add(org); db.flush()
        admin = models.User(organization_id=org.id,
            full_name=os.getenv("BOOTSTRAP_ADMIN_NAME", "Administrador institucional"),
            email=email, password_hash=hash_password(password), role="institution_admin")
        db.add(admin)
        db.commit()
    finally:
        db.close()

bootstrap_admin()

def current_user(token: str = Depends(oauth2), db: Session = Depends(get_db)):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Sesión inválida o vencida")
    user = db.query(models.User).filter_by(email=payload.get("sub"), is_active=True).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no disponible")
    return user

def require_admin(user=Depends(current_user)):
    if user.role not in ("superadmin", "institution_admin", "director"):
        raise HTTPException(status_code=403, detail="No tienes permisos para esta operación")
    return user

@app.get("/health")
def health():
    return {"status":"ok","service":"edumaster-api","version":"2.0.0"}

@app.post("/api/v1/auth/login")
def login(data: schemas.LoginIn, db: Session = Depends(get_db)):
    user = db.query(models.User).filter_by(email=data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuario inactivo")
    return {"access_token": create_token(user.email, user.role), "token_type":"bearer",
            "user":{"id":user.id,"full_name":user.full_name,"email":user.email,"role":user.role}}

class AdminRecoveryIn(BaseModel):
    recovery_key: str = Field(min_length=24)
    current_email: str = Field(min_length=3, max_length=320)
    new_email: EmailStr
    new_password: str = Field(min_length=12, max_length=128)

@app.post("/api/v1/admin/recover-access")
def recover_admin_access(data: AdminRecoveryIn, db: Session = Depends(get_db)):
    """One-time administrative recovery protected by an environment secret."""
    configured_key = os.getenv("ADMIN_RECOVERY_KEY", "")
    if len(configured_key) < 24:
        raise HTTPException(status_code=503, detail="La recuperación no está habilitada. Configura ADMIN_RECOVERY_KEY en el backend.")
    import hmac
    if not hmac.compare_digest(data.recovery_key, configured_key):
        raise HTTPException(status_code=403, detail="Clave de recuperación incorrecta")
    user = db.query(models.User).filter(func.lower(models.User.email) == data.current_email.lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="No existe un usuario con el correo actual indicado")
    existing = db.query(models.User).filter(func.lower(models.User.email) == data.new_email.lower(), models.User.id != user.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="El nuevo correo ya está registrado")
    user.email = data.new_email.lower()
    user.password_hash = hash_password(data.new_password)
    user.is_active = True
    db.commit()
    return {"message": "Acceso del administrador actualizado. Ya puedes iniciar sesión.", "email": user.email, "role": user.role}

@app.get("/api/v1/auth/me")
def me(user=Depends(current_user)):
    return {"id":user.id,"full_name":user.full_name,"email":user.email,"role":user.role}

@app.get("/api/v1/dashboard/summary")
def dashboard(user=Depends(current_user), db: Session = Depends(get_db)):
    org = user.organization_id
    student_count = db.query(models.Student).filter_by(organization_id=org).count()
    course_count = db.query(models.Course).filter_by(organization_id=org).count()
    assessment_count = db.query(models.Assessment).filter_by(organization_id=org).count()
    enrollment_count = db.query(models.Enrollment).filter_by(organization_id=org).count()
    result_count = db.query(models.AssessmentResult).filter_by(organization_id=org).count()
    students = {x.id: x.full_name for x in db.query(models.Student).filter_by(organization_id=org).all()}
    recent = db.query(models.LearningEvent).filter_by(organization_id=org).order_by(models.LearningEvent.occurred_at.desc()).limit(8).all()
    return {
        "students": student_count,
        "courses": course_count,
        "assessments": assessment_count,
        "enrollments": enrollment_count,
        "graded_results": result_count,
        "learning_events": db.query(models.LearningEvent).filter_by(organization_id=org).count(),
        "recommendations_count": db.query(models.Recommendation).filter_by(organization_id=org).count(),
        "ai_status": "Modelo experimental" if db.query(models.ModelVersion).filter_by(organization_id=org, approval_status="approved").count() == 0 else "Modelo aprobado",
        "active_students": db.query(models.Student).filter_by(organization_id=org, status="active").count(),
        "recent_activity": [{"id": x.id, "student_name": students.get(x.student_id, "Estudiante"), "event_type": x.event_type, "description": x.description, "occurred_at": x.occurred_at} for x in recent]
    }

@app.get("/api/v1/dashboard/analytics")
def dashboard_analytics(user=Depends(current_user), db: Session = Depends(get_db)):
    """Indicadores calculados desde notas, matrículas, actividad y coordenadas persistidas."""
    org = user.organization_id
    results = db.query(models.AssessmentResult).filter_by(organization_id=org).all()
    assessments = {x.id: x for x in db.query(models.Assessment).filter_by(organization_id=org).all()}
    courses = {x.id: x for x in db.query(models.Course).filter_by(organization_id=org).all()}
    students = db.query(models.Student).filter_by(organization_id=org).all()
    enrollments = db.query(models.Enrollment).filter_by(organization_id=org).all()
    events = db.query(models.LearningEvent).filter_by(organization_id=org).all()

    monthly = {}
    for result in results:
        month = result.graded_at.strftime("%Y-%m")
        monthly.setdefault(month, []).append(float(result.score))
    monthly_progress = [
        {"month": month, "value": round(sum(scores) / len(scores), 2), "count": len(scores)}
        for month, scores in sorted(monthly.items())[-12:]
    ]

    course_scores = {}
    for result in results:
        assessment = assessments.get(result.assessment_id)
        course = courses.get(assessment.course_id) if assessment else None
        if course:
            course_scores.setdefault(course.title, []).append(float(result.score))
    course_performance = [
        {"name": name, "value": round(sum(scores) / len(scores), 2), "count": len(scores)}
        for name, scores in sorted(course_scores.items())
    ]

    # Dominio estimado: promedio del curso convertido a porcentaje de su puntaje máximo.
    # Se etiqueta como estimación porque el esquema no almacena rúbricas independientes.
    mastery_scores = {}
    for result in results:
        assessment = assessments.get(result.assessment_id)
        course = courses.get(assessment.course_id) if assessment else None
        if course:
            max_score = float(assessment.max_score or 20) if assessment else 20.0
            pct = max(0.0, min(100.0, (float(result.score) / max(max_score, 1.0)) * 100.0))
            mastery_scores.setdefault(course.title, []).append(pct)
    skill_mastery = [
        {"name": name, "value": round(sum(values) / len(values), 1), "count": len(values), "source": "assessment_average_estimate"}
        for name, values in sorted(mastery_scores.items())
    ]

    geo_points = [
        {"id": st.id, "name": st.full_name, "district": st.district,
         "latitude": st.latitude, "longitude": st.longitude}
        for st in students if st.latitude is not None and st.longitude is not None
    ]
    recs = db.query(models.Recommendation).filter_by(organization_id=org).order_by(models.Recommendation.id.desc()).limit(8).all()
    student_names = {st.id: st.full_name for st in students}
    recommendations = [
        {"id": rec.id, "title": rec.title, "description": rec.rationale,
         "status": rec.status, "student_name": student_names.get(rec.student_id, "Estudiante")}
        for rec in recs
    ]
    return {
        "monthly_progress": monthly_progress,
        "course_performance": course_performance,
        "skill_mastery": skill_mastery,
        "geo_points": geo_points,
        "students_with_location": len(geo_points),
        "students_without_location": max(0, len(students) - len(geo_points)),
        "enrollments": len(enrollments),
        "completed_enrollments": sum(1 for item in enrollments if item.status == "completed"),
        "learning_events": len(events),
        "graded_results": len(results),
        "recommendations": recommendations,
        "data_quality": {
            "has_grades": bool(results),
            "has_locations": bool(geo_points),
            "has_enrollments": bool(enrollments),
            "note": "Indicadores calculados con datos académicos guardados en la base institucional."
        }
    }


@app.get("/api/v1/students")
def list_students(user=Depends(current_user), db: Session=Depends(get_db)):
    return db.query(models.Student).filter_by(organization_id=user.organization_id).order_by(models.Student.full_name).all()

@app.post("/api/v1/students")
def create_student(data: schemas.StudentIn, user=Depends(require_admin), db: Session=Depends(get_db)):
    if db.query(models.Student).filter_by(organization_id=user.organization_id, student_code=data.student_code).first():
        raise HTTPException(409, "El código de estudiante ya existe")
    obj=models.Student(organization_id=user.organization_id, **data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    db.add(models.AuditLog(organization_id=user.organization_id, actor_email=user.email, action="create", resource="student"))
    db.commit()
    return obj

@app.get("/api/v1/courses")
def list_courses(user=Depends(current_user), db: Session=Depends(get_db)):
    return db.query(models.Course).filter_by(organization_id=user.organization_id).order_by(models.Course.title).all()

@app.post("/api/v1/courses")
def create_course(data: schemas.CourseIn, user=Depends(require_admin), db: Session=Depends(get_db)):
    obj=models.Course(organization_id=user.organization_id, **data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    db.add(models.AuditLog(organization_id=user.organization_id, actor_email=user.email, action="create", resource="course")); db.commit()
    return obj

@app.get("/api/v1/assessments")
def list_assessments(user=Depends(current_user), db: Session=Depends(get_db)):
    return db.query(models.Assessment).filter_by(organization_id=user.organization_id).all()

@app.post("/api/v1/assessments")
def create_assessment(data: schemas.AssessmentIn, user=Depends(require_admin), db: Session=Depends(get_db)):
    course=db.query(models.Course).filter_by(id=data.course_id, organization_id=user.organization_id).first()
    if not course: raise HTTPException(404, "Curso no encontrado")
    obj=models.Assessment(organization_id=user.organization_id, **data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj); return obj

@app.post("/api/v1/learning-events")
def create_event(data: schemas.EventIn, user=Depends(current_user), db: Session=Depends(get_db)):
    student=db.query(models.Student).filter_by(id=data.student_id, organization_id=user.organization_id).first()
    if not student: raise HTTPException(404, "Estudiante no encontrado")
    obj=models.LearningEvent(organization_id=user.organization_id, **data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj); return obj

@app.get("/api/v1/recommendations")
def recommendations(user=Depends(current_user), db: Session=Depends(get_db)):
    return db.query(models.Recommendation).filter_by(organization_id=user.organization_id).all()

@app.get("/api/v1/ml/models")
def ml_models(user=Depends(current_user), db: Session=Depends(get_db)):
    return db.query(models.ModelVersion).filter((models.ModelVersion.organization_id == user.organization_id) | (models.ModelVersion.organization_id == None)).all()

@app.get("/api/v1/audit-logs")
def audit_logs(user=Depends(require_admin), db: Session=Depends(get_db)):
    return db.query(models.AuditLog).filter_by(organization_id=user.organization_id).order_by(models.AuditLog.occurred_at.desc()).limit(100).all()



# ---------------- Operaciones académicas ampliadas ----------------
from pydantic import BaseModel, Field
from typing import Optional

class PathIn(BaseModel):
    title: str = Field(min_length=2, max_length=180)
    description: str = ""
    level: str = "General"
    status: str = "draft"

class EnrollmentIn(BaseModel):
    student_id: str
    course_id: str

class GradeIn(BaseModel):
    assessment_id: str
    student_id: str
    score: float = Field(ge=0)
    feedback: str = ""


@app.post("/api/v1/demo/seed")
def seed_demo_academic_data(user=Depends(require_admin), db: Session = Depends(get_db)):
    """Carga una muestra académica ficticia, identificada con prefijo DEMO y sin borrar datos existentes."""
    org = user.organization_id
    existing_students = db.query(models.Student).filter(
        models.Student.organization_id == org,
        models.Student.student_code.like("DEMO-%")
    ).count()
    existing_courses = db.query(models.Course).filter(
        models.Course.organization_id == org,
        models.Course.code.like("DEMO-%")
    ).count()
    if existing_students or existing_courses:
        return {
            "ok": True,
            "already_loaded": True,
            "message": "Los datos DEMO ya estaban cargados. No se duplicó ningún registro.",
            "students": existing_students,
            "courses": existing_courses
        }

    district_data = [
        ("Los Olivos", -11.9700, -77.0700), ("Independencia", -11.9900, -77.0500),
        ("San Martín de Porres", -12.0000, -77.0900), ("Comas", -11.9300, -77.0600),
        ("San Miguel", -12.0800, -77.0900), ("Cercado de Lima", -12.0464, -77.0428),
        ("Rímac", -12.0250, -77.0350), ("Callao", -12.0560, -77.1180),
        ("Miraflores", -12.1210, -77.0300), ("Ate", -12.0260, -76.9200),
        ("San Juan de Lurigancho", -11.9800, -76.9900), ("Pueblo Libre", -12.0760, -77.0620)
    ]
    demo_students = []
    for i in range(36):
        district, lat, lon = district_data[i % len(district_data)]
        demo_students.append(models.Student(
            organization_id=org,
            student_code=f"DEMO-{org[:6].upper()}-2026-{i+1:03d}",
            full_name=f"Estudiante DEMO {i+1:03d}",
            email=f"estudiante.demo{i+1:03d}@example.test",
            district=district,
            latitude=lat + ((i % 3) - 1) * 0.0015,
            longitude=lon + ((i % 4) - 1.5) * 0.0015,
            status="active" if i % 7 else "inactive"
        ))
    db.add_all(demo_students)

    course_specs = [
        ("Fundamentos de programación", "Lógica, algoritmos, variables y estructuras de control.", "Básico"),
        ("Python aplicado", "Programación con Python, funciones, colecciones y archivos.", "Básico"),
        ("Bases de datos SQL", "Modelado relacional, consultas, joins e integridad.", "Intermedio"),
        ("Desarrollo web frontend", "HTML, CSS, TypeScript y componentes React.", "Intermedio"),
        ("Backend y APIs REST", "Diseño de servicios, validación, autenticación y endpoints.", "Intermedio"),
        ("Estadística aplicada", "Probabilidad, análisis exploratorio y visualización.", "Básico"),
        ("Introducción a Machine Learning", "Preparación de datos y modelos supervisados.", "Intermedio"),
        ("Redes neuronales", "Perceptrón multicapa, entrenamiento y evaluación.", "Avanzado"),
        ("Ingeniería de requisitos", "Historias de usuario, alcance y trazabilidad.", "Intermedio"),
        ("Experiencia de usuario UX/UI", "Investigación, prototipado y accesibilidad.", "Básico"),
        ("Ciberseguridad básica", "Principios de seguridad, riesgos y protección de datos.", "Básico"),
        ("Proyecto integrador", "Planificación, desarrollo, pruebas y documentación.", "Avanzado"),
    ]
    demo_courses = [models.Course(
        organization_id=org, code=f"DEMO-CUR-{i+1:02d}", title=title,
        description=f"[DEMO] {description}", level=level, status="published"
    ) for i, (title, description, level) in enumerate(course_specs)]
    db.add_all(demo_courses)
    db.flush()

    demo_assessments = []
    for i, course in enumerate(demo_courses):
        assessment = models.Assessment(
            organization_id=org, course_id=course.id,
            title=f"Evaluación de práctica · {course.title}",
            max_score=20, status="published", due_date=(datetime.now(timezone.utc) + timedelta(days=14+i)).date().isoformat()
        )
        demo_assessments.append(assessment)
    db.add_all(demo_assessments)
    db.flush()

    now = datetime.now(timezone.utc)
    demo_enrollments = []
    demo_results = []
    demo_events = []
    demo_recommendations = []
    event_types = ["lesson_view", "assessment_submit", "resource_download", "practice_complete"]
    for i, student in enumerate(demo_students):
        selected_courses = [(i * 3 + j * 2) % len(demo_courses) for j in range(4)]
        for j, ci in enumerate(selected_courses):
            status_value = "completed" if (i + j) % 3 == 0 else ("active" if (i + j) % 3 == 1 else "withdrawn")
            demo_enrollments.append(models.Enrollment(
                organization_id=org, student_id=student.id, course_id=demo_courses[ci].id,
                status=status_value, enrolled_at=now - timedelta(days=30 * ((i + j) % 8))
            ))
            score = float(10 + ((i * 3 + ci * 2 + j) % 11))
            month_offset = (i + ci + j) % 8
            demo_results.append(models.AssessmentResult(
                organization_id=org, assessment_id=demo_assessments[ci].id,
                student_id=student.id, score=score,
                feedback="[DEMO] Resultado académico de práctica.",
                graded_at=now - timedelta(days=30 * month_offset + (i % 20))
            ))
        for k in range(2):
            course_index = selected_courses[k]
            demo_events.append(models.LearningEvent(
                organization_id=org, student_id=student.id, course_id=demo_courses[course_index].id,
                event_type=event_types[(i + k) % len(event_types)],
                description=f"[DEMO] Actividad de práctica en {demo_courses[course_index].title}.",
                occurred_at=now - timedelta(days=(i * 2 + k) % 45)
            ))
        if i % 2 == 0:
            demo_recommendations.append(models.Recommendation(
                organization_id=org, student_id=student.id,
                title="Repasar conceptos clave del curso",
                rationale="[DEMO] Sugerencia de práctica basada en una calificación simulada; requiere revisión docente.",
                status="pending", source="demo"
            ))

    db.add_all(demo_enrollments)
    db.add_all(demo_results)
    db.add_all(demo_events)
    db.add_all(demo_recommendations)
    for i in range(6):
        db.add(models.LearningPath(
            organization_id=org,
            title=["Ruta de programación inicial", "Ruta de desarrollo web", "Ruta de datos y SQL", "Ruta de Machine Learning", "Ruta de ciberseguridad", "Ruta de proyecto integrador"][i],
            description="[DEMO] Itinerario de aprendizaje de muestra para validar el módulo de rutas.",
            level=["Básico", "Intermedio", "Intermedio", "Avanzado", "Básico", "Avanzado"][i],
            status="published"
        ))
    db.add(models.AuditLog(organization_id=org, actor_email=user.email, action="seed_demo_data", resource="demo_academic_records"))
    db.commit()

    return {
        "ok": True,
        "already_loaded": False,
        "message": "Se agregaron 36 estudiantes DEMO, 12 cursos DEMO, 12 evaluaciones, 144 matrículas, 144 notas, 72 eventos, 18 recomendaciones y 6 rutas. Los datos reales existentes no se modificaron.",
        "created": {"students": 36, "courses": 12, "assessments": 12, "enrollments": len(demo_enrollments), "results": len(demo_results), "events": len(demo_events), "recommendations": len(demo_recommendations), "learning_paths": 6}
    }

class RecommendationIn(BaseModel):
    student_id: str
    title: str
    rationale: str = ""

class UserCreateIn(BaseModel):
    full_name: str
    email: str
    password: str = Field(min_length=12)
    role: str = "teacher"

class CertificateIn(BaseModel):
    student_id: str
    course_id: str

class NotificationIn(BaseModel):
    title: str
    message: str
    user_id: Optional[str] = None

ROLE_ADMIN = ("superadmin", "institution_admin", "director")

def audit(db, user, action, resource):
    db.add(models.AuditLog(organization_id=user.organization_id, actor_email=user.email, action=action, resource=resource))

@app.get("/api/v1/organization")
def organization(user=Depends(current_user), db: Session=Depends(get_db)):
    org=db.query(models.Organization).filter_by(id=user.organization_id).first()
    return {"id":org.id,"name":org.name,"code":org.code,"status":org.status}

@app.get("/api/v1/learning-events")
def list_events(user=Depends(current_user), db: Session=Depends(get_db)):
    events = db.query(models.LearningEvent).filter_by(organization_id=user.organization_id).order_by(models.LearningEvent.occurred_at.desc()).limit(500).all()
    students = {x.id: x.full_name for x in db.query(models.Student).filter_by(organization_id=user.organization_id).all()}
    courses = {x.id: x.title for x in db.query(models.Course).filter_by(organization_id=user.organization_id).all()}
    return [{"id": x.id, "student_id": x.student_id, "student_name": students.get(x.student_id, "Estudiante"),
             "course_id": x.course_id, "course_title": courses.get(x.course_id, ""), "event_type": x.event_type,
             "description": x.description, "occurred_at": x.occurred_at} for x in events]

@app.put("/api/v1/students/{item_id}")
def update_student(item_id: str, data: schemas.StudentIn, user=Depends(require_admin), db: Session=Depends(get_db)):
    obj=db.query(models.Student).filter_by(id=item_id, organization_id=user.organization_id).first()
    if not obj: raise HTTPException(404,"Estudiante no encontrado")
    for k,v in data.model_dump().items(): setattr(obj,k,v)
    audit(db,user,"update","student"); db.commit(); db.refresh(obj); return obj

@app.delete("/api/v1/students/{item_id}", status_code=204)
def delete_student(item_id: str, user=Depends(require_admin), db: Session=Depends(get_db)):
    obj=db.query(models.Student).filter_by(id=item_id, organization_id=user.organization_id).first()
    if not obj: raise HTTPException(404,"Estudiante no encontrado")
    if db.query(models.Enrollment).filter_by(student_id=item_id).count() or db.query(models.AssessmentResult).filter_by(student_id=item_id).count():
        obj.status="inactive"
    else: db.delete(obj)
    audit(db,user,"delete_or_deactivate","student"); db.commit()

@app.put("/api/v1/courses/{item_id}")
def update_course(item_id: str, data: schemas.CourseIn, user=Depends(require_admin), db: Session=Depends(get_db)):
    obj=db.query(models.Course).filter_by(id=item_id, organization_id=user.organization_id).first()
    if not obj: raise HTTPException(404,"Curso no encontrado")
    for k,v in data.model_dump().items(): setattr(obj,k,v)
    audit(db,user,"update","course"); db.commit(); db.refresh(obj); return obj

@app.delete("/api/v1/courses/{item_id}", status_code=204)
def delete_course(item_id: str, user=Depends(require_admin), db: Session=Depends(get_db)):
    obj=db.query(models.Course).filter_by(id=item_id, organization_id=user.organization_id).first()
    if not obj: raise HTTPException(404,"Curso no encontrado")
    if db.query(models.Enrollment).filter_by(course_id=item_id).count() or db.query(models.Assessment).filter_by(course_id=item_id).count(): obj.status="archived"
    else: db.delete(obj)
    audit(db,user,"delete_or_archive","course"); db.commit()

@app.put("/api/v1/assessments/{item_id}")
def update_assessment(item_id: str, data: schemas.AssessmentIn, user=Depends(require_admin), db: Session=Depends(get_db)):
    obj=db.query(models.Assessment).filter_by(id=item_id, organization_id=user.organization_id).first()
    if not obj: raise HTTPException(404,"Evaluación no encontrada")
    if not db.query(models.Course).filter_by(id=data.course_id, organization_id=user.organization_id).first(): raise HTTPException(404,"Curso no encontrado")
    for k,v in data.model_dump().items(): setattr(obj,k,v)
    audit(db,user,"update","assessment"); db.commit(); db.refresh(obj); return obj

@app.delete("/api/v1/assessments/{item_id}", status_code=204)
def delete_assessment(item_id: str, user=Depends(require_admin), db: Session=Depends(get_db)):
    obj=db.query(models.Assessment).filter_by(id=item_id, organization_id=user.organization_id).first()
    if not obj: raise HTTPException(404,"Evaluación no encontrada")
    if db.query(models.AssessmentResult).filter_by(assessment_id=item_id).count(): obj.status="archived"
    else: db.delete(obj)
    audit(db,user,"delete_or_archive","assessment"); db.commit()

@app.get("/api/v1/enrollments")
def list_enrollments(user=Depends(current_user), db: Session=Depends(get_db)):
    return db.query(models.Enrollment).filter_by(organization_id=user.organization_id).order_by(models.Enrollment.enrolled_at.desc()).all()

@app.post("/api/v1/enrollments")
def enroll(data: EnrollmentIn, user=Depends(require_admin), db: Session=Depends(get_db)):
    student=db.query(models.Student).filter_by(id=data.student_id, organization_id=user.organization_id).first()
    course=db.query(models.Course).filter_by(id=data.course_id, organization_id=user.organization_id).first()
    if not student or not course: raise HTTPException(404,"Estudiante o curso no encontrado")
    if db.query(models.Enrollment).filter_by(student_id=data.student_id, course_id=data.course_id).first(): raise HTTPException(409,"El estudiante ya está matriculado en este curso")
    obj=models.Enrollment(organization_id=user.organization_id, **data.model_dump()); db.add(obj); audit(db,user,"enroll","enrollment"); db.commit(); db.refresh(obj); return obj

@app.patch("/api/v1/enrollments/{item_id}/status")
def update_enrollment_status(item_id: str, status_value: str, user=Depends(require_admin), db: Session=Depends(get_db)):
    if status_value not in ("active", "completed", "withdrawn"):
        raise HTTPException(400, "Estado no válido")
    obj=db.query(models.Enrollment).filter_by(id=item_id, organization_id=user.organization_id).first()
    if not obj: raise HTTPException(404, "Matrícula no encontrada")
    obj.status=status_value; audit(db,user,"update_status","enrollment"); db.commit(); db.refresh(obj); return obj

@app.get("/api/v1/results")
def list_results(user=Depends(current_user), db: Session=Depends(get_db)):
    return db.query(models.AssessmentResult).filter_by(organization_id=user.organization_id).order_by(models.AssessmentResult.graded_at.desc()).all()

@app.post("/api/v1/results")
def create_result(data: GradeIn, user=Depends(current_user), db: Session=Depends(get_db)):
    assessment=db.query(models.Assessment).filter_by(id=data.assessment_id, organization_id=user.organization_id).first()
    student=db.query(models.Student).filter_by(id=data.student_id, organization_id=user.organization_id).first()
    if not assessment or not student: raise HTTPException(404,"Evaluación o estudiante no encontrado")
    if data.score > assessment.max_score: raise HTTPException(400,"La nota supera el puntaje máximo")
    obj=models.AssessmentResult(organization_id=user.organization_id, **data.model_dump()); db.add(obj); audit(db,user,"grade","assessment_result"); db.commit(); db.refresh(obj); return obj

@app.get("/api/v1/learning-paths")
def list_paths(user=Depends(current_user), db: Session=Depends(get_db)):
    return db.query(models.LearningPath).filter_by(organization_id=user.organization_id).order_by(models.LearningPath.created_at.desc()).all()

@app.post("/api/v1/learning-paths")
def create_path(data: PathIn, user=Depends(require_admin), db: Session=Depends(get_db)):
    obj=models.LearningPath(organization_id=user.organization_id, **data.model_dump()); db.add(obj); audit(db,user,"create","learning_path"); db.commit(); db.refresh(obj); return obj

@app.put("/api/v1/learning-paths/{item_id}")
def update_path(item_id: str, data: PathIn, user=Depends(require_admin), db: Session=Depends(get_db)):
    obj=db.query(models.LearningPath).filter_by(id=item_id, organization_id=user.organization_id).first()
    if not obj: raise HTTPException(404,"Ruta no encontrada")
    for k,v in data.model_dump().items(): setattr(obj,k,v)
    audit(db,user,"update","learning_path"); db.commit(); db.refresh(obj); return obj

@app.delete("/api/v1/learning-paths/{item_id}", status_code=204)
def delete_path(item_id: str, user=Depends(require_admin), db: Session=Depends(get_db)):
    obj=db.query(models.LearningPath).filter_by(id=item_id, organization_id=user.organization_id).first()
    if not obj: raise HTTPException(404,"Ruta no encontrada")
    db.delete(obj); audit(db,user,"delete","learning_path"); db.commit()

@app.post("/api/v1/recommendations")
def create_recommendation(data: RecommendationIn, user=Depends(current_user), db: Session=Depends(get_db)):
    if not db.query(models.Student).filter_by(id=data.student_id, organization_id=user.organization_id).first(): raise HTTPException(404,"Estudiante no encontrado")
    obj=models.Recommendation(organization_id=user.organization_id, student_id=data.student_id, title=data.title, rationale=data.rationale, source="manual_review")
    db.add(obj); audit(db,user,"create","recommendation"); db.commit(); db.refresh(obj); return obj

@app.patch("/api/v1/recommendations/{item_id}")
def update_recommendation(item_id: str, data: schemas.RecommendationFeedback, user=Depends(current_user), db: Session=Depends(get_db)):
    if data.status not in ("pending","accepted","dismissed","completed"): raise HTTPException(400,"Estado no válido")
    obj=db.query(models.Recommendation).filter_by(id=item_id, organization_id=user.organization_id).first()
    if not obj: raise HTTPException(404,"Recomendación no encontrada")
    obj.status=data.status; audit(db,user,"update_status","recommendation"); db.commit(); db.refresh(obj); return obj

@app.get("/api/v1/certificates")
def list_certificates(user=Depends(current_user), db: Session=Depends(get_db)):
    return db.query(models.Certificate).filter_by(organization_id=user.organization_id).order_by(models.Certificate.issued_at.desc()).all()

@app.post("/api/v1/certificates")
def issue_certificate(data: CertificateIn, user=Depends(require_admin), db: Session=Depends(get_db)):
    student=db.query(models.Student).filter_by(id=data.student_id, organization_id=user.organization_id).first()
    course=db.query(models.Course).filter_by(id=data.course_id, organization_id=user.organization_id).first()
    if not student or not course: raise HTTPException(404,"Estudiante o curso no encontrado")
    if not db.query(models.Enrollment).filter_by(student_id=data.student_id, course_id=data.course_id, status="completed").first(): raise HTTPException(400,"La matrícula debe estar completada para emitir el certificado")
    code="EM-"+uuid.uuid4().hex[:12].upper()
    obj=models.Certificate(organization_id=user.organization_id, student_id=data.student_id, course_id=data.course_id, certificate_code=code)
    db.add(obj); audit(db,user,"issue","certificate"); db.commit(); db.refresh(obj); return obj

@app.get("/api/v1/certificates/verify/{certificate_code}")
def verify_certificate(certificate_code: str, db: Session=Depends(get_db)):
    obj=db.query(models.Certificate).filter_by(certificate_code=certificate_code, status="issued").first()
    if not obj: raise HTTPException(404,"Certificado no válido")
    student=db.query(models.Student).filter_by(id=obj.student_id).first(); course=db.query(models.Course).filter_by(id=obj.course_id).first()
    return {"valid":True,"certificate_code":obj.certificate_code,"student_name":student.full_name,"course_title":course.title,"issued_at":obj.issued_at}

@app.get("/api/v1/notifications")
def list_notifications(user=Depends(current_user), db: Session=Depends(get_db)):
    return db.query(models.Notification).filter(models.Notification.organization_id==user.organization_id, (models.Notification.user_id==None) | (models.Notification.user_id==user.id)).order_by(models.Notification.created_at.desc()).limit(100).all()

@app.post("/api/v1/notifications")
def create_notification(data: NotificationIn, user=Depends(require_admin), db: Session=Depends(get_db)):
    if data.user_id and not db.query(models.User).filter_by(id=data.user_id, organization_id=user.organization_id).first(): raise HTTPException(404,"Usuario no encontrado")
    obj=models.Notification(organization_id=user.organization_id, **data.model_dump()); db.add(obj); audit(db,user,"create","notification"); db.commit(); db.refresh(obj); return obj

@app.patch("/api/v1/notifications/{item_id}/read")
def read_notification(item_id: str, user=Depends(current_user), db: Session=Depends(get_db)):
    obj=db.query(models.Notification).filter(models.Notification.id==item_id, models.Notification.organization_id==user.organization_id, (models.Notification.user_id==None) | (models.Notification.user_id==user.id)).first()
    if not obj: raise HTTPException(404,"Notificación no encontrada")
    obj.read_at=datetime.now(timezone.utc); db.commit(); return {"ok":True}

@app.get("/api/v1/users")
def list_users(user=Depends(require_admin), db: Session=Depends(get_db)):
    return [{"id":x.id,"full_name":x.full_name,"email":x.email,"role":x.role,"is_active":x.is_active,"created_at":x.created_at} for x in db.query(models.User).filter_by(organization_id=user.organization_id).order_by(models.User.full_name).all()]

@app.post("/api/v1/users")
def create_user(data: UserCreateIn, user=Depends(require_admin), db: Session=Depends(get_db)):
    allowed={"institution_admin","director","teacher","student","analyst"}
    if data.role not in allowed: raise HTTPException(400,"Rol no permitido")
    email=data.email.strip().lower()
    if db.query(models.User).filter_by(email=email).first(): raise HTTPException(409,"El correo ya está registrado")
    obj=models.User(organization_id=user.organization_id, full_name=data.full_name, email=email, password_hash=hash_password(data.password), role=data.role)
    db.add(obj); audit(db,user,"create","user"); db.commit(); db.refresh(obj); return {"id":obj.id,"full_name":obj.full_name,"email":obj.email,"role":obj.role}

@app.patch("/api/v1/users/{item_id}/status")
def set_user_status(item_id: str, active: bool, user=Depends(require_admin), db: Session=Depends(get_db)):
    obj=db.query(models.User).filter_by(id=item_id, organization_id=user.organization_id).first()
    if not obj: raise HTTPException(404,"Usuario no encontrado")
    if obj.id==user.id and not active: raise HTTPException(400,"No puedes desactivar tu propia cuenta")
    obj.is_active=active; audit(db,user,"change_status","user"); db.commit(); return {"ok":True,"is_active":obj.is_active}


# ---------------- Laboratorio ML: datasets y redes neuronales entrenables ----------------
ML_ROOT = Path(os.getenv("ML_STORAGE", "./storage/ml"))
ML_ROOT.mkdir(parents=True, exist_ok=True)

def org_ml_dir(org_id: str) -> Path:
    p = ML_ROOT / org_id
    p.mkdir(parents=True, exist_ok=True)
    return p

def read_json(path: Path, default):
    try: return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError): return default

def write_json(path: Path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

@app.get("/api/v1/ml/datasets")
def list_ml_datasets(user=Depends(current_user)):
    """Lista los datasets de la organización e importa el CSV de ejemplo
    incluido en examples/ la primera vez que se consulta este endpoint.
    """
    root = org_ml_dir(user.organization_id)
    registry = root / "datasets.json"
    datasets = read_json(registry, [])
    if not isinstance(datasets, list):
        datasets = []

    demo_name = "dataset_estudiantes_demo.csv"
    project_root = Path(__file__).resolve().parents[2]
    demo_csv = project_root / "examples" / demo_name

    # Evita registrar el dataset de ejemplo más de una vez.
    already_registered = any(
        isinstance(item, dict) and item.get("filename") == demo_name
        for item in datasets
    )

    if demo_csv.is_file() and not already_registered:
        try:
            df = pd.read_csv(demo_csv)
            if df.empty or len(df.columns) < 2:
                raise ValueError("El CSV debe contener filas y al menos dos columnas")
            if len(df) < 20:
                raise ValueError("El CSV debe contener al menos 20 filas")

            df.columns = [str(column).strip() for column in df.columns]
            if any(not column for column in df.columns) or len(set(df.columns)) != len(df.columns):
                raise ValueError("Los nombres de columnas deben ser únicos y no estar vacíos")

            dataset_id = str(uuid.uuid4())
            stored_filename = f"{dataset_id}.csv"
            raw = demo_csv.read_bytes()
            (root / stored_filename).write_bytes(raw)

            profiles = {}
            for column in df.columns:
                series = df[column]
                profiles[str(column)] = {
                    "dtype": str(series.dtype),
                    "unique_count": int(series.nunique(dropna=True)),
                    "missing": int(series.isna().sum()),
                    "examples": [
                        str(value)[:80]
                        for value in series.dropna().astype(str).unique()[:5].tolist()
                    ],
                }

            sample = []
            for _, row in df.head(8).iterrows():
                record = {}
                for column, value in row.items():
                    if pd.isna(value):
                        record[str(column)] = None
                    elif hasattr(value, "item"):
                        record[str(column)] = value.item()
                    else:
                        record[str(column)] = value
                sample.append(record)

            info = {
                "id": dataset_id,
                "filename": demo_name,
                "stored_file": stored_filename,
                "rows": int(len(df)),
                "columns": list(df.columns),
                "missing": int(df.isna().sum().sum()),
                "profiles": profiles,
                "sample": sample,
                "uploaded_at": datetime.now(timezone.utc).isoformat(),
            }
            datasets.insert(0, info)
            write_json(registry, datasets)
        except Exception as exc:
            # No se interrumpe la consulta de datasets por un CSV de ejemplo
            # ausente o inválido; el error queda disponible en el log del backend.
            print(f"[ML] No se pudo importar {demo_name}: {exc}")

    return datasets

@app.post("/api/v1/ml/datasets")
async def upload_ml_dataset(file: UploadFile = File(...), user=Depends(current_user)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Solo se permiten archivos CSV")
    root = org_ml_dir(user.organization_id)
    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(413, "El CSV supera el límite de 10 MB")
    try:
        import io
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as exc:
        raise HTTPException(400, f"No se pudo leer el CSV: {exc}")
    if df.empty or len(df.columns) < 2:
        raise HTTPException(400, "El CSV debe tener filas y al menos dos columnas")
    if len(df) < 20:
        raise HTTPException(400, "Se requieren al menos 20 filas para entrenar y evaluar")
    df.columns = [str(c).strip() for c in df.columns]
    if any(not c for c in df.columns) or len(set(df.columns)) != len(df.columns):
        raise HTTPException(400, "Los nombres de columnas deben ser únicos y no estar vacíos")
    did = str(uuid.uuid4())
    fname = f"{did}.csv"
    (root / fname).write_bytes(raw)
    profiles = {}
    for column in df.columns:
        series = df[column]
        examples = []
        for value in series.dropna().astype(str).unique()[:5].tolist():
            examples.append(value[:80])
        profiles[str(column)] = {
            "dtype": str(series.dtype),
            "unique_count": int(series.nunique(dropna=True)),
            "missing": int(series.isna().sum()),
            "examples": examples,
        }
    sample = []
    for _, row in df.head(8).iterrows():
        record = {}
        for column, value in row.items():
            if pd.isna(value):
                record[str(column)] = None
            elif hasattr(value, "item"):
                record[str(column)] = value.item()
            else:
                record[str(column)] = value
        sample.append(record)
    info = {"id": did, "filename": Path(file.filename).name, "stored_file": fname,
            "rows": int(len(df)), "columns": list(df.columns), "missing": int(df.isna().sum().sum()),
            "profiles": profiles, "sample": sample,
            "uploaded_at": datetime.now(timezone.utc).isoformat()}
    items = read_json(root / "datasets.json", [])
    items.insert(0, info); write_json(root / "datasets.json", items)
    return info

@app.post("/api/v1/ml/train")
def train_ml_network(dataset_id: str = Form(...), target: str = Form(...), hidden_layers: str = Form("64,32"),
                     activation: str = Form("relu"), max_iter: int = Form(150), test_size: float = Form(0.2),
                     user=Depends(current_user)):
    root = org_ml_dir(user.organization_id)
    datasets = read_json(root / "datasets.json", [])
    meta = next((x for x in datasets if x["id"] == dataset_id), None)
    if not meta: raise HTTPException(404, "Dataset no encontrado")
    if target not in meta["columns"]: raise HTTPException(400, "La columna objetivo no existe")
    if activation not in ("relu", "tanh", "logistic"): raise HTTPException(400, "Activación no permitida")
    try:
        layers = tuple(int(x.strip()) for x in hidden_layers.split(",") if x.strip())
        if not layers or len(layers) > 4 or any(x < 2 or x > 512 for x in layers): raise ValueError()
    except ValueError: raise HTTPException(400, "Capas inválidas. Ejemplo: 64,32")
    if not 30 <= max_iter <= 1000 or not 0.1 <= test_size <= 0.4:
        raise HTTPException(400, "Épocas debe estar entre 30 y 1000 y test_size entre 0.1 y 0.4")
    df = pd.read_csv(root / meta["stored_file"])
    df = df.replace([np.inf, -np.inf], np.nan).dropna(subset=[target])
    if len(df) < 20: raise HTTPException(400, "No hay suficientes filas con etiqueta objetivo válida")
    y_raw = df[target].astype(str)
    if y_raw.nunique() < 2 or y_raw.nunique() > 30:
        raise HTTPException(400, "Clasificación supervisada requiere entre 2 y 30 clases distintas")
    X = df.drop(columns=[target]).copy()
    if X.shape[1] == 0: raise HTTPException(400, "Se necesita al menos una característica de entrada")
    # Excluir columnas identificadoras típicas para reducir fuga de información.
    X = X.drop(columns=[c for c in X.columns if c.lower() in ("id", "email", "nombre", "name", "dni")], errors="ignore")
    if X.shape[1] == 0: raise HTTPException(400, "No quedan características utilizables tras excluir identificadores")
    numeric = X.select_dtypes(include=["number", "bool"]).columns.tolist()
    categorical = [c for c in X.columns if c not in numeric]
    transformers = []
    if numeric:
        transformers.append(("num", Pipeline([("imputer", SimpleImputer(strategy="median")), ("scale", StandardScaler())]), numeric))
    if categorical:
        transformers.append(("cat", Pipeline([("imputer", SimpleImputer(strategy="most_frequent")), ("onehot", OneHotEncoder(handle_unknown="ignore"))]), categorical))
    pre = ColumnTransformer(transformers)
    labeler = LabelEncoder(); y = labeler.fit_transform(y_raw)
    stratify = y if np.min(np.bincount(y)) >= 2 else None
    try:
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42, stratify=stratify)
    except ValueError as exc: raise HTTPException(400, f"No se pudo separar entrenamiento/prueba: {exc}")
    clf = MLPClassifier(hidden_layer_sizes=layers, activation=activation, solver="adam", max_iter=max_iter,
                        early_stopping=False, random_state=42, learning_rate_init=0.001)
    pipe = Pipeline([("preprocess", pre), ("network", clf)])
    try: pipe.fit(X_train, y_train)
    except Exception as exc: raise HTTPException(400, f"Falló el entrenamiento: {exc}")
    pred = pipe.predict(X_test)
    acc = float(accuracy_score(y_test, pred))
    precision, recall, f1, _ = precision_recall_fscore_support(y_test, pred, average="weighted", zero_division=0)
    cm = confusion_matrix(y_test, pred, labels=list(range(len(labeler.classes_)))).tolist()
    exp_id = str(uuid.uuid4())
    model_file = f"model_{exp_id}.joblib"
    bundle = {"pipeline": pipe, "labels": labeler.classes_.tolist(), "features": X.columns.tolist(),
              "target": target, "dataset_id": dataset_id, "architecture": layers, "activation": activation}
    joblib.dump(bundle, root / model_file)
    losses = [float(x) for x in getattr(clf, "loss_curve_", [])]
    experiment = {"id": exp_id, "dataset_id": dataset_id, "dataset_name": meta["filename"], "target": target,
      "rows_used": int(len(df)), "train_rows": int(len(X_train)), "test_rows": int(len(X_test)),
      "features": X.columns.tolist(), "classes": labeler.classes_.tolist(), "architecture": list(layers),
      "activation": activation, "epochs_completed": int(clf.n_iter_), "max_epochs": max_iter,
      "accuracy": acc, "precision_weighted": float(precision), "recall_weighted": float(recall), "f1_weighted": float(f1),
      "confusion_matrix": cm, "loss_curve": losses, "model_file": model_file,
      "created_at": datetime.now(timezone.utc).isoformat(), "status": "trained_not_approved",
      "note": "Evaluación holdout; no implica validación institucional ni aprobación para decisiones reales."}
    history = read_json(root / "experiments.json", []); history.insert(0, experiment); write_json(root / "experiments.json", history)
    return {k:v for k,v in experiment.items() if k != "model_file"}

@app.get("/api/v1/ml/experiments")
def list_ml_experiments(user=Depends(current_user)):
    return read_json(org_ml_dir(user.organization_id) / "experiments.json", [])

@app.post("/api/v1/ml/predict/{experiment_id}")
def predict_ml(experiment_id: str, payload: dict, user=Depends(current_user)):
    root = org_ml_dir(user.organization_id)
    exp = next((x for x in read_json(root / "experiments.json", []) if x["id"] == experiment_id), None)
    if not exp: raise HTTPException(404, "Experimento no encontrado")
    bundle = joblib.load(root / exp["model_file"])
    try:
        frame = pd.DataFrame([payload]).reindex(columns=bundle["features"])
        encoded = bundle["pipeline"].predict(frame)[0]
        probabilities = bundle["pipeline"].predict_proba(frame)[0].tolist()
        label = bundle["labels"][int(encoded)]
        return {"prediction": label, "probabilities": {str(k): float(v) for k,v in zip(bundle["labels"], probabilities)},
                "disclaimer": "Predicción experimental. No usar como calificación, sanción ni decisión automática."}
    except Exception as exc: raise HTTPException(400, f"No se pudo generar predicción: {exc}")
