---
name: revamp-visual
description: Rediseño o pulido visual de una vista o módulo de Prosecnur con dirección de diseño, implementación disciplinada y QA visual con evidencia. Usar cuando el usuario pida rediseñar, modernizar, pulir, "hacer más pro" o "revamp" de una página, módulo, pantalla o componente de la app.
---

# Revamp visual

La tarea más frecuente del usuario (homepage, calc-muestra, XLSForms, loading screen…). Un revamp sin dirección termina en deriva de tokens y CSS duplicado; un revamp sin QA visual termina en fixes al día siguiente. Este skill impone las tres fases.

## Fase 1 — Dirección (antes de tocar código)

1. Carga el skill global `prosecnur-design-system` (dirección Apple/macOS, paleta del módulo, matriz de decisión de componentes). Para pulido de micro-interacciones y animación, complementa con `emil-design-eng`.
2. Identifica la **paleta de acento del módulo** (cada módulo tiene la suya; no la contamines con la de otro) y el tipo de `PageFrame` (`document/workbench/canvas/data`) según `docs/ui-layout-grammar.md`.
3. Captura el estado ANTES: usa el skill `/ver-ui` para llegar a la vista exacta (salta el BootGate con `?pulso=`) y toma screenshot. Sin "antes" no se puede defender el "después".
4. Declara en 3–5 líneas la dirección: qué problema visual se ataca, qué se conserva, qué patrón HIG aplica. Si el revamp cambia navegación o jerarquía de módulo, consulta `prosecnur-architecture` (puede ameritar ADR).

## Fase 2 — Implementación

Lanza el agente `frontend-react` (o aplica sus reglas inline) con la dirección de la fase 1. Refuerzos específicos de revamp:

- **Solo tokens `--pulso-*`**; si el diseño pide un color nuevo, se agrega como token en `theme.css`, no como hex en el CSS del feature (26/51 CSS de features ya tienen deriva — no la aumentes).
- El rail superior del módulo YA es el recorrido: no agregues segundas barras de pasos ni navegación duplicada; el pulido didáctico va dentro de cada pestaña.
- Componentes nuevos en archivo propio; los page-files >1000 líneas no crecen.
- Respeta la matriz de viewports (1710x1107 → 1024x600) y la regla "No Scroll Jail".
- No borres páginas o componentes "porque el rediseño los reemplaza" sin confirmarlo explícitamente (gate 3 de CLAUDE.md).

## Fase 3 — QA visual con evidencia

1. `pnpm --dir frontend typecheck` en verde.
2. Verificación en navegador real: skill `/ver-ui` para llegar a la vista con proyecto abierto e iterar con HMR; `make ui-quick-check` para la pasada de matriz. Verifica al menos el viewport grande y el compacto, y modo oscuro si la vista lo soporta.
3. Compara ANTES/DESPUÉS y reporta con screenshots. Si el revamp es de módulo completo, cierra con `prosecnur-ux-evaluator`.
4. Si la vista participa del QA visual, confirma que su `data-audit-ready` sigue registrado (y las pestañas nuevas en el QA contract).
5. Veredicto final con el agente `verificador` y sugerencia de `/cerrar-trabajo`.
