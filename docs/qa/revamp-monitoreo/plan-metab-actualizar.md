# Meta B · M1 — control único «Actualizar ▾» (L38), paso N de M y recibo (L25)

Origen: auditoría de la Meta B, filas 10, 11, 14 y 16 y brechas 1 y 3. Gonzalo: «La auditoría de la Meta B es algo
que todos los monitoreos deben tener para que no perdamos ninguna funcionalidad propuesta allí». Norma:
`estandar-de-ficha.md` §2a (píldora) y §2b (Actualizar explica, muestra el paso y deja recibo).

## Fase 1 — Telefónico, Acreditación y lo común (hecha)

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | Un solo «Actualizar ▾» en la barra del modo: el cuerpo trae lo nuevo y recalcula; el menú ofrece una entrada por fuente, «Traer todo de nuevo» y «Recalcular» | `sync/menuDeActualizar.ts` (plan), `sync/useActualizarDelModo.ts` (hook), `shell/BarraDelModo.tsx` (`MenuDeActualizar`) | Hecho |
| 2 | Retirar la franja «Sheets · Kobo/encuestas · Todo» sin perder capacidades | `profiles/{telefonico,acreditacion}/*MonitoreoPage.tsx`; borrados `components/SourceSyncActions.tsx` y `profiles/*/sync/useSourceSyncActions.ts` | Hecho |
| 3 | Píldora con «Al día», «Actualizando, paso N de M», «Falló», «Preparando», sin fecha | `shell/BarraDelModo.tsx`, `core/barraComun.ts`, `sync/pasosDelSync.ts`; `step`/`steps` en `api/R/jobs.R` y `api/R/monitoreo_engine.R` | Hecho |
| 4 | Recibo no bloqueante al terminar: filas por fuente, si recalculó o falló | `sync/reciboDelSync.ts` + Toaster global (ADR 0047) | Hecho |
| 5 | Un sync a la vez: el menú también queda apagado | `HerramientasDelModo` (`ocupado`) + guarda en el hook | Hecho |
| 6 | (Encargo añadido) Mientras se lee el proyecto, el chrome no publica «Registros 0» ni «Sin sincronizar» (L21) | Prop `cargando` en `shell/MonitoreoModuleChrome.tsx` y `HerramientasDelModo` («Leyendo…», también en CORTE); Tel y Acr pasan `loading && !state`; test en `shell/corteDiceSuFecha.test.tsx` | Hecho; Territorial y Cursos-horario sólo tienen la prop disponible |

### Decisiones

- **Cuerpo = avance.** «Actualizar» lanza `sync_mode = advance` con `fuentesSincronizables(…, "advance")`: en
  telefónico, universo, barrido y Kobo; en acreditación, las respuestas de plataforma. Si el estudio no tiene
  fuentes de respuesta, el cuerpo lee todas las activas (`full`). Antes el cuerpo era `full` y el avance vivía en el
  menú; L38 y Territorial ya ponían «traer lo nuevo» en el cuerpo.
- **La píldora manda sobre L38.** Sale «Pendiente» (ámbar). Los cambios sin recalcular (`pending_regeneration` o
  `generation_status = stale`) se leen como «Preparando», con el motivo en el `title`, y la entrada «Recalcular» del
  menú lo dice en su detalle («Hay cambios sin recalcular»). «Parcial» se sigue leyendo como «Falló», igual que antes.
- **Pasos.** El job ya escribía `current`/`total`, pero dentro de una fuente esos números son registros de Kobo o
  SurveyMonkey: no contaban fuentes. Cambio aditivo: `job_progress_writer()` acepta `step`/`steps` y
  `monitoreo_sync_sources()` los escribe (fuente `i` = paso `i`; paso `N + 1` = unir el snapshot y recalcular).
  Las fases del `on_complete` (`merge`, `metadata`, `save`) no los repiten; el front conserva el último paso, que no
  retrocede. Con un backend anterior, la píldora dice «Actualizando» sin número. Test:
  `api/tests/testthat/test-monitoreo-sync-pasos.R`.
- **Recalcular** no lanza job: limpia la caché de scopes y relee el estado con `force`; el backend rehace el tablero
  en ese GET (build lazy).
- **Recibo.** Se reutiliza el Toaster global (`components/toasterStore.ts`, ADR 0047): `role="status"`/`alert`,
  auto-cierre por tono, Escape y `prefers-reduced-motion`. Texto: «Actualizado» / «Actualizado en parte» / «No se
  pudo actualizar» / «Se trajo, pero falló el recálculo» / «Tablero recalculado», con detalle por fuente («PDM Kobo:
  41 nuevas · Universo: 1,009 leídas · Recalculado»). En una fuente incremental `rows` son filas nuevas; en una
  completa, leídas.
- **Al salir del módulo** el poll se corta y no hay recibo de fallo: el job sigue en el backend.

### Qué tenía la franja y dónde quedó

| Botón de la franja | Qué hacía | Dónde quedó |
|---|---|---|
| Sheets | Todas las hojas activas por `/api/monitoreo/sheets/sync` (job async) | Una entrada por hoja y, con dos o más, «Las N hojas de Sheets»; mismo endpoint |
| Kobo / encuestas | Todas las fuentes de plataforma activas por `/api/monitoreo/sync`, `full` | Una entrada por encuesta y, con dos o más, «Las N encuestas (de Kobo)»; mismo endpoint y modo |
| Todo | Todas las activas por `/api/monitoreo/sync`, `full` | «Traer todo de nuevo» |
| Mensaje de estado de la franja | Texto «Sheets sincronizadas: N registros» | Recibo (toast) |

`AcreditacionSourcePackageConsole` (dos copias, con su propio «Todo») no se montaba en ninguna parte: se borró.
Qué se lee y escribe en Kobo, Sheets y SurveyMonkey no cambió.

### Pendiente de esta fase

- Selectores CSS muertos de la franja fuera del glob: `.mon-source-sync-actions` en `monitoreo.css`,
  `.mon-acr-source-sync-actions` en `profilePage.css`, `acreditacion/insumos/insumos.css`,
  `acreditacion/fuentes/fuentes.css` y `acreditacion/navegacion/chromeAcreditacion.css`.
- `AcreditacionSourceBlueprint` quedó sin consumidores en los dos perfiles (sólo lo montaba la consola borrada).
- §2b pide además que el menú diga duración aproximada y «qué no toca». No hay dato de duración en el `.pulso`
  (L23, brecha 4); se agrega cuando exista la estimación aprendida.
- Dedupe en `job_submit` (fila 14): sigue sin existir; el front bloquea con `ocupado` y con la guarda del hook.
- El `Toaster` monta su región `aria-live` sólo cuando hay avisos; algunos lectores de pantalla anuncian mejor una
  región presente desde el arranque (componente compartido, fuera del glob).

## Fase 2a — Territorial (hecha)

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 7 | Retirar «Sincronizar respuestas» y «Sincronizar piloto/campo» sin perder capacidades | `TerritorialSourceConsole.tsx` (también «Actualizar <fase>» de su banda), `TerritorialModelWorkbench.tsx` (también su tira «Job Kobo»), `TerritorialFieldOccurrencesWorkbench.tsx` («Actualizar» de ocurrencias) | Hecho |
| 8 | Lanzamiento inyectable por perfil, aditivo | `sync/ejecutarActualizacion.ts` (`LanzadorDeActualizacion`, `lanzarPorDefecto`), `sync/useActualizarDelModo.ts` (`plan?`, `lanzar?`), `sync/menuDeActualizar.ts` (`PlanDeActualizar`, `PeticionDeTraer`) | Hecho; Tel y Acr no pasan ninguno y siguen igual |
| 9 | Menú territorial: cuerpo, «Traer todo de nuevo», «Recalcular» (antes «Solo recalcular») y una entrada por fuente | `profiles/territorial/sync/planTerritorial.ts` | Hecho |
| 10 | Paso N de M en el sync territorial | Ya lo escribía `monitoreo_sync_sources` (fase 1); test nuevo `test-monitoreo-territorial-sync-pasos.R`; ocurrencias como paso 1 en `lanzadorTerritorial.ts` | Hecho |
| 11 | `cargando` al chrome | `TerritorialMonitoreoPage.tsx`: `loadingView === "initial" && !state` (la página no tiene `loading`) | Hecho |
| 12 | Recibo al terminar | Mismo Toaster y `reciboDeSync`; el lanzador suma la fila de ocurrencias | Hecho |

### Decisiones

- **La premisa del plan no se cumplía.** El Kobo territorial sí va por `/api/monitoreo/sync` (una fuente, la de la
  fase activa); `monitoreo_territorial_cache.R` sólo tiene el precalentamiento y el mapa del arranque, que no son
  parte de «Actualizar». Por eso no hubo cambio en R: el job ya publicaba `step`/`steps` desde la fase 1 y el test
  nuevo fija que el camino territorial (perfil `territorial`, modo avance) los conserva. Lo que no va por el job son
  las **ocurrencias de campo** (`/api/monitoreo/territorial/occurrences/sync`, llamada directa) y la **hoja de ruta**
  (`/api/monitoreo/sheets/sync`). El lanzador inyectable existe para las ocurrencias; la hoja usa el camino común.
- **Lanzador.** `ejecutarActualizacion` recibe `lanzar(peticion, { config, reportar, cancelado })` y devuelve lo
  traído en la forma del recibo (`{ tipo: "sync", resultado }` o `{ tipo: "hojas", resultado, cuantas }`). El de
  Territorial separa de la petición la clave de las ocurrencias, las trae primero y delega el resto en
  `lanzarPorDefecto`. Antes el cuerpo las disparaba aparte, sin esperar y tragándose el fallo; el Plumber mono-hilo
  ya las atendía antes que el job, así que el orden real no cambia. Ahora su resultado entra al recibo y un fallo
  dice «Actualizado en parte» en vez de perderse. La `config` que va al job es la misma `state.config` de antes.
- **Pasos.** Con ocurrencias: ocurrencias = paso 1; el job publica `step`/`steps` (N fuentes + recálculo) y el
  lanzador los corre uno (`paso + 1`, `pasos + 1`). Mientras corren las ocurrencias, el total se anticipa con la
  regla del motor (fuentes + 2); cuando llega el del job, manda el del job. Sin ocurrencias, los pasos son los del
  job tal cual. Las ocurrencias solas son «paso 1 de 1».
- **Cuerpo = avance del Kobo de la fase activa + ocurrencias** (lo que hacía `syncAdvance`). **Traer todo de nuevo**
  = el mismo conjunto en modo completo (antes `syncField`: sólo el Kobo de la fase activa; las ocurrencias se leen
  siempre enteras, así que sumarlas no cambia qué se lee de Kobo). **Por fuente**: el Kobo de campo y el de piloto si
  son distintos (si es el mismo, una entrada «piloto y campo»), las ocurrencias y la hoja de ruta si existe, cada
  una completa. El Kobo de la otra fase es nuevo en el menú: lo pidió el encargo; antes sólo se podía traer
  cambiando de fase.
- **Recalcular** relee el corte de la vista con `force`. Tras cualquier entrada se invalidan los cortes de la
  fase y fuente (como una mutación territorial, `invalidateScopeStateForSource`): lo traído cambia todos.
- **Store propio** `profiles/territorial/sync/syncStore.ts` y `TerritorialModuleChromeConSync.tsx`: el tick por
  segundo no re-renderiza la página. Se borraron `chromeSyncJob`/`chromeSyncJobId` y su poll.
- **Publicar no entra.** La escritura al Sheets territorial vive en Avance › Salidas
  (`TerritorialOutputsPanel` → `salidas/MonitoreoOutputsWorkbench`), intacta; «Actualizar» sólo lee.

### Qué tenía cada botón heredado y dónde quedó

| Botón | Qué hacía | Dónde quedó |
|---|---|---|
| «Sincronizar respuestas» (consola de fuentes, Formulario) | `syncField`: Kobo de la fase activa, `full` | «Traer todo de nuevo» y la entrada del Kobo de esa fase |
| «Actualizar <fase>» (banda de la consola) | Lo mismo | Igual |
| «Sincronizar piloto/campo» (Modelo) | `apiMonitoreoSync(config, [kobo de la fase])`, `full` por omisión, con tira «Job Kobo» | Igual; la tira la reemplazan la píldora y el recibo |
| «Actualizar» (Ocurrencias, legado) | `/territorial/occurrences/sync` | Entrada «Ocurrencias…» del menú y dentro del cuerpo |
| «Solo recalcular» (menú) | `refreshCurrentView` | «Recalcular» |
| «Traer nuevas» / «Traer todo de nuevo» (Insumos › Conexiones) | `syncAdvance` / `syncField` | Siguen, y ahora llaman al cuerpo y a «Traer todo de nuevo» del hook |

### Verificación de la fase 2a

- `tsc` sin errores; `make gate-front AREA=monitoreo`: 549 archivos, 6060 tests en verde.
- `make gate-area AREA=monitoreo GATE_ARGS='--patron "territorial|sync|jobs"'`: 913 pass, 0 fail.
- Capturas con `acnurcg2.pulso` (dos Kobo, campo y piloto, más ocurrencias; sin hoja de ruta) a 1440x1000 y
  1024x600: barra, menú abierto (`--click-tab "Más formas de actualizar"`), consola de fuentes y Modelo › Manzanas.
  `ok=true issues=0 geometryIssues=0 scrollJails=0`; 8 capturas distintas. Cardinalidad baja (0 o 1 fuente, sin
  ocurrencias, hoja de ruta) cubierta por `planTerritorial.test.ts`: no hay un `.pulso` territorial con esa forma.
  Sin sync real.

### Pendiente de esta fase

- «Sincronizar» de la hoja de ruta sigue en el formulario de conexión de la consola (Conectar → Sincronizar): es
  parte de dar de alta la fuente. Con la hoja conectada, también está en el menú.
- Las reglas base de `.mon-territorial-source-command` en `monitoreo.css` (fuera del glob) reservan aún una tercera
  columna para el botón retirado en las pestañas Padrón e Historial de la consola; las de Formulario, Filtro y
  Conciliación ya tienen dos (`territorialProfile.css`).
- `estadoDelModo` de `navegacion/barraTerritorial.ts` sigue sin «Preparando» por cambios sin recalcular; se
  reemplaza por el de `core/barraComun.ts` cuando entre Cursos-horario (punto 3 abajo).

## Fase 2b — Cursos-horario (no en esta corrida)

1. **Cursos-horario.** No tiene barra común: «Avance» y «Traer respuestas» viven en `AulasMonitoreoPage.tsx:2040-2056`
   y otro «Traer respuestas» en `AulasOperationsPanel.tsx:259`. Va después de que el modo reciba el esqueleto
   Insumos · Modelo · Control · Avance (brecha 2): entonces se le pasa `barraDelModo` con `useActualizarDelModo`,
   «Traer respuestas» pasa a ser el cuerpo y el segundo botón se retira. Cuidado: «Traer respuestas» también
   re-publica el libro del Sheets; eso es escritura hacia afuera y, por L38, vive en Publicar, no en Actualizar.
   Hay que separarlo antes de unificar. Si su sync no va por `/api/monitoreo/sync`, usa `lanzar` como Territorial.
2. Con los cuatro modos en el hook, `estadoDelModo` de `profiles/territorial/navegacion/barraTerritorial.ts` se
   reemplaza por el de `core/barraComun.ts`.

## M7 — Un sync a la vez también en el backend (hecha)

Fila 14 de la auditoría de Meta B. El front ya apagaba «Actualizar» con `ocupado`, pero `job_submit` aceptaba un
segundo job de sync de la misma sesión (dos pestañas, o la API llamada directo).

- **Dónde vive.** `api/R/jobs_dedupe.R`, que es opt-in: `job_submit(..., dedupe_key = )`. Sin `dedupe_key`, ningún
  job cambia (reportes, PDF, prewarm, mapa, publicación).
- **Clave.** Sesión + `dedupe_key`. `POST /api/monitoreo/sync` usa `"monitoreo.sync"` y el sync async de hojas
  (`POST /api/monitoreo/sheets/sync` con `async`) usa `"monitoreo.sheets_sync"`. No se separa por perfil ni por
  `sync_mode`, porque todos escriben el mismo `monitoreo_snapshot` de la sesión. Las dos claves son distintas porque
  el front lee cada resultado con su propio normalizador: devolverle un job de hojas a quien pidió un sync le
  armaría un recibo equivocado.
- **Respuesta.** Si la clave está ocupada, el endpoint responde 200 con el `JobStart` del job vivo y
  `ya_en_curso: true` (sin 409). Los insumos del pedido repetido, tokens incluidos, se borran con su propio
  `on_cleanup` (ADR 0005). Toda respuesta trae ahora `ya_en_curso` (`false` cuando lanza un job nuevo).
- **Cuándo se libera.** La clave queda libre en cuatro casos:
  - El job terminó, falló o se canceló: su status deja de ser `running`.
  - Es huérfano: el proceso murió (`rx$is_alive()` es FALSE) y nadie lo consultó. Se cosecha con `job_poll`, que
    aplica su resultado si lo hay, y se lanza el nuevo.
  - Está colgado: sigue vivo, pero pasó el tope. Se cancela con `job_cancel`, que mata el proceso y corre su
    `on_cleanup`, y se lanza el nuevo. El tope es de 30 min y se ajusta con
    `options(prosecnurapp.jobs_dedupe_tope_secs = )`.
- **Lo que queda fuera.** Un sync de hojas y uno principal pueden correr a la vez porque tienen claves distintas.
  El front los lanza en serie (`lanzadorTerritorial.ts`), y los `on_complete` se aplican uno por uno en el hilo
  único de Plumber, cada uno sobre el snapshot vigente. Tampoco entran las ocurrencias de campo de Territorial:
  son una llamada síncrona, sin job.
- **Front.** No necesita cambios. `lanzarPorDefecto` ya sigue el `job_id` que recibe con `esperarJobDeSync`. Con
  `ya_en_curso`, la segunda pestaña se engancha al progreso del job que ya corre y su recibo muestra el resultado
  de ese job. Pendiente opcional: agregar `ya_en_curso?: boolean` a `JobStart`/`AsyncJobStart` en
  `frontend/src/api/` y avisar «Ya había una actualización en curso; se muestra su avance». No se tocó porque el
  tipo no lo exige.
- **Prueba.** `api/tests/testthat/test-jobs-dedupe-sync.R`. Usa `callr::r_bg` simulado, sin worker real ni
  `R CMD INSTALL`, y llama al handler real de `POST /api/monitoreo/sync` en proceso. Cubre: dos POST en la misma
  sesión, aislamiento entre sesiones, jobs sin clave, liberación por terminado, fallido o cancelado, huérfano,
  tope, y el sync de hojas.

## Verificación

- `pnpm -C frontend typecheck`, `make gate-front AREA=monitoreo`.
- Vitest: `sync/*.test.ts` (plan, pasos, recibo y job simulado), `shell/barraDelModo.test.tsx`,
  `core/fuentesSincronizables.test.ts`.
- R: `test-monitoreo-sync-pasos.R`, `test-monitoreo-territorial-sync-pasos.R` y
  `make gate-area AREA=monitoreo GATE_ARGS='--patron "territorial|sync|jobs"'`.
- Territorial: `profiles/territorial/sync/{planTerritorial,lanzadorTerritorial}.test.ts` (jobs simulados).
- Capturas de Telefónico (`pdm.pulso`), Acreditación (`acred_conta.pulso`) y Territorial (`acnurcg2.pulso`) a
  1440x1000 y 1024x600, con la barra y con el menú abierto. Sin sync real: los proyectos no tienen credenciales.
