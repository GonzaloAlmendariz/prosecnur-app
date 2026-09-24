# Tramos de columnas del formulario en papel (items 1 y 2 del checklist
# `docs/qa/checklist-motor-formulario-papel-2026-09-24.md`).
#
# El instrumento de referencia no usa tablas de dos columnas: usa SALTOS DE
# SECCION con formato de columnas (`sectPr` continuo + `cols num=2`). Cada
# tramo contiguo de bloques recibe su propia seccion, y el numero de columnas
# de ese tramo se decide POR ANCHO MEDIDO, no por ojo: si todo lo que cae en
# el tramo entra en media pagina, va a dos columnas; si algo no entra (una
# matriz de nueve columnas de escala), el tramo entero va a una.
#
# Este archivo solo MIDE y PLANIFICA. No dibuja: el consumidor (el renderer
# PDF de `reporte_formulario_pdf.R`, y en su momento el de Word) traduce el
# plan a su propia maquinaria de layout.
#
# Todas las funciones son internas al paquete (sin `@export`): se llaman desde
# `formulario_pdf_build_model()`.

# Ancho por defecto del cuerpo de texto en A4 con margenes del motor, en twips.
.FORM_TRAMOS_USABLE_TWIPS <- 9072L
# Canaleta entre columnas (el `w:space="425"` de la referencia).
.FORM_TRAMOS_GUTTER_TWIPS <- 425L

# Ancho minimo de la celda de etiqueta de una matriz (columna izquierda).
.FORM_TRAMOS_MATRIX_LABEL_MIN <- 2600L
# Ancho minimo de una columna de escala de matriz.
.FORM_TRAMOS_MATRIX_COL_MIN <- 340L
# Tope de ancho para una columna de escala rotulada con categorias.
.FORM_TRAMOS_MATRIX_COL_MAX <- 1400L
# Ancho minimo de un bloque de pregunta sin opciones (texto, numerica, nota).
.FORM_TRAMOS_PLAIN_MIN <- 2600L

# Longitud (en caracteres) de la palabra mas larga de la etiqueta mas larga.
# Es la cota que manda al rotular categorias: una columna tiene que poder
# contener al menos su palabra mas larga sin partirla.
.form_tramos_longest_word <- function(labels) {
  labels <- as.character(labels %||% character(0))
  labels <- labels[!is.na(labels) & nzchar(labels)]
  if (!length(labels)) return(0L)
  longest <- labels[which.max(nchar(labels))]
  words <- strsplit(longest, "\\s+", perl = TRUE)[[1]]
  words <- words[nzchar(words)]
  if (!length(words)) return(0L)
  as.integer(max(nchar(words)))
}

# Ancho MINIMO legible de un bloque, en twips. Es una COTA INFERIOR ("por
# debajo de esto el bloque deja de leerse"), no un ancho deseado: sirve para
# decidir si el bloque cabe en media pagina, nada mas.
#
# `section` devuelve NA_integer_ a proposito: una banda de seccion es NEUTRA,
# se estira a lo que le den y nunca decide el ancho de su tramo.
.form_tramos_min_width <- function(block, usable_twips = .FORM_TRAMOS_USABLE_TWIPS) {
  usable_twips <- as.integer(usable_twips)
  kind <- block$kind %||% ""

  if (kind %in% c("cover", "paper")) return(usable_twips)
  if (identical(kind, "section")) return(NA_integer_)

  if (identical(kind, "matrix")) {
    part <- .form_pdf_matrix_partition_options(
      block$options %||% list(),
      block$special_override %||% "auto"
    )
    scale <- part$scale %||% list()
    total_cols <- length(scale) + (if (!is.null(part$special)) 1L else 0L)
    mode <- .form_pdf_matrix_header_mode(scale, block$header_mode %||% "auto")
    col_min <- .FORM_TRAMOS_MATRIX_COL_MIN
    if (identical(mode, "categorias")) {
      labs <- vapply(scale, function(o) .form_pdf_clean_text(o$label %||% ""), character(1))
      wlen <- .form_tramos_longest_word(labs)
      col_min <- min(
        .FORM_TRAMOS_MATRIX_COL_MAX,
        max(.FORM_TRAMOS_MATRIX_COL_MIN, 120L * wlen + 120L)
      )
    }
    return(as.integer(.FORM_TRAMOS_MATRIX_LABEL_MIN + total_cols * col_min))
  }

  if (identical(kind, "question")) {
    opts <- block$options %||% list()
    if (length(opts)) {
      labs <- vapply(opts, function(o) .form_pdf_clean_text(o$label %||% o$code %||% ""), character(1))
      longest <- if (length(labs)) max(nchar(labs)) else 0L
      return(as.integer(400L + min(3600L, 110L * longest)))
    }
    return(.FORM_TRAMOS_PLAIN_MIN)
  }

  # Kind desconocido: conservador, exige ancho completo.
  usable_twips
}

# Frontera de tramo: TRUE si el bloque `i` debe ABRIR un tramo nuevo.
# Se corta antes de cada banda de seccion y antes/despues de cada corrida de
# bloques de prologo (`cover` / `paper`).
.form_tramos_is_prologue <- function(block) (block$kind %||% "") %in% c("cover", "paper")

#' Plan de columnas por tramos
#'
#' Reparte los bloques del modelo en tramos contiguos y le asigna a cada uno 1
#' o 2 columnas segun el ancho minimo medido de sus bloques de contenido.
#'
#' Invariantes garantizados: los tramos son contiguos, estan en orden y cubren
#' todos los bloques exactamente una vez (`from` del primero = 1, `to` del
#' ultimo = length(blocks), `from[k+1] == to[k] + 1`); `columns` es siempre 1L
#' o 2L. Con `blocks` vacio devuelve `list()`.
#'
#' `reason` documenta la decision:
#'  - "prologo"      : corrida de portada / notas de papel, siempre a 1 columna.
#'  - "ancho"        : algun bloque de contenido no cabe en media pagina.
#'  - "pocos-bloques": cabe, pero el tramo tiene menos de 3 bloques de contenido
#'                     (dos columnas con dos bloques se ve desbalanceado).
#'  - "ancho-medido" : todo cabe y hay material suficiente -> 2 columnas.
#'
#' @noRd
formulario_tramos_plan <- function(blocks,
                                   usable_twips = .FORM_TRAMOS_USABLE_TWIPS,
                                   gutter_twips = .FORM_TRAMOS_GUTTER_TWIPS) {
  n <- length(blocks %||% list())
  if (!n) return(list())
  usable_twips <- as.integer(usable_twips)
  gutter_twips <- as.integer(gutter_twips)
  half <- (usable_twips - gutter_twips) %/% 2L

  mins <- vapply(blocks, function(b) {
    mw <- b$min_width_twips
    if (is.null(mw)) .form_tramos_min_width(b, usable_twips) else as.integer(mw)
  }, integer(1))
  prologue <- vapply(blocks, .form_tramos_is_prologue, logical(1))
  is_section <- vapply(blocks, function(b) identical(b$kind %||% "", "section"), logical(1))

  # 1) Fronteras: abre tramo el primer bloque, toda banda de seccion y todo
  #    cambio de/hacia prologo.
  starts <- 1L
  for (i in seq.int(2L, length.out = max(0L, n - 1L))) {
    if (is_section[i] || prologue[i] != prologue[i - 1L]) starts <- c(starts, i)
  }
  ends <- c(starts[-1L] - 1L, n)

  # 2) Decision por tramo.
  tramos <- vector("list", length(starts))
  for (k in seq_along(starts)) {
    from <- starts[k]
    to <- ends[k]
    idx <- seq.int(from, to)
    if (any(prologue[idx])) {
      tramos[[k]] <- list(columns = 1L, from = from, to = to, reason = "prologo")
      next
    }
    content <- idx[!is.na(mins[idx])]
    # Sin bloques de contenido (un tramo que es solo su banda de seccion) no hay
    # nada que medir: se deja a 1 columna y la fusion lo absorbe en el vecino.
    if (!length(content)) {
      tramos[[k]] <- list(columns = 1L, from = from, to = to, reason = "sin-contenido")
      next
    }
    fits <- all(mins[content] <= half)
    # NO hay minimo de bloques. Lo hubo (>= 3) y contradecia a la referencia: su
    # tramo de dos columnas mas corto tiene 1 bloque si se cuentan secciones y 2
    # si se cuentan corridas entre bandas. El minimo mandaba a una columna
    # justamente los bloques finales cortos -- el de vivienda salia a ancho
    # completo -- y ademas se fusionaba hacia atras, escondiendo el motivo.
    tramos[[k]] <- if (fits) {
      list(columns = 2L, from = from, to = to, reason = "ancho-medido")
    } else {
      list(columns = 1L, from = from, to = to, reason = "ancho")
    }
  }

  # 3) Fusion de tramos adyacentes con el mismo numero de columnas: dos
  #    secciones continuas a 1 columna no necesitan dos `sectPr`.
  #    El `reason` de un tramo fusionado es la UNION de los motivos, no el del
  #    primero: `reason` existe para auditar la decision, y conservar solo el
  #    primero publicaba el motivo equivocado para el resto del tramo (un tramo
  #    que empezaba en "prologo" y absorbia una matriz ancha se declaraba
  #    entero "prologo").
  merged <- list()
  for (tr in tramos) {
    prev <- if (length(merged)) merged[[length(merged)]] else NULL
    if (!is.null(prev) && identical(prev$columns, tr$columns)) {
      merged[[length(merged)]]$to <- tr$to
      merged[[length(merged)]]$reason <- paste(
        unique(c(strsplit(prev$reason, "+", fixed = TRUE)[[1]], tr$reason)),
        collapse = "+")
      next
    }
    merged[[length(merged) + 1L]] <- tr
  }
  merged
}
