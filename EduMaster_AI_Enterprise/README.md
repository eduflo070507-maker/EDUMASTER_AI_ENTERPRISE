# EduMaster.ai Enterprise — proyecto integrado para pruebas

Esta entrega parte desde cero y organiza el producto como **un solo sistema**: una interfaz web, una API, una base de datos compartida y módulos conectados. No son seis aplicaciones separadas.

## Ejecutar en Windows

1. Instala Docker Desktop y asegúrate de que la virtualización esté habilitada.
2. Descomprime el ZIP.
3. Entra a la carpeta `EduMaster_AI_Enterprise`.
4. Copia `.env.example` y nombra la copia `.env`.
5. Abre PowerShell o la terminal de VS Code en esa carpeta.
6. Ejecuta:

```powershell
docker compose up --build
```

7. Abre `http://localhost:5173`.

## Servicios

- Aplicación: http://localhost:5173
- API: http://localhost:8000
- Swagger/OpenAPI: http://localhost:8000/docs
- PostgreSQL: localhost:5432

## Acceso de demostración

- Usuario: `admin@edumaster.local`
- Contraseña: `EduMaster123!`

Cambia las credenciales y `SECRET_KEY` antes de publicar. No reutilices esta contraseña en producción.

## Qué contiene

- Frontend React + TypeScript + Vite con diseño oscuro empresarial.
- Backend FastAPI con autenticación JWT y autorización básica por rol.
- PostgreSQL con persistencia mediante volumen Docker.
- Datos iniciales de demostración identificados como DEMO.
- Módulos base: dashboard, estudiantes, cursos, evaluaciones, seguimiento/eventos, analítica, arquitectura neuronal, modelos, recomendaciones, certificaciones, auditoría y administración.
- API de consulta y registro para los módulos académicos implementados.
- Visualizador de **seis arquitecturas conceptuales**. Solo una se puede seleccionar/encender a la vez; al cambiar de red, la anterior se apaga. Se visualizan entradas, capas ocultas y salidas.
- Laboratorio ML integrado: carga CSV por institución, validación básica, selección de etiqueta, preprocesamiento numérico/categórico, MLP configurable, separación train/test, métricas, matriz de confusión, historial y predicción experimental.
- Persistencia de datasets, experimentos y artefactos en el volumen `edumaster_storage`.
- Dataset educativo sintético de ejemplo en `examples/dataset_estudiantes_demo.csv`.
- Documentación de arquitectura, límites y checklist de producción.

## Importante: qué significa “completo” en esta entrega

Este ZIP es una **base integral ejecutable para probar y continuar el desarrollo**, no un producto enterprise certificado ni listo para producción. Algunos módulos académicos y empresariales siguen siendo base funcional o pantallas informativas y requieren completar procesos, formularios y reglas antes de uso institucional. La interfaz neuronal muestra topologías conceptuales; no significa que seis modelos estén entrenándose. El script PyTorch genera datos sintéticos solo para probar el entrenamiento; sus métricas no son evidencia de capacidad predictiva educativa.

Para validar IA con estudiantes se necesitan datos históricos autorizados, etiquetas definidas, minimización/seudonimización, revisión legal, separación temporal train/validation/test, comparación contra baselines, calibración, análisis de sesgo por cohortes, aprobación humana y monitoreo. Ninguna predicción debe reemplazar una calificación oficial ni justificar sanciones o exclusiones.

## Laboratorio de redes neuronales

1. Inicia sesión y abre **Laboratorio ML** en el menú lateral.
2. Carga `examples/dataset_estudiantes_demo.csv` (o un CSV propio con al menos 20 filas y dos columnas).
3. Selecciona `completion_status` como columna objetivo.
4. Configura las capas ocultas, por ejemplo `64,32`, la activación y las épocas (30–1000).
5. Ejecuta el entrenamiento. Se guardan el experimento y el modelo por organización.

El laboratorio usa un MLP de clasificación de scikit-learn. El pipeline imputa valores faltantes, escala variables numéricas y codifica variables categóricas. Presenta Accuracy, precisión, recall, F1 y matriz de confusión en una partición holdout. No incluye aún validación cruzada, búsqueda automática de hiperparámetros, calibración, explicabilidad ni aprobación productiva. La predicción es experimental y no debe usarse para calificar, sancionar o excluir estudiantes.

El backend limita CSV a 10 MB y 20 filas como mínimo. Para entrenar se requiere una columna objetivo con 2–30 clases y al menos una característica utilizable. Los identificadores típicos (`id`, `email`, `nombre`, `name`, `dni`) se excluyen automáticamente.

## Probar entrenamiento de demostración (opcional)

En un entorno Python separado:

```powershell
cd ml
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python train_demo.py --epochs 30
```

Se genera `ml/artifacts/` con checkpoint, scaler y métricas DEMO.

## Reiniciar base de datos

`docker compose down -v` elimina el volumen PostgreSQL y todos los registros. Es destructivo; úsalo solo si quieres reiniciar la demo.

## Antes de producción

Revisar `docs/PLAN_PRODUCCION.md`. Entre otros pendientes: migraciones Alembic, ABAC granular por institución/curso/grupo, pruebas de aislamiento multi-tenant, CRUD y validaciones de todos los dominios, colas/Outbox, realtime autorizado, archivos y certificados PDF/QR, MLflow/DVC, monitoreo, backups y restore probado, pruebas de seguridad/carga y revisión de privacidad.
