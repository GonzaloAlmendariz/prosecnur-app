# Prosecnur — reglas de la casa y agentic OS

App local-first para investigación por encuestas: Electron + React/Vite/TS (`frontend/`) + R/Plumber (`api/`, paquete `prosecnurapp`). Proyectos portables `.pulso`, secretos fuera del `.pulso`. Protocolo de trabajo: `AGENTS.md` → `docs/loops-reparacion.md`. Decisiones: `docs/adrs/`. Layout: `docs/ui-layout-grammar.md`. Identidad visual: `branding/` (dirección creativa, manual y logos canónicos — ADR 0038). Baseline de deuda: `docs/qa/deuda-baseline.md`.

## Enrutamiento del agentic OS

Subagentes en `.claude/agents/`, skills en `.claude/skills/`. El lead carga `/orquestar-trabajo` para toda tarea no trivial, construye oleadas de hasta tres trabajadores y conserva contrato, ownership, integración y gate. Clasifica la tarea en una de las 8 ramas:

Estas rutas siguen siendo la fuente canónica para Claude. Codex las consume mediante adaptadores generados en `.codex/agents/` y `.agents/skills/`; validar la sincronización con `node agentic/sync-agentic-os.mjs --check` y nunca editar los adaptadores a mano. Contrato: `docs/agentic-os.md`.

**Rama 1 — Construir (feature/fix en la app)**
`/scope-lock` → bug/regresión: `diagnosticador-regresiones` + revisores aplicables en paralelo → `autor-regresiones` para fijar rojo → máximo dos writers entre `backend-r`/`frontend-react` → revisiones paralelas → `verificador` serial → `/cerrar-trabajo`. Features cross-layer congelan contrato antes de lanzar frontend/backend. Cargar `dominio-prosecnur` y el skill fino cuando cambie lógica de encuesta.

**Rama 2 — Diseñar (revamp/pulido visual, la tarea más frecuente)**
skill `/revamp-visual` → `qa-visual-desktop` toma baseline → `frontend-react` implementa → QA independiente after → `verificador`. La auditoría UX profunda usa `prosecnur-ux-evaluator`; navegación/arquitectura suma `guardian-contratos`.

**Regla de observación**: para ver/iterar cualquier vista que viva detrás de un proyecto abierto, usa el skill `/ver-ui` (deep-link `?pulso=` en dev que salta el BootGate, más la dirección canónica del ADR 0044). Nunca digas "no puedo llegar a esa vista" sin haberlo intentado con `/ver-ui`. **Navegar es pedir una dirección, no clickear una etiqueta**: `window.__pulsoNav.ir("monitoreo/territorial/avance")` y `--ir <clave>` en los runners; `--click-tab` es fallback frágil. **Higiene de servers**: reusar antes de levantar (`preview_list`; el 8787 es del usuario, nunca matarlo), cerrar al terminar lo que tú levantaste, y ante huérfanos de otras sesiones `make dev-status` / `make dev-prune`.

**Rama 3 — Entregables (motores de salida)**
`especialista-entregables` implementa. PDF → `prosecnur-pdf-engine`; PPT/Word/XLSX → `entregables-oficina`; cronogramas → `cronograma-encuestas`. `revisor-metodologico` revisa grano/denominadores y `guardian-contratos` jobs/artefactos; termina en `verificador`.

**Rama 4 — Integrar datos**
SurveyMonkey/Kobo/Sheets → `dominio-prosecnur` + `integraciones-datos` → `especialista-integraciones`; diagnóstico, contratos y metodología pueden investigar en paralelo. Tests sin red y gate `verificador`.

**Rama 5 — Estudios reales (datos de cliente)**
skill `/estudio-real` (ACNUR/UNSA/Polarización-style: instrumento, cuotas, base procesable, pesos, pipeline). Auditoría sintética canónica → skill global `prosecnur-project`. Para reproducir un bug sobre estado real usar los **proyectos de referencia** (ADR 0043): cuatro estudios anonimizados y versionados en `api/inst/reference_projects/` (`acnur_pdm` repeats Kobo, `acnur_acg` pipeline completo hasta analítica, `hsvg2026` marco de aulas a escala, `acrconta` multiactor + Sheets). Nunca commitear un `.pulso` de cliente sin pasarlo por `api/scripts/pulso_anonimizar.R`.

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

- Errores que llegan al cliente siempre con `stop_api(status, code, ...)` y código `E_*` (`api/R/errors.R`). No `stop()` crudo en rutas alcanzables por la API; no `try()` silencioso sin comentario del porqué.
- **Archivos congelados a crecimiento**: `monitoreo_engine.R`, `router_monitoreo.R`, `reporte_plan_ppt.R`, `MonitoreoPage.tsx`. Funcionalidad nueva va en archivo nuevo (`<modulo>_<tema>.R` / componente propio) que el archivo grande llama.
- Micro-helpers (`%||%`, `*_scalar`, `*_slug`, `*_chr`…): usar los compartidos existentes (`helpers_calc_comunes.R`, `reporte_helpers_*.R`); no redefinir por módulo.
- Engine nuevo = test nuevo (testthat). Lógica calculable siempre con test; render (PDF/PPT/XLSX) al menos con contrato de artefactos (`expect_report_artifacts_registered`) o golden.
- Routers delgados: validación de input + llamada a engine + serialización. La lógica de dominio nueva va al engine, no al `mount_*`.

## Reglas de código — frontend

- **Jerarquía canónica de navegación** (vocabulario oficial, ADR 0043→0044): **Módulo** (homepage, paleta propia) → **Modo** (opcional; reescribe el juego de secciones y lo determina el estudio, no un click — Monitoreo y Cálculo de muestra) → **Sección** (top bar; en Procesamiento: Carga, Validación, Codificación, Analítica, Gráficos) → **Pestaña** → **Panel** (popover/sideover/diálogo/inspector). UI nueva se cuelga de uno de esos cinco niveles; nunca duplicar la navegación de un nivel en otro. Al abrir un proyecto se aterriza en el homepage del proyecto (cards de avance), jamás en una ruta heredada de otro proyecto.
- **Toda vista es enlazable**: ruta = módulo, query = el resto (`/monitoreo?modo=territorial&seccion=avance&pestana=ump&panel=filtros`). Params canónicos `modo/seccion/pestana/panel/foco` (`lib/navegacion/direccion.ts`); los nombres viejos (`tab`, `stage`, `mesa`, `desk`, `step`, `reporte`) se leen como alias pero **nunca se escriben**. Un overlay nuevo se conecta con `usePanelDireccionable`, no con un `useState` suelto.
- TS estricto se mantiene: sin `any` nuevos en producción, sin `@ts-ignore`.
- Componentes nuevos en archivo propio; nunca inline dentro de un page-file que ya supera 1000 líneas.
- Colores solo con tokens `--pulso-*` de `theme.css`; no hex hardcodeado en CSS de features.
- Íconos lucide siempre vía el shim `src/vendor/lucide-react.ts`.
- Estado duro en el backend scopeado por base; estado UI efímero en el store zustand del feature (patrón de `validacion/store.ts`). No añadir racimos de `useState` a páginas que ya tienen decenas.
- Funciones nuevas de API en su módulo de dominio de `src/api/` (`monitoreo.ts`, `graficos.ts`, …; `client.ts` es solo el barrel de compatibilidad y no crece); si el payload es crítico, normalizador defensivo (patrón `normalizeGraficosShareInspect`).
- Si la vista participa del QA visual, registrar su readiness en el QA contract (`data-audit-ready`).

## Comandos de verificación

- Front: `pnpm --dir frontend typecheck` · `pnpm --dir frontend test`
- R focalizado: `Rscript -e 'pkgload::load_all("api"); testthat::test_file("api/tests/testthat/test-<X>.R")'`
- R completo: `make`-menos; usar `testthat::test_dir` como en CI (`.github/workflows/quality.yml`)
- Visual: `make ui-quick-check` · `make visual-qa` · `make monitoreo-qa`
- Auditoría canónica: `make audit-project-visual-matrix`
- Proyectos de referencia: `make reference-project-verify` (gate de PII + cobertura) · `make reference-project-run REFERENCE_PROJECT=<slug>` · `make reference-project-visual-matrix REFERENCE_PROJECT=<slug>`
