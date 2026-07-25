---
name: revamp-visual
description: Rediseño o pulido visual de una vista o módulo de Prosecnur con dirección de diseño, implementación disciplinada y QA visual con evidencia. Usar cuando el usuario pida rediseñar, modernizar, pulir, "hacer más pro" o "revamp" de una página, módulo, pantalla o componente de la app.
---

# Revamp visual

La tarea más frecuente del usuario (homepage, calc-muestra, XLSForms, loading screen…). Un revamp sin dirección termina en deriva de tokens y CSS duplicado; un revamp sin QA visual termina en fixes al día siguiente. Este skill impone las tres fases.

## Fase 1 — Dirección (antes de tocar código)

1. Carga el skill global `prosecnur-design-system` (dirección Apple/macOS, paleta del módulo, matriz de decisión de componentes). Para dimensiones exactas de controles, ramp tipográfico y estados, usa su referencia `references/macos-metrics.md` (spec numérica extraída del Apple macOS 26 UI Kit: escalera de alturas 16/20/24/28/36, peso Medium 500 para controles, sidebar 240/filas 32, acento #0088FF de estados) — las medidas se toman de ahí, no se inventan. Para pulido de micro-interacciones y animación, complementa con `emil-design-eng`.
2. Identifica la **paleta de acento del módulo** (cada módulo tiene la suya; no la contamines con la de otro) y el tipo de `PageFrame` (`document/workbench/canvas/data`) según `docs/ui-layout-grammar.md`.
3. Captura el estado ANTES con `qa-visual-desktop` y `/ver-ui`, **contra un proyecto de referencia** (ADR 0043) y no contra la semilla sintética: un revamp validado con tres filas de datos de juguete se rompe al primer estudio real, que es donde aparecen las etiquetas largas, las tablas que desbordan y los scroll jails. Elige por módulo — `acnur_acg` para el pipeline de procesamiento, `acrconta` para acreditación multiactor, `acnur_pdm` para repeats y dashboard, `hsvg2026` para calc-muestra de aulas. Esta observación puede correr en paralelo con la inspección de tokens/arquitectura, pero ambas deben terminar antes de congelar la dirección y asignar archivos.
4. Declara en 3–5 líneas la dirección: qué problema visual se ataca, qué se conserva, qué patrón HIG aplica. Si el revamp cambia navegación o jerarquía de módulo, consulta `prosecnur-architecture` (puede ameritar ADR).

## Fase 2 — Implementación

Lanza `frontend-react` con la dirección congelada. Si `autor-regresiones` participa, asígnale exclusivamente tests/fixtures disjuntos y limita la oleada a dos writers. Refuerzos específicos de revamp:

- **Solo tokens `--pulso-*`**; si el diseño pide un color nuevo, se agrega como token en `theme.css`, no como hex en el CSS del feature (26/51 CSS de features ya tienen deriva — no la aumentes).
- El rail superior del módulo YA es el recorrido: no agregues segundas barras de pasos ni navegación duplicada; el pulido didáctico va dentro de cada pestaña.
- Componentes nuevos en archivo propio; los page-files >1000 líneas no crecen.
- Respeta la matriz de viewports (1710x1107 → 1024x600) y la regla "No Scroll Jail".
- No borres páginas o componentes "porque el rediseño los reemplaza" sin confirmarlo explícitamente (gate 3 de CLAUDE.md).

## Fase 3 — QA visual con evidencia

1. `pnpm --dir frontend typecheck` en verde.
2. Verificación independiente con `qa-visual-desktop`: skill `/ver-ui` para llegar a la vista con proyecto abierto; `make ui-quick-check` para la matriz, o `make reference-project-visual-matrix REFERENCE_PROJECT=<slug>` para recorrer todas las rutas contra el estudio real. QA no edita producto ni goldens. Verifica al menos el viewport grande y el compacto, y modo oscuro si la vista lo soporta. Usa el MISMO proyecto que en la fase 1: un ANTES sintético contra un DESPUÉS real no compara nada.
3. **Dual-platform**: la app corre en macOS Y Windows (Windows es el release bloqueante). Si el cambio toca pesos tipográficos o depende del render de fuente, valida pensando en Segoe UI (el stack cae ahí en Windows); la geometría (alturas/spacing del kit) sí es portable tal cual.
4. Compara ANTES/DESPUÉS y reporta con screenshots. Si el revamp es de módulo completo, cierra con `prosecnur-ux-evaluator`.
5. Si la vista participa del QA visual, confirma que su `data-audit-ready` sigue registrado (y las pestañas nuevas en el QA contract).
6. Veredicto final con el agente `verificador` y sugerencia de `/cerrar-trabajo`.
