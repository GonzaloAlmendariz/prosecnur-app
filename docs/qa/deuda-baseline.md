# Baseline de deuda técnica

Tipo: Baseline QA
Estado: Vigente
Fecha: 2026-07-30
Autoridad: Línea base comparativa; la medición viva la produce el gate de deuda

Medición de referencia contra la que compara el skill `/auditoria-deuda` (agente `auditor-deuda`, comandos canónicos en `.claude/agents/auditor-deuda.md`). Al re-medir, actualizar la columna "Hoy" y mover la anterior al histórico.

## Baseline — 2026-07-10 · Anterior — 2026-07-24 · Hoy — 2026-07-30

| Eje | Métrica | Baseline inicial | Anterior (2026-07-24) | Hoy (2026-07-30) | Δ vs anterior | Tendencia |
|---|---|---:|---:|---:|---:|---|
| 1 | `monitoreo_engine.R` | 41.690 líneas | 39.977 | 38.662 | -1.315 | mejoró |
| 1 | `router_monitoreo.R` | 8.239 líneas | 8.016 | 5.116 | -2.900 | mejoró |
| 1 | `reporte_plan_ppt.R` | 9.604 líneas | 9.395 | 9.418 | +23 | empeoró, sin superar el límite vigente |
| 1 | `MonitoreoPage.tsx` | 44.988 líneas | retirado | retirado | no comparable | estable en retiro |
| 1 | `theme.css` | 44.469 líneas | 30.360 | 30.216 | -144 | mejoró |
| 1 | `client.ts` | 15.004 líneas | 25 | 25 | 0 | estable |
| 1 | Archivos congelados dentro del límite vigente | — | — | 16 de 16; 0 violaciones | baseline nuevo | estable |
| 2 | Redefiniciones históricas de `%||%` en `api/R` | 62 | 37 | 37 | 0 | estable |
| 2 | Helpers históricos `*_scalar/_slug/_chr/_bool` por módulo | ~74 | 98 | 99 | +1 | empeoró |
| 3 | `stop("` históricos sin `stop_api` | ~1.279 | 750 | 762 | +12 | empeoró |
| 3 | `try()` sueltos históricos | ~94 | 16 | 16 | 0 | estable |
| 3 | Serie semántica R | — | — | `%||%` 35; helpers 116; `stop` 1.021; `stop_api` 989; `try` 22 | baseline nuevo | observar |
| 4 | CSS de features con hex de 6 dígitos | 26 de 51 | 28 de 60 | 30 de 87 | -12,19 pp; +2 archivos | mixto por expansión del universo |
| 4 | Coincidencias hex de 6 dígitos en CSS de features | — | 2.272 | 2.006 | -266 | mejoró |
| 4 | Serie hex ampliada de 3/4/6/8 dígitos | — | — | 49 de 87; 4.376 coincidencias | baseline nuevo | observar |
| 5 | `any` real por AST en producción TS | 3 | 3 | 14 | +11 | empeoró |
| 5 | `@ts-ignore` / `@ts-expect-error` en producción | 0 | 0 | 0 | 0 | estable |
| 6 | Archivos R sin test nominal por nombre | ~80 de 155 | 127 de 225 | 143 de 275 | +16; -4,44 pp | mixto |
| 7 | Componentes `.tsx` >1000 líneas | 38 | 39 | 38 de 493 | -1 | mejoró |
| 8 | Volumen de producto sin commitear | ~13.100 líneas | 0 | 0 | 0 | estable |
| 9 | Deuda Monitoreo (monolito↔modular + performance) | — | ver `deuda-monitoreo.md` | ver `deuda-monitoreo.md` | — | registro separado |

Notas de comparabilidad:

- `MonitoreoPage.tsx` ya no existe; las páginas especializadas no se suman
  porque cambiaría la definición del eje congelado.
- Las series históricas R conservan literalmente sus patrones anteriores para
  permitir deltas. La serie semántica elimina comentarios y cadenas antes de
  contar llamadas; complementa el histórico, no lo reescribe.
- El universo CSS creció de 60 a 87 archivos. El número absoluto de archivos
  con hex subió de 28 a 30, pero su proporción bajó de 46,67% a 34,48%; por
  eso el veredicto de archivos es mixto.
- El eje 5 usa nodos `AnyKeyword` del AST de TypeScript: las 14 apariciones
  reales están en `graficos.ts` (12), `bootClient.ts` (1) y `core.ts` (1).
- El eje 6 es sólo un proxy nominal. El numerador empeoró en 16 archivos, pero
  la proporción bajó de 56,44% a 52,00%; la cobertura ejecutada gobierna antes
  de proponer suites nuevas.
- El eje 8 se midió después de confirmar las unidades de producto de esta
  revisión. Cambios pendientes exclusivamente en tests, documentación o
  gobernanza se reportan aparte y no inflan el volumen de producto.

Método canónico:

```bash
node scripts/debt-audit.mjs --check
node scripts/debt-audit.mjs --json
```

El gate falla por crecimiento de un archivo congelado o por imposibilidad de
medir. La deuda ya registrada sigue visible, pero no vuelve rojo CI por sí
sola. El universo excluye tests cuando se mide producto y omite los directorios
`output` y `outputs`, los proyectos `.pulso`, vendor y generados.

Contexto adicional de la medición inicial (auditoría 2026-07-10): funciones extremas `reporte_ppt_plan` ~9.053 líneas (`reporte_plan_ppt.R:483`), `mount_monitoreo` ~2.531 líneas; 61 de 155 archivos R >1.000 líneas; ratio fix/feat histórico 0,38 con 33% de fixes corrigiendo el feat inmediatamente anterior.

## Histórico de evolución

| Fecha | Ejes que mejoraron | Ejes que empeoraron | Nota |
|---|---|---|---|
| 2026-07-10 | — | — | Medición inicial |
| 2026-07-23 | stop()/try() crudos, ratio CSS con hex, working tree | Congelados (`client.ts` +20%, `reporte_plan_ppt.R` +287), micro-helpers, cobertura por nombre, tsx>1000 | Auditoría integral (4 ejes + 2 pasadas profundas de Monitoreo). Nuevo eje 9: deuda estructural de Monitoreo registrada en detalle en `deuda-monitoreo.md` (convivencia monolito↔modular de fachada, fork acred↔telefónico de ~20k líneas, atadura `monitoreo.css`, top 5 cuellos de botella de performance). |
| 2026-07-23 (post-plan) | Ejecución del plan-mejoras-2026-07 (~40 commits): `client.ts` 18.083→25 (barrel + 19 módulos) · `theme.css` 45.903→30.354 · `reporte_plan_ppt.R` 9.891→9.420 (bajo baseline) · `monitoreo.css` 67.687→59.676 · `MonitoreoPage.tsx` 45.005→44.232 · `%||%` 60→28 (22 estaban muertas) · hex `editor-v2.css` 1.027→117 · `stop()` crudos de reporte_plan_slides 186→0 · +~1.500 asserts nuevos (incl. primera suite HTTP wire y contrato para los 5 grandes sin test) · sello de ponderación e2e · sync incremental SM/Kobo validado en vivo (Avance sin cambios: Kobo 9s, SM 13s; Sheets skip-por-hash 1s) | Pendientes con tarea: 4.2 (independizar telefónico — NO fusionar, decisión del dueño), 4.5 (retiro monolito), 3.10e (bloqueo intermitente), 5.6b | Evidencia por unidad en `deuda-monitoreo.md` y en los mensajes de commit. La próxima `/auditoria-deuda` re-mide la tabla completa. |
| 2026-07-24 | Cinco congelados comparables, `stop()` crudos, cobertura nominal R, componentes TSX grandes y worktree | CSS con hex (25→28 archivos), micro-helpers (97→98), `%||%` contra checkpoint post-plan (28→37) | `MonitoreoPage.tsx` retirado de la ruta canónica. Los diez R más grandes sin test nominal suman 31.011 líneas; confirmar cobertura indirecta antes de crear suites nuevas. |
| 2026-07-30 | Cinco congelados comparables, coincidencias hex, densidad del proxy nominal R, TSX >1000 y worktree de producto | Helpers históricos (98→99), `stop("` histórico (750→762), `any` por AST (3→14) y numerador sin test nominal (127→143) | Se versionó `scripts/debt-audit.mjs`, se separaron series históricas y semánticas y se añadió el gate a CI. Los diez R más grandes sin test nominal suman 28.270 líneas; `interactivo_relacion.R` e `interactivo_estetica.R` son los únicos del top 10 sin referencias literales detectadas por la inspección complementaria. |

## Indicadores del revamp UI — 2026-07-30

Estos indicadores complementan los ocho ejes y se miden durante
`docs/plan-revamp-ui-2026-07.md`:

| Indicador | Hoy | Objetivo |
|---|---:|---:|
| `role="tab"` en producción | 31 | 0 falsos tabsets |
| `role="tabpanel"` en producción | 33 | toda tab real asociada |
| `aria-controls` en producción | 38 | toda tab real |
| `aria-current` en producción | 19 | toda ruta activa |
| `role="radiogroup"` en producción | 42 | todo selector exclusivo agrupado |
| `role="radio"` en producción | 51 | toda opción exclusiva |
| `aria-checked` en producción | 66 | todo selector exclusivo |
| `GlidingTabList mode="nav"` en producción | 3 | toda navegación migrada que requiera roving |
| Casos del contrato transversal de semántica | 25 de 25 | 25 de 25 |
| Tonos canónicos distintivos | 8 de 8 | 8 de 8 |

La caída de `role="tab"` no representa pérdida de superficies: diez familias
de selectores exclusivos pasaron a radio y catorce familias de tabs reales
quedaron enlazadas por contrato con sus paneles. Los tonos vigentes siguen
siendo distintos: Bitácora `#A16207`, Cálculo `#7C3AED`, Formularios
`#6D5DFC`, Hojas `#C2410C`, Recopiladores `#0891B2`, Monitoreo `#BE123C`,
Procesamiento `#0F766E` y Dashboard `#2563EB`.
