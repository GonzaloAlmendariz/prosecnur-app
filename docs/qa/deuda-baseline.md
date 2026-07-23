# Baseline de deuda técnica

Medición de referencia contra la que compara el skill `/auditoria-deuda` (agente `auditor-deuda`, comandos canónicos en `.claude/agents/auditor-deuda.md`). Al re-medir, actualizar la columna "Hoy" y mover la anterior al histórico.

## Baseline — 2026-07-10 · Hoy — 2026-07-23

| Eje | Métrica | Baseline | Hoy (2026-07-23) | Tendencia |
|---|---|---|---|---|
| 1 | `monitoreo_engine.R` | 41.690 líneas | 41.690 | estable |
| 1 | `router_monitoreo.R` | 8.239 líneas | 8.265 | +26 |
| 1 | `reporte_plan_ppt.R` | 9.604 líneas | 9.891 | +287 (viola freeze) |
| 1 | `MonitoreoPage.tsx` | 44.988 líneas | 45.005 | +17 |
| 1 | `theme.css` | 44.469 líneas | 45.903 | +1.434 |
| 1 | `client.ts` | 15.004 líneas | 18.083 | +3.079 (+20%) |
| 2 | Redefiniciones de `%||%` en `api/R` | 62 | 72 | empeoró |
| 2 | Helpers `*_scalar/_slug/_chr/_bool` por módulo | ~74 (26+17+22+9) | 97 | empeoró |
| 3 | `stop()` crudos (sin `stop_api`) | ~1.279 | 1.046 | mejoró |
| 3 | `try()` sueltos | ~94 | 16 | mejoró |
| 4 | CSS de features con hex hardcodeado | 26 de 51 | 25 de 60 | mejoró (ratio) |
| 5 | `any` en producción TS | 3 | 3 | estable |
| 5 | `@ts-ignore` / `@ts-expect-error` | 0 | 0 | estable |
| 6 | Archivos R sin test dedicado por nombre | ~80 de 155 | 130 de 214 | empeoró |
| 7 | Componentes `.tsx` >1000 líneas | 38 | 40 | empeoró |
| 8 | Volumen sin commitear (líneas) | ~13.100 | ~650 | mejoró |
| 9 | Deuda Monitoreo (monolito↔modular + performance) | — | ver `deuda-monitoreo.md` | registro inicial |

Contexto adicional de la medición inicial (auditoría 2026-07-10): funciones extremas `reporte_ppt_plan` ~9.053 líneas (`reporte_plan_ppt.R:483`), `mount_monitoreo` ~2.531 líneas; 61 de 155 archivos R >1.000 líneas; ratio fix/feat histórico 0,38 con 33% de fixes corrigiendo el feat inmediatamente anterior.

## Histórico de evolución

| Fecha | Ejes que mejoraron | Ejes que empeoraron | Nota |
|---|---|---|---|
| 2026-07-10 | — | — | Medición inicial |
| 2026-07-23 | stop()/try() crudos, ratio CSS con hex, working tree | Congelados (`client.ts` +20%, `reporte_plan_ppt.R` +287), micro-helpers, cobertura por nombre, tsx>1000 | Auditoría integral (4 ejes + 2 pasadas profundas de Monitoreo). Nuevo eje 9: deuda estructural de Monitoreo registrada en detalle en `deuda-monitoreo.md` (convivencia monolito↔modular de fachada, fork acred↔telefónico de ~20k líneas, atadura `monitoreo.css`, top 5 cuellos de botella de performance). |
| 2026-07-23 (post-plan) | Ejecución del plan-mejoras-2026-07 (~40 commits): `client.ts` 18.083→25 (barrel + 19 módulos) · `theme.css` 45.903→30.354 · `reporte_plan_ppt.R` 9.891→9.420 (bajo baseline) · `monitoreo.css` 67.687→59.676 · `MonitoreoPage.tsx` 45.005→44.232 · `%||%` 60→28 (22 estaban muertas) · hex `editor-v2.css` 1.027→117 · `stop()` crudos de reporte_plan_slides 186→0 · +~1.500 asserts nuevos (incl. primera suite HTTP wire y contrato para los 5 grandes sin test) · sello de ponderación e2e · sync incremental SM/Kobo validado en vivo (Avance sin cambios: Kobo 9s, SM 13s; Sheets skip-por-hash 1s) | Pendientes con tarea: 4.2 (independizar telefónico — NO fusionar, decisión del dueño), 4.5 (retiro monolito), 3.10e (bloqueo intermitente), 5.6b | Evidencia por unidad en `deuda-monitoreo.md` y en los mensajes de commit. La próxima `/auditoria-deuda` re-mide la tabla completa. |
