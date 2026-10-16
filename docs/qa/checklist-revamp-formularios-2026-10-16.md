# Checklist — revamp visual del módulo Formularios (2026-10-16)

Propuesta aprobada por el usuario («todo tiene mi aprobación»): canvas
https://claude.ai/artifact/XkpdPVxW4CN7Gthdx1HaQV (privado). Rama
`feat/revamp-formularios`, worktree `.claude/worktrees/revamp-formularios`.
Se implementa en un loop indefinido con descanso de 4 minutos.

Indicaciones del usuario que gobiernan todo el revamp:

- «Usa Linear y Airtable de referencia y rehaz todo»
- «presta especial atención en cómo somos capaces de editar condiciones lógicas, validación, cálculos y restricciones de forma elegante y didáctica»
- «el canvas de lógica siento que está increíblemente planteado»: el mapa se conserva.
- «El editor de hojas debería llamarse Editor XLSForm y debería respetar los nombres de los campos de un xlsforms y embrace it, más ser capaz de ayudar al analista»
- «cada vista es un subtab o pestaña del módulo»
- «cálculo o restricción debe ser su propia vista de la misma forma que lógica tiene la suya»
- «debe ser igual de sólido en el constructor que en la subpestaña, sólo que la subpestaña sirve para tener mayor espacio, más detalle visual»
- «contenedores profesionales … orden, coherencia»; nada «vacío, plano, suelto, no simétrico, con espacio en blanco irregular en altura»; «ojo fino con los desbordes»
- «trata de modular el módulo para que los archivos estén bien balanceados y no sean gigantes»
- Lógica: distinguir «lógica aplicada a toda una sección» de «lógica aplicada a una pregunta en particular».

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| E0 | Rama, worktree, dependencias, checklist y encargo del loop | rama `feat/revamp-formularios` | ☑ |
| E1 | Kit visual: tarjeta con cabecera y pie, filas de propiedad, segmentado, ficha de pregunta, iconos por tipo, filas de condición; sólo tokens `--pulso-*` | `xlsformEditor/kit/` (nuevo) | ☐ |
| E2 | Marco del módulo: rail con Constructor, Editor XLSForm, Leer, Lógica, Restricciones (nueva), Cálculos (nueva), Probar, Resumen, Impreso | `navegacion/catalogos/editorFormularios.ts`, rail y contratos de navegación | ☐ |
| E3 | Constructor en tarjetas: pregunta y respuestas, «Cuándo aparece» con la regla heredada de la sección, «Qué acepta» junto a «Así se imprime», propiedades y relaciones | `canvas/` (componentes nuevos; `FocusedWorkspace.tsx` no crece) | ☐ |
| E4 | Lógica: lista por sección con reglas de sección y de pregunta, filtro Todas/Sección/Pregunta, editor en tarjetas; el mapa se conserva | `canvas-graph/`, `inspector/logic/` | ☐ |
| E5 | Pestaña Restricciones: punto de partida, regla, mensaje, vista del teléfono, probar valores, antes de guardar | nueva | ☐ |
| E6 | Pestaña Cálculos: lista, editor de fórmula con `@`, catálogo de funciones, probar, relaciones | nueva | ☐ |
| E7 | Editor XLSForm: hojas survey/choices/settings con columnas reales, barra de fórmula, fila seleccionada, revisión con arreglos | `sheets/` | ☐ |
| E8 | Impreso: ajustes en tarjetas, dos páginas A4 | `impreso/` | ☐ |
| E9 | Resumen: franja de cifras, organización, quién responde qué, escalas, antes de aplicar | `resumen/` | ☐ |
| E10 | Movimiento: duraciones ≤ 240 ms, una curva, sólo opacidad/posición, `prefers-reduced-motion` | kit | ☐ |
| EM | Modularización: ningún archivo del módulo gigante (objetivo ≤ ~500 líneas .ts/.tsx, ≤ ~600 .css); cada etapa extrae primero (refactor puro, commit propio) y rediseña después. Hoy: XlsformEditorPage 4426, FocusedWorkspace 4585, LogicCanvas 2339, RuleWizard 1917, xlsform-v2.css 6229 | todo `xlsformEditor/` | ☐ |
| E11 | QA visual en la matriz de viewports, `verificador`, commits por etapa | — | ☐ |
