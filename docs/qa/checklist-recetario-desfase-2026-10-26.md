# Checklist: el recetario al día con el motor (2026-10-26)

Tipo: Checklist
Estado: En curso
Fecha: 2026-10-26
Autoridad: Gonzalo: «con todos estos cambios y nuevas indicaciones el recetario ya debe estar completamente desfasado en
muchas cosas» y «el estandar_pulso.json debe quedar en el ADR que se actualiza con las decisiones del motor».

Desde el 2026-10-15 (`d589311b3`, último cambio de `api/inst/estandar/estandar_pulso.json`) el motor cambió unas 60
reglas que el recetario no refleja. El recetario son tres piezas ([ADR 0092](../adrs/0092-el-recetario-es-el-estandar-del-motor.md)):
los diseños `docs/qa/motor-ppt-2026-10-06/4-recetario/recetario-moderna.pptx` y `propuesta-word.docx`, el estándar
`estandar_pulso.json` y el catálogo que genera `api/R/catalogo_recetario_plan.R` (`make catalogo-recetario-build`).

Regla de cierre de cada ítem: la decisión queda registrada en el ADR 0092 (registro de decisiones del motor) con su
token del JSON; el código lee el token (sin números sueltos); el catálogo tiene una lámina que la muestra; se verifica
en el render (PPT y Word). Lo da por terminado sólo Gonzalo.

Estados: ⬜ pendiente · 🔵 en curso · ✅ hecho · ⛔ bloqueado (decisión de Gonzalo).
Columnas: **ADR** (decisión escrita) · **JSON** (token) · **Cat.** (lámina del catálogo) · **Ref.** (pptx/docx de referencia).

## Decisiones

| # | Pregunta | Estado |
|---|---|---|
| D1 | Los diseños de referencia (`recetario-moderna.pptx`, `propuesta-word.docx`) quedan como histórico del diseño original; **el catálogo generado por el motor es el recetario** (Gonzalo, 2026-10-26: «Ok, el recetario ahora va a ser el catálogo»). La columna **Ref.** deja de exigirse. | ✅ decidido |

## 1. Escalas y Top Two Box

| # | Regla | Commit | Medio | Dónde vive hoy | ADR | JSON | Cat. | Ref. |
|---|---|---|---|---|---|---|---|---|
| E1 | Columna Top Two Box del Word en pulgadas, centrada con 0,12 in de aire, 0,16 entre Top y Bottom, termina en el margen derecho | 824e06338 | Word | `.word_columnas_box()` suelto | ✅ | ⬜ | ⬜ | ⛔ |
| E2 | Una sola «Barra extra» (top2box, bottom2box, conteos); el Word la hereda y `word_barra_extra` la cambia | 5706e40c8 | Ambos | `graficos_barra_extra.R` | ✅ | — | ⬜ conteos | ⛔ |
| E3 | Piso de grosor `grosor_piso_cm`: la barra no baja de ese grosor; la lámina se parte. Rige por defecto (1,12 cm) desde el 2026-10-26; 0 lo apaga | 51aafe5c8 | PPT | `ppt.grosor.piso_escala_cm` → `.std_piso_escala_in()` | ✅ | ✅ | ⬜ | ⛔ |
| E4 | Evitar «(cont.)» comprimiendo el aire, no la barra (0,08 / 0,075 / apretado 0,03, TTB 0,25, franja +0,30): hasta seis barras | 51aafe5c8, 7a301695b | PPT | `lamina_escala_aire.R` suelto | ✅ | ⬜ | ⬜ | ⛔ |
| E5 | Cifra chica sube 0,28 in, ≥ 0,075 de la barra de arriba, caja de 0,22 | 51aafe5c8 | PPT | `lamina_escala*.R` suelto; contradice `aire_cifra_chica = 0.36` | ✅ | ⬜ | ⬜ | ⛔ |
| E6 | Cifras chicas vecinas repartidas sin solape, centradas, 0,12 in de aire; ninguna se omite | 0a3133f60 | PPT | `lamina_callouts_sin_solape.R`; contradice `reglas.cifras_chicas` (0,46) | ✅ | ⬜ | ⬜ | ⛔ |
| E7 | Filete entre temas apagado por defecto | 51aafe5c8 | PPT | argumento | ✅ | ⬜ | ⬜ | ⛔ |
| E8 | `ancho_enunciado_extra_in` (tope 1,5) ensancha el enunciado sin mover el Top Two Box | 51aafe5c8 | PPT | `.std_enunciado_extra_in()` suelto | ✅ | ⬜ | ⬜ | ⛔ |
| E9 | Tabla de calor Likert con columna Top Two Box en verde | 8c3176b01 | PPT | token `verde_top_two_box` | ✅ | — | ⬜ | ⛔ |
| E10 | Escala y Sí/No comparten lámina | 6ec72b494 | PPT | `.lam_apretado` | ⬜ | — | ⬜ | ⛔ |

## 2. Columna de rótulos y alineación

| # | Regla | Commit | Medio | Dónde vive hoy | ADR | JSON | Cat. | Ref. |
|---|---|---|---|---|---|---|---|---|
| A1 | Rótulo corto (≤ 1,6 in): columna común por capítulo (apiladas, multiapiladas, agrupadas); rótulo largo conserva la suya | 6328befb2, baa8098d8 | Word | `.WORD_ROTULO_CORTO_IN` suelto | ✅ | ⬜ | ⬜ | ⛔ |
| A2 | Rótulo mediano se parte en hasta dos líneas para entrar en la columna común | 7aa7ace25 | Word | `max_lineas = 2L` suelto | ✅ | ⬜ | ⬜ | ⛔ |
| A3 | Sin rótulo de fila: no reserva columna, todo el ancho; la escala nace en 0 como el Sí/No | ce8ffb540, 397232f91 | Word | lógica | ✅ | — | ⬜ | ⛔ |
| A4 | Barras de una serie: columna de rótulos ≤ 35 %, hasta 3 líneas, piso 11 pt; eje libre ×1,15; ≤ 3 categorías al 75 % centradas; 0–100 por defecto | a865d7b60 | PPT | `.LAM_BARRAS_ANCHO` suelto | ✅ | ⬜ | ⬜ | ⛔ |
| A5 | Pocas categorías: barra ≤ 0,55 in, fila ≤ 0,88, bloque centrado | 98e6690db | PPT | `.LAM_USO_AREA`; contradice `grosor.categorias` | ✅ | ⬜ | ⬜ | ⛔ |
| A6 | Rótulos de agrupadas medidos; la columna se ensancha hasta 0,62 | c0df7056d | PPT respaldo | suelto | ⬜ | ⬜ | ⬜ | ⛔ |
| A7 | Rótulos de columnas con el ancho real, piso `cifra_minimo` | 40cf6e407 | PPT | suelto | ⬜ | ⬜ | ⬜ | ⛔ |

## 3. Sí/No y dicotomía

| # | Regla | Commit | Medio | Dónde vive hoy | ADR | JSON | Cat. | Ref. |
|---|---|---|---|---|---|---|---|---|
| S1 | Dicotomía sólo para Sí/No; el sexo y otras nominales de dos van en barras | 51aafe5c8 | Ambos | `lamina_dicotomia_estandar.R` | ✅ | — | ⬜ | ⛔ (p47–49, p56, p57, p213) |
| S2 | Estilo `barra_estandar` opcional | 51aafe5c8 | Ambos | `.ESTILOS_DICOTOMIA` | ⬜ | ⬜ | ⬜ | ⛔ |
| S3 | Sí/No de una pregunta al 85 % del ancho, centrado | 6ec72b494 | PPT | `.LAM_DICOTOMIA_UNICA_FRAC` suelto | ✅ | ⬜ | ⬜ | ⛔ |
| S4 | Dicotomía partida con margen simétrico (sangría 0,1) | 7e10765b8 | PPT | `.LAM_SANGRIA_TXT` suelto | ⬜ | ⬜ | ⬜ | ⛔ |
| S5 | «N respuestas» y «x de y» sólo con `mostrar_respuestas` (apagado) | 51aafe5c8, 6ec72b494 | PPT | argumento; contradice `reglas.base_chica` | ✅ | ⬜ | ⬜ | ⛔ (p10, p76, p196) |

## 4. Donas y tortas

| # | Regla | Commit | Medio | Dónde vive hoy | ADR | JSON | Cat. | Ref. |
|---|---|---|---|---|---|---|---|---|
| T1 | Guía radial 0,15 in + arco concéntrico, grosor de la guía de apiladas, sin encimar | 0860e9471, 9947637ce | PPT | `.LAM_GUIA_*` suelto | ⬜ | ⬜ | ⬜ | ⛔ |
| T2 | Dona de lámina completa nativa (4,0 in, 34 pt, leyenda 28/22/16) | 1ea1f788b | PPT | suelto | ⬜ | ⬜ | ⬜ | ⛔ |
| T3 | Donas de una grilla con el mismo diámetro, leyenda compacta | 1ea1f788b | PPT | suelto | ⬜ | ⬜ | — | ⛔ |
| T4 | Cifra que redondea a 0 con casos: «<1%» | 67822ba19, 0a3133f60 | PPT | lógica | ⬜ | — | ⬜ | ⛔ |

## 5. No sustantivos y residuales

| # | Regla | Commit | Medio | Dónde vive hoy | ADR | JSON | Cat. | Ref. |
|---|---|---|---|---|---|---|---|---|
| N1 | No sustantivo (9, 77, NS/NR) al final en gris azulado #8A93A8, también en cruces y multilista, denominador intacto | 8bc71f483, bd8fd87b6, 623146ac2 | Ambos | reusa `texto_tenue`; falta `colores.no_sustantivo`; `likert[5]` desfasado | ✅ | ⬜ | ⬜ | ⛔ (p202, p203) |
| N2 | Residuales con el color de su serie, al final; `residuales_gris` apagado | 0e16a0a94 | Ambos | argumento; contradice `orden_escala` | ✅ | ⬜ | ⬜ | ⛔ (p204) |

## 6. Filtro y dependencia

| # | Regla | Commit | Medio | Dónde vive hoy | ADR | JSON | Cat. | Ref. |
|---|---|---|---|---|---|---|---|---|
| F1 | En el Word, filtro y subpregunta van como dos figuras con su base; la subpregunta, sólo su enunciado | 3d7526549, e60cc25d1 | Word | `.fsub_elementos` | ✅ | — | ⬜ | coincide |
| F2 | «N respuestas» de la nota de filtro depende de `mostrar_respuestas` | 6ec72b494 | PPT | argumento | ⬜ | — | ⬜ | ⛔ (p192) |

## 7. Word: numeración, «Cómo leer» y figuras

| # | Regla | Commit | Medio | Dónde vive hoy | ADR | JSON | Cat. | Ref. |
|---|---|---|---|---|---|---|---|---|
| W1 | Ejemplos de «Cómo leer» sin número ni SEQ; el primer gráfico del estudio es el 1 | cee79a0d3 | Word | `reporte_word_figura.R` | ✅ | ⬜ `word.rotulo` | ⬜ | ⛔ (figs. 1–4, 6) |
| W2 | «Cómo leer» automático: cada sección si su recurso aparece en ≥ 2 láminas | 51aafe5c8 | Word | `.WORD_COMO_LEER_MIN_LAMINAS` suelto; contradice `word.documento` | ✅ | ⬜ | ⬜ | ⛔ |
| W3 | Grosor de barra 0,70 cm en escala, barras y apilada | 51aafe5c8 | Word | `.WORD_GROSOR_BARRA_CM` suelto; desplaza `grosor_fraccion` | ✅ | ⬜ | ⬜ | ⛔ |
| W4 | Figuras con la partición del PPT; criterio B; `word_multiapiladas` | f134ba5ad, 51aafe5c8 | Word | `.WORD_MULTI_MODOS` | ⬜ | — | ⬜ | ⛔ |
| W5 | Título de la pregunta como título de figura; categorías con casos nunca desaparecen | 51aafe5c8 | Word | lógica | ⬜ | — | ⬜ | — |
| W6 | Tabla nativa sobre el radar (`word_tabla`, apagada) | b7deee802 | Word | argumento | ⬜ | — | ⬜ | ⛔ |
| W7 | Leyenda de figura 8 pt | e68a546b5 | Word | `.WORD_LEYENDA_PT` duplica `grafico_leyenda` | ⬜ | ⬜ | — | — |

## 8. Texto abierto

| # | Regla | Commit | Medio | Dónde vive hoy | ADR | JSON | Cat. | Ref. |
|---|---|---|---|---|---|---|---|---|
| X1 | Nube: quitar no respuestas, flexiones, frases de ≥ 3 personas, contar personas, diccionario por pregunta (apagado) | 3516aab43, 5acb31d46, 1974e1063 | PPT | `.TXT_*` | ✅ | ⬜ | ⬜ (p103 marcada falta) | ⛔ |
| X2 | Temas: % sobre comentarios con contenido, módulo con subtemas, «suman más de 100 %», jerarquía visual | d596bb4f1, 37e9c6ed3, eaa599f57 | Ambos | `.PLAN_TT_*` | ✅ | ⬜ | ⬜ (p104 marcada falta) | ⛔ |
| X3 | Citas: comillas coral 54 pt, texto 16–14, base de comentarios con contenido, sin atribución, borrador sin aprobadas | c782ba495, 896cebfa2 | PPT | `.LAM_CITAS` suelto | ✅ | ⬜ | ✅ borrador | ⛔ |

## 9. Base y pie

| # | Regla | Commit | Medio | Dónde vive hoy | ADR | JSON | Cat. | Ref. |
|---|---|---|---|---|---|---|---|---|
| B1 | Una sola forma del pie: «Base: N» sin sufijo declarado | 67822ba19 | Ambos | `graficos_base_pie_forma.R` | ✅ | ⬜ | — | ⛔ (p76, p192) |
| B2 | Base de un cruce = válidos en variable y cruce | f26d10c0a | PPT | lógica | ✅ | — | — | — |
| B3 | Parte de lámina partida nombra sólo las bases que dibuja | 51aafe5c8 | PPT | `lamina_pie_parte.R` | ⬜ | — | ⬜ | ⛔ |
| B4 | Grilla: una base si coinciden; si difieren, cada panel la suya; cifras sin concatenar | 9947637ce, 8c3176b01 | PPT | lógica | ⬜ | — | ✅ | ⛔ |
| B5 | Nota de significancia 9 pt en su caja sobre «Base:» | 0ee5f6695, 7e10765b8 | PPT | `.lam_nota_sig_pt()` suelto | ⬜ | ⬜ | ✅ | ⛔ |
| B6 | Nota de redondeo condicional (nunca / si no cierra / siempre) | 9a942fc35, 76fea72b6 | Ambos | `.CALCULOS_NOTA_MODOS` | ⬜ | ⬜ | ⬜ | ⛔ |

## 10. Grillas y mixtas

| # | Regla | Commit | Medio | Dónde vive hoy | ADR | JSON | Cat. | Ref. |
|---|---|---|---|---|---|---|---|---|
| G1 | Grilla de seis con filete vertical en las dos filas | b433855dc | PPT | `lamina_poblacion_geo.R` | ✅ | — | ✅ | ⛔ (p57) |
| G2 | Barras compactas en celda angosta | 67822ba19, 0a3133f60 | PPT | lógica | ⬜ | — | ✅ | ⛔ |
| G3 | Histograma en celda angosta: sólo cifras que no chocan | 1ea1f788b | PPT | suelto | ⬜ | ⬜ | ⬜ | ⛔ |
| G4 | Título de tres líneas comprime paneles; aviso sobre 15 % | c0df7056d | PPT | suelto | ⬜ | ⬜ | ⬜ | ⛔ |

## 11. Otros

| # | Regla | Commit | Medio | Dónde vive hoy | ADR | JSON | Cat. | Ref. |
|---|---|---|---|---|---|---|---|---|
| O1 | Radar de 5 a 8 criterios; con menos, líneas y puntos; forma y tabla elegibles | 51aafe5c8, fb148d02b, b7deee802 | PPT | `.RADAR_*_CRITERIOS` | ✅ | ⬜ | ⬜ (p94 marcada falta) | ⛔ |
| O2 | Tabla del radar al costado, si no cabe debajo, si no se omite con aviso | b7deee802, 31a3b7981 | PPT | `.LAM_TABLA_*` suelto | ⬜ | ⬜ | ✅ | ⛔ |
| O3 | Divergente: fila ≤ 1,2 in, barra ≤ 0,45, afirmaciones 12–11 pt; la línea central no tacha la cifra | 0a3133f60, f4d1b2271 | PPT | `.LAM_DIV_AREA` suelto | ⬜ | ⬜ | — | ⛔ (p71) |
| O4 | Dumbbell nativo con «A − B» y n entero | f4d1b2271 | PPT | suelto | ⬜ | ⬜ | — | ⛔ (p88) |
| O5 | Tabla de calor pregunta × cruce y serie por niveles | f4d1b2271, 8c3176b01 | PPT | — | ⬜ | — | ⬜ | ⛔ |
| O6 | Agrupada de cruce en paleta de marca, leyenda y barras en el mismo orden | 67822ba19 | PPT respaldo | suelto | ⬜ | ⬜ | — | ⛔ |
| O7 | Marco del estándar en la ruta de respaldo; título de lienzo como panel | 7e10765b8 y otros | PPT | suelto | ⬜ | ⬜ | — | coincide |
| O8 | Negrita por elemento y leyenda automática / una fila / dos filas | e68a546b5 | Ambos | `.NEGRITA_DEFECTO`, `.LEYENDA_MODOS` | ⬜ | ⬜ | ⬜ | — |

## Reglas de texto del JSON que ya no son ciertas

`ppt.reglas.cifras_chicas` (E6), `ppt.reglas.base_chica` (S5), `ppt.reglas.orden_escala` (N2), `word.documento` (W2) y
`ppt.geometria.aire_cifra_chica` (E5).

## Orden de trabajo propuesto

1. ADR 0092 como registro de decisiones del motor (todas las filas, columna **ADR**).
2. JSON: tokens nuevos y reglas de texto corregidas; el código los lee, sin cambiar ninguna salida (Arte 43/0 y el
   Word de Arte idéntico como gate).
3. Catálogo: láminas que faltan y marcas «falta» desactualizadas (p94, p103, p104).
4. El catálogo presenta cada estilo con un lenguaje coherente (Gonzalo: el catálogo «usa un lenguaje que presenta el estilo de forma no coherente»): ítem C1.

| # | Ítem | Estado |
|---|---|---|
| C1 | Gramática única de títulos, subtítulos y notas en las láminas del catálogo | 🔵 |
