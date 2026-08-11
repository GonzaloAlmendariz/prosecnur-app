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
- [Calidad estadística del Cálculo de muestra](calidad-estadistica-calc-muestra-2026-08-07.md):
  auditoría de tres lentes del eje estadístico de aulas y su reparación.

## En curso

- [Goal loop de Cálculo de muestra](goal-loop-calc-muestra-2026-07-31.md):
  selector con evidencia estadística, revamp de Aulas y ledger de iteraciones.
- [Goal loop visual de toda la aplicación](goal-loop-visual-app-2026-07-30.md):
  órbita de los ocho módulos del proyecto y Enciclopedia como utilidad global.
- [Plan de mejoras de julio de 2026](plan-mejoras-2026-07.md): priorización
  operativa de deuda y calidad.
- [Roadmap del motor de Gráficos](roadmap-motor-graficos-2026-08-08.md): deuda
  medida del motor y catálogo de tipos de gráfico pendientes, en cuatro olas.
- [Estado del pulido estético de Monitoreo](pulido-monitoreo-estado.md):
  bitácora viva del recorrido de superficies.
- [Goal loop visual de Selección](goal-loop-seleccion-visual-2026-08-09.md):
  Selección alcanza la vara visual de Cálculo y Marco, superficie por superficie.
- [Registro del motor de Gráficos](registro-motor-graficos-2026-08-10.md):
  qué está reparado, qué sigue roto y qué del deck 2021 llega al usuario.
- [Validación contra el deck de acreditación 2021](validacion-deck-acreditacion-2021.md):
  medición del motor contra una vara externa, lámina por lámina.

## Reemplazados

- [Goal loop de las bibliotecas de Gráficos](goal-loop-popovers-graficos-2026-08-07.md),
  consolidado en el [ADR 0068](../adrs/0068-la-composicion-de-slides-tiene-una-sola-autoridad.md);
  su [prompt de arranque](prompt-goal-loop-popovers-graficos.md) sigue siendo reutilizable.
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
