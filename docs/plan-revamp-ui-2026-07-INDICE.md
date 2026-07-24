# UI v3 — Índice del contrato vigente (punto de entrada único)

Este archivo es el **punto de entrada estable** del bucle de convergencia UI v3. Cualquier
agente que ejecute el plan lee PRIMERO este índice en cada iteración: aquí se registra qué
documentos componen el contrato y en qué orden de precedencia. Las indicaciones nuevas del
dueño se agregan como filas — el plan base NO se edita para agregarlas.

## Documentos del contrato (orden de precedencia: el más abajo manda sobre el más arriba)

| # | Documento | Rol | Estado |
|---|---|---|---|
| 1 | `docs/plan-revamp-ui-2026-07.md` | Plan base v2.0 (fases, diagnóstico, loop §12) | Vigente |
| 2 | `docs/plan-revamp-ui-2026-07-indicacion-2.md` | Indicación 2: implicancias del sidebar por clase de ventana, evidencia en vivo, orden de migración | Vigente |
| 3 | `docs/plan-revamp-ui-2026-07-guia-sidebar.md` | Guía creativa del shell: resolución de la "L" (source list full-height), anatomía 248/64, switcher + gestor de módulos, contrato anti-deformación, gate "se ve perfecto" | Vigente |

## Arbitrajes activos (resoluciones de conflicto entre documentos)

- **StageStepper vs sidebar** (guía §7b, 2026-07-23): en v3 el recorrido vive SOLO en el
  sidebar — el sidebar ES el stepper (numeración + badges + candados). El §3.3/§4.2 del plan
  base ("stepper dentro del canvas con labels visibles") queda **superseded** como estado
  final; solo es admisible como mejora interina de la v2, marcada para morir en la Fase 1,
  sin API nueva. La decisión interino-sí/interino-no es del dueño.
- **Anatomía del sidebar**: donde el plan base (§3.1: 224px/56px, header adelgazado) y la
  guía (248px/64px, columna full-height dueña de la esquina, toolbar pertenece al lienzo)
  difieran, **manda la guía** — son la misma dirección con métricas y resolución de esquina
  refinadas; el ADR de §4.5 fija los números finales.

## Reglas del índice

1. Indicación nueva del dueño ⇒ fila nueva acá (mismo commit que el documento).
2. Conflicto entre documentos ⇒ arbitraje explícito acá; nada queda implícito.
3. El plan base conserva su hash salvo que el dueño pida editarlo directamente.
4. Los gates y reglas duras del plan base (§13) aplican SIEMPRE, sin importar qué documento
   mande en lo visual.
