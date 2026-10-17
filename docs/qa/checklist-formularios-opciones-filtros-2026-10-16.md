# Checklist: Formularios, opciones, filtros e íconos (2026-10-16)

Tipo: Checklist vivo
Estado: En curso
Fecha: 2026-10-16
Autoridad: Pedido de Gonzalo; sólo él da por terminado un ítem

Pedido (textual): «Sigue mejorando la UI, veo que usas íconos elegantes para los tipos de preguntas o campos pero no lo
usas, en verdad creo que necesita hacer una mejora completa y absoluta aún, el filtro de opciones por ejemplo tiene una
ventana pero hasta que el editor no cree nada no se puede hacer nada con ella, o el catálogo de opciones no tiene su
subtab propio como debería sino un sideover que aún le falta mucho para verse profesional, haz una mejora absoluta y
profunda sin abrir demasiados agentes que puedan consumir muchos tokens, configura un loop indefinido».

Aclaraciones suyas: el revamp de Formularios ya está en main; los íconos de tipo: «úsalo en todas partes y de forma
inteligente con maqueta elegante como hiciste en gráficos»; tick cada 4 minutos.

Corpus de verificación: `~/Documents/Pulso/90_Pruebas/corpus_instrumentos/pulso/formularios-tipo.pulso` (seis
formularios tipo), siempre sobre una copia.

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| F1 | El catálogo de opciones tiene su pestaña propia, no un panel lateral | `xlsformEditor/opciones/` (PestanaOpciones, EditorLista, OpcionFila, opcionesModel), `editorFormularios.ts`, `shell/pestanaEditor.ts` | hecho, por verificar (27a52ac31, 074c2db5c): pestaña con el marco de Restricciones; listas nombradas por su contenido y agrupadas en repetidas, en uso y sin uso; editor a todo el ancho (cada campo se guarda al salir, código de la lista en la cabecera); dónde se usa; unificar escalas con nombre editable; `?panel=catalogos` y `?panel=listas-opciones` redirigen. Hallazgo corregido: el conteo viejo sólo leía la columna `type` y marcaba «sin uso», con «Borrar lista», listas usadas por preguntas con la lista en columna aparte (25 en el tipo 1). QA 1440 y 1024: ok=true. Pendiente menor: «entre formularios del proyecto». Archivos sin uso, a borrar sólo con tu confirmación: CatalogsContextLens.tsx, CatalogLibrary.tsx, CatalogWorkspace.tsx, SortableChoiceRow.tsx, ListasOpcionesDialog.tsx |
| F2 | Filtros de opciones: se pueden crear y editar desde su pestaña, sin depender de que el instrumento ya los traiga | `xlsformEditor/choiceFilters/` (cascada.ts, EditorFiltro.tsx, ChoiceFiltersView.tsx) | hecho, por verificar (1e3eec683): «Nuevo filtro» en la cabecera y «Crear el primer filtro» en el vacío; editor en tres pasos (pregunta que filtra, pregunta anterior de la que depende, qué respuesta habilita cada opción, por etiqueta); escribe la forma estándar (columna `filtro_<madre>` en choices y `choice_filter` en survey); un filtro en cascada existente se edita o se quita. Tests de la transformación y del editor. Límites: una opción la habilita una sola respuesta (la cascada estándar); los selectores de pregunta son listas nativas, sin ícono de tipo (se mejora en F3) |
| F3 | Íconos de tipo en todas las vistas, con maqueta del tipo como en Gráficos | `xlsformEditor/kit/` (MaquetaTipo, SelectorPregunta, TypeIcon) y vistas | hecho, por verificar (b872876f8 y el commit de la Vista del cuestionario): MaquetaTipo dibuja cada tipo (Resumen, ficha de la pregunta); SelectorPregunta buscable con ícono (editor de filtros); ícono en Filtros y en cada pregunta de la Vista del cuestionario. Ya lo traían Constructor, Editor XLSForm, Lógica, Restricciones, Cálculos y Probar. Queda por evaluar en F4: la maqueta en el menú de alta de preguntas del Constructor |
| F4 | Mejora completa: pasada visual por las diez pestañas a 1440 y 1024 sobre el corpus, sin desbordes ni vacíos sin acción | todas las pestañas | pendiente |

Línea base (2026-10-16, 1440×1000, tipo 1): Filtros es un vacío con texto y sin acción; el catálogo es un sideover
(`?panel=catalogos`) con filas apretadas que se montan y códigos técnicos (`lst_p0003`) como nombre; «Listas de
opciones» (`?panel=listas-opciones`) es otro diálogo con las escalas repetidas.
