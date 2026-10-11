# Checklist — Meta B, Vuelta 1: Carga (2026-10-11)

Tipo: Checklist de vuelta
Estado: En curso
Fecha: 2026-10-11
Autoridad: GOAL `goal-modernizacion-ui-2026-10-10.md` (L3–L9) y maestro `remasterizacion-ui-2026-10-10.md` §7 «Vuelta 1 — Carga»; relevamiento de solo lectura del 2026-10-11

Pedido del dueño sobre Carga: «no es tan fluido y tiene muchos meses de atraso».
Maquetas: `maqueta/m/L03-carga-plataforma.html`, `L04-carga-skeleton.html`,
`L06-wizard-stepper.html`, `L07-credenciales-sideover.html`.

## Unidades

| # | Unidad | Dónde vive | Depende de | Estado |
|---|---|---|---|---|
| L4 | Fuentes sin «Pendiente · 0/1»: readiness solo con bases hidratadas, skeleton con cronómetro; cerrar C1 (grupos sin declarar) y C4 (overflow-y a 1280/1024) de Fuentes | `carga/cargaHidratacion.ts`, `useEstudioCarga.ts`, `CargaHidratando.tsx`, `CargaPage.tsx` | — | ◐ implementado (0 estados falsos en 3 corridas); cerrando C1/C4 |
| U-B0 | Backend: acciones `surveymonkey_import_separate` y `kobo_import_separate` (terminan en `estudio_add_base`, no en la base `default`); **limpieza al cancelar un job** (hoy un job cancelado deja el RDS de secretos en `sess$dir/jobs/inputs`; `carga_platform_jobs.R:266-270` solo limpia en `on_complete`) | `api/R/carga_platform_jobs.R`, `router_carga.R`, `jobs.R`, testthat (`.cpj_kobo_mocks`) | — | ☑ b10bf18 (guardian COMPATIBLE, verificador 565 pass; incluye F1 monitoreo.sync). Riesgo menor anotado: el prechequeo del tope cuenta solo la base madre, no las hijas de repeat Kobo |
| L5a (U-F1) | `carga/plataforma/`: `useImportPlataforma` con `jobId` en store (sobrevive al cambio de pestaña), `ImportadorPlataforma` sobre `JobProgress` (4 fases + tiempo), `modeloPlataforma` que unifica los dos payloads de Kobo (defaults de `base_url` distintos: kf.kobotoolbox.org vs kobo.unhcr.org; chequeo de `has_token`) | archivos nuevos en `carga/plataforma/` | U-B0 para «separadas» | ☐ |
| L3 (U-F2) | Disparador SM/Kobo en «bases separadas» (hoy el marco sin hijos y un texto que menciona un botón inexistente); extraer de `CargaPage.tsx` `PlatformImportPanel` (~280 l.), 14 `useState`, `loadPlatformCatalog`, `onPlatformImport` (~550 l. menos); reescribir a propósito `CargaSourcesPlan.test.tsx:65-69,88-100` | `carga/plataforma/CatalogoPlataforma.tsx`, `PerfilConexion.tsx` | L4 commiteado, L5a | ☐ |
| L5b (U-F3) | Kobo «por sugerencia» y jobs SM del multibase independiente al hook común | `BasesPanel.tsx:4034-4092, 4180-4249, 4403-4480` | L5a; hacerlo dentro de L6 | ☐ |
| L7 (U-F4) | Credenciales en el sitio del error: `GlobalSettingsDialog` como `Sideover` en el proyecto con `foco=conexiones` y vuelta al paso; `FranjaCredencial` compartida; último perfil/encuesta por proyecto sin secretos (ADR 0005), derivable de la metadata de las bases | `home/GlobalSettingsDialog.tsx`, `carga/plataforma/FranjaCredencial.tsx`, `project_pulso.R` | L5a | ☐ |
| L9 (U-F5) | Integrado y SAV como jobs (`multi_integrated_import`, `sm_sav_bundle_import`) | `carga_platform_jobs.R:136`, `IntegratedInstrumentsWizard.tsx:811`, `SavBundleImportPanel.tsx:207` | U-B0, L5a | ☐ |
| L8 | Importar SurveyMonkey del editor sin conectar al abrir; coachmarks con `aria-modal` y foco | `xlsformEditor/shell/ImportSurveyMonkeyDialog.tsx`, `Coachmarks.tsx` | — | ☐ |
| L6 (+U-F6) | Wizard independiente fuera de `BasesPanel` (`carga/independiente/`) con stepper; borrar `SurveyMonkeyMultibaseWizard.tsx` (muerto: nadie importa `SurveyMonkeyMultiImportPanel`) y decidir `apiCargaKoboDetectedSource` / `onImportDetectedKoboSource` (inalcanzable: `setDetectedKoboSource` nunca se llama) | `BasesPanel.tsx:3676-~5790` → `carga/independiente/` | L5b | ☐ (borrado: doble confirmación) |

## Lo que se sabe (no reinvestigar)

- Estrategia: `MultiBaseStrategy` en `carga/store.ts:111` (default `separate`, sin persistir); `sourceStrategy` en `CargaPage.tsx` (~756).
- Cancelación de jobs ya existe de punta a punta (`JobProgress`, `useJob.cancel`, `POST /api/jobs/<id>/cancel`, `job_cancel` mata el worker; `test-jobs-cancel.R`). Ningún flujo de Carga usa `JobProgress`: todos esperan con `await` vía `importEnSegundoPlano.ts`.
- Los «7 flujos» del ledger (censo §4.2) son de pantalla: manual base única, SM base única, Kobo base única, SAV, multibase independiente, integrada, separada.
- Riesgo de cancelar tarde: el job puede cosecharse como `done` (`jobs.R:317-327`); la UI debe tolerar «cancelé y aun así se importó». Cambio de proyecto durante el job → `E_CARGA_JOB_STALE_SESSION`.
- Sin conexión simulable en los proyectos de referencia (ADR 0005). Para capturar catálogo y job sin red hay que añadir stubs a `scripts/ui-quick-check.mjs` (`--api stub`: `/api/connections`, catálogos, import con handle, `/api/jobs/<id>`) o un modo mock en R.
- De Carga solo `carga-v2.css` está congelado; CSS nueva en archivo propio de `plataforma/`.

- U-B0 para el front (L5a/L3): endpoints `import-separate` con `async:true` y `esperarResultadoImport`; mandar `base_name` o dejar que se derive del título (desambigua `_2`); refrescar con `estudio`/`n_bases` del payload; la base activa no cambia salvo primera base; el payload NO trae `preview` ni `resumen`.
- Hallazgos fuera de Carga (U-B0): (1) `monitoreo.sync` (`router_monitoreo.R:~5839`) deja `monitoreo_connection_tokens` en `jobs/inputs` al cancelar/fallar — arreglo de una línea con `on_cleanup` + `job_unlink_inputs`; (2) `job_poll`: si `on_complete` falla, `j$status <- "error"` asigna sobre copia local y el job queda `done`; (3) `Makefile` fuerza `LC_ALL=en_US.UTF-8` y rompe `make gate-area` sin ese locale.
- `refs_perdidas` al guardar (diagnóstico 2026-10-11): **sin pérdida de datos**. El salto 7,5→4,3 MB de `acnur_acg` es `state.rds` recomprimido de gzip (anonimizador, `pulso_anonimizar_proyecto.R:209`) a xz (`project_pulso.R:2534`); todos los `files/*` se conservan. Las refs listadas ya faltaban en el fixture (`acnur_acg`: padrón de Monitoreo territorial; `acnur_pdm`: `dashboard_source`). Follow-ups de baja prioridad, fuera de Meta B: limpiar esas refs del fixture, `compress = "xz"` en el anonimizador, y que `.pulso_nombre_de_ref` dé nombre de dominio en vez del UUID.
- N4 (revisión metodológica 2026-10-11, RECHAZADO → corregido): los imports de plataforma heredaban los `choice_code_maps` del formulario activo / confirmados de sesión aunque fueran de otra encuesta (Si↔No invertidos en silencio). Ahora `.carga_platform_choice_code_maps` resuelve por procedencia (`source$survey_id` en toda la colección `xlsform_forms`); Kobo nunca hereda. Gonzalo aprobó extenderlo a base única. La carga manual no cambia.
- **Abierto (preexistente, decisión pendiente):** en base única los mapas se aplican TRES veces — prepare (archivo guardado, correcto), preview de `.carga_platform_finalize` y `estudio_init_default_base` al releer el archivo ya normalizado. Con mapas que se cruzan (swap) la preview y el `rp_data` de la base `default` quedan invertidos aunque el archivo esté bien. Arreglo probable: no re-normalizar con mapas un archivo que ya salió normalizado de prepare; exige revisar qué mapas guarda `.carga_store_choice_code_maps` desde la preview.

## Bloqueados / a decidir

- Ninguno por ahora. El borrado de `SurveyMonkeyMultibaseWizard.tsx` y del endpoint muerto exige confirmación explícita antes del commit (gate 3 de CLAUDE.md).
