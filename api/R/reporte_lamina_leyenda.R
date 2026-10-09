# =============================================================================
# reporte_lamina_leyenda.R — la leyenda como parte de la lámina (ADR 0092, F3)
# =============================================================================
#
# Pregunta de Gonzalo (2026-10-08): «por qué en el recetario se ve tan bien y en
# las imágenes la leyenda se ve tan diferente». El recetario dibuja la leyenda
# con formas nativas de la lámina (recetario.R:143-153, `leyenda()`): cuadro de
# 0.15 in, texto a 12 pt, 0.3 in entre ítems, centrada en el bloque. El motor la
# dibujaba DENTRO de la imagen del gráfico, así que escalaba con el lienzo: en
# una batería larga el lienzo se encoge al colocarse y la letra bajaba a ~7 pt.
#
# Aquí la lámina la reemplaza: quita del gráfico las capas de su leyenda (las
# declara el graficador en `attr(, "pulso_leyenda_nativa")`) y la dibuja con
# formas nativas en la MISMA banda y con el mismo centro. Los ítems se reparten
# de nuevo a su tamaño real dentro del ancho de la imagen: las filas que el
# graficador calculó eran para su letra chica, y reusarlas a 12 pt montaba los
# ítems unos sobre otros en los paneles angostos (verificador de F2, 3.ª ronda).
# Si ni a 10 pt cabe en la banda, se queda la leyenda de la imagen.
# Sin el atributo no hace nada: los gráficos que no lo declaran no cambian.

.LEYENDA_CUADRO_IN <- 0.15
.LEYENDA_SEPARACION_IN <- 0.3

#' Ancho de tinta de un texto en pulgadas
#'
#' Medido con `systemfonts` como `ancho_tinta()` del recetario (recetario.R:142,
#' Gonzalo 2026-10-07: «la leyenda no están centradas» con la estimación por
#' caracteres, que sobrestima ~5 %). Si la fuente no se puede medir, estima.
#' @keywords internal
.leyenda_ancho_tinta <- function(s, size_pt, fuente = .std_pt("fuente")) {
  medido <- tryCatch(systemfonts::string_width(s, family = fuente, size = size_pt, res = 72) / 72,
                     error = function(e) NULL)
  if (is.numeric(medido) && length(medido) == length(s) && all(is.finite(medido))) return(medido)
  nchar(s, type = "width") * size_pt * 0.52 / 72
}

#' El dml sin las capas de su leyenda, si el gráfico la declara
#' @keywords internal
.ppt_quitar_leyenda <- function(value) {
  g <- value$ggobj
  info <- if (inherits(g, "ggplot")) attr(g, "pulso_leyenda_nativa") else NULL
  if (is.null(info) || !length(info$capas)) return(value)
  g$layers <- g$layers[-info$capas]
  value$ggobj <- g
  value
}

#' Dónde va cada ítem de la leyenda nativa, o NULL si no cabe
#'
#' Prueba 12, 11 y 10 pt. Para cada tamaño busca el menor número de filas
#' (repartidas en orden y parejas, `.barras_leyenda_reparto`) con el que cada
#' fila cabe en el ancho de la imagen, y exige que esas filas quepan en el alto
#' de la banda que la leyenda ocupaba en la imagen.
#' @return lista con `size`, `items` (data.frame left/top/ancho por ítem) o NULL.
#' @keywords internal
.ppt_leyenda_plan <- function(info, loc) {
  n <- length(info$etiquetas)
  if (!n || is.null(info$banda_npc)) return(NULL)
  ancho_max <- loc$width - 0.1
  banda_top <- loc$top + (1 - info$banda_npc[["y0"]] - info$banda_npc[["alto"]]) * loc$height
  banda_alto <- info$banda_npc[["alto"]] * loc$height
  for (size in c(.std_pt("leyenda"), 11, 10)) {
    anchos <- .leyenda_ancho_tinta(info$etiquetas, size)
    w_items <- .LEYENDA_CUADRO_IN + 0.07 + anchos
    alto_fila <- size * 1.45 / 72
    for (k in seq_len(n)) {
      filas <- .barras_leyenda_reparto(n, k)
      totales <- vapply(seq_len(k), function(r) {
        sum(w_items[filas == r]) + .LEYENDA_SEPARACION_IN * (sum(filas == r) - 1L)
      }, numeric(1))
      if (all(totales <= ancho_max)) break
    }
    if (any(totales > ancho_max)) next
    # Centrada en su banda si cabe; si no, arranca en el techo de la banda y baja
    # al aire libre de debajo. 0.04 in de holgura: la banda se medía con su letra.
    alto_leyenda <- k * alto_fila
    libre_abajo <- (info$libre_abajo_npc %||% 0) * loc$height
    if (alto_leyenda > banda_alto + libre_abajo + 0.04) next
    y0 <- if (alto_leyenda <= banda_alto) banda_top + banda_alto / 2 - alto_leyenda / 2 else banda_top
    left <- numeric(n); top <- numeric(n)
    for (r in seq_len(k)) {
      idx <- which(filas == r)
      x <- loc$left + info$x_centro_npc * loc$width - totales[[r]] / 2
      x <- max(loc$left, min(x, loc$left + loc$width - totales[[r]]))
      for (i in idx) {
        left[i] <- x; top[i] <- y0 + (r - 0.5) * alto_fila
        x <- x + w_items[i] + .LEYENDA_SEPARACION_IN
      }
    }
    return(list(size = size, items = data.frame(left = left, centro_y = top, ancho = anchos)))
  }
  NULL
}

#' Coloca un dml y, si declara su leyenda y ésta cabe, la dibuja nativa
#'
#' @param colocar La función con que la lámina coloca el dml (`.ph_with_dml_safe`).
#' @keywords internal
.ppt_colocar_dml <- function(doc, value, loc, colocar) {
  g <- value$ggobj
  info <- if (inherits(g, "ggplot")) attr(g, "pulso_leyenda_nativa") else NULL
  plan <- if (is.null(info)) NULL else .ppt_leyenda_plan(info, loc)
  if (is.null(plan)) return(colocar(doc, value = value, location = loc))
  doc <- colocar(doc, value = .ppt_quitar_leyenda(value), location = loc)
  .ppt_leyenda_nativa(doc, info, plan)
}

#' Dibuja la leyenda nativa con el reparto de `.ppt_leyenda_plan`
#'
#' El texto va en una caja del alto de su fila, sin márgenes internos, centrada
#' en vertical y sin ajuste de línea: así la caja mide lo que la tinta y las
#' filas no se montan.
#' @keywords internal
.ppt_leyenda_nativa <- function(doc, info, plan) {
  azul <- .std_color("azul")
  fuente <- .std_pt("fuente")
  it <- plan$items
  alto_fila <- plan$size * 1.45 / 72
  for (i in seq_len(nrow(it))) {
    doc <- officer::ph_with(doc, value = "", location = officer::ph_location(
      left = it$left[i], top = it$centro_y[i] - .LEYENDA_CUADRO_IN / 2, width = .LEYENDA_CUADRO_IN,
      height = .LEYENDA_CUADRO_IN, bg = info$colores[[i]], newlabel = paste0("prosecnur:leyenda:cuadro:", i)))
    etiqueta <- paste0("prosecnur:leyenda:texto:", i)
    doc <- officer::ph_with(doc, value = officer::fpar(officer::ftext(
      info$etiquetas[[i]], officer::fp_text(color = azul, font.size = plan$size, font.family = fuente))),
      location = officer::ph_location(
        left = it$left[i] + .LEYENDA_CUADRO_IN + 0.07, top = it$centro_y[i] - alto_fila / 2,
        width = it$ancho[i] + 0.04, height = alto_fila, newlabel = etiqueta))
    .leyenda_caja_ajustada(doc, etiqueta)
  }
  doc
}

#' Deja la caja de texto recién puesta sin márgenes, centrada y sin ajuste
#' @keywords internal
.leyenda_caja_ajustada <- function(doc, etiqueta) {
  xml <- doc$slide$get_slide(doc$cursor)$get()
  ns <- xml2::xml_ns(xml)
  cajas <- xml2::xml_find_all(xml, sprintf(".//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]/p:txBody/a:bodyPr", etiqueta), ns)
  if (!length(cajas)) return(invisible(doc))
  caja <- cajas[[length(cajas)]]
  for (a in c("lIns", "tIns", "rIns", "bIns")) xml2::xml_set_attr(caja, a, "0")
  xml2::xml_set_attr(caja, "anchor", "ctr")
  xml2::xml_set_attr(caja, "wrap", "none")
  invisible(doc)
}
