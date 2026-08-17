# =============================================================================
# reporte_plan_tabla_nativa.R — una tabla es una tabla, y va nativa (ADR 0072)
# =============================================================================
#
# La tabla de apoyo del radar se dibujaba DENTRO del canvas de ggplot, como una
# imagen. El coste está a la vista en su propia API: `tabla_padding_mm`,
# `tabla_firstcol_wrap`, `tabla_auto_fit`, `tabla_fit_pad`, `tabla_clip`… una
# veintena de parámetros que existen para resolver a mano lo que un motor de
# tablas resuelve solo. Y el resultado no es texto: no se busca, no se copia, no
# se corrige en PowerPoint y no escala con el placeholder.
#
# El ADR 0071 —los CHARTS van como formas, no como gráficos nativos— no aplica:
# su razón es que PowerPoint centra cada etiqueta en su segmento y no la mueve,
# lo que en una Likert con colas de 1–2 % colisiona siempre. Una rejilla de
# filas y columnas no tiene ese problema. El 0072 lo precisa sin revertirlo.
#
# El motor ya sabía emitir tablas nativas —la ficha técnica sale con
# `flextable` desde `.make_technical_table_flextable()`—; lo que faltaba era el
# puente entre el graficador, que tiene los datos, y el renderer, que tiene el
# placeholder. Ese puente es un atributo en el objeto devuelto: el graficador
# adjunta la tabla y sigue devolviendo un ggplot válido, así que nada que no
# sepa de esto se entera.

#' Marca de la tabla que un graficador quiere emitir nativa.
#' @keywords internal
.PULSO_ATTR_TABLA_NATIVA <- "pulso_tabla_nativa"

#' Adjunta a un gráfico la tabla que debe emitirse nativa.
#'
#' @param p Objeto ggplot devuelto por el graficador.
#' @param tabla `data.frame` con la tabla ya compuesta, encabezados incluidos
#'   como nombres de columna.
#' @param estilo Lista de estilo opcional para el constructor de flextable.
#' @return `p` con el atributo puesto. Sin tabla, `p` intacto.
#' @keywords internal
.tabla_nativa_adjuntar <- function(p, tabla, estilo = list()) {
  if (is.null(tabla) || !is.data.frame(tabla) || !nrow(tabla)) return(p)
  attr(p, .PULSO_ATTR_TABLA_NATIVA) <- list(tabla = tabla, estilo = estilo %||% list())
  p
}

#' La tabla que trae un gráfico, si trae alguna.
#' @keywords internal
.tabla_nativa_de <- function(p) {
  if (is.null(p)) return(NULL)
  attr(p, .PULSO_ATTR_TABLA_NATIVA, exact = TRUE)
}

#' ¿Este gráfico se emite como tabla en vez de como imagen?
#' @keywords internal
.tabla_nativa_procede <- function(p) !is.null(.tabla_nativa_de(p))

#' Valor a colocar en un placeholder: tabla nativa si la hay, imagen si no.
#'
#' Sustituye a `rvg::dml(ggobj = p, bg = "transparent")` en el renderer. Un
#' gráfico normal pasa por aquí sin enterarse; sólo cambia de forma el que
#' declaró su tabla.
#'
#' @param p Objeto ggplot.
#' @param font_family_default Tipografía de respaldo del documento.
#' @keywords internal
.dml_o_tabla <- function(p, font_family_default = "Aptos") {
  # Con geometria propia la tabla NO ocupa el placeholder: va aparte, junto al
  # grafico, y aqui tiene que salir la imagen. Sin esta salida la tabla se
  # emitia dos veces —una en el placeholder y otra en su sitio— y la lamina del
  # radar acababa con dos tablas.
  nat <- .tabla_nativa_de(p)
  if (!is.null(nat) && is.list((nat$estilo %||% list())$geom_frac)) {
    return(rvg::dml(ggobj = p, bg = "transparent"))
  }
  nativa <- .tabla_nativa_de(p)
  if (is.null(nativa)) return(rvg::dml(ggobj = p, bg = "transparent"))
  if (!requireNamespace("flextable", quietly = TRUE)) {
    # Sin flextable no se pierde la lámina: sale la imagen de siempre.
    return(rvg::dml(ggobj = p, bg = "transparent"))
  }
  .tabla_nativa_flextable(nativa$tabla, nativa$estilo, font_family_default)
}

#' Construye la flextable de una tabla emitida por un graficador.
#'
#' A diferencia de la ficha técnica —dos columnas, sin encabezado—, ésta tiene
#' encabezado: sus columnas son series y sin sus nombres la rejilla no se lee.
#'
#' @keywords internal
.tabla_nativa_flextable <- function(tabla, estilo = list(), font_family_default = "Aptos") {
  `%|N|%` <- function(a, b) if (is.null(a)) b else a
  num <- function(k, d) {
    v <- suppressWarnings(as.numeric(estilo[[k]] %|N|% d)[1])
    if (!is.finite(v)) d else v
  }
  chr <- function(k, d) {
    v <- estilo[[k]] %|N|% d
    as.character(v)[1]
  }

  tabla <- as.data.frame(tabla, stringsAsFactors = FALSE, check.names = FALSE)
  for (j in seq_along(tabla)) {
    col <- as.character(tabla[[j]])
    col[is.na(col)] <- ""
    tabla[[j]] <- col
  }

  # El gris de la rejilla se midio sobre el entregable aprobado, no se eligio:
  # sus tres tablas —ficha tecnica 6x2 y los dos perfiles de egreso 7x4 y 6x4—
  # declaran los cuatro lados de cada celda en `757070` a 0.75 pt, cuarenta y
  # ocho bordes en total. El motor venia pintando esa misma rejilla completa en
  # `BFBFBF`, que es cuatro tonos mas claro y sobre el relleno `F2F2F2` del
  # cuerpo casi no se ve. El grosor ya coincidia; solo el color no.
  borde <- officer::fp_border(
    color = chr("grid_col", "#757070"),
    width = num("line_lwd", 0.75)
  )

  ft <- flextable::flextable(tabla)
  # `autofit` reparte por contenido y da a las cuatro columnas el mismo ancho:
  # 1.91 cm cada una sobre un cajon de 13.52, con la caja a medias y los
  # encabezados partidos —«docent/es», «Estados Financi/eros»—. El entregable
  # aprobado da 6.62 cm a la columna de tema y reparte el resto, llenando su
  # cajon entero.
  ancho_cajon <- num("ancho_in", NA_real_)
  if (is.finite(ancho_cajon) && ancho_cajon > 0 && ncol(tabla) >= 2L) {
    frac_1 <- num("primera_col_frac", 0.47)
    if (!is.finite(frac_1) || frac_1 <= 0 || frac_1 >= 0.9) frac_1 <- 0.47
    resto <- (1 - frac_1) / (ncol(tabla) - 1L)
    ft <- flextable::width(ft, j = 1, width = ancho_cajon * frac_1)
    for (j in seq(2L, ncol(tabla))) {
      ft <- flextable::width(ft, j = j, width = ancho_cajon * resto)
    }
    ft <- flextable::set_table_properties(ft, layout = "fixed")
  } else {
    ft <- flextable::set_table_properties(ft, layout = "autofit")
  }
  ft <- flextable::font(ft, fontname = chr("font_family", font_family_default), part = "all")
  ft <- flextable::fontsize(ft, size = num("header_size", 11), part = "header")
  ft <- flextable::fontsize(ft, size = num("body_size", 11), part = "body")
  ft <- flextable::color(ft, color = chr("text_blue", "#081F5C"), part = "all")
  ft <- flextable::bg(ft, bg = chr("header_fill", "#D8D8D8"), part = "header")
  ft <- flextable::bg(ft, bg = chr("body_fill", "#F2F2F2"), part = "body")
  ft <- flextable::bold(ft, bold = TRUE, part = "header")
  if (isTRUE(estilo$firstcol_bold %|N|% TRUE)) {
    ft <- flextable::bold(ft, j = 1, bold = TRUE, part = "body")
  }
  ft <- flextable::align(ft, align = "center", part = "all")
  ft <- flextable::align(ft, j = 1, align = "left", part = "all")
  ft <- flextable::valign(ft, valign = "center", part = "all")
  ft <- flextable::padding(
    ft,
    padding.top = num("padding_v", 4), padding.bottom = num("padding_v", 4),
    padding.left = num("padding_h", 6), padding.right = num("padding_h", 6),
    part = "all"
  )
  ft <- flextable::border_remove(ft)
  ft <- flextable::border_outer(ft, border = borde, part = "all")
  ft <- flextable::border_inner_h(ft, border = borde, part = "all")
  ft <- flextable::border_inner_v(ft, border = borde, part = "all")
  flextable::fix_border_issues(ft)
}


#' Coloca un grafico y, si trae tabla nativa con sitio propio, tambien la tabla
#'
#' El caso de «solo tabla» se resuelve con `.dml_o_tabla()`: la tabla ocupa el
#' placeholder entero. Pero el entregable aprobado pone el grafico Y la tabla
#' lado a lado, y ahi hacen falta dos formas en el mismo cajon.
#'
#' El graficador adjunta `geom_frac` —fracciones de SU canvas— y aqui se
#' convierten contra el cajon real. Un grafico sin tabla, o con tabla sin
#' geometria, no pasa por este camino.
#'
#' @param loc Geometria del cajon destino, en pulgadas: `list(left, top, width,
#'   height)`.
#' @return `TRUE` si coloco una tabla aparte.
#' @keywords internal
.tabla_nativa_geom <- function(p, loc) {
  nativa <- .tabla_nativa_de(p)
  if (is.null(nativa)) return(NULL)
  g <- (nativa$estilo %||% list())$geom_frac
  if (!is.list(g)) return(NULL)

  v <- suppressWarnings(as.numeric(c(g$x, g$y, g$w, g$h)))
  if (length(v) != 4L || any(!is.finite(v))) return(NULL)
  l <- suppressWarnings(as.numeric(c(loc$left, loc$top, loc$width, loc$height)))
  if (length(l) != 4L || any(!is.finite(l))) return(NULL)

  # `y` viene desde ABAJO —convencion de cowplot— y officer mide desde arriba.
  list(
    left = l[[1]] + v[[1]] * l[[3]],
    top = l[[2]] + (1 - v[[2]] - v[[4]]) * l[[4]],
    width = v[[3]] * l[[3]],
    height = v[[4]] * l[[4]]
  )
}


#' Recorta el slot del grafico hasta donde empieza su tabla
#'
#' Cuando el graficador adjunta una tabla con geometria propia, las dos piezas
#' comparten cajon: el grafico entero y la tabla en su fraccion derecha. Sin
#' recortar, la tabla se dibuja ENCIMA del canvas.
#'
#' El canvas llego a reservar el hueco por su cuenta —un panel vacio al lado del
#' grafico— y el sitio quedaba pedido dos veces: el radar se encogia a la
#' izquierda, quedaba un cuadro vacio en medio y la tabla al final, fuera del
#' marco. Reservarlo aqui, en el slot, es lo que hace que sean piezas contiguas
#' y no superpuestas.
#'
#' @param slot Slot del grafico, con `$loc` en pulgadas.
#' @param geom_tab Salida de `.tabla_nativa_geom()`, o `NULL`.
#' @return El slot, recortado si procede.
#' @keywords internal
.plot_slot_recortado_por_tabla <- function(slot, geom_tab) {
  if (is.null(geom_tab) || is.null(slot)) return(slot)
  loc <- slot$loc
  if (is.null(loc)) return(slot)

  izq <- suppressWarnings(as.numeric(loc$left)[1])
  ancho <- suppressWarnings(as.numeric(loc$width)[1])
  tab_izq <- suppressWarnings(as.numeric(geom_tab$left)[1])
  if (!is.finite(izq) || !is.finite(ancho) || !is.finite(tab_izq)) return(slot)

  nuevo <- tab_izq - izq
  # Un recorte que deja al grafico sin sitio no es un recorte: es borrarlo. Por
  # debajo de un tercio del cajon se prefiere el solape, que al menos deja ver
  # las dos piezas.
  if (!is.finite(nuevo) || nuevo <= ancho / 3) return(slot)
  if (nuevo >= ancho) return(slot)

  slot$loc$width <- nuevo
  slot
}
