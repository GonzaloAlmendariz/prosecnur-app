# Checklist: informe de resultados ACNUR en PowerPoint (2026-11-11)

Pedido de Gonzalo: mejorar el informe estándar ACNUR sin cambiar su esencia (una pregunta por lámina, separadores por
bloque, decimales). Es un informe Pulso-ACNUR: la plantilla ACNUR manda sobre la identidad del recetario Pulso. Primero
se corrigen los defectos con los que sale hoy el mazo y después se aplican las reglas automáticas que funcionaron en la
muestra. Sólo Gonzalo da por terminado cada ítem.

Banco de prueba: RMS 2026 con la base real (`Data_Kobo_Limpia.xlsx` + XLSForm etiquetado, 486 hogares, grupos
repetibles `rpt_hhmnames` y `S1` con 1,478 miembros). Referencia del cliente: `5. RMS_PPT.pptx` (RMS 2025, 155
láminas): título negro, barras azul ACNUR, cifra blanca dentro de la barra, eje con porcentajes, dos decimales, pie con
tasa de respuesta, sólo las categorías con casos. Renders en `tmp/informe_acnur/` (no versionado).

Estados: **pendiente**, **resuelto** (test en verde y visto en el render), **bloqueado** (necesita decisión).

## Defectos del mazo de hoy

| # | Defecto | Dónde vive | Causa comprobada | Estado |
|---|---|---|---|---|
| D1 | Ninguna lámina de pregunta llevaba la nota de base (0 de 46 en la muestra; julio sí la tenía) | `lamina_plantilla_cliente.R` (enganche en `reporte_plan_ppt.R`) | El plan ACNUR marca `suppress_footer_placeholder`; la lámina nativa lo lee como `sin_pie` y descarta `overrides$nota_pie`, donde viaja la base. Con la ruta de la plantilla la base va en el gráfico, como en julio | resuelto: test `test-graficos-acnur-plantilla-cliente.R`; en el render del RMS la base sale al pie de cada gráfico ("409 respuestas de la muestra total (84.2%)") |
| D2 | Identidad Pulso en las láminas de pregunta (título coral, azul `#081F5C`, barra lateral) | `lamina_plantilla_cliente.R` | Las láminas de gráfico se componían con piezas nativas sin mirar la plantilla; esas piezas leen el estándar Pulso y no los presets del perfil ACNUR. Ahora, con plantilla de cliente (`acnur_16_9`), van por la ruta de la plantilla salvo `meta$motor_nativo = TRUE` explícito. Es la regla que ya seguían portada, índice y objetivo | resuelto: el test exige que no haya `Titulo lamina` ni `CA5651`; en el render, título negro y barras `#0072BC` |
| D3 | Listas largas partidas en 24 láminas, 22 "Sin datos para mostrar" | `graficos_acnur_paginas.R` + `.graficos_acnur_choice_pages` | Paginaba sobre las ≈ 220 opciones del formulario. Ahora, si la lista pasa el tope, las opciones sin casos salen y se pagina sobre las que tienen; una lista corta conserva sus ceros. También en los servicios repetibles | resuelto: 4 tests; el RMS pasa de 289 a 163 láminas y la nacionalidad sale en una (Venezuela, Cuba, Colombia, Ecuador) |
| D4 | Portada "Informe de resultados23 oct." | `ppt_texto_saltos.R` | `ftext()` escribe el `\n` dentro del run y PowerPoint lo descarta; `run_linebreak()` sólo vale en Word. Ahora va un párrafo por línea | resuelto: test; portada en dos líneas en el render |
| D5 | Ficha técnica con "Miembros registrados" repetida | `.graficos_acnur_technical_rows` | Una fila por grupo repetible; los dos del RMS describen a las mismas personas. Una fila idéntica ya no se repite; con cifras distintas se conservan las dos | resuelto: test; una sola fila en el render |
| D6 | Número de lámina encima del logo UNHCR | lámina nativa (`Folio lamina`) | Era una pieza del compositor nativo; con la ruta de la plantilla (D2) no se dibuja | resuelto con D2: visto en el render |
| D7 | `DIS01a` como lámina sin título | `graficos_filas_estructurales.R` | Es la fila de encabezados de una tabla del formulario (`appearance = label`); ya no se grafica, sin aviso | resuelto: test; fuera del plan del RMS |
| D8 | "Nombre del encuestado(a)" graficado con los nombres de las personas | `graficos_filas_estructurales.R` | `select_one ${HH01_2_aux}`: las opciones son los nombres de un grupo repetible. Por ser "cerrada" se saltaba el filtro de identificadores. Ahora no se grafica (motivo "opciones tomadas de otro bloque del formulario") | resuelto: test; fuera del plan del RMS |

## Reglas automáticas

| # | Regla | Estado |
|---|---|---|
| R1 | Listas largas en una lámina, sólo con las categorías con casos | resuelto con D3 |
| R2 | Orden del recetario: opción múltiple y nominales de mayor a menor, residuales al final, escalas en su orden | resuelto sin cambio: por la ruta de la plantilla ya se aplica (visto en el render: "Otros" al final, escalas en el orden del instrumento). La referencia 2025 ordenaba también las escalas por frecuencia; aquí se mantiene el orden de la escala |
| R3 | Decimales: se mantienen (Gonzalo: ACNUR los pide) | decidido |
| R4 | Ajustes visuales finos contra la referencia 2025 | pendiente: ver abajo |

## Ajustes visuales contra la referencia 2025

| # | Observación | Arreglo | Estado |
|---|---|---|---|
| P1 | Las cifras perdían el cero final: "2%" y "1%" junto a "96.6%" | Opción nueva `decimales_fijos` en las barras agrupadas; el perfil ACNUR la enciende ("2.0%", "0.0%") | resuelto: test; visto en el render |
| P2 | La base salía en letra muy pequeña y chocaba con el eje | El perfil ACNUR le da 11 pt y su propia franja bajo el eje (`canvas_h_caption_in` 0.42) | resuelto: visto en el render. El texto ("409 respuestas de la muestra total (84.2%).") no cambió; la referencia dice "Single choice, Response rate = 99.52% on a total of 413 records" |
| P3 | Faltaba el eje de porcentajes | El perfil ACNUR enciende `marcas_eje` (0, 25, 50, 75 y 100 % con guías); las marcas escalan con los rótulos en vez de 8 pt fijos | resuelto: test; visto en el render |
| P4 | La ficha técnica estiraba su última fila hasta el pie de la lámina | Cada fila declara la altura de sus líneas (`row_heights`) | resuelto: test; ver render final |
| P5 | Al salir "Nombre del encuestado(a)" desaparece el separador "Parte 1" | No es un error de código: en el XLSForm del RMS "Parte 1" sólo contiene la lista de miembros del hogar y esa pregunta. La referencia 2025 pone ahí los gráficos de los miembros; el motor manda los grupos repetibles al final del mazo y sólo separa por el grupo más externo (la referencia también separa S1, S2…) | bloqueado: decisión de Gonzalo sobre dónde van los grupos repetibles y si se separa por subsección |
| P6 | Rótulos largos diminutos | El rótulo se parte a 45 caracteres y no a 38: con tres líneas el gráfico crecía en alto y al encajarlo se reducía entero | resuelto: test del perfil; visto en el render |
| P7 | Títulos de tres líneas montados sobre el gráfico | El título baja de tamaño, medido con la tinta real, hasta caber en dos líneas (piso 16 pt) | resuelto: test; visto en el render. Un título de más de dos líneas a 16 pt (vacunación, 250 caracteres) queda en tres |

## Vistos en el render final, sin tocar

- Cuando el último rótulo ocupa dos líneas, su segunda línea roza la marca "0%" del eje (razón de llegada, lámina 25 del
  RMS).
- El título que baja de tamaño para caber en dos líneas (16 a 20 pt) convive con títulos de 24 pt en el mismo mazo.

## Descartado en la muestra

- Escalas como una sola barra apilada: deja la lámina vacía, no mostró el Top Two Box y tomó los colores de Pulso.
- Numerar los separadores a mano: el motor ya numera.
- "No utilicé ese espacio" aparte de la escala (Gonzalo: innecesario).

## Fallas que ya estaban en HEAD

`test-lamina-escala-ensanche-justo.R:56` y `test-lamina-escala.R:189` fallan igual en HEAD sin estos cambios
(comprobado en un worktree limpio el 2026-11-11). Son de la escala nativa y no las toca este trabajo.
