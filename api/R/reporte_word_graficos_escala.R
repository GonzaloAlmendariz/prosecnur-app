# =============================================================================
# reporte_word_graficos_escala.R — la escala apilada del Word del recetario, desde la espec (N8.6; ADR 0093)
# =============================================================================
#
# Porta `g_apilada()` (recetario_word_graficos.R:39-76): barras de grosor 0.58 de la fila, cifra dentro sólo si el
# segmento la contiene (≥ 7 %), las chicas encima con su guía en codo, la columna Top Two Box en verde a la derecha (y
# Bottom Two Box en naranja si se pide, en su propia columna: `.word_columnas_box()`), un filete bajo la fila Total y la
# leyenda abajo. Lee la espec `escala/1`: las cifras, los anchos y el box ya vienen resueltos (redondeo de las láminas
# 20-21, Top Two Box de la 19) y aquí no se recalcula nada.

#' Tamaño de texto de un geom en el Word: nada bajo 8 pt (`PT()` del recetario)
#'
#' ID6-b: con `rol` («cifra», «rotulo», «leyenda») el tamaño suma el paso de letra de Identidad › Letra que recibe su
#' token del estándar (`grafico_cifra`, `grafico_rotulo`, `grafico_leyenda`, `.word_desplazo`). En el paso «estándar» el
#' desplazamiento es cero y la figura sale con sus tamaños de siempre; antes el paso no llegaba a las figuras.
#' @keywords internal
.word_pt <- function(x, rol = NULL) max(.std_word("tipografia", "grafico_minimo"), (x + .word_desplazo(rol)) * 0.95) / ggplot2::.pt

#' Puntos que el paso de letra suma a un texto de figura Word de rol «cifra», «rotulo» o «leyenda» (0 sin rol o en «estándar»)
#' @keywords internal
.word_desplazo <- function(rol = NULL) {
  if (is.null(rol)) return(0)
  token <- c(cifra = "grafico_cifra", rotulo = "grafico_rotulo", leyenda = "grafico_leyenda")[[rol]]
  d <- ((getOption("prosecnur.letra_desplazo") %||% list())$word %||% numeric(0))[token]
  if (length(d) && is.finite(d)) unname(d) else 0
}

#' Margen izquierdo del eje según el rótulo más largo ya partido (`xmin_para()` del recetario)
#' @keywords internal
.word_xmin <- function(rotulos, pt, xmax, x0 = 0) {
  L <- .word_rotulo_in(rotulos, pt)
  x0 - L * (xmax - x0) / (.std_word("pagina", "ancho_util") - 0.3 - L)
}

#' Ancho en pulgadas que reserva `.word_xmin()` para el rótulo más largo
#' @keywords internal
.word_rotulo_in <- function(rotulos, pt) {
  lin <- unlist(strsplit(rotulos, "\n")); lin <- lin[!is.na(lin)]
  if (!length(lin)) 0.15 else min(max(nchar(lin)) * max(7.5, pt * 0.95) * 0.5 / 72 + 0.15, 3.3)   # sin rótulos, sin -Inf
}

#' Ancho en pulgadas de un texto en negrita Arial a `pt` puntos (métrica de Helvetica, la que usa el dispositivo PDF)
#' @keywords internal
.word_texto_in <- function(texto, pt) {
  texto <- as.character(texto); texto <- texto[!is.na(texto) & nzchar(texto)]
  if (!length(texto)) return(0)
  previo <- grDevices::dev.cur(); grDevices::pdf(NULL)   # mide sin tocar el dispositivo en el que se esté dibujando
  on.exit({ grDevices::dev.off(); if (previo > 1L) grDevices::dev.set(previo) }, add = TRUE)
  graphics::par(family = "sans", ps = 12)
  max(graphics::strwidth(texto, units = "inches", cex = pt / 12, font = 2L))
}

#' Columnas Top Two Box y Bottom Two Box del Word, en unidades del eje x
#'
#' Con una sola columna (Top Two Box) se dibuja como en el recetario Word: cifra y rótulo centrados en x = 110 y el eje
#' hasta 121 (figuras 13 y 47 de `propuesta-word.docx`). Con las dos, las posiciones fijas 110/124 del recetario Word
#' encimaban los rótulos y cortaban «Bottom Two Box» en el borde (la figura 45 los perdía por el alto del eje). Aquí
#' rige la geometría del recetario PPT (lámina 79 de `recetario-moderna.pptx`): cada columna tiene su ancho, el rótulo
#' va en una línea centrado sobre su cifra y la Bottom Two Box va a la derecha de la Top Two Box sin tocarla. Los
#' anchos se miden en pulgadas y se pasan al eje con la misma relación que usa `.word_xmin()`, así que no dependen del
#' largo de los rótulos de las filas.
#' @return list(x1, x2, xmax, filete): centro de cada columna (x2 = NA sin Bottom Two Box), límite derecho del eje y fin
#'   del filete de la fila Total.
#' @keywords internal
.word_columnas_box <- function(lbw, rotulos, cifras, pt_rotulo, pt_cifra, b2b = FALSE) {
  if (!isTRUE(b2b)) return(list(x1 = 110, x2 = NA_real_, xmax = 121, filete = 116))
  ancho <- function(i) max(.word_texto_in(rotulos[i], pt_rotulo), .word_texto_in(cifras[[i]], pt_cifra))
  w1 <- ancho(1L); w2 <- ancho(2L)
  aire <- 0.12; gap <- 0.16; pad <- 0.06                                            # pulgadas: tras la barra, entre columnas y al borde
  c_in <- aire + w1 + gap + w2 + pad
  util <- .std_word("pagina", "ancho_util") - 0.3 - .word_rotulo_in(lbw, .WORD_ESCALA_PT$rotulo_fila + .word_desplazo("rotulo"))       # lo que mide de x = -4 a xmax (`.word_xmin`)
  k <- 104 / max(util - c_in, 1)                                                     # unidades del eje por pulgada
  list(x1 = 100 + (aire + w1 / 2) * k, x2 = 100 + (aire + w1 + gap + w2 / 2) * k, xmax = 100 + c_in * k,
       filete = 100 + (c_in - pad) * k)
}

#' Rótulos de fila partidos a `envolver` caracteres; con una envoltura ancha (>= 30) ninguno pasa de `.WORD_ESCALA_LINEAS_MAX`
#' líneas mientras quepa ensanchándola hasta `.WORD_ESCALA_ENVOLTURA_MAX`. Nunca recorta texto.
#' @keywords internal
.word_escala_rotulos_envueltos <- function(rotulos, envolver) {
  parte <- function(w) vapply(rotulos, function(r) paste(strwrap(r, width = w), collapse = "\n"), "", USE.NAMES = FALSE)
  w <- envolver; lb <- parte(w)
  if (envolver < 30) return(lb)                                    # envolturas estrechas explícitas (p. ej. la guía «cómo leer») no se tocan
  lineas <- function(x) max(1L, vapply(strsplit(x, "\n"), length, 1L))
  while (lineas(lb) > .WORD_ESCALA_LINEAS_MAX && w < .WORD_ESCALA_ENVOLTURA_MAX) { w <- w + 2L; lb <- parte(w) }
  lb
}

#' Posición x de las cifras chicas de una fila (unidades de la escala 0-100 %), sin que sus cajas se toquen
#'
#' Como el PPT (`pos[k] <- max(pos[k], pos[k-1] + 0,46 in)`) pero midiendo en pulgadas: cada cifra queda al menos a
#' (mitad de su ancho + mitad del ancho de la anterior + `respiro`) de la anterior, corriéndose a la derecha; si la última
#' pasa de `tope` se fija ahí y las previas se corren a la izquierda. Solo posición: el codo de la guía parte del centro
#' real del segmento (`xm`) y llega a la cifra corrida.
#' @param xm centros de los segmentos chicos, ordenados.
#' @param ancho_in ancho en pulgadas de cada cifra.
#' @param k_in unidades del eje por pulgada.
#' @keywords internal
.word_escala_separar_chicas <- function(xm, ancho_in, k_in, tope, respiro = 0.06) {
  pos <- xm; n <- length(pos)
  if (n < 2L) return(pos)
  sep <- ((ancho_in[-1] + ancho_in[-n]) / 2 + respiro) * k_in
  for (j in 2:n) pos[j] <- max(pos[j], pos[j - 1] + sep[j - 1])
  if (pos[n] > tope) { pos[n] <- tope; for (j in (n - 1):1) pos[j] <- min(pos[j], pos[j + 1] - sep[j]) }
  pos
}

#' Gráfico Word de una escala apilada a partir de su espec
#' @return ggplot con atributos `alto` (in, ya sin el pie) y `filas`.
#' @keywords internal
.word_g_escala <- function(espec, envolver = .WORD_ESCALA_ENVOLTURA) {   # constantes: reporte_word_escala_fijados.R
  navy <- .std_word("colores", "titulos"); gris <- "#8A93A8"; filete <- .std_word("colores", "filete")
  verde <- .std_color("verde_top_two_box"); naranja <- "#B4541F"
  orden <- espec$orden$aplicado %||% seq_len(nrow(espec$filas))
  F <- espec$filas[orden, , drop = FALSE]; U <- espec$unidades[orden, , drop = FALSE]; A <- espec$anchos[orden, , drop = FALSE]
  Ci <- espec$cifras[orden, , drop = FALSE]; Dw <- espec$dibujar[orden, , drop = FALSE]
  cat <- espec$categorias; k <- nrow(cat); nf <- nrow(F)
  rot_fila <- ifelse(is.na(F$rotulo) | !nzchar(F$rotulo), "", F$rotulo)
  # «Casos junto al porcentaje»: el Word no lleva «N respuestas» por fila como la lámina; si el ajuste lo pide, el grupo
  # dice sus casos en el rótulo («Administrativos (14)»).
  nf_casos <- suppressWarnings(as.numeric(.espec_casos(F)))
  if (.casos_junto_muestra(.espec_casos(espec$filas), espec$casos_junto) && any(is.finite(nf_casos))) {
    con <- nzchar(rot_fila) & is.finite(nf_casos)
    rot_fila[con] <- sprintf("%s (%d)", rot_fila[con], as.integer(round(nf_casos[con])))
  }
  lbw <- .word_escala_rotulos_envueltos(rot_fila, envolver)
  hay_chicas <- any(A * 100 > 0 & A * 100 < .WORD_ESCALA_CABE_PCT & Dw)
  nl <- vapply(strsplit(lbw, "\n"), function(x) max(1L, length(x)), 1L)
  esp <- pmax(if (hay_chicas) 1.3 else 1, 0.55 + 0.34 * nl); tot <- sum(esp); ys <- tot - (cumsum(esp) - esp / 2) + 0.5
  grp <- .word_escala_grupos(F, esp, envolver = if (length(espec$box$cifras)) 60 else 80)   # W6: temas de «Un gráfico»
  if (!is.null(grp)) { ys <- grp$ys; tot <- grp$tot }
  d <- do.call(rbind, lapply(seq_len(nf), function(i) {
    p <- as.numeric(A[i, ]) * 100; x1 <- cumsum(p); x0 <- x1 - p
    data.frame(y = ys[i], cat = factor(cat$rotulo, levels = cat$rotulo), x0 = x0, x1 = x1, p = p, cifra = as.character(Ci[i, ]),
               dibujar = as.logical(Dw[i, ]), stringsAsFactors = FALSE)
  }))
  d <- d[d$dibujar & d$p > 0, , drop = FALSE]
  d$cabe <- d$p >= .WORD_ESCALA_CABE_PCT; d$xm <- (d$x0 + d$x1) / 2
  ttb <- !is.null(espec$box) && length(espec$box$cifras)
  b2b <- ttb && !is.null(espec$box2) && length(espec$box2$cifras)
  pt_de <- function(x, rol) .word_pt(x, rol) * ggplot2::.pt
  col <- .word_columnas_box(lbw, c(espec$box$rotulo %||% "", espec$box2$rotulo %||% ""),
                            list(espec$box$cifras, espec$box2$cifras), pt_de(.WORD_ESCALA_PT$box_rotulo, "rotulo"), pt_de(.WORD_ESCALA_PT$box_cifra, "cifra"), b2b = b2b)
  xmax <- if (ttb) col$xmax else 101; xmin <- .word_xmin(lbw, .WORD_ESCALA_PT$rotulo_fila + .word_desplazo("rotulo"), xmax, -4)
  k_in <- (xmax - xmin) / (.std_word("pagina", "ancho_util") - 0.3)   # unidades del eje por pulgada de figura
  chicas <- d[!d$cabe, , drop = FALSE]
  if (nrow(chicas)) chicas <- do.call(rbind, lapply(split(chicas, chicas$y), function(g) {
    g <- g[order(g$xm), ]
    g$xl <- .word_escala_separar_chicas(g$xm, vapply(g$cifra, .word_texto_in, 0, pt = .word_escala_pt_efectivo("cifra_chica")), k_in, if (ttb) 96 else 99)
    g
  }))
  h <- .std_word("figura", "alto_apilada")$grosor_fraccion %||% 0.58
  cols <- stats::setNames(cat$color, cat$rotulo)
  g <- ggplot2::ggplot(d) +
    ggplot2::geom_rect(ggplot2::aes(xmin = .data$x0, xmax = .data$x1 + 0.05, ymin = .data$y - h / 2, ymax = .data$y + h / 2, fill = .data$cat)) +
    ggplot2::scale_fill_manual(values = cols, breaks = cat$rotulo[espec$leyenda %||% seq_len(k)], drop = FALSE) +
    ggplot2::geom_text(data = d[d$cabe, , drop = FALSE], ggplot2::aes(x = .data$xm, y = .data$y, label = .data$cifra),
                       size = .word_pt(.WORD_ESCALA_PT$cifra_dentro, "cifra"), fontface = .word_cara("cifras"), family = "Arial",
                       colour = vapply(cat$color[match(as.character(d$cat[d$cabe]), cat$rotulo)], .lam_texto_sobre, "")) +
    ggplot2::annotate("text", x = -4, y = ys, label = lbw, hjust = 1, size = .word_pt(.WORD_ESCALA_PT$rotulo_fila, "rotulo"), fontface = .word_cara("preguntas"), colour = navy, family = "Arial", lineheight = 0.9)
  if (nrow(chicas)) {
    g <- g + ggplot2::geom_segment(data = chicas, ggplot2::aes(x = .data$xm, xend = .data$xm, y = .data$y + h / 2, yend = .data$y + h / 2 + 0.07), colour = gris, linewidth = 0.3) +
      ggplot2::geom_segment(data = chicas, ggplot2::aes(x = .data$xm, xend = .data$xl, y = .data$y + h / 2 + 0.07, yend = .data$y + h / 2 + 0.07), colour = gris, linewidth = 0.3) +
      ggplot2::geom_text(data = chicas, ggplot2::aes(x = .data$xl, y = .data$y + h / 2 + 0.2, label = .data$cifra), size = .word_pt(.WORD_ESCALA_PT$cifra_chica, "cifra"), fontface = .word_cara("cifras"), colour = navy, family = "Arial")
  }
  y_tit <- max(ys) + h / 2 + (if (hay_chicas) 0.62 else 0.3)
  if (ttb) {
    g <- g + ggplot2::annotate("text", x = col$x1, y = ys, label = espec$box$cifras[orden], size = .word_pt(.WORD_ESCALA_PT$box_cifra, "cifra"), fontface = .word_cara("box"), colour = verde, family = "Arial") +
      ggplot2::annotate("text", x = col$x1, y = y_tit, label = espec$box$rotulo, size = .word_pt(.WORD_ESCALA_PT$box_rotulo, "rotulo"), fontface = .word_cara("box"), colour = verde, family = "Arial")
    if (b2b) g <- g + ggplot2::annotate("text", x = col$x2, y = ys, label = espec$box2$cifras[orden], size = .word_pt(.WORD_ESCALA_PT$box_cifra, "cifra"), fontface = .word_cara("box"), colour = naranja, family = "Arial") +
      ggplot2::annotate("text", x = col$x2, y = y_tit, label = espec$box2$rotulo, size = .word_pt(.WORD_ESCALA_PT$box_rotulo, "rotulo"), fontface = .word_cara("box"), colour = naranja, family = "Arial")
  }
  attr_cols <- if (ttb) col[c("x1", "x2", "xmax")] else NULL
  if (isTRUE(F$es_total[1]) && nf > 1) {   # desde el borde del eje: con rótulos cortos, −30 del recetario quedaba fuera
    g <- g + ggplot2::annotate("segment", x = max(-30, xmin), xend = if (ttb) col$filete else 116, y = (ys[1] + ys[2]) / 2, yend = (ys[1] + ys[2]) / 2, colour = filete, linewidth = 0.5)
  }
  if (!is.null(grp)) g <- g + ggplot2::annotate("text", x = xmin, y = grp$cabeceras$y, label = grp$cabeceras$texto, hjust = 0, size = .word_pt(.WORD_ESCALA_PT$rotulo_fila, "rotulo"), fontface = "bold", colour = navy, family = "Arial", lineheight = 0.9)
  size_ley <- .WORD_ESCALA_PT$leyenda + .word_desplazo("leyenda")
  plan_ley <- .leyenda_avisar(.word_leyenda_plan(cat$rotulo[espec$leyenda %||% seq_len(k)], size_ley))
  size_ley <- plan_ley$size
  g <- g + ggplot2::scale_x_continuous(limits = c(xmin, xmax), expand = c(0, 0)) +
    ggplot2::scale_y_continuous(limits = c(0.45, max(tot + 0.75, y_tit + 0.15)), expand = c(0, 0)) +   # el rótulo del box no se cae del eje
    ggplot2::theme_void(base_family = "Arial") +
    ggplot2::theme(plot.background = ggplot2::element_blank(), panel.background = ggplot2::element_blank(), plot.margin = ggplot2::margin(6, 6, 4, 6),
                   legend.position = "bottom", legend.title = ggplot2::element_blank(),
                   legend.text = ggplot2::element_text(size = size_ley, colour = navy, face = .word_cara("leyenda", FALSE)),
                   legend.key.size = ggplot2::unit(.WORD_ESCALA_PT$leyenda_clave, "pt")) +
    .word_leyenda_ajuste(plan_ley, "fill") +   # filas medidas contra el ancho de la figura, en orden de lectura (O8b)
    ggplot2::coord_cartesian(clip = "off")
  attr(g, "filas") <- tot
  attr(g, "columnas_box") <- attr_cols   # centros y borde del eje: el contrato de no encimado los lee
  g <- .word_fijar_alto_por_grosor(g, h)   # N25: la barra mide .WORD_GROSOR_BARRA_CM; la leyenda de 3 filas ya cuenta en lo fijo
  attr(g, "leyenda_plan") <- plan_ley
  g
}
