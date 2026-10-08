# Capítulo 3, fichas de los 32 tipos de lámina del motor (2026-10-08, «mostramos todos los tipos de láminas y cómo cada una tiene una estructura;
# algunas hacen los gráficos más pequeños, por lo que la tabla estándar cambia»). Cada ficha dibuja el esquema medido del layout y su tabla de
# medidas respecto de la lámina estándar. Claves: «fich:1-3» catálogo, «fich:4-35» fichas en el orden de TIPOS, «comb:1-2» combinaciones.
SEC <- "fich"
xS <- XC; xE <- W - MR; aw <- xE - xS   # ancho útil
zf <- function(tipo, x, y, w, h) list(tipo = tipo, x = x, y = y, w = w, h = h)
Gf <- function(x, y, w, h) zf("g", x, y, w, h); Tf <- function(x, y, w, h) zf("t", x, y, w, h); Cf <- function(x, y, w, h) zf("c", x, y, w, h)
h1 <- 4.6; h2 <- 2.2; y1 <- 1.65; y2 <- 4.05; w2 <- (aw - 0.5) / 2; x2 <- xS + w2 + 0.5; w3 <- (aw - 1.0) / 3
Mf <- function(escala, cifra, rot, barra) list(escala = escala, cifra = cifra, rot = rot, barra = barra)
fam1 <- Mf("100 %", "14 pt", "12 pt", "0.42 in"); famT <- Mf("60 %", "14 pt", "12 pt", "0.36 in"); fam2 <- Mf("48 %", "13 pt", "11.5 pt", "0.34 in")
fam3 <- Mf("30 a 48 %, media altura", "12 pt", "11 pt", "0.26 in"); famP <- Mf("30 %, media altura", "12 pt", "10.5 pt", "0.22 in"); famA <- Mf("No aplica", "No aplica", "No aplica", "No aplica")
TIPOS <- list(
  list("Un gráfico", "p_slide_1_grafico", "Graficos", list(Gf(xS, y1, aw, h1)), fam1, "Todos los gráficos del capítulo 2", "La lámina estándar: una pregunta, un gráfico"),
  list("Un gráfico con narrativa", "p_slide_1_grafico_narrativo", "1_Grafico_narrativo", list(Tf(xS, y1, aw, 0.8), Gf(xS, 2.6, aw, 3.7)), fam1, "Barras, escalas y rankings", "Cuando una frase arriba dice lo que hay que retener del gráfico"),
  list("Gráfico con texto a la derecha", "p_slide_grafico_texto_derecha", "right_grafico_texto", list(Gf(xS, y1, 7.6, h1), Tf(8.6, 1.9, xE - 8.6, 3.0)), famT, "Barras, escalas y dicotómicas", "Lo más común en un informe: el gráfico y su lectura al costado"),
  list("Gráfico con texto a la izquierda", "p_slide_grafico_texto_izquierda", "left_grafico_texto", list(Tf(xS, 1.9, 4.2, 3.0), Gf(5.2, y1, xE - 5.2, h1)), famT, "Barras, escalas y dicotómicas", "Para alternar con la lámina vecina que lleva el texto a la derecha"),
  list("Texto", "p_slide_texto", "Title and Content", list(Tf(xS, y1, aw, h1)), famA, "Sin gráfico", "Conclusiones o notas metodológicas breves"),
  list("Dos gráficos", "p_slide_2_graficos", "Graficos_2columnas", list(Gf(xS, y1, w2, h1), Gf(x2, y1, w2, h1)), fam2, "Dos gráficos del mismo tipo o de la misma pregunta", "Dos preguntas que se leen juntas"),
  list("Dos gráficos con narrativa", "p_slide_2_graficos_narrativo", "1_Graficos_2columnas_narrativo", list(Tf(xS, y1, aw, 0.8), Gf(xS, 2.6, w2, 3.7), Gf(x2, 2.6, w2, 3.7)), fam2, "Barras y dicotómicas", "Dos gráficos con una idea común arriba"),
  list("Dos gráficos con texto a la izquierda", "p_slide_2_graficos_texto_izquierda", "left_2graficos_texto", list(Tf(xS, 1.9, 3.5, 3.0), Gf(4.4, y1, 4.2, h1), Gf(8.85, y1, xE - 8.85, h1)), fam3, "Dicotómicas y barras cortas", "Perfiles breves con su lectura"),
  list("Dos gráficos con texto a la derecha", "p_slide_2_graficos_texto_derecha", "right_2graficos_texto", list(Gf(xS, y1, 4.1, h1), Gf(4.85, y1, 4.1, h1), Tf(9.25, 1.9, xE - 9.25, 3.0)), fam3, "Dicotómicas y barras cortas", "Igual que la anterior, para alternar"),
  list("Dos gráficos apilados", "p_slide_2_graficos_vertical", "graficos_2_vertical", list(Gf(xS, y1, aw, h2), Gf(xS, y2, aw, h2)), Mf("100 % de ancho, media altura", "14 pt", "12 pt", "0.30 in"), "Escalas de pocas filas", "Dos preguntas de escala que comparten leyenda"),
  list("Gráfico principal y de apoyo", "p_slide_2_graficos_asimetrico", "graficos_2_asimetrico", list(Gf(xS, y1, 7.9, h1), Gf(8.85, y1, xE - 8.85, h1)), Mf("65 % y 35 %", "14 y 12 pt", "12 y 11 pt", "0.36 in"), "Escala con un ranking o un resumen al lado", "Cuando un gráfico manda y el otro lo resume"),
  list("Tres gráficos, dos apilados y uno alto", "p_slide_3_graficos_2mas1", "graficos_3_2mas1", list(Gf(xS, y1, w2, h2), Gf(xS, y2, w2, h2), Gf(x2, y1, w2, h1)), fam3, "Dicotómicas a la izquierda y barras a la derecha", "Dos preguntas breves y una más larga"),
  list("Tres gráficos, uno alto y dos apilados", "p_slide_3_graficos_1mas2", "graficos_3_1mas2", list(Gf(xS, y1, w2, h1), Gf(x2, y1, w2, h2), Gf(x2, y2, w2, h2)), fam3, "Barras a la izquierda y dicotómicas a la derecha", "La pregunta larga primero"),
  list("Tres gráficos, uno ancho arriba", "p_slide_3_graficos_1arriba", "graficos_3_1arriba", list(Gf(xS, y1, aw, h2), Gf(xS, y2, w2, h2), Gf(x2, y2, w2, h2)), fam3, "Escala arriba y dos dicotómicas abajo", "Una pregunta general y dos de detalle"),
  list("Tres gráficos en fila", "p_slide_3_graficos_fila", "graficos_3_fila", list(Gf(xS, y1, w3, h1), Gf(xS + w3 + 0.5, y1, w3, h1), Gf(xS + 2 * (w3 + 0.5), y1, w3, h1)), fam3, "Barras cortas del mismo tipo", "Tres variables de perfil, o una comparación entre años"),
  list("Cuatro gráficos", "p_slide_4_graficos", "4_paneles", list(Gf(xS, y1, w2, h2), Gf(x2, y1, w2, h2), Gf(xS, y2, w2, h2), Gf(x2, y2, w2, h2)), fam3, "Barras cortas y dicotómicas", "Cuatro variables de perfil del mismo público"),
  list("Población, dos gráficos", "p_slide_2_graficos_poblacion", "poblacion_2", list(Gf(xS, y1, w2, h1), Gf(x2, y1, w2, h1)), fam2, "Sexo y edad", "El perfil mínimo de un público"),
  list("Población, tres gráficos", "p_slide_3_graficos_poblacion", "poblacion_3", list(Gf(xS, y1, w3, h1), Gf(xS + w3 + 0.5, y1, w3, h1), Gf(xS + 2 * (w3 + 0.5), y1, w3, h1)), famP, "Dicotómicas y barras cortas", "Perfil de un público en tres variables"),
  list("Población en tira", "p_slide_3_graficos_poblacion_tira", "poblacion_3_tira", list(Gf(xS, y1, aw, 1.4), Gf(xS, y1 + 1.6, aw, 1.4), Gf(xS, y1 + 3.2, aw, 1.4)), Mf("100 % de ancho, un tercio de alto", "14 pt", "12 pt", "0.30 in"), "Dicotómicas", "Tres preguntas de sí o no del mismo público"),
  list("Población en corona", "p_slide_3_graficos_poblacion_corona", "poblacion_3_corona", list(Gf(xS, y1, w2, h2), Gf(xS, y2, w2, h2), Gf(x2, y1, w2, h1)), fam3, "Dicotómica, barras y rango de edad", "Perfil con una variable más larga"),
  list("Población con cifras", "p_slide_3_graficos_poblacion_cifras", "poblacion_3_cifras", list(Cf(xS, y1, 3.0, h1), Gf(3.9, y1, 4.4, h2), Gf(3.9, y2, 4.4, h2), Gf(8.75, y1, xE - 8.75, h1)), famP, "Cifras destacadas, dicotómicas y barras", "Cuando el tamaño de la muestra y la edad se dicen en cifras"),
  list("Población, cuatro gráficos", "p_slide_4_graficos_poblacion", "poblacion_4", list(Gf(xS, y1, w2, h2), Gf(x2, y1, w2, h2), Gf(xS, y2, w2, h2), Gf(x2, y2, w2, h2)), fam3, "Barras cortas, dicotómicas y tablas", "Perfil completo o bases chicas en paneles"),
  list("Población, cinco gráficos", "p_slide_5_graficos_poblacion", "poblacion_5", list(Gf(xS, y1, w3, h2), Gf(xS + w3 + 0.5, y1, w3, h2), Gf(xS + 2 * (w3 + 0.5), y1, w3, h2), Gf(xS, y2, w2, h2), Gf(x2, y2, w2, h2)), famP, "Dicotómicas arriba, barras abajo", "Perfil del egresado o del docente en una lámina"),
  list("Población, seis gráficos", "p_slide_6_graficos_poblacion", "poblacion_6", list(Gf(xS, y1, w3, h2), Gf(xS + w3 + 0.5, y1, w3, h2), Gf(xS + 2 * (w3 + 0.5), y1, w3, h2), Gf(xS, y2, w3, h2), Gf(xS + w3 + 0.5, y2, w3, h2), Gf(xS + 2 * (w3 + 0.5), y2, w3, h2)), famP, "Dicotómicas y barras de pocas categorías", "El máximo de gráficos en una lámina"),
  list("Banda de cifras y dos gráficos", "p_slide_cifras_y_graficos", "cifras_y_graficos", list(Cf(xS, y1, aw, 1.2), Gf(xS, 3.05, w2, 3.2), Gf(x2, 3.05, w2, 3.2)), fam2, "Cifras destacadas, escalas y barras", "Abrir un capítulo o resumir el estudio"),
  list("Portada", "p_slide_portada", "Title Slide", list(Tf(1.6, 2.6, 10.1, 1.4)), famA, "Título, encargo y fecha", "La primera lámina de todo informe"),
  list("Objetivo", "p_slide_objetivo_icono", "General Objective", list(Cf(xS, 1.3, 0.7, 0.7), Tf(xS, 2.3, aw, 2.0), Cf(xS, 5.0, aw, 1.2)), famA, "Texto del objetivo y actores", "Después de la portada"),
  list("Ficha técnica", "p_slide_tabla_tecnica", "Graficos", list(Tf(xS, y1, aw, h1)), famA, "Tabla con íconos y cifras de muestra", "Metodología: tipo, universo, muestra y trabajo de campo"),
  list("Top Two Box", "p_slide_top_two_box", "Graficos", list(Tf(xS, y1, aw, 0.8), Gf(xS, 2.8, 8.5, 1.4), Cf(10.5, 2.6, 2.4, 1.6)), famA, "Barra de ejemplo y su suma", "Cómo leer el informe"),
  list("Redondeo", "p_slide_redondeo", "Graficos", list(Tf(xS, y1, aw, 0.7), Tf(xS, 2.6, aw, 3.2)), famA, "Tabla del ejemplo", "Cómo leer el informe: por qué una suma da 99 o 101"),
  list("Índice", "p_slide_indice", "Indice", list(Cf(0, 0, 6.2, 7.5), Tf(6.75, y1, xE - 6.75, h1)), famA, "De 5 a 13 capítulos, con o sin subcapítulos", "Después de la metodología"),
  list("Separador de capítulo", "p_slide_seccion", "Section Header", list(Tf(2.5, 3.8, 9.8, 1.6)), famA, "Número, título y subtítulo", "Al inicio de cada capítulo"))

# Dibuja el esquema de un tipo en una caja de la lámina (x0, y0, escala k)
esquema <- function(doc, t, x0, y0, k, etiquetas = TRUE) {
  caja(doc, x0, y0, W * k, H * k, "#FFFFFF", line = sp_line(color = TK$rule, lwd = 0.75))
  if (!t[[2]] %in% c("p_slide_portada", "p_slide_seccion", "p_slide_indice", "p_slide_objetivo_icono")) {
    caja(doc, x0 + ML0 * k, y0 + (Y_TIT - 0.05) * k, 0.025, 0.55 * k, TK$navy); caja(doc, x0 + ML * k, y0 + (Y_TIT + 0.1) * k, 4.5 * k, 0.16 * k, TK$coral)
    caja(doc, x0 + ML * k, y0 + (Y_BASE + 0.05) * k, 3.5 * k, 0.07 * k, TK$navy) }
  ng <- 0
  for (zz in t[[4]]) { xx <- x0 + zz$x * k; yy <- y0 + zz$y * k; ww <- zz$w * k; hh <- zz$h * k
    if (zz$tipo == "g") { ng <- ng + 1; caja(doc, xx, yy, ww, hh, "#C9D3E6")
      if (etiquetas && ww > 0.9) txt(doc, sprintf("%.1f × %.1f", zz$w, zz$h), xx, yy + hh / 2 - 0.13, ww, 0.26, if (k > 0.3) 9.5 else 8, TK$navy, bold = TRUE, align = "center") }
    if (zz$tipo == "t") { caja(doc, xx, yy, ww, hh, TK$zebra); for (j in 0:min(3, floor(hh / (0.35 * k)) - 1)) caja(doc, xx + 0.08, yy + 0.1 + j * 0.3 * k * 1.4, (ww - 0.16) * c(1, 0.9, 0.95, 0.6)[j + 1], max(0.03, 0.06 * k * 2), TK$faint) }
    if (zz$tipo == "c") caja(doc, xx, yy, ww, hh, TK$navy) } }

# 1 a 3. Catálogo: las 32 miniaturas, en tres láminas de 4 x 3
grupos_cat <- list(1:12, 13:24, 25:32)
for (pg in seq_along(grupos_cat)) {
  MOTOR_ACT <- "Catálogo de los tipos de lámina del motor"
  doc <- nueva(doc); titulo(doc, sprintf("Los 32 tipos de lámina (%d de 3)", pg), ante = "Catálogo de láminas")
  idx <- grupos_cat[[pg]]; k <- 0.17; gx <- (AC - 4 * W * k) / 3
  for (m in seq_along(idx)) { t <- TIPOS[[idx[m]]]; cc <- (m - 1) %% 4; rr <- (m - 1) %/% 4
    x0 <- XC + cc * (W * k + gx); y0 <- YT - 0.1 + rr * (H * k + 0.42)
    esquema(doc, t, x0, y0, k, etiquetas = FALSE)
    txt(doc, sprintf("%d. %s", idx[m], t[[1]]), x0 - 0.1, y0 + H * k + 0.02, W * k + 0.2, 0.3, 10, TK$navy, bold = TRUE) }
  pie(doc, "Cada tipo es un constructor del motor con su layout en la plantilla. Las fichas siguientes dan sus medidas") }

# 3 a 34. Una ficha por tipo
for (i in seq_along(TIPOS)) { t <- TIPOS[[i]]
  MOTOR_ACT <- paste0(t[[2]], " (layout «", t[[3]], "»)")
  doc <- nueva(doc); titulo(doc, t[[1]], ante = sprintf("Tipo de lámina %d de 32", i))
  k <- 0.5; esquema(doc, t, XC, YT, k)
  xr <- XC + W * k + 0.55; wr <- W - MR - xr
  txt(doc, t[[2]], xr - 0.1, YT - 0.05, wr + 0.1, 0.28, 11, TK$soft, bold = TRUE)
  med <- t[[5]]; ng <- sum(vapply(t[[4]], function(zz) zz$tipo == "g", TRUE))
  filas <- list(c("Gráficos", if (ng > 0) as.character(ng) else "Ninguno"), c("Escala del gráfico", med$escala), c("Cifra", med$cifra), c("Rótulos", med$rot), c("Grosor de barra", med$barra))
  for (j in seq_along(filas)) { yj <- YT + 0.35 + (j - 1) * 0.4
    txt(doc, filas[[j]][1], xr - 0.1, yj, 2.0, 0.28, 12, TK$navy, bold = TRUE); txt(doc, filas[[j]][2], xr + 1.9, yj, wr - 1.9, 0.28, 12, TK$navy)
    separador_h(doc, xr, W - MR, yj + 0.36) }
  ya <- YT + 0.35 + length(filas) * 0.4 + 0.2
  txt(doc, "Gráficos que admite", xr - 0.1, ya, wr + 0.1, 0.28, 11, TK$soft, bold = TRUE); txt(doc, t[[6]], xr - 0.1, ya + 0.28, wr + 0.1, 0.5, 12.5, TK$navy)
  txt(doc, "Cuándo se usa", xr - 0.1, ya + 0.9, wr + 0.1, 0.28, 11, TK$soft, bold = TRUE); txt(doc, t[[7]], xr - 0.1, ya + 1.18, wr + 0.1, 0.6, 12.5, TK$navy, bold = TRUE)
  zona("esquema medido, a la mitad de su tamaño", XC, YT, W * k, H * k)
  pie(doc, sprintf("Layout «%s» de la plantilla. Medidas del gráfico en pulgadas. La escala compara su ancho con el de la lámina estándar", t[[3]])) }

# Combinaciones recomendadas
SEC <- "comb"
comb <- list(list("Dicotómica y su subpregunta", "La respuesta «Sí» abre la subpregunta con una llave. La subpregunta declara su base.", list(Gf(xS, y1, aw, 1.2), Gf(xS, 3.6, aw, 2.4))),
             list("Escala y ranking de mejoras", "La escala muestra cómo se evalúa y el ranking qué pedirían cambiar. Se leen de izquierda a derecha.", list(Gf(xS, y1, 7.9, h1), Gf(8.85, y1, xE - 8.85, h1))),
             list("Perfil y cifras", "Las cifras dicen cuántos y qué edad. Los gráficos, la composición del público.", list(Cf(xS, y1, 3.0, h1), Gf(3.9, y1, xE - 3.9, h2), Gf(3.9, y2, xE - 3.9, h2))),
             list("Tabla de letras y diferencias", "La tabla da las cifras y las letras. Los paneles dibujan cada diferencia con su intervalo.", list(Tf(xS, y1, 6.0, h1), Gf(6.9, y1, xE - 6.9, h1))),
             list("Mapa y tabla de cobertura", "El mapa ubica las zonas aplicadas. La tabla da cuántas por distrito.", list(Gf(xS, y1, 7.4, h1), Tf(8.35, y1, xE - 8.35, h1))),
             list("Serie y cifra del cambio", "La serie muestra la evolución. La cifra resume cuánto cambió desde la primera medición.", list(Gf(xS, y1, 8.6, h1), Cf(9.6, 2.2, xE - 9.6, 1.6))))
for (pg in 1:2) {
  MOTOR_ACT <- "Combinaciones recomendadas de gráficos en una lámina"
  doc <- nueva(doc); titulo(doc, sprintf("Combinaciones que funcionan (%d de 2)", pg), ante = "Tipos de láminas")
  k <- 0.27; gx <- (AC - 3 * W * k) / 2
  for (m in 1:3) { cb <- comb[[(pg - 1) * 3 + m]]; x0 <- XC + (m - 1) * (W * k + gx)
    esquema(doc, list(cb[[1]], "combinacion", "", cb[[3]]), x0, YT, k, etiquetas = FALSE)
    txt(doc, cb[[1]], x0 - 0.1, YT + H * k + 0.15, W * k + 0.2, 0.32, 14, TK$navy, bold = TRUE)
    txt(doc, cb[[2]], x0 - 0.1, YT + H * k + 0.5, W * k + 0.2, 0.9, 12, TK$soft) }
  pie(doc, "Los ejemplos completos están en este capítulo y en el capítulo 4") }
