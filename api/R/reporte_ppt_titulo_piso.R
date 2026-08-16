#' Piso vertical para el titulo de una lamina
#'
#' La regla R7 del recetario (`graficos_verificar_mazo.R`) exige que ningun
#' titulo se pegue al borde superior. Las laminas de grafico ya la cumplen
#' porque su render coloca el titulo por coordenadas; las de texto no, porque
#' heredan el placeholder del layout y ahi el titulo vive a 0.57 cm.
#'
#' Corregirlo en la plantilla movería el placeholder para todo mazo que use ese
#' layout. Se hace en el motor: si el placeholder del layout queda por encima
#' del piso, se emite el titulo por coordenadas con el top elevado; si ya
#' cumple, no se toca nada y sigue la via normal del placeholder.
#'
#' El piso es 0.94 cm, que es donde el entregable aprobado de Contabilidad puso
#' estas mismas laminas.
#'
#' @name reporte_ppt_titulo_piso
NULL


# 0.94 cm. La vara R7 exige >= 0.78; el aprobado usa 0.94 en las laminas de
# texto que si movio a mano.
.PPT_TITULO_TOP_MIN_IN <- 0.37


#' Geometria del titulo una vez aplicado el piso
#'
#' Separada del acceso a officer para poder probarla sin renderizar. Devuelve
#' `NULL` cuando el titulo ya cumple: eso significa «no toques nada», que es
#' distinto de devolver la misma caja.
#'
#' Al bajar el titulo se le recorta el alto en lo que baja, para que su borde
#' inferior no invada el cuerpo de la lamina.
#'
#' @param offx,offy,cx,cy Geometria del placeholder en pulgadas.
#' @param piso_in Piso en pulgadas.
#' @param alto_min_in Alto minimo que se le deja a la caja del titulo.
#' @return Lista con left/top/width/height, o `NULL` si no hay que mover nada.
#' @keywords internal
.ppt_titulo_geom_con_piso <- function(offx, offy, cx, cy,
                                      piso_in = .PPT_TITULO_TOP_MIN_IN,
                                      alto_min_in = 0.2) {
  vals <- suppressWarnings(as.numeric(c(offx, offy, cx, cy, piso_in)))
  if (length(vals) != 5L || any(!is.finite(vals))) return(NULL)
  if (vals[[2]] >= vals[[5]]) return(NULL)

  recorte <- vals[[5]] - vals[[2]]
  list(
    left = vals[[1]],
    top = vals[[5]],
    width = vals[[3]],
    height = max(alto_min_in, vals[[4]] - recorte)
  )
}


#' Fila del placeholder de titulo dentro de un layout
#'
#' Busca primero por etiqueta —que es como el contrato identifica el slot— y
#' cae al tipo `title` cuando la etiqueta no aparece.
#'
#' @keywords internal
.ppt_titulo_fila_layout <- function(props, spec) {
  if (is.null(props) || !is.data.frame(props) || !nrow(props)) return(NULL)
  lab <- as.character(spec$ph_label %||% "")[1]
  fila <- NULL
  if (!is.na(lab) && nzchar(lab)) {
    fila <- props[!is.na(props$ph_label) & props$ph_label == lab, , drop = FALSE]
  }
  if (is.null(fila) || !nrow(fila)) {
    tipo <- as.character(spec$type %||% "title")[1]
    fila <- props[!is.na(props$type) & props$type == tipo, , drop = FALSE]
  }
  if (!nrow(fila)) return(NULL)
  fila[1, , drop = FALSE]
}


#' Ubicacion del titulo con el piso aplicado, o NULL si ya cumple
#'
#' @param doc Documento `rpptx`.
#' @param layout Nombre del layout de la lamina.
#' @param spec Slot del contrato (`contract$slots$title`).
#' @param piso_in Piso en pulgadas.
#' @return Un `ph_location` de officer, o `NULL` para seguir la via normal.
#' @keywords internal
.ppt_titulo_loc_con_piso <- function(doc, layout, spec,
                                     piso_in = .PPT_TITULO_TOP_MIN_IN) {
  if (is.null(doc) || is.null(spec)) return(NULL)
  layout <- as.character(layout %||% "")[1]
  if (is.na(layout) || !nzchar(layout)) return(NULL)

  props <- tryCatch(
    officer::layout_properties(doc, layout = layout),
    error = function(e) NULL
  )
  fila <- .ppt_titulo_fila_layout(props, spec)
  if (is.null(fila)) return(NULL)

  geom <- .ppt_titulo_geom_con_piso(
    fila$offx[[1]], fila$offy[[1]], fila$cx[[1]], fila$cy[[1]],
    piso_in = piso_in
  )
  if (is.null(geom)) return(NULL)

  officer::ph_location(
    left = geom$left,
    top = geom$top,
    width = geom$width,
    height = geom$height,
    newlabel = as.character(spec$ph_label %||% "")[1]
  )
}
