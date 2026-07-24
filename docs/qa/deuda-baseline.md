# Baseline de deuda técnica

Medición de referencia contra la que compara el skill `/auditoria-deuda` (agente `auditor-deuda`, comandos canónicos en `.claude/agents/auditor-deuda.md`). Al re-medir, actualizar la columna "Hoy" y mover la anterior al histórico.

## Baseline — 2026-07-10 · Anterior — 2026-07-23 · Hoy — 2026-07-24

| Eje | Métrica | Baseline inicial | Anterior (2026-07-23) | Hoy (2026-07-24) | Δ vs anterior | Tendencia |
|---|---|---:|---:|---:|---:|---|
| 1 | `monitoreo_engine.R` | 41.690 líneas | 41.690 | 39.977 | -1.713 | mejoró |
| 1 | `router_monitoreo.R` | 8.239 líneas | 8.265 | 8.016 | -249 | mejoró |
| 1 | `reporte_plan_ppt.R` | 9.604 líneas | 9.891 | 9.395 | -496 | mejoró |
| 1 | `MonitoreoPage.tsx` | 44.988 líneas | 45.005 | retirado | no comparable | mejoró en huella canónica |
| 1 | `theme.css` | 44.469 líneas | 45.903 | 30.360 | -15.543 | mejoró |
| 1 | `client.ts` | 15.004 líneas | 18.083 | 25 | -18.058 | mejoró |
| 2 | Redefiniciones de `%||%` en `api/R` | 62 | 72 formal / 28 post-plan | 37 | -35 formal / +9 post-plan | empeoró vs checkpoint |
| 2 | Helpers `*_scalar/_slug/_chr/_bool` por módulo | ~74 | 97 | 98 | +1 | empeoró |
| 3 | `stop()` crudos (sin `stop_api`) | ~1.279 | 1.046 | 750 | -296 | mejoró |
| 3 | `try()` sueltos | ~94 | 16 | 16 | 0 | estable |
| 4 | CSS de features con hex hardcodeado | 26 de 51 | 25 de 60 | 28 de 60 | +3 archivos / +5 pp | empeoró |
| 4 | Coincidencias hex en CSS de features | — | — | 2.272 | baseline nuevo | medir en el revamp |
| 5 | `any` real en producción TS | 3 | 3 | 3 (4 literal) | 0 | estable |
| 5 | `@ts-ignore` / `@ts-expect-error` | 0 | 0 | 0 | 0 | estable |
| 6 | Archivos R sin test dedicado por nombre | ~80 de 155 | 130 de 214 | 127 de 225 | -3 / -4,30 pp | mejoró |
| 7 | Componentes `.tsx` >1000 líneas | 38 | 40 | 39 | -1 | mejoró |
| 8 | Volumen de producto sin commitear | ~13.100 líneas | ~650 | 0 | ~-650 | mejoró |
| 9 | Deuda Monitoreo (monolito↔modular + performance) | — | ver `deuda-monitoreo.md` | ver `deuda-monitoreo.md` | — | registro separado |

Notas de comparabilidad:

- `MonitoreoPage.tsx` ya no existe; las páginas especializadas no se suman
  porque cambiaría la definición del eje congelado.
- El histórico post-plan declaró 28 redefiniciones de `%||%`, mientras la
  tabla formal conservó 72. El valor vigente es 37: mejora contra la tabla,
  pero empeora en 9 contra el checkpoint más reciente, que gobierna el
  veredicto.
- El grep canónico de `any` también casa con `overflow-wrap: anywhere`; por
  eso se registran 4 coincidencias literales y 3 violaciones reales.
- El único archivo sin seguimiento es
  `docs/plan-revamp-ui-2026-07.md` (423 líneas), propiedad del usuario y
  excluido del volumen de deuda de producto.

Contexto adicional de la medición inicial (auditoría 2026-07-10): funciones extremas `reporte_ppt_plan` ~9.053 líneas (`reporte_plan_ppt.R:483`), `mount_monitoreo` ~2.531 líneas; 61 de 155 archivos R >1.000 líneas; ratio fix/feat histórico 0,38 con 33% de fixes corrigiendo el feat inmediatamente anterior.

## Histórico de evolución

| Fecha | Ejes que mejoraron | Ejes que empeoraron | Nota |
|---|---|---|---|
| 2026-07-10 | — | — | Medición inicial |
| 2026-07-23 | stop()/try() crudos, ratio CSS con hex, working tree | Congelados (`client.ts` +20%, `reporte_plan_ppt.R` +287), micro-helpers, cobertura por nombre, tsx>1000 | Auditoría integral (4 ejes + 2 pasadas profundas de Monitoreo). Nuevo eje 9: deuda estructural de Monitoreo registrada en detalle en `deuda-monitoreo.md` (convivencia monolito↔modular de fachada, fork acred↔telefónico de ~20k líneas, atadura `monitoreo.css`, top 5 cuellos de botella de performance). |
| 2026-07-23 (post-plan) | Ejecución del plan-mejoras-2026-07 (~40 commits): `client.ts` 18.083→25 (barrel + 19 módulos) · `theme.css` 45.903→30.354 · `reporte_plan_ppt.R` 9.891→9.420 (bajo baseline) · `monitoreo.css` 67.687→59.676 · `MonitoreoPage.tsx` 45.005→44.232 · `%||%` 60→28 (22 estaban muertas) · hex `editor-v2.css` 1.027→117 · `stop()` crudos de reporte_plan_slides 186→0 · +~1.500 asserts nuevos (incl. primera suite HTTP wire y contrato para los 5 grandes sin test) · sello de ponderación e2e · sync incremental SM/Kobo validado en vivo (Avance sin cambios: Kobo 9s, SM 13s; Sheets skip-por-hash 1s) | Pendientes con tarea: 4.2 (independizar telefónico — NO fusionar, decisión del dueño), 4.5 (retiro monolito), 3.10e (bloqueo intermitente), 5.6b | Evidencia por unidad en `deuda-monitoreo.md` y en los mensajes de commit. La próxima `/auditoria-deuda` re-mide la tabla completa. |
| 2026-07-24 | Cinco congelados comparables, `stop()` crudos, cobertura nominal R, componentes TSX grandes y worktree | CSS con hex (25→28 archivos), micro-helpers (97→98), `%||%` contra checkpoint post-plan (28→37) | `MonitoreoPage.tsx` retirado de la ruta canónica. Los diez R más grandes sin test nominal suman 31.011 líneas; confirmar cobertura indirecta antes de crear suites nuevas. |

## Indicadores del revamp UI — 2026-07-24

Estos indicadores complementan los ocho ejes y se miden durante
`docs/plan-revamp-ui-2026-07.md`:

| Indicador | Hoy | Objetivo |
|---|---:|---:|
| `role="tab"` en producción | 61 | 0 sin `tabpanel` real |
| `role="tabpanel"` en producción | 22 | paridad contractual con tabs |
| `aria-controls` en producción | 15 | toda tab real |
| `aria-current` en producción | 17 | toda ruta activa |
| `GlidingTabList mode="nav"` en producción | 2 | toda navegación migrada que requiera roving |
| Tonos canónicos distintivos | 8 de 8 | 8 de 8 |

Los tonos vigentes siguen siendo distintos: Bitácora `#A16207`, Cálculo
`#7C3AED`, Formularios `#6D5DFC`, Hojas `#C2410C`, Fichas QR `#0891B2`,
Monitoreo `#BE123C`, Procesamiento `#0F766E` y Dashboard `#2563EB`.
