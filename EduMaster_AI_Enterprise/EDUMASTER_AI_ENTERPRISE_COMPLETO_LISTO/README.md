# EduMaster.ai Enterprise — versión integrada

Esta versión conserva tu proyecto y sus datos; incluye correcciones para el esquema PostgreSQL existente y un panel analítico conectado a registros académicos reales.

## Estructura
- `frontend/`: React + TypeScript + Vite.
- `backend/`: FastAPI + SQLAlchemy + PostgreSQL/SQLite.
- `examples/`: CSV de ejemplo para el laboratorio ML.
- `docs/`: arquitectura y plan de producción.

## Despliegue actual (Vercel + Render)

### 1. Backend en Render
- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Variables necesarias:
  - `DATABASE_URL`: URL PostgreSQL de Render.
  - `CORS_ORIGINS`: URL del frontend Vercel (sin barra final).
  - `SECRET_KEY`: cadena aleatoria larga y privada.
- No borres ni recrees la base de datos. Al iniciar, el backend agrega de forma no destructiva columnas faltantes:
  - `model_versions.organization_id`
  - `students.district`, `students.latitude`, `students.longitude`

### 2. Frontend en Vercel
- Root Directory: `frontend`
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Variable de entorno:
  - `VITE_API_URL`: URL pública del backend Render, por ejemplo `https://TU-API.onrender.com`.

Después de cambiar variables, vuelve a desplegar ambos servicios. El archivo `vercel.json` incluye fallback para rutas del frontend.

## Ejecución local en Windows

Requiere Node.js 20+ y Python 3.11+.

Backend (terminal 1):
```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:DATABASE_URL="sqlite:///./edumaster_local.db"
$env:SECRET_KEY="cambia-esta-clave-local-por-una-larga"
uvicorn app.main:app --reload --port 8000
```

Frontend (terminal 2):
```powershell
cd frontend
npm install
$env:VITE_API_URL="http://localhost:8000"
npm run dev
```
Abrir `http://localhost:5173`. La API y documentación se encuentran en `http://localhost:8000` y `/docs`.

## Panel y módulos

- Resumen: indicadores institucionales, evolución mensual de notas, desempeño por curso, mapa de ubicaciones registradas, recomendaciones y actividad reciente.
- Estudiantes: alta, edición y baja lógica; permite registrar distrito y coordenadas opcionales para el mapa.
- Cursos, evaluaciones, matrículas y rutas formativas.
- Seguimiento de eventos de aprendizaje.
- Analítica basada en resultados, matrículas y eventos existentes.
- Arquitecturas neuronales conceptuales.
- Dataset y modelos; laboratorio ML para cargar CSV, entrenar y revisar métricas.
- Recomendaciones, certificados, auditoría y administración según permisos.

## Importante sobre datos e IA

- Los gráficos no inventan registros: si no existen notas, matrículas, ubicaciones o recomendaciones, la pantalla informa que faltan datos.
- El mapa solo coloca estudiantes que tengan latitud y longitud registradas. La aplicación no obtiene ubicación GPS automáticamente.
- El desempeño por curso se calcula con notas registradas. No equivale a dominio de habilidades; para eso falta definir competencias y rúbricas institucionales.
- El laboratorio ML utiliza el CSV cargado por el usuario y no inserta sus filas en las tablas académicas. Entrenar un modelo no llena automáticamente el dashboard.
- Las arquitecturas de la sección IA son visualizaciones conceptuales; no representan modelos en producción.
- Los resultados de ML son experimentales y requieren validación institucional, revisión de sesgos y aprobación humana antes de cualquier uso educativo.
- Los datos iniciales no se crean automáticamente. Registra estudiantes, cursos, matrículas, evaluaciones y notas para ver indicadores reales.

## Seguridad y producción

- Configura una `SECRET_KEY` segura y credenciales privadas. No subas archivos `.env` al repositorio.
- Si `ADMIN_RECOVERY_KEY` fue configurada solo para recuperar el administrador, elimínala de Render una vez terminada la recuperación.
- Realiza backups de PostgreSQL antes de desplegar cambios.
- Esta entrega mejora la integración y corrige las columnas señaladas, pero no debe describirse como sistema certificado. Requiere pruebas institucionales, revisión de permisos, privacidad y recuperación de backups antes de uso productivo.
