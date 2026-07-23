# Plan de trabajo de mejoras — 2026-07

Derivado de la auditoría integral del 2026-07-23 (4 ejes: deuda estructural, backend R,
frontend/estética, metodología) y de las 2 pasadas profundas de Monitoreo
(`deuda-monitoreo.md`). Principio rector: **primero blindar, luego detener el crecimiento,
luego acelerar, luego desacoplar**. Nada de reescrituras big-bang: toda reducción es por
extracción, cada unidad cierra con gate de `verificador` y commit propio.

Tamaños: **S** = una sesión · **M** = 2–3 sesiones · **L** = varias sesiones (se ejecuta en
rebanadas S/M). Cada unidad indica la rama del agentic OS que la ejecuta.

---

## Fase 0 — Cerrar lo pendiente (prerrequisito)

| # | Unidad | Tamaño | Rama |
|---|---|---|---|
| 0.1 | Commitear el working tree actual (fixes 0.5.18/0.5.19 + registro de deuda) con `/cerrar-trabajo` | S | 7 |
| 0.2 | Publicar el release pendiente 0.5.19 (fix current_code fantasma) con `/publicar` + `/preparar-release` | S | 7 |

## Fase 1 — Blindaje: red de seguridad antes de mover nada

El objetivo es que las clases de bug más caras (wire HTTP, silencios metodológicos) tengan
red ANTES de empezar refactors grandes.

| # | Unidad | Detalle | Tamaño | Rama |
|---|---|---|---|---|
| 1.1 | **Suite de contrato HTTP mínima** | Plumber real en puerto efímero (helper de test reutilizable), ~5 endpoints de mayor riesgo de shape: plan de slides, `/monitoreo/state`, resultado de jobs, sesión/estado, gráficos share. Payloads con arreglos heterogéneos (la clase jsonlite/`simplifyDataFrame` que costó el 0.5.19). Correr en CI. | M | 1 (autor-regresiones + backend-r) |
| 1.2 | **Sello de ponderación en artefactos** | Nota automática del motor en PPT/Word/ficha: "Base ponderada, n_eff=X" / "Base sin ponderar". Convertir el fallback silencioso de `ponderacion_analitica.R:79-88` en warning del job + flag en ficha técnica. Test del contrato "config inválida ⇒ artefacto declara sin ponderar". | M | 3 (especialista-entregables + revisor-metodologico) |
| 1.3 | **Observabilidad de filtros no-op** | `warning()` cuando un filtro nombrado degrada a no-op por valores all-NA (`reporte_filter_guards.R:15-17`), espejo del warning de columna ausente. Test: láminas por servicio nunca viajan con filtros vacíos. | S | 1 |
| 1.4 | **Endurecer re-anclaje de servicio** | En `entregables_repeats.R:236-244`: exigir `_index`; con solo `_submission__id` y multiplicidad >1, abortar re-anclaje (preferir "Sin datos" a servicio equivocado). Verificar unicidad de llave, no solo longitud. | S | 1 |

**Gate de fase**: suite HTTP verde en CI; los 3 sellos/warnings con test rojo→verde.

## Fase 2 — Detener el crecimiento: freezes con dientes

Los dos archivos que más crecen (+3.079 y +1.434 líneas en 13 días) y los dos contratos
implícitos. Todo con compatibilidad total (cero cambio de callers).

| # | Unidad | Detalle | Tamaño | Rama |
|---|---|---|---|---|
| 2.1 | **Partir `client.ts` por dominio** | `api/monitoreo.ts`, `api/graficos.ts`, `api/carga.ts`, `api/analitica.ts`… siguiendo los separadores `// ===` existentes; `client.ts` queda como barrel re-export. Regla nueva en CLAUDE.md: función de API nueva va al módulo de su dominio. Borrar de paso `apiMonitoreoAulasReemplazo`/`AulasState` (sin consumidor). | M | 1 (frontend-react) |
| 2.2 | **Partir `theme.css`** | Tokens + kit global (~5k líneas) se quedan; los bloques por módulo ("Validación · command bar", "Codificación · shell"…) migran al CSS de su feature. Congelar `theme.css` a tokens/kit. | M | 2 (frontend-react + qa-visual-desktop antes/después) |
| 2.3 | **Freeze real de `reporte_plan_ppt.R`** | Devolver las +287 líneas del WIP actual a archivos `reporte_plan_<tema>.R` (el patrón `reporte_filter_guards.R` ya lo demostró). | S | 1 |
| 2.4 | **Registro central de `E_*`** | Tabla código→status→módulo en `errors.R` (o `errors_registry.R` nuevo) + test que falla ante código no registrado. Migración incremental: registrar los ~50 más usados primero, el test acepta legacy con allowlist decreciente. | M | 1 (backend-r) |
| 2.5 | **Whitelist de claves persistibles del `.pulso`** | Espejo de la whitelist que ya existe para `workspace`: clave de sesión nueva sin registrar = test rojo. Convierte el esquema implícito en contrato con gate. | M | 8→1 (guardian-contratos diseña, backend-r implementa) |

**Gate de fase**: typecheck + vitest + testthat completos; QA visual para 2.2; métricas de
`deuda-baseline.md` eje 1 congeladas de verdad en la siguiente medición.

## Fase 3 — Efectividad de Monitoreo (norte corregido 2026-07-23)

Aclaración del dueño: la efectividad de Monitoreo NO es solo carga barata. Son tres cosas,
en este orden: **(1) sincronización rápida desde Kobo/SurveyMonkey** — el corazón del
monitoreo casi en tiempo real — y **publicación efectiva en Sheets**; **(2) mostrar toda la
información de forma efectiva y actualizarla rápido**; **(3) uniformidad entre paths**
(botones de avance y estados visuales de carga hoy inconsistentes entre territorial,
acreditación, telefónico y aulas). Las unidades 3.1–3.7 (backend barato) siguen siendo
prerrequisito; 3.8 y 3.9 son el objetivo de cara al usuario.

| # | Unidad | Detalle | Tamaño | Rama |
|---|---|---|---|---|
| 3.1 | **Rebuilds fuera del main-thread** | `.monitoreo_store_config` y ajustes apply/reset/revert dejan de reconstruir el dashboard inline: responden sin `state` (o con state stale marcado) y difieren el build al GET cacheado o a job callr. Corrige de paso el doble-rebuild de acreditación (`router_monitoreo.R:3660` invalida lo recién construido). Atención a la restricción conocida: sesiones in-memory vs workers callr (ver memoria avance-perf). | M–L | 1 (diagnosticador → backend-r) |
| 3.2 | **Fingerprint barato en vez de sha256** | Token de caché con nrow/ncol/`synced_at`/versión de snapshot (ya presentes) en vez de `digest::digest(data)` del df completo (×2 por state). | S | 1 |
| 3.3 | **Cachear `monitoreo_variables` + vectorizar filas** | Cache junto al snapshot; `.monitoreo_territorial_df_rows` y `.monitoreo_df_records` por columna, no `lapply(seq_len(nrow))` (40+ call sites, empezar por los del hot path de state). | M | 1 |
| 3.4 | **Invalidación selectiva** | Token por scope con el sub-config relevante (no `toJSON(cfg)` completo); frontend: `clearScopeStateCache()` selectivo tras mutación (`TerritorialMonitoreoPage.tsx:1836-1842`). | M | 1 (cross: backend-r + frontend-react) |
| 3.5 | **Caps de payload** | `response_audit`/`map_points` en `validation_summary`/`full` con cap/paginación (espejo del `head(5000)` de queries_summary). | S | 1 |
| 3.6 | **Memoización de render** | `React.memo` en los componentes de charts/tablas grandes de las páginas de Monitoreo; memoizar props de `PlotlyChart` en los callers que faltan. | S–M | 2 |

| 3.7 | **Sanear fugas de caché del .pulso** | Detectadas por el censo: `monitoreo_dashboard_cache(_token)_<scope>`, `graficos_preview_cache` y `explorador_cache` legacy hoy viajan en el .pulso. Strip + back-compat de load_pulso. | S | 1 |
| 3.8 | **Sync rápido Kobo/SM + Sheets efectivo** | El ciclo sync→dashboard→sheets del monitoreo en tiempo real: pull incremental en vez de completo, manejo de rate limits, costo post-pull proporcional al delta, publicación a Sheets por batch/job. Diagnóstico dedicado primero. | L | 4→1 |
| 3.9 | **Uniformar botón de avance y estados de carga** | Un patrón canónico de control de sync (botón + progreso honesto + estado stale/error) compartido por los 4 paths. Inventario comparativo primero; el patrón del fix del botón Avance (progreso monótono + shimmer) es el candidato base. | M | 2 |

**Gate de fase**: benchmark antes/después reproducible (patrón `Rprof` del fix de Avance:
build fresco, GET /state con hit y con miss, guardar config) + suite testthat de monitoreo +
QA visual de las 4 familias. **Metas medibles: guardar config/ajustes nunca congela la app;
GET /state con cache hit < 300 ms en la base ACNURCG; un sync incremental típico tarda
segundos (proporcional al delta), no minutos; los 4 paths comparten el mismo control de
avance con el mismo vocabulario de estados.**

## Fase 4 — Desacople de Monitoreo (arquitectura, por extracción)

La deuda estructural #1. Secuencia diseñada para que cada paso deje el repo mejor aunque el
siguiente nunca llegue.

| # | Unidad | Detalle | Tamaño | Rama |
|---|---|---|---|---|
| 4.1 | **Piloto: aulas/cursos-horario 100% modular** | Migrar import-desde-calc-muestra, sync y agenda/config del monolito y `RecopiladoresPage` al profile de aulas; renombrar conceptualmente a cursos-horario (UI y docs; rutas/API pueden conservar alias). Es el tipo más cerca de estar limpio (backend ya autónomo, CSS ya desacoplado) y valida el camino. | M | 1 |
| 4.2 | **Independizar telefónico de acreditación** (norte corregido 2026-07-23: son productos INDEPENDIENTES, no se fusionan) | El fork de 492/544 símbolos NO se re-unifica en un core parametrizado: cada familia evoluciona por su cuenta. Lo que sí se hace: (a) extraer al kit del feature solo infraestructura genuinamente genérica y estable (DataTable, formatters — sin semántica de familia); (b) darle a telefónico identidad propia en la API (hoy 0 endpoints: vive como if family=="telefonico" regado en engine/router — eso es acoplamiento, no independencia); (c) separar su CSS del profilePage.css compartido cuando su diseño diverja. El costo "fix ×2" en la semántica de familia se acepta como precio de la independencia. | L | 8→1 (dominio congela qué es kit y qué es familia; frontend-react + backend-r ejecutan) |
| 4.3 | **Particionar `monitoreo.css`** | Kit común `mon-*` + un CSS por familia; resolver los 98 selectores duplicados con `profilePage.css`. Prerrequisito de cualquier extracción limpia; ejecutar con QA visual antes/después por familia. Fusiona la campaña de tokenización (los 2.422 hex de monitoreo.css → tokens `--pulso-*`). | L | 2 (frontend-react + qa-visual-desktop) |
| 4.4 | **Backend por familia, en caliente** | Regla permanente: cada fix que toque `monitoreo_engine.R`/`router_monitoreo.R` extrae el tema tocado a `monitoreo_<tema>.R` con test propio. Objetivo de mediano plazo: telefónico con endpoints propios (hoy 0) y `territorial_*` (186 funciones) como primer bloque grande extraíble. | L (continua) | 1 |
| 4.5 | **Retirar el monolito** | Cuando 4.1–4.4 estén: borrar superficie legacy (`?monitoreoSurface=legacy-territorial`), páginas de comparación dev y `MonitoreoPage.tsx` (con doble confirmación del gate 3 de la casa). | M | 7 |

**Gate de fase**: por unidad (cada una es release-able); 4.5 exige QA visual completo de las
4 familias + suite completa.

## Fase 5 — Consolidación continua (rebanadas S intercalables)

Unidades independientes para intercalar entre fases como trabajo de "válvula".

| # | Unidad | Detalle | Tamaño |
|---|---|---|---|
| 5.1 | `stop()`→`stop_api` en `reporte_plan_slides.R` (185) + `reporte_plan_ppt.R` (135) — 30% del total, la clase del bug 0.5.17 | S–M |
| 5.2 | Extraer los 3 worker closures de `router_graficos.R` (~2.000 líneas triplicadas) a funciones del paquete bajo el bootstrap de `job_submit` | M |
| 5.3 | Micro-helpers a `helpers_calc_comunes.R`: los 12 de `monitoreo_engine.R`, los `%||%` cuádruples de `reporte_cruces.R`/`validacion_read_xlsform.R` | S |
| 5.4 | Tokenizar `editor-v2.css` (849 hex, el otro 30% del problema CSS) | S–M |
| 5.5 | Stores zustand para Carga (`BasesPanel` 62 useState) y HojasRuta (64); consolidar los 2 stores de calcMuestra en uno | M |
| 5.6 | Helper único de filtros con política declarada de NA/coerción, adoptado por dashboard y reportes; puente `codigos_solo_si_presentes` → default de `excluir_opciones` del plan PPT (sobreescribible por lámina) | M |
| 5.7 | Tests para los 5 archivos grandes sin test: `router_analitica.R`, `graficador_dimensiones.R`, `codificacion_flujo_hibrido.R`, `router_codificacion.R`, `graficos_metadata.R` (al menos contrato de artefactos/engine) | M (por archivo: S) |
| 5.8 | Menores: no filtrar `conditionMessage` crudo en `E_INTERNAL`; alinear comentario PBKDF2 vs implementación en `secrets.R`; fecha de retiro para espejo `rp_data`; agregar poppler-utils a quality.yml; streaming del resultado en `router_jobs.R:21` | S c/u |

## Cadencia y gobierno

- **Regla de intercalado**: máx. una unidad L activa a la vez; entre unidades M/L, intercalar
  rebanadas de Fase 5 para mantener momentum y bajar métricas del baseline.
- **Medición mensual** con `/auditoria-deuda`; actualizar columna "Hoy" del baseline y el
  histórico. Toda unidad cerrada referencia su métrica objetivo.
- **Todo pasa por `verificador`** antes de declararse listo; unidades con UI llevan QA
  visual antes/después; commits atómicos por unidad (`/cerrar-trabajo`).

### Metas medibles a 3 mediciones (≈ 3 meses)

| Métrica | Hoy (2026-07-23) | Meta |
|---|---|---|
| Tests HTTP wire | 0 | ≥ 5 endpoints cubiertos en CI |
| Congelamientos de app al guardar config/ajustes en Monitoreo | sí | 0 |
| `client.ts` | 18.083 líneas | barrel < 500 (módulos por dominio) |
| `theme.css` | 45.903 | < 8.000 (tokens + kit) |
| Fork acred↔telefónico (símbolos duplicados) | 492 | < 250 |
| `stop()` crudos | 1.046 | < 700 |
| Hex en CSS de features | ~4.580 | < 1.500 |
| Micro-helpers duplicados | 97 | ≤ 74 (volver al baseline) |
| Archivos R sin test por nombre | 130/214 | ≤ 110/214 |
| Artefactos sin sello de ponderación | todos | 0 |

## Orden de arranque recomendado

1. **0.1 + 0.2** (cerrar y publicar lo pendiente) — esta semana.
2. **1.1 + 1.2** en paralelo (dos writers, superficies disjuntas: tests HTTP vs motor de
   entregables) — la red de seguridad.
3. **3.1 + 3.2** (los dos congelamientos) — el alivio de performance que más se siente.
4. **2.1** (client.ts) — corta el crecimiento más rápido del repo.
5. Desde ahí, alternar Fase 4 (empezando por el piloto 4.1) con rebanadas de Fase 5.
