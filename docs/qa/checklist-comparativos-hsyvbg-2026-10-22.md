# Checklist — comparativos HSyVbG 2024-2026 (2026-10-22)

Indicaciones de Gonzalo sobre los comparativos simple y de cruces generados el 2026-10-22
(`Procesamiento/Tercera semana/Entregables 2026-10-22/`). Referencia de contenido: matriz de
correspondencias de Nadia. Los cambios van a la matriz de la copia de trabajo por la API
(`scratchpad/loop/trabajo.pulso`); la hoja «Notas de comparabilidad» es post hoc.

| # | Indicación (textual) | Dónde vive | Estado |
|---|---|---|---|
| 1 | «La categoría no debería ser "1–2 años" sino "De 1 a 2 años", "0 años" debería ser Menos de 1 año» | Escala de la fila «Años de estudio en la PUCP» (matriz) | hecho: Menos de 1 año / De 1 a 2 años / De 3 a 4 años / 5 años o más (verificado en tabla) |
| 2 | «No veo las variables del indicador que se calculan para vbg y hostigamiento» | Filas nuevas con `indice_vbg` / `indice_hs` (las tres bases los traen) | hecho bajo supuesto (a confirmar con Gonzalo): «Experimentó al menos una situación de … en el año», 30,4/30,2/28,4 % VBG y 23,0/20,3/21,1 % HS |
| 3 | «Las opciones se cortan» (ej. «…desestimar tus opi», «…sin que lo de», «…dormido(») | Etiquetas de la escala en la matriz (venían cortadas a 120 caracteres, límite SPSS de 2024) | hecho: 8 etiquetas completadas desde el formulario 2026 |
| 4 | «Las etiquetas no deberían tener em dashes (…) deberían ser la misma pregunta con la opción al final» | `etiqueta_estandar` / `enunciado` (matriz); claves de notas (`renombres_1022.json`) | hecho: 173 filas con pregunta + opción; sin rayas largas; si la pregunta se repite entre módulos, la etiqueta interna lleva «(módulo de …)» y el título impreso no |
| 5 | «Mantener las dummy como sí y no como es el estándar»; hoy unas dicen la opción y «No mencionó» | Escala de las filas dummy (matriz) | hecho: 129 dummies en Sí / No |
| 6 | Redacción más natural de la nota del indicador «recurrió a alguna instancia de la PUCP» | `notas_pregunta.json` | hecho, a validar por Gonzalo |
