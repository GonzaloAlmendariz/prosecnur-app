# Prosecnur — reglas de la casa y agentic OS

App local-first para investigación por encuestas: Electron + React/Vite/TS (`frontend/`) + R/Plumber (`api/`, paquete `prosecnurapp`). Proyectos portables `.pulso`, secretos fuera del `.pulso`. Protocolo de trabajo: `AGENTS.md` → `docs/loops-reparacion.md`. Arquitectura: `docs/arquitectura-prosecnur.md`. Decisiones: `docs/adrs/`. Layout: `docs/ui-layout-grammar.md`. Identidad visual: `branding/` (dirección creativa, manual y logos canónicos — ADR 0038). Baseline de deuda: `docs/qa/deuda-baseline.md`.

## Mapa del repositorio

```
api/            Paquete R `prosecnurapp` — REST API (Plumber) + motor analítico
  DESCRIPTION     Fuente única de la versión de la app (hoy 0.5.19)
  R/              ~226 archivos: router_*.R (23), *_engine.R, reporte_*.R,
                  graficador_*.R, validacion_*.R, codificacion_*.R, calc_muestra_*.R,
                  monitoreo_*.R, surveymonkey_*.R, kobo_api.R, hojas_ruta_*.R
                  Infraestructura: plumber_app.R, session_store.R, jobs.R, errors.R,
                  project_pulso.R, io.R, helpers_*.R
  inst/samples/   Datasets demo · inst/audit_reference/ .pulso sintético canónico
  inst/www/       Build del frontend (generado; no versionado)
  tests/testthat/ ~233 suites: test-*.R (REST) y test-engine-*.R (motor)
frontend/       React 18 + Vite 6 + TS estricto + zustand + react-router
  src/app/        Shell: App.tsx (rutas), Layout.tsx, BootGate.tsx, theme.css
  src/features/   18 features por dominio (ver tabla de módulos)
  src/api/        Cliente por dominio; client.ts es solo barrel de compatibilidad
  src/components/ Primitivas compartidas (PageFrame, GlidingTabList, Panel, …)
  src/lib/        modules.ts (contrato de navegación v2), SessionContext, icons
  src/vendor/     Shim de lucide-react (imports directos por icono)
desktop/        Shell Electron (main.cjs, preload.cjs, auto-updater.cjs)
launcher/       launch.R (entry del backend) + install-r-deps.R
agentic/        Sincronizador de adaptadores Claude↔Codex + política de orquestación
.claude/        agents/ (13) · skills/ (15) · workflows/ — fuentes canónicas
.codex/, .agents/  Adaptadores GENERADOS; nunca editar a mano
docs/           adrs/ (0001–0042), qa/, arquitectura, layout, versiones-app.md
branding/       Identidad visual v3, tokens, logos, catálogo
packaging/, deploy/, scripts/   Instaladores, deploy web y utilidades de QA
```

No versionados y voluminosos: `tmp/`, `output(s)/`, `dist.nosync/`, `api/inst/www/`.

## Cómo corre la app

- **Runtime**: Plumber (R) escucha en `127.0.0.1:8787`, sirve la API REST bajo `/api/*` y los assets estáticos del SPA. Electron abre la ventana; en dev, Vite corre en `:5173` con proxy `/api` → `VITE_API_PROXY_TARGET`/`PULSO_PORT`.
- **Sesión**: efímera y en memoria (`session_store.R`), un `sid` por sesión, archivos en `tempdir()/prosecnur/<sid>/{uploads,state,jobs,downloads}`. `PULSO_BOOTSTRAP_PROJECT` precarga un `.pulso` y lo expone en `/api/system/bootstrap`.
- **`.pulso`**: zip con `manifest.json` + `state.rds` (estado de sesión sin caches derivables) + `files/` (inputs: XLSForm, data, plantillas editadas). Los entregables NO viven dentro; se exportan al lado vía `/api/fs/save-to-project`. Guardado explícito; `project_dirty` marca mutaciones. Secretos (SurveyMonkey/Kobo/Sheets) fuera del `.pulso` — ADR 0005.
- **Jobs**: operaciones pesadas van a `callr::r_bg` (`jobs.R`) con archivo de progreso y polling desde el front. Dos trampas conocidas: el worker arranca sin el namespace de `prosecnurapp` (hay que cargarlo dentro) y el locale UTF-8 se pierde. Skill `/jobs-asincronos`.
- **Modo público**: build web read-only (HF Spaces / Fly) que reusa el backend real pero sin shell admin (`isPublicMode()`, `PublicArtifactApp`).

## Módulos y rutas

Registro canónico en `frontend/src/lib/modules.ts` (`PROSECNUR_NAVIGATION_CONTRACT` v2); cada módulo tiene slug, tono `--pulso-module-*` y sus secciones.

| Módulo | Ruta | Secciones |
|---|---|---|
| Bitácora (`diseno-estudio`) | `/bitacora` | bitácora · cronograma · calendario |
| Cálculo de muestra | `/calc-muestra` | calc-muestra (`?mesa=aulas`) |
| Formularios (`editor-xlsform`) | `/editor-xlsform` | formularios |
| Hojas de ruta | `/hojas-ruta` | territorio · población · muestra · manzanas · entrega (tabs: cuotas, titulares, reemplazos) |
| Fichas QR (`recopiladores`) | `/recopiladores` | recopiladores |
| Monitoreo | `/monitoreo` | monitoreo · acreditación · telefónico · territorial · aulas (perfiles dinámicos, ADR 0022) |
| Procesamiento | `/procesamiento` | carga · validación · codificación · analítica · gráficos |
| Dashboard | `/tablero` | dashboard (code-split: plotly no entra al bundle principal) |
| Enciclopedia | `/enciclopedia` | fichas metodológicas |

Rutas legacy (`/diseno-estudio`, `/plan-trabajo`, `/diseno-muestra`, `/muestra-aulas`) redirigen; no reintroducirlas como destinos.

## Enrutamiento del agentic OS

Subagentes en `.claude/agents/`, skills en `.claude/skills/`. El lead carga `/orquestar-trabajo` para toda tarea no trivial, construye oleadas de hasta tres trabajadores y conserva contrato, ownership, integración y gate. Clasifica la tarea en una de las 8 ramas:

Estas rutas siguen siendo la fuente canónica para Claude. Codex las consume mediante adaptadores generados en `.codex/agents/` y `.agents/skills/`; validar la sincronización con `node agentic/sync-agentic-os.mjs --check` y nunca editar los adaptadores a mano. Contrato: `docs/agentic-os.md`.

**Rama 1 — Construir (feature/fix en la app)**
`/scope-lock` → bug/regresión: `diagnosticador-regresiones` + revisores aplicables en paralelo → `autor-regresiones` para fijar rojo → máximo dos writers entre `backend-r`/`frontend-react` → revisiones paralelas → `verificador` serial → `/cerrar-trabajo`. Features cross-layer congelan contrato antes de lanzar frontend/backend. Cargar `dominio-prosecnur` y el skill fino cuando cambie lógica de encuesta.

**Rama 2 — Diseñar (revamp/pulido visual, la tarea más frecuente)**
skill `/revamp-visual` → `qa-visual-desktop` toma baseline → `frontend-react` implementa → QA independiente after → `verificador`. La auditoría UX profunda usa `prosecnur-ux-evaluator`; navegación/arquitectura suma `guardian-contratos`.

**Regla de observación**: para ver/iterar cualquier vista que viva detrás de un proyecto abierto, usa el skill `/ver-ui` (deep-link `?pulso=` en dev que salta el BootGate). Nunca digas "no puedo llegar a esa vista" sin haberlo intentado con `/ver-ui`. **Higiene de servers**: reusar antes de levantar (`preview_list`; el 8787 es del usuario, nunca matarlo), cerrar al terminar lo que tú levantaste, y ante huérfanos de otras sesiones `make dev-status` / `make dev-prune`.

**Rama 3 — Entregables (motores de salida)**
`especialista-entregables` implementa. PDF → `prosecnur-pdf-engine`; PPT/Word/XLSX → `entregables-oficina`; cronogramas → `cronograma-encuestas`. `revisor-metodologico` revisa grano/denominadores y `guardian-contratos` jobs/artefactos; termina en `verificador`.

**Rama 4 — Integrar datos**
SurveyMonkey/Kobo/Sheets → `dominio-prosecnur` + `integraciones-datos` → `especialista-integraciones`; diagnóstico, contratos y metodología pueden investigar en paralelo. Tests sin red y gate `verificador`.

**Rama 5 — Estudios reales (datos de cliente)**
skill `/estudio-real` (ACNUR/UNSA/Polarización-style: instrumento, cuotas, base procesable, pesos, pipeline). Auditoría sintética canónica → skill global `prosecnur-project`.

**Rama 6 — Escritorio y release técnico**
Electron, R embebido, asociación `.pulso`, instaladores, updater y workflows → `desktop-packaging` + revisiones aplicables → `verificador`. Construir no autoriza firmar, publicar, taggear ni subir.

**Rama 7 — Operar el repo**
Working tree grande / fin de sesión → `/cerrar-trabajo` · push o diagnóstico de CI → `/publicar` (pre-flight local espejo del CI + monitoreo + auto-diagnóstico) · corte de versión → `/preparar-release` · notas de versión (in-app + doc + GitHub) y versiones sin mapear → `/notas-parche` · salud del código (mensual) → `/auditoria-deuda` · commits sueltos → agente `curador-commits`.

**Rama 8 — Gobernar (decisiones)**
Arquitectura/ADRs → `prosecnur-architecture` + `guardian-contratos`; mapa de dominio → `dominio-prosecnur`; significado metodológico → `revisor-metodologico`. Las revisiones independientes se sintetizan por el lead.

Regla transversal: **toda rama que toque código termina en el agente `verificador`** antes de declararse lista.

### Reglas de oleadas

- Solo el lead delega. Hijos sin `Agent`/`Task`; profundidad máxima uno.
- Máximo tres trabajadores y dos writers; globs de escritura sin solape.
- `autor-regresiones` posee tests/fixtures cuando participa. Especialistas de integraciones, entregables y packaging prevalecen sobre `backend-r`.
- Claude solicita subagentes background cuando estén disponibles y usa Agent Teams solo para debate/coordinación cross-layer. La cascada es Teams → subagentes background → foreground → serie. Codex usa subagentes directos. El lead espera la oleada completa y sintetiza; no concatena salidas.

## Gates innegociables

1. **Nada se declara terminado sin evidencia de verificación.** Mínimo: typecheck si tocaste TS, tests afectados si tocaste lógica (vitest / testthat), chequeo visual si tocaste UI. El 33% de los fixes históricos corrigen archivos que un feat tocó 1–3 commits antes; este gate existe para bajar ese número.
2. **El working tree no acumula más de una unidad de trabajo.** Al cerrar una unidad coherente, commitear (skill `/cerrar-trabajo`). No terminar una sesión con miles de líneas sin commitear.
3. **Borrados de archivos con doble confirmación.** Antes de commitear el borrado de una página o módulo, verificar que es intencional y que está respaldado por un ADR o pedido explícito (histórico: `disenoEstudio`/`planTrabajo` se borraron y restauraron más de una vez).
4. **No versionar artefactos generados** (PNG/XLSX/HTML de outputs de QA) salvo fixtures o golden files deliberados.

## Reglas de código — backend R

- Errores que llegan al cliente siempre con `stop_api(status, code, ...)` y código `E_*` (`api/R/errors.R`; registro en `errors_registry.R`). No `stop()` crudo en rutas alcanzables por la API; no `try()` silencioso sin comentario del porqué. `E_INTERNAL` nunca expone el mensaje crudo: va un `error_id` correlacionable con stderr.
- **Archivos congelados a crecimiento** (líneas al 2026-07): `monitoreo_engine.R` (~40k), `hojas_ruta_engine.R` (~10k), `reporte_plan_ppt.R` (~9,4k), `router_monitoreo.R` (~8k). En frontend: `monitoreo.css` (~38k), `editor-v2.css` (~33k), `theme.css` (~30k), `TelefonicoMonitoreoPage.tsx` y `AcreditacionMonitoreoPage.tsx` (~20k cada uno). Funcionalidad nueva va en archivo nuevo (`<modulo>_<tema>.R` / componente propio) que el archivo grande llama. (`MonitoreoPage.tsx` fue retirado; sus sucesores son `MonitoreoShell` + `profiles/`.)
- Micro-helpers (`%||%`, `*_scalar`, `*_slug`, `*_chr`…): usar los compartidos existentes (`helpers_calc_comunes.R`, `reporte_helpers_*.R`); no redefinir por módulo.
- Engine nuevo = test nuevo (testthat, edition 3). Lógica calculable siempre con test; render (PDF/PPT/XLSX) al menos con contrato de artefactos (`expect_report_artifacts_registered`) o golden.
- Routers delgados: validación de input + llamada a engine + serialización. La lógica de dominio nueva va al engine, no al `mount_*`. Todo mount nuevo se registra en `plumber_app.R`.
- Dependencias nuevas van a `api/DESCRIPTION`; el CI instala exactamente lo declarado ahí.

## Reglas de código — frontend

- **Jerarquía canónica de navegación** (vocabulario oficial): **Familia/Módulo** (homepage, paleta propia) → **Sección** (top bar del módulo; en Procesamiento: Carga, Validación, Codificación, Analítica, Gráficos) → **Pestaña dinámica**. UI nueva se cuelga de uno de esos tres niveles; nunca duplicar la navegación de un nivel en otro. Al abrir un proyecto se aterriza en el homepage del proyecto (cards de avance), jamás en una ruta heredada de otro proyecto. El chrome de módulo es top bar uniforme (ADR 0042; el sidebar del ADR 0041 fue revertido).
- Rutas y navegación se declaran en `src/lib/modules.ts` + `src/app/App.tsx`; hay tests de contrato (`auditReadyRoutes.contract.test.ts`, `uiQuickCheckNavigation.contract.test.ts`) que fallan si el registro y las rutas divergen.
- TS estricto se mantiene: sin `any` nuevos en producción, sin `@ts-ignore`.
- Componentes nuevos en archivo propio; nunca inline dentro de un page-file que ya supera 1000 líneas.
- Colores solo con tokens `--pulso-*` de `theme.css` (~178 tokens); no hex hardcodeado en CSS de features.
- Íconos lucide siempre vía el shim `src/vendor/lucide-react.ts`.
- Páginas pesadas se cargan con `lazyWithReload` para no arrastrar su payload al bundle principal.
- Layout mediante `PageFrame` con `layout` (`document`/`workbench`/`canvas`/`data`) y `scrollOwner` explícitos; respetar la regla No Scroll Jail de `docs/ui-layout-grammar.md`. Matriz de viewports de QA: 1710x1107, 1440x1000, 1366x768, 1280x720, 1024x600.
- Estado duro en el backend scopeado por base; estado UI efímero en el store zustand del feature (patrón de `validacion/store.ts`). No añadir racimos de `useState` a páginas que ya tienen decenas.
- Funciones nuevas de API en su módulo de dominio de `src/api/` (`monitoreo.ts`, `graficos.ts`, …; `client.ts` es solo el barrel de compatibilidad y no crece); si el payload es crítico, normalizador defensivo (patrón `normalizeGraficosShareInspect`).
- Si la vista participa del QA visual, registrar su readiness en el QA contract (`data-audit-ready`).

## Comandos

Desarrollo:

- `make install-r` · `make install-frontend` · `make install-desktop`
- `make dev-api` (Plumber en :8787) · `make dev-frontend` (Vite en :5173)
- `make dev-pulso PULSO=/ruta/proyecto.pulso` — API + front con un proyecto ya abierto
- `make desktop-fast` — Electron sobre el build actual · `make build` — compila el front a `api/inst/www/`
- `make dev-status` / `make dev-prune` — inventario y limpieza de servers huérfanos

Verificación:

- Front: `pnpm -C frontend typecheck` · `pnpm -C frontend test` · `pnpm -C frontend exec tsc --noEmit --pretty false`
- R focalizado: `Rscript -e 'pkgload::load_all("api"); testthat::test_file("api/tests/testthat/test-<X>.R")'`
- R completo (igual que CI): `Rscript -e 'pkgload::load_all("api", quiet = TRUE); testthat::test_dir("api/tests/testthat", reporter = "summary")'`. Los tests que disparan jobs `callr` reales necesitan además `R CMD INSTALL --no-docs --library="$R_LIBS_USER" api`.
- Agentic OS: `node agentic/sync-agentic-os.mjs --check` · `node --test agentic/tests/*.test.mjs`
- Visual: `make ui-quick-check` · `make visual-qa` · `make monitoreo-qa`
- Auditoría canónica: `make audit-reference-build` · `make audit-project-visual-matrix` · `make desktop-audit`

CI (`.github/workflows/quality.yml`, tres jobs en paralelo): **agentic-os** (tests del sincronizador + `--check` de adaptadores), **frontend** (typecheck, vitest, build de producción, `pnpm audit --audit-level=high` en frontend y desktop), **backend-r** (deps de `DESCRIPTION`, `load_all`, `R CMD INSTALL`, `test_dir`). `release.yml` reusa este workflow. Antes de pushear conviene correr el pre-flight del skill `/publicar`, que espeja el CI localmente.

## Versionado y release

`api/DESCRIPTION` es la fuente única de la versión (hoy `0.5.19`). El mapa de versiones y nombres operativos vive en `docs/versiones-app.md`; las notas se redactan en tres superficies (Novedades in-app, ese doc y las release notes de GitHub) con el skill `/notas-parche`. El corte se hace con `/preparar-release` (tree limpio + gate completo + bump + tag `v*`) y la publicación con `/publicar`. Commits en español, conventional commits.
