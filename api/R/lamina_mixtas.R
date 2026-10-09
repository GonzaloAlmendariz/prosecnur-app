# =============================================================================
# lamina_mixtas.R — láminas de tres y cuatro gráficos del recetario (ADR 0093, N3)
# =============================================================================
#
# Las disposiciones de recetario_m2b.R: dos apilados y uno alto (2mas1), uno alto y
# dos apilados (1mas2), uno ancho arriba (1arriba) y la cuadrícula de 2 x 2. Cada
# ranura es un panel con su pregunta y su público encima; el panel dibuja lo que su
# especificación afirma: barras horizontales para una categórica (`barras_h`), la
# dicotomía partida si la categórica reparte el 100 % en dos, y el likert compacto
# con su leyenda para una escala. Los paneles se separan con filetes.
#
# El recetario afina a mano el alto de fila de cada panel; aquí la regla que lo
# reproduce: la fila llena el 90 % del alto disponible, con tope de 0.95 in en un
# panel alto, 0.5 in en uno mediano y 0.42 in en la cuadrícula, y la barra sigue la
# tabla de grosor.

#' Rectángulos de una disposición mixta (recetario_m2b.R)
#'
#' @return Lista con `paneles` (x, y, w, h por ranura, en el orden de `.SLIDES_COMPOSICION`) y `filetes`
#'   (cada uno con `tipo` "v" u "h" y sus coordenadas).
#' @keywords internal
.lam_mixta_geo <- function(tipo) {
  g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); ancho <- W - ml - g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1"); gap <- 0.5
  col2 <- (ancho - gap) / 2; xr <- ml + col2 + gap; xm <- ml + col2 + gap / 2
  P <- function(x, y, w, h) list(x = x, y = y, w = w, h = h)
  switch(tipo,
    graficos_3_2mas1 = list(
      paneles = list(P(ml, yt, col2, 2.15), P(ml, yt + 2.35, col2, yf - yt - 2.35), P(xr, yt, col2, yf - yt)),
      filetes = list(list(tipo = "h", x0 = ml, x1 = ml + col2, y = yt + 2.15), list(tipo = "v", x = xm, y0 = yt, y1 = yf))),
    graficos_3_1mas2 = list(
      paneles = list(P(ml, yt, col2, yf - yt), P(xr, yt, col2, 1.85), P(xr, yt + 2.05, col2, yf - yt - 2.05)),
      filetes = list(list(tipo = "v", x = xm, y0 = yt, y1 = yf), list(tipo = "h", x0 = xr, x1 = xr + col2, y = yt + 1.85))),
    graficos_3_1arriba = list(
      paneles = list(P(ml, yt - 0.05, ancho, 2.45), P(ml, yt + 2.55, col2, yf - yt - 2.55), P(xr, yt + 2.55, col2, yf - yt - 2.55)),
      filetes = list(list(tipo = "h", x0 = ml, x1 = W - g_("margen_der"), y = yt + 2.4))),
    paneles_4 = {
      h2 <- (yf - yt - 0.35) / 2
      list(paneles = list(P(ml, yt, col2, h2), P(xr, yt, col2, h2), P(ml, yt + h2 + 0.35, col2, h2), P(xr, yt + h2 + 0.35, col2, h2)),
           filetes = list(list(tipo = "v", x = xm, y0 = yt, y1 = yf), list(tipo = "h", x0 = ml, x1 = W - g_("margen_der"), y = yt + h2 + 0.15)))
    },
    NULL)
}

#' Filas de una leyenda acotada a un panel: una si cabe a lo ancho del panel, dos si no
#' @keywords internal
.lam_leyenda_filas <- function(labels, w) {
  ws <- 0.22 + .lam_ancho_tinta(labels, .std_pt("leyenda"))
  if (sum(ws) + 0.3 * (length(ws) - 1) <= w) return(list(seq_along(labels)))
  k <- ceiling(length(labels) / 2)
  list(seq_len(k), setdiff(seq_along(labels), seq_len(k)))
}

#' Leyenda de un panel: centrada bajo sus barras y sin salir del panel (no cruza el filete vecino)
#' @keywords internal
.lam_leyenda_panel <- function(lz, y, labels, cols, centro, x0, x1) {
  size <- .std_pt("leyenda")
  for (r in .lam_leyenda_filas(labels, x1 - x0)) {
    wk <- .lam_ancho_tinta(labels[r], size); ws <- 0.22 + wk; gap <- 0.3
    tot <- sum(ws) + gap * (length(ws) - 1)
    if (tot > x1 - x0 && length(ws) > 1) { gap <- max(0.15, (x1 - x0 - sum(ws)) / (length(ws) - 1)); tot <- sum(ws) + gap * (length(ws) - 1) }
    x <- min(max(centro - tot / 2, x0), x1 - tot)
    for (k in seq_along(r)) {
      .lam_caja(lz, x, y + 0.07, 0.15, 0.15, cols[r[k]], nombre = "leyenda:cuadro")
      .lam_txt(lz, labels[r[k]], x + 0.12, y, wk[k] + 0.3, 0.3, size, .std_color("azul"), nombre = "leyenda:texto")
      x <- x + ws[k] + gap
    }
    y <- y + 0.3
  }
  invisible(y)
}

#' Geometría de un panel mixto: lo que dibuja y con qué medidas, y si cabe
#'
#' El renderer y la compuerta leen la misma geometría: una pregunta que se parte en varias líneas baja el
#' gráfico, los rótulos que se parten deben caber en su fila y la leyenda de la escala, en el panel.
#' @keywords internal
.lam_panel_geo <- function(espec, x, y, w, h, pregunta = NULL, publico = NULL, leyenda = TRUE) {
  alto <- h >= 3.5; fin <- y + h
  dy <- if (!is.null(pregunta) && nzchar(pregunta)) 0.22 * (.lam_lineas(pregunta, w, 13, TRUE) - 1) else 0
  con_pub <- !is.null(publico) && nzchar(publico)
  if (identical(espec$tipo, "categorica") && .lam_dicotomia_cabe(espec, w - 0.8, con_n = FALSE)) {
    # barras_h del recetario: dos categorías se leen como dicotomía, al ancho de las barras del panel vecino (C23),
    # con los rótulos sin su frecuencia (recetario_m2b.R, cuarta celda de la cuadrícula).
    return(list(tipo = "dicotomia", y0 = y + 0.65 + dy, cabe = h - 0.65 - dy >= 1.4))
  }
  if (identical(espec$tipo, "categorica")) {
    n <- max(1L, length(espec$largos)); y0 <- y + (if (alto) 0.75 else 0.58) + dy
    fila <- min(if (alto) 0.95 else if (h < 2.5) 0.42 else 0.5, (fin - y0) * (if (alto) 0.95 else 0.9) / n)   # 0.42: la cuadrícula de 2 x 2
    g <- min(.std_grosor(n, "categorias"), fila * 0.7)
    tope <- min(2.6, w * 0.45)
    size <- if (max(.lam_ancho_tinta(espec$rotulos, 12)) + 0.3 > tope) 11 else 12
    wlab <- min(tope, max(1.2, max(.lam_ancho_tinta(espec$rotulos, size)) + 0.3))
    altos <- vapply(espec$rotulos, function(r) .lam_alto_txt(r, wlab, size), 0)
    return(list(tipo = "barras", y0 = y0, fila = fila, g = g, wlab = wlab, size = size,
                cabe = length(espec$largos) >= 1L && fila >= 0.3 && all(altos <= fila + 0.02)))
  }
  if (!identical(espec$tipo, "escala") || NROW(espec$filas) < 1L || .lam_escala_en_filas(espec)) return(list(tipo = "escala", cabe = FALSE))
  # Escala: el likert compacto (likert_panel). El recetario lo pone 0.45 in bajo la pregunta con público y, sin
  # él, 0.35 en el panel ancho y 0.2 en los de media columna; la fila mide 0.85, 0.66 o 0.5 in según haya una,
  # dos o tres o más filas, y la barra el 58 % de la fila (0.5, 0.38 y 0.3 in en recetario_m2b.R).
  filas <- espec$orden$aplicado %||% seq_len(NROW(espec$filas))
  n <- length(filas); y0 <- y + (if (con_pub) 0.45 else if (w > 7) 0.35 else 0.2) + dy
  rot <- espec$filas$rotulo[filas]
  wlab <- min(1.6, max(1.2, max(.lam_ancho_tinta(rot, 11, TRUE)) + 0.25))
  size_lab <- if (n >= 3L) 10.5 else 11
  ttb <- if (!is.null(espec$box$unidades)) .std_geom("columna_top_two_box") + 0.1 else 0
  ley <- espec$leyenda; n_ley <- if (isTRUE(leyenda)) length(.lam_leyenda_filas(espec$categorias$rotulo[ley], w)) else 0L
  disp <- fin - (y0 + 0.3) - (if (isTRUE(leyenda)) 0.15 + 0.3 * n_ley else 0.35)
  fila <- min(c(0.85, 0.66, 0.5)[min(n, 3L)], disp / n); g <- max(0.24, round(fila * 0.58, 2))
  altos <- vapply(rot, function(r) .lam_alto_txt(r, wlab, size_lab, TRUE), 0)
  list(tipo = "escala", filas = filas, y0 = y0, fila = fila, g = g, wlab = wlab, size_lab = size_lab, ttb = ttb,
       cabe = fila >= 0.4 && all(altos <= fila + 0.05))
}

#' Un panel de lámina mixta: pregunta, público y el gráfico que afirma su especificación
#'
#' @param leyenda Si `FALSE`, la escala no dibuja su leyenda (la pone la lámina, compartida).
#' @return El `y` donde terminó lo dibujado (para colocar una leyenda compartida debajo).
#' @keywords internal
.lam_panel_mixto <- function(lz, espec, x, y, w, h, pregunta = NULL, publico = NULL, leyenda = TRUE) {
  if (!is.null(pregunta) && nzchar(pregunta)) .lam_panel_titulo(lz, x, y, w, pregunta, publico)
  geo <- .lam_panel_geo(espec, x, y, w, h, pregunta, publico, leyenda)
  if (identical(geo$tipo, "dicotomia")) {
    d <- .lam_dicotomia_datos(espec)
    return(.lam_dicotomia(lz, x, geo$y0, w - 0.8, d$rotulos, d$cifras, d$largos, NULL, size = 22, g = 0.34))
  }
  if (identical(geo$tipo, "barras")) {
    return(.lam_barras_h(lz, espec, x, geo$y0, w, wlab = geo$wlab, g = geo$g, fila = geo$fila, size = geo$size))
  }
  yy <- .lam_likert_panel(lz, espec, x, geo$y0, w, geo$filas, g = geo$g, fila = geo$fila, wlab = geo$wlab, size_lab = geo$size_lab)
  if (isTRUE(leyenda)) {
    xb <- x + geo$wlab + 0.12; wb <- w - geo$wlab - 0.12 - geo$ttb
    ley <- espec$leyenda
    yy <- .lam_leyenda_panel(lz, yy + 0.03, espec$categorias$rotulo[ley], espec$categorias$color[ley], centro = xb + wb / 2, x0 = x, x1 = x + w)
  }
  invisible(yy)
}

#' Lámina de tres o cuatro gráficos con las disposiciones del recetario
#'
#' Dos paneles de escala en la misma fila y con la misma escala comparten una sola leyenda, centrada en la
#' lámina al pie de los paneles (lámina «Tutoría y misión institucional»).
#' @param especs Especificaciones por ranura, en el orden de `.lam_mixta_geo(tipo)$paneles`.
#' @param preguntas,publicos Encabezado de cada panel (o `NULL`).
#' @return Lista con `doc` y `partes`, o `NULL` si `tipo` no es una disposición mixta del recetario.
#' @keywords internal
.lam_laminas_mixta <- function(doc, especs, tipo, preguntas, publicos = NULL, titulo, ante = NULL, base = NULL, folio = NULL,
                               sub = NULL, layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  geo <- .lam_mixta_geo(tipo)
  if (is.null(geo)) return(NULL)   # disposición sin geometría del recetario: quien llama sigue con la ruta anterior
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  P <- geo$paneles
  compartida <- .lam_mixta_compartida(especs, P)
  fines <- numeric(length(P))
  for (k in seq_along(P)) {
    p <- P[[k]]
    fines[k] <- .lam_panel_mixto(lz, especs[[k]], p$x, p$y, p$w, p$h, preguntas[[k]] %||% NULL,
                                 (publicos %||% list())[k][[1]] %||% NULL, leyenda = !compartida[k])
  }
  if (any(compartida)) {
    e1 <- especs[[which(compartida)[1]]]; ley <- e1$leyenda
    .lam_leyenda(lz, .std_geom("contenido_y1") - 0.05, e1$categorias$rotulo[ley], e1$categorias$color[ley],
                 centrar_en = .std_geom("ancho") / 2)
  }
  for (f in geo$filetes) {
    if (identical(f$tipo, "v")) .lam_separador_v(lz, f$x, f$y0, f$y1) else .lam_separador_h(lz, f$x0, f$x1, f$y)
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:mixta")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' ¿Qué paneles comparten leyenda? Paneles de escala con la misma escala en la misma fila (mismo y)
#' @keywords internal
.lam_mixta_compartida <- function(especs, P) {
  es_escala <- vapply(especs, function(e) identical(e$tipo, "escala"), TRUE)
  compartida <- rep(FALSE, length(P))
  for (y in unique(vapply(P, `[[`, 0, "y"))) {
    k <- which(vapply(P, `[[`, 0, "y") == y & es_escala)
    if (length(k) >= 2L && .lam_paneles_misma_escala(especs[k])) compartida[k] <- TRUE
  }
  compartida
}

#' Pregunta y público de cada panel
#'
#' La pregunta sale del título del gráfico o de la etiqueta de su variable; el público («178 respuestas») son
#' los que respondieron (no las marcas de una selección múltiple) y se nombra sólo en un panel de un público.
#' @keywords internal
.lam_mixta_encabezados <- function(especs, els = NULL, titulo_de_var = NULL) {
  texto <- function(x) if (is.null(x) || !length(x) || is.na(x[1]) || !nzchar(trimws(as.character(x)[1]))) NULL else trimws(as.character(x)[1])
  preguntas <- lapply(seq_along(especs), function(k) {
    el <- if (length(els) >= k) els[[k]] else NULL
    if (is.null(el)) return(NULL)
    texto(el$overrides$titulo) %||% texto(el$title_slide) %||%
      (if (is.function(titulo_de_var) && !is.null(el$var)) texto(tryCatch(titulo_de_var(el$var), error = function(e) NULL))) %||% ""
  })
  publicos <- lapply(especs, function(e) {
    n <- .espec_n_base(e)
    if (is.finite(n) && n > 0) paste(format(round(n), big.mark = ",", trim = TRUE), "respuestas") else NULL
  })
  list(preguntas = preguntas, publicos = publicos)
}

#' ¿El gráfico cabe en su panel con la geometría del recetario? (la misma que dibuja `.lam_panel_mixto`)
#' @keywords internal
.lam_mixta_cabe <- function(espec, p, pregunta = NULL, publico = NULL, leyenda = TRUE) {
  isTRUE(.lam_panel_geo(espec, p$x, p$y, p$w, p$h, pregunta, publico, leyenda)$cabe)
}

#' ¿La lámina mixta se compone con piezas nativas? Cada ranura trae su especificación y cabe en su panel
#' @keywords internal
.lam_compositor_aplica_mixta <- function(ps, slide = NULL, tipo, els = NULL, titulo_de_var = NULL) {
  if (identical((slide$meta %||% list())$motor_nativo, FALSE)) return(FALSE)
  geo <- .lam_mixta_geo(tipo)
  if (is.null(geo) || length(ps) != length(geo$paneles)) return(FALSE)
  especs <- lapply(ps, function(p) if (inherits(p, "ggplot")) attr(p, "pulso_espec") else NULL)
  if (any(vapply(especs, is.null, TRUE))) return(FALSE)
  enc <- .lam_mixta_encabezados(especs, els, titulo_de_var)
  compartida <- .lam_mixta_compartida(especs, geo$paneles)
  all(vapply(seq_along(especs), function(k) .lam_mixta_cabe(especs[[k]], geo$paneles[[k]], enc$preguntas[[k]], enc$publicos[[k]],
                                                           leyenda = !compartida[k]), TRUE))
}

#' Una lámina mixta del plan, en nativo (enganche de la composición y de `paneles_4`)
#'
#' La pregunta de cada panel sale del título del gráfico o de la etiqueta de su variable; el público
#' («178 respuestas») se nombra cuando el panel es de un solo público. La base de la lámina reúne las notas
#' al pie de los gráficos si la lámina no trae la suya.
#' @keywords internal
.lam_composicion_mixta <- function(doc, tipo, rendered, els, slide, titulo_de_var = NULL, base = NULL) {
  texto <- function(x) if (is.null(x) || !length(x) || is.na(x[1]) || !nzchar(trimws(as.character(x)[1]))) NULL else trimws(as.character(x)[1])
  slots <- slide$slots %||% list()
  base <- texto(base) %||% (if (is.character(slots$base)) texto(slots$base) else if (inherits(slots$base, "ppt_element_text")) texto(slots$base$text))
  especs <- lapply(seq_along(rendered), function(k) {
    e <- attr(rendered[[k]], "pulso_espec")
    if (identical(els[[k]]$.element_type, "barras_multiapiladas") && identical(els[[k]]$modo %||% "var", "var")) e <- .espec_ordenar_por_box(e)
    e
  })
  if (is.null(base)) {
    # Las notas de los gráficos: la de la ruta de composición (nota_pie) o la que trae la espec (caption del ggplot).
    bases <- unique(unlist(c(lapply(els, function(el) texto(el$overrides$nota_pie %||% NULL)), lapply(especs, function(e) texto(e$nota)))))
    # «Base: 200» y «Base: 200 respuestas» nombran la misma base: se escribe una vez, la más explícita.
    if (length(bases) > 1L) {
      bases <- bases[order(-nchar(bases))]; bases <- bases[!duplicated(gsub("[^0-9]", "", bases))]
    }
    base <- if (length(bases)) paste(bases, collapse = ". ") else NULL
  }
  enc <- .lam_mixta_encabezados(especs, els, titulo_de_var)
  .lam_laminas_mixta(doc, especs, tipo, enc$preguntas, enc$publicos, titulo = texto(slots$title %||% slide$title) %||% "",
                     ante = texto((slide$meta %||% list())$antetitulo), base = base, folio = length(doc) + 1L)$doc
}
