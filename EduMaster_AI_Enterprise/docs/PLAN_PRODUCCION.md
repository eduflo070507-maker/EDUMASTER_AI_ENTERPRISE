# Checklist de aceptación y paso a producción

## Producto académico
- [ ] Completar entidades de institución, usuarios, docentes, estudiantes, cursos, ofertas, cohortes, matrículas y rutas.
- [ ] Completar contenidos, actividades, banco de preguntas, rúbricas, intentos, ponderaciones y retroalimentación.
- [ ] Vincular actividades con competencias y evidencias; diferenciar nivel estimado por IA de nivel validado por docente.
- [ ] Implementar criterios de finalización y certificados PDF/QR con verificación pública de datos mínimos.
- [ ] Implementar comunidad, moderación, notificaciones y preferencias.

## Seguridad y datos
- [ ] RBAC y ABAC en backend por institución, curso, grupo y propiedad.
- [ ] Pruebas de aislamiento horizontal/vertical entre instituciones.
- [ ] Migraciones Alembic, restricciones, índices y transacciones.
- [ ] Política de retención, consentimiento/base legal, seudonimización y minimización.
- [ ] Rate limiting, rotación de secretos, HTTPS, escaneo de dependencias y archivos.

## Datos y ML
- [ ] Dataset versionado, esquema, checksum, linaje y control de calidad.
- [ ] Definir operativamente las etiquetas y ventanas de predicción.
- [ ] Evitar data leakage con particiones temporales y/o por estudiante/cohorte.
- [ ] Comparar modelos interpretables antes de aprobar redes neuronales.
- [ ] Medir ROC-AUC, PR-AUC, F1/recall, Brier/calibración, métricas por segmento y estabilidad.
- [ ] Integrar MLflow/DVC, aprobación, staging/shadow/canary, rollback y monitoreo de drift.
- [ ] No entrenar automáticamente en producción ni automatizar sanciones/calificaciones.

## Operación
- [ ] Outbox + Redis/workers para ETL, reportes y entrenamiento asíncrono.
- [ ] WebSocket/SSE con autorización de suscriptores y reconexión.
- [ ] Logs, métricas, trazas y alertas.
- [ ] Backups automáticos y restauración ensayada; RPO/RTO aprobados.
- [ ] Pruebas unitarias, integración, contrato, E2E, seguridad, accesibilidad y carga.
- [ ] UAT institucional y aprobación formal.
