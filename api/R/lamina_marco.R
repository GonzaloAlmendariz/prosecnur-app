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
#' El caption, el título y el subtítulo del ggplot se quitan: la lámina los escribe en su lugar (la nota pasa a
#' la base). El gráfico entra como DrawingML editable (rvg), como en el recetario.
#' @keywords internal
.lam_laminas_ggplot <- function(doc, p, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); ancho <- g_("ancho") - ml - g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  z <- espec$zona %||% c(dx = 0, dy = 0, dw = 0, dh = 0.1)
  p2 <- p + ggplot2::labs(title = NULL, subtitle = NULL, caption = NULL)
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  loc <- officer::ph_location(left = ml + z[["dx"]], top = yt + z[["dy"]], width = ancho - z[["dw"]], height = yf - yt - z[["dy"]] - z[["dh"]])
  doc <- officer::ph_with(doc, rvg::dml(ggobj = p2, bg = "transparent", fonts = list(sans = .std_pt("fuente"))), location = loc)
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}
