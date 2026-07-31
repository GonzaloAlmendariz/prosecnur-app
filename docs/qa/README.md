# Calidad y evidencia

Esta portada inventaría los documentos de `docs/qa/`. Son baselines, auditorías,
matrices, planes y registros fechados: describen evidencia o trabajo pendiente,
pero no reemplazan contratos ejecutables, ADR aceptados ni la arquitectura
canónica. Vuelva al [índice general](../README.md) para consultar la precedencia.

## Vigentes

- [Baseline canónico de deuda](deuda-baseline.md): referencia comparativa para
  las auditorías periódicas.
- [Medición estructural de deuda de Monitoreo](deuda-monitoreo.md): corte
  detallado que complementa el baseline.
- [Escalabilidad arquitectónica — corte 2026-07-29](escalabilidad-arquitectonica-2026-07-29.md):
  evaluación de capacidad y límites del contrato local-first.
- [Auditoría de cumplimiento del ADR 0019](auditoria-adr-0019-cursos-horario-2026-07-30.md):
  contraste del perfil de cursos-horario contra su decisión y sus pruebas.
- [Lecciones operativas de revamps visuales](revamps-visuales-lecciones-operativas-2026-07-26.md):
  contrato complementario para validar reparaciones visuales.
- [Prompt de validación visual de referencia](prompt-validacion-visual-referencia.md):
  guía reutilizable; no es evidencia de una ejecución.

## En curso

- [Goal loop visual de toda la aplicación](goal-loop-visual-app-2026-07-30.md):
  órbita de los ocho módulos del proyecto y Enciclopedia como utilidad global.
- [Plan de mejoras de julio de 2026](plan-mejoras-2026-07.md): priorización
  operativa de deuda y calidad.
- [Estado del pulido estético de Monitoreo](pulido-monitoreo-estado.md):
  bitácora viva del recorrido de superficies.

## Reemplazados

- [Rollout del Agentic OS de 2026-07-19](agentic-os-rollout-2026-07-19.md),
  reemplazado por el [contrato vigente de Agentic OS](../agentic-os.md).
- [Auditoría integral del interventor por cursos-horario](auditoria-interventor-cursos-horario-2026-07-13.md),
  reemplazada por la auditoría del ADR 0019; conserva su evidencia histórica.

## Histórico

El [índice histórico de QA](historico/README.md) organiza treinta fuentes
fechadas en seis síntesis. Los originales permanecen enlazados desde allí para
trazabilidad, pero ya no forman parte de la navegación activa.

## Regla de lectura

Cada documento activo declara `Tipo`, `Estado`, `Fecha` y `Autoridad`. Antes de
reutilizar una cifra o conclusión, confirme el corte observado y ejecute el gate
vigente. `Plan`, `Prompt`, `Goal` y `Registro` orientan trabajo: no prueban que
una reparación esté implementada.
