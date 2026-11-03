# Lámina de pregunta filtro y subpregunta (recetario p192–p194, recetario_m4.R:82-148): los dos gráficos normales y, al
# costado, una llave que sale de lo que habilita la subpregunta y llega a su título; con la subpregunta debajo de la
# dicotomía no hay llave (G15, Arte 2026-10-28). El render lo arma graficos_filtro_subpregunta.R.

#' Llave vertical al costado de [y0, y1] que sale en horizontal y sube o baja hasta el título (recetario_piezas.R:92)
#' @keywords internal
.lam_llave_a_titulo <- function(lz, x, y0, y1, x_titulo, y_titulo, color = .std_color("azul"), t = 0.022) {
  xt <- x_titulo - 0.22
  .lam_caja(lz, x, y0, 0.1, t, color, nombre = "llave"); .lam_caja(lz, x, y1 - t, 0.1, t, color, nombre = "llave")
  .lam_caja(lz, x + 0.1 - t, y0, t, y1 - y0, color, nombre = "llave")
  yc <- (y0 + y1) / 2
  .lam_caja(lz, x + 0.1 - t, yc - t / 2, xt - x - 0.1 + t, t, color, nombre = "llave")
  yt <- y_titulo + 0.16
  .lam_caja(lz, xt, min(yc, yt), t, abs(yc - yt) + t, color, nombre = "llave")
  .lam_caja(lz, xt, yt - t / 2, x_titulo - 0.06 - xt, t, color, nombre = "llave")
  invisible(yt)
}

#' «Sólo los 20 estudiantes que respondieron «Sí»»: la base del dependiente dicha con lo que lo habilita
#'
#' Como el recetario (p192–p194): con el público de la lámina («20 estudiantes») y, si el analista dijo quiénes son
#' (`espec$frase`, «que trabajan»), con sus palabras: «Sólo los 139 que trabajan».
#' @keywords internal
.lam_filtro_sub_base <- function(espec) {
  n <- espec$n_sub
  cuantos <- if (length(n) && is.finite(n)) format(as.integer(n), big.mark = ",") else ""
  quienes <- espec$frase %||% sprintf("que respondieron %s",
                                      paste0("«", espec$habilita, "»", collapse = if (length(espec$habilita) > 2) ", " else " o "))
  if (!nzchar(cuantos)) return(sprintf("Sólo quienes %s", sub("^que\\s+", "", quienes)))
  unidad <- espec$unidad_n %||% "respuestas"
  publico <- if (is.null(espec$frase) && !identical(unidad, "respuestas")) paste0(" ", unidad) else ""
  trimws(sprintf("Sólo los %s%s %s", cuantos, publico, quienes))
}

#' Base del dependiente por debajo de la cual sus cifras se leen como referenciales (plan de análisis CCSS 2026, sección 7)
#' @keywords internal
.LAM_FILTRO_SUB_BASE_MINIMA <- 30L

#' El pie con las dos bases: «Base: 201 estudiantes. Sólo los 20 que respondieron «Sí». Fuente: …»
#'
#' La base del dependiente va antes de la fuente, que cierra el pie, y todo termina en punto (CCSS 2026, M1 y B15: el pie
#' decía «… Fuente: PULSO PUCP 2026. Sólo los 96 que respondieron…», sin punto final). Con menos de
#' `.LAM_FILTRO_SUB_BASE_MINIMA` casos el pie lo advierte (M3).
#' @keywords internal
.lam_filtro_sub_pie <- function(base, espec) {
  # PPT 23 (Renzo, v3): «Sólo los 77 que conocen el reglamento», una vez y sin «La subpregunta,» delante.
  b <- if (!is.null(base) && nzchar(trimws(base))) sub("\\.\\s*$", "", trimws(base)) else ""
  corte <- regexpr("\\.\\s+Fuente:", b)
  cuerpo <- if (corte > 0) substr(b, 1, corte - 1) else b
  fuente <- if (corte > 0) trimws(substring(b, corte + 1)) else ""
  n <- suppressWarnings(as.numeric(espec$n_sub)[1])
  aviso <- if (length(n) && is.finite(n) && n < .LAM_FILTRO_SUB_BASE_MINIMA) "Base menor de 30 casos: cifras referenciales"
  partes <- c(if (nzchar(cuerpo)) cuerpo, .lam_filtro_sub_base(espec), aviso, if (nzchar(fuente)) fuente)
  paste0(paste(partes, collapse = ". "), ".")
}

#' La dicotomía del filtro con sus casos en el rótulo («Sí (20)»): son la base del dependiente (recetario p192–p193)
#' @keywords internal
.lam_filtro_sub_dico <- function(f) {
  d <- .lam_dicotomia_datos(f)
  if (is.null(d$n) && identical(f$tipo, "categorica")) d$n <- .espec_casos(f)
  d
}

#' ¿Cabe? Filtro de hasta 7 respuestas con alguna que habilita; subpregunta en barras de hasta 8 o una escala de una fila
#' @keywords internal
.lam_filtro_sub_cabe <- function(espec) isTRUE(.lam_filtro_sub_cabe_filtro(espec)) && isTRUE(.lam_filtro_sub_cabe_sub(espec$sub))

#' ¿El gráfico del que depende tiene pieza nativa? Categórica de 2 a 7 respuestas o torta/dona de 2 a 5, con algo que habilita
#' @keywords internal
.lam_filtro_sub_cabe_filtro <- function(espec) {
  f <- espec$filtro
  if (is.null(f) || !(f$tipo %in% c("categorica", "pie")) || !length(espec$habilita)) return(FALSE)
  length(f$rotulos) >= 2L && length(f$rotulos) <= (if (identical(f$tipo, "pie")) 5L else 7L)
}

#' Alto que pide una batería de preguntas en el likert compacto: encabezado, filas con aire para las cifras chicas y leyenda
#' @keywords internal
.lam_filtro_sub_alto_bateria <- function(s) {
  n <- NROW(s$filas); 0.4 + n * (0.26 + .std_geom("aire_cifra_chica")) + 0.4
}

#' ¿El dependiente tiene pieza nativa? Barras de hasta 8 o una escala de hasta 8 filas (F2: una batería de preguntas)
#' @keywords internal
.lam_filtro_sub_cabe_sub <- function(s) {
  if (is.null(s)) return(FALSE)
  if (identical(s$tipo, "categorica")) return(length(s$rotulos) >= 1L && length(s$rotulos) <= 8L)
  if (.lam_filtro_sub_es_mapa(s)) return(TRUE)   # el mapa dependiente tiene su propia lámina (lamina_filtro_mapa.R)
  identical(s$tipo, "escala") && NROW(s$filas) >= 1L && NROW(s$filas) <= 8L
}

#' Columna de la barra de una escala dependiente de una fila: después de su rótulo y antes de su columna Top Two Box
#'
#' La barra del filtro (arriba) usa la misma columna: las dos miden y arrancan igual (PPT 23, Renzo v3).
#' @keywords internal
.lam_filtro_sub_barra_geo <- function(s, rotulo, x, w) {
  wl <- if (!is.null(rotulo) && nzchar(rotulo)) min(w * 0.3, max(1, .lam_ancho_tinta(rotulo, 10.5, TRUE) + 0.2)) else 0
  wbox <- if (!is.null(s$box$unidades)) .std_comp("filtro", "columna_box") else 0
  list(x = x + wl, w = w - wl - wbox, wl = wl, wbox = wbox)
}

#' Alto máximo (in) de la fila de una barra del filtro o del dependiente: con pocas respuestas, las filas llenan el alto
#' @keywords internal
.LAM_FILTRO_SUB_FILA_MAX <- 1.0

#' La subpregunta en su caja: barras de una serie o una escala al 100 % con su leyenda debajo
#' @keywords internal
#'
#' Gonzalo (2026-10-14): «el gráfico dependiente no debe verse más pequeño del que depende». La subpregunta llena su
#' columna: filas de hasta 0.75 in con barras gruesas; la escala de una fila, en una barra de 0.8 in con su leyenda en el
#' ancho de la columna y, si se le da `yc`, centrada a esa altura (la del disco del filtro, de donde sale el conector).
.lam_filtro_sub_dibujar_sub <- function(lz, s, x, y, w, alto, yc = NULL, rotulo = NULL, centro_ley = NULL, lim_ley = NULL, n_encima = NULL) {
  if (identical(s$tipo, "categorica")) {
    # Las filas se reparten en todo el alto de la columna (Gonzalo, 2026-11-03: «el gráfico que depende de otra pregunta
    # no usa todo su alto»); el techo de 1 in por fila y el de 0.42 in de grosor evitan barras que parezcan bloques.
    k <- length(s$rotulos); fila <- min(.LAM_FILTRO_SUB_FILA_MAX, alto / max(1L, k)); g <- min(0.42, max(.std_grosor(k, "categorias"), fila * 0.55))
    return(.lam_barras_h(lz, s, x, y, w, wlab = min(2.5, w * 0.4), g = g, fila = fila, size = 12))
  }
  if (NROW(s$filas) > 1L) {
    # F2: una batería de preguntas con la misma base (multiapiladas): el likert compacto de las láminas mixtas, con su
    # leyenda debajo, en el ancho del dependiente.
    filas <- s$orden$aplicado %||% seq_len(NROW(s$filas)); n <- length(filas)
    rot <- s$filas$rotulo[filas]
    wlab <- min(w * 0.42, max(1.4, max(.lam_ancho_tinta(rot, 10.5, TRUE)) / 2 + 0.3))
    fila <- min(0.75, (alto - 0.75) / n); g <- max(0.26, round(fila * 0.55, 2))
    yy <- .lam_likert_panel(lz, s, x, y + 0.1, w, filas, g = g, fila = fila, wlab = wlab, size_lab = 10.5)
    ley <- s$leyenda
    return(invisible(.lam_leyenda_panel(lz, yy + 0.08, s$categorias$rotulo[ley], s$categorias$color[ley],
                                        centro = centro_ley %||% (x + wlab + (w - wlab) / 2), x0 = lim_ley[1] %||% x, x1 = lim_ley[2] %||% (x + w))))
  }
  h <- 0.8
  yb <- if (!is.null(yc)) max(y + 0.2, yc - h / 2) else y + 0.35
  # p192: el rótulo corto que escribió el analista («Participaron»), a la izquierda de la barra y en negrita.
  geo <- .lam_filtro_sub_barra_geo(s, rotulo, x, w)
  if (geo$wl > 0) {
    .lam_txt(lz, rotulo, x, yb + (h - 0.3) / 2, geo$wl - 0.15, 0.3, 10.5, .std_color("azul"), bold = TRUE, align = "right", nombre = "escala:rotulo_fila")
  }
  # F5: con Top Two Box declarada, su columna a la derecha de la barra con su rótulo encima (p192).
  x <- geo$x; wb <- geo$w; wbox <- geo$wbox
  desde <- length(lz$cajas)
  .lam_barra_apilada(lz, x, yb, wb, .lam_escala_seg(s, 1L), h)
  if (!is.null(n_encima)) .lam_n_encima_barra(lz, n_encima, x + wb, yb, desde = desde)   # G16: «N = 77» sobre el extremo derecho
  if (wbox > 0) {
    verde <- .std_color("verde_top_two_box")
    rot <- .lam_rotulo_box(s$box$rotulo %||% .PPT_ROTULO_TOP_TWO_BOX)
    # En una línea (a 12 pt «TOP TWO BOX» no cabe en la columna del filtro, 1,3 in, y la barra no cede: mide lo que la del filtro). La
    # caja crece, centrada sobre su cifra; lo que no pasa del margen derecho es la tinta, no la caja (invisible).
    tinta <- .lam_ancho_tinta(rot, .std_pt("rotulo_top_two_box"), TRUE)
    wr <- max(wbox - 0.05, tinta + 0.35)
    xc <- min(x + wb + 0.05 + (wbox - 0.05) / 2, .std_geom("ancho") - .std_geom("margen_der") - tinta / 2)
    xr <- xc - wr / 2
    .lam_txt(lz, rot, xr, yb - .std_comp("filtro", "rotulo_box_sobre"), wr, 0.26, .std_pt("rotulo_top_two_box"),
             verde, bold = TRUE, align = "center", nombre = "box:rotulo")
    .lam_etiqueta_box(lz, s, x + wb + 0.05, yb, h, 1L, con_n = FALSE, color = verde, w = wbox - 0.05)
  }
  ver <- which(as.logical(s$dibujar[1, ]))
  fin <- .lam_leyenda_panel(lz, yb + h + 0.25, s$categorias$rotulo[ver], s$categorias$color[ver],
                           centro = centro_ley %||% (x + wb / 2), x0 = lim_ley[1] %||% x, x1 = lim_ley[2] %||% (x + wb))
  invisible(fin)
}

#' Lámina de pregunta filtro y subpregunta
#' @keywords internal
.lam_laminas_filtro_sub <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL, unidad_n = "respuestas",
                                    layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  espec$unidad_n <- unidad_n
  if (.lam_filtro_sub_es_mapa(espec$sub) && !is.null(espec$filtro)) {
    return(.lam_laminas_filtro_mapa(doc, espec, titulo, ante = ante, base = base, folio = folio, sub = sub, layout = layout, master = master,
                                    por_lamina = por_lamina))
  }
  if (!isTRUE(.lam_filtro_sub_cabe_filtro(espec))) {
    return(.lam_laminas_filtro_sub_respaldo(doc, espec, titulo, ante = ante, base = base, folio = folio, sub = sub, unidad_n = unidad_n,
                                            layout = layout, master = master, por_lamina = por_lamina))
  }
  g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); mr <- g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1"); ancho <- W - ml - mr
  azul <- .std_color("azul"); tenue <- .std_color("tenue")
  f <- espec$filtro; s <- espec$sub
  dico <- .lam_es_dicotomia(f)
  # Sin título del dependiente (una batería sin título propio), su encabezado es su base: «Sólo los 126 que respondieron «Sí»».
  if (!nzchar(espec$pregunta_sub %||% "")) { espec$pregunta_sub <- .lam_filtro_sub_base(espec); espec$base_en_titulo <- TRUE }
  # Respaldo parcial: si sólo el dependiente no tiene pieza nativa, el filtro sigue nativo y el dependiente va con su gráfico.
  sub_nativo <- isTRUE(.lam_filtro_sub_cabe_sub(s)); imagen <- NULL
  dibujar_sub <- function(x, y, w, alto, yc = NULL, centro_ley = NULL, lim_ley = NULL, n_encima = NULL) {
    # Una batería que no cabe en su alto (con aire para sus cifras chicas) va con su gráfico, no se sale de la lámina.
    cabe_alto <- !(identical(s$tipo, "escala") && NROW(s$filas) > 1L) || alto >= .lam_filtro_sub_alto_bateria(s)
    if (sub_nativo && cabe_alto) return(.lam_filtro_sub_dibujar_sub(lz, s, x, y, w, alto, yc = yc, rotulo = espec$rotulo, centro_ley = centro_ley,
                                                                    lim_ley = lim_ley, n_encima = n_encima))
    imagen <<- c(x = x, y = y, w = w, h = alto); invisible(y + alto)
  }
  publico <- function(n) if (isTRUE(espec$mostrar_respuestas) && is.finite(n)) sprintf("%s %s", format(as.integer(n), big.mark = ","), unidad_n) else NULL
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()

  una_barra_c <- sub_nativo && identical(s$tipo, "escala") && NROW(s$filas) == 1L
  if (dico && identical(espec$disposicion, "abajo") && una_barra_c) {
    # La Sí/No y su escala de una barra van como Contabilidad: dos filas de escala del estándar (lamina_filtro_sub_conta.R).
    .lam_filtro_sub_como_conta(lz, espec, .lam_filtro_sub_dico(f), s, n_encima = if (!isTRUE(espec$base_en_titulo)) .lam_filtro_sub_n_texto(espec),
                               publico_f = publico(espec$n_filtro))
  } else if (dico && identical(espec$disposicion, "abajo")) {
    # p192: la dicotomía a todo el ancho y la subpregunta debajo. G15 (Gabriela, Arte 2026-10-28: «no es necesario el
    # corchete, se ve mal»): sin la llave que bajaba de lo que habilita al título; lo dice el «N = 77» y el pie.
    d <- .lam_filtro_sub_dico(f)
    wl <- 1.6; xb <- ml + wl + 0.12; wb <- ancho - wl - 0.12 - 1.1
    # PPT 23 (Renzo, v3): con la subpregunta en una barra de escala, las dos barras comparten columna (la del texto de las
    # demás láminas: margen + inset de 0,1 in) y ancho; la leyenda de abajo se centra en la lámina, no en su barra.
    una_barra <- sub_nativo && identical(s$tipo, "escala") && NROW(s$filas) == 1L
    xc <- ml + 0.1
    if (una_barra) { geo <- .lam_filtro_sub_barra_geo(s, espec$rotulo, xc, W - mr - xc); xb <- geo$x; wb <- geo$w }
    .lam_panel_titulo(lz, ml, yt, ancho, espec$pregunta_filtro, publico(espec$n_filtro))
    # F2: con una batería abajo, la dicotomía se compacta para dejarle el alto.
    bateria <- identical(s$tipo, "escala") && NROW(s$filas) > 1L
    yb_fin <- .lam_dicotomia(lz, xb, yt + 0.55, wb, d$rotulos, d$cifras, d$largos, d$n, size = .std_comp("filtro", if (bateria) "cifra_pt_bateria" else "cifra_pt"),
                             g = .std_comp("filtro", if (bateria) "grosor_bateria" else "grosor"), cols = d$colores)
    y2 <- yb_fin + .std_comp("filtro", if (bateria) "aire_sub_bateria" else "aire_sub")
    # G16 (Gabriela: «ese n 77 ahí no se lee, mejor como estaba antes, encima de la barra»): con la escala de una barra la
    # base va como «N = 77» sobre su extremo derecho (Contabilidad, lamina_filtro_sub_n.R), no en gris bajo la premisa.
    n_encima <- if (una_barra && !isTRUE(espec$base_en_titulo)) .lam_filtro_sub_n_texto(espec)
    base_sub <- if (isTRUE(espec$base_en_titulo) || !is.null(n_encima)) NULL else .lam_filtro_sub_base(espec)
    ys <- .lam_panel_titulo(lz, ml, y2, ancho, espec$pregunta_sub, base_sub)
    if (una_barra) dibujar_sub(xc, ys + 0.2, W - mr - xc, yf - ys - 0.4, centro_ley = W / 2, lim_ley = c(ml, W - mr), n_encima = n_encima)
    else dibujar_sub(ml, ys + 0.2, ancho, yf - ys - 0.4)
  } else {
    gap <- 0.6; col <- (ancho - gap) / 2; xr <- ml + col + gap
    y0 <- .lam_panel_titulo(lz, ml, yt, col, espec$pregunta_filtro, publico(espec$n_filtro)) + 0.25
    if (identical(f$tipo, "pie")) {
      # Como la columna de p193: el disco mide lo que la subpregunta (Gonzalo, 2026-10-14: «se ve muy vacío abajo»).
      alto_sub <- if (identical(s$tipo, "categorica")) length(s$rotulos) * min(0.75, (yf - y0 - 0.3) / max(1L, length(s$rotulos))) else 2.2
      circ <- .lam_filtro_sub_circular(lz, f, espec$habilita, ml, y0, col, yf - y0, xr, yt, alto_sub = alto_sub)
    } else if (dico) {
      # p193: la dicotomía en una columna al 100 %, del alto del gráfico vecino, con sus cifras a la izquierda.
      d <- .lam_filtro_sub_dico(f)
      hcol <- min(3.6, yf - y0 - 0.3); wcol <- 1.0; xcol <- ml + col - wcol - 1.3
      frac <- d$largos[1:2] / sum(d$largos[1:2]); yy <- y0; tramos <- list()
      for (k in 1:2) {
        hk <- hcol * frac[k]
        .lam_caja(lz, xcol, yy, wcol, hk + (if (k == 1) 0.004 else 0), d$colores[k], nombre = "dicotomia:segmento")
        yc <- yy + hk / 2
        .lam_txt(lz, d$cifras[k], xcol - 1.75, yc - 0.36, 1.6, 0.42, 22, azul, bold = TRUE, align = "right", nombre = "dicotomia:cifra")
        et <- if (!is.null(d$n) && is.finite(d$n[k])) sprintf("%s (%d)", d$rotulos[k], as.integer(d$n[k])) else d$rotulos[k]
        .lam_txt(lz, et, xcol - 1.75, yc + 0.04, 1.6, 0.26, 10.5, azul, align = "right", nombre = "dicotomia:rotulo")
        tramos[[k]] <- c(yy, yy + hk); yy <- yy + hk
      }
      hab <- which(d$rotulos %in% espec$habilita)
      .lam_llave_a_titulo(lz, xcol + wcol + 0.08, min(tramos[[hab[1]]]), max(tramos[[hab[length(hab)]]]), xr, yt)
    } else {
      # p194: el filtro en barras, las que habilitan en azul y el resto tenue; la llave las abraza.
      f2 <- f; f2$realce <- FALSE
      f2$colores <- stats::setNames(ifelse(f$rotulos %in% espec$habilita, azul, tenue), f$rotulos)
      k <- length(f$rotulos); fila <- min(.LAM_FILTRO_SUB_FILA_MAX, (yf - y0 - 0.3) / k); g <- min(0.36, fila * 0.6)
      .lam_barras_h(lz, f2, ml, y0, col - 0.45, wlab = min(2.5, col * 0.4), g = g, fila = fila, size = 12)
      hab <- which(f$rotulos %in% espec$habilita)
      .lam_llave_a_titulo(lz, ml + col - 0.35, y0 + (min(hab) - 1) * fila + (fila - g) / 2,
                          y0 + (max(hab) - 1) * fila + (fila + g) / 2, xr, yt)
    }
    ys <- .lam_panel_titulo(lz, xr, yt, col, espec$pregunta_sub, if (isTRUE(espec$base_en_titulo)) NULL else .lam_filtro_sub_base(espec)) + 0.25
    dibujar_sub(xr, ys, col, yf - ys - 0.3, yc = if (exists("circ", inherits = FALSE)) circ$cy)
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:filtro_sub")
  if (!is.null(imagen) && !is.null(espec$plot_sub)) {
    g <- tryCatch(espec$plot_sub + ggplot2::labs(title = NULL, subtitle = NULL, caption = NULL) +
                    ggplot2::theme(plot.caption = ggplot2::element_blank()), error = function(e) espec$plot_sub)
    doc <- officer::ph_with(doc, rvg::dml(ggobj = g, bg = "transparent", fonts = list(sans = .std_pt("fuente"))),
                            location = officer::ph_location(left = imagen[["x"]], top = imagen[["y"]], width = imagen[["w"]],
                                                            height = max(0.5, imagen[["h"]]), newlabel = "filtro_sub:respaldo"))
  }
  doc <- .lam_pie(doc, .lam_filtro_sub_pie(base, espec), folio)
  list(doc = por_lamina(doc), partes = 1L)
}


#' F1: el filtro dicotómico como torta o dona, como la columna de p193 (Gonzalo, 2026-10-14: «mantenerlo sólo para filtros
#' dicotómicos»): el disco mide lo que la subpregunta, las dos cifras grandes a su izquierda con su rótulo y sus casos, y lo
#' que habilita girado hacia la subpregunta (a las 3) con un conector hasta su título (el trazo de la llave).
#' @keywords internal
.lam_filtro_sub_circular <- function(lz, f, habilita, x, y0, w, alto, x_titulo, y_titulo, alto_sub = 2.2,
                                     color = .std_color("azul"), t = 0.022) {
  k <- length(f$valores); cols <- .lam_colores_pie(k, f); dona <- !identical(f$forma, "pie")
  d <- max(2.0, min(alto_sub, alto - 0.1, w * 0.5, 3.4)); r <- d / 2
  cx <- x + w - 0.45 - r; cy <- y0 + d / 2
  fr <- f$valores / sum(f$valores); acum <- c(0, cumsum(fr))
  hab <- which(f$rotulos %in% habilita)
  medio <- if (length(hab)) (acum[min(hab)] + acum[max(hab) + 1]) / 2 else 0
  giro <- 0.25 - medio   # el centro de lo que habilita, a las 3 (fracción 0.25 desde las 12, en sentido horario)
  for (i in seq_len(k)) if (fr[i] > 0) .lam_sector(lz, cx, cy, r, acum[i] + giro, acum[i + 1] + giro, cols[i], arco = dona, borde_pt = 1.2,
                                                   nombre = if (dona) "dona:porcion" else "torta:porcion")
  if (dona && length(hab)) {
    tam <- min(26, max(16, r * 16))
    .lam_txt(lz, f$cifras[hab[1]], cx - r, cy - tam / 144 - 0.05, 2 * r, tam / 72 + 0.1, tam, color, bold = TRUE, align = "center", nombre = "dona:cifra")
  }
  # Las cifras a la izquierda del disco, como p193: grande en el color de su porción, el rótulo con sus casos debajo.
  orden <- c(hab, setdiff(seq_len(k), hab)); xc <- cx - r - 0.25; paso <- min(1.1, d / max(1L, k))
  y_c <- cy - paso * k / 2
  n <- .espec_casos(f)
  for (j in seq_along(orden)) {
    i <- orden[j]; yk <- y_c + (j - 1) * paso
    .lam_txt(lz, f$cifras[i], xc - 1.75, yk, 1.6, 0.42, 22, if (i %in% hab) color else .std_color("azul_medio"), bold = TRUE, align = "right",
             nombre = "circular:cifra")
    et <- if (length(n) >= i && is.finite(n[i])) sprintf("%s (%d)", f$rotulos[i], as.integer(n[i])) else f$rotulos[i]
    .lam_txt(lz, et, xc - 1.75, yk + 0.4, 1.6, 0.26, 10.5, color, bold = i %in% hab, align = "right", nombre = "circular:rotulo")
  }
  # Conector: del borde del sector a las 3, en horizontal hasta la calle, y de ahí al título de la subpregunta.
  xt <- x_titulo - 0.22; yt <- y_titulo + 0.16
  .lam_caja(lz, cx + r + 0.06, cy - t / 2, xt - (cx + r + 0.06) + t, t, color, nombre = "conector")
  .lam_caja(lz, xt, min(cy, yt), t, abs(cy - yt) + t, color, nombre = "conector")
  .lam_caja(lz, xt, yt - t / 2, x_titulo - 0.06 - xt, t, color, nombre = "conector")
  invisible(list(cy = cy, fin = y0 + d))
}


#' La dependencia cuando un lado no tiene pieza nativa: cada lado con su enunciado y su gráfico (editable), el título del
#' dependiente con su base («Sólo los 20 que respondieron «Sí»») y un conector entre los dos. Al costado o abajo.
#' @keywords internal
.lam_laminas_filtro_sub_respaldo <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL, unidad_n = "respuestas",
                                             layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); mr <- g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1"); ancho <- W - ml - mr; azul <- .std_color("azul"); t <- 0.022
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  limpio <- function(p) tryCatch(p + ggplot2::labs(title = NULL, subtitle = NULL, caption = NULL) +
                                   ggplot2::theme(plot.caption = ggplot2::element_blank()), error = function(e) p)
  if (identical(espec$disposicion, "abajo")) {
    h <- (yf - yt - 0.5) / 2
    y1 <- .lam_panel_titulo(lz, ml, yt, ancho, espec$pregunta_filtro) + 0.05
    y2t <- yt + h + 0.5
    y2 <- .lam_panel_titulo(lz, ml, y2t, ancho, espec$pregunta_sub, .lam_filtro_sub_base(espec)) + 0.05
    cajas <- list(c(ml, y1, ancho, y2t - 0.3 - y1), c(ml, y2, ancho, yf - y2))
    # El conector va por el margen y llega al título de abajo por su izquierda: no pisa el texto.
    xc <- ml - 0.2
    .lam_caja(lz, xc, y2t - 0.3, t, 0.46, azul, nombre = "conector"); .lam_caja(lz, xc, y2t + 0.16 - t / 2, 0.15, t, azul, nombre = "conector")
  } else {
    gap <- 0.6; col <- (ancho - gap) / 2; xr <- ml + col + gap
    y1 <- .lam_panel_titulo(lz, ml, yt, col, espec$pregunta_filtro) + 0.05
    y2 <- .lam_panel_titulo(lz, xr, yt, col, espec$pregunta_sub, .lam_filtro_sub_base(espec)) + 0.05
    cajas <- list(c(ml, y1, col, yf - y1), c(xr, y2, col, yf - y2))
    xt <- xr - 0.22; ym <- y1 + (yf - y1) / 2; ytt <- yt + 0.16
    .lam_caja(lz, ml + col + 0.05, ym - t / 2, xt - (ml + col + 0.05) + t, t, azul, nombre = "conector")
    .lam_caja(lz, xt, ytt, t, ym - ytt + t, azul, nombre = "conector")
    .lam_caja(lz, xt, ytt - t / 2, xr - 0.06 - xt, t, azul, nombre = "conector")
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:filtro_sub")
  for (k in 1:2) {
    p <- if (k == 1L) espec$plot_filtro else espec$plot_sub; cj <- cajas[[k]]
    doc <- officer::ph_with(doc, rvg::dml(ggobj = limpio(p), bg = "transparent", fonts = list(sans = .std_pt("fuente"))),
                            location = officer::ph_location(left = cj[1], top = cj[2], width = cj[3], height = max(0.5, cj[4]), newlabel = "filtro_sub:respaldo"))
  }
  doc <- .lam_pie(doc, .lam_filtro_sub_pie(base, espec), folio)
  list(doc = por_lamina(doc), partes = 1L)
}
