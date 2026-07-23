# Deuda estructural del módulo Monitoreo

Registro detallado de la deuda más grande del repo, medida el 2026-07-23 con dos auditorías
de solo lectura (arquitectura/dependencias y performance/caché). Complementa el eje 1 de
`deuda-baseline.md`. Origen conocido: los cuatro tipos de monitoreo nacieron dentro de un
solo archivo por capa; la modularización posterior quedó a medias y hoy conviven ambas formas.

## 1. Estado real de la convivencia monolito ↔ modular

**El corte modular del frontend es de fachada.** Los profiles ya no importan
`MonitoreoPage.tsx` (blindado por test en `profiles/profileImports.test.ts:20-33`) y el
dispatcher (`MonitoreoShell.tsx:78-89` + `profiles/registry.ts`) enruta las 4 familias a
página modular. Pero la estética, los modelos compartidos y el ~95% del backend siguen
siendo monolíticos.

### Inventario por tipo

| Tipo | Frontend | Backend | Grado real de modularidad |
|---|---|---|---|
| Territorial | `profiles/territorial/` (2.043 + ~14k en 10 workbenches) | 186 funciones `territorial_*` dentro del engine + 28 endpoints `/territorial/*` | Frontend modular, backend 0% |
| Acreditación | `profiles/acreditacion/` (19.048) | 100% engine genérico + 2 endpoints propios | Frontend modular, backend 0% |
| Telefónico | `profiles/telefonico/` (21.178) — **fork casi total de acreditación** | 0 endpoints propios; 25+ sitios `if (family == "telefonico")` regados por engine y router | Fork, no módulo |
| Aulas (conceptualmente **cursos-horario**) | `profiles/aulas/` (436) — solo dashboard de lectura | `monitoreo_aulas_universitarias.R` (781) autónomo + 6 endpoints `/aulas/*` | El único backend modular; frontend incompleto |

### El monolito sigue vivo por tres razones

1. **Superficie legacy forzable**: `?monitoreoSurface=legacy-territorial`
   (`MonitoreoShell.tsx:11-29`) y páginas dev de comparación (`MonitoreoTerritorialCompare.tsx`).
2. **Funcionalidad exclusiva**: las acciones profundas de aulas
   (`apiMonitoreoAulasImportFromCalcMuestra`, `apiMonitoreoAulasSync`) viven SOLO en
   `MonitoreoPage.tsx`; agenda/config en `RecopiladoresPage.tsx`. Borrar el monolito hoy
   rompe la operación de aulas. (`apiMonitoreoAulasReemplazo`/`AulasState` en
   `client.ts:9560,9580` no tienen consumidor — código muerto candidato.)
3. **Dependencia inversa**: `MonitoreoPage.tsx:14` importa
   `profiles/territorial/TerritorialOutputsPanel`.

### Dependencia estética (la atadura más dura)

`monitoreo.css` tiene **67.687 líneas** y es la fuente única de las clases `mon-*` que los
profiles "modulares" usan en su JSX:

| Profile | Clases usadas que SOLO existen en `monitoreo.css` |
|---|---|
| Territorial (workbenches) | 517 de 543 |
| Acreditación | 420 de 646 |
| Telefónico | 350 de 689 |
| Aulas | 0 de 17 (único desacoplado) |

Acreditación, Telefónico y Territorial hacen `import "../../monitoreo.css"` directo.
Además hay **98 selectores definidos a la vez** en `monitoreo.css` y `profilePage.css`
(`is-active`, `is-error`, `is-cumple_meta`…): doble fuente de verdad en cascada, colisiones
silenciosas al tocar cualquiera de los dos.

### Duplicación de código medida

- **Telefónico↔Acreditación: 492 de 544 símbolos top-level compartidos** (~20k líneas de
  fork; todo fix se aplica dos veces). Ejemplos con diff mínimo: `*ActorGoals.ts` (8 líneas
  distintas de 55), `*PhoneDailyTrend.ts` (22 de 247), `*PhoneAlerts.ts` (~52% idéntico).
- **Profiles↔monolito: 78-79 símbolos top-level duplicados** por página (`DataTable`,
  `formatDate`, `buildReportSheetStats`, `phoneAttemptBucketValue`…), p. ej.
  `MonitoreoPage.tsx:44957` vs `AcreditacionMonitoreoPage.tsx:10453` vs
  `TelefonicoMonitoreoPage.tsx:11489`.
- Registro de vistas duplicado: `core/monitoreoRegistry.ts:162-167` vs
  `MonitoreoPage.tsx:1038-1089`.

### Backend: un engine para todo

`monitoreo_engine.R` = 41.690 líneas, **999 funciones**, sirve a las 4 familias con
polimorfismo por `family` (normalización en `:496-522`; 100+ condicionales por familia).
Censo de prefijos: 279 `publication_*`, 186 `territorial_*`, 68 `sheets_*`, 25
`acreditacion_*`. `router_monitoreo.R` (8.265 líneas, 71 endpoints) no es delgado: 178
funciones top-level propias, lógica de dominio (`.monitoreo_territorial_source`, `:1589`) y
caches de dashboard (`:46-108`); llama a 120 funciones distintas del engine.

### Las 5 ataduras más difíciles de cortar

1. `monitoreo.css` global (67k) con 350-517 clases por profile y 98 selectores duplicados.
2. Engine backend único + estado de sesión compartido (un solo blob `monitoreo_config` y
   caches por proyecto para las 4 familias).
3. Telefónico sin identidad en la API: extraerlo obliga a desenredar acreditación a la vez.
4. El fork de ~20k líneas acred↔telefónico: antes de extraer hay que decidir qué se re-unifica.
5. Grafo mixto en la raíz del feature (`internalQueries.ts` —949 líneas, 6 consumidores
   modulares + monolito—, `territorialDuration`, `routeCoverageModel`, `salidas/`,
   `components/`, `shell/`) + la funcionalidad de aulas atrapada en el monolito.

## 2. Performance y caché (por qué es el módulo más lento)

Dato clave: **no hay polling de datos** (solo polling de jobs, `useJob` 400→800→1500 ms).
La lentitud viene del backend síncrono y del patrón de invalidación.

### Top 5 cuellos de botella

1. **CRÍTICO — Mutaciones reconstruyen el dashboard completo en el main-thread de plumber
   (y hasta dos veces).** `.monitoreo_store_config` (`router_monitoreo.R:3637-3662`)
   reconstruye el dashboard inline y en `:3660` invalida incondicionalmente el token que
   acaba de escribir; en acreditación `POST /api/monitoreo/config` termina haciendo **doble
   rebuild full por request** (`router:7744-7753` + `:84`). Ajustes apply/reset/revert
   (`router:6886-6955`) corren el hot path histórico (classify_gps/safe_name) inline. De 71
   endpoints, **solo 7 usan `job_submit`**. Plumber es single-threaded: mientras corre esto,
   toda la app se congela.
2. **CRÍTICO — Costo fijo por cada `GET /monitoreo/state`, incluso con cache hit**: sha256
   del dataframe completo para el token (`router:48` → `engine:427-433`) + otro sha256 de la
   data filtrada por fase (`router:2393`), copia/mutación del df por request
   (`engine:4311`), `monitoreo_normalize_config` (64 call sites) y `monitoreo_variables`
   (`engine:3887-3906`) que hace `unique(trimws(as.character(x)))` por columna **sin caché
   en cada state**. El boot territorial hace ~5 states (uno por scope).
3. **ALTO — Payloads fila-por-fila y sin cap**: patrón `lapply(seq_len(nrow(df)), function(i)
   df[i, , drop=FALSE])` en 40+ call sites (`engine:7067-7077`, `router:119-130`); scopes
   `validation_summary`/`full` serializan un registro por respuesta + todos los puntos GPS
   sin cap (`engine:15013-15022`; `queries_summary` sí capea a 5.000). Varios MB de JSON por
   request en bases medianas.
4. **ALTO — Invalidación nuclear**: el token de caché incluye `toJSON(cfg)` del config
   completo (`router:16-21,46-65`) → cualquier cambio de config invalida los 7 scopes;
   en frontend `applyTerritorialPageState` hace `clearScopeStateCache()` tras cada mutación
   (`TerritorialMonitoreoPage.tsx:1836-1842`). El ciclo mutación barata → invalidación
   total → N rebuilds caros es la causa del "problema recurrente de caché".
5. **MEDIO-ALTO — Render monolítico sin memoización**: 0 `React.memo` en los 4 page-files
   gigantes (265+119+113 `useState`); cualquier setState re-renderiza el árbol completo y
   puede disparar `Plotly.react` en los charts cuyos callers no memoizan
   (`lib/PlotlyChart.tsx:86`).

Notas: `safe_name` ya está memoizado (`engine:155-171`, pendiente histórico parcialmente
saldado) pero sigue en el hot path vía `vapply` elemento-por-elemento (152 call sites). El
sistema de caché por scope (backend + frontend con prefetch escalonado) está bien diseñado;
el problema es el costo del miss/hit, la invalidación total y el hilo único — no su ausencia.
El endpoint de mapa (caché por capa con `hash`/`not_modified`) es el patrón bueno a replicar.

## 3. Palancas priorizadas

Performance (retorno inmediato sin tocar la arquitectura):

1. Mover el rebuild de dashboard de las mutaciones a jobs callr (o responder sin `state` y
   dejar que el GET cachee). Elimina los congelamientos de app.
2. Reemplazar el sha256 de la base por un fingerprint barato (nrow/ncol/`synced_at`/versión
   de snapshot — ya están en el token; el digest es redundante).
3. Cachear `monitoreo_variables` junto al snapshot; vectorizar `.monitoreo_territorial_df_rows`
   (listas por columna, no por fila).
4. Token de caché por scope con el sub-config relevante; invalidación selectiva en frontend
   y quitar la invalidación incondicional de `router:3660`.
5. Cap/paginación para `response_audit`/`map_points` (espejo del cap de `queries_summary`).

Arquitectura (reducción por extracción, nunca reescritura big-bang):

6. **Cortar la atadura CSS**: particionar `monitoreo.css` por familia + kit común y resolver
   los 98 selectores duplicados. Es el prerrequisito de cualquier extracción limpia.
7. **Re-unificar el fork acred↔telefónico** en un core compartido parametrizado por familia
   (los diffs medidos son mínimos: 8/55, 22/247 líneas) antes de seguir divergiendo.
8. **Completar aulas/cursos-horario como módulo piloto**: migrar import/sync/agenda del
   monolito y RecopiladoresPage al profile, borrar los endpoints sin consumidor. Es el tipo
   más cerca de ser 100% modular y valida el camino para los demás.
9. **Regla de extracción en caliente para el backend**: cada fix que toque
   `monitoreo_engine.R`/`router_monitoreo.R` extrae el tema tocado a
   `monitoreo_<tema>.R` (el patrón `monitoreo_aulas_universitarias.R` /
   `reporte_filter_guards.R` ya demostró que funciona).
10. Al final del camino: retirar la superficie legacy (`?monitoreoSurface`), las páginas de
    comparación dev y el propio `MonitoreoPage.tsx`.

## 4. Ciclo sync→dashboard→Sheets (diagnóstico 2026-07-23, unidad 3.8)

El corazón del monitoreo en tiempo real. Causas priorizadas:

1. **SurveyMonkey siempre baja todo**: `sm_api_fetch_all_responses_bulk`
   (`surveymonkey_api.R:683-725`) pagina secuencial con `since=NULL` y filtra el delta
   LOCALMENTE tras descargar; la API v3 sí soporta `start_modified_at` (validar contra un
   survey real antes de comprometerlo). El enriquecimiento de destinatarios hace hasta 1
   request por destinatario (~840+ requests con 3 colectores × 800), sin ningún manejo de
   rate limit ni backoff 429 (los fallos caen a `tryCatch → NULL` desperdiciando 20s c/u).
2. **Sheets reescribe el 100% en serie y en main-thread**: `monitoreo_sheets_publish_tabs`
   (`monitoreo_engine.R:5766-5857`) hace clear+PUT por pestaña (~20-25 requests por
   publicación) aunque nada cambió; `/publication/sheets` y `/sheets/sync` corren síncronos
   en plumber (`router_monitoreo.R:6107-6147`, :5908-5940) y el bundle del preflight se
   computa DOS veces. Palanca: `values:batchUpdate` único + skip por hash + job.
3. **Post-pull O(histórico), no O(delta)**: `kobo_api_flatten_results` hace round-trip
   toJSON/fromJSON del total; `monitoreo_normalize_config` se recalcula sobre el frame
   combinado completo en cada sync.
4. **Incremental solo Kobo y frágil**: cursor `_id > n` solo en modo advance, con fallback
   SILENCIOSO a full ante cualquier error; no ve ediciones/borrados. No existe auto-sync
   (todo manual); nada impide un tick de 1-2 min una vez que SM sea incremental y el
   post-pull sea O(delta).
5. **Transporte sin red de seguridad**: Kobo sin timeout (socket colgado = sync infinito),
   ninguno con retries, paginación estrictamente secuencial (Kobo expone `count`: las
   páginas 2..N podrían ir en paralelo con `curl::multi`).

Hipótesis falsable: cursor SM server-side + batchUpdate con skip por hash ⇒ ciclo
sync→sheets con delta pequeño baja de minutos a <10s sin cambiar ningún número.

**Resultado de la validación e2e (2026-07-23, proyectos reales, unidad 3.8):**

- **SurveyMonkey (CONTA, 4 fuentes)**: `/responses/bulk` SÍ respeta `start_modified_at`
  server-side — la incertidumbre quedó resuelta afirmativamente. Avance 1 (siembra
  cursores): fetched 16/197/47/19. Avance 2: incremental en las 4 fuentes, fetched
  3/2/2/1, sin fallback. Kill-switch `PROSECNUR_SM_CURSOR=0` disponible.
- **Kobo (ACNURCG, 2 fuentes)**: incremental verificado (fetched 0 en ambas). La
  validación destapó un **bug latente preexistente**: el loop de `monitoreo_sync_sources`
  pisaba el modo solicitado con el modo resultante de cada fuente — solo la fuente 1
  aprovechaba el incremental y las 2..N re-bajaban TODO en cada Avance (1,697
  submissions). Fix `46c724c4` con test de regresión.
- **Sheets (interno ACNURCG, Google API real)**: publicación con cambios = **3s** (un
  batch, 4 pestañas); re-publicación sin cambios = **1s** con `written_ranges: []` y las
  4 pestañas skipeadas por hash (antes ~20-25 requests reescribiendo siempre). Destapó
  otro bug preexistente (corte 3.4.2): `frozenRowCount=1` en pestaña solo-header hace
  que Google rechace el batch entero — fix `5639bfad`.
- **Cierre de fase (2026-07-23, tras unidades 3.3–3.6 y 3.10/3.8b/3.4b)**: Avance con
  delta 0 medido e2e en ACNURCG = **9s** (meta <10s cumplida; antes ~69-77s; el primer
  Avance de cada sesión tarda ~88s porque siembra el token — los tokens ya no viajan en
  el .pulso por diseño). `monitoreo_variables` 310ms→0.03ms en hit; transpose 12×;
  payloads −59%; publicación Sheets con async=true opt-in y preflight sin doble cómputo.
  CONTA no tiene spreadsheets de publicación persistidos en su `.pulso`; la validación
  del path cliente queda pendiente de los IDs.

## 5. Uniformidad de controles de avance (inventario 2026-07-23, unidad 3.9)

`shell/MonitoreoModuleChrome.tsx` es el canónico de facto (los 5 paths lo montan). Las
divergencias: Aulas con label "Vista" y sin sync de fuente; Territorial sin botón "Todo"
en el chrome (el sync completo vive escondido en `TerritorialSourceConsole.syncKobo`) y
con barra de progreso bespoke; `SourceSyncActions` triplicado (monolito/acred/tel) con
solo spinner; y el monolito alimenta al chrome un **% simulado por escalones**
(`MonitoreoPage.tsx:4444-4479`) en vez del progreso real del job. Plantillas a copiar:
Acreditación y Telefónico (par Avance/Todo + % real vía `runProfileSourceSync`).

**Validación e2e del path acreditación (CONTA, 2026-07-23, unidades 3.10b/c):**

- POST /config: **6.2s sin congelar** (antes: doble rebuild full — el bug era de esta
  familia). GET state: build 4.8s, hit 0.8s.
- Dedup de frontera del cursor SM (3.10b): fetched 0 en las 4 fuentes, el no-op se
  dispara ("Sin respuestas nuevas"). Skip de details/enrichment (3.10c): el pull con
  cursores tarda **4.7s las 4 fuentes** in-process (antes ~23s con details+enrichment).
- **3.10d RESUELTO (causa raíz)**: el on_complete hidrataba collectors SM con red
  síncrona DENTRO del event loop de plumber (ninguna respuesta HTTP sale mientras
  dura) — el guard solo saltaba mode "advance" y con cursor el summary reporta
  "incremental"; como el avance nunca trae collectors del worker, CONTA pagaba 37s+
  de red en CADA avance. Fix 18d4d72d (guard advance+incremental) con test rojo→verde;
  validado e2e: Avance SM con delta 0 = **13s** (antes 54-206s), a la par del
  benchmark Kobo (9s). El profile acreditación validado visual con CONTA (ok=true).
- **Residual 3.10e (abierto)**: bloqueo intermitente del main thread (~178s en 1 de 3
  corridas post-fix, GETs de poll con timeout) — algo distinto a collectors bloquea el
  event loop esporádicamente. Serie: 46s siembra / 178s bloqueado / 13s ok. Siguiente
  paso: logging con timestamps en harvest/on_complete.

## Histórico de mediciones

| Fecha | Nota |
|---|---|
| 2026-07-23 | Registro inicial (auditoría integral; agentes arquitectura + performance) |
