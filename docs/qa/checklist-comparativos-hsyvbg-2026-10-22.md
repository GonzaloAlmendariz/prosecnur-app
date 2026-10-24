# Checklist — comparativos HSyVbG 2024-2026 (2026-10-22)

Tipo: Checklist de pedido con varias indicaciones
Estado: En curso
Fecha: 2026-10-22
Autoridad: Indicaciones de Gonzalo (citadas abajo); sólo él da por terminado un ítem

Indicaciones de Gonzalo sobre los comparativos simple y de cruces generados el 2026-10-22
(`Procesamiento/Tercera semana/Entregables 2026-10-22/`). Referencia de contenido: matriz de
correspondencias de Nadia. Los cambios van a la matriz de la copia de trabajo por la API
(`scratchpad/loop/trabajo.pulso`); la hoja «Notas de comparabilidad» es post hoc.

| # | Indicación (textual) | Dónde vive | Estado |
|---|---|---|---|
| 1 | «La categoría no debería ser "1–2 años" sino "De 1 a 2 años", "0 años" debería ser Menos de 1 año» | Escala de la fila «Años de estudio en la PUCP» (matriz) | hecho: Menos de 1 año / De 1 a 2 años / De 3 a 4 años / 5 años o más (verificado en tabla) |
| 2 | «No veo las variables del indicador que se calculan para vbg y hostigamiento» | Filas nuevas con `indice_vbg` / `indice_hs` (las tres bases los traen) | hecho bajo supuesto (a confirmar con Gonzalo): «Experimentó al menos una situación de … en el año», 30,4/30,2/28,4 % VBG y 23,0/20,3/21,1 % HS |
| 3 | «Las opciones se cortan» (ej. «…desestimar tus opi», «…sin que lo de», «…dormido(») | Etiquetas de la escala en la matriz (venían cortadas a 120 caracteres, límite SPSS de 2024) | hecho: 8 etiquetas completadas desde el formulario 2026 |
| 4 | «Las etiquetas no deberían tener em dashes (…) deberían ser la misma pregunta con la opción al final» | `etiqueta_estandar` / `enunciado` (matriz); claves de notas (`renombres_1022.json`) | hecho: dummies e ítems con pregunta + opción y preguntas simples con su pregunta real 2026; sin rayas largas ni sufijos de módulo (las notas de VBG/HS se amarran a la variable o al id RI-01-VB/HS) |
| 5 | «Mantener las dummy como sí y no como es el estándar»; hoy unas dicen la opción y «No mencionó» | Escala de las filas dummy (matriz) | hecho: 129 dummies en Sí / No |
| 6 | Redacción más natural de la nota del indicador «recurrió a alguna instancia de la PUCP» | `notas_pregunta.json` | hecho, a validar por Gonzalo |
| 7 | «La ficha técnica es un pdf aparte que no se agrega a ninguna tabla, es un bug» | `.analitica_add_ficha_tecnica_from_spec` (reporte_ficha_tecnica.R) | hecho en la app: commit 5f8c3909f (sólo con `adjuntar_a_xlsx`); gate 2165 pass |
| 8 | Toda la lista de entregables (cuestionario, codebook, bases, tablas 2026, comparativos, script) | `Procesamiento/Tercera semana/Entregables 2026-10-22/` (scratchpad/armar_entrega.py) | en curso: regeneración final con la matriz corregida |
| 9 | Archivos del cliente (script de selección .qmd, indicadores, cuotas, seleccionados) | entregable 10 | hecho: el .R reproduce los 2500 seleccionados caso por caso y coinciden con la BD Muestra |

Hallazgos de esta tanda:
- Las etiquetas de variable de cada base salen de la matriz (ADR 0062); si una variable sale de la matriz, su rótulo viejo se queda (`.equiv_aplicar_a_analitica` sólo pisa lo que vino de la declaración anterior). 49 dummies crudas de 2026 tenían el rótulo viejo con raya larga; se corrigieron en la configuración. Pendiente en la app: limpiar los rótulos que la matriz dejó de declarar.
- H11 resuelto: la etiqueta de las preguntas simples es la pregunta real 2026 («Durante el 2026, ¿…?»); el título del comparativo usa el enunciado genérico («Durante el año de la encuesta, ¿…?»).

## Decisiones de Gonzalo (2026-10-22, tarde)

| # | Pregunta | Respuesta | Dónde vive | Estado |
|---|---|---|---|---|
| D1 | Filtros del cuestionario con «indice_vbg» / «indice_hs» | Texto descriptivo («Experimentó al menos una situación de … en el año») | Etiqueta del campo calculado en la copia del formulario aplicado (`loop/f1_payload.json`) | pendiente |
| D2 | Opción «0 Selecciona una respuesta» en P7 y P8 | Quitarla del PDF | Motor del cuestionario (marcador de Kobo, regla general) | pendiente |
| D3 | «Especifica…» de P23, P29 y P58 con letra | En línea bajo su opción, como P8_otro | Motor del cuestionario (detección de «Especifica») | pendiente |
| D4 | 19 variables *_recod | Incorporarlas con etiquetas (SPSS y codebook) | Codificación / instrumento de análisis 2026 | pendiente |
| D5 | P1, indice_vbg, indice_hs como texto | A numéricas | Tipo en el instrumento de análisis 2026 | pendiente |
| D6 | Respuestas abiertas «_otro» | Tal cual | — | cerrado |
| D7 | Ficha técnica | Sí, como PDF aparte | `/api/analitica/ficha-tecnica/export` (Word) → PDF | pendiente |
| D8 | Variables _indic duplicadas en tablas | Dejar ambas | — | cerrado |
| D8b | Nombre de las _indic | «Pasa a estandarizarse… en 2024 se llamaba cruce_1»: P*_indic → cruce_1, cruce_2, cruce_3, cruce_4, cruce_5, cruce_8, cruce_10, con la agrupación de las tablas de cruces 2026 | Base 2026 en la app | pendiente |
