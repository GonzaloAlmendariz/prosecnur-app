# El filtro y su subpregunta en el Word: dos figuras, no la composición del PowerPoint.
#
# En la lámina, el gráfico del filtro y el dependiente van juntos con la llave «Sólo los N que respondieron…»
# (graficos_filtro_subpregunta.R, recetario p192–p194). El Word pegaba esa composición como una sola imagen al ancho de la
# página: la escala quedaba aplastada, la leyenda encimada y «Top Two Box» cortado (Gonzalo, 2026-10-26, Arte_v1-6). Aquí
# cada pieza vuelve a pasar por el registro normal del Word y sale como su propia figura, con su rótulo y su base. El
# dependiente ya trae el filtro de quienes lo habilitan, así que su base es la de ellos: el título no agrega nada (Gonzalo:
# un paréntesis armado por el motor sobraba).

#' Las dos piezas del filtro y su subpregunta como elementos para el registro del Word, o `NULL` si no se pueden armar
#'
#' Se arman con la misma función que la lámina (`.fsub_elementos`).
#' @param el El elemento `filtro_subpregunta`.
#' @param plot El gráfico compuesto de la lámina (su espec trae los dos gráficos).
#' @return `list(list(el, plot), list(el, plot))` o `NULL`.
#' @keywords internal
.word_filtro_sub_piezas <- function(el, plot) {
  pz <- tryCatch(.fsub_elementos(el), error = function(e) NULL)
  if (is.null(pz)) return(NULL)
  espec <- attr(plot, "pulso_espec") %||% list()
  list(list(el = pz$el_f, plot = espec$plot_filtro %||% plot),
       list(el = pz$el_s, plot = espec$plot_sub %||% plot))
}
