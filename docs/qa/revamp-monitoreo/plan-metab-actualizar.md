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

## Fase 2 — Territorial y Cursos-horario (no en esta corrida)

Hoy trabajan en esos perfiles otros implementadores. Cómo se haría:

1. **Territorial.** Ya pasa `barraDelModo` con cuerpo `syncAdvance`, «Traer todo de nuevo» (`syncField`) y «Solo
   recalcular» (`refreshCurrentView`). Falta:
   - retirar «Sincronizar respuestas» (`TerritorialSourceConsole.tsx:1203`) y «Sincronizar piloto/campo»
     (`TerritorialModelWorkbench.tsx:425`), pasando sus capacidades al menú si alguna no está;
   - renombrar «Solo recalcular» a «Recalcular» y sumar las entradas por fuente con `planDeActualizar`. Sus syncs no
     usan `/api/monitoreo/sync` directo (fase activa, ocurrencias, `monitoreo_territorial_cache.R`), así que el hook
     necesita un `ejecutor` inyectable por perfil en vez de llamar a la API: `ejecutarActualizacion` recibiría
     `lanzar(peticion) → job_id`;
   - escribir `step`/`steps` en `monitoreo_territorial_cache.R` (runner de 731/1039) con el mismo criterio: una
     fuente por paso más el recálculo;
   - recibo con el resumen que ya devuelve el job territorial (filas Kobo nuevas y ocurrencias).
2. **Cursos-horario.** No tiene barra común: «Avance» y «Traer respuestas» viven en `AulasMonitoreoPage.tsx:2040-2056`
   y otro «Traer respuestas» en `AulasOperationsPanel.tsx:259`. Va después de que el modo reciba el esqueleto
   Insumos · Modelo · Control · Avance (brecha 2): entonces se le pasa `barraDelModo` con `useActualizarDelModo`,
   «Traer respuestas» pasa a ser el cuerpo y el segundo botón se retira. Cuidado: «Traer respuestas» también
   re-publica el libro del Sheets; eso es escritura hacia afuera y, por L38, vive en Publicar, no en Actualizar.
   Hay que separarlo antes de unificar.
3. Con los cuatro modos en el hook, `estadoDelModo` de `profiles/territorial/navegacion/barraTerritorial.ts` se
   reemplaza por el de `core/barraComun.ts`.

## Verificación

- `pnpm -C frontend typecheck`, `make gate-front AREA=monitoreo`.
- Vitest: `sync/*.test.ts` (plan, pasos, recibo y job simulado), `shell/barraDelModo.test.tsx`,
  `core/fuentesSincronizables.test.ts`.
- R: `test-monitoreo-sync-pasos.R` y `make gate-area AREA=monitoreo GATE_ARGS='--patron "jobs|sync"'`.
- Capturas de Telefónico (`pdm.pulso`) y Acreditación (`acred_conta.pulso`) a 1440x1000 y 1024x600, con la barra y con
  el menú abierto. Sin sync real: los proyectos no tienen credenciales.
