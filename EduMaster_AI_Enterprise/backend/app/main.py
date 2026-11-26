import os, uuid, json, shutil
from pathlib import Path
from datetime import datetime, timezone
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
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import func
from .database import Base, engine, get_db, SessionLocal
from . import models, schemas
from .security import hash_password, verify_password, create_token, decode_token

Base.metadata.create_all(bind=engine)
app = FastAPI(title="EduMaster.ai Enterprise API", version="1.0.0", description="API inicial integrada de EduMaster.ai")

# ---------------- Configuración CORS ----------------

default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://edumaster-ai-enterprise-1c9x34fzh-eduardo-8949.vercel.app",
    "https://edumaster-ai-enterprise-six.vercel.app",
]

env_origins = os.getenv("CORS_ORIGINS", "")

origins = [
    origin.strip().rstrip("/")
    for origin in env_origins.split(",")
    if origin.strip()
]

# Mantener los orígenes de producción y desarrollo autorizados
origins = list(set(default_origins + origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def seed():
    db = SessionLocal()
    try:
        org = db.query(models.Organization).filter_by(code="DEMO").first()
        if not org:
            org = models.Organization(name="Institución EduMaster DEMO", code="DEMO")
            db.add(org); db.flush()
        admin = db.query(models.User).filter_by(email="admin@edumaster.ai").first()
        if not admin:
            db.add(models.User(organization_id=org.id, full_name="Administrador DEMO",
                email="admin@edumaster.ai", password_hash=hash_password("EduMaster123!"), role="superadmin"))
        if db.query(models.Course).count() == 0:
            db.add_all([
                models.Course(organization_id=org.id, code="MAT-101", title="Matemática aplicada", description="Fundamentos y resolución de problemas.", level="Básico"),
                models.Course(organization_id=org.id, code="PROG-201", title="Programación", description="Pensamiento computacional y desarrollo.", level="Intermedio"),
                models.Course(organization_id=org.id, code="DAT-301", title="Analítica de datos", description="Datos, métricas y modelos.", level="Avanzado")
            ])
        if db.query(models.Student).count() == 0:
            db.add_all([
                models.Student(organization_id=org.id, student_code="EST-001", full_name="Ana Torres", email="ana.demo@edumaster.local"),
                models.Student(organization_id=org.id, student_code="EST-002", full_name="Luis Mendoza", email="luis.demo@edumaster.local"),
                models.Student(organization_id=org.id, student_code="EST-003", full_name="Camila Rojas", email="camila.demo@edumaster.local")
            ])
        if db.query(models.ModelVersion).count() == 0:
            db.add(models.ModelVersion(name="EduMaster Multi-Task Learning Network", description="Ficha DEMO de arquitectura. Aún no entrenada ni aprobada."))
        db.commit()
    finally:
        db.close()
seed()

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
    return {"status":"ok","service":"edumaster-api","mode":"local-demo"}

@app.post("/api/v1/auth/login")
def login(data: schemas.LoginIn, db: Session = Depends(get_db)):
    user = db.query(models.User).filter_by(email=data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuario inactivo")
    return {"access_token": create_token(user.email, user.role), "token_type":"bearer",
            "user":{"id":user.id,"full_name":user.full_name,"email":user.email,"role":user.role}}

@app.get("/api/v1/auth/me")
def me(user=Depends(current_user)):
    return {"id":user.id,"full_name":user.full_name,"email":user.email,"role":user.role}

@app.get("/api/v1/dashboard/summary")
def dashboard(user=Depends(current_user), db: Session = Depends(get_db)):
    org = user.organization_id
    return {
        "students": db.query(models.Student).filter_by(organization_id=org).count(),
        "courses": db.query(models.Course).filter_by(organization_id=org).count(),
        "assessments": db.query(models.Assessment).filter_by(organization_id=org).count(),
        "learning_events": db.query(models.LearningEvent).filter_by(organization_id=org).count(),
        "recommendations": db.query(models.Recommendation).filter_by(organization_id=org).count(),
        "ai_status":"DEMO - modelo no aprobado"
    }

@app.get("/api/v1/students")
def list_students(user=Depends(current_user), db: Session=Depends(get_db)):
    return db.query(models.Student).filter_by(organization_id=user.organization_id).order_by(models.Student.full_name).all()

@app.post("/api/v1/students")
def create_student(data: schemas.StudentIn, user=Depends(require_admin), db: Session=Depends(get_db)):
    if db.query(models.Student).filter_by(student_code=data.student_code).first():
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
    return db.query(models.ModelVersion).all()

@app.get("/api/v1/audit-logs")
def audit_logs(user=Depends(require_admin), db: Session=Depends(get_db)):
    return db.query(models.AuditLog).filter_by(organization_id=user.organization_id).order_by(models.AuditLog.occurred_at.desc()).limit(100).all()


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
    return read_json(org_ml_dir(user.organization_id) / "datasets.json", [])

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
    info = {"id": did, "filename": Path(file.filename).name, "stored_file": fname,
            "rows": int(len(df)), "columns": list(df.columns), "missing": int(df.isna().sum().sum()),
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
