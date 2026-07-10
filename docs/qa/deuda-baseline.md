# Baseline de deuda técnica

Medición de referencia contra la que compara el skill `/auditoria-deuda` (agente `auditor-deuda`, comandos canónicos en `.claude/agents/auditor-deuda.md`). Al re-medir, actualizar la columna "Hoy" y mover la anterior al histórico.

## Baseline — 2026-07-10

| Eje | Métrica | Valor |
|---|---|---|
| 1 | `monitoreo_engine.R` | 41.690 líneas |
| 1 | `router_monitoreo.R` | 8.239 líneas |
| 1 | `reporte_plan_ppt.R` | 9.604 líneas |
| 1 | `MonitoreoPage.tsx` | 44.988 líneas |
| 1 | `theme.css` | 44.469 líneas |
| 1 | `client.ts` | 15.004 líneas |
| 2 | Redefiniciones de `%||%` en `api/R` | 62 |
| 2 | Helpers `*_scalar/_slug/_chr/_bool` por módulo | ~74 (26+17+22+9) |
| 3 | `stop()` crudos (sin `stop_api`) | ~1.279 |
| 3 | `try()` sueltos | ~94 |
| 4 | CSS de features con hex hardcodeado | 26 de 51 |
| 5 | `any` en producción TS | 3 |
| 5 | `@ts-ignore` / `@ts-expect-error` | 0 |
| 6 | Archivos R sin test dedicado por nombre | ~80 de 155 |
| 7 | Componentes `.tsx` >1000 líneas | 38 |
| 8 | Volumen sin commitear (líneas) | ~13.100 |

Contexto adicional de la medición inicial (auditoría 2026-07-10): funciones extremas `reporte_ppt_plan` ~9.053 líneas (`reporte_plan_ppt.R:483`), `mount_monitoreo` ~2.531 líneas; 61 de 155 archivos R >1.000 líneas; ratio fix/feat histórico 0,38 con 33% de fixes corrigiendo el feat inmediatamente anterior.

## Histórico de evolución

| Fecha | Ejes que mejoraron | Ejes que empeoraron | Nota |
|---|---|---|---|
| 2026-07-10 | — | — | Medición inicial |
