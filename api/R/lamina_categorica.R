# =============================================================================
# lamina_categorica.R — categóricas del recetario dibujadas desde la especificación (ADR 0093, N3)
# =============================================================================
#
# Columnas verticales de un color para la pregunta categórica (recetario_m3a.R:6-18, lámina 68) y barras
# horizontales para la de una serie (`barras_h()`, recetario.R:182-209, lámina 73). Las cifras salen de
# `preparar_categorica()`; aquí sólo se ubican.

#' Columnas verticales: eje tenue, columna navy, cifra de 16 pt encima, «N <público>» de 10 pt y rótulo debajo
#' @keywords internal
.lam_columnas <- function(lz, espec, x0, ybase, wv, hmax = 3.4, unidad_n = "respuestas") {
  n_ <- length(espec$largos); if (!n_) return(invisible(lz))
  paso <- wv / n_; wcol <- paso * 0.56
  esc <- max(espec$largos) * 1.1
  azul <- .std_color("azul"); tenue <- .std_color("texto_tenue")
  cols <- .espec_colores_de(espec)   # ADR 0097: la paleta del usuario, si la espec la trae; si no, navy
  .lam_caja(lz, x0 - 0.1, ybase, wv + 0.2, 0.012, tenue, nombre = "eje")
  for (k in seq_len(n_)) {
    hk <- if (esc > 0) hmax * espec$largos[k] / esc else 0
    xk <- x0 + (k - 1) * paso + (paso - wcol) / 2
    elegidas <- espec$resaltar %||% character(0)
    fill <- if (length(elegidas)) (if (espec$rotulos[k] %in% elegidas) azul else .std_color("tenue")) else if (is.null(cols)) azul else cols[k]
    if (hk > 0.004) .lam_caja(lz, xk, ybase - hk, wcol, hk, fill, nombre = "columna")
    .lam_txt(lz, espec$cifras[k], xk - 0.3, ybase - hk - 0.42, wcol + 0.6, 0.36, 16, azul, bold = TRUE, align = "center", nombre = "cifra")
    nk <- .espec_casos(espec)[k]   # casos sin ponderar (contrato base-sin-ponderar F6)
    if (is.finite(nk)) {
      .lam_txt(lz, sprintf("%s %s", format(as.integer(nk), big.mark = ","), unidad_n), xk - 0.4, ybase - hk - 0.68,
               wcol + 0.8, 0.26, .std_pt("n"), tenue, align = "center", nombre = "n")
    }
    .lam_txt(lz, espec$rotulos[k], xk - 0.4, ybase + 0.1, wcol + 0.8, max(0.3, .lam_alto_txt(espec$rotulos[k], wcol + 0.8, 12, TRUE)), 12,
             azul, bold = TRUE, align = "center", nombre = "rotulo")
  }
  invisible(lz)
}

#' Barras horizontales de una serie: rótulo a la derecha, barra y cifra; la mayor en navy y negrita y el resto
#' tenue cuando la especificación pide realce
#' @keywords internal
.lam_barras_h <- function(lz, espec, x, y, w, wlab, g, fila, size = 12, escala = NULL) {
  v <- espec$largos; et <- espec$rotulos
  # Las agrupadas van de 0 a 100 % por defecto (`escala_completa`); el resto, al máximo con aire, como el recetario.
  escala <- escala %||% (if (isTRUE(espec$escala_completa)) max(1, v) else max(v) * 1.12)
  # La cifra lleva su propia columna: 0.8 in, o lo que mida si trae «(n)» o letras (no se parte en dos líneas).
  wcif <- max(0.8, max(.lam_ancho_txt(espec$cifras, size, TRUE)) + 0.12)
  wbar <- w - wlab - wcif; yy <- y
  azul <- .std_color("azul"); tenue <- .std_color("tenue")
  cols <- .espec_colores_de(espec, et)   # ADR 0097: con paleta del usuario cada barra lleva su color (y no hay tenue)
  elegidas <- espec$resaltar %||% character(0)   # D1: las que el analista resalta mandan sobre «la mayor»
  for (k in seq_along(et)) {
    es_max <- if (length(elegidas)) et[k] %in% elegidas else isTRUE(espec$realce) && v[k] == max(v)
    h <- .lam_alto_tinta(et[k], wlab, size)   # tinta medida: la estimación por carácter subía el rótulo de una línea
    .lam_txt(lz, et[k], x, yy + (fila - h) / 2, wlab, h, size, azul, bold = es_max, align = "right", nombre = "rotulo")
    yb <- yy + (fila - g) / 2; bw <- if (escala > 0) wbar * v[k] / escala else 0
    fill <- if (!is.null(cols) && !length(elegidas)) cols[k] else if ((isTRUE(espec$realce) || length(elegidas)) && !es_max) tenue else azul
    if (bw > 0.004) .lam_caja(lz, x + wlab + 0.12, yb, bw, g, fill, nombre = "barra")
    .lam_txt(lz, espec$cifras[k], x + wlab + 0.16 + bw, yb + (g - 0.3) / 2, wcif, 0.3, size, azul, bold = TRUE, nombre = "cifra")
    yy <- yy + fila
  }
  # Marcas 0-25-50-75-100 % bajo las barras, opcionales con la escala de 0 a 100 % (Gonzalo, 2026-10-09: «A,bas y en
  # ambos recetarios»): gris claro, centradas en su posición del eje, como la variante fiel del recetario.
  if (isTRUE(espec$escala_completa) && isTRUE(espec$marcas_eje) && escala > 0) {
    for (t in seq(0, 100, 25)) .lam_txt(lz, paste0(t, "%"), x + wlab + 0.12 + wbar * (t / 100) / escala - 0.3, yy + 0.02, 0.6, 0.26, 9,
                                       "#A6A6A6", align = "center", nombre = "eje:marca")
    yy <- yy + 0.28
  }
  invisible(yy)
}

#' Geometría de las barras de la lámina 73 para una especificación
#' @keywords internal
.lam_barras_geo <- function(espec) {
  g_ <- .std_geom; yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  n <- max(1L, length(espec$largos))
  size <- if (any(nchar(espec$rotulos) > 45)) 11 else 12
  fila <- min(0.62, (yf - yt - 0.45) / n); g <- min(0.42, fila * 0.62)
  wlab <- min(6.3, max(1.4, max(.lam_ancho_tinta(espec$rotulos, size)) + 0.3))
  list(size = size, fila = fila, g = g, wlab = wlab)
}

#' ¿En qué forma cabe la categórica? Columnas (lámina 68), barras (lámina 73) o ninguna (`NA`)
#'
#' Las columnas exigen que cada rótulo quepa en dos líneas bajo su columna; si no, la pregunta va en barras,
#' como hace el recetario con los rótulos largos. Las barras exigen que cada rótulo quepa en su fila. Si
#' tampoco, la lámina sigue por la ruta anterior.
#' @keywords internal
.lam_categorica_forma <- function(espec, preferida = c("columnas", "barras")) {
  preferida <- match.arg(preferida)
  k <- length(espec$largos); if (!k) return(NA_character_)
  g_ <- .std_geom; ancho <- g_("ancho") - g_("margen_izq") - g_("margen_der")
  wbox <- (ancho - 1.2) / k * 0.56 + 0.8
  cols_ok <- k <= 10L && all(vapply(espec$rotulos, function(r) .lam_alto_txt(r, wbox, 12, TRUE) <= 0.62, TRUE))
  geo <- .lam_barras_geo(espec)
  barras_ok <- geo$fila >= 0.26 && all(vapply(espec$rotulos, function(r) .lam_alto_txt(r, geo$wlab, geo$size) <= geo$fila + 0.02, TRUE))
  if (identical(preferida, "columnas") && cols_ok) return("columnas")
  if (barras_ok) return("barras")
  if (cols_ok) return("columnas")
  NA_character_
}

#' Lámina de una categórica, en columnas (pregunta categórica) o en barras (una serie)
#'
#' Barras: la geometría de la lámina 73 del recetario (recetario_m3a.R:98-101): fila = (6.72 − 1.65 − 0.45) / n
#' con un tope de 0.62 in, barra = mín(0.42, fila × 0.62), rótulo de hasta 6.3 in (11 pt si los rótulos son largos)
#' y, en selección múltiple, el encabezado «% de encuestados que marcó cada opción».
#' @keywords internal
.lam_laminas_categorica <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                    forma = c("columnas", "barras"), unidad_n = "respuestas", encabezado = NULL,
                                    layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio); forma <- match.arg(forma)
  g_ <- .std_geom; ml <- g_("margen_izq"); ancho <- g_("ancho") - ml - g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  if (identical(forma, "columnas")) {
    # La columna más alta, con su cifra y su n encima, no sube de la zona de datos: en la lámina de siempre manda el
    # alto del recetario (3.4); con una narrativa arriba (N7), la zona baja y las columnas se acortan.
    .lam_columnas(lz, espec, x0 = ml + 0.6, ybase = 6.05, wv = ancho - 1.2, hmax = min(3.4, (6.05 - 0.68 - yt) * 1.1), unidad_n = unidad_n)
  } else {
    geo <- .lam_barras_geo(espec); size <- geo$size; fila <- geo$fila; g <- geo$g; wlab <- geo$wlab
    if (!is.null(encabezado) && nzchar(encabezado)) {
      .lam_txt(lz, encabezado, ml + wlab + 0.25, yt - 0.25, 4, 0.26, .std_pt("antetitulo"), .std_color("texto_suave"), bold = TRUE, nombre = "encabezado")
    }
    .lam_barras_h(lz, espec, ml, yt + 0.2, ancho, wlab = wlab, g = g, fila = fila, size = size)
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:categorica")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' Dicotomía partida (recetario_piezas.R:38-49): cifra grande en cada extremo, rótulos debajo y la barra
#'
#' La primera categoría va en azul y la segunda en celeste; la barra mide las cifras rotuladas.
#' @keywords internal
.lam_dicotomia <- function(lz, x, y, w, rotulos, cifras, largos, n = NULL, size = 22, g = 0.34,
                           cols = .std_paleta("dicotomica")) {
  size <- round(size * 0.85)   # C14 y C19 del recetario: las cifras de la dicotomía, un poco más chicas
  azul <- .std_color("azul"); medio <- .std_color("azul_medio")
  dico <- identical(toupper(cols), toupper(.std_paleta("dicotomica")))
  et <- function(k) if (is.null(n) || !is.finite(n[k])) rotulos[k] else sprintf("%s (%d)", rotulos[k], as.integer(n[k]))
  .lam_txt(lz, cifras[1], x, y, 1.6, size * 1.3 / 72, size, if (dico) azul else medio, bold = TRUE, nombre = "dicotomia:cifra")
  .lam_txt(lz, cifras[2], x + w - 1.6, y, 1.6, size * 1.3 / 72, size, if (dico) medio else azul, bold = TRUE, align = "right",
           nombre = "dicotomia:cifra")
  yl <- y + size * 1.25 / 72; yb <- yl + 0.32
  .lam_txt(lz, et(1), x, yl, w / 2, 0.26, 10.5, azul, nombre = "dicotomia:rotulo")
  .lam_txt(lz, et(2), x + w / 2, yl, w / 2, 0.26, 10.5, azul, align = "right", nombre = "dicotomia:rotulo")
  w1 <- w * largos[1] / sum(largos[1:2])
  .lam_caja(lz, x + w1, yb, w - w1, g, cols[2], nombre = "dicotomia:segmento")
  .lam_caja(lz, x, yb, w1 + 0.004, g, cols[1], nombre = "dicotomia:segmento")
  invisible(yb + g)
}

#' ¿La especificación es una dicotomía? Dos categorías dibujadas que reparten el 100 % de una sola fila
#'
#' Categórica: exactamente dos categorías cuyos porcentajes suman 100 (con selección múltiple la barra
#' partida contradiría a sus cifras). Escala: una sola fila y exactamente dos categorías dibujadas.
#' @keywords internal
.lam_es_dicotomia <- function(espec) {
  if (is.null(espec)) return(FALSE)
  if (identical(espec$tipo, "categorica")) {
    return(length(espec$largos) == 2L && abs(sum(espec$valores) - 1) < 0.02)
  }
  # Escala: la escala misma tiene dos categorías (Sí/No), no una de cuatro con dos en cero; y sin Top Two Box,
  # que es pieza de la escala (verificador de N3).
  if (identical(espec$tipo, "escala") && NROW(espec$filas) == 1L && is.null(espec$box2$cifras) && is.null(espec$box$unidades) &&
      isFALSE(any(espec$filas$es_total))) {
    propias <- which(!(espec$categorias$especial %in% TRUE)); k <- which(espec$dibujar[1, ])
    return(length(propias) == 2L && identical(sort(unname(k)), sort(propias)))
  }
  FALSE
}

#' Las piezas de una dicotomía (rótulos, cifras, largos, n, colores) desde cualquiera de las dos especificaciones
#'
#' `colores` es la paleta del usuario por rótulo (ADR 0097) o la dicotómica del recetario si la espec no la trae.
#' @keywords internal
.lam_dicotomia_datos <- function(espec) {
  if (identical(espec$tipo, "categorica")) {
    # La frecuencia va en el rótulo («Sí (172)»): si la cifra la trae («62% (124)», mostrar_n_en_etiquetas), se quita.
    return(list(rotulos = espec$rotulos, cifras = sub("\\s*\\([^)]*\\)\\s*$", "", espec$cifras), largos = espec$largos,
                n = if (any(grepl("\\(", espec$cifras)) || .casos_junto_decidir(espec$casos_mostrar, .espec_n_base(espec))) .espec_casos(espec) else NULL,   # «(n)» pedido en el gráfico o por el ajuste
                colores = .espec_colores_de(espec) %||% .std_paleta("dicotomica")))
  }
  k <- which(espec$dibujar[1, ])
  # La especificación de escala no guarda la frecuencia de cada categoría: los rótulos van sin «(n)».
  list(rotulos = espec$categorias$rotulo[k], cifras = unname(espec$cifras[1, k]), largos = unname(espec$anchos[1, k]), n = NULL,
       colores = .espec_colores_de(espec, espec$categorias$rotulo[k]) %||% .std_paleta("dicotomica"))
}

#' Lámina de una dicotomía a todo el ancho (lámina 74 del recetario, recetario_graficos2.R:20-25)
#'
#' La pregunta encabeza el panel con su público («176 egresados») y la barra partida va debajo, con cifras
#' de 40 pt y 0.7 in de grosor.
#' @keywords internal
.lam_laminas_dicotomia <- function(doc, espec, titulo, ante = NULL, pregunta = NULL, publico = NULL, base = NULL,
                                   folio = NULL, sub = NULL, layout = "Graficos2", master = "Office Theme",
                                   por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); ancho <- g_("ancho") - ml - g_("margen_der"); yt <- g_("zona_datos_y0")
  d <- .lam_dicotomia_datos(espec)
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  y <- yt + 1.1
  if (!is.null(pregunta) && nzchar(pregunta)) .lam_panel_titulo(lz, ml, yt + 0.3, ancho, pregunta, publico)
  .lam_dicotomia(lz, ml, y, ancho, d$rotulos, d$cifras, d$largos, d$n, size = 40, g = 0.7, cols = d$colores)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:dicotomia")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' Casos de la base de una categórica: los que respondieron, no la suma de marcas
#'
#' Casos sin ponderar (contrato base-sin-ponderar F6): manda `n_base_casos` cuando la especificación la trae. Sin ella
#' se reconstruye desde los casos de cada categoría: en respuesta única es su suma; en selección múltiple las
#' frecuencias suman marcas y la base se recupera de cualquier categoría con frecuencia y porcentaje (n / proporción),
#' exacta sólo sin peso (con peso la proporción es ponderada y los casos no).
#' @keywords internal
.espec_n_base <- function(espec) {
  if (identical(espec$tipo, "escala")) return(if (NROW(espec$filas) == 1L) .espec_casos(espec$filas)[1] else NA_real_)
  nb <- suppressWarnings(as.numeric(espec[["n_base_casos"]] %||% NA_real_)[1])
  if (is.finite(nb) && nb > 0) return(nb)
  n <- suppressWarnings(as.numeric(.espec_casos(espec))); v <- suppressWarnings(as.numeric(espec$valores))
  ok <- is.finite(n) & is.finite(v) & v > 0
  if (!any(ok)) return(NA_real_)
  if (sum(v) <= 1.02) return(sum(n[ok]))
  round(stats::median(n[ok] / v[ok]))
}

#' ¿La dicotomía cabe en un ancho? Es dicotomía y cada rótulo (con su «(n)») entra en una línea en su mitad
#' @keywords internal
.lam_dicotomia_cabe <- function(espec, w, con_n = TRUE) {
  if (!.lam_es_dicotomia(espec)) return(FALSE)
  d <- .lam_dicotomia_datos(espec)
  et <- if (isTRUE(con_n) && !is.null(d$n) && all(is.finite(d$n))) sprintf("%s (%d)", d$rotulos, as.integer(d$n)) else d$rotulos
  all(.lam_ancho_txt(et, 10.5) <= w / 2 - 0.1)
}

#' Lámina de ranking con puntos (lámina 72, recetario_m3a.R:81-95)
#'
#' Rótulos a la derecha en una columna de 6.3 in, guías cada 10 % con su cifra arriba, un tallo fino y un punto
#' por opción con su cifra a la derecha; las residuales («Otros», «No sabe») en gris claro y al final.
#' @keywords internal
.lam_laminas_lollipop <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL, encabezado = NULL,
                                  layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); mr <- g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  azul <- .std_color("azul"); tenue <- .std_color("texto_tenue")
  lab <- espec$rotulos; pc <- espec$largos * 100; k <- length(lab); cols_u <- .espec_colores_de(espec, lab)
  wl <- 6.3; xs <- ml + wl + 0.25; ws <- W - mr - xs - 0.7; fl <- (yf - yt - 0.45) / k
  esc <- max(10, ceiling(max(pc) / 10) * 10)
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  for (v in seq(0, esc, 10)) {
    xv <- xs + ws * v / esc
    .lam_caja(lz, xv, yt + 0.35, 0.006, k * fl, .std_color("filete"), nombre = "lollipop:guia")
    .lam_txt(lz, paste0(v, "%"), xv - 0.3, yt + 0.05, 0.6, 0.24, 10, tenue, align = "center", nombre = "lollipop:eje")
  }
  for (i in seq_len(k)) {
    yc <- yt + 0.35 + (i - 0.5) * fl; xv <- xs + ws * pc[i] / esc
    # Las que el analista resalta van en coral (como la ruta anterior); las residuales, en gris.
    # Con paleta del usuario (ADR 0097) cada punto lleva el color de su opción; el resaltado sigue en coral.
    col <- if (lab[i] %in% (espec$resaltar %||% character(0))) .std_color("coral") else if (!is.null(cols_u)) cols_u[i] else
      if (grepl(.CATEGORIAS_RESIDUALES, lab[i], ignore.case = TRUE)) tenue else azul
    hl <- .lam_alto_txt(lab[i], wl, 11)
    .lam_txt(lz, lab[i], ml, yc - hl / 2, wl, hl, 11, azul, align = "right", nombre = "lollipop:rotulo")
    .lam_caja(lz, xs, yc - 0.012, max(0.002, xv - xs), 0.024, col, nombre = "lollipop:tallo")
    .lam_caja(lz, xv - 0.1, yc - 0.1, 0.2, 0.2, col, nombre = "lollipop:punto", geom = "ellipse")
    .lam_txt(lz, espec$cifras[i], xv + 0.14, yc - 0.15, 0.7, 0.3, 12, azul, bold = TRUE, nombre = "lollipop:cifra")
  }
  if (!is.null(encabezado) && nzchar(encabezado)) .lam_txt(lz, encabezado, xs, yt - 0.25, ws, 0.26, 10, .std_color("texto_suave"), bold = TRUE,
                                                           nombre = "lollipop:encabezado")
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:lollipop")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' ¿El ranking con puntos cabe? Hasta 15 opciones con rótulos en su fila (dos líneas a 11 pt en 6.3 in)
#' @keywords internal
.lam_lollipop_cabe <- function(espec) {
  k <- length(espec$rotulos); fl <- (.std_geom("contenido_y1") - .std_geom("zona_datos_y0") - 0.45) / max(1L, k)
  k >= 1L && k <= 15L && all(vapply(espec$rotulos, function(r) .lam_alto_txt(r, 6.3, 11) <= max(fl, 0.4) + 0.03, TRUE)) &&
    all(vapply(espec$rotulos, function(r) .lam_lineas(r, 6.3, 11) <= 2L, TRUE))
}
