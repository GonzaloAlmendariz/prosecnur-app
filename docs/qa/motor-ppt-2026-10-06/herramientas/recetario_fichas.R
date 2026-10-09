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
  list("Tres gráficos en tira", "p_slide_3_graficos_poblacion_tira", "poblacion_3_tira", list(Gf(xS, y1, aw, 1.4), Gf(xS, y1 + 1.6, aw, 1.4), Gf(xS, y1 + 3.2, aw, 1.4)), Mf("100 % de ancho, un tercio de alto", "14 pt", "12 pt", "0.30 in"), "Dicotómicas", "Tres preguntas de sí o no del mismo público"),
  list("Tres gráficos en corona", "p_slide_3_graficos_poblacion_corona", "poblacion_3_corona", list(Gf(xS, y1, w2, h2), Gf(xS, y2, w2, h2), Gf(x2, y1, w2, h1)), fam3, "Dicotómica, barras y rango de edad", "Perfil con una variable más larga"),
  list("Cuatro gráficos", "p_slide_4_graficos", "4_paneles", list(Gf(xS, y1, w2, h2), Gf(x2, y1, w2, h2), Gf(xS, y2, w2, h2), Gf(x2, y2, w2, h2)), fam3, "Barras cortas y dicotómicas", "Cuatro variables de perfil del mismo público"),
  list("Cinco gráficos", "p_slide_5_graficos_poblacion", "poblacion_5", list(Gf(xS, y1, w3, h2), Gf(xS + w3 + 0.5, y1, w3, h2), Gf(xS + 2 * (w3 + 0.5), y1, w3, h2), Gf(xS, y2, w2, h2), Gf(x2, y2, w2, h2)), famP, "Dicotómicas arriba, barras abajo", "Perfil del egresado o del docente en una lámina"),
  list("Seis gráficos", "p_slide_6_graficos_poblacion", "poblacion_6", list(Gf(xS, y1, w3, h2), Gf(xS + w3 + 0.5, y1, w3, h2), Gf(xS + 2 * (w3 + 0.5), y1, w3, h2), Gf(xS, y2, w3, h2), Gf(xS + w3 + 0.5, y2, w3, h2), Gf(xS + 2 * (w3 + 0.5), y2, w3, h2)), famP, "Dicotómicas y barras de pocas categorías", "El máximo de gráficos en una lámina"),
  list("Cifras en columna lateral", "p_slide_3_graficos_poblacion_cifras", "poblacion_3_cifras", list(Cf(xS, y1, 3.0, h1), Gf(3.9, y1, 4.4, h2), Gf(3.9, y2, 4.4, h2), Gf(8.75, y1, xE - 8.75, h1)), famP, "Cifras destacadas, dicotómicas y barras", "Cuando el tamaño de la muestra y la edad se dicen en cifras"),
  list("Cifras en banda superior", "p_slide_cifras_y_graficos", "cifras_y_graficos", list(Cf(xS, y1, aw, 1.2), Gf(xS, 3.05, w2, 3.2), Gf(x2, 3.05, w2, 3.2)), fam2, "Cifras destacadas, escalas y barras", "Abrir un capítulo o resumir el estudio"))

# Esquema de un tipo, fiel a la lámina nueva (X5, 2026-10-08: «los elementos salen de sus cuadrículas… estamos proponiendo nuevos estilos con borde
# gris suave para gráficos»): fondo de la plantilla, logo real, barra y título, cada gráfico en un panel blanco con borde gris suave y barras de
# muestra dentro, cada texto con su filete coral, y todo recortado a su propia caja.
esquema <- function(doc, t, x0, y0, k, etiquetas = TRUE) {
  caja(doc, x0, y0, W * k, H * k, TK$fondo, line = sp_line(color = TK$rule, lwd = 0.75))
  invisible(ph_with(doc, external_img(LOGO_LAM, width = 2.11 * k, height = 0.93 * k), location = ph_location(left = x0 + 11.03 * k, top = y0 + 0.18 * k, width = 2.11 * k, height = 0.93 * k)))
  caja(doc, x0 + ML0 * k, y0 + (Y_TIT - 0.12) * k, max(0.02, 0.05 * k), 0.72 * k, TK$navy)
  caja(doc, x0 + ML * k, y0 + (Y_TIT - 0.1) * k, 2.4 * k, 0.09 * k, TK$faint); caja(doc, x0 + ML * k, y0 + (Y_TIT + 0.14) * k, 5.0 * k, 0.2 * k, TK$coral)
  caja(doc, x0 + ML * k, y0 + (Y_BASE + 0.06) * k, 3.2 * k, 0.08 * k, TK$navy)
  for (zz in t[[4]]) { xx <- x0 + zz$x * k; yy <- y0 + zz$y * k; ww <- zz$w * k; hh <- zz$h * k; p <- max(0.04, 0.14 * k)
    if (zz$tipo == "g") {
      caja(doc, xx, yy, ww, hh, "#FFFFFF", line = sp_line(color = "#D5D9DF", lwd = 0.5))
      caja(doc, xx + p, yy + p, min(ww - 2 * p, 1.6 * k + 0.2), max(0.02, 0.07 * k), TK$navy)   # título del panel
      nb <- max(2, min(5, floor((hh - 2.5 * p) / max(0.12, 0.42 * k)))); fila <- (hh - 2.6 * p) / nb; gb <- min(fila * 0.55, 0.3 * k + 0.02)
      wl <- (ww - 2 * p) * 0.22; wbmax <- ww - 2 * p - wl - p
      for (b in seq_len(nb)) { yb <- yy + 2 * p + (b - 1) * fila + (fila - gb) / 2
        caja(doc, xx + p, yb + gb / 2 - 0.006, wl * 0.8, 0.012, TK$faint)
        caja(doc, xx + p + wl, yb, wbmax * c(0.92, 0.7, 0.55, 0.78, 0.4)[b], gb, if (b == 1) TK$navy else TK$tenue) }
      if (etiquetas && ww > 1.0) txt(doc, sprintf("%.1f × %.1f in", zz$w, zz$h), xx, yy + p - 0.07, ww - p + 0.08, 0.22, if (k > 0.3) 8.5 else 7, TK$soft, align = "right") }   # arriba, junto al título del panel
    if (zz$tipo == "t") {
      caja(doc, xx, yy + p, max(0.015, 0.035 * k), hh - 2 * p, TK$coral)
      nl <- max(2, min(5, floor((hh - 2 * p) / max(0.1, 0.32 * k)))); paso <- (hh - 2 * p) / nl
      for (j in seq_len(nl)) caja(doc, xx + p + 0.04, yy + p + (j - 1) * paso + paso * 0.35, (ww - 2 * p) * c(1, 0.92, 0.96, 0.7, 0.85)[j], max(0.015, 0.05 * k), TK$faint) }
    if (zz$tipo == "c") {
      n_ <- if (zz$w > zz$h * 2) 3 else max(1, min(3, floor(zz$h / 1.4))); horiz <- zz$w > zz$h * 2
      for (j in seq_len(n_)) { cx <- if (horiz) xx + (j - 1) * ww / n_ else xx; cy <- if (horiz) yy else yy + (j - 1) * hh / n_
        cw <- if (horiz) ww / n_ else ww; ch <- if (horiz) hh else hh / n_
        caja(doc, cx + p, cy + p, min(cw - 2 * p, 0.9 * k + 0.1), min(ch * 0.35, 0.4 * k + 0.05), TK$navy)
        caja(doc, cx + p, cy + p + min(ch * 0.35, 0.4 * k + 0.05) + 0.03, min(cw - 2 * p, 1.4 * k + 0.1), max(0.015, 0.06 * k), TK$faint) } } } }

# 1 y 2. Catálogo: los tipos de lámina en miniatura
NT <- length(TIPOS); grupos_cat <- list(1:12, 13:NT)
for (pg in seq_along(grupos_cat)) {
  MOTOR_ACT <- "Catálogo de los tipos de lámina del motor"
  doc <- nueva(doc); titulo(doc, sprintf("Los %d tipos de lámina (%d de 2)", NT, pg), ante = "Catálogo de láminas")
  idx <- grupos_cat[[pg]]; k <- 0.17; gx <- (AC - 4 * W * k) / 3
  for (m in seq_along(idx)) { t <- TIPOS[[idx[m]]]; cc <- (m - 1) %% 4; rr <- (m - 1) %/% 4
    x0 <- XC + cc * (W * k + gx); y0 <- YT - 0.1 + rr * (H * k + 0.42)
    esquema(doc, t, x0, y0, k, etiquetas = FALSE)
    txt(doc, sprintf("%d. %s", idx[m], t[[1]]), x0 - 0.1, y0 + H * k + 0.02, W * k + 0.2, 0.3, 10, TK$navy, bold = TRUE) }
  pie(doc, "Cada tipo es un constructor del motor con su layout en la plantilla. Cualquiera admite el ícono del público junto al título") }

# 3 a 24. Una ficha por tipo
for (i in seq_along(TIPOS)) { t <- TIPOS[[i]]
  MOTOR_ACT <- paste0(t[[2]], " (layout «", t[[3]], "»)")
  doc <- nueva(doc); titulo(doc, t[[1]], ante = sprintf("Tipo de lámina %d de %d", i, NT))
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
  pie(doc, sprintf("Layout «%s» de la plantilla. Medidas del panel en pulgadas. La escala compara su ancho con el de la lámina estándar", t[[3]])) }

# Ejemplos que faltaban (X7 y X10): texto, tres en fila y cifra en lugar de un gráfico. Claves «ej:n»
SEC <- "ej"
MOTOR_ACT <- "p_slide_texto"
doc <- nueva(doc); titulo(doc, "Nota sobre la lectura de los resultados", ante = "Texto")
notas_t <- list(c("Muestra", "La encuesta se aplicó con intención censal. Los resultados describen a quienes respondieron en cada público."),
                c("Bases chicas", "Los públicos con menos de 30 casos se leen en frecuencias («12 de 15») y no se comparan con pruebas de significancia."),
                c("Comparación con 2021", "Sólo se comparan las preguntas que mantienen su redacción y su escala entre ambos procesos."))
for (k in seq_along(notas_t)) { yk <- YT + (k - 1) * 1.3; if (k > 1) separador_h(doc, XC, W - MR, yk - 0.2)
  txt(doc, notas_t[[k]][1], XT, yk, 3, 0.34, 15, TK$navy, bold = TRUE); txt(doc, notas_t[[k]][2], XC + 3.2, yk, AC - 3.2, 0.8, 14, TK$navy) }
pie(doc, "Lámina de texto: título y hasta tres bloques breves")
MOTOR_ACT <- "p_slide_3_graficos_fila"
doc <- nueva(doc); titulo(doc, "Perfil del docente", ante = "Tres gráficos en fila")
w3_ <- (AC - 2 * 0.45) / 3; xs_ <- XC + (0:2) * (w3_ + 0.45)
# Tres preguntas de cinco categorías que ocupan todo el alto de la lámina (Gonzalo, 2026-10-08: «se ve muy vacío en la mitad inferior»)
tres_ <- list(list("Rango de edad", c("Menos de 35 años", "35 a 44 años", "45 a 54 años", "55 a 64 años", "65 años a más"), c(8, 23, 31, 27, 11)),
              list("Categoría docente", c("Principal", "Asociado", "Auxiliar", "Contratado a tiempo completo", "Contratado por horas"), c(21, 29, 17, 13, 20)),
              list("Años de docencia en la carrera", c("Menos de 5", "5 a 9", "10 a 14", "15 a 19", "20 a más"), c(15, 21, 25, 17, 22)))
fila3_ <- min(0.8, (YF - 0.15 - (YT + 0.7)) / 5)
for (k in 1:3) { panel_titulo(doc, xs_[k], YT, w3_, tres_[[k]][[1]], "52 respuestas")
  barras_h(doc, xs_[k], YT + 0.7, w3_, tres_[[k]][[2]], tres_[[k]][[3]], wlab = 1.55, g = grosor_cat(5), fila = fila3_, size = 12) }
for (k in 2:3) separador_v(doc, xs_[k] - 0.225, YT, YF - 0.15)
pie(doc, "Cifras ficticias. Base: 52 docentes")
MOTOR_ACT <- "p_slide_4_graficos con una cifra destacada en lugar de un gráfico"
doc <- nueva(doc); titulo(doc, "Perfil del egresado", ante = "Cifra en lugar de un gráfico")
w2_ <- (AC - 0.5) / 2; xg_ <- c(XC, XC + w2_ + 0.5); yg_ <- c(YT, YT + 2.45)
panel_titulo(doc, xg_[1], yg_[1], w2_, "Sexo", paste(eg_sexo$valid, "respuestas")); dicotomia(doc, xg_[1], yg_[1] + 0.65, w2_, eg_sexo$labels[1:2], eg_sexo$pct[1:2], eg_sexo$n[1:2], size = 20, g = 0.3)
panel_titulo(doc, xg_[2], yg_[1], w2_, "¿Cuenta con título universitario?", paste(t1$valid, "respuestas")); dicotomia(doc, xg_[2], yg_[1] + 0.65, w2_, t1$labels[1:2], t1$pct[1:2], t1$n[1:2], size = 20, g = 0.3)
panel_titulo(doc, xg_[1], yg_[2], w2_, "¿Está trabajando actualmente?", paste(eg_trab$valid, "respuestas")); dicotomia(doc, xg_[1], yg_[2] + 0.65, w2_, eg_trab$labels[1:2], eg_trab$pct[1:2], eg_trab$n[1:2], size = 20, g = 0.3)
cifra(doc, xg_[2], yg_[2] + 0.2, w2_, "57 %", "obtuvo su título en 2025", sprintf("%d egresados titulados", D$anio$valid), size = 40)
separador_h(doc, XC, W - MR, yg_[2] - 0.2); separador_v(doc, xg_[2] - 0.25, YT, YF - 0.2)
pie(doc, "Base: 178 egresados. Un panel se resume en un número cuando la pregunta tiene una respuesta que domina")

# Combinaciones que funcionan (X12): un resumen y un ejemplo real de cada una. Claves «comb:n»
SEC <- "comb"
comb <- list(list("Dicotómica y su subpregunta", "La respuesta que habilita la subpregunta la abre con una llave.", list(Gf(xS, y1, aw, 1.2), Gf(xS, 3.6, aw, 2.4))),
             list("Escala y ranking", "La escala dice cómo se evalúa y el ranking qué cambiarían.", list(Gf(xS, y1, 7.9, h1), Gf(8.85, y1, xE - 8.85, h1))),
             list("Cifras y perfil", "Las cifras dicen cuántos y qué edad. Los gráficos, cómo es el público.", list(Cf(xS, y1, 3.0, h1), Gf(3.9, y1, xE - 3.9, h2), Gf(3.9, y2, xE - 3.9, h2))),
             list("Serie y cifra del cambio", "La serie muestra la evolución y la cifra cuánto cambió.", list(Gf(xS, y1, 8.6, h1), Cf(9.6, 2.2, xE - 9.6, 1.6))),
             list("Mapa y tabla de cobertura", "El mapa ubica las zonas y la tabla da cuántas por distrito.", list(Gf(xS, y1, 7.4, h1), Tf(8.35, y1, xE - 8.35, h1))),
             list("Tabla de letras y diferencias", "La tabla da cifras y letras. Los paneles dibujan cada diferencia (capítulo 2.8).", list(Tf(xS, y1, 6.0, h1), Gf(6.9, y1, xE - 6.9, h1))))
MOTOR_ACT <- "Combinaciones recomendadas de gráficos en una lámina"
doc <- nueva(doc); titulo(doc, "Combinaciones que funcionan", ante = "Tipos de láminas")
k <- 0.19; gx <- (AC - 3 * W * k) / 2
for (m in seq_along(comb)) { cb <- comb[[m]]; cc <- (m - 1) %% 3; rr <- (m - 1) %/% 3; x0 <- XC + cc * (W * k + gx); y0 <- YT - 0.1 + rr * (H * k + 0.95)
  esquema(doc, list(cb[[1]], "combinacion", "", cb[[3]]), x0, y0, k, etiquetas = FALSE)
  txt(doc, cb[[1]], x0 - 0.1, y0 + H * k + 0.05, W * k + 0.2, 0.3, 12.5, TK$navy, bold = TRUE); txt(doc, cb[[2]], x0 - 0.1, y0 + H * k + 0.33, W * k + 0.2, 0.5, 10.5, TK$soft) }
pie(doc, "Las láminas siguientes muestran cada combinación con datos")
sfc <- function(pct, valid) list(pct = pct, n = round(pct * valid / 100), valid = valid)
# 1. dicotómica y subpregunta
MOTOR_ACT <- "Combinación: dicotómica y su subpregunta con llave"
doc <- nueva(doc); titulo(doc, "Prácticas preprofesionales y su utilidad", ante = "Combinación: dicotómica y su subpregunta")
panel_titulo(doc, XC, YT, AC, "¿Realizó prácticas preprofesionales durante la carrera?", "178 egresados")
wlc <- 1.6; xbc <- XC + wlc + 0.12; wbc <- AC - wlc - 0.12 - 1.1   # dos gráficos apilados normales, del mismo tamaño
ybf <- dicotomia(doc, xbc, YT + 0.55, wbc, c("Sí", "No"), c(64, 36), n = c(114, 64), size = 26, g = 0.42)
y2c <- ybf + 0.75; llave_baja_a_titulo(doc, xbc, xbc + wbc * 0.64, ybf + 0.06, XC, y2c, "Las prácticas me prepararon para el trabajo")
panel_titulo(doc, XC, y2c, AC, "Las prácticas me prepararon para el trabajo", "Sólo los 114 que hicieron prácticas")
likert_panel(doc, XC, y2c + 0.45, AC, list(list(lab = "Hicieron prácticas", f = sfc(c(4, 9, 49, 36, 2), 114))), g = 0.42, fila = 0.8, wlab = wlc, size_lab = 12)
leyenda(doc, 0, Y_LEY - 0.05, LIKERT_ROT, TK$likert, centrar_en = W / 2)
pie(doc, "Base: 178 egresados. La subpregunta, 114 que hicieron prácticas")
# 2. escala y ranking
MOTOR_ACT <- "Combinación: escala con Top Two Box y ranking (p_slide_2_graficos_asimetrico)"
doc <- nueva(doc); titulo(doc, "Valoración y mejoras de la infraestructura", ante = "Combinación: escala y ranking")
txt(doc, "¿Qué tan satisfecho está con…?", XT, YT - 0.05, 7.6, 0.3, 13, TK$navy, bold = TRUE)
likert_panel(doc, XC, YT + 0.3, 7.6, list(list(lab = "Biblioteca", f = sfc(c(2, 8, 50, 39, 1), 1234)), list(lab = "Aulas", f = sfc(c(3, 12, 58, 26, 1), 1234)),
  list(lab = "Laboratorios", f = sfc(c(4, 16, 52, 26, 2), 1234)), list(lab = "Wifi", f = sfc(c(9, 27, 44, 18, 2), 1234))), g = 0.36, fila = 0.72, wlab = 1.4, size_lab = 12)
leyenda(doc, 0, YT + 3.5, c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho", "Sin información"), TK$likert, centrar_en = XC + 3.8)
separador_v(doc, XC + 8.0, YT, YF - 0.2)
panel_titulo(doc, XC + 8.3, YT, W - MR - XC - 8.3, "Lo primero que mejoraría", "Una opción, 1,234 estudiantes")
barras_h(doc, XC + 8.3, YT + 0.6, W - MR - XC - 8.3, c("Wifi", "Laboratorios", "Aulas", "Biblioteca", "Otros"), c(41, 27, 18, 9, 5), wlab = 1.3, g = 0.3, fila = 0.6, size = 12, escala = 50)
pie(doc, "Base: 1,234 estudiantes. Cifras ficticias")
# 3. cifras y perfil
MOTOR_ACT <- "Combinación: cifras en columna lateral y perfil (p_slide_3_graficos_poblacion_cifras)"
doc <- nueva(doc); titulo(doc, "Perfil del docente en cifras", ante = "Combinación: cifras y perfil")
cifra(doc, XC, YT + 0.1, 3.0, "52", "docentes", "92 % de respuesta"); separador_h(doc, XC, XC + 3.0, YT + 1.5)
cifra(doc, XC, YT + 1.8, 3.0, "73 %", "con grado de magíster", "8 % con doctorado")
separador_v(doc, XC + 3.35, YT, YF - 0.2); xg3 <- XC + 3.7; wg3 <- W - MR - xg3
panel_titulo(doc, xg3, YT, wg3, "Departamento académico", "52 respuestas"); barras_h(doc, xg3, YT + 0.6, wg3, sub("Departamento de ", "", do_dep$labels), do_dep$pct, wlab = 2.4, g = 0.26, fila = 0.42, size = 11.5)
separador_h(doc, xg3, W - MR, YT + 2.45)
panel_titulo(doc, xg3, YT + 2.6, wg3, "Rango de edades", "52 respuestas"); barras_h(doc, xg3, YT + 3.2, wg3, do_ed$labels, do_ed$pct, wlab = 2.4, g = 0.24, fila = 0.36, size = 11)
pie(doc, "Base: 52 docentes")
# 4. serie y cifra del cambio
MOTOR_ACT <- "Combinación: serie de mediciones y cifra del cambio"
doc <- nueva(doc); titulo(doc, "Tutoría académica en cuatro procesos", ante = "Combinación: serie y cifra del cambio")
gsc <- grafico_serie(c("2012", "2016", "2021", "2026"), list(Docentes = c(88, 93, 98, 83), Estudiantes = c(71, 79, 84, 53)), unname(TK$actores[c("Docentes", "Estudiantes")]) |> setNames(c("Docentes", "Estudiantes")), lim = c(40, 100))
invisible(ph_with(doc, dml(ggobj = gsc, bg = "transparent", fonts = list(sans = "Arial")), location = ph_location(left = XC, top = YT + 0.1, width = 8.4, height = 4.5)))
txt(doc, "Top Two Box", XT, YT - 0.25, 3, 0.26, 10, TK$soft, bold = TRUE); separador_v(doc, XC + 8.75, YT, YF - 0.2)
cifra(doc, XC + 9.1, YT + 0.4, W - MR - XC - 9.1, "-31", "puntos entre estudiantes desde 2021", "de 84 % a 53 %", size = 40)
cifra(doc, XC + 9.1, YT + 2.2, W - MR - XC - 9.1, "-15", "puntos entre docentes", "de 98 % a 83 %", size = 40)
pie(doc, "Base: docentes y estudiantes de cada proceso")
# 5. mapa y tabla de cobertura
MOTOR_ACT <- "Combinación: mapa de distritos y tabla de cobertura"
doc <- nueva(doc); titulo(doc, "Cobertura del estudio por distrito", ante = "Combinación: mapa y tabla de cobertura")
LIMA$fill <- ifelse(LIMA$distrito %in% names(grupo), pal_grupo[grupo[LIMA$distrito]], GRIS_FUERA)
poner_mapa(tema_mapa(ggplot() + geom_sf(data = LIMA, aes(fill = fill), colour = "#FFFFFF", linewidth = 0.35) + scale_fill_identity()), XC + 0.3, YT, 4.6, YF - YT - 0.45)
leyenda(doc, 0, YF - 0.35, c("Intervención", "Comparación"), unname(pal_grupo), centrar_en = XC + 0.3 + 2.3)
xt5 <- XC + 5.6; separador_v(doc, xt5 - 0.35, YT, YF - 0.2)
cob <- data.frame(d = c("San Juan de Lurigancho", "Ate", "El Agustino", "Santa Anita", "Villa El Salvador", "Villa María del Triunfo", "San Juan de Miraflores", "Chorrillos"),
                  g = rep(c("Intervención", "Comparación"), each = 4), z = c(27, 15, 9, 8, 18, 14, 11, 7), e = c(412, 236, 140, 121, 280, 214, 168, 109))
txt(doc, "Distrito", xt5 - 0.1, YT - 0.05, 3, 0.26, 10.5, TK$soft, bold = TRUE); txt(doc, "Zonas", xt5 + 3.6, YT - 0.05, 1.2, 0.26, 10.5, TK$soft, bold = TRUE, align = "center")
txt(doc, "Encuestas", xt5 + 4.9, YT - 0.05, 1.4, 0.26, 10.5, TK$soft, bold = TRUE, align = "center")
for (r in seq_len(nrow(cob))) { yr <- YT + 0.32 + (r - 1) * 0.47; separador_h(doc, xt5, W - MR, yr - 0.06)
  caja(doc, xt5, yr + 0.08, 0.14, 0.14, pal_grupo[[cob$g[r]]]); txt(doc, cob$d[r], xt5 + 0.18, yr, 3.4, 0.3, 12, TK$navy, bold = TRUE)
  txt(doc, cob$z[r], xt5 + 3.6, yr, 1.2, 0.3, 12, TK$navy, align = "center"); txt(doc, format(cob$e[r], big.mark = ","), xt5 + 4.9, yr, 1.4, 0.3, 12, TK$navy, align = "center") }
pie(doc, "Selección ficticia sobre la cartografía de Lima Metropolitana (IMP PlanMet 2040)")
