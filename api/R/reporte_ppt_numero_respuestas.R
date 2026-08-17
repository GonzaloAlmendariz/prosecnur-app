# =============================================================================
# reporte_ppt_numero_respuestas.R — la lamina que enseña DONDE mirar
# =============================================================================
#
# El entregable aprobado no explica «el numero de respuestas se indica en la
# nota al pie»: lo ENSEÑA. Pone dos graficos de ejemplo y les cuelga las mismas
# anotaciones numeradas que el parrafo usa como notas al pie, de modo que el
# lector ve el 1 en el texto y encuentra el 1 en la lamina.
#
# El motor emitia titulo + parrafo + bullet, con el 80 % de la lamina en blanco.
#
# Vive aparte porque `reporte_plan_ppt.R` esta en `policy.frozen_growth_files`:
# la funcionalidad nueva estrena archivo y el grande la llama. De paso se muda
# aqui `.top_two_parse_colors()`, que es paleta de lamina metodologica y no
# tenia por que vivir en el renderer.

# `.top_two_parse_colors()` NO se muda aqui aunque sea paleta de lamina
# metodologica: usa `.indice_sanitize_fill()` y `.style_value()`, que son
# helpers LOCALES definidos dentro de una funcion de `reporte_plan_ppt.R` y no
# existen fuera de ella. Moverla la rompe. Este archivo se apana con los suyos.


# Color valido o el de respaldo. Propio, por lo de arriba.
.nresp_color <- function(x, fallback) {
  v <- trimws(as.character(x %||% "")[1])
  if (!nzchar(v) || !grepl("^#[0-9A-Fa-f]{3,8}$", v)) return(fallback)
  v
}


# Escapa el texto que va dentro de un nodo SVG. Propio, por lo mismo: el del
# renderer tambien es local.
.nresp_escape <- function(x) {
  x <- as.character(x %||% "")[1]
  x <- gsub("&", "&amp;", x, fixed = TRUE)
  x <- gsub("<", "&lt;", x, fixed = TRUE)
  gsub(">", "&gt;", x, fixed = TRUE)
}


# Valor de estilo, o el de respaldo.
.nresp_estilo <- function(style, clave, fallback) {
  v <- (style %||% list())[[clave]]
  if (is.null(v)) return(fallback)
  v
}


# Geometria del lienzo. Las mismas 1000 unidades de ancho que el SVG de top two
# box, para que las dos laminas metodologicas se escalen igual dentro de su
# placeholder.
.NRESP_W <- 1000
.NRESP_H <- 430


#' Una barra apilada horizontal con sus cifras dentro
#'
#' @param x,y,w,h Caja de la barra.
#' @param tramos `data.frame` con `pct` y `color`.
#' @param label_color Color de las cifras.
#' @param size Cuerpo de las cifras.
#' @return Cadena SVG.
#' @keywords internal
.nresp_barra <- function(x, y, w, h, tramos, label_color = "#081F5C", size = 19) {
  pcts <- suppressWarnings(as.numeric(tramos$pct))
  pcts[!is.finite(pcts) | pcts < 0] <- 0
  total <- sum(pcts)
  if (!is.finite(total) || total <= 0) return("")

  cursor <- x
  piezas <- character(0)
  for (i in seq_along(pcts)) {
    ancho <- w * pcts[[i]] / total
    piezas <- c(piezas, sprintf(
      '<rect x="%.2f" y="%.2f" width="%.2f" height="%.2f" fill="%s"/>',
      cursor, y, ancho, h, tramos$color[[i]]
    ))
    # La cifra solo cabe si su tramo da para ella; en uno estrecho se sale de la
    # barra y se lee peor que no estar. El umbral es 1.6 veces el cuerpo y no
    # 2.2: con 2.2 el «8 %» del ejemplo dicotomico —34 px de tramo— se quedaba
    # fuera, y el aprobado si lo escribe.
    if (ancho > size * 1.6) {
      piezas <- c(piezas, sprintf(
        paste0('<text x="%.2f" y="%.2f" text-anchor="middle" ',
               'font-family="Arial, sans-serif" font-size="%.0f" ',
               'font-weight="bold" fill="%s">%.0f%%</text>'),
        cursor + ancho / 2, y + h / 2 + size * 0.36, size,
        tramos$label_color[[i]] %||% label_color, pcts[[i]]
      ))
    }
    cursor <- cursor + ancho
  }
  paste(piezas, collapse = "")
}


#' Leyenda horizontal de cuadros con su texto
#' @keywords internal
.nresp_leyenda <- function(x, y, items, size = 15, color = "#081F5C") {
  cursor <- x
  piezas <- character(0)
  for (i in seq_len(nrow(items))) {
    piezas <- c(piezas, sprintf(
      '<rect x="%.2f" y="%.2f" width="%.0f" height="%.0f" fill="%s"/>',
      cursor, y - size * 0.75, size, size, items$color[[i]]
    ))
    piezas <- c(piezas, sprintf(
      paste0('<text x="%.2f" y="%.2f" font-family="Arial, sans-serif" ',
             'font-size="%.0f" fill="%s">%s</text>'),
      cursor + size * 1.35, y, size, color, .nresp_escape(items$etiqueta[[i]])
    ))
    cursor <- cursor + size * 1.6 + nchar(items$etiqueta[[i]]) * size * 0.54
  }
  paste(piezas, collapse = "")
}


#' Recuadro punteado que ancla una nota al pie a un punto de la lamina
#'
#' Es la pieza que hace didactica a esta lamina: el parrafo dice «por cada
#' publico¹» y el lector encuentra el mismo 1 junto a la base del grafico. Sin
#' el ancla, la explicacion y el ejemplo son dos cosas sueltas en la misma
#' pagina.
#'
#' @keywords internal
.nresp_ancla <- function(x, y, texto, indice, color = "#D8504F",
                         size = 14, cursiva = FALSE) {
  ancho <- max(46, nchar(texto) * size * 0.58 + 16)
  alto <- size * 1.9
  paste0(
    sprintf(
      paste0('<text x="%.2f" y="%.2f" font-family="Arial, sans-serif" ',
             'font-size="%.0f" font-weight="bold" fill="%s">%s</text>'),
      x, y - alto * 0.45, size * 0.85, color, indice
    ),
    sprintf(
      paste0('<rect x="%.2f" y="%.2f" width="%.2f" height="%.2f" fill="none" ',
             'stroke="%s" stroke-width="1.4" stroke-dasharray="5 3" rx="3"/>'),
      x, y - alto * 0.28, ancho, alto, color
    ),
    sprintf(
      paste0('<text x="%.2f" y="%.2f" font-family="Arial, sans-serif" ',
             'font-size="%.0f" font-weight="bold" fill="%s"%s>%s</text>'),
      x + 8, y + alto * 0.42, size, "#081F5C",
      if (isTRUE(cursiva)) ' font-style="italic"' else "",
      .nresp_escape(texto)
    )
  )
}


#' SVG de la lamina «Numero de respuestas»
#'
#' Dos ejemplos, no uno: el aprobado enseña el caso dicotomico —donde la base va
#' en la nota al pie— y el caso de escala —donde la N baja al propio grafico
#' porque esa pregunta tuvo menos respuestas—. Con un solo ejemplo la lamina
#' explica la mitad de lo que dice el parrafo.
#'
#' @param ejemplos Lista de dos listas con `enunciado`, `publico`, `tramos`
#'   (`data.frame(pct, color, etiqueta)`) y, opcional, `top_two` y `nota_n`.
#' @param base_texto Texto del ancla de base, la nota 1.
#' @param style Estilo de la lamina.
#' @return Ruta del SVG.
#' @keywords internal
.numero_respuestas_svg <- function(ejemplos = NULL, base_texto = NULL,
                                   style = list()) {
  ej <- .nresp_ejemplos_default(ejemplos)
  blue <- .nresp_color(.nresp_estilo(style, "text_color", "#081F5C"), "#081F5C")
  accent <- .nresp_color(
    .nresp_estilo(style, "accent_color",
                  .nresp_estilo(style, "title_color", "#D8504F")), "#D8504F")
  verde <- .nresp_color(.nresp_estilo(style, "top_two_color", "#548135"), "#548135")
  fondo <- .nresp_color(.nresp_estilo(style, "background_fill", "#F2F2F2"), "#F2F2F2")
  base_texto <- as.character(base_texto %||% "Base: 12 egresados")[1]

  bar_x <- 430
  bar_w <- 430
  bar_h <- 52
  piezas <- character(0)

  for (k in seq_along(ej)) {
    e <- ej[[k]]
    y <- if (k == 1L) 70 else 250

    # Enunciado a la izquierda, en las lineas que haga falta.
    lineas <- strsplit(e$enunciado, "\n", fixed = TRUE)[[1]]
    for (i in seq_along(lineas)) {
      piezas <- c(piezas, sprintf(
        paste0('<text x="%.2f" y="%.2f" text-anchor="middle" ',
               'font-family="Arial, sans-serif" font-size="17" ',
               'font-weight="bold" fill="%s">%s</text>'),
        170, y + bar_h / 2 - (length(lineas) - 1) * 11 + (i - 1) * 22,
        blue, .nresp_escape(lineas[[i]])
      ))
    }
    # Publico
    piezas <- c(piezas, sprintf(
      paste0('<text x="%.2f" y="%.2f" font-family="Arial, sans-serif" ',
             'font-size="17" fill="%s">%s</text>'),
      330, y + bar_h / 2 + 6, blue, .nresp_escape(e$publico)
    ))
    # Barra y leyenda
    piezas <- c(piezas, .nresp_barra(bar_x, y, bar_w, bar_h, e$tramos, blue))
    piezas <- c(piezas, .nresp_leyenda(bar_x + 80, y + bar_h + 30, e$tramos))

    if (!is.null(e$top_two)) {
      piezas <- c(piezas, sprintf(
        paste0('<text x="%.2f" y="%.2f" font-family="Arial, sans-serif" ',
               'font-size="16" font-weight="bold" fill="%s">TOP TWO BOX</text>'),
        bar_x + bar_w + 26, y - 16, verde
      ))
      piezas <- c(piezas, sprintf(
        paste0('<text x="%.2f" y="%.2f" font-family="Arial, sans-serif" ',
               'font-size="20" font-weight="bold" fill="%s">%s</text>'),
        bar_x + bar_w + 26, y + bar_h / 2 + 8, verde, e$top_two
      ))
    }
    if (!is.null(e$nota_n)) {
      piezas <- c(piezas, .nresp_ancla(bar_x + bar_w - 96, y - 24, e$nota_n,
                                       "2", accent, cursiva = TRUE))
    }
  }

  # La nota 1 vive al pie, que es donde el parrafo dice que esta.
  piezas <- c(piezas, .nresp_ancla(28, .NRESP_H - 34, base_texto, "1", accent))

  out <- tempfile("numero_respuestas_", fileext = ".svg")
  writeLines(
    c(
      sprintf('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">',
              .NRESP_W, .NRESP_H, .NRESP_W, .NRESP_H),
      sprintf('<rect x="0" y="0" width="%d" height="%d" fill="%s"/>',
              .NRESP_W, .NRESP_H, fondo),
      piezas,
      "</svg>"
    ),
    out
  )
  out
}


#' Los dos ejemplos por defecto, los del entregable aprobado
#' @keywords internal
.nresp_ejemplos_default <- function(ejemplos = NULL) {
  if (is.list(ejemplos) && length(ejemplos) >= 1L) return(ejemplos)
  list(
    list(
      enunciado = "Conoce el Plan de\nEstudios de la carrera.",
      publico = "Egresados",
      tramos = data.frame(
        pct = c(92, 8),
        color = c("#9DC3E6", "#336699"),
        etiqueta = c("Sí", "No"),
        label_color = c("#FFFFFF", "#FFFFFF"),
        stringsAsFactors = FALSE
      )
    ),
    list(
      enunciado = "El contenido del Plan de\nEstudios es consistente\ncon el perfil del egreso.",
      publico = "Egresados",
      tramos = data.frame(
        pct = c(42, 25, 33),
        color = c("#FFD966", "#B7D7A8", "#70AD47"),
        etiqueta = c("En desacuerdo", "De acuerdo", "Totalmente de acuerdo"),
        label_color = c("#081F5C", "#081F5C", "#081F5C"),
        stringsAsFactors = FALSE
      ),
      top_two = "58%",
      nota_n = "N = 12"
    )
  )
}
