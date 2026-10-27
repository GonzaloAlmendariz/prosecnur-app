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
    st <- .lam_jer_estilo(espec, k, if (!is.null(cols) && !length(elegidas)) cols[k])   # TXT-26: temas y subtemas (lamina_barras_jerarquia.R)
    h <- .lam_alto_tinta(et[k], wlab, size, .std_negrita_forzada("categorias") || isTRUE(st$bold))   # tinta medida: la estimación por carácter subía el rótulo de una línea
    .lam_txt(lz, et[k], x, yy + (fila - h) / 2, wlab, h, size, st$color_rotulo %||% azul, bold = st$bold %||% es_max, align = "right", nombre = "rotulo")
    yb <- yy + (fila - g) / 2; bw <- if (escala > 0) wbar * v[k] / escala else 0
    fill <- st$fill %||% (if (!is.null(cols) && !length(elegidas)) cols[k] else if ((isTRUE(espec$realce) || length(elegidas)) && !es_max) tenue else azul)
    if (bw > 0.004) .lam_caja(lz, x + wlab + 0.12, yb, bw, g, fill, nombre = "barra")
    .lam_txt(lz, espec$cifras[k], x + wlab + 0.16 + bw, yb + (g - 0.3) / 2, wcif, 0.3, size, azul, bold = st$cifra_bold %||% TRUE, nombre = "cifra")
    yy <- yy + fila
  }
  # Marcas 0-25-50-75-100 % bajo las barras, opcionales con la escala de 0 a 100 % (Gonzalo, 2026-10-09: «A,bas y en
  # ambos recetarios»): gris claro, centradas en su posición del eje, como la variante fiel del recetario.
  if (isTRUE(espec$escala_completa) && isTRUE(espec$marcas_eje) && escala > 0) {
    for (t in seq(0, 100, 25)) .lam_txt(lz, paste0(t, "%"), x + wlab + 0.12 + wbar * (t / 100) / escala - 0.3, yy + 0.02, 0.6, 0.26, 9,
                                       .std_color("texto_tenue"), align = "center", nombre = "eje:marca")
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
  uf <- .lam_uso_area_fila(n, yf - yt - 0.45); fila <- uf$fila; g <- uf$g   # lamina_uso_area.R: crece hasta el tope
  nb <- .std_negrita_forzada("categorias") || .lam_jer_activa(espec)   # TXT-26: con jerarquía, la columna se mide en negrita
  wlab <- min(6.3, max(1.4, max(.lam_ancho_tinta(espec$rotulos, size, nb)) + 0.3))
  ancho <- g_("ancho") - g_("margen_izq") - g_("margen_der")   # CCSS-8 (lamina_barras_ancho.R): columna acotada y bloque a lo ancho
  r <- .lam_barras_ancho_rotulos(espec$rotulos, ancho, size, fila, nb, previa = wlab); wlab <- r$wlab; size <- r$size
  list(size = size, fila = fila, g = g, wlab = wlab, ancho_geo = .lam_barras_ancho_geo(espec, ancho, wlab, size))
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
  barras_ok <- geo$fila >= 0.26 && all(.lam_jer_altos(espec, geo$wlab, geo$size) <= geo$fila + 0.02)   # TXT-26: con jerarquía, por tinta
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
    ag <- geo$ancho_geo; xb <- ml + (ag$dx %||% 0)
    if (!is.null(encabezado) && nzchar(encabezado)) {
      .lam_txt(lz, encabezado, .lam_barras_ancho_x_encabezado(xb + wlab + 0.25, sub, titulo), yt - 0.25, 4, 0.26, .std_pt("antetitulo"), .std_color("texto_suave"), bold = TRUE, nombre = "encabezado")
    }
    y0 <- yt + .lam_uso_area_arranque(length(espec$largos), fila, extra = if (isTRUE(espec$escala_completa) && isTRUE(espec$marcas_eje)) 0.28 else 0)
    .lam_barras_h(lz, espec, xb, y0, ag$w %||% ancho, wlab = wlab, g = g, fila = fila, size = size, escala = ag$escala)
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:categorica")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' Dicotomía en columna: la misma barra partida, de pie, con cada cifra grande junto a su polo
#'
#' Variante vertical de `.lam_dicotomia` (Gonzalo, 2026-10-14: «en el caso dicotómico el estilo del gráfico puede ser
#' vertical u horizontal»). La primera categoría arriba y la segunda abajo; la cifra y su rótulo a la derecha de la
#' columna, la de arriba alineada con el borde superior y la de abajo con el inferior, como los polos de la horizontal.
#' @keywords internal
.lam_dicotomia_vertical <- function(lz, x, y, h, rotulos, cifras, largos, n = NULL, size = 40, w_col = 1.5,
                                    cols = .std_paleta("dicotomica")) {
  size <- round(size * 0.85)
  azul <- .std_color("azul"); medio <- .std_color("azul_medio")
  dico <- identical(toupper(cols), toupper(.std_paleta("dicotomica")))
  col_cifra <- if (dico) c(azul, medio) else vapply(cols[1:2], .lam_color_legible, "")
  et <- function(k) if (is.null(n) || !is.finite(n[k])) rotulos[k] else sprintf("%s (%d)", rotulos[k], as.integer(n[k]))
  h1 <- h * largos[1] / sum(largos[1:2])
  .lam_caja(lz, x, y, w_col, h1 + 0.004, cols[1], nombre = "dicotomia:segmento")
  .lam_caja(lz, x, y + h1, w_col, h - h1, cols[2], nombre = "dicotomia:segmento")
  xt <- x + w_col + 0.3; alto_cifra <- size * 1.3 / 72
  .lam_txt(lz, cifras[1], xt, y - 0.08, 2.4, alto_cifra, size, col_cifra[1], bold = TRUE, nombre = "dicotomia:cifra")
  .lam_txt(lz, et(1), xt, y - 0.08 + size * 1.25 / 72, 4, 0.32, 14, azul, bold = TRUE, nombre = "dicotomia:rotulo")
  y2 <- y + h - size * 1.25 / 72 - 0.36
  .lam_txt(lz, cifras[2], xt, y2, 2.4, alto_cifra, size, col_cifra[2], bold = TRUE, nombre = "dicotomia:cifra")
  .lam_txt(lz, et(2), xt, y2 + size * 1.25 / 72, 4, 0.32, 14, azul, bold = TRUE, nombre = "dicotomia:rotulo")
  invisible(y + h)
}

#' Un color de tramo que se lea como texto sobre el fondo claro de la lámina
#'
#' Si el color es claro (luminancia relativa sobre 0.4: el celeste del recetario, un amarillo), se oscurece mezclándolo con el azul de la casa; si no,
#' se usa tal cual.
#' @keywords internal
.lam_color_legible <- function(col) {
  rgb <- tryCatch(grDevices::col2rgb(col)[, 1] / 255, error = function(e) NULL)
  if (is.null(rgb)) return(.std_color("azul"))
  lum <- sum(c(0.2126, 0.7152, 0.0722) * ifelse(rgb <= 0.03928, rgb / 12.92, ((rgb + 0.055) / 1.055)^2.4))
  if (lum <= 0.4) return(col)
  az <- grDevices::col2rgb(.std_color("azul"))[, 1] / 255
  m <- 0.45 * az + 0.55 * rgb
  grDevices::rgb(m[1], m[2], m[3])
}

#' Dicotomía partida (recetario_piezas.R:38-49): cifra grande en cada extremo, rótulos debajo y la barra
#'
#' La primera categoría va en azul y la segunda en celeste; la barra mide las cifras rotuladas.
#' @keywords internal
.lam_dicotomia <- function(lz, x, y, w, rotulos, cifras, largos, n = NULL, size = 22, g = 0.34,
                           cols = .std_paleta("dicotomica"), size_rot = 10.5, alinear_texto = FALSE) {
  size <- round(size * 0.85)   # C14 y C19 del recetario: las cifras de la dicotomía, un poco más chicas
  azul <- .std_color("azul"); medio <- .std_color("azul_medio")
  dico <- identical(toupper(cols), toupper(.std_paleta("dicotomica")))
  # Cada cifra va en el color de su tramo, como el recetario (98 % azul sobre el azul, 2 % celeste sobre el celeste);
  # con la paleta del usuario la cifra seguía en azul fijo y no casaba con su barra (Gonzalo, 2026-10-14). Un tramo
  # muy claro escribe su cifra en un tono más hondo del mismo color para que se lea sobre el fondo.
  col_cifra <- if (dico) c(azul, medio) else vapply(cols[1:2], .lam_color_legible, "")
  et <- function(k) if (is.null(n) || !is.finite(n[k])) rotulos[k] else sprintf("%s (%d)", rotulos[k], as.integer(n[k]))
  xt <- if (isTRUE(alinear_texto)) x - .LAM_SANGRIA_TXT else x; wt <- if (isTRUE(alinear_texto)) w + 2 * .LAM_SANGRIA_TXT else w   # el texto cae sobre el borde de la barra (lamina_dicotomia_margenes.R)
  .lam_txt(lz, cifras[1], xt, y, 1.6, size * 1.3 / 72, size, col_cifra[1], bold = TRUE, nombre = "dicotomia:cifra")
  .lam_txt(lz, cifras[2], xt + wt - 1.6, y, 1.6, size * 1.3 / 72, size, col_cifra[2], bold = TRUE, align = "right",
           nombre = "dicotomia:cifra")
  # En la lámina completa el rótulo («Sí», «No») va a 14 pt en negrita: a 10.5 pt se perdía bajo una cifra de 34 pt
  # (Gonzalo, 2026-10-14). Los paneles (corona, mixtas) conservan los 10.5 pt medidos sobre el recetario.
  grande <- size_rot > 10.5
  yl <- y + size * 1.25 / 72; yb <- yl + if (grande) 0.38 else 0.32
  .lam_txt(lz, et(1), xt, yl, wt / 2, if (grande) 0.32 else 0.26, size_rot, azul, bold = grande, nombre = "dicotomia:rotulo")
  .lam_txt(lz, et(2), xt + wt / 2, yl, wt / 2, if (grande) 0.32 else 0.26, size_rot, azul, bold = grande, align = "right", nombre = "dicotomia:rotulo")
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
  if (is.null(espec) || !isTRUE(.lam_dicotomia_es_sino(espec))) return(FALSE)   # N20: solo Sí/No o declarada
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

#' Subtítulo «N público» de la dicotomía: sólo con «Respuestas por público» (`mostrar_respuestas`) encendido (N3b), como la escala
#' @keywords internal
.lam_dicotomia_publico <- function(n_pub, base_var, var, overrides = NULL, espec = NULL) {
  enc <- isTRUE((overrides %||% list())$mostrar_respuestas) || isTRUE(espec[["mostrar_respuestas"]])
  if (enc && is.finite(n_pub) && nzchar(base_var %||% "") && any(grepl("$", var %||% "", fixed = TRUE)))
    paste(format(round(n_pub), big.mark = ",", trim = TRUE), base_var)
}

#' Ancho (in) de la barra de una lámina con UNA sola pregunta Sí/No: la fracción del lienzo, acotada por márgenes simétricos
#' @keywords internal
.LAM_DICOTOMIA_UNICA_FRAC <- 0.85
.lam_dicotomia_unica_ancho <- function() {
  W <- .std_geom("ancho"); min(.LAM_DICOTOMIA_UNICA_FRAC * W, W - 2 * max(.std_geom("margen_izq"), .std_geom("margen_der")))
}

#' Lámina de una dicotomía a todo el ancho (lámina 74 del recetario, recetario_graficos2.R:20-25)
#'
#' La pregunta encabeza el panel con su público («176 egresados») y la barra partida va debajo, con cifras
#' de 40 pt y 0.7 in de grosor.
#' @keywords internal
.lam_laminas_dicotomia <- function(doc, espec, titulo, ante = NULL, pregunta = NULL, publico = NULL, base = NULL,
                                   folio = NULL, sub = NULL, layout = "Graficos2", master = "Office Theme",
                                   por_lamina = function(doc) doc, vertical = FALSE) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); ancho <- g_("ancho") - ml - g_("margen_der"); yt <- g_("zona_datos_y0")
  d <- .lam_dicotomia_datos(espec)
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  y <- yt + 1.1
  est <- identical(.lam_estilo_dicotomia(espec), "barra_estandar")
  if (est) {
    # Una sola pregunta Sí/No: el bloque (enunciado, barra, leyenda) se centra en la lámina y la barra aprovecha el ancho
    # (`.LAM_DICOTOMIA_UNICA_FRAC` de la lámina, sin pasar del margen izquierdo del estándar simétrico); el enunciado se alinea
    # al borde izquierdo de la barra y la leyenda va centrada a toda la lámina.
    W <- g_("ancho"); wb <- .lam_dicotomia_unica_ancho(); xb <- (W - wb) / 2
    hp <- if (!is.null(pregunta) && nzchar(pregunta)) 0.3 + 0.22 * (.lam_lineas(pregunta, wb, 13, TRUE) - 1) + (if (!is.null(publico) && nzchar(publico)) 0.26 else 0) else 0
    bloque <- hp + (if (hp > 0) 0.25 else 0) + 0.5 + 0.12 + 0.3
    yp <- yt + max(0, (g_("contenido_y1") - yt - bloque) / 2)
    if (hp > 0) .lam_panel_titulo(lz, xb, yp, wb, pregunta, publico)
    y <- yp + hp + (if (hp > 0) 0.25 else 0)
    .lam_dicotomia_estandar(lz, xb, y, wb, d$rotulos, d$cifras, d$largos, d$n, g = 0.5, size = .std_pt("cifra"), cols = d$colores,
                            x_ley = ml, w_ley = ancho, centro_ley = W / 2)
  } else if (isTRUE(vertical)) {
    if (!is.null(pregunta) && nzchar(pregunta)) .lam_panel_titulo(lz, ml, yt + 0.3, ancho, pregunta, publico)
    .lam_dicotomia_vertical(lz, ml + 0.4, y, g_("contenido_y1") - y - 0.15, d$rotulos, d$cifras, d$largos, d$n,
                            size = 40, cols = d$colores)
  } else {
    mg <- .lam_dicotomia_partida_geo(!is.null(pregunta) && nzchar(pregunta))   # lamina_dicotomia_margenes.R: mismo margen a ambos lados, centrada
    if (!is.null(pregunta) && nzchar(pregunta)) .lam_panel_titulo(lz, ml, yt + 0.3 + mg$dy, ancho, pregunta, publico)
    .lam_dicotomia(lz, mg$x, y + mg$dy, mg$w, d$rotulos, d$cifras, d$largos, d$n, size = 40, g = 0.7, cols = d$colores, size_rot = 14,
                   alinear_texto = TRUE)
  }
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
  # CCSS-2: el histograma cuenta sus casos válidos sin ponderar por valor (`conteos`); su suma es el público del panel.
  if (identical(espec$tipo, "histograma")) { cn <- suppressWarnings(as.numeric(espec$conteos)); return(if (any(is.finite(cn))) sum(cn, na.rm = TRUE) else NA_real_) }
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


#' CCSS-24: barras horizontales compactas para una categórica en una celda chica (grilla de seis, 3.91 x 1.75 in)
#'
#' Cuando las barras del recetario no caben (fila bajo 0.30 in o rótulo en dos líneas) y el panel no es lo bastante ancho
#' para columnas, el panel caía a su ggplot de columnas, que en 1.17 in de alto útil las aplastaba hasta rayas de 3 px.
#' Aquí se prueban, antes de caer, filas que usan todo el alto del panel (piso 0.20 in), barras del 70 % de la fila y
#' rótulos a 11, 10.5 o 10 pt con su columna hasta el 55 % del panel. Sólo para celdas chicas sin receta propia.
#' @param barras La geometría que no cupo (`.lam_panel_geo`).
#' @param fin Borde inferior del panel. @param x,y,w,h El panel.
#' @return La geometría compacta si cabe; si no, `NULL` (y el panel sigue a su ruta anterior).
#' @keywords internal
.lam_panel_barras_compactas <- function(espec, barras, fin, w, h, x = NULL, y = NULL) {
  if (!is.list(barras) || isTRUE(barras$cabe) || !is.null(barras$receta) || !is.finite(h) || h >= 2.5 || w >= 6) return(NULL)
  # Acotado a las celdas ANGOSTAS (hasta 4.5 in, un tercio de lámina), donde el respaldo de columnas se aplasta. No a una
  # geometría fija: con un título de tres líneas (CCSS-25) la grilla de seis baja sus paneles y la celda deja de coincidir
  # con `poblacion_6` (CCSS-24 reabierto). La celda ancha de la grilla de cinco del informe Arte (lámina 2, «¿Cuál es su
  # categoría académica?», ~6 in) sale por su respaldo de barras horizontales y no cambia.
  if (w > 4.5) return(NULL)
  n <- length(espec$largos); if (n < 1L || n > 6L) return(NULL)
  nb <- .std_negrita_forzada("categorias")
  fila <- min(0.5, (fin - barras$y0) * 0.95 / n)
  if (fila < 0.2) return(NULL)   # 10 pt en una línea caben en 0.2 in; bajo eso, el respaldo
  g <- min(.std_grosor(n, "categorias"), fila * 0.7)
  for (size in c(11, 10.5, 10)) {
    wlab <- min(w * 0.55, max(0.6, max(.lam_ancho_tinta(espec$rotulos, size, nb)) + 0.3))
    altos <- vapply(espec$rotulos, function(r) .lam_alto_tinta(r, wlab, size, nb), 0)
    if (all(altos - 0.1 <= fila - 0.02)) {
      return(utils::modifyList(barras, list(fila = fila, g = g, wlab = wlab, size = size, cabe = TRUE, compacta = TRUE)))
    }
  }
  NULL
}

#' ¿El panel es una celda de la grilla `tipo` (`.lam_mixta_geo`)? Misma comparación que `.lam_circular_d_grilla`
#' @keywords internal
.lam_panel_en_grilla <- function(x, y, w, h, tipo = "poblacion_6") {
  if (is.null(x) || is.null(y)) return(FALSE)
  P <- tryCatch(.lam_mixta_geo(tipo)$paneles, error = function(e) NULL)
  length(P) > 0L && any(vapply(P, function(p) abs(p$x - x) < 1e-3 && abs(p$y - y) < 1e-3 && abs(p$w - w) < 1e-3 && abs(p$h - h) < 1e-3, TRUE))
}
