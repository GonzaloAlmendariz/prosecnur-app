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
| F1 | El catálogo de opciones tiene su pestaña propia, no un panel lateral | `xlsformEditor/opciones/` (PestanaOpciones, opcionesModel), `editorFormularios.ts`, `shell/pestanaEditor.ts` | en curso: primer corte 27a52ac31 (pestaña con el marco de Restricciones; listas nombradas por contenido y agrupadas en repetidas, en uso, sin uso; dónde se usa; unificar escalas; `?panel=catalogos` y `?panel=listas-opciones` redirigen). Falta F1b: el editor central es el componente viejo del panel (cabecera duplicada, nota sobrante, campos angostos); falta «entre formularios del proyecto». Los archivos CatalogsContextLens.tsx, CatalogLibrary.tsx y ListasOpcionesDialog.tsx quedaron sin uso: borrarlos requiere tu confirmación |
| F2 | Filtros de opciones: se pueden crear y editar desde su pestaña, sin depender de que el instrumento ya los traiga | `xlsformEditor/choiceFilters/` | pendiente |
| F3 | Íconos de tipo en todas las vistas, con maqueta del tipo como en Gráficos | `xlsformEditor/kit/TypeIcon.tsx` y vistas | pendiente |
| F4 | Mejora completa: pasada visual por las diez pestañas a 1440 y 1024 sobre el corpus, sin desbordes ni vacíos sin acción | todas las pestañas | pendiente |

Línea base (2026-10-16, 1440×1000, tipo 1): Filtros es un vacío con texto y sin acción; el catálogo es un sideover
(`?panel=catalogos`) con filas apretadas que se montan y códigos técnicos (`lst_p0003`) como nombre; «Listas de
opciones» (`?panel=listas-opciones`) es otro diálogo con las escalas repetidas.
