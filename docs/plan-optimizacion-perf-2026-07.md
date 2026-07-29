# Plan de optimización de performance — julio 2026

Evaluación medida (no opinada) de los tres ejes: tiempo de carga, precisión de
la carga de elementos y consumo computacional. Tres auditorías de solo lectura
el 2026-07-29: build de producción real, backend R completo, runtime
frontend/Electron. Loop de convergencia: cada ola termina midiendo de nuevo;
solo Gonzalo cierra el loop.

## Los tres hallazgos que dominan todo

1. **El 74% del payload de arranque es indebido.** El boot descarga ~349 KB gz
   / ~1.99 MB raw, y ~258 KB gz sobran: `monitoreo-core` (JS 52 KB gz + CSS
   **1.28 MB raw** que se parsea en cada apertura de ventana) entra al entry
   solo porque el helper `__vitePreload` de Vite no tiene chunk asignado en
   `manualChunks` y Rollup lo colocó dentro de monitoreo-core; 29 chunks y el
   entry lo importan. La disciplina lazy de las 17 páginas es correcta — la
   fuga es del bundler, no de las rutas. Pintar el BootGate necesita ~91 KB gz.
2. **Los pulls de Carga y SM multibase congelan la app por minutos.** El
   pendiente registrado ("offload del pipeline post-pull" de Monitoreo) ya
   quedó resuelto (Unidad 3.11: fetch en job, merge mínimo, dashboard lazy).
   Lo que nunca se migró es el mismo patrón en `router_carga.R`
   (kobo/sm import/refresh, líneas 1045/1128/1273/1687) y
   `surveymonkey_multibase.R` (4895/4912/5045): fetch paginado completo + 
   pipeline + escritura XLSX de la base entera, todo inline en el hilo único
   de Plumber. Mientras corre, la app entera está muerta — incluido el
   polling de jobs, que corre en el mismo loop.
3. **Durante un sync, la vista más usada se re-renderiza entera cada
   segundo.** `sourceSyncProgress` vive en la raíz de `ProfilePage`
   (~20.000 líneas de árbol) y el tick de progreso lo re-renderiza todo; los
   specs de Plotly se reconstruyen inline y el wrapper los compensa con un
   deep-compare de hasta 50.000 hojas por chart por render. Además el poll
   territorial se auto-recrea y duplica su cadencia real contra el mismo
   Plumber mono-hilo. El frontend y el backend comparten un solo hilo de
   verdad: cada request de más del front es contención de todos.

## Estado de lo que ya está bien (no tocar)

- Lazy por ruta: 17/17 páginas con `lazyWithReload`; plotly (4.8 MB raw) NO
  entra al arranque — se descarga en el warmup con barra (warm start
  intencional, decisión registrada).
- `PlotlyChart` usa `Plotly.react` + purge solo en unmount + resize
  coalescido; el ritmo diario es DOM/CSS, no Plotly.
- Electron limpio: `backgroundThrottling` activo, sin `powerSaveBlocker`, IPC
  con cleanups, updater sin polling periódico.
- Monitoreo backend maduro: fingerprint barato, caches por scope, sync
  Kobo/SM en job. `jobPolling.ts` de calc-muestra es el patrón de referencia
  (timeout + cancel + tolerancia 404).
- El arranque del backend R es razonable; sub-segundo en registrar 26 mounts.

## Regla innegociable: el contrato del warmup

El warm start es decisión registrada del dueño: **cuando el usuario entra,
todo tiene que estar ya disponible y rápido**. Por lo tanto:

- Optimizar el arranque significa mover peso de la **ruta crítica pre-render**
  (antes del primer pixel del BootGate, sin proyecto elegido) hacia la **fase
  de warmup** (espera declarada, con barra) — nunca hacia el momento de uso.
- **Todo lo que salga del arranque estático entra al plan de warmup en el
  mismo commit.** La unidad 1.1 solo aprueba si el registro de warmup precarga
  monitoreo-core (JS + CSS) y los chunks compartidos que salgan del entry.
- El gate de cada unidad de carga mide DOS cosas: payload pre-render abajo
  **y** latencia de entrada a cada módulo tras el warmup igual o mejor.
  Referencia de patrón: plotly (4.8 MB) ya vive así — fuera del entry,
  caliente al entrar.
- Las unidades 1.3 y 3.2 van en esta dirección (agregan cobertura al warmup);
  los offloads de backend (1.4, 2.1–2.3) no calientan menos: quitan
  congelamientos del hilo.

## Olas de ejecución

### Ola 1 — quick wins (esfuerzo bajo, impacto alto)

| # | Unidad | Ahorro | Riesgo |
|---|---|---|---|
| 1.1 | `manualChunks`: asignar `vite/preload-helper` y `src/components`+`src/lib` compartidos a `app-core` | −213 KB gz y −1.28 MB de CSS parseado en CADA arranque (61% del payload pre-render) | Medio: historial de ciclos TDZ (pantalla en blanco); gate = build A/B + smoke de las 9 rutas |
| 1.2 | `bootClient.ts` fuera del chunk `api-client` | −31 KB gz + parse antes del primer pixel | Bajo |
| 1.3 | Prefetch de `AppSuite` en paralelo con el warmup (descargar al inicio de `runWarmStart`, montar al cerrar el gate) | ~100 KB gz fuera de la cola serial; entrar a la suite instantáneo | Bajo |
| 1.4 | `sheets/sync` async por default (el job ya existe, es opt-in por body; `router_monitoreo.R:3920`) | 5–30 s de congelamiento por sync del flujo declarado EL tema | Bajo |
| 1.5 | Poll territorial: sacar `chromeSyncJob` de las deps del efecto (hoy duplica cadencia); cancelar timeouts de `prefetchBackgroundScopes` y darle token a `waitForSourceSyncJob` (hoy hasta 90 s de polling huérfano tras salir del módulo) | Mitad de requests de polling en territorial + cero warmups fantasma | Bajo |
| 1.6 | Reposo real: `home-dot-pulse` anima `box-shadow` (repaint CPU perpetuo en la pantalla donde la app descansa) → compositable o quitar; halo de 28 s del editor XLSForm ídem | Renderer quieto en reposo; macOS puede bajar consumo | Bajo |

### Ola 2 — los bloqueos grandes (esfuerzo medio)

| # | Unidad | Ahorro | Nota |
|---|---|---|---|
| 2.1 | **Offload de imports/refresh de Carga y SM multibase a jobs** | De minutos congelados a app usable — el peor bloqueo del sistema hoy | El patrón exacto ya existe: `monitoreo_sync_job_runner` + `job_save_rds` (`router_monitoreo.R:5939-6001`); `occurrences/sync` y `aulas/sync` entran en la misma ola |
| 2.2 | Aislar `sourceSyncProgress` (+ `loading`/`actionStatus`) del árbol del perfil | El tick de 1 s re-renderiza el chrome, no 20.000 líneas | Cambio neutro en líneas (archivos congelados) |
| 2.3 | `useMemo` sobre `reports` (`reportsFromState`) y los 6 specs de Plotly inline | Elimina normalización O(reporte) por render + deep-compare de 50k hojas × chart × tick | Ídem: neutro en líneas |
| 2.4 | Endurecer `useJob` al nivel de `jobPolling.ts`: timeout + cancel, reintento ante error transitorio, tolerancia 404 | Mata la clase entera de spinners eternos / errores falsos en 10+ features (precisión de carga) | Hoy un solo error de red mata el poll para siempre |

### Ola 3 — fluidez sostenida (esfuerzo medio)

- **3.1** `GET /api/monitoreo/state` con cache hit: saltar
  `.monitoreo_apply_source_metadata_to_data` + `normalize_config` cuando el
  token no cambió, y cachear el JSON serializado por token (hoy el `toJSON`
  se recomputa en cada GET aun con hit). Ahorro: 100–500 ms × poll × scope.
  Medir antes con `PULSO_MONITOREO_TIMINGS`.
- **3.2** Diferir `.dashboard_rebuild_after_load` del open al warmup
  (`/api/project/warmup` con `budget_ms` ya existe como destino). Ahorro:
  1–5 s por apertura con dashboard configurado. El Dashboard ya tolera fuente
  no re-importada.
- **3.3** Aplanar la cadena de red del boot (`BootGate.tsx:934-983`):
  health ∥ bootstrap, recents en paralelo, warmup-plan solapada con
  project/open. Quita 2–4 round-trips seriales contra el hilo único.
- **3.4** Precisión: indicador de edad en scopes cacheados servidos como
  frescos (`loadView` con `setLoading(false)` sin revalidar); hitos de
  progreso reales en `syncProgress.ts` (hoy "En cola · 12%" durante minutos);
  y que la barra de sync no abandone a los 90 s con el job vivo invitando a
  encolar otro.

### Ola 4 — estructural (esfuerzo alto, coordinar con el plan de saneamiento)

- **4.1** Partir `monitoreo.css` (38k líneas) + `profilePage.css` (20k) por
  perfil: `mon-territorial` (2.651 clases), `mon-phone` (1.407) y `mon-acr`
  (1.358) viven en el CSS core aunque sus perfiles tienen chunk propio.
  Con 1.1 esto ya no toca el arranque; sigue costando ~160 KB gz al entrar a
  cualquier perfil. Mismo gate que el split de theme.css (cascada +
  detector). Encaja con la Fase 2 del plan de saneamiento.
- **4.2** Gating por viewport en `PlotlyChart` (IntersectionObserver): el
  Dashboard monta 25–40 instancias vivas a la vez y las offscreen siguen
  recibiendo updates. + virtualización de filas del Dashboard
  (`ResumenTab` renderiza todas las preguntas sin cap; el patrón
  `@tanstack/react-virtual` ya existe en territorial).
- **4.3** Backend menor: mover el reinstall-guard del launcher fuera del
  camino síncrono de arranque en dev; bind del puerto antes de cargar el
  bootstrap `.pulso`.

## Métricas del loop (medir al cierre de cada ola)

| Métrica | Hoy (2026-07-29) | Norte |
|---|---|---|
| Payload estático pre-render (gz) | ~349 KB (91 KB necesarios) | <120 KB |
| Latencia de entrada a módulo tras warmup | baseline a medir en 1.1 | igual o mejor que hoy (contrato del warmup) |
| CSS parseado en el arranque | 1.32 MB raw | <60 KB |
| Congelamiento por import/refresh de Carga/SM | minutos (inline) | <1 s (job + merge) |
| Re-render por tick de sync en perfiles | árbol completo (~20k líneas) | solo chrome de progreso |
| Polls duplicados/huérfanos | territorial ×2; hasta 90 s post-unmount | 0 |
| Spinners sin salida (useJob sin timeout) | 10+ features | 0 (patrón jobPolling) |
| Animaciones perpetuas en reposo | 2 con repaint CPU | 0 |

## Bitácora del loop

- **2026-07-29 · Ola 1 ejecutada (1.1, 1.2, 1.3, 1.5, 1.6)**: payload estático
  pre-render **349 → 128 KB gz (−63.3%)**; index.html queda con
  app-core + index solamente (monitoreo-core y api-client fuera, 1.28 MB de
  CSS ya no se parsean por arranque); contrato del warmup verificado
  (warmupRegistry precarga MonitoreoShell → arrastra monitoreo-core JS+CSS, y
  el fallback sin plan del backend incluye monitoreo/monitoreo_datos);
  prefetch de AppSuite solapado con el warmup; cero ciclos de chunks
  (anti-TDZ verificado); smoke de producción en runtime OK (BootGate monta,
  consola limpia). Polls: territorial deja de duplicar cadencia,
  `waitForSourceSyncJob` y los prefetch de scopes con cancelación al unmount,
  Acreditación en paridad de guards con Telefónico. Reposo: `home-dot-pulse`
  compositable (transform/opacity en ::after) y halo del editor pausado salvo
  hover/foco. Boy-scout: Telefónico −60 líneas, Acreditación −50; líneas base
  bajadas (21517 / 19582). Flip de cascada por la salida de monitoreo-core.css
  del index.html: descartado con el detector (0 empates que involucren hojas
  de monitoreo). **Pendiente de la ola**: 1.4 (`sheets/sync` async por
  default) — cross-layer, exige congelar contrato; entra con la Ola 2.

- **2026-07-29 · Ola 2 casi completa (2.1, 2.2, 2.3, 2.4)**: los 7 endpoints
  de import/refresh de Carga/SM multibase tienen camino async opt-in
  (sandbox de sesión + diff; result_data = payload síncrono exacto; secretos
  por job_save_rds; 539 aserciones). El tick de sync re-renderiza solo el
  wrapper del chrome (store zustand por perfil) y los 4 charts de avance van
  memoizados con builders puros. `useJob` reintenta transitorios, declara
  `lost` tras 5×404 y expira a los 30 min con cancel — spinners eternos
  cerrados de raíz. Boy-scout mayor: Telefónico −983 y Acreditación −1,018
  líneas (bases 20534/18564). Pase visual /ver-ui sobre acrconta en verde;
  mecanismos de reposo confirmados en CSSOM vivo. **Restan de la ola**: la
  adopción frontend de async + `sheets/sync` (en curso) y el smoke del worker
  callr real (va al gate de /preparar-release).
- **2026-07-29 · OLA 2 COMPLETA + Ola 3 en marcha**: adopción async aterrizada
  (bd58e96d) — 13 call sites de Carga/multibase/sheets lanzan jobs con
  progreso real y la UI queda navegable durante el pull; boy-scout acumulado
  del día en los monolitos: Telefónico 21,577→20,483 y Acreditación
  19,632→18,513 (−2,213 líneas netas). Ola 3.1 commiteada (83056eb0):
  derivados del GET state 108→10 ms con paridad byte a byte. En vuelo: 3.2
  (rebuild del dashboard → warmup) y 3.3 (aplanar cadena de red del boot).
  Pendiente visual residual: ver los flujos de import con progreso en vivo
  exige credenciales de plataforma; se cubrirá en la próxima corrida de
  reference-project con secretos locales.

## Protocolo

1. Cada unidad se ejecuta por la rama que corresponda (1.1–1.3 frontend;
   1.4, 2.1, 3.1–3.3 backend-r; 2.2–2.4 frontend en archivos congelados con
   cambio neutro en líneas) y termina en `verificador`.
2. Las unidades sobre archivos congelados no suben líneas base; las de
   monolitos aprovechan la regla boy-scout del plan de saneamiento (extraer
   el componente que se toca).
3. Re-medir la tabla al cierre de cada ola. El loop lo cierra Gonzalo.
