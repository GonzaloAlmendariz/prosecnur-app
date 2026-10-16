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
- «resúmelos en 6 formularios tipo que engloben todos esos 23»: toda verificación usa `~/Documents/Pulso/90_Pruebas/corpus_instrumentos/pulso/formularios-tipo.pulso`, nunca acrconta.
- Lógica: distinguir «lógica aplicada a toda una sección» de «lógica aplicada a una pregunta en particular».

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| E0 | Rama, worktree, dependencias, checklist y encargo del loop | rama `feat/revamp-formularios` | ☑ |
| E1 | Kit visual: tarjeta con cabecera y pie, filas de propiedad, segmentado, ficha de pregunta, iconos por tipo, filas de condición; sólo tokens `--pulso-*` | `xlsformEditor/kit/` (nuevo) — commit 744aef6ec | ☑ |
| E2 | Marco del módulo: rail con Constructor, Editor XLSForm, Leer, Lógica, Restricciones (nueva), Cálculos (nueva), Probar, Resumen, Impreso | `navegacion/catalogos/editorFormularios.ts`, rail y contratos de navegación — commits 4ec17c806 (refactor), d861cbe66, 604c1a206 (vacíos contenidos); verificado con proyecto real a 1440×1000 y 1366×768 | ☑ |
| EH | Lectura humana de reglas medida sobre `formularios-tipo.pulso` (6 tipos que resumen los 23 proyectos): 1642 reglas, técnicas 374 (23 %) → meta ≤ 5 %; comillas tipográficas como error con arreglo | `canvas/reglasHumanas.ts`, `parsing/diagnostics.ts`; sonda `pestanas/lecturaFormulariosTipo.test.ts` (opt-in) — 1fbc959df, f30fcabed: técnicas 374 → 22 (1 %) | ☑ |
| H1 | Hallazgo de la sonda: 154 preguntas de selección sin opciones en los tipos 1 y 4 porque el instrumento guarda la lista en una columna `list_name` o `select_from_list_name` de survey (no en `type`); el editor sólo la lee de `type` | `parsing/buildIndex.ts` (`parseBuilderStructure`), `parsing/parseType.ts`; `listas/listasModel.ts` ya la lee — 0d0429fd6: 154 → 0 | ☑ |
| H2 | Hallazgo: `select_one ${var_de_repeat}` (opciones dinámicas desde un grupo repetido, válido en ODK) se ve como lista vacía; mostrar «opciones = respuestas de …». Además 7 preguntas del corpus apuntan a listas que no existen en el original (defecto del instrumento; la revisión ya lo marca) | `parsing/parseType.ts`, `canvas/EditableChoiceList.tsx` — 0c29a0d50 (resumen y papel), 88646adf4 (tarjeta) | ☑ |
| E3 | Constructor en tarjetas: pregunta y respuestas, «Cuándo aparece» con la regla heredada de la sección, «Qué acepta» junto a «Así se imprime», propiedades y relaciones | `canvas/` — corte previo d09cb2e37: `FocusedWorkspace` 4176→1067, pestañas internas en `canvas/constructor/Tab*.tsx`; resumen en 4 contenedores 0c29a0d50, tarjeta con estilo kit 88646adf4, CSS muerto fuera 4469cb76f, panel derecho neutro y lista compartida sin derrame 2890417bc y 294a8f4e5 (medido a 1440×1000: el resumen pasa a una columna en el panel angosto) | ☑ |
| E4 | Lógica: lista por sección con reglas de sección y de pregunta, filtro Todas/Sección/Pregunta, editor en tarjetas; el mapa se conserva | `canvas-graph/ListaLogica.tsx`, `listaLogicaModel.ts` — 33c6e5672 (corte), e9e9af15d (lista por sección junto al mapa, foco enlazable); verificado con el tipo 3: 69 secciones, 367 reglas | ☑ |
| E5 | Pestaña Restricciones: punto de partida, regla, mensaje, vista del teléfono, probar valores, antes de guardar | `pestanas/PestanaRestricciones.tsx` + `canvas/constructor/EditorValidacion.tsx` — b3abb7507, 544024377 (edita con el mismo editor del Constructor), e5d699f70 (probar valores + teléfono; 305/318 restricciones del corpus se pueden probar) | ☑ |
| E6 | Pestaña Cálculos: lista, editor de fórmula con `@`, catálogo de funciones, probar, relaciones | `pestanas/PestanaCalculos.tsx`, `ProbarCalculo.tsx`, `logic/probarCalculo.ts` — 6c61de0a1 (edita con el editor del Constructor y prueba con respuestas; 87/207 cálculos evaluables); falta catálogo de funciones | ◐ |
| E7 | Editor XLSForm: hojas survey/choices/settings con columnas reales, barra de fórmula, fila seleccionada, revisión con arreglos | `sheets/` — 95300bd4d (corte), 619283267 (barra de fórmula con «Se lee», panel de fila y revisión), 9c0442d17 (comillas tipográficas como error con arreglo; 15 celdas en el corpus), 53ec8650d (encabezados con ayuda, sin pastel) | ☑ |
| E8 | Impreso: ajustes en tarjetas, dos páginas A4 | `impreso/` — ya seguía la gramática; medida a 1440×1000 con el tipo 1 sin desbordes; 1756ec8d7 (último fondo tintado); previa del tipo 2 generada (66 páginas, 308 preguntas) sin desbordes | ☑ |
| E9 | Resumen: franja de cifras, organización, quién responde qué, escalas, antes de aplicar | `resumen/` — ya seguía la gramática; 00d57c02f (línea de tiempo con 54 secciones sin desborde); medido a 1440×1000 con el tipo 2 | ☑ |
| E10 | Movimiento: duraciones ≤ 240 ms, una curva, sólo opacidad/posición, `prefers-reduced-motion` | kit + estilos del módulo — d26b7d110: 207 transiciones auditadas; 0 largas, 0 rebotes, 0 sin reduce-motion; 4 acordeones mueven layout a propósito | ☑ |
| EM | Modularización: ningún archivo del módulo gigante (objetivo ≤ ~500 líneas .ts/.tsx, ≤ ~600 .css); cada etapa extrae primero (refactor puro, commit propio) y rediseña después. Hoy: XlsformEditorPage 4426, FocusedWorkspace 4585, LogicCanvas 2339, RuleWizard 1917, xlsform-v2.css 6229 | todo `xlsformEditor/` | ☐ |
| E11 | QA visual en la matriz de viewports, `verificador`, commits por etapa | — | ☐ |
