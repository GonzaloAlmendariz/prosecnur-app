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
    # Dos gráficos lado a lado (133 y, con narrativa, 136): media columna cada uno y el filete vertical al medio.
    graficos_2 = list(
      paneles = list(P(ml, yt, col2, yf - yt), P(xr, yt, col2, yf - yt)),
      filetes = list(list(tipo = "v", x = xm, y0 = yt, y1 = yf))),
    graficos_3_2mas1 = list(
      paneles = list(P(ml, yt, col2, 2.15), P(ml, yt + 2.35, col2, yf - yt - 2.35), P(xr, yt, col2, yf - yt)),
      filetes = list(list(tipo = "h", x0 = ml, x1 = ml + col2, y = yt + 2.15), list(tipo = "v", x = xm, y0 = yt, y1 = yf))),
    graficos_3_1mas2 = list(
      paneles = list(P(ml, yt, col2, yf - yt), P(xr, yt, col2, 1.85), P(xr, yt + 2.05, col2, yf - yt - 2.05)),
      filetes = list(list(tipo = "v", x = xm, y0 = yt, y1 = yf), list(tipo = "h", x0 = xr, x1 = xr + col2, y = yt + 1.85))),
    graficos_3_1arriba = list(
      paneles = list(P(ml, yt - 0.05, ancho, 2.45), P(ml, yt + 2.55, col2, yf - yt - 2.55), P(xr, yt + 2.55, col2, yf - yt - 2.55)),
      filetes = list(list(tipo = "h", x0 = ml, x1 = W - g_("margen_der"), y = yt + 2.4))),
    # Tipo 22 (lámina 171): banda de tres cifras arriba, filete, y dos gráficos lado a lado. Las cifras se dibujan juntas
    # con `.lam_cifras_banda` (sus propios separadores); los paneles 1–3 sólo dan la franja que ocupan.
    # K15, lo dibujado en la p171: cifras de 3.908 con calles de 0.4 desde 1.6 (la pieza `cifra()`, lamina_cifras_pieza.R),
    # filete en 3.05 y los gráficos desde 3.25, sin filete entre ellos.
    cifras_y_graficos = {
      cf <- .std_tipo_lamina("p_slide_cifras_y_graficos")$cifras; ca <- cf$calle; w3 <- (ancho - 2 * ca) / 3; yb <- yt + 1.6
      list(paneles = list(P(ml, yt - 0.05, w3, 1.8), P(ml + w3 + ca, yt - 0.05, w3, 1.8), P(ml + 2 * (w3 + ca), yt - 0.05, w3, 1.8),
                          P(ml, yb, col2, yf - yb), P(xr, yb, col2, yf - yb)),
           filetes = list(list(tipo = "h", x0 = ml, x1 = W - g_("margen_der"), y = yt + 1.4)), cifras = cf)
    },
    # Tipo 21 (lámina 169): columna lateral con dos cifras apiladas, dos gráficos en la columna del medio y uno alto a la
    # derecha. Ranuras en el orden de `.SLIDES_COMPOSICION$poblacion_3_cifras`.
    poblacion_3_cifras = {
      # K15, lo dibujado en la p169: columna de cifras de 3.0 (cifras en 1.8 y 3.5, filete en 3.2), calles de 0.45 con su
      # filete al medio (3.715 y 8.487), columnas de 4.312 desde 3.945 y 8.707; arriba al medio la pregunta en 1.65 y el
      # filete en 3.6, y la de abajo en 3.75. El panel de arriba mide hasta la pregunta de abajo (2.1): la dicotomía pide
      # 2.05 con su pregunta y su público (`.lam_panel_geo`) y el filete de 3.6 queda bajo su barra (3.19 en la p169).
      wl <- 3.0; gap3 <- 0.45; xc <- ml + wl + gap3; wr <- (ancho - wl - 2 * gap3) / 2; xd <- xc + wr + gap3
      list(paneles = list(P(xc, yt, wr, 2.1), P(xd, yt, wr, yf - yt), P(ml, yt + 0.15, wl, 1.3),
                          P(xc, yt + 2.1, wr, yf - yt - 2.1), P(ml, yt + 1.85, wl, 1.3)),
           filetes = list(list(tipo = "h", x0 = ml, x1 = ml + wl, y = yt + 1.55), list(tipo = "v", x = ml + wl + gap3 / 2, y0 = yt, y1 = yf),
                          list(tipo = "h", x0 = xc, x1 = xc + wr, y = yt + 1.95), list(tipo = "v", x = xc + wr + gap3 / 2, y0 = yt, y1 = yf)),
           cifras = .std_tipo_lamina("p_slide_3_graficos_poblacion_cifras")$cifras)
    },
    # Tipo 17 (lámina 160): dos gráficos arriba lado a lado y uno ancho abajo. Las ranuras salen del estándar (fuente
    # única); el panel de abajo dibuja hasta el fin del contenido, como el de abajo de las demás mixtas, y los filetes
    # van al medio de cada calle.
    poblacion_3_corona = .lam_corona_geo(),
    # P4 (checklist-poblacion-y-filtro): tira, cinco y seis desde las ranuras del estándar (lamina_poblacion_geo.R).
    poblacion_3_tira = .lam_poblacion_geo("p_slide_3_graficos_poblacion_tira", lateral = TRUE),
    poblacion_5 = .lam_poblacion_geo("p_slide_5_graficos_poblacion"),
    poblacion_6 = .lam_poblacion_geo("p_slide_6_graficos_poblacion"),
    paneles_4 = {
      h2 <- (yf - yt - 0.35) / 2
      list(paneles = list(P(ml, yt, col2, h2), P(xr, yt, col2, h2), P(ml, yt + h2 + 0.35, col2, h2), P(xr, yt + h2 + 0.35, col2, h2)),
           filetes = list(list(tipo = "v", x = xm, y0 = yt, y1 = yf), list(tipo = "h", x0 = ml, x1 = W - g_("margen_der"), y = yt + h2 + 0.15)))
    },
    NULL)
}

#' Rectángulos de la corona, leídos de `ppt.tipos_lamina` (p_slide_3_graficos_poblacion_corona)
#'
#' @return Como `.lam_mixta_geo()`: `paneles` (superior izquierda, superior derecha, inferior) y `filetes`.
#' @keywords internal
.lam_corona_geo <- function() {
  r <- Filter(function(x) identical(x$tipo, "grafico"), .std_tipo_lamina("p_slide_3_graficos_poblacion_corona")$ranuras)
  if (length(r) != 3L) return(NULL)
  # Cada panel lleva lo que la p160 dibuja dentro de él (lamina_corona.R).
  P <- function(q, k, h = q$h) list(x = q$x, y = q$y, w = q$w, h = h, receta = .lam_corona_receta(k))
  sup_i <- r[[1]]; sup_d <- r[[2]]; inf <- r[[3]]
  list(paneles = list(P(sup_i, 1L), P(sup_d, 2L), P(inf, 3L, .std_geom("contenido_y1") - inf$y)),
       filetes = list(list(tipo = "v", x = (sup_i$x + sup_i$w + sup_d$x) / 2, y0 = sup_i$y, y1 = sup_i$y + sup_i$h),
                      list(tipo = "h", x0 = inf$x, x1 = inf$x + inf$w, y = (sup_i$y + sup_i$h + inf$y) / 2)))
}

#' La especificación que trae un gráfico renderizado: la de un gráfico (`pulso_espec`) o la de una cifra destacada
#' (`pulso_cifra`, F6.0b.6), que el panel dibuja con la banda de cifras
#' @keywords internal
.lam_espec_de <- function(p) {
  if (!inherits(p, "ggplot")) return(NULL)
  e <- attr(p, "pulso_espec") %||% (if (!is.null(attr(p, "pulso_cifra"))) list(tipo = "cifra", item = attr(p, "pulso_cifra")))
  .lam_numerico_como_cifra(e) %||% e
}

#' P2 (checklist-poblacion-y-filtro): un indicador numérico de un solo valor (la media de la edad, sin grupos) es una
#' cifra destacada: el valor, lo que mide y, debajo, la métrica con sus casos («Promedio de 172 respuestas»). Antes no
#' cabía en la ranura de cifra y la lámina entera caía a la plantilla anterior.
#' @keywords internal
.lam_numerico_como_cifra <- function(e) {
  if (!is.list(e) || !identical(e$tipo, "numerico") || length(e$cifras) != 1L || !nzchar(e$cifras[1] %||% "")) return(NULL)
  que <- c(mean = "Promedio", median = "Mediana", N = "Casos", pct = "Porcentaje")[[e$metrica %||% "mean"]] %||% "Promedio"
  n <- suppressWarnings(as.numeric(e$n)[1])
  detalle <- if (is.finite(n) && !identical(e$metrica, "N")) sprintf("%s de %s respuestas", que, format(round(n), big.mark = ",", trim = TRUE)) else que
  rotulo <- trimws(as.character(e$etiqueta %||% e$rotulos[1] %||% "")[1])
  if (!nzchar(rotulo) || identical(rotulo, "Total")) rotulo <- que
  list(tipo = "cifra", item = list(valor = e$cifras[1], rotulo = rotulo, detalle = detalle, icono = "", desde_numerico = TRUE))
}
.lam_es_cifra <- function(e) is.list(e) && identical(e$tipo, "cifra")

#' Filas de una leyenda acotada a un panel: una si cabe a lo ancho del panel; si no, filas equilibradas que sí caben
#'
#' El reparto es el de `.lam_leyenda_plan()` (leyenda_plan.R, O8b): antes, la segunda fila de cinco rótulos largos de escala
#' se salía ~0,5 in de un panel de media columna (6,01 in) y ninguna compuerta lo veía. `.lam_panel_geo()` reserva el alto
#' de estas filas y exige que quepan.
#' @return Lista de índices por fila; el plan entero en `attr(, "plan")`.
#' @keywords internal
.lam_leyenda_filas <- function(labels, w) {
  plan <- .lam_leyenda_plan(labels, w, panel = TRUE)
  structure(plan$filas, plan = plan)
}

#' Leyenda de un panel: centrada bajo sus barras y sin salir del panel (no cruza el filete vecino)
#' @keywords internal
.lam_leyenda_panel <- function(lz, y, labels, cols, centro, x0, x1) {
  plan <- .leyenda_avisar(attr(.lam_leyenda_filas(labels, x1 - x0), "plan"))
  for (r in seq_along(plan$filas)) {
    x <- .leyenda_x_fila(plan$totales[r], centro, x0, x1)
    for (i in plan$filas[[r]]) {
      .lam_caja(lz, x, y + 0.07, 0.15, 0.15, cols[i], nombre = "leyenda:cuadro")
      .lam_txt(lz, labels[i], x + 0.12, y, plan$anchos[i] + 0.3, 0.3, plan$size, .std_color("azul"), nombre = "leyenda:texto")
      x <- x + plan$items[i] + plan$gaps[r]
    }
    y <- y + 0.3
  }
  invisible(y)
}

#' Geometría de un panel mixto: lo que dibuja y con qué medidas, y si cabe
#'
#' El renderer y la compuerta leen la misma geometría: una pregunta que se parte en varias líneas baja el
#' gráfico, los rótulos que se parten deben caber en su fila y la leyenda de la escala, en el panel.
#' @param receta Lo que una lámina del recetario fija a mano para este panel (hoy la corona, `.lam_corona_receta()`);
#'   `NULL` para la regla compartida.
#' @keywords internal
.lam_panel_geo <- function(espec, x, y, w, h, pregunta = NULL, publico = NULL, leyenda = TRUE, receta = NULL) {
  alto <- h >= 3.5; fin <- y + h
  # Líneas de la pregunta con el ancho real del texto (systemfonts): la estimación por carácter partía en dos
  # una pregunta que cabe en una (verificador de N3, lámina 152).
  dy <- if (!is.null(pregunta) && nzchar(pregunta)) 0.22 * (max(1, ceiling(.lam_ancho_tinta(pregunta, 13, TRUE) / (w - 0.1))) - 1) else 0
  con_pub <- !is.null(publico) && nzchar(publico)
  rd <- receta$dicotomia
  wd <- if (isTRUE(rd$ancho_pleno)) w else w - 0.8
  if (identical(espec$tipo, "categorica") && .lam_dicotomia_cabe(espec, wd, con_n = FALSE)) {
    # barras_h del recetario: dos categorías se leen como dicotomía, al ancho de las barras del panel vecino (C23),
    # con los rótulos sin su frecuencia (recetario_m2b.R, cuarta celda de la cuadrícula). La receta de una lámina
    # (la corona, p160) puede pedirla a todo el panel y con la frecuencia, si cabe con ella.
    # Si los rótulos llevan «(n)» lo decide «Casos junto al porcentaje» (`.lam_dicotomia_datos`); aquí sólo si cabe.
    con_n <- .lam_dicotomia_cabe(espec, wd, con_n = TRUE)
    d0 <- rd$dy %||% 0.65
    return(list(tipo = "dicotomia", y0 = y + d0 + dy, cabe = h - d0 - dy >= (rd$alto_min %||% 1.4), w = wd, con_n = con_n,
                size = rd$size %||% 22, g = rd$g %||% 0.34, receta = receta))
  }
  # P1 (checklist-poblacion-y-filtro): la torta y la dona que eligió el analista, en pequeño (lamina_panel_circular.R).
  if (identical(espec$tipo, "pie")) return(.lam_panel_circular_geo(espec, x, y, w, h, dy))
  if (identical(espec$tipo, "categorica")) {
    rb <- receta$barras
    # La receta puede correr el bloque hacia adentro (la corona centra las barras de abajo, p160).
    sang <- rb$sangria %||% 0; x <- x + sang; w <- w - 2 * sang
    n <- max(1L, length(espec$largos)); y0 <- y + (rb$dy %||% (if (alto) 0.75 else 0.58)) + dy
    tope_fila <- rb$fila %||% (if (alto) 0.95 else if (h < 2.5) 0.42 else 0.5)   # 0.42: la cuadrícula de 2 x 2
    fila <- min(tope_fila, (fin - y0) * (if (alto) 0.95 else 0.9) / n)
    g <- min(.std_grosor(n, "categorias"), fila * 0.7)
    tope <- min(2.6, w * 0.45)
    nb <- .std_negrita_forzada("categorias")   # O8a: con «todas en negrita» el rótulo se mide con su negrita
    size <- if (max(.lam_ancho_tinta(espec$rotulos, 12, nb)) + 0.3 > tope) 11 else 12
    wlab <- min(tope, max(rb$wlab %||% 1.2, max(.lam_ancho_tinta(espec$rotulos, size, nb)) + 0.3))
    # Alto con la tinta medida: la estimación por carácter partía en dos «Secretario(a) académico(a)», que en la
    # lámina 193 del recetario cabe en una línea, y mandaba la cuadrícula entera a la ruta anterior.
    # Lo que debe caber en la fila es la tinta del rótulo (el cuadro menos sus 0.1 in de márgenes internos, que
    # `.lam_barras_h` centra en la fila): la lámina 162 deja «Departamento de Ciencias Contables» en dos líneas de
    # 11 pt dentro de una fila de 0.42 in. Medir el cuadro entero mandaba esa cuadrícula a la ruta anterior.
    altos <- vapply(espec$rotulos, function(r) .lam_alto_tinta(r, wlab, size, nb), 0)
    barras <- list(tipo = "barras", x = x, w = w, y0 = y0, fila = fila, g = g, wlab = wlab, size = size, receta = receta,
                   cabe = length(espec$largos) >= 1L && fila >= 0.3 && all(altos - 0.1 <= fila - 0.02))
    if (isTRUE(barras$cabe)) return(barras)
    # P3 (checklist-poblacion-y-filtro): en un panel ancho y bajo (el de abajo de la corona) las categorías que no caben
    # como filas van en columnas, como la lámina 68 del recetario: cifra encima, rótulo debajo.
    x_c <- x - sang; w_c <- w + 2 * sang
    if (w_c >= 6 && n <= 8L) {
      ybase <- y + h - 0.42; techo <- y + 0.55 + dy + 0.72
      paso <- (w_c - 1.2) / n
      rot_ok <- all(vapply(espec$rotulos, function(r) .lam_alto_tinta(r, paso * 0.56 + 0.8, 12, TRUE) <= 0.42, TRUE))
      return(list(tipo = "columnas", x0 = x_c + 0.6, ybase = ybase, wv = w_c - 1.2, hmax = ybase - techo,
                  cabe = ybase - techo >= 0.6 && rot_ok))
    }
    return(barras)
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
  ley <- espec$leyenda; filas_ley <- if (isTRUE(leyenda)) .lam_leyenda_filas(espec$categorias$rotulo[ley], w) else list()
  n_ley <- length(filas_ley); ley_cabe <- !isTRUE(leyenda) || isTRUE(attr(filas_ley, "plan")$cabe)
  disp <- fin - (y0 + 0.3) - (if (isTRUE(leyenda)) 0.15 + 0.3 * n_ley else 0.35)
  fila <- min(c(0.85, 0.66, 0.5)[min(n, 3L)], disp / n); g <- max(0.24, round(fila * 0.58, 2))
  altos <- vapply(rot, function(r) .lam_alto_txt(r, wlab, size_lab, TRUE), 0)
  list(tipo = "escala", filas = filas, y0 = y0, fila = fila, g = g, wlab = wlab, size_lab = size_lab, ttb = ttb,
       cabe = fila >= 0.4 && all(altos <= fila + 0.05) && ley_cabe)   # la leyenda no sale del panel (O8b)
}

#' Un panel de lámina mixta: pregunta, público y el gráfico que afirma su especificación
#'
#' @param leyenda Si `FALSE`, la escala no dibuja su leyenda (la pone la lámina, compartida).
#' @return El `y` donde terminó lo dibujado (para colocar una leyenda compartida debajo).
#' @keywords internal
.lam_panel_mixto <- function(lz, espec, x, y, w, h, pregunta = NULL, publico = NULL, leyenda = TRUE, receta = NULL) {
  if (!is.null(receta$lateral)) {
    # La tira (P4): el enunciado y su público en la columna izquierda; el gráfico a su derecha, sin encabezado.
    if (!is.null(pregunta) && nzchar(pregunta)) .lam_panel_titulo(lz, x, y, receta$lateral$w_titulo, pregunta, publico)
    q <- .lam_panel_lateral_rect(list(x = x, y = y, w = w, h = h, receta = receta))
    return(.lam_panel_mixto(lz, espec, q$x, q$y, q$w, q$h, NULL, NULL, leyenda, receta = utils::modifyList(receta, list(lateral = NULL))))
  }
  if (!is.null(pregunta) && nzchar(pregunta)) .lam_panel_titulo(lz, x, y, w, pregunta, publico)
  geo <- .lam_panel_geo(espec, x, y, w, h, pregunta, publico, leyenda, receta = receta)
  if (identical(geo$tipo, "dicotomia")) {
    d <- .lam_dicotomia_datos(espec)
    return(.lam_dicotomia(lz, x, geo$y0, geo$w, d$rotulos, d$cifras, d$largos, if (isTRUE(geo$con_n)) d$n, size = geo$size, g = geo$g,
                          cols = d$colores))   # ADR 0097: la paleta del usuario de la escala o la categórica
  }
  if (identical(geo$tipo, "barras")) {
    return(.lam_barras_h(lz, espec, geo$x, geo$y0, geo$w, wlab = geo$wlab, g = geo$g, fila = geo$fila, size = geo$size))
  }
  if (identical(geo$tipo, "circular")) return(.lam_panel_circular(lz, espec, geo))
  if (identical(geo$tipo, "columnas")) {
    .lam_columnas(lz, espec, x0 = geo$x0, ybase = geo$ybase, wv = geo$wv, hmax = geo$hmax)
    return(invisible(geo$ybase + 0.42))
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
                               sub = NULL, layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc,
                               respaldo = NULL) {
  force(folio)
  geo <- .lam_mixta_geo(tipo)
  if (is.null(geo)) return(NULL)   # disposición sin geometría del recetario: quien llama sigue con la ruta anterior
  doc <- officer::add_slide(doc, layout = layout, master = master)
  # Gonzalo, 2026-10-14: las láminas de población ya no llevan el ícono del público en la cabecera; la cabecera es la
  # de cualquier lámina de varios gráficos (antetítulo y título desde el margen).
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  P <- geo$paneles
  compartida <- .lam_mixta_compartida(especs, P)
  fines <- numeric(length(P))
  cifras <- which(vapply(especs, .lam_es_cifra, TRUE))
  iconos <- list()
  # Las cifras de una misma fila van juntas en una banda (detalles a la misma altura y sus separadores); una cifra sola en
  # su fila (la columna lateral del tipo 21) se dibuja a 34 pt, como `cifra()` del recetario.
  for (y in unique(vapply(P[cifras], `[[`, 0, "y"))) {
    fila <- cifras[vapply(P[cifras], `[[`, 0, "y") == y]
    p1 <- P[[fila[1]]]; pn <- P[[fila[length(fila)]]]
    # Las láminas de composición del recetario (21 y 22) dibujan la pieza `cifra()` con su tamaño y su calle (K15).
    b <- .lam_cifras_banda(lz, pulso_cifras(lapply(especs[fila], `[[`, "item")), p1$x, p1$y, pn$x + pn$w - p1$x,
                           size = geo$cifras$valor_pt %||% (if (length(fila) == 1L) 34 else NULL),
                           pieza = if (!is.null(geo$cifras)) .std_valor("ppt", "geometria", "cifra_pieza"), calle = geo$cifras$calle)
    iconos <- c(iconos, b$iconos); fines[fila] <- p1$y + b$alto
  }
  graficos <- list()
  for (k in setdiff(seq_along(P), cifras)) {
    p <- P[[k]]
    if (!is.null((respaldo %||% list())[k][[1]])) {
      # P4: el panel que no cabe en piezas nativas lleva su enunciado y, debajo, su gráfico (editable, como en el marco).
      graficos[[length(graficos) + 1L]] <- .lam_mixta_respaldo_caja(lz, p, preguntas[[k]] %||% NULL, (publicos %||% list())[k][[1]] %||% NULL, respaldo[[k]])
      next
    }
    fines[k] <- .lam_panel_mixto(lz, especs[[k]], p$x, p$y, p$w, p$h, preguntas[[k]] %||% NULL,
                                 (publicos %||% list())[k][[1]] %||% NULL, leyenda = !compartida[k], receta = p$receta)
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
  for (g in graficos) doc <- officer::ph_with(doc, rvg::dml(ggobj = g$p, bg = "transparent", fonts = list(sans = .std_pt("fuente"))),
                                              location = officer::ph_location(left = g$x, top = g$y, width = g$w, height = g$h, newlabel = "mixta:respaldo"))
  doc <- .lam_cifras_iconos(doc, iconos)
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
    if (is.null(el) || .lam_es_cifra(especs[[k]])) return(NULL)
    texto(el$overrides$titulo) %||% texto(el$title_slide) %||%
      (if (is.function(titulo_de_var) && !is.null(el$var)) texto(tryCatch(.plan_titulo_corto(titulo_de_var, el), error = function(e) NULL))) %||% ""
  })
  publicos <- lapply(especs, function(e) {
    if (is.null(e) || .lam_es_cifra(e) || identical(e$tipo, "respaldo")) return(NULL)
    n <- .espec_n_base(e)
    if (is.finite(n) && n > 0) paste(format(round(n), big.mark = ",", trim = TRUE), "respuestas") else NULL
  })
  list(preguntas = preguntas, publicos = publicos)
}

#' ¿El gráfico cabe en su panel con la geometría del recetario? (la misma que dibuja `.lam_panel_mixto`)
#' @keywords internal
.lam_mixta_cabe <- function(espec, p, pregunta = NULL, publico = NULL, leyenda = TRUE) {
  if (.lam_es_cifra(espec)) return(TRUE)
  if (is.null(espec)) return(FALSE)
  if (!is.null(p$receta$lateral)) {
    q <- .lam_panel_lateral_rect(p)
    return(isTRUE(.lam_panel_geo(espec, q$x, q$y, q$w, q$h, NULL, NULL, leyenda, receta = p$receta)$cabe))
  }
  isTRUE(.lam_panel_geo(espec, p$x, p$y, p$w, p$h, pregunta, publico, leyenda, receta = p$receta)$cabe)
}

#' ¿La lámina mixta se compone con piezas nativas? Cada ranura trae su especificación y cabe en su panel
#' @keywords internal
.lam_compositor_aplica_mixta <- function(ps, slide = NULL, tipo, els = NULL, titulo_de_var = NULL) {
  if (identical((slide$meta %||% list())$motor_nativo, FALSE)) return(FALSE)
  geo <- .lam_mixta_geo(tipo)
  if (is.null(geo) || length(ps) != length(geo$paneles)) return(FALSE)
  especs <- lapply(ps, .lam_espec_de)
  if (sum(vapply(especs, .lam_es_cifra, TRUE)) > 5L) return(FALSE)
  # P4 (checklist-poblacion-y-filtro): un panel que no cabe en piezas nativas va con su gráfico dentro del panel
  # (`.lam_mixta_respaldo`), así que la lámina se compone igual. Sólo si NINGÚN panel cabe se queda en la ruta anterior.
  any(.lam_mixta_caben(especs, geo, els, titulo_de_var))
}

#' Qué paneles caben en piezas nativas (el resto va con su gráfico de respaldo)
#' @keywords internal
.lam_mixta_caben <- function(especs, geo, els = NULL, titulo_de_var = NULL) {
  enc <- .lam_mixta_encabezados(lapply(especs, function(e) e %||% list(tipo = "respaldo")), els, titulo_de_var)
  compartida <- .lam_mixta_compartida(lapply(especs, function(e) e %||% list(tipo = "respaldo")), geo$paneles)
  vapply(seq_along(especs), function(k) .lam_mixta_cabe(especs[[k]], geo$paneles[[k]], enc$preguntas[[k]], enc$publicos[[k]],
                                                       leyenda = !compartida[k]), TRUE)
}

#' Una lámina mixta del plan, en nativo (enganche de la composición y de `paneles_4`)
#'
#' La pregunta de cada panel sale del título del gráfico o de la etiqueta de su variable; el público
#' («178 respuestas») se nombra cuando el panel es de un solo público. La base de la lámina reúne las notas
#' al pie de los gráficos si la lámina no trae la suya.
#' @keywords internal
.lam_composicion_mixta <- function(doc, tipo, rendered, els, slide, titulo_de_var = NULL, base = NULL, solo_base_declarada = FALSE) {
  texto <- function(x) if (is.null(x) || !length(x) || is.na(x[1]) || !nzchar(trimws(as.character(x)[1]))) NULL else trimws(as.character(x)[1])
  slots <- slide$slots %||% list()
  base <- if (isTRUE(solo_base_declarada)) texto(base) else
    texto(base) %||% (if (is.character(slots$base)) texto(slots$base) else if (inherits(slots$base, "ppt_element_text")) texto(slots$base$text)) %||%
      (if (is.character(slots$footer)) texto(slots$footer))   # población de cinco y seis: su base se llama `footer`
  especs <- lapply(seq_along(rendered), function(k) {
    e <- .lam_espec_de(rendered[[k]])
    if (identical(els[[k]]$.element_type, "barras_multiapiladas") && identical(els[[k]]$modo %||% "var", "var")) e <- .espec_ordenar_por_box(e)
    # P2: la cifra que sale de un indicador numérico dice qué mide (el título del gráfico o su pregunta), no «Media».
    if (.lam_es_cifra(e) && isTRUE(e$item$desde_numerico)) {
      q <- .lam_mixta_encabezados(list(list(tipo = "numerico")), list(els[[k]]), titulo_de_var)$preguntas[[1]]
      if (!is.null(q) && nzchar(q)) e$item$rotulo <- q
      # D6: la cifra lleva su unidad, como el recetario («22 años»): si el valor es sólo número y la pregunta la dice entre
      # paréntesis al final («Edad (años)»), la unidad pasa al valor y sale del rótulo.
      u <- regmatches(e$item$rotulo, regexec("^(.*?)\\s*\\(([^()]{1,20})\\)\\s*$", e$item$rotulo))[[1]]
      if (length(u) == 3L && grepl("^[0-9.,]+$", e$item$valor)) {
        e$item$valor <- paste(e$item$valor, u[3]); e$item$rotulo <- u[2]
      }
    }
    e
  })
  # Población (base por gráfico, reporte_plan_base_por_grafico.R): cada panel ya nombra su público y la lámina sólo
  # lleva la base que el analista declaró; juntar las notas de los cuatro paneles volvía a darles un denominador común.
  if (is.null(base) && !isTRUE(solo_base_declarada)) {
    # Las notas de los gráficos: la de la ruta de composición (nota_pie) o la que trae la espec (caption del ggplot).
    bases <- unique(unlist(c(lapply(els, function(el) texto(el$overrides$nota_pie %||% NULL)), lapply(especs, function(e) texto(e$nota)))))
    bases <- .lam_bases_sin_repetir(bases)
    base <- if (length(bases)) paste(bases, collapse = ". ") else NULL
  }
  enc <- .lam_mixta_encabezados(especs, els, titulo_de_var)
  # G9 (Gonzalo, 2026-10-13): si todos los gráficos son del mismo público con el mismo n, el n de cada panel repite lo
  # que ya dice la base de la lámina; basta con la de la esquina del documento.
  # Si el analista ocultó la base de la lámina, cada panel conserva la suya: sin ella no quedaría ninguna.
  publicos_todos <- enc$publicos
  if (!isTRUE((slide$meta %||% list())$suppress_base_placeholder) && .lam_mixta_publico_comun(especs, els)) {
    enc$publicos <- lapply(enc$publicos, function(x) NULL)
    if (is.null(base)) {
      notas <- unique(unlist(c(lapply(els, function(el) texto(el$overrides$nota_pie %||% NULL)), lapply(especs, function(e) texto(e$nota)))))
      if (length(notas) == 1L) base <- notas
    }
  }
  # D3 (checklist-poblacion-y-filtro, Gonzalo 2026-10-14: «que cada gráfico pueda permitir si incluye o no su base»): el
  # gráfico decide si su panel dice «172 respuestas» bajo el enunciado; sin decidir, la regla G9 de arriba.
  for (k in seq_along(els)) {
    mp <- (els[[k]]$overrides %||% list())$mostrar_publico
    if (isTRUE(mp)) enc$publicos[[k]] <- publicos_todos[[k]] else if (identical(mp, FALSE)) enc$publicos[k] <- list(NULL)
  }
  caben <- .lam_mixta_caben(especs, .lam_mixta_geo(tipo), els, titulo_de_var)
  respaldo <- lapply(seq_along(rendered), function(k) if (caben[k] || .lam_es_cifra(especs[[k]])) NULL else rendered[[k]])
  .lam_laminas_mixta(doc, especs, tipo, enc$preguntas, enc$publicos, respaldo = respaldo, titulo = texto(slots$title %||% slide$title) %||% "",
                     ante = texto((slide$meta %||% list())$antetitulo), base = base, folio = length(doc) + 1L)$doc
}

#' ¿Todos los gráficos de la lámina son del mismo público con el mismo n? (dos o más, sin contar las cifras sueltas)
#'
#' El público sale de la base de la referencia (`docentes$p3`); en un estudio de una base no hay prefijo y todos
#' comparten la misma.
#' @keywords internal
.lam_mixta_publico_comun <- function(especs, els = NULL) {
  graficos <- which(!vapply(especs, .lam_es_cifra, TRUE))
  if (length(graficos) < 2L) return(FALSE)
  ns <- vapply(especs[graficos], function(e) suppressWarnings(as.numeric(.espec_n_base(e))), 0)
  if (any(!is.finite(ns)) || length(unique(round(ns))) != 1L) return(FALSE)
  fuente <- function(el) {
    ref <- as.character(unlist(el$var %||% el$vars %||% ""))[1]
    if (is.na(ref) || !grepl("$", ref, fixed = TRUE)) "" else sub("\\$.*$", "", ref)
  }
  fuentes <- vapply(els[graficos[graficos <= length(els)]], fuente, "")
  length(unique(fuentes)) <= 1L
}

#' Bases de los gráficos de una lámina, sin repetir la misma
#'
#' «Base: 200» se descarta si otra dice «Base: 200 respuestas» (la contiene como prefijo de palabras enteras);
#' bases de públicos distintos con el mismo n («Base: 200 docentes», «Base: 200 estudiantes») y notas sin cifras
#' se conservan todas. Antes se comparaban sólo los dígitos y se perdían en silencio (verificador de N3).
#' @keywords internal
.lam_bases_sin_repetir <- function(bases) {
  bases <- unique(bases[!is.na(bases) & nzchar(bases)])
  if (length(bases) < 2L) return(bases)
  contenida <- vapply(seq_along(bases), function(i) {
    any(vapply(seq_along(bases)[-i], function(j) {
      b <- bases[i]; c <- bases[j]
      nchar(c) > nchar(b) && startsWith(c, b) && grepl("^[[:space:][:punct:]]", substr(c, nchar(b) + 1L, nchar(c)))
    }, TRUE))
  }, TRUE)
  bases <- bases[!contenida]
  # «Base: 172 estudiantes» y «Base: 172 respuestas» dicen lo mismo con dos unidades (la torta no sabe del público):
  # se queda la que nombra al público (checklist-poblacion-y-filtro, P1).
  generica <- grepl("^Base:\\s*[0-9.,]+\\s+respuestas\\.?$", bases)
  num <- function(b) sub("^Base:\\s*([0-9.,]+).*$", "\\1", b)
  repetida <- generica & vapply(seq_along(bases), function(i) any(!generica[-i] & num(bases[-i]) == num(bases[i])), TRUE)
  bases[!repetida]
}


#' P4: el panel de respaldo —enunciado arriba (o a la izquierda en la tira) y el rectángulo donde va su gráfico—
#' @return Lista con el gráfico sin título ni pie (la lámina los escribe) y su rectángulo.
#' @keywords internal
.lam_mixta_respaldo_caja <- function(lz, p, pregunta, publico, grafico) {
  lateral <- p$receta$lateral
  if (!is.null(lateral)) {
    if (!is.null(pregunta) && nzchar(pregunta)) .lam_panel_titulo(lz, p$x, p$y, lateral$w_titulo, pregunta, publico)
    q <- .lam_panel_lateral_rect(p); y0 <- q$y; x0 <- q$x; w0 <- q$w; h0 <- q$h
  } else {
    y_fin <- if (!is.null(pregunta) && nzchar(pregunta)) .lam_panel_titulo(lz, p$x, p$y, p$w, pregunta, publico) else p$y
    x0 <- p$x; w0 <- p$w; y0 <- y_fin + 0.1; h0 <- p$y + p$h - y0
  }
  # Sin título, subtítulo ni pie: el panel tiene su enunciado y la lámina su base (antes se repetía «Base: …» dentro).
  g <- tryCatch(grafico + ggplot2::labs(title = NULL, subtitle = NULL, caption = NULL) +
                  ggplot2::theme(plot.caption = ggplot2::element_blank(), plot.title = ggplot2::element_blank(),
                                 plot.subtitle = ggplot2::element_blank()), error = function(e) grafico)
  list(p = g, x = x0, y = y0, w = max(0.5, w0), h = max(0.5, h0))
}
