# =============================================================================
# lamina_marco.R — la lámina del recetario para los gráficos que siguen en ggplot (ADR 0093, N6)
# =============================================================================
#
# La nube, la serie de varias mediciones, el radar o el mapa los dibuja el propio
# recetario con ggplot (recetario_graficos2.R:27-33, recetario_m3c.R:66-73). Su
# lámina, en cambio, es la del recetario: antetítulo y título, el gráfico en la zona
# de datos y la base con el folio al pie. Antes salían en la lámina de la plantilla
# vieja (título en mayúsculas, sin antetítulo).
#
# El graficador marca con la espec `ggplot_marco` qué gráficos van así y dónde.

#' Espec mínima de un gráfico que va en el marco del recetario
#' @param grafico Nombre del gráfico («nube», «serie»…).
#' @param nota Nota al pie del gráfico (su caption), que pasa a la base de la lámina.
#' @param zona Rectángulo relativo a la zona de datos: desplazamientos `dx`, `dy` y recortes `dw`, `dh` en pulgadas.
#' @param lectura Frase de lectura que el recetario cierra en la base («El tamaño crece con las menciones»).
#' @keywords internal
.espec_ggplot_marco <- function(grafico, nota = NULL, zona = c(dx = 0, dy = 0, dw = 0, dh = 0.1), lectura = NULL) {
  list(version = "ggplot_marco/1", tipo = "ggplot_marco", grafico = grafico, nota = nota, zona = zona, lectura = lectura)
}

#' Lámina del recetario con un gráfico ggplot en la zona de datos
#'
#' El caption, el título y el subtítulo del ggplot se quitan: la lámina los escribe en su lugar. La nota pasa a la
#' base, y el subtítulo —el indicador, «Top Two Box» en la serie— va como rótulo nativo sobre la zona de datos, donde
#' lo pone la lámina 88 (recetario_m3c.R:71: margen, zona − 0.25, 10 pt en negrita). El gráfico entra como
#' DrawingML editable (rvg), como en el recetario.
#' @keywords internal
.lam_laminas_ggplot <- function(doc, p, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); ancho <- g_("ancho") - ml - g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  z <- espec$zona %||% c(dx = 0, dy = 0, dw = 0, dh = 0.1)
  rotulo <- tryCatch(as.character(p$labels$subtitle %||% "")[1], error = function(e) "")
  p2 <- p + ggplot2::labs(title = NULL, subtitle = NULL, caption = NULL)
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  if (!is.na(rotulo) && nzchar(trimws(rotulo))) {
    lz <- .lam_lienzo()
    .lam_txt(lz, trimws(rotulo), ml, yt - 0.25, ancho, 0.26, 10, .std_color("texto_suave"), bold = TRUE, nombre = "marco:rotulo")
    doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:marco")
  }
  rk <- espec$ranking
  con_ranking <- !is.null(rk) && length(rk$palabras) > 0L
  # Con ranking, la nube se queda con 7.4 in (lámina 101 del diseño) y el ranking va a la derecha.
  ancho_g <- if (con_ranking) min(7.4, ancho) else ancho - z[["dw"]]
  loc <- officer::ph_location(left = ml + z[["dx"]], top = yt + z[["dy"]], width = ancho_g, height = yf - yt - z[["dy"]] - z[["dh"]])
  doc <- officer::ph_with(doc, rvg::dml(ggobj = p2, bg = "transparent", fonts = list(sans = .std_pt("fuente"))), location = loc)
  if (con_ranking) doc <- .lam_ranking_palabras(doc, rk, x0 = ml + 7.71, ancho = g_("ancho") - g_("margen_der") - (ml + 7.71), y0 = yt - 0.1)
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' Ranking de las palabras más mencionadas junto a la nube (lámina 101 del diseño)
#'
#' Encabezado, cuántas respuestas abiertas hubo y una fila por palabra: la palabra, una línea proporcional a sus
#' menciones con su punto, y la cifra. Todo en piezas editables.
#' @keywords internal
.lam_ranking_palabras <- function(doc, rk, x0, ancho, y0) {
  azul <- .std_color("azul"); tenue <- .std_color("texto_tenue")
  lz <- .lam_lienzo()
  .lam_txt(lz, "Palabras más mencionadas", x0, y0, ancho, 0.30, 12, azul, bold = TRUE, nombre = "ranking:encabezado")
  resp <- suppressWarnings(as.integer(rk$respuestas)[1])
  if (is.finite(resp) && !is.na(resp)) {
    .lam_txt(lz, paste0(format(resp, big.mark = ","), if (resp == 1L) " respuesta abierta" else " respuestas abiertas"),
             x0, y0 + 0.26, ancho, 0.26, 10, tenue, nombre = "ranking:respuestas")
  }
  wl <- 1.55; xl <- x0 + wl + 0.15; wmax <- max(0.5, ancho - wl - 0.15 - 0.8)
  .lam_txt(lz, "menciones", xl, y0 + 0.42, 2, 0.24, 9, tenue, nombre = "ranking:menciones")
  nmax <- max(rk$n, na.rm = TRUE); if (!is.finite(nmax) || nmax <= 0) nmax <- 1
  for (i in seq_along(rk$palabras)) {
    y <- y0 + 0.61 + (i - 1L) * 0.42
    w <- max(0.05, wmax * rk$n[i] / nmax)
    .lam_txt(lz, rk$palabras[i], x0, y, wl, 0.28, 11, azul, nombre = "ranking:palabra")
    .lam_caja(lz, xl, y + 0.13, w, 0.02, azul, nombre = "ranking:linea")
    .lam_caja(lz, xl + w - 0.08, y + 0.06, 0.16, 0.16, azul, nombre = "ranking:punto", geom = "ellipse")
    .lam_txt(lz, format(rk$n[i], big.mark = ","), xl + w + 0.12, y, 0.6, 0.28, 11, azul, bold = TRUE, nombre = "ranking:cifra")
  }
  .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:ranking")
}

#' La base de la lámina con sus partes unidas por un punto, sin dobles puntos ni partes vacías
#' @keywords internal
.lam_unir_base <- function(...) {
  x <- unlist(lapply(list(...), function(v) if (is.null(v)) character(0) else as.character(v)))
  x <- sub("[.[:space:]]+$", "", trimws(x[!is.na(x)]))
  paste(x[nzchar(x)], collapse = ". ")
}
