---
name: revamp-visual
description: Rediseño o pulido visual de una vista o módulo de Prosecnur con dirección de diseño, implementación disciplinada y QA visual con evidencia. Usar cuando el usuario pida rediseñar, modernizar, pulir, "hacer más pro" o "revamp" de una página, módulo, pantalla o componente de la app.
---

# Revamp visual

La tarea más frecuente del usuario (homepage, calc-muestra, XLSForms, loading screen…). Un revamp sin dirección termina en deriva de tokens y CSS duplicado; un revamp sin QA visual termina en fixes al día siguiente. Este skill impone las tres fases.

## Fase 1 — Dirección (antes de tocar código)

1. Carga los skills globales `prosecnur-design-system` y `govern-visual-harmony`: el primero gobierna la gramática propia de Prosecnur y el segundo obliga a declarar geometría compositiva, repetición y capacidad antes de implementar. Para controles, jerarquía, materiales y densidad consulta sus referencias reales `prosecnur-ui-system.md`, `component-decision-matrix.md`, `implementation-playbook.md` y, cuando corresponda, `apple-design-criteria.md`; las dimensiones salen de los tokens `--pulso-*` y de componentes existentes comparables, no de cifras recordadas o inventadas. Para pulido de micro-interacciones y animación, complementa con `emil-design-eng`.
2. Identifica la **paleta de acento del módulo** (cada módulo tiene la suya; no la contamines con la de otro) y el tipo de `PageFrame` (`document/workbench/canvas/data`) según `docs/ui-layout-grammar.md`.
3. Captura el estado ANTES con `qa-visual-desktop` y `/ver-ui`, **contra un proyecto de referencia** (ADR 0043) y no contra la semilla sintética: un revamp validado con tres filas de datos de juguete se rompe al primer estudio real, que es donde aparecen las etiquetas largas, las tablas que desbordan y los scroll jails. Elige por módulo — `acnur_acg` para el pipeline de procesamiento, `acrconta` para acreditación multiactor, `acnur_pdm` para repeats y dashboard, `hsvg2026` para calc-muestra de aulas. Esta observación puede correr en paralelo con la inspección de tokens/arquitectura, pero ambas deben terminar antes de congelar la dirección y asignar archivos.
4. Declara en 3–5 líneas la dirección: qué problema visual se ataca, qué se conserva, qué patrón HIG aplica. Añade un **contrato de geometría y capacidad**: grupos pares/repetidos, ejes exteriores gobernados, tolerancia, secciones intrínsecas, estados `0/1/pocos/muchos` y dueño del overflow. Si el revamp cambia navegación o jerarquía de módulo, consulta `prosecnur-architecture` (puede ameritar ADR).

## Fase 2 — Implementación

Lanza `frontend-react` con la dirección congelada. Si `autor-regresiones` participa, asígnale exclusivamente tests/fixtures disjuntos y limita la oleada a dos writers. Refuerzos específicos de revamp:

- **Solo tokens `--pulso-*`**; si el diseño pide un color nuevo, se agrega como token en `theme.css`, no como hex en el CSS del feature (26/51 CSS de features ya tienen deriva — no la aumentes).
- El rail superior del módulo YA es el recorrido: no agregues segundas barras de pasos ni navegación duplicada; el pulido didáctico va dentro de cada pestaña.
- Componentes nuevos en archivo propio; los page-files >1000 líneas no crecen.
- Respeta la matriz de viewports (1710x1107 → 1024x600) y la regla "No Scroll Jail".
- Aplica el **Contrato de Superficie** (skill `/contrato-superficie`, norma en `docs/ui-layout-grammar.md#contrato-de-superficie`). Congelar dirección exige **C1 declarada**: cada grupo par o variante repetida nombra su `data-qa-geometry-group` y su contrato `equal`/`intrinsic` ANTES de asignar archivos — C1 es precondición, no resultado del QA. **C2**: el marco no crece con `items.length` y los hermanos comparten alto y ancho. **C3**: la capacidad no usada permanece dentro de la superficie visible y las secciones independientes conservan altura intrínseca. **C4**: el exceso pertenece a un dueño de scroll, paginación, virtualización o detalle alcanzable.
- No borres páginas o componentes "porque el rediseño los reemplaza" sin confirmarlo explícitamente (gate 3 de CLAUDE.md).

## Fase 3 — QA visual con evidencia

1. `pnpm --dir frontend typecheck` en verde.
2. Verificación independiente con `qa-visual-desktop`: skill `/ver-ui` para llegar a la vista con proyecto abierto; `make ui-quick-check` para la matriz, o `make reference-project-visual-matrix REFERENCE_PROJECT=<slug>` para recorrer todas las rutas contra el estudio real. QA no edita producto ni goldens. Verifica al menos el viewport grande y el compacto, y modo oscuro si la vista lo soporta. Usa el MISMO proyecto que en la fase 1: un ANTES sintético contra un DESPUÉS real no compara nada. En cada grupo par/repetido mide marco y región de contenido por separado en cardinalidad baja y alta; documenta diferencia máxima de alto, hueco exterior, dueño de overflow y alcance del último elemento. Para esa medición excluye descendientes de `details:not([open])` y otros nodos no renderizados; en un detalle cerrado solo cuenta el `summary`, y el cuerpo se mide después de abrirlo si pertenece al recorrido. Cuando haya scrolls anidados, mueve cada dueño desde el exterior hacia el interior antes de juzgar la hoja final. `visualIssues=0` sin esa evidencia no aprueba geometría.
3. **Dual-platform**: la app corre en macOS Y Windows (Windows es el release bloqueante). Si el cambio toca pesos tipográficos o depende del render de fuente, valida pensando en Segoe UI (el stack cae ahí en Windows); la geometría (alturas/spacing del kit) sí es portable tal cual.
4. Compara ANTES/DESPUÉS y reporta con screenshots. Si el revamp es de módulo completo, cierra con `prosecnur-ux-evaluator`.
5. Si la vista participa del QA visual, confirma que su `data-audit-ready` sigue registrado (y las pestañas nuevas en el QA contract).
6. Veredicto final con el agente `verificador` y sugerencia de `/cerrar-trabajo`.
