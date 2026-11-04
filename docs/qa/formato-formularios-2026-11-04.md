# Formato en Formularios (4 nov 2026, noche)

Encargo de coordinación (Meta B) a pedido de Gonzalo: «aún hay bastante UI desfasada por mejorar durante toda la
noche». Receta de `formato-monitoreo-2026-11-02.md` y `formato-hojas-ruta-2026-11-04.md`. Alcance de escritura:
`frontend/src/features/xlsformEditor/`, sus tests y este doc. Las decisiones son de coordinación y **revisables por
Gonzalo**. Se respeta el trabajo reciente de Gonzalo (asa de arrastre, botón «?», L36 «Así queda»); `impreso/` sólo
después de mirar su `git log`.

## Medición (4 nov, mañana)

Script `medirxf.mjs` en el scratchpad de la sesión: recorre `features/xlsformEditor` sin tests ni `__tests__` y no
cuenta comentarios.

| # | Patrón | Antes | Dónde nace | Nota |
|---|---|---|---|---|
| P1 | `font-size` en px | 47 en 6 hojas | `impreso/impreso.css` 17, `styles/xf-simulator.css` 17, `styles/xf-preview-inputs.css` 9 | **Ya cerrado** por la pasada L29 y el ratchet `app/letraPorRol`: los 47 son excepciones declaradas en su regla. El impreso es la página del Word, el simulador y la previa de entradas imitan el formulario en el dispositivo, la frase del Armador es grande a propósito, el «×» es un glifo y el título de la biblioteca va entre `title` y `display` |
| P2 | `h2–h4` sueltos / `<Panel>` del kit | 56 en 42 archivos / 3 | `shell/` 24, `choiceFilters/` 8 | |
| P3 | Líneas de código con « · » | 120 en 76 archivos | `shell/` 40, `canvas-graph/` 12, `impreso/` 12, `outline/` 10 | La cifra de 305 del encargo incluía comentarios |
| P4 | Cifra a mano (`toLocaleString`, `toFixed`) | 6 | `shell/HallazgosPanel.tsx` 2, `kit/Sello.tsx`, `outline/modeloEstructura.ts`, `resumen/TablaSecciones.tsx`, `shell/campanaComplementariaModel.ts` | |
| P5 | Vacíos y cargas con receta propia (usos en JSX) | ~70, más de 20 recetas | `pulso-xf-listas-vacio`, `xfo-vacio`, `xfh-vacia`, `pulso-xfs-empty`, `pulso-logic-builder-empty`… | `EstadoVacio` del kit: 0 usos; `LoadingBlock`: 1 |
| P6 | Estados con píldora propia | ~70 | `xcf-chip`, `pulso-xftr-chip`, `pulso-xfs-pill`, `pulso-xf-status-dot`… | `EstadoChip` del kit: 0 usos. Sólo los que dicen un ESTADO (cumple, falta, error); los chips de dato o de tipo quedan |

## Ranking de vistas (por densidad de patrones, peor primero)

| # | Vista | « · » | Vacío o carga | Chip o estado | `h2–h4` | Estado |
|---|---|---|---|---|---|---|
| 1 | `shell/` (cabecera, biblioteca, paneles laterales, asistentes) | 40 | 20 | 24 | 24 | ☑ tanda 1 |
| 2 | `inspector/` | 7 | 11 | 22 | 0 | ☑ tanda 2 |
| 3 | `choiceFilters/` | 6 | 5 | 11 | 8 | ☑ tanda 3 |
| 4 | `canvas-graph/` (lógica en grafo) | 12 | 10 | 4 | 1 | ☑ tanda 3 |
| 5 | `canvas/` | 6 | 8 | 5 | 4 | ☑ tanda 3 |
| 6 | `impreso/` | 12 | 3 | 6 | 2 | ☐ (mirar `git log` antes) |
| 7 | `sheets/`, `outline/`, `listas/`, `catalogs/`, `resumen/` y el resto | 30 | 18 | 15 | 17 | ☐ |

## Estado

| Paso | Estado | Commit | Nota |
|---|---|---|---|
| Medición y ranking | ☑ | (este doc) | |
| Tanda 1: `shell/` | ☑ | (ver abajo) | P3: 39 líneas pasan a coma, «y» o paréntesis («Disponible, revisión 2», «Fuera de Prosecnur (SPSS)», «Matriz (2 filas)»). La barra de comando dice «N preguntas, M secciones, listas» sin separadores sueltos. El parser de errores del servidor busca `\u00b7`, no el carácter. P4: `toFixed` y `toLocaleString` a `formatoDecimal`. P5: 12 vacíos a `EstadoVacio` y la carga de sugerencias a `LoadingBlock`; −16 selectores huérfanos. Declarados: el simulador y el esqueleto de carga de la campaña. P6: sin estados con tono que convertir («Activo» es identidad del módulo; las píldoras de la barra son el slot de estado del chrome). Guard nuevo `formatoDelModulo.contract.test.ts` (P3, P4 y P5 por archivo, sólo baja). Foto: P3 81, P4 3, P5 48 |
| Tanda 2: `inspector/` | ☑ | (ver abajo) | P3: 7 líneas («n.º 3», «(compartida con 2)», «(equivale a DNI)», el placeholder de cálculo con «o»). P5: 6 vacíos a `EstadoVacio`, los de condición y validación con su acción («+ Agregar condición», «Fórmula avanzada»); −7 selectores huérfanos. Declarados: la condición guiada sin preguntas previas (ilustración y dos acciones) y `pulso-catalogchip-empty`, que es el botón «Asignar lista» y cuyo estilo vive en `app/theme.css`. P6: los chips del inspector son de tipo o de dato, no estados. Foto: P3 74, P4 3, P5 41 |
| Tanda 3: `choiceFilters/`, `canvas-graph/`, `canvas/` | ☑ | (ver abajo) | P3: 24 líneas. Los pasos del asistente de filtro dicen «1. Pregunta»; las relaciones del lienzo, «(3 ramas)»; las fichas, «Pregunta 4, Sección A»; la referencia corta de una pregunta, «P3.2». P5: 6 vacíos a `EstadoVacio` (el cierre de sección con su acción «Eliminar el cierre»); −10 selectores huérfanos. Declarados: las superposiciones del lienzo de lógica (`pulso-graph-*`, con ilustración y acciones). Foto: P3 50, P4 3, P5 32 |
