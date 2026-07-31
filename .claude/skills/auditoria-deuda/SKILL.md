---
name: auditoria-deuda
description: Auditoría periódica de deuda técnica de Prosecnur - mide los 8 ejes de deuda contra el baseline (docs/qa/deuda-baseline.md), reporta deltas y actualiza el baseline. Usar cuando el usuario pida "auditoría de deuda", "cómo va la deuda", "estado del código", o aproximadamente una vez al mes.
---

# Auditoría de deuda

Mide la deuda técnica contra `docs/qa/deuda-baseline.md` con comandos reproducibles, reporta la tendencia y actualiza el baseline.

## Flujo

1. **Lee el baseline actual**: `docs/qa/deuda-baseline.md` (fecha y valores de la última medición).
2. **Fija el contrato**: carga `orquestar-trabajo`; ejecuta
   `node scripts/debt-audit.mjs --check` para congelar el método versionado;
   declara tres líneas read-only con ejes disjuntos, evidencia requerida,
   exclusión de toda escritura y unión cuando las tres mediciones estén
   completas.
3. **Mide los 8 ejes**: lanza 2–3 agentes `auditor-deuda` en paralelo
   repartiendo los ejes (ej. uno con ejes 1–3 R, otro con 4–5 y 7 frontend,
   otro con 6 y 8). Cada carril parte del resultado de
   `node scripts/debt-audit.mjs --json` y sólo agrega inspección semántica o
   comparabilidad histórica; no sustituye silenciosamente sus patrones.
   Espera a todos; un fallo se reintenta o reasigna una vez. Alternativa: usa
   el workflow `auditoria-deuda`, que aplica el mismo contrato.
4. **Sintetiza el reporte** para el usuario:
   - Tabla eje → baseline → hoy → Δ → veredicto (MEJORÓ / ESTABLE / EMPEORÓ).
   - Los 3 movimientos más accionables, dimensionados (qué archivo, cuántas líneas, qué helper extraer).
   - Ejes en rojo sostenido (empeoraron 2 mediciones seguidas) se marcan como candidatos a scope lock inmediato.
5. **Actualiza el baseline**: el lead, ya en serie, reescribe `docs/qa/deuda-baseline.md` con los valores de hoy, conservando el histórico anterior.
6. **Propón continuación**: para el hallazgo #1, ofrece una tarea separada con el scope lock ya redactado.

## Regla

Solo lectura sobre el código: esta auditoría nunca refactoriza en el momento; produce el mapa y las tareas, no los cambios.

`scripts/debt-audit.mjs` es el medidor canónico. `--check` falla si un archivo
congelado supera el límite o si la medición no puede ejecutarse; la deuda ya
registrada se reporta, pero no vuelve rojo el gate por sí sola.
