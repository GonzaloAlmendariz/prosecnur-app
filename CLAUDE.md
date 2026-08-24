# Prosecnur — reglas de la casa y agentic OS

App local-first para investigación por encuestas: Electron + React/Vite/TS (`frontend/`) + R/Plumber (`api/`, paquete `prosecnurapp`). Proyectos portables `.pulso`, secretos fuera del `.pulso`. Protocolo de trabajo: `AGENTS.md` → `docs/loops-reparacion.md`. Arquitectura: `docs/arquitectura-prosecnur.md`. Decisiones: `docs/adrs/`. Layout: `docs/ui-layout-grammar.md`. Identidad visual: `branding/` (dirección creativa, manual y logos canónicos — ADR 0038). Baseline de deuda: `docs/qa/deuda-baseline.md`.

## Mapa del repositorio

```
api/            Paquete R `prosecnurapp` — REST API (Plumber) + motor analítico
  DESCRIPTION     Fuente única de la versión de la app (hoy 0.5.19)
  R/              router_*.R, *_engine.R, reporte_*.R, graficador_*.R,
                  validacion_*.R, codificacion_*.R, calc_muestra_*.R,
                  monitoreo_*.R, surveymonkey_*.R, kobo_api.R, hojas_ruta_*.R
                  Infraestructura: plumber_app.R, session_store.R, jobs.R, errors.R,
                  project_pulso.R, io.R, helpers_*.R
  inst/samples/   Datasets demo · inst/audit_reference/ .pulso sintético canónico
  inst/www/       Build del frontend (generado; no versionado)
  tests/testthat/ test-*.R (REST, motores y contratos)
frontend/       React 18 + Vite 6 + TS estricto + zustand + react-router
  src/app/        Shell: App.tsx (rutas), Layout.tsx, BootGate.tsx, theme.css
  src/features/   Features por dominio (ver tabla de módulos)
  src/api/        Cliente por dominio; client.ts es solo barrel de compatibilidad
  src/components/ Primitivas compartidas (PageFrame, GlidingTabList, Panel, …)
  src/lib/        modules.ts (manifiesto de navegación v3), navegacion/direccion.ts, SessionContext, icons
  src/vendor/     Shim de lucide-react (imports directos por icono)
desktop/        Shell Electron (main.cjs, preload.cjs, auto-updater.cjs)
launcher/       launch.R (entry del backend) + install-r-deps.R
agentic/        Sincronizador de adaptadores Claude↔Codex + política de orquestación
.claude/        agents/ (13) · skills/ (18) · workflows/ — fuentes canónicas
.codex/, .agents/  Adaptadores GENERADOS; nunca editar a mano
docs/           adrs/ (0001–0048), qa/, arquitectura, layout, versiones-app.md
branding/       Identidad visual v3, tokens, logos, catálogo
packaging/, deploy/, scripts/   Instaladores, deploy web y utilidades de QA
```

No versionados y voluminosos: `tmp/`, `output(s)/`, `dist.nosync/`, `api/inst/www/`.

## Cómo corre la app

- **Runtime**: Plumber (R) escucha en `127.0.0.1:8787`, sirve la API REST bajo `/api/*` y los assets estáticos del SPA. Electron abre la ventana; en dev, Vite corre en `:5173` con proxy `/api` → `VITE_API_PROXY_TARGET`/`PULSO_PORT`.
- **Sesión**: efímera y en memoria (`session_store.R`), un `sid` por sesión, archivos en `tempdir()/prosecnur/<sid>/{uploads,state,jobs,downloads}`. `PULSO_BOOTSTRAP_PROJECT` precarga un `.pulso` y lo expone en `/api/system/bootstrap`.
- **`.pulso`**: zip con `manifest.json` + `state.rds` (estado de sesión sin caches derivables) + `files/` (inputs: XLSForm, data, plantillas editadas). Los entregables NO viven dentro; se exportan al lado vía `/api/fs/save-to-project`. Guardado explícito; `project_dirty` marca mutaciones. Secretos (SurveyMonkey/Kobo/Sheets) fuera del `.pulso` — ADR 0005.
- **Jobs**: operaciones pesadas van a `callr::r_bg` (`jobs.R`) con archivo de progreso y polling desde el front. Dos trampas conocidas: el worker resuelve funciones contra el paquete instalado y necesita el bootstrap de locale UTF-8. Skill `/jobs-asincronos`.
- **Modo público**: build web read-only (HF Spaces / Fly) que reusa el backend real pero sin shell admin (`isPublicMode()`, `PublicArtifactApp`).

## Módulos y rutas

Registro canónico en `frontend/src/lib/modules.ts` (`PROSECNUR_NAVIGATION_CONTRACT`
v3) y gramática en `frontend/src/lib/navegacion/direccion.ts`. Sus cinco
dimensiones son módulo → modo → sección → pestaña → panel; cada módulo declara
slug, tono `--pulso-module-*`, secciones y, cuando aplican, modos y pestañas.

Los ocho módulos del proyecto son:

| Módulo | Ruta | Modos / secciones |
|---|---|---|
| Bitácora (`diseno-estudio`) | `/bitacora` | bitácora · cronograma · calendario · canvas |
| Cálculo de muestra | `/calc-muestra` | modos `opinion-universitaria`, `marco-disponible`, `acreditacion`, `territorial-handoff` |
| Formularios (`editor-xlsform`) | `/editor-xlsform` | formularios |
| Hojas de ruta | `/hojas-ruta` | territorio · población · muestra · manzanas · entrega (tabs: cuotas, titulares, reemplazos) |
| Recopiladores | `/recopiladores` | plan de recolección · accesos · materiales · entrega a campo |
| Monitoreo | `/monitoreo` | modos acreditación · telefónico · territorial · cursos-horario (ADR 0022) |
| Procesamiento | `/procesamiento` | carga · validación · codificación · analítica · gráficos |
| Dashboard | `/tablero` | dashboard (code-split: plotly no entra al bundle principal) |

Rutas legacy (`/diseno-estudio`, `/plan-trabajo`, `/diseno-muestra`, `/muestra-aulas`) redirigen; no reintroducirlas como destinos.

## Enrutamiento del agentic OS

Las 18 skills de producto en `.claude/skills/` y los 13 agentes en
`.claude/agents/` son overlays locales y fuentes canónicas. Codex los consume
mediante adaptadores generados en `.agents/skills/` y `.codex/agents/`; nunca
se editan esos adaptadores a mano. Los únicos skills externos autorizados son
`emil-design-eng` y `govern-visual-harmony`, ambos transversales de diseño.

El lead carga `/orquestar-trabajo` para toda tarea no trivial, construye oleadas
de hasta tres trabajadores y conserva contrato, ownership, integración y gate.
Clasifica la tarea en una de las 8 ramas:

Validar la sincronización con `node agentic/sync-agentic-os.mjs --check`.
Contrato: `docs/agentic-os.md`.

**Rama 1 — Construir (feature/fix en la app)**
`/scope-lock` → bug/regresión: `diagnosticador-regresiones` + revisores aplicables en paralelo → `autor-regresiones` para fijar rojo → máximo dos writers entre `backend-r`/`frontend-react` → revisiones paralelas → `verificador` serial → `/cerrar-trabajo`. Features cross-layer congelan contrato antes de lanzar frontend/backend. Cargar `dominio-prosecnur` y `/nucleo-metodologico` cuando cambie lógica de encuesta (validación, codificación, limpieza, ponderación). Si el cambio crea o toca una superficie de UI, `/contrato-superficie` — la cláusula C1 se cumple al construir, no en el QA.

**Rama 2 — Diseñar (revamp/pulido visual, la tarea más frecuente)**
skill local `/revamp-visual` + `govern-visual-harmony` congelan dirección y
contrato geométrico; `emil-design-eng` complementa microinteracciones cuando
aplica → `qa-visual-desktop` toma baseline → `frontend-react` implementa → QA
independiente y `guardian-contratos` revisan → `verificador`.

**Contrato de Superficie** (`/contrato-superficie`, norma en `docs/ui-layout-grammar.md`): toda superficie declara qué es (**C1**), mantiene su marco pase lo que pase con sus datos (**C2**), contiene su propio vacío (**C3**), deja todo alcanzable (**C4**) y entrega lo que su función promete (**C5**). C1–C4 las verifica `ui-quick-check`; C5 exige `dominio-prosecnur` y `revisor-metodologico`. Se cita por código: `C2 en Modelo > Cuotas`, nunca "se ve raro". Regla de gate: **verde por conformidad, no por ausencia** — un `visualIssues=0` con `geometry-undeclared` o con vacíos sin clasificar no aprueba.

**Regla de observación**: para ver/iterar cualquier vista que viva detrás de un proyecto abierto, usa el skill `/ver-ui` (deep-link `?pulso=` en dev que salta el BootGate, más la dirección canónica del ADR 0044). Nunca digas "no puedo llegar a esa vista" sin haberlo intentado con `/ver-ui`. **Navegar es pedir una dirección, no clickear una etiqueta**: `window.__pulsoNav.ir("monitoreo/territorial/avance")` y `--ir <clave>` en los runners; `--click-tab` es fallback frágil. **Higiene de servers**: reusar antes de levantar (`preview_list`; el 8787 es del usuario, nunca matarlo), cerrar al terminar lo que tú levantaste, y ante huérfanos de otras sesiones `make dev-status` / `make dev-prune`.

**Rama 3 — Entregables (motores de salida)**
`especialista-entregables` implementa PDF, PPT, Word, XLSX, SAV, HTML, gráficos
e interactivos con los motores locales; `/entregables-oficina` gobierna sus
contratos de salida y los cronogramas se resuelven dentro del dominio local.
`revisor-metodologico` revisa grano/denominadores y `guardian-contratos`
jobs/artefactos; termina en `verificador`.

**Rama 4 — Integrar datos**
SurveyMonkey/Kobo/Sheets → `dominio-prosecnur` + `integraciones-datos` → `especialista-integraciones`; diagnóstico, contratos y metodología pueden investigar en paralelo. Tests sin red y gate `verificador`.

**Rama 5 — Estudios reales (datos de cliente)**
skill local `/estudio-real` (ACNUR/UNSA/Polarización-style: instrumento,
cuotas, base procesable, pesos, pipeline) + `dominio-prosecnur`. Para reproducir
un bug sobre estado real usar los **proyectos de referencia** (ADR 0043): cuatro
estudios anonimizados y versionados en `api/inst/reference_projects/`
(`acnur_pdm` repeats Kobo, `acnur_acg` pipeline completo hasta analítica,
`hsvg2026` marco de aulas a escala, `acrconta` multiactor + Sheets). Nunca
commitear un `.pulso` de cliente sin pasarlo por
`api/scripts/pulso_anonimizar.R`.

**Rama 6 — Escritorio y release técnico**
Electron, R embebido, asociación `.pulso`, instaladores, updater y workflows → `desktop-packaging` + revisiones aplicables → `verificador`. Construir no autoriza firmar, publicar, taggear ni subir.

**Rama 7 — Operar el repo**
Working tree grande / fin de sesión → `/cerrar-trabajo` · push o diagnóstico de CI → `/publicar` (pre-flight local espejo del CI + monitoreo + auto-diagnóstico) · corte de versión → `/preparar-release` · notas de versión (in-app + doc + GitHub) y versiones sin mapear → `/notas-parche` · salud del código (mensual) → `/auditoria-deuda` · trabajo de fondo que no cabe en una sesión y se deja corriendo → `/preparar-loop-indefinido` (arma el encargo que cada tick del reloj de fondo vuelve a abrir) · commits sueltos → agente `curador-commits`.

**Rama 8 — Gobernar (decisiones)**
Arquitectura/ADRs → documentación local + `guardian-contratos`; mapa de dominio
→ `dominio-prosecnur`; significado metodológico → `revisor-metodologico`. Las
revisiones independientes se sintetizan por el lead.

Regla transversal: **toda rama que toque código termina en el agente `verificador`** antes de declararse lista.

### Reglas de oleadas

- Solo el lead delega. Hijos sin `Agent`/`Task`; profundidad máxima uno.
- Máximo tres trabajadores y dos writers; globs de escritura sin solape.
- `autor-regresiones` posee tests/fixtures cuando participa. Especialistas de integraciones, entregables y packaging prevalecen sobre `backend-r`.
- Claude solicita subagentes background cuando estén disponibles y usa Agent Teams solo para debate/coordinación cross-layer. La cascada es Teams → subagentes background → foreground → serie. Codex usa subagentes directos. El lead espera la oleada completa y sintetiza; no concatena salidas.

## Gates innegociables

1. **Nada se declara terminado sin evidencia de verificación, y el gate se escala al diff.** Mínimo: typecheck si tocaste TS, tests afectados si tocaste lógica (vitest / testthat), chequeo visual si tocaste UI. El 33% de los fixes históricos corrigen archivos que un feat tocó 1–3 commits antes; este gate existe para bajar ese número. **Escalar significa acotar en ambos sentidos**: por defecto se corren las suites del área tocada (`testthat::test_file` de los `test-<área>*.R` afectados, vitest del feature), no la suite completa; `test_dir` completo y build de producción quedan reservados para `/preparar-release` y `/publicar`. Verificar de más también es deuda: una corrida completa (~1 h de R + 98 s de typecheck) por un cambio de CSS quema el ciclo sin subir la confianza.
2. **El working tree no acumula más de una unidad de trabajo.** Al cerrar una unidad coherente, commitear (skill `/cerrar-trabajo`). No terminar una sesión con miles de líneas sin commitear.
3. **Borrados de archivos con doble confirmación.** Antes de commitear el borrado de una página o módulo, verificar que es intencional y que está respaldado por un ADR o pedido explícito (histórico: `disenoEstudio`/`planTrabajo` se borraron y restauraron más de una vez).
4. **No versionar artefactos generados** (PNG/XLSX/HTML de outputs de QA) salvo fixtures o golden files deliberados.
5. **Un pedido con varias indicaciones se convierte en checklist antes de tocar código.** Doc vivo en `docs/qa/checklist-<tema>-<fecha>.md`, un ítem por indicación, y cada uno con **dónde vive** (motor / preset / proyecto / ADR) y su estado. Se marca conforme se cierran y sólo el usuario lo da por terminado. Existe porque en un lote de nueve arreglos el riesgo no es implementar mal: es **parsear mal la lista, perder un ítem por el camino o darlo por hecho sin verificarlo**. El checklist también es donde se anota lo aprendido de los que aún no se tocan —de dónde sale un valor, qué lo bloquea—, que es lo que evita reinvestigarlo en la sesión siguiente. Ítems que exigen decisión (ADR, contradicción con otro contrato) se marcan **bloqueados**, no pendientes. **Cada vez que el checklist se mencione, se dibuja entero**: la tabla completa con todos los ítems y su estado, no un «4 de 9» ni el resumen de los que se tocaron en esa tanda. Quien lee necesita ver de un vistazo qué falta sin abrir el documento, y un contador oculta justo lo que el checklist existe para hacer visible.

## Reglas de código — backend R

- Errores que llegan al cliente siempre con `stop_api(status, code, ...)` y código `E_*` (`api/R/errors.R`; registro en `errors_registry.R`). No `stop()` crudo en rutas alcanzables por la API; no `try()` silencioso sin comentario del porqué. `E_INTERNAL` nunca expone el mensaje crudo: va un `error_id` correlacionable con stderr.
- **Archivos congelados a crecimiento**: la lista viva y sus líneas base están en `agentic/manifest.json` (`policy.frozen_growth_files`); consúltala con `node agentic/sync-agentic-os.mjs --audit`, que falla si uno crece o si aparece un monolito nuevo sobre el umbral. **No dupliques la lista aquí**: la copia en prosa fue exactamente lo que derivó — `MonitoreoPage.tsx` siguió congelado tras borrarse mientras dos monolitos de perfil de ~20.000 líneas crecían sin gobierno. Funcionalidad nueva va en archivo nuevo (`<modulo>_<tema>.R` / componente o hoja propia) que el archivo grande llama; crecer un congelado exige subir su línea base de forma deliberada.
- Micro-helpers (`%||%`, `*_scalar`, `*_slug`, `*_chr`…): usar los compartidos existentes (`helpers_calc_comunes.R`, `reporte_helpers_*.R`); no redefinir por módulo.
- Engine nuevo = test nuevo (testthat, edition 3). Lógica calculable siempre con test; render (PDF/PPT/XLSX) al menos con contrato de artefactos (`expect_report_artifacts_registered`) o golden.
- Routers delgados: validación de input + llamada a engine + serialización. La lógica de dominio nueva va al engine, no al `mount_*`. Todo mount nuevo se registra en `plumber_app.R`.
- Dependencias nuevas van a `api/DESCRIPTION`; el CI instala exactamente lo declarado ahí.

## Reglas de código — frontend

- **Contrato de navegación v3 y sus cinco dimensiones** (vocabulario oficial, ADR 0043→0044): **Módulo** (homepage, paleta propia) → **Modo** (opcional; reescribe el juego de secciones y lo determina el estudio, no un click — Monitoreo y Cálculo de muestra) → **Sección** (top bar; en Procesamiento: Carga, Validación, Codificación, Analítica, Gráficos) → **Pestaña** → **Panel** (popover/sideover/diálogo/inspector). UI nueva se cuelga de una de esas cinco dimensiones; nunca duplicar la navegación de una dimensión en otra. Al abrir un proyecto se aterriza en el homepage del proyecto (cards de avance), jamás en una ruta heredada de otro proyecto. El chrome de módulo es top bar uniforme (ADR 0042; el sidebar del ADR 0041 fue revertido).
- **Toda vista es enlazable**: ruta = módulo, query = el resto (`/monitoreo?modo=territorial&seccion=avance&pestana=ump&panel=filtros`). Params canónicos `modo/seccion/pestana/panel/foco` (`lib/navegacion/direccion.ts`); los nombres viejos (`tab`, `stage`, `mesa`, `desk`, `step`, `reporte`) se leen como alias pero **nunca se escriben**. Un overlay nuevo se conecta con `usePanelDireccionable`, no con un `useState` suelto.
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
- Proyectos de referencia: `make reference-project-verify` (gate de PII + cobertura) · `make reference-project-run REFERENCE_PROJECT=<slug>` · `make reference-project-visual-matrix REFERENCE_PROJECT=<slug>`

CI (`.github/workflows/quality.yml`, tres jobs en paralelo): **agentic-os** (tests del sincronizador + `--check` de adaptadores), **frontend** (typecheck, vitest, build de producción, `pnpm audit --audit-level=high` en frontend y desktop), **backend-r** (deps de `DESCRIPTION`, `load_all`, `R CMD INSTALL`, `test_dir`). `release.yml` reusa este workflow. Antes de pushear conviene correr el pre-flight del skill `/publicar`, que espeja el CI localmente.

## Versionado y release

`api/DESCRIPTION` es la fuente única de la versión (hoy `0.5.19`). El mapa de versiones y nombres operativos vive en `docs/versiones-app.md`; las notas se redactan en tres superficies (Novedades in-app, ese doc y las release notes de GitHub) con el skill `/notas-parche`. El corte se hace con `/preparar-release` (tree limpio + gate completo + bump + tag `v*`) y la publicación con `/publicar`. Commits en español, conventional commits.
