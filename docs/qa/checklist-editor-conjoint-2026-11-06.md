# Checklist: el editor de formularios programa y prueba un experimento conjoint

Abierto el 6 de noviembre de 2026. Lo trabaja un loop indefinido (reloj de 300 s). Sólo Gonzalo da el checklist por terminado.

Pedido textual: «Tratemos de integrar todo en un loop elegante, visiblemente didáctico y que se integre bien con las vistas».

Origen: un diagnóstico del 6 de noviembre de 2026 cargó un XLSForm conjoint real (8 tareas, 2 perfiles, 5 atributos con condicionales, 246 `calculate`). Importar, editar y exportar funcionaron sin pérdida. «Probar formulario» no mostraba los niveles sorteados y el backend marcaba 80 fórmulas como no interpretables. El material del cliente NO entra al repo: los tests usan un conjoint sintético.

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| E1 | Probar evalúa los `calculate`: `once(random())` se fija por prueba y «Reiniciar» vuelve a sortear; `if`, `int`, aritmética y comparaciones; `${x}` en notas y preguntas muestra el valor calculado | `frontend/src/features/xlsformEditor/shell/FormSimulator.tsx` (lector `respuestaDe`, ~264), archivo nuevo `shell/simulador/calculosPrueba.ts`, reusa `logic/probarCalculo.ts` (`evaluarAritmetica`) y `logic/evaluate.ts` | Hecho: `shell/simulador/calculosPrueba.ts` (semilla por prueba, `random()` sembrado por variable, dos pasadas) y aritmética en `evaluateCall`. Verificado en vivo con el XLSForm real: el par 1 muestra los niveles sorteados y «Reiniciar» sortea de nuevo |
| E2 | Una nota con tabla markdown (`\| a \| b \|`) se pinta como tabla en Probar, Vista del cuestionario y la tarjeta del Constructor | `helpers/markdown.ts`, `helpers/markdownPregunta.ts` | Siguiente |
| E3 | Un grupo `table-list` se ve como grilla en Probar (filas = preguntas, columnas = opciones) y hereda el texto de la nota que lo introduce | `shell/FormSimulator.tsx` (componente nuevo en archivo propio) | Pendiente |
| E4 | `appearance=likert` se ve como escala horizontal en Probar | `canvas/previewInputs.tsx` | Pendiente |
| E5 | El parser AST del backend acepta aritmética (`+ - * div mod`) e `int()`; desaparecen los 80 avisos «Fórmula no se pudo interpretar» | `api/R/validacion_ast_parser.R` (`odk_parse_to_ast`); aviso en `api/R/router_xlsform_editor.R` ~645-680 | Pendiente |
| E6 | El aviso de sección anidada no se dispara por un grupo `table-list` o `field-list` anidado a propósito, o lo dice como información y no como problema | `api/R/router_xlsform_editor.R` (diagnóstico de anidamiento) | Pendiente |
| E7 | Bloque «Experimento conjoint»: un panel direccionable que arma atributos, niveles, pesos, condicionales y número de tareas, genera los `calculate`, la tabla de cada par y la pregunta de elección, y explica en pantalla qué hace cada parte | Panel nuevo (`usePanelDireccionable`), modelo en archivo propio en `features/xlsformEditor/`, registrado en `PANELES_POR_MODULO` | Pendiente |
| E8 | Vista del cuestionario e Impreso muestran un par de ejemplo con niveles sorteados, rotulado como ilustrativo | `cuestionario/`, `impreso/` | Pendiente |
| E9 | Prueba de punta a punta con el XLSForm real: importar, ver los niveles en Probar, exportar sin diferencias y que pyxform lo convierta | Fuera del repo (scratchpad del loop) | Pendiente |
