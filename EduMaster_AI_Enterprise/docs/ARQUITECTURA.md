# Arquitectura integrada EduMaster.ai

```text
React + TypeScript + Vite
        | HTTPS / JSON / JWT
        v
FastAPI modular
  Identity & Access | Academic Core | Learning Tracking
  Analytics | Recommendation | Certification | Notification
  AI Platform metadata | Audit & Governance
        |
        v
PostgreSQL

Expansión desacoplada:
Redis + workers | PyTorch train/inference | MLflow + DVC
Object storage | OpenTelemetry + Prometheus/Grafana
```

La recomendación documental es iniciar como monolito modular con servicio ML separado, no crear microservicios para cada módulo desde el primer día. Cada entidad multiinstitución debe llevar `organization_id`; toda consulta debe aplicar aislamiento en backend. Los eventos deben tener ID único, timestamp UTC, tipo, organización, actor controlado, agregado y versión de esquema.

## Seis arquitecturas del visualizador

A) Finalización de cursos. B) Dominio de habilidades. C) Señal de desconexión para apoyo humano. D) Ranking de recomendaciones. E) Participación educativa. F) Red multitarea compartida.

El selector aplica exclusión mutua en la interfaz: una seleccionada, las demás apagadas. La animación representa topología, no ejecución real. El estado real de entrenamiento/inferencia debe venir de un servicio y mostrar versión de modelo, dataset, timestamp y métricas.
