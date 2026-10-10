# Inventario conciliado de íconos: recetario ↔ motor (F6.1b)

Fecha: 2026-10-10. Fuente que manda: `docs/qa/motor-ppt-2026-10-06/4-recetario/recetario-moderna.pptx` (274 láminas;
nunca el «… - Repaired.pptx»). Páginas = posición de la lámina en ese pptx, igual al PDF exportado con LibreOffice
(`tmp/f6-iconos/recetario-pdf/rm.pdf`, 274 páginas).

Cómo se verificó:

- Texto, antetítulo y layout de las 274 láminas: `tmp/f6-iconos/recetario-indice.txt` (python-pptx).
- Las 274 páginas se rasterizaron; las 68–117, 120–166, 168–197, 19–65 y 210–229 se miraron en hojas de contacto.
- Cada lámina se atribuyó al motor leyendo su `MOTOR_ACT` en los generadores (`docs/qa/motor-ppt-2026-10-06/herramientas/recetario*.R`,
  rama `ESTILO == "moderna"`). La clave «sección:n» de cada lámina se ubicó con `recetario_estructura.json`, el mismo orden que
  usa `reordenar.py`.
- Contra el registro: `.SLIDES_META` (33) y `.GRAFICADORES_META` (26) en `api/R/graficos_metadata.R`, `ppt.tipos_lamina`
  (22) en `api/inst/estandar/estandar_pulso.json`, variantes de `slide$meta` (`api/R/graficos_slide_meta.R`,
  `api/R/lamina_identidad.R`) y argumentos de cada graficador.

> **Correcciones a la lista de gráficos de §3.3 del prompt de diseño.** Las páginas de las láminas (123–171) cuadran, pero
> cinco páginas de gráficos no corresponden a lo que dice la lista:
>
> | La lista dice | El pptx tiene en esa página | Dónde está de verdad |
> |---|---|---|
> | «columnas 82» | Indicador numérico (`p_numerico`, columnas de promedios) | Las columnas propiamente dichas: barras categóricas (68) y la escala de 1 a 10 de opinión pública (232) |
> | «escala por actor 79» | Escalas con Bottom Two Box y fila Total (propuesta) | Seis actores: 184, y partición: 185–188 |
> | «escala TTB+BTB 97» | Peso en la satisfacción (propuesta de regresión) | TTB + BTB: 79 |
> | «mapa de calor 85» | Conteos por año (propuesta de matriz de conteos) | Mapa de calor: 94 y 95 |
> | «tabla de dimensiones 94» | Mapa de calor por dimensión | Tabla: 197 (perfil en tabla) |

---

## A. Láminas del recetario

### A.1 Los 22 tipos (capítulo 3; catálogo en 120–121, ficha «TIPO DE LÁMINA n DE 22» y ejemplo)

Todas existen en el motor con el mismo id y las mismas ranuras en `estandar_pulso.json`.

| # | Tipo (recetario) | Ficha | Ejemplo(s) | Tipo del registro | Ícono |
|---|---|---|---|---|---|
| 1 | Un gráfico | 123 | 124 | `p_slide_1_grafico` | propio |
| 2 | Un gráfico con narrativa | 125 | 126 | `p_slide_1_grafico_narrativo` | propio |
| 3 | Gráfico con texto a la derecha | 127 | 128 | `p_slide_grafico_texto_derecha` | propio |
| 4 | Gráfico con texto a la izquierda | 129 | 130 | `p_slide_grafico_texto_izquierda` | propio |
| 5 | Texto | 131 | 132 | `p_slide_texto` | propio |
| 6 | Dos gráficos | 134 | 135; **136 variante «con ícono del público»** | `p_slide_2_graficos` (136 = `p_slide_2_graficos_poblacion`) | propio; 136 = variante (punto de población) |
| 7 | Dos gráficos con narrativa | 137 | 138 | `p_slide_2_graficos_narrativo` | propio |
| 8 | Dos gráficos con texto a la izquierda | 139 | 140 | `p_slide_2_graficos_texto_izquierda` | propio |
| 9 | Dos gráficos con texto a la derecha | 141 | 142 | `p_slide_2_graficos_texto_derecha` | propio |
| 10 | Dos gráficos apilados | 143 | 144 | `p_slide_2_graficos_vertical` | propio |
| 11 | Gráfico principal y de apoyo | 145 | 146 | `p_slide_2_graficos_asimetrico` | propio |
| 12 | Tres gráficos, dos apilados y uno alto | 148 | 149 | `p_slide_3_graficos_2mas1` | propio |
| 13 | Tres gráficos, uno alto y dos apilados | 150 | 151, 152 («escala ordinal con residual») | `p_slide_3_graficos_1mas2` | propio |
| 14 | Tres gráficos, uno ancho arriba | 153 | 154 | `p_slide_3_graficos_1arriba` | propio |
| 15 | Tres gráficos en fila | 155 | 156 | `p_slide_3_graficos_fila` | propio |
| 16 | Tres gráficos en tira | 157 | 158 | `p_slide_3_graficos_poblacion_tira` | propio (con punto de población) |
| 17 | Tres gráficos en corona | 159 | 160 | `p_slide_3_graficos_poblacion_corona` | propio (= ranuras de 12 + punto de población) |
| 18 | Cuatro gráficos | 161 | 162 | `p_slide_4_graficos` | propio |
| 19 | Cinco gráficos | 163 | 164 | `p_slide_5_graficos_poblacion` | propio (con punto) |
| 20 | Seis gráficos | 165 | 166 | `p_slide_6_graficos_poblacion` | propio (con punto) |
| 21 | Cifras en columna lateral | 168 | 169; 180 (combinación «cifras y perfil») | `p_slide_3_graficos_poblacion_cifras` | propio (con punto y banda de cifras vertical) |
| 22 | Cifras en banda superior | 170 | 171; 231 y 255 (estudios) | `p_slide_cifras_y_graficos` | propio |

Más láminas del capítulo 3.5 que **no son tipos nuevos**:

| Página | Lo que muestra | En el motor | Ícono |
|---|---|---|---|
| 172 | Cifra en lugar de un gráfico | `p_slide_4_graficos` con `p_cifra` en una ranura | el de Cuatro gráficos; la cifra la lleva el ícono del gráfico |
| 173 | Una cifra frente a su gráfico | **no existe**: la banda del motor tiene 3 ranuras fijas (`cifra_izquierda/centro/derecha`) | ninguno hasta que exista |
| 174 | Tres cifras con rótulos de largo distinto | `p_slide_cifras_y_graficos` (las 3 cifras) | el de Banda de cifras |
| 175 | Cinco cifras, el máximo | **no existe** (banda fija de 3) | ninguno hasta que exista |

Las páginas 173–175 se generan con `MOTOR_ACT = "Reglas: la cifra destacada de una a cinco (p_slide_cifras_y_graficos)"`:
son regla de composición, no un tipo.

### A.2 Láminas de estructura (capítulo 1; algunas también en el capítulo 4)

| Tipo | Variantes en el recetario (páginas) | Tipo del registro | Variante en el motor | Ícono |
|---|---|---|---|---|
| Portada | centrada (23), alineada a la izquierda (24), con banda inferior (25) | `p_slide_portada` | las 3: `meta$variante` = `centrada` / `izquierda` / `banda` | propio; las variantes no llevan ícono |
| Objetivo del estudio | con diana y actores (26), con panel azul (27), desglosado (28) | `p_slide_objetivo_icono` | sólo la 26. Las 27 y 28 son «PROPUESTA» en `recetario_reglas2.R` | propio |
| Ficha técnica | una (29) | `p_slide_tabla_tecnica` | sí | propio |
| Índice | 4 composiciones × 5 situaciones: arcos 31–35, facetas 36–40, círculos 41–45, bloques 46–50. Las situaciones son 5 capítulos, 5 con subcapítulos, subcapítulos en dos capítulos, 8 y 13 capítulos | `p_slide_indice` | las 4: `meta$composicion` ∈ `.LAM_INDICE_COMPOSICIONES`. Las situaciones salen de los datos | propio; las composiciones no llevan ícono |
| Explicación Top Two Box | una (19) | `p_slide_top_two_box` | sí | propio |
| Redondeo | estándar (20), resto mayor (21) | `p_slide_redondeo` | las 2: `meta$metodo` | propio |
| Separador de capítulo | número grande con figuras (52), rótulo «CAPÍTULO n» (53, la **variante B** del motor, la misma de los capítulos del propio recetario: 4, 66, 118, 209, 256), número de fondo (54). El informe tipo agrega número en círculo con figuras (211, 215) | `p_slide_seccion` | sólo la B (53) con `meta$nivel = "capitulo"`. Las 52, 54 y 211/215 no existen | propio |
| Separador de subcapítulo | sobrio (55, el del motor, y el de todos los subcapítulos del propio recetario), con filete (56), con banda (57), como antetítulo sobre una lámina de gráfico (58). El resumen está en 59: «tres separadores de capítulo y cuatro de subcapítulo» | `p_slide_seccion` con `meta$nivel = "subcapitulo"` | sólo 55 | **variante del separador** (mismo ícono; el nivel se lee por la sangría en Estructura) |
| Cierre | 61–65: cinco composiciones | `p_slide_cierre` | las 5 por `meta$variante`: `contraportada`, `banda_azul`, `banda_clara`, `contacto`, `tres_columnas` (emparejamiento por inspección visual: 61 banda azul, 62 banda clara, 63 contacto bajo el logo, 64 tres columnas, 65 contraportada) | propio |

Además: «Texto» (131/132) es uno de los 22, no de estructura. Las láminas de reglas (5–21), banco de recursos (256–274),
diferencias significativas (110–117) y combinaciones (177–182) son documentación o propuestas, no tipos de lámina.

### A.3 Láminas de población «antiguas» del registro que el recetario sí usa, pero no como tipo

| Tipo del registro | Dónde aparece | Qué es en la versión moderna |
|---|---|---|
| `p_slide_2_graficos_poblacion` | 136 («Dos gráficos, con ícono del público») | Dos gráficos + ícono del público en la cabecera |
| `p_slide_3_graficos_poblacion` | 213 (informe tipo, «Perfil del egresado»: tres paneles en fila) | Tres en fila + ícono |
| `p_slide_4_graficos_poblacion` | 212 (perfil del estudiante), 195 (base chica), 196 (base chica en cuatro paneles) | Cuatro gráficos + ícono |

El recetario moderno pone el ícono del público **en la cabecera**: `ICONO_MODO = "cabecera"` en `recetario.R`, y `"centro"`
sólo en la fiel. Eso confirma el rasgo de población del pliego, que es un punto en la cabecera y no un círculo central.

---

## B. Gráficos del recetario (capítulo 2, más los que sólo aparecen en los capítulos 3 y 4)

«Propio» significa ícono dibujado; «variante» significa que usa el ícono del tipo.

| Gráfico (rótulo del recetario) | Página(s) | Graficador + args que lo producen | Ícono |
|---|---|---|---|
| Barras categóricas | 68 | `p_barras_categoricas`, `orientacion = "vertical"` (por defecto, ADR 0093): **columnas** | propio, **en columnas** (el pliego las dibujó horizontales: corregir) |
| Gráfico de torta con leyenda de cifras | 69 | `p_pie`. La leyenda de cifras es PROPUESTA: el motor dibuja la leyenda estándar | propio |
| Gráfico de dona | 70 | `p_donut` | propio |
| Barras divergentes | 71 | `p_barras_divergentes` | propio |
| Ranking con puntos | 72; 101 (al lado de la nube) | `p_lollipop` | propio |
| Ranking en barras | 73 | `p_barras_agrupadas`, `orden_barras = "mayor_menor"`, residuales al final | propio (el de barras agrupadas: horizontales ordenadas) |
| Barras de 0 a 100 %, sin marcas / con marcas | 74 / 75 | `p_barras_agrupadas` con `usar_eje_libre = FALSE` y `marcas_eje = FALSE / TRUE` | variante de Ranking en barras |
| Dicotómica | 76 (y en casi todas las láminas de perfil) | `p_barras_multiapiladas` con una pregunta de dos categorías (en el generador, «(dicotómica)») | **propio** (una barra partida en dos; muy frecuente y distinta de la escala). En el registro no es un graficador: es un preset |
| Escala con Top Two Box (de utilidad, de competencia, de importancia) | 78; 199, 200 | `p_barras_multiapiladas`, `modo = "var"` (o `var_cruce`), `top2box = TRUE` | propio (el de multiapiladas) |
| Escala por actor (seis actores, partición) | 184; 185–188; 216–224 | `p_barras_multiapiladas`, `modo = "var_cruce"` | variante de Escala |
| Escalas con Bottom Two Box y fila Total | 79 | **no existe** (PROPUESTA `bloque_likert`) | variante de Escala cuando exista |
| Barras apiladas (una fila de escala) | 218; componente en 152 | `p_barras_apiladas` | variante de Escala (alias; véase C) |
| Columnas de 1 a 10 (opinión pública) | 232 | `p_barras_agrupadas`, `orientacion = "vertical"`, orden del instrumento | variante de Ranking en barras |
| Histograma | 81 | `p_histograma` | propio |
| Indicador numérico | 82 | `p_numerico` (preset `barras_numericas`, orientación vertical: columnas de promedios) | propio (columnas con su media; hoy es «#», que no es lo que dibuja) |
| Diagrama de caja | 83 | `p_boxplot` | propio |
| Media y rango | 84 | `p_media_rango` | propio |
| Conteos por año | 85 | **no existe** en la moderna (PROPUESTA: matriz de conteos; la fiel usa `p_barras_apiladas` en columnas) | ninguno hasta que exista |
| Puntos comparativos | 87; 93 (alternativa al radar); 225 | `p_puntos_comparativos` | propio |
| Brecha entre dos públicos | 88; 189, 239, 250, 253 | `p_dumbbell` | propio |
| Serie temporal de dos mediciones / con varias | 89 / 90; 181, 234 | `p_serie_temporal` | propio (2 o N mediciones = variante) |
| Radar con tabla | 92 | `p_radar`, `mostrar_tabla = TRUE` | propio |
| Mapa de calor por dimensión | 94; 229 | `p_dim_heatmap` | propio |
| Mapa de calor por criterio | 95 | `p_dim_heatmap_criterios` | propio (distinto del anterior: filas agrupadas por dimensión) |
| Comparativo de dimensiones | 96 | `p_dim_comparativo_radarbar` (componente de barras) | propio |
| Peso en la satisfacción | 97 | **no existe** (PROPUESTA: regresión, análisis nuevo) | ninguno hasta que exista |
| Radar por dimensiones | 98 | `p_dim_radar`, `inicio_eje_pct = 80` | propio (dos polígonos, sin tabla) |
| Nube de palabras / nube con ranking / nube de frases | 100 / 101 / 102 | `p_nube_palabras` (101 se arma en una lámina narrativa con `p_lollipop`; 102 es ilustrativa). **Sale por la ruta anterior** | propio; 101 y 102 son variantes |
| Pregunta abierta: frases y temas | 103 | **no existe** (PROPUESTA) | ninguno |
| Mapa territorial: distritos / un distrito / zonas y manzanas / zonas / manzanas / dos grupos | 105 / 107 / 108 / 236 / 237 / 238 | `p_mapa_cobertura_territorial` con `scope = overview` o `district`, `study_blocks` y `comparison_mode = paired_district`. El generador las marca PROPUESTA de composición, pero el graficador existe | propio (una sola; los alcances son variantes) |
| Mapa de Lima: resultado por distrito | 106 | `p_mapa_resultado_distrital` | propio |
| Diferencias significativas (por qué, tabla de letras, técnica, estándar, público general) | 110–117 | **no existe** como gráfico (PROPUESTA `comparar_columnas_sig` + Newcombe). Lo único que existe es `mostrar_significancia` en `p_barras_agrupadas`, `p_barras_apiladas` y similares | ninguno; si se implementa, uno propio |
| Cifra destacada | 17–18 (reglas), 172–175, 169, 171 | `p_cifra` | propio |
| Tabla (perfil en tabla) | 197 | `p_tabla` | propio |
| Opción múltiple entre actores (dot plot) | 190 | **no existe** (PROPUESTA H68) | ninguno |
| Desglose conectado (filtro y subpregunta, al costado, llave) | 191, 192, 193 | **no existe** (PROPUESTA H50/H51); se compone con `p_slide_2_graficos_vertical` + multiapiladas/agrupadas | ninguno (es composición de lámina) |
| Barras con meta | 241 | **no existe** (PROPUESTA) | ninguno |
| Aulas aplicadas frente a previstas | 246 | **no existe** (PROPUESTA) | ninguno |
| Cambio con su intervalo | 254 | **no existe** (PROPUESTA Newcombe) | ninguno |

---

## C. Tipos del registro que el recetario no presenta como tales

| Tipo del registro | ¿Aparece en el recetario? | Recomendación |
|---|---|---|
| `p_dim_foda` (Matriz FODA dimensional) | **No**, en ninguna de las 274 láminas | **Retirar del selector**: queda accesible sólo para planes viejos (ruta anterior), sin ícono propio; el contrato lo cubre con el ícono de tipo desconocido. Si se quiere conservar visible, un ícono propio (cuadrante 2×2). |
| `p_barras_apiladas` | Sólo como una fila de escala en el informe tipo (218) y como componente de 152 | **Alias** del ícono de Escala con Top Two Box: se ve igual y el recetario no lo distingue. |
| `p_slide_2_graficos_poblacion` | 136, como variante de Dos gráficos | **Alias**: el ícono de Dos gráficos + punto de población (sin dibujo nuevo). |
| `p_slide_3_graficos_poblacion` | 213, en el informe tipo | **Alias**: el ícono de Tres en fila + punto de población. |
| `p_slide_4_graficos_poblacion` | 195, 196, 212 | **Alias**: el ícono de Cuatro gráficos + punto de población. |
| `p_mapa_cobertura_territorial` | **Sí** (105, 107, 108, 236–238) | Ícono propio (está en B). No va aquí: la suposición de que el recetario no lo presenta era falsa. |
| `p_dim_heatmap_criterios` | **Sí** (95) | Ícono propio (está en B). |
| `p_tabla` | **Sí** (197) | Ícono propio (está en B). |
| `p_radar` | **Sí** (92, «Radar con tabla»). En la 225 la moderna lo reemplaza por tabla + puntos comparativos | Ícono propio (radar + tabla). |

No hay ningún tipo de lámina del registro que el recetario ignore por completo: las 33 aparecen.

---

## Conteo final de íconos a dibujar

| Clase | Íconos propios | Cuáles |
|---|---|---|
| Láminas: los 22 tipos | **22** | A.1 |
| Láminas: estructura | **8** | portada, objetivo, ficha técnica, índice, Top Two Box, redondeo, separador, cierre |
| Gráficos | **25** | barras categóricas (columnas), torta, dona, divergentes, ranking con puntos, ranking en barras (agrupadas), **dicotómica** (preset), escala con TTB (multiapiladas), histograma, indicador numérico, caja, media y rango, puntos comparativos, brecha (dumbbell), serie temporal, radar con tabla, mapa de calor por dimensión, mapa de calor por criterio, comparativo de dimensiones, radar por dimensiones, nube de palabras, mapa territorial, mapa de resultado por distrito, cifra destacada, tabla |
| **Total a dibujar** | **55** | (antes se planeaban 59 = 33 + 26) |
| Derivados sin dibujo nuevo | 4 | 3 láminas de población antiguas (base + punto) y `p_barras_apiladas` (alias de escala) |
| Sin ícono | 1 + propuestas | `p_dim_foda` (retirar del selector). Las propuestas que no existen en el motor (BTB + fila total, conteos por año, peso, frases y temas, diferencias significativas, dot plot por actor, desglose conectado, metas, avance de aulas, cambio con intervalo, banda de 1 o 5 cifras, portadas/objetivos/separadores alternativos) reciben ícono cuando el motor las produzca |

Así se cubren los 59 tipos del registro: 30 láminas propias + 3 derivadas = 33, y 24 gráficos 1:1 + 1 alias + FODA retirado = 26.
El preset «Dicotómica» es el único ícono que no corresponde a un graficador.

## Cómo representar las variantes

**Recomendación: ícono por tipo del recetario; las variantes no llevan ícono ni modificador.**

1. A 16 px un modificador (esquina, insignia, punto extra) mide 2–3 px y no se distingue. El pliego mostró que el punto de
   población ya está en el límite. Un segundo modificador sería ruido.
2. Las variantes se eligen **dentro** de un tipo ya elegido (portada → centrada/izquierda/banda; índice → arcos/facetas/círculos/bloques;
   cierre → 5; redondeo → 2; separador → capítulo/subcapítulo). Ese selector vive en el inspector, donde caben miniaturas
   (`ComposicionLamina` ≥64 px), que son las que de verdad muestran la diferencia.
3. **Única excepción, que es un rasgo y no un modificador:** el punto de población en la cabecera. Distingue tipos que el
   estándar no separa (corona = 2+1 + punto) y deriva los tres alias de población sin dibujo nuevo. Coincide con el recetario
   moderno (`ICONO_MODO = "cabecera"`).
4. Para gráficos, el ícono sigue **lo que el recetario dibuja**, no el nombre del graficador. Por eso barras categóricas = columnas,
   barras agrupadas = barras horizontales ordenadas, indicador numérico = columnas de promedios, dicotómica = una barra en dos.
   Una opción de un graficador que cambia el dibujo de familia (`orientacion = "vertical"` en agrupadas, 232) sigue con el
   ícono de su tipo: el selector elige tipo, no orientación.

## Consecuencias para el pliego ya entregado

- **Barras categóricas**: rehacer como columnas (68; ADR 0093). Las barras horizontales ordenadas pasan a ser el ícono de
  «Ranking en barras» (`p_barras_agrupadas`).
- **Multi-apiladas** del pliego = Escala con TTB: correcto. Falta el de **Dicotómica** (una barra en dos segmentos).
- **Indicador numérico** (no estaba en el pliego): columnas de promedios, no «#». Debe distinguirse de barras categóricas
  (p. ej. columnas de altura pareja con marca de valor encima).
- **Cifra destacada** («%»): se mantiene; no choca con el indicador numérico.
- **Radar**: hay dos en el recetario (con tabla 92, por dimensiones 98): hacen falta dos íconos distinguibles.
- El rasgo de población en la cabecera queda respaldado por el propio recetario.
