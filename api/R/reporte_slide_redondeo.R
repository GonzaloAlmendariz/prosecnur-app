# =============================================================================
# reporte_slide_redondeo.R — la lámina que explica por qué las cifras son esas
# =============================================================================
#
# Hermana de la lámina de Top Two Box: una explicación metodológica reutilizable
# que acompaña al mazo. Existe porque el criterio de redondeo genera preguntas
# reales —la revisión de ACRD CONTA devolvió 64 observaciones que eran todas de
# redondeo y ninguna de dato—, y responderlas una vez en el propio informe sale
# más barato que responderlas cada vez por correo.
#
# La lámina muestra la MISMA distribución rotulada por los dos métodos, con su
# suma al lado. Es la forma más corta de que se entienda el intercambio: uno da
# cifras fieles que pueden sumar 101, el otro una suma exacta a costa de mover
# alguna cifra.
#
# Vive en su propio archivo y no dentro de `reporte_plan_ppt.R` porque aquél
# está congelado a crecimiento (`agentic/manifest.json`) y esto son ~200 líneas.
# El renderer recibe los helpers de estilo que allí son closures internas, en
# vez de duplicarlos: una sola implementación de cada uno sigue siendo la regla.
#
# Ver `docs/qa/checklist-redondeo-decimales-2026-08-14.md` (ítem 17).

#' Casos del ejemplo por defecto de la lámina.
#'
#' Son los de una pregunta real de ACRD CONTA (N = 178): dos categorías con UNA
#' persona cada una. Se eligió ese caso y no uno redondo porque es justamente
#' donde los dos métodos discrepan de forma visible —una de esas dos personas
#' desaparece con el reparto—, que es lo que la lámina tiene que enseñar.
#' @keywords internal
.REDONDEO_SLIDE_CASOS <- c(1, 10, 72, 94, 1)

#' Etiquetas por defecto del ejemplo.
#' @keywords internal
.REDONDEO_SLIDE_ETIQUETAS <- c(
  "Totalmente en desacuerdo", "En desacuerdo",
  "De acuerdo", "Totalmente de acuerdo", "Sin información"
)

#' Diagrama comparativo de los dos métodos de redondeo.
#'
#' @param casos Frecuencias del ejemplo.
#' @param etiquetas Nombres de las categorías.
#' @param decimales Resolución rotulada en el ejemplo.
#' @param colores Paleta de los segmentos.
#' @param style Lista de estilo del slide.
#' @param escape Función de escapado de texto para SVG.
#' @param fill Función que sanea un color.
#' @return Ruta a un `.svg` temporal.
#' @keywords internal
.redondeo_slide_svg <- function(casos = .REDONDEO_SLIDE_CASOS,
                                etiquetas = .REDONDEO_SLIDE_ETIQUETAS,
                                decimales = 0,
                                colores = NULL,
                                style = list(),
                                escape = function(x) x,
                                fill = function(x, default) x %||% default) {
  casos <- suppressWarnings(as.numeric(casos))
  casos <- casos[is.finite(casos) & casos >= 0]
  if (length(casos) < 2) casos <- .REDONDEO_SLIDE_CASOS
  etiquetas <- as.character(etiquetas %||% character(0))
  if (length(etiquetas) < length(casos)) {
    etiquetas <- c(etiquetas, rep("", length(casos) - length(etiquetas)))
  }
  etiquetas <- etiquetas[seq_along(casos)]

  total <- sum(casos)
  prop <- casos / total

  # Las dos filas salen de la MISMA función que rotula los gráficos del mazo.
  # Si la lámina calculara su ejemplo por su cuenta, podría acabar enseñando un
  # comportamiento que el motor ya no tiene.
  u_est <- .pulso_pct_unidades(prop, decimales, "estandar")
  u_rep <- .pulso_pct_unidades(prop, decimales, "reparto")
  lab_est <- .pulso_fmt_pct_unidades(u_est, decimales)
  lab_rep <- .pulso_fmt_pct_unidades(u_rep, decimales)
  suma_est <- sum(u_est) / (10^decimales)
  suma_rep <- sum(u_rep) / (10^decimales)

  navy <- fill(style$text_color %||% "#081F5C", "#081F5C")
  acento <- fill(style$accent_color %||% "#D8504F", "#D8504F")
  fondo <- fill(style$background_fill %||% "#FFFFFF", "#FFFFFF")
  suave <- fill(style$muted_color %||% "#5B6B8C", "#5B6B8C")

  if (is.null(colores) || !length(colores)) {
    colores <- c("#D8504F", "#E8A33D", "#8FB8DE", "#2E5FA3", "#C7D2E0")
  }
  colores <- rep(as.character(colores), length.out = length(casos))
  colores <- vapply(colores, function(c) fill(c, "#2E5FA3"), character(1))

  # Geometría del lienzo. Dos barras del mismo ancho, una sobre otra, para que
  # la comparación sea vertical y no haya que buscar la cifra equivalente.
  ancho <- 1000; alto <- 520
  x0 <- 70; x1 <- 820
  barra_w <- x1 - x0
  alto_barra <- 74

  fila <- function(y, unidades, labels, titulo, suma, resaltar) {
    anchos <- barra_w * prop
    x <- x0
    piezas <- character(0)
    for (i in seq_along(casos)) {
      w <- anchos[[i]]
      cero <- unidades[[i]] == 0L
      # Un segmento que se rotula 0 % no se dibuja: es exactamente lo que hace
      # el motor, y la lámina tiene que enseñar eso y no una versión amable.
      if (!cero) {
        piezas <- c(piezas, sprintf(
          '<rect x="%.2f" y="%.2f" width="%.2f" height="%.2f" fill="%s"/>',
          x, y, max(w, 0.6), alto_barra, colores[[i]]
        ))
        if (w > 34) {
          piezas <- c(piezas, sprintf(
            '<text x="%.2f" y="%.2f" font-size="19" font-family="Arial" fill="#FFFFFF" text-anchor="middle" font-weight="bold">%s</text>',
            x + w / 2, y + alto_barra / 2 + 7, escape(labels[[i]])
          ))
        }
      }
      x <- x + w
    }
    # Las cifras que no caben dentro del segmento se listan debajo, con su
    # color, para que ninguna quede sin poder leerse.
    fuera <- which(barra_w * prop <= 34)
    if (length(fuera)) {
      xs <- x0
      chips <- character(0)
      for (i in fuera) {
        chips <- c(chips, sprintf(
          '<tspan fill="%s">%s %s</tspan>', colores[[i]],
          escape(labels[[i]]), escape(etiquetas[[i]])
        ))
      }
      piezas <- c(piezas, sprintf(
        '<text x="%.2f" y="%.2f" font-size="14" font-family="Arial" fill="%s">%s</text>',
        xs, y + alto_barra + 22, suave,
        paste(chips, collapse = '<tspan fill="#B9C2D0">  ·  </tspan>')
      ))
    }
    c(
      sprintf('<text x="%.2f" y="%.2f" font-size="17" font-family="Arial" fill="%s" font-weight="bold">%s</text>',
              x0, y - 14, navy, escape(titulo)),
      piezas,
      sprintf('<text x="%.2f" y="%.2f" font-size="17" font-family="Arial" fill="%s" font-weight="bold">Suman %s%%</text>',
              x1 + 18, y + alto_barra / 2 + 6,
              if (resaltar) acento else suave,
              format(suma, trim = TRUE, nsmall = if (decimales > 0) decimales else 0))
    )
  }

  y_est <- 96
  y_rep <- 300

  cuerpo <- c(
    fila(y_est, u_est, lab_est, "Redondeo estándar", suma_est, suma_est != 100),
    fila(y_rep, u_rep, lab_rep, "Reparto a 100 %", suma_rep, FALSE)
  )

  pie <- sprintf(
    '<text x="%.2f" y="%.2f" font-size="15" font-family="Arial" fill="%s">%s</text>',
    x0, alto - 26, suave,
    escape(sprintf(
      "Ejemplo con %s respuestas. Las dos categorías de una sola persona valen %s %% cada una.",
      format(total, big.mark = ","),
      format(round(100 / total, 2), trim = TRUE)
    ))
  )

  out <- tempfile("redondeo_", fileext = ".svg")
  writeLines(
    c(
      sprintf('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">',
              ancho, alto, ancho, alto),
      sprintf('<rect x="0" y="0" width="%d" height="%d" fill="%s"/>', ancho, alto, fondo),
      cuerpo,
      pie,
      "</svg>"
    ),
    out
  )
  out
}

#' Texto explicativo por defecto de la lámina.
#' @keywords internal
.redondeo_slide_texto <- function() {
  paste0(
    "Una cifra con decimales hay que redondearla para escribirla, y no existe ",
    "forma de hacerlo que conserve a la vez el valor exacto de cada categoría y ",
    "una suma de 100 %. El informe declara cuál de las dos conserva."
  )
}

#' Arma la lámina metodológica de redondeo dentro del documento.
#'
#' Recibe los helpers de estilo porque en `reporte_plan_ppt.R` son closures
#' internas y duplicarlos aquí crearía dos versiones de la misma regla.
#'
#' @param doc Documento `officer` en construcción.
#' @param slide Definición del slide.
#' @param presets Presets resueltos.
#' @param contract Entrada de `.PPT_CONTRACT` con layout y slots.
#' @param helpers Lista con `add_slide`, `style_value`, `style_num`, `escape`
#'   y `fill`.
#' @return El documento con la lámina añadida.
#' @keywords internal
.reporte_slide_redondeo <- function(doc, slide, presets, contract, helpers) {
  slots <- slide$slots %||% list()
  style <- slide$style %||% slots$estilo %||% list()
  for (k in c("accent_color", "colores", "decimales", "casos", "etiquetas")) {
    if (!is.null(slots[[k]])) style[[k]] <- slots[[k]]
  }
  style$font_family <- style$font_family %||%
    presets$base$args$font_family_ppt %||% presets$base$args$font_family %||% "Arial"

  doc <- helpers$add_slide(doc, contract$layout)

  titulo <- as.character(slots$title %||% slide$title %||% "CÓMO SE REDONDEAN LAS CIFRAS")[1]
  if (!nzchar(trimws(titulo))) titulo <- "CÓMO SE REDONDEAN LAS CIFRAS"
  if (isTRUE(helpers$style_value(style, "mayusculas_titulo", TRUE))) titulo <- toupper(titulo)

  doc <- officer::ph_with(
    doc,
    value = officer::fpar(
      officer::ftext(titulo, prop = officer::fp_text(
        color = as.character(helpers$style_value(style, "title_color",
                                                 helpers$style_value(style, "accent_color", "#D8504F")))[1],
        font.size = helpers$style_num(style, "title_size", 24, min = 8),
        bold = TRUE,
        font.family = as.character(style$font_family)[1]
      )),
      fp_p = officer::fp_par(text.align = "left", line_spacing = 1)
    ),
    location = officer::ph_location(
      left = helpers$style_num(style, "title_left", contract$slots$title$loc$left, min = 0),
      top = helpers$style_num(style, "title_top", contract$slots$title$loc$top, min = 0),
      width = helpers$style_num(style, "title_width", contract$slots$title$loc$width, min = 1),
      height = helpers$style_num(style, "title_height", contract$slots$title$loc$height, min = 0.2),
      newlabel = "Redondeo title"
    )
  )

  texto <- as.character(slots$text %||% .redondeo_slide_texto())[1]
  if (nzchar(trimws(texto))) {
    doc <- officer::ph_with(
      doc,
      value = officer::fpar(
        officer::ftext(texto, prop = officer::fp_text(
          color = as.character(helpers$style_value(style, "text_color", "#081F5C"))[1],
          font.size = helpers$style_num(style, "text_size", 13, min = 6),
          font.family = as.character(style$font_family)[1]
        )),
        fp_p = officer::fp_par(text.align = "left", line_spacing = 1.15)
      ),
      location = officer::ph_location(
        left = helpers$style_num(style, "text_left", contract$slots$text$loc$left, min = 0),
        top = helpers$style_num(style, "text_top", contract$slots$text$loc$top, min = 0),
        width = helpers$style_num(style, "text_width", contract$slots$text$loc$width, min = 3),
        height = helpers$style_num(style, "text_height", contract$slots$text$loc$height, min = 0.2),
        newlabel = "Redondeo text"
      )
    )
  }

  svg <- .redondeo_slide_svg(
    casos = style$casos %||% .REDONDEO_SLIDE_CASOS,
    etiquetas = style$etiquetas %||% .REDONDEO_SLIDE_ETIQUETAS,
    decimales = suppressWarnings(as.integer(style$decimales %||% 0)[1]),
    colores = style$colores,
    style = style,
    escape = helpers$escape,
    fill = helpers$fill
  )

  spec <- contract$slots$diagram$loc
  doc <- officer::ph_with(
    doc,
    value = officer::external_img(
      src = svg,
      width = helpers$style_num(style, "diagram_width", spec$width, min = 3),
      height = helpers$style_num(style, "diagram_height", spec$height, min = 1),
      alt = "Comparación de los dos métodos de redondeo"
    ),
    location = officer::ph_location(
      left = helpers$style_num(style, "diagram_left", spec$left, min = 0),
      top = helpers$style_num(style, "diagram_top", spec$top, min = 0),
      width = helpers$style_num(style, "diagram_width", spec$width, min = 3),
      height = helpers$style_num(style, "diagram_height", spec$height, min = 1),
      newlabel = "Redondeo diagram"
    )
  )
  doc
}
