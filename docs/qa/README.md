# Calidad y evidencia

Esta portada inventaría los documentos de `docs/qa/`. Son baselines, auditorías,
matrices, planes y registros fechados: describen evidencia o trabajo pendiente,
pero no reemplazan contratos ejecutables, ADR aceptados ni la arquitectura
canónica. Vuelva al [índice general](../README.md) para consultar la precedencia.

## Baselines y operación del repositorio

- [Baseline canónico de deuda](deuda-baseline.md): punto de comparación definido
  para las auditorías periódicas; no equivale a una medición en vivo.
- [Snapshot detallado de deuda de Monitoreo](deuda-monitoreo.md): medición fechada
  que complementa el baseline.
- [Escalabilidad arquitectónica — corte 2026-07-29](escalabilidad-arquitectonica-2026-07-29.md):
  matriz de capacidad local, límites observados y gate propuesto.
- [Plan de mejoras de julio de 2026](plan-mejoras-2026-07.md): plan derivado de la
  auditoría integral; no es autoridad normativa.
- [Rollout del agentic OS](agentic-os-rollout-2026-07-19.md): estado y evidencia
  del despliegue agentic.
- [Lecciones operativas de revamps visuales](revamps-visuales-lecciones-operativas-2026-07-26.md):
  patrones extraídos de iteraciones visuales.
- [Prompt de validación visual de referencia](prompt-validacion-visual-referencia.md):
  guía reutilizable para una revisión, no resultado de verificación.
- [Auditoría metodológica de cursos y horarios](auditoria-interventor-cursos-horario-2026-07-13.md):
  informe fechado con evidencia externa al repositorio.

## Carga y procesamiento multibase

- [Preflight lógico de ACRDConta](carga/acrdconta_preflight_logica.md).
- [Checklist de revisión lógica de ACRDConta](carga/acrdconta_revision_logica_checklist.md).
- [Plan Editor–Monitoreo–Procesamiento para acreditación](carga/acreditacion_editor_monitoreo_procesamiento_plan.md).
- [Procesamiento multibase de acreditación](carga/acreditacion_multibase_processing.md).
- [Arquitectura del revamp de Carga](carga/carga-revamp-arquitectura.md).

## Monitoreo

### Acreditación

- [Reconciliación con la base oficial ACRDConta](monitoreo/acrdconta_official_base_reconciliation_20260628.md).
- [Matriz del selector de canal](monitoreo/acreditacion_channel_selector_matrix.md).
- [Mapa de extracción](monitoreo/acreditacion_extraction_map.md).
- [Matriz de paridad](monitoreo/acreditacion_parity_matrix.md).
- [Auditoría de UI](monitoreo/acreditacion_ui_audit.md).
- [Auditoría profunda de UI](monitoreo/acreditacion_ui_deep_audit.md).
- [Matriz de paridad visual](monitoreo/acreditacion_visual_parity_matrix.md).

### Territorial y Aulas

- [Mapa de extracción territorial](monitoreo/territorial_extraction_map.md).
- [Matriz de paridad territorial](monitoreo/territorial_parity_matrix.md).
- [Limpieza visual Territorial–Telefónico](monitoreo/territorial_telefonico_visual_cleanup_20260726.md).
- [Auditoría visual exhaustiva](monitoreo/auditoria-visual-exhaustiva-2026-07-25.md).
- [Fase de avance y veracidad](monitoreo/fase-avance-y-veracidad-2026-07-25.md).
- [Reparación del handoff QR de Aulas](monitoreo/aulas_qr_handoff_repair.md).

### Entregables

- [Auditoría de entregables](monitoreo/monitoreo_deliverables_audit.md).
- [Auditoría de aceptación de entregables](monitoreo/monitoreo_deliverables_acceptance_audit.md).
- [Roadmap de entregables](monitoreo/monitoreo_deliverables_roadmap.md): plan de
  ejecución, no contrato de salida.
- [Matriz Sheets–PDF](monitoreo/monitoreo_sheets_pdf_matrix.md).

### Rendimiento e hidratación

- [Matriz de performance](monitoreo/monitoreo_performance_matrix.md).
- [Matriz de performance de hidratación](monitoreo/monitoreo_hydration_performance_matrix.md).
- [Auditoría de experiencia de carga](monitoreo/monitoreo_loading_experience_audit.md).
- [Plan de hidratación y performance](monitoreo/performance_hydration_plan.md):
  plan de mejora, no medición vigente por sí sola.

### Paridad, estructura y seguimiento transversal

- [Matriz de paridad de perfiles](monitoreo/monitoreo_profile_ui_parity_matrix.md).
- [Retiro del monolito de Monitoreo](monitoreo/monitoreo_monolith_retirement.md).
- [Goal loop de Monitoreo](monitoreo/goal-loop-monitoreo-2026-07-27.md).
- [Repaso de utilidad de ocurrencias](monitoreo/ocurrencias-repaso-utilidad-2026-07-26.md).

## Regla de lectura

Antes de reutilizar una cifra o conclusión, confirme la fecha, el proyecto de
referencia y el commit o estado de producto observado. Los archivos llamados
`plan`, `roadmap`, `prompt` o `goal-loop` orientan trabajo; no certifican que una
reparación esté implementada.
