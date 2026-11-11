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

## Pendientes vistos en el render corregido (sin tocar todavía)

| # | Observación | Cómo se comprobó |
|---|---|---|
| P1 | Las cifras pierden el cero final: "2%" y "1%" junto a "96.6%". La referencia usa siempre dos decimales ("1.22%") | render del RMS, lámina de nacionalidad |
| P2 | La base dice "409 respuestas de la muestra total (84.2%)." en letra muy pequeña; la referencia dice "Single choice, Response rate = 99.52% on a total of 413 records" | render del RMS contra la referencia 2025 |
| P3 | Sin eje de porcentajes; la referencia lo trae (0%, 25%, 50%…) | ídem |
| P4 | La tabla de la ficha técnica estira su última fila hasta el pie de la lámina cuando tiene pocas filas | render del RMS, lámina 2 |
| P5 | Al salir "Nombre del encuestado(a)", la sección "Parte 1. Indicadores Sociodemográficos & Movilidad" se queda sin preguntas y su separador desaparece; la referencia lo conserva antes de "S2" | plan del RMS antes y después (163 → 160 láminas: la pregunta, el separador y la segunda página del índice) |
| P6 | Rótulos largos del eje en letra muy pequeña (razón de llegada, tipo de documento) | render del RMS |
| P7 | Un título de tres líneas se monta sobre el gráfico y su última línea queda cortada | render del RMS, láminas 119, 130, 142 y 153 (preguntas de empleo, pagos por celular, actividades extraescolares, vacunación) |

## Descartado en la muestra

- Escalas como una sola barra apilada: deja la lámina vacía, no mostró el Top Two Box y tomó los colores de Pulso.
- Numerar los separadores a mano: el motor ya numera.
- "No utilicé ese espacio" aparte de la escala (Gonzalo: innecesario).

## Fallas que ya estaban en HEAD

`test-lamina-escala-ensanche-justo.R:56` y `test-lamina-escala.R:189` fallan igual en HEAD sin estos cambios
(comprobado en un worktree limpio el 2026-11-11). Son de la escala nativa y no las toca este trabajo.
