# =============================================================================
# graficar_ppt()
# -----------------------------------------------------------------------------
# Exporta múltiples gráficos a un PPT (una diapositiva por gráfico)
# En formato 16:9 SOLO si la versión de 'officer' lo permite.
# =============================================================================

#' Exportar múltiples gráficos a un archivo PPTX
#'
#' Toma una lista de gráficos (típicamente objetos \code{ggplot2}) y los inserta
#' en un archivo PowerPoint (\code{.pptx}), creando una diapositiva por gráfico.
#'
#' Si la versión de \pkg{officer} instalada lo permite, intenta ajustar el tamaño
#' de la presentación al formato widescreen 16:9 (13.33 × 7.5 pulgadas) mediante
#' \code{officer::slide_size()}. Si no, mantiene el tamaño predeterminado de la
#' plantilla sin generar error.
#'
#' Los gráficos se incrustan como objetos vectoriales usando \pkg{rvg}, lo que
#' permite redimensionarlos en PowerPoint sin pérdida de calidad.
#'
#' Se puede optar por:
#' \itemize{
#'   \item \code{modo_dim = "full"}: el gráfico ocupa toda la diapositiva
#'         (\code{ph_location_fullsize()}).
#'   \item \code{modo_dim = "caja"}: el gráfico se ubica en una caja definida
#'         por \code{left}, \code{top}, \code{width} y \code{height}.
#' }
#'
#' Opcionalmente, se puede añadir un título específico en cada diapositiva, con
#' tamaño y color configurables.
#'
#' @param plots Lista de gráficos (por ejemplo, objetos \code{ggplot}) a
#'   exportar. Cada elemento de la lista se colocará en una diapositiva distinta.
#' @param path_salida Ruta del archivo de salida \code{.pptx}. Si no termina
#'   en \code{".pptx"}, se agregará automáticamente.
#' @param layout Nombre del layout de diapositiva a usar (por defecto
#'   \code{"Blank"}).
#' @param master Nombre del tema maestro de PowerPoint (por defecto
#'   \code{"Office Theme"}).
#' @param modo_dim Modo de dimensionado del gráfico: \code{"full"} para ocupar
#'   toda la diapositiva, o \code{"caja"} para usar las coordenadas dadas por
#'   \code{left}, \code{top}, \code{width}, \code{height}.
#' @param left Posición izquierda (en pulgadas) de la caja donde se ubicará
#'   el gráfico cuando \code{modo_dim = "caja"}.
#' @param top Posición superior (en pulgadas) de la caja donde se ubicará
#'   el gráfico cuando \code{modo_dim = "caja"}.
#' @param width Ancho (en pulgadas) de la caja del gráfico cuando
#'   \code{modo_dim = "caja"}.
#' @param height Alto (en pulgadas) de la caja del gráfico cuando
#'   \code{modo_dim = "caja"}.
#' @param titulos_diapos Vector de caracteres opcional con los títulos a
#'   mostrar en cada diapositiva. Debe tener la misma longitud que
#'   \code{plots}. Si es \code{NULL}, no se agrega título específico por slide.
#' @param size_titulo_diapo Tamaño de letra para los títulos de diapositiva
#'   (en puntos tipográficos).
#' @param color_titulo_diapo Color (HEX) del texto de los títulos de
#'   diapositiva.
#'
#' @details
#' Internamente, la función crea un objeto \code{officer::read_pptx()} y, si
#' la versión de \pkg{officer} lo soporta, ajusta el tamaño de la presentación
#' a 16:9 mediante \code{officer::slide_size(doc, width = 13.33, height = 7.5)}.
#' En caso contrario, este paso se omite silenciosamente.
#'
#' Luego se añade una diapositiva por cada gráfico usando \pkg{rvg} para
#' incrustar un objeto vectorial (\code{rvg::dml(ggobj = g)}).
#'
#' @return De forma invisible, devuelve el objeto \code{officer} del PPT
#'   construido. Como efecto secundario, escribe el archivo en
#'   \code{path_salida}.
#'
#' @examples
#' \dontrun{
#' library(ggplot2)
#'
#' g1 <- ggplot(mtcars, aes(x = wt, y = mpg)) +
#'   geom_point() +
#'   labs(title = "Relación peso vs. rendimiento")
#'
#' g2 <- ggplot(mtcars, aes(x = factor(cyl), y = mpg)) +
#'   geom_boxplot() +
#'   labs(title = "MPG por número de cilindros")
#'
#' graficar_ppt(
#'   plots              = list(g1, g2),
#'   path_salida        = "ejemplo_graficos.pptx",
#'   modo_dim           = "caja",
#'   left               = 0.7,
#'   top                = 1.0,
#'   width              = 12,
#'   height             = 5.8,
#'   titulos_diapos     = c("Gráfico 1: Scatter", "Gráfico 2: Boxplot"),
#'   size_titulo_diapo  = 18,
#'   color_titulo_diapo = "#004B8D"
#' )
#' }
#'
#' @family graficador
#' @export
graficar_ppt <- function(
    plots,
    path_salida,
    layout             = "Blank",
    master             = "Office Theme",
    modo_dim           = c("full", "caja"),
    left               = 0.5,
    top                = 0.5,
    width              = 12.5,
    height             = 6.5,
    titulos_diapos     = NULL,
    size_titulo_diapo  = 16,
    color_titulo_diapo = "#000000"
) {

  modo_dim <- match.arg(modo_dim)

  # Validaciones --------------------------------------------------------------
  if (is.null(plots) || length(plots) == 0) {
    stop("`plots` debe ser una lista no vacía de gráficos.", call. = FALSE)
  }
  if (is.null(path_salida) || !nzchar(path_salida)) {
    stop("Debe especificar `path_salida`.", call. = FALSE)
  }
  if (!endsWith(tolower(path_salida), ".pptx")) {
    path_salida <- paste0(path_salida, ".pptx")
  }
  if (!requireNamespace("officer", quietly = TRUE) ||
      !requireNamespace("rvg", quietly = TRUE)) {
    stop("Requiere los paquetes 'officer' y 'rvg'.", call. = FALSE)
  }

  n_plots <- length(plots)
  if (!is.null(titulos_diapos) && length(titulos_diapos) != n_plots) {
    stop("`titulos_diapos` debe tener la misma longitud que `plots`.", call. = FALSE)
  }

  # Crear PPT -----------------------------------------------------------------
  doc <- officer::read_pptx()

  # Intentar poner tamaño 16:9 SOLO si la versión de officer lo soporta
  can_resize <- FALSE
  slide_formals <- try(formals(officer::slide_size), silent = TRUE)
  if (!inherits(slide_formals, "try-error")) {
    if (all(c("x", "width", "height") %in% names(slide_formals)) ||
        all(c("width", "height") %in% names(slide_formals))) {
      can_resize <- TRUE
    }
  }

  if (isTRUE(can_resize)) {
    # Algunas versiones esperan slide_size(x, width, height)
    # Otras slide_size(x, width = , height = )
    doc <- tryCatch(
      officer::slide_size(doc, width = 13.33, height = 7.5),
      error = function(e) doc
    )
  }

  # Insertar cada gráfico -----------------------------------------------------
  for (i in seq_len(n_plots)) {

    g <- plots[[i]]
    dml_obj <- rvg::dml(ggobj = g)

    doc <- officer::add_slide(doc, layout = layout, master = master)

    # Título opcional en la diapositiva
    if (!is.null(titulos_diapos)) {

      ft <- officer::fp_text(
        color     = color_titulo_diapo,
        font.size = size_titulo_diapo,
        bold      = TRUE
      )

      doc <- officer::ph_with(
        doc,
        value    = officer::fpar(officer::ftext(titulos_diapos[i], ft)),
        location = officer::ph_location(
          left   = 0.5,
          top    = 0.2,
          width  = 12,
          height = 0.8
        )
      )
    }

    # Colocar el gráfico
    if (modo_dim == "full") {
      doc <- officer::ph_with(
        doc,
        value    = dml_obj,
        location = officer::ph_location_fullsize()
      )
    } else {
      doc <- officer::ph_with(
        doc,
        value    = dml_obj,
        location = officer::ph_location(
          left   = left,
          top    = top,
          width  = width,
          height = height
        )
      )
    }
  }

  print(doc, target = path_salida)
  invisible(doc)
}
