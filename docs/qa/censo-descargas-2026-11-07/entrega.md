# Censo de entrega de archivos: capa de entrega y bordes

Tipo: Censo QA
Estado: Vigente
Fecha: 2026-11-07
Autoridad: relevamiento de solo lectura del 2026-11-07, parte de `censo-descargas-2026-11-07.md`

Repo: `prosecnur-app`, checkout local del dueño (HEAD `5da0353d8`, 2026-11-07). Solo lectura estática; nada se ejecutó en runtime. Lo marcado **(no verificado en runtime)** sale del código y de la documentación de Electron, no de una prueba.

---

## 1. Electron (`desktop/`)

### 1.1 Descargas: no hay handler

- **No existe `will-download`** ni `session.on('will-download')` en ningún archivo de `desktop/` (`main.cjs`, `preload.cjs`, `security.cjs`, `lifecycle.cjs`, `hf-publish-broker.cjs`, `preview-renderer.cjs`, `auto-updater.cjs`). Tampoco hay `DownloadItem.setSavePath`, `shell.showItemInFolder` ni un `shell.openPath` sobre un entregable.
- `session.defaultSession` solo se usa para permisos y CSP (`desktop/main.cjs:1838-1856`, `installCsp`) y para limpiar caché (`main.cjs:1340-1343`).
- Consecuencia **(no verificado en runtime)**: según la documentación de `DownloadItem`, cuando nadie fija la ruta de guardado Electron sigue su rutina por defecto, que **abre un diálogo nativo "Guardar"** con la carpeta de Descargas del sistema y el nombre sugerido por `Content-Disposition` o por el atributo `download`. Así que todo `<a href download>` y toda descarga de un blob dentro de la ventana termina en un diálogo nativo. No cae en silencio en ~/Downloads, no avisa al terminar y no ofrece "Mostrar en Finder".

### 1.2 Navegación y `window.open`: las descargas por `window.open` mueren en silencio

- `hardenWindowNavigation` (`main.cjs:1762-1834`):
  - `will-navigate`, `will-frame-navigate` y `will-redirect` (`main.cjs:1801-1809`) permiten el mismo origen (el backend `127.0.0.1:<port>`). Una navegación a `/api/files/<id>/download` llega con `Content-Disposition: attachment` y se convierte en descarga, que pasa por el diálogo de 1.1.
  - `setWindowOpenHandler` (`main.cjs:1814-1822`) **siempre devuelve `{action:"deny"}`**. Solo abre afuera (con `shell.openExternal`) cuando la política responde `open-external`, y eso ocurre únicamente con HTTPS de otro origen (`desktop/security.cjs:45-56`). Una URL del mismo origen, `http://127.0.0.1:…/api/files/…/download`, recibe `allow` y no `open-external`, así que se deniega **sin abrir ventana, sin descarga y sin error**.
  - Historia: antes de `c278f8922` (2026-07-30, "cierra fronteras Electron y credenciales HF") el handler hacía `shell.openExternal(url)` para cualquier URL. Por eso estas descargas se abrían en el navegador del sistema y caían en su carpeta de Descargas. Desde ese commit **los 21 `window.open(downloadUrl(...))` del front (15 archivos) no hacen nada en Electron (no verificado en runtime)**.
  - Archivos afectados: `recopiladores/PlantillasDelEquipo.tsx:56`, `recopiladores/telefonica/DocumentoDelBarrido.tsx:68`, `recopiladores/territorial/{PaquetesTerritoriales.tsx:242,322; HojasDeCampo.tsx:42; ExcelDeAsignacion.tsx:37; FichaPorUmp.tsx:46,50,56; ZonasDeCuotas.tsx:38; DialogoHojaUmp.tsx:79,87}`, `recopiladores/supervision/SeccionesSupervision.tsx:117`, `hojasRuta/mapa/seleccion/{PlanCampo.tsx:139; InformeDiseno.tsx:33}`, `hojasRuta/mapa/poblacion/PoblacionCajon.tsx:61`, `calcMuestra/general/FichaCorrida.tsx:64`, `calcMuestra/CalcMuestraPage.tsx:1441`, `monitoreo/profiles/territorial/TerritorialFieldOccurrencesWorkbench.tsx:725,752`, `codificacion/CodingConfigActions.tsx:298` y las acciones "Descargar" de los toasts de `xlsformEditor/XlsformEditorPage.tsx:1788,1800,1860,1872`.

### 1.3 Diálogos IPC (`main.cjs:845-990`, puente en `preload.cjs`)

| Canal | Título | `defaultPath` | Filtros | Retorno |
|---|---|---|---|---|
| `project:openDialog` (`main.cjs:871`) | "Abrir proyecto Prosecnur" | `dialogDefaultPath(args)`: carpeta de `args.defaultPath` o `~/Documents` | `pulso` + Todos | ruta o `null` |
| `project:saveDialog` (`main.cjs:885`) | "Guardar proyecto Prosecnur" | `dialogDefaultPath(args, Documents, "<nombre>.pulso")`, con `.pulso` forzado en el nombre | solo `pulso` | ruta o `null` |
| `project:saveEntregableDialog` (`main.cjs:898`) | "Guardar entregable" | `args.defaultPath` tal cual (ruta completa) o, si falta, `Documents/<defaultName>` | `args.filters` o `[Todos *]` | ruta o `null` |

- `dialogDefaultPath(args, fallbackDir, filename)` (`main.cjs:863-869`): si `args.defaultPath` trae extensión, toma su `dirname`; después une el resultado con `filename`. El fallback es `app.getPath("documents")`.
- Ninguno de los tres diálogos abre el archivo ni la carpeta al terminar. Solo devuelven la ruta.
- **Quién usa `saveEntregableDialog`**: solo dos sitios, y los dos lo **abren solos** cuando aparece un `file_id` nuevo, sin que el usuario pulse nada:
  - `features/analitica/PaneKit.tsx:135-171`, dentro de `GenerateFooter` (8 consumidores en Analítica). El `defaultPath` es la carpeta del `.pulso` más el nombre de descarga, y el filtro es la extensión. Después hace `apiSaveFileAs(fileId, target, {overwrite:true})`.
  - `features/graficos/ExportarInformeMenu.tsx:61-97`, para el PPTX/DOCX del informe, con el mismo patrón.
  - Fuera de Electron (`!window.prosecnurApi`) el efecto no corre y queda solo el `<a href={downloadUrl}>`.
- `saveProjectDialog` lo usa `features/project/useProject.ts` en `newProject` (:190), `saveAs` (:254) y `duplicate` (:291).

### 1.4 Menú nativo (`main.cjs:1636-1754`)

- **Archivo** (`:1649`): Nuevo (Cmd+N), Abrir (Cmd+O), Abrir reciente, Guardar (Cmd+S), Guardar como… (Cmd+Shift+S), Cerrar proyecto, **Abrir en navegador** (`:1682`, `shell.openExternal(rendererUrl(port))`) y Salir. Los comandos viajan por `menu:command` (`sendMenuCommand`, `main.cjs:990`) y los atiende `features/project/ProjectShell.tsx:248-262`.
- **Ayuda**: "Abrir carpeta de logs" (`shell.openPath(logsDir)`, `main.cjs:1732`; también en el watchdog, `:1247`) y "Diagnóstico del motor R".
- **No hay ítems de menú que exporten un entregable.**

### 1.5 Otros bordes de Electron

- **Auto-updater** (`desktop/auto-updater.cjs:54-83`): `autoDownload=true`; al bajar la actualización muestra un `showMessageBox` con "Reiniciar y actualizar / Más tarde". Es una descarga, pero no un entregable.
- **Hugging Face** (`main.cjs:943` `hf:publishDashboard` + `desktop/hf-publish-broker.cjs:86`): confirma con `showMessageBox` y luego el main hace un `POST http://127.0.0.1:<port>/api/dashboard/publish` con el token guardado. Más detalle en el punto 4.

### 1.6 Navegador (dev Vite :5173, "Abrir en navegador" o modo público) frente a Electron

| Mecanismo del front | Navegador | Electron |
|---|---|---|
| `<a href={downloadUrl(id)}>` (24 usos / 15 archivos) y `<a … download>` | Descarga según la preferencia del navegador: ~/Downloads en silencio o "preguntar" | Diálogo nativo "Guardar" con la carpeta Descargas (Electron por defecto; no verificado en runtime) |
| Blob + `a.download` programático (21 `createObjectURL` / 21 archivos) | Igual que la fila anterior | Igual que la fila anterior |
| `window.open(downloadUrl(id))` (21 usos / 15 archivos) | Abre una pestaña que baja el archivo. Ojo: muchos llaman `window.open` dentro de un `.then(...)` tras un fetch, fuera del gesto del usuario, y Safari o Firefox pueden bloquearlo como popup | **Denegado en silencio, no pasa nada** (1.2) |
| `saveEntregableDialog` + `/api/fs/save-file-as` (Analítica, Gráficos) | No aplica: queda el enlace | Diálogo nativo que se abre solo; el backend copia el archivo a la ruta elegida |
| `/api/fs/save-to-project` (Editor XLSForm, Correos, `SaveEntregableButton`) | Funciona si hay `.pulso` abierto, porque lo escribe el backend | Igual |

---

## 2. Backend de escritura a disco (`api/R/router_proyecto.R`)

### `POST /api/fs/save-to-project` (`router_proyecto.R:219-300`)

- Body: `file_id`, `filename`, `subdir`, `overwrite` (por defecto `FALSE`).
- Valida el nombre con `^[A-Za-z0-9_.\-]{1,80}$` (`:242`). Sin espacios, tildes ni rutas; si falla, devuelve `400 E_INVALID_FILENAME`.
- Exige proyecto abierto (`409 E_NO_PROJECT`, `:248`) y que el `file_id` exista en `s$files` (`404 E_FILE_NOT_FOUND`).
- Si el nombre no trae extensión, la toma de `meta$ext` (`:259-260`).
- Destino: `dirname(s$project_path)`, es decir, **la misma carpeta del `.pulso`**. Con `subdir` va a `<carpeta>/<subdir>`; el `subdir` se valida con `^[A-Za-z0-9_\-]{1,40}$` y se crea si falta (`:262-275`).
- Colisión: con `overwrite=false` responde `409 E_FILE_EXISTS` (`:278-282`). Copia con `file.copy` y responde `{ok, path, filename, size}`.
- **Ningún llamador del front pasa `subdir`.** `grep subdir frontend/src` solo encuentra el wrapper `api/workspace.ts:157,166`. Los llamadores son:
  - `features/project/SaveEntregableButton.tsx:153`. Sin `overwrite`, pero el `FilenameInput` bloquea antes los nombres que chocan (`FilenameInput.tsx:76`). Saneado previo: `sanitizeFilenameStem` (`FilenameInput.tsx:19-30`). **Único consumidor: `XlsformEditorPage.tsx:2677`.**
  - `features/xlsformEditor/XlsformEditorPage.tsx:1773,1845`: `overwrite:true`, se guarda solo tras exportar y sobrescribe sin preguntar. Avisa con su `ToastDeck`.
  - `features/recopiladores/correos/useCorreos.ts:353`: `overwrite:false`, el ZIP de la plantilla de correo. Un segundo guardado devuelve 409.

### `POST /api/fs/save-file-as` (`router_proyecto.R:301-352`)

- Body: `file_id`, `path` absoluto (`^(/|[A-Za-z]:[\\/])`, si no `400 E_INVALID_PATH`) y `overwrite` (por defecto `TRUE`).
- Agrega `meta$ext` si la ruta no trae extensión, crea el directorio padre y copia. **No sanea el nombre**: lo eligió el usuario en el diálogo nativo.
- Llamadores: solo `PaneKit.tsx:155` y `ExportarInformeMenu.tsx:86`, los dos con `overwrite:true`.

### `GET /api/fs/list-project-dir` (`router_proyecto.R:354-368`)

- Hace `list.files(dirname(project_path))` sin recursión. Filtra los ocultos y el propio `.pulso`.
- Nota: en R, `include.dirs=FALSE` se ignora en listados no recursivos, así que **también devuelve subcarpetas**.
- Único consumidor: `SaveEntregableButton.tsx:96-101`, para detectar colisiones.

### File store y nombres

- `.register_output_file` (`api/R/router_codificacion.R:264-284`): registra `{file_id, kind, original_name, path, size, ext}` en `s$files` dentro de `tempdir()/prosecnur/<sid>/downloads`.
- `.export_filename` (`:247-255`): arma `<proyecto>_<base>_<etiqueta>_<dd_mm_yy>.<ext>` con slug ASCII.
- Descarga: `GET /api/files/<file_id>/download` (`api/R/router_sistema.R:783-803`). Acepta `?sid=` porque un `<a href>` no puede mandar headers. Envía `Content-Disposition: attachment; filename="<original_name>"` **sin codificar según RFC 5987**, así que un nombre con tildes puede llegar mal.
- Resultado de un job: `GET /api/jobs/<id>/result` (`api/R/router_jobs.R:12-31`). Hace streaming con `c(file=path)`, el nombre sale sin el prefijo `<uuid>__` y **no valida la sesión**.

---

## 3. Guardado del proyecto `.pulso`

- **Guardar** (`useProject.ts:216-239`): vacía syncs, gráficos y hojas de ruta pendientes y después hace `apiProjectSave(null)`, que guarda en la misma ruta. ADR 0122: si el proyecto tiene candado, primero muestra `motivoGuardadoBloqueado` (`:214`).
- **Guardar como** (`useProject.ts:241-273`): `saveProjectDialog(name, {defaultPath: dirname(actual)})` y luego `apiProjectSave(path)` + `pushRecentProject`. **Sin Electron lanza "File picker no disponible".**
- **Nuevo** (`:179-210`): sesión nueva `fresh` + `saveProjectDialog` + save. **Duplicar** (`:275-320`): `POST /api/project/duplicate` (`router_proyecto.R:56`) con `overwrite:false` y `open_copy:true`.
- Backend `POST /api/project/save` (`router_proyecto.R:18-54`): usa `path` o `s$project_path`, fuerza `.pulso` y llama a `build_pulso`. La escritura es atómica: zip a `<dest>.tmp` y después `file.rename` (`api/R/project_pulso.R:2628-2645`).
- **No hay autosave del `.pulso`.** El estado del proyecto se consulta por polling (`useProject.ts:137-146`, `POLL_INTERVAL_MS`) para el indicador `dirty`. Los "autosave" que existen son por módulo hacia el backend o hacia localStorage (`calcMuestra/hooks/useCalcMuestraAutosave.ts`, `useDashboardAutosave`, autosave del XLSForm en localStorage) y **no escriben el `.pulso`**.
- Cierre: `onAppCloseRequest` / `confirmAppClose` (`preload.cjs`) deja que el renderer pida guardar antes de salir.
- **Anonimizar `.pulso`**: solo existe como script de CLI, `api/scripts/pulso_anonimizar.R` (más `pulso_reparar_criterios_anonimizados.R`), y usa `PROSECNUR_ANON_SALT`. **No hay ruta ni botón en la app.** Los `.pulso` también salen en un snapshot que va al Space de Hugging Face (punto 4).

---

## 4. Publicaciones que dejan un artefacto fuera de la app

| Destino | Entrada | Mecanismo | Qué queda afuera |
|---|---|---|---|
| **Hugging Face Space** | `features/dashboard/publish/DashboardPublishDialog.tsx:110-175` → `POST /api/dashboard/publish` (`router_dashboard.R:389`) → `dashboard_publish_space` (`api/R/dashboard_publish*.R`) | **Síncrono**, sin job. Hace `build_pulso` a un `tempfile(".pulso")` (`dashboard_publish.R:313-314`), arma el stage `tempfile("hf_space_")` con `data/proyecto.pulso`, README y runtime, y lo sube con git. Con token guardado pasa por el main de Electron (`hf:publishDashboard`, confirmación nativa, broker). Con token pegado, fetch directo. | El Space con una copia del `.pulso`. El usuario recibe `url` y `app_url`, no un archivo. El feedback es un `Loader2` y `.dash-publish-status` dentro del diálogo. |
| **Google Sheets (Monitoreo)** | `POST /api/monitoreo/sheets/publish` (`router_monitoreo.R:3059`), `/client-report/sheets/publish` (:3067), `/publication/sheets` (:3150), `/publish` (:3074); ensayos con `…/revisar` (`router_monitoreo_publicar_ensayo.R:29-31`) | Pasan por `monitoreo_sheets_publish_dispatch`: síncrono, o job `monitoreo.sheets_publish` con `async:true` (`monitoreo_sync_incremental.R:1347-1360`) | Pestañas escritas en el Spreadsheet |
| **Sheets de aulas** | `/api/monitoreo/aulas/publicar-libro` (`monitoreo_aulas_publicar_libro.R:1426`), `/publicar-distribucion` (`router_monitoreo.R:4905`), `/publicar-marcas` (:4964) | Síncrono | Libro vivo y distribución de aplicadores |
| **Sheets de Material de campo** | `/api/recopiladores/campaigns/telefonica/sheets` (`router_recopiladores.R:194`), `/supervision/sheets` (:214); `/api/monitoreo/telefonico/supervision/ronda/publicar` (`monitoreo_supervision_rondas.R:519`) | Síncrono | Hojas de barrido y supervisión |
| **Mailchimp** | `/api/recopiladores/mail-sync`, `/mail-sync/audience`, `/mail-sync/campaign` (`router_recopiladores.R:345-360`); `/api/monitoreo/mailchimp/sync` (`router_monitoreo_mailchimp.R:118`) | Jobs `recopiladores.mail_sync`, `recopiladores.mail_audience` y `monitoreo.mailchimp_sync`. El **borrador de campaña** es síncrono (`collection_mail_mailchimp_borrador.R`) y la app nunca envía. | Audiencia, etiquetas y borrador con `edit_url` |
| **Plantilla de correo (ZIP/HTML)** | `/api/recopiladores/mail-template/export` (`router_recopiladores.R:398`) → `apiSaveEntregable` "junto al proyecto" (`useCorreos.ts:353`) | Síncrono | ZIP en la carpeta del `.pulso` |
| **Modo público** | `isPublicMode()` (`frontend/src/lib/runtime.ts:8`, build con `VITE_PULSO_PUBLIC_MODE`); `PublicArtifactApp.tsx` monta `DashboardPage publicMode` o `MonitoreoPublicReportPage`. El backend usa la whitelist de `api/R/forbid_mutations.R:29-56`. | — | — |

**Hallazgo del modo público (no verificado en runtime):**

- La whitelist **no incluye** `POST /api/dashboard/base-datos/descargar` ni `POST /api/dashboard/relacion/descargar`.
- `DashboardPage` no oculta esas pestañas en `publicMode` (`adminHidden` solo apaga el chrome del editor, `DashboardPage.tsx:98-147`).
- `BaseDatosTab/index.tsx:65-84` llama a `apiDashboardBaseDatosDescargar(...).then(...).finally(...)` **sin `.catch`**. En el Space el botón "Descargar" recibiría un 403 y fallaría sin avisar.
- `MonitoreoPublicReportPage.tsx:334,1029` sí declara "No hay descargas desde esta interfaz".
- Las descargas PNG de gráficos con `copyOrDownloadBlob` (`dashboard/shared/FullscreenWrapper.tsx:38-58`) son blobs locales y funcionan en todos los modos.

---

## 5. Sistema de jobs

### Contrato backend (`api/R/jobs.R`)

- `job_submit(sid, kind, func, args, result_filename, on_complete, on_cleanup, dedupe_key, retener_resultado)` (`jobs.R:12-212`) arranca `callr::r_bg` con un bootstrap (`load_all` en dev, `library` en prod, `LC_ALL` UTF-8).
  - Archivos en `<sess>/jobs/<job_id>.{progress,out,err}`.
  - Si hay `result_filename`, el resultado va a `<sess>/jobs/<job_id>__<result_filename>` y su ruta entra a los args como `result_path`.
- **Archivo de progreso**:
  - `job_submit` escribe `{"phase":"queued"}` (`:40-45`) y el bootstrap lo pasa a `{"phase":"running","message":"Trabajando..."}` (`:91-96`).
  - El worker usa `job_progress_writer(progress_path)` (`:310-341`), que escribe el JSON `{phase, current, total, percent, message, step, steps, ts}`. `percent` sale explícito o como `round(100*current/total)`.
  - Está exportado y lo usan 29 archivos R.
  - El vocabulario de `phase` es libre: `loading`, `prepare`, `render`, `export`, `writing`, `zip`, `pdf`, `workbook`, `building`, `save`, `merge`, etc.
- `job_submit_completed` (`:255-288`) crea un job ya terminado (`{"phase":"done","percent":100}`) para los aciertos de caché.
- `job_poll` (`:349-397`) es perezoso: cosecha `get_result`, corre `on_complete`, y si `on_complete` falla el job queda en `error` (`:370-385`). Después corre `on_cleanup` y escribe una línea de log `[jobs] kind=… status=… total_ms=…` (`:401-413`).
- `job_snapshot` (`:477-503`) devuelve `{id, kind, status: running|done|error|cancelled, started_at, finished_at, has_file_result, result_filename, result_data, progress, error}`.
- Endpoints (`api/R/router_jobs.R`): `GET /api/jobs/<id>`, `POST /api/jobs/<id>/cancel` (mata el proceso y limpia, `jobs.R:423-450`), `GET /api/jobs/<id>/result` (streaming del archivo) y `POST /api/jobs/_selftest`.
- Avisos del motor: el worker los emite con `.pulso_aviso(...)` por `message()` y `.pulso_avisos_de_job` los lee del `.err` (`jobs.R:513-579`).
- Dos formas de entregar archivo:
  - (a) `result_filename`: se sirve por `/api/jobs/<id>/result`.
  - (b) `on_complete` copia o registra con `.register_output_file` y devuelve `file_id` en `result_data`. Es la forma mayoritaria; el front usa `FileJobResult {file_id, filename, size}` (`frontend/src/api/jobs.ts:49`).

### Contrato front

- `api/jobs.ts`: tipos `JobSnapshot` y `JobProgress {phase,current,total,percent,message,ts}`. Faltan `step` y `steps` en el tipo genérico; Monitoreo los lee aparte.
- Funciones: `apiJobStatus`, `apiJobCancel`, `jobResultUrl`, y `jobResultDomainError`, que lee el error de dominio embebido en `result_data`.
- `hooks/useJob.ts`: `iniciarJobPoll` es un poller puro con backoff, 5 errores transitorios, 5 respuestas 404 (job perdido) y un timeout de 30 min que pide cancelar. `useJob` es el hook.
- `components/JobProgress.tsx`: el único componente genérico. `formatPhase` traduce unas 30 fases y oculta las desconocidas; `formatMessage` reescribe mensajes de Kobo y SurveyMonkey. Tiene barra, contador `current/total`, botón cancelar y `Alert` de error. **16 usos en 13 archivos.**
- Pollers paralelos que reimplementan la espera:
  - `calcMuestra/hooks/jobPolling.ts` (`esperarJob`, `cmJobFase`, `cmJobFraccion`, `cmJobEta`, con ETA) y `JobProgressBanner.tsx` (1 uso).
  - `xlsformEditor/shell/paperExportJob.ts` (`esperarExportPapel`, que envuelve `iniciarJobPoll` en una promesa).
  - `monitoreo/sync/{esperarJobDeSync.ts, pollSourceSync.ts, pasosDelSync.ts}`, más la copia en `profiles/territorial/sync/pollSourceSync.ts`. Leen `step/steps` para la píldora "paso N de M".
  - `graficos/laminas/miniaturas/{pollLote.ts, previewPorJob.ts}` y `propuestaResumen/propuestaPorJob.ts`.
  - `carga/importEnSegundoPlano.ts` y `carga/plataforma/usePlataformaStore.ts`.
  - `recopiladores/correos/mailchimpTrabajo.ts`.
  - `app/warmupRegistry.ts`, `ModuleWarmupBoundary.tsx` y `api/bootClient.ts` (`bootApiJobStatus`).
  - `monitoreo/salidas/MonitoreoOutputsWorkbench.tsx` y `calcMuestra/universidad/marco/CursosHorarioMarcoTab.tsx`, que hacen `apiJobStatus` a mano.

### Todos los tipos de job (64 llamadas a `job_submit*`)

| kind | archivo:línea | ¿Resultado es un archivo? |
|---|---|---|
| `analitica.lectura` | `analitica_warmup.R:256` | No (estado) |
| `analitica.multibase.tablas` | `router_analitica.R:4067` | **Sí**, XLSX (`result_filename`) |
| `analitica.panel.export` | `router_analitica.R:4285` | **Sí** (`result_filename`) |
| `analitica.cruces` | `router_analitica.R:4449` | **Sí**, XLSX o ZIP multibase |
| `analitica.enumeradores` | `router_analitica.R:5079` | **Sí**, PDF o ZIP de PDFs |
| `analitica.armonizada.{simple,cruces}` | `router_armonizada.R:127` | **Sí**, XLSX (+ manifest) |
| `carga.platform.<acción>`: `surveymonkey_import`, `surveymonkey_import_separate`, `surveymonkey_add_source`, `kobo_import`, `kobo_import_independent`, `kobo_import_separate`, `kobo_refresh_independent`, `sm_multibase_import`, `sm_multibase_import_independent`, `sm_multibase_refresh`, `formulario_publicado_sm`, `multi_integrated_import`, `sav_bundle_import` | `carga_platform_jobs.R:309` (lista en :37-54) | No (base en sesión) |
| `carga.formulario_publicado_sm` | `carga_formulario_publicado.R:349` (kind en :27) | No |
| `codificacion.aplicar` / `codificacion.reaplicar_surveymonkey` | `router_codificacion.R:3257`, `:2252` (vía `.codif_start_apply_job`, llamado desde `surveymonkey_multibase.R:4928`) | Parcial: deja `data_adaptada_*.xlsx`, `instrumento_adaptado_*.xlsx` y la plantilla en `downloads/`, registrados; además muta la base |
| `calc_muestra_aulas_construir` / `_comparar` / `_certeza` / `_seleccionar` / `_simular_reemplazos` | `router_calc_muestra.R:920 / 1037 / 1106 / 1186 / 1243` | No (estado) |
| `calc_muestra_aulas_criterios_rehidratar` | `router_calc_muestra_criterios.R:116` | No |
| `calc_muestra_reporte` | `router_calc_muestra.R:1366` | **Sí** |
| `graficos.ppt` | `router_graficos.R:3142` | **Sí**, PPTX |
| `graficos.ppt_all` | `router_graficos.R:3247` | **Sí**, ZIP |
| `graficos.word` | `router_graficos.R:3367` | **Sí**, DOCX |
| `graficos.word_visor` | `router_graficos.R:3301` | Sí (DOCX para vista previa) |
| `graficos.ppt_consolidado` | `graficos_consolidado.R:823` | **Sí**, PPTX |
| `graficos.miniaturas` / `graficos.preview_slide` | `graficos_miniaturas_jobs.R:253,265` (kind en :231) | PNG internos, no son entregables |
| `graficos.propuesta_resumen` | `graficos_propuesta_job.R:209,215` | No |
| `hojas_ruta.generate` | `router_hojas_ruta.R:1080` | **Sí**, ZIP |
| `hojas_ruta.manual_replacements_pdf` | `router_hojas_ruta.R:982` | **Sí**, PDF |
| `hojas_ruta_reporte_decisional` | `router_hojas_ruta.R:1185` | **Sí**, PDF |
| `monitoreo.{client_report,territorial_advance,telefonico_advance,aulas_advance}_pdf` | `router_monitoreo.R:3192` (kinds en :3185-3188) | **Sí**, PDF |
| `monitoreo.production_report_pdf` | `router_monitoreo.R:3265` | **Sí**, PDF |
| `monitoreo.telefonico_advance_pdf` (endpoint propio) | `router_monitoreo_telefonico.R:81` | **Sí**, PDF |
| `monitoreo.sync` | `router_monitoreo.R:5766` | No |
| `monitoreo.sheets_sync` | `monitoreo_sync_incremental.R:1277` | No |
| `monitoreo.sheets_publish` | `monitoreo_sync_incremental.R:1356` | No (escribe en Sheets) |
| `monitoreo.territorial_prewarm` | `router_monitoreo.R:2962,2970` | No |
| `monitoreo.territorial_map_prepare` | `router_monitoreo.R:4112,4121` | No |
| `monitoreo.mailchimp_sync` | `router_monitoreo_mailchimp.R:79` | No (externo) |
| `project.warmup` | `project_warmup.R:1308,1326` | No |
| `project.warmup.territorial.{field_pesado,resto}` | `project_warmup_paralelo.R:189` | No |
| `recopiladores.materials_{png,pdf,bundle}` | `collection_materials_job.R:505` | **Sí**, PNG, PDF o ZIP |
| `recopiladores.materials_prueba` | `collection_material_prueba.R:218` | **Sí** |
| `recopiladores.mail_sync` | `collection_mail_mailchimp.R:372` | No (Mailchimp) |
| `recopiladores.mail_audience` | `collection_mail_mailchimp_audiencia.R:197` | No (Mailchimp) |
| `validacion.v2.methodology_report_pdf` | `router_validacion.R:878` | **Sí**, PDF |
| `validacion.v2.methodology_report_bundle` | `router_validacion.R:913` | **Sí**, ZIP. Es el único que el front baja con `jobResultUrl` (`validacion/tabs/InstrumentoTab.tsx:670`) |
| `validacion.v2.auditoria` | `router_validacion.R:1227` | No |
| `validacion.v2.reglas_custom.ejecutar` | `router_validacion.R:2160` | No |
| `xlsform_editor.formulario_pdf` / `xlsform_editor.formulario_word` | `xlsform_editor_export.R:188` (kind en :186) | **Sí**, PDF o DOCX |
| `selftest_file` / `selftest` | `router_jobs.R:44,56` | Sí (txt) / No |

Total: unas 45 familias de kind. Unas 23 producen un entregable de archivo.

**Exportaciones síncronas (sin job)**: no forman parte de esta capa, pero conviene recordarlas para unificar la espera. Son las que no tienen progreso y bloquean Plumber, que tiene un solo hilo. Lo cubre el agente (a).

---

## 6. Componentes de feedback reutilizables ("esperando / listo / error")

Conteos en `frontend/src`, sin tests: usos / archivos.

| Componente | Archivo | Usos | Papel |
|---|---|---|---|
| **`JobProgress`** | `components/JobProgress.tsx` (+ `hooks/useJob.ts`) | 16 / 13 | Espera de un job: fase, %, `current/total`, cancelar, error con `Alert`. **Mejor candidato a base estándar.** |
| `GenerateFooter` | `features/analitica/PaneKit.tsx:96` | 8 consumidores | Botón "Generar" con `Loader2` + pill de descarga + guardado nativo automático en Electron |
| `JobProgressBanner` + `jobPolling.ts` | `features/calcMuestra/` | 1 | Variante con ETA y fracción. Es la lógica de progreso más rica, pero vive local en Calc. de muestra |
| **`BarraDeAvance`** | `components/BarraDeAvance.tsx` | 9 / 7 | Barra del kit (2 nov 2026): determinada o indeterminada, `scaleX`, acento del módulo. Su cabecera dice que no había barra compartida |
| **Toaster** (`toast.info/exito/aviso/error`) | `components/Toaster.tsx` + `toasterStore.ts` (ADR 0047) | 25 / 14 | Toasts globales con `aria-live`, máximo 3, duración y acción. **Candidato para el "listo / guardado en …".** |
| `ToastDeck` (`toasts.push`) | `features/xlsformEditor/shell/ToastDeck.tsx` | 46 / 3 (1 host) | Deck propio del Editor XLSForm, duplicado del Toaster global |
| **`Alert`** | `components/Alert.tsx` | 72 / 35 | Aviso en línea (`info/success/warn/error` + acciones) |
| `LoadingBlock` / `ErrorBlock` / `EmptyState` | `components/States.tsx` | 87/73 · 51/45 · 98/44 | Estados de bloque |
| `EstadoVacio` | `components/EstadoVacio.tsx` | 374 / 228 | Vacío del kit |
| `CargaDeBloque` | `components/CargaDeBloque.tsx` | 37 / 34 | Carga de un bloque |
| `CargaDeModulo` | `components/CargaDeModulo.tsx` | 9 / 4 | Carga de un módulo |
| `Skeleton` / `SkeletonVista` / `VistaSkeleton` | `components/Skeleton.tsx`, `VistaSkeleton.tsx` | 55/4 · 1/1 · warm start | Siluetas |
| `PantallaDeCarga` | `app/PantallaDeCarga.tsx` | warm start | Fases `pending/running/ready/skipped/timeout/error`: el único "progreso por fases" de pantalla completa |
| `SaveStatusIndicator` | `components/SaveStatusIndicator.tsx` | 12 / 11 | Estados `idle/dirty/saving/saved/loading/error` |
| `SessionLostBanner` | `app/SessionLostBanner.tsx` | global | Sesión perdida |
| `LogsPanel` | `components/LogsPanel.tsx` | global | Panel de logs (atajo) |
| Spinner suelto `<Loader2 className="pulso-spin">` | `vendor/lucide-react` + CSS | 318 / 143 (`pulso-spin`: 301 / 132) | El patrón de espera de hecho y sin estándar: cada botón pinta "Generando…" a mano |
| `SaveEntregableButton` + `FilenameInput` | `features/project/` | 1 consumidor | Patrón "guardar en el proyecto" con popover, saneado y colisión; su propio "toast" es un `<span>` inline con `setTimeout` |

**Lectura para unificar:**

- La espera de un job ya tiene núcleo común: `iniciarJobPoll`, `useJob` y `JobProgress`. Pero hay al menos 9 pollers paralelos, y el tipo `JobProgress` no declara `step/steps`.
- El "listo" está repartido entre `Toaster` (global), `ToastDeck` (XLSForm), pills de descarga, `<span>` inline y el diálogo nativo que se abre solo (Analítica y Gráficos).
- El "dónde quedó el archivo" no lo resuelve nadie: no hay "Mostrar en Finder" ni `showItemInFolder` en el puente IPC.
