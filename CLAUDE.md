# Prosecnur — reglas de la casa y agentic OS

App local-first para investigación por encuestas: Electron + React/Vite/TS (`frontend/`) + R/Plumber (`api/`, paquete `prosecnurapp`). Proyectos portables `.pulso`, secretos fuera del `.pulso`. Protocolo de trabajo: `AGENTS.md` → `docs/loops-reparacion.md`. Decisiones: `docs/adrs/`. Layout: `docs/ui-layout-grammar.md`. Baseline de deuda: `docs/qa/deuda-baseline.md`.

## Enrutamiento del agentic OS

Subagentes en `.claude/agents/`, skills en `.claude/skills/`. Clasifica la tarea en una de las 6 ramas y sigue su ruta:

**Rama 1 — Construir (feature/fix en la app)**
`/scope-lock` para arrancar → agente `backend-r` y/o `frontend-react` → agente `verificador` → `/cerrar-trabajo`. Si la tarea toca lógica de dominio de encuestas, cargar antes el skill `dominio-prosecnur` y su skill fino: `integraciones-datos` (ingesta/conectores), `jobs-asincronos` (operaciones pesadas), `nucleo-metodologico` (validación/codificación/limpieza/ponderación).

**Rama 2 — Diseñar (revamp/pulido visual, la tarea más frecuente)**
skill `/revamp-visual` (orquesta `prosecnur-design-system` + `emil-design-eng` globales, implementación y QA visual con evidencia). Auditoría UX de módulo completo → skill global `prosecnur-ux-evaluator`.

**Regla de observación**: para ver/iterar cualquier vista que viva detrás de un proyecto abierto, usa el skill `/ver-ui` (deep-link `?pulso=` en dev que salta el BootGate). Nunca digas "no puedo llegar a esa vista" sin haberlo intentado con `/ver-ui`.

**Rama 3 — Entregables (motores de salida)**
PDF → skill global `prosecnur-pdf-engine` · PPT/Word/XLSX → skill `entregables-oficina` · cronogramas XLSX → skill global `cronograma-encuestas`.

**Rama 4 — Estudios reales (datos de cliente)**
skill `/estudio-real` (ACNUR/UNSA/Polarización-style: instrumento, cuotas, base procesable, pesos, pipeline). Auditoría sintética canónica → skill global `prosecnur-project`.

**Rama 5 — Operar el repo**
Working tree grande / fin de sesión → `/cerrar-trabajo` · corte de versión → `/preparar-release` · salud del código (mensual) → `/auditoria-deuda` · commits sueltos → agente `curador-commits`.

**Rama 6 — Gobernar (decisiones)**
Arquitectura, ADRs, límites de módulo → skill global `prosecnur-architecture`. Mapa de dominio y conceptos ("dónde vive X") → skill `dominio-prosecnur`.

Regla transversal: **toda rama que toque código termina en el agente `verificador`** antes de declararse lista.

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

- **Jerarquía canónica de navegación** (vocabulario oficial): **Familia/Módulo** (homepage, paleta propia) → **Sección** (top bar del módulo; en Procesamiento: Carga, Validación, Codificación, Analítica, Gráficos) → **Pestaña dinámica**. UI nueva se cuelga de uno de esos tres niveles; nunca duplicar la navegación de un nivel en otro. Al abrir un proyecto se aterriza en el homepage del proyecto (cards de avance), jamás en una ruta heredada de otro proyecto.
- TS estricto se mantiene: sin `any` nuevos en producción, sin `@ts-ignore`.
- Componentes nuevos en archivo propio; nunca inline dentro de un page-file que ya supera 1000 líneas.
- Colores solo con tokens `--pulso-*` de `theme.css`; no hex hardcodeado en CSS de features.
- Íconos lucide siempre vía el shim `src/vendor/lucide-react.ts`.
- Estado duro en el backend scopeado por base; estado UI efímero en el store zustand del feature (patrón de `validacion/store.ts`). No añadir racimos de `useState` a páginas que ya tienen decenas.
- Funciones nuevas de API en `client.ts` con tipos; si el payload es crítico, normalizador defensivo (patrón `normalizeGraficosShareInspect`).
- Si la vista participa del QA visual, registrar su readiness en el QA contract (`data-audit-ready`).

## Comandos de verificación

- Front: `pnpm --dir frontend typecheck` · `pnpm --dir frontend test`
- R focalizado: `Rscript -e 'pkgload::load_all("api"); testthat::test_file("api/tests/testthat/test-<X>.R")'`
- R completo: `make`-menos; usar `testthat::test_dir` como en CI (`.github/workflows/quality.yml`)
- Visual: `make ui-quick-check` · `make visual-qa` · `make monitoreo-qa`
- Auditoría canónica: `make audit-project-visual-matrix`
