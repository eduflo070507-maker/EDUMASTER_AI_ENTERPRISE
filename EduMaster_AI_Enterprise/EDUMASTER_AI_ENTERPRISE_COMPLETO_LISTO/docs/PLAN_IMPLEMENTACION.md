# Plan de implementación posterior

1. Endurecer Identity & Access: permisos granulares, invitaciones, recuperación y políticas de sesión.
2. Completar Academic Core: docentes, cohortes, matrículas, contenidos, entregas y rúbricas.
3. Completar Learning Tracking: contrato de eventos versionado, idempotencia, Outbox y SSE/WebSocket.
4. Analytics: agregados materializados, filtros por rol/periodo/curso e informes.
5. DataOps: ingesta, validación, deduplicación, seudonimización, etiquetas, partición temporal, checksum y datasheet.
6. ML: baselines, PyTorch multitarea, MLflow, evaluación, aprobación, staging/shadow, canary, monitoreo y rollback.
7. Recommendation: reglas de negocio, feedback, explicación y revisión docente.
8. Certification: criterios oficiales, folio, PDF, QR, revocación y verificación pública mínima.
9. Operación: Redis/worker, almacenamiento de objetos, backups/restauración, OpenTelemetry, Prometheus/Grafana, CI/CD.
10. Pruebas: unitarias, integración, E2E, seguridad, aislamiento multiinstitución, rendimiento y reproducibilidad ML.
