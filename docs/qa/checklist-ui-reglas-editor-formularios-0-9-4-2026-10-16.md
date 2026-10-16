# Checklist: UI de reglas del editor de Formularios, para el corte 0.9.4

Tipo: Checklist vivo
Estado: En curso
Fecha: 2026-10-16
Autoridad: Pedido de Gonzalo («aún hay mucho que mejorar en términos de UI en este interno, esto ya es para el 0.9.4»), con cuatro capturas del Constructor (pestaña Reglas: Visibilidad y Validación) y de la pestaña Restricciones. Sólo él da por terminado un ítem; los ítems salen de lo que se ve en las capturas y están **por confirmar** con él antes de tocar código.

Dónde vive: `frontend/src/features/xlsformEditor/inspector/logic/ConstraintBuilder.tsx`,
`canvas/constructor/ValidacionPaneles.tsx`, `canvas/constructor/MensajeValidacion.tsx`,
`canvas/reglasHumanas.ts`, `pestanas/PestanaRestricciones.tsx` (y `PestanaCalculos.tsx`, que comparte el editor).

| # | Lo que se ve | Dónde | Estado |
|---|---|---|---|
| R1 | La fila de condición (Pregunta · Criterio · Valor) va dentro de un contenedor con bordes de píldora gigante: la forma ovalada no corresponde a una fila de formulario y recorta visualmente los campos. | Visibilidad y Regla de la respuesta (`ConstraintBuilder.tsx`) | por confirmar |
| R2 | El conmutador «Valor / Pregunta» va encima del campo de valor y desalinea la fila: Pregunta y Criterio tienen rótulo arriba, Valor tiene rótulo + conmutador + campo. | `ConstraintBuilder.tsx` | por confirmar |
| R3 | Validación repite la misma falta tres veces: aviso amarillo «Falta mensaje para campo», tarjeta «Mensaje Kobo · Completa una indicación clara» y chips «Falta mensaje / Lenguaje de campo / Explica qué hacer». | `ValidacionPaneles.tsx`, `MensajeValidacion.tsx` | por confirmar |
| R4 | Dos caminos para la misma regla en la misma vista: los atajos «Formato del texto (regex)» y el armador «Regla de la respuesta» debajo. No queda claro cuál manda ni que el atajo llena el armador. | `ValidacionPaneles.tsx` | por confirmar |
| R5 | Rótulos técnicos o de relleno: «(REGEX)», «Reglas en lenguaje claro», «La regla técnica y el mensaje para el encuestado se completan juntos», «mismo editor que en el Constructor», «Editable visualmente · La respuesta está vacía». | `PestanaRestricciones.tsx`, `ValidacionPaneles.tsx` | por confirmar |
| R6 | El sujeto de la regla «Tu respuesta · Texto corto» parece un campo deshabilitado; con criterio «es» en un texto libre la regla resultante es poco útil y no se sugiere el criterio natural (contiene, longitud, patrón). | `ConstraintBuilder.tsx` | por confirmar |
| R7 | El tooltip de un atajo («Ingresa entre 2 y 10 caracteres.») se monta sobre los chips de la fila siguiente. | atajos de formato | por confirmar |
| R8 | En la pestaña Restricciones a todo el ancho, la fila de la regla se estira (campo de 750 px para «Tu respuesta», criterio de 480 px): falta un ancho máximo legible. | `PestanaRestricciones.tsx` | por confirmar |

Lo aprendido para la próxima sesión: el editor de reglas es el mismo componente en el Constructor y en Restricciones/Cálculos; un cambio en `ConstraintBuilder.tsx` se ve en las tres vistas, así que la verificación visual debe recorrer las tres (deep-link `?seccion=formularios&pestana=restricciones` y el Constructor con una pregunta de texto con `relevant`).
