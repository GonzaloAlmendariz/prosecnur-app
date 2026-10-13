# Notas al pie de las tablas de Analítica (frecuencias y cruces).
#
# Bloque de config `notas` (checklist entregables HSyVBG 2026, ítems 1a–1e):
#
#   notas = list(
#     fuente = "Pulso PUCP",
#     base_defecto = "",
#     base_por_pregunta = list(<variable> = "<texto>"),
#     por_cruce = list(<variable de cruce> = "<texto>"),
#     base_reducida = list(activo = FALSE, umbral = 30L)
#   )
#
# Los helpers son puros: reciben textos y conteos y devuelven líneas. Los
# writers (`reporte_frecuencias.R`, `reporte_cruces.R`) deciden en qué fila van.
# Sin config `notas` el pie queda como siempre: una sola línea «Fuente: …».

.notas_pie_fuente_defecto <- "Pulso PUCP"

.notas_pie_texto <- function(x) {
  if (is.null(x) || !length(x)) return("")
  x <- x[[1]]
  if (is.null(x) || (length(x) == 1L && is.na(x))) return("")
  out <- trimws(as.character(x))
  if (!length(out) || is.na(out)) return("")
  enc2utf8(out)
}

# Lista nombrada de textos (JSON `{}` o `[]`, NULL, vector con nombres) a un
# character nombrado sin vacíos.
.notas_pie_mapa <- function(x) {
  if (is.null(x) || !length(x)) return(stats::setNames(character(0), character(0)))
  nms <- names(x)
  if (is.null(nms)) return(stats::setNames(character(0), character(0)))
  vals <- vapply(seq_along(x), function(i) .notas_pie_texto(x[i]), character(1))
  nms <- trimws(as.character(nms))
  keep <- !is.na(nms) & nzchar(nms) & nzchar(vals)
  stats::setNames(vals[keep], nms[keep])
}

#' Normaliza el bloque `notas` de la config de Analítica.
#' @noRd
.notas_pie_normalizar <- function(notas = NULL, fuente_defecto = .notas_pie_fuente_defecto) {
  if (!is.list(notas)) notas <- list()
  fuente <- .notas_pie_texto(notas$fuente)
  if (!nzchar(fuente)) fuente <- .notas_pie_texto(fuente_defecto)
  if (!nzchar(fuente)) fuente <- .notas_pie_fuente_defecto

  br <- notas$base_reducida
  if (!is.list(br)) br <- list()
  umbral <- suppressWarnings(as.integer(round(as.numeric(br$umbral %||% 30L)[1])))
  if (is.na(umbral) || umbral < 1L) umbral <- 30L

  list(
    fuente = fuente,
    base_defecto = .notas_pie_texto(notas$base_defecto),
    base_por_pregunta = .notas_pie_mapa(notas$base_por_pregunta),
    por_cruce = .notas_pie_mapa(notas$por_cruce),
    base_reducida = list(activo = isTRUE(as.logical(br$activo %||% FALSE)[1]), umbral = umbral)
  )
}

# Texto de base de una variable: el de la pregunta manda sobre el por defecto.
# "" significa sin línea de base.
.notas_pie_base <- function(notas, var) {
  notas <- .notas_pie_normalizar(notas)
  var <- as.character(var %||% "")[1]
  bpp <- notas$base_por_pregunta
  if (!is.na(var) && nzchar(var) && var %in% names(bpp)) {
    txt <- .notas_pie_texto(bpp[[var]])
    if (nzchar(txt)) return(txt)
  }
  .notas_pie_texto(notas$base_defecto)
}

# Agrega punto final si el texto no termina en . ! ?
.notas_pie_cerrar <- function(x) {
  x <- .notas_pie_texto(x)
  if (!nzchar(x)) return(x)
  if (grepl("[.!?]$", x)) x else paste0(x, ".")
}

# Une en castellano: "a", "a y b", "a, b y c".
.notas_pie_unir_es <- function(x) {
  x <- as.character(x)
  n <- length(x)
  if (n == 0L) return("")
  if (n == 1L) return(x)
  paste0(paste(x[-n], collapse = ", "), " y ", x[n])
}

# Línea de frecuencias: «Fuente: X». La base va en su propia línea.
.notas_pie_lineas_frecuencias <- function(notas, var) {
  notas <- .notas_pie_normalizar(notas)
  base <- .notas_pie_base(notas, var)
  c(
    paste0("Fuente: ", notas$fuente),
    if (nzchar(base)) paste0("Base: ", base) else character(0)
  )
}

# Primera línea de cruces. Sin base es exactamente «Fuente: X», como siempre.
.notas_pie_linea_cruces <- function(fuente, base = "") {
  fuente <- .notas_pie_texto(fuente)
  base <- .notas_pie_texto(base)
  if (!nzchar(base)) return(paste0("Fuente: ", fuente))
  paste0(
    "Fuente: ", .notas_pie_cerrar(fuente),
    " Base: ", .notas_pie_cerrar(base),
    " Porcentajes por columna."
  )
}

# Notas por variable de cruce, en el orden del banner.
.notas_pie_lineas_por_cruce <- function(notas, cruces) {
  notas <- .notas_pie_normalizar(notas)
  pc <- notas$por_cruce
  cruces <- as.character(cruces %||% character(0))
  cruces <- cruces[cruces %in% names(pc)]
  if (!length(cruces)) return(character(0))
  out <- unname(vapply(cruces, function(s) .notas_pie_texto(pc[[s]]), character(1)))
  out[nzchar(out)]
}

# Línea de bases reducidas. `items` es un data.frame con `variable` (rótulo de
# la variable de cruce), `columna` (rótulo de la columna) y `n` (casos válidos
# SIN ponderar), en el orden del banner. Se listan las columnas con
# 0 < n < umbral; una columna sin casos no es reducida, es vacía.
.notas_pie_linea_base_reducida <- function(items, umbral = 30L) {
  if (!is.data.frame(items) || !nrow(items)) return("")
  umbral <- suppressWarnings(as.numeric(umbral)[1])
  if (is.na(umbral)) umbral <- 30
  n <- suppressWarnings(as.numeric(items$n))
  sel <- !is.na(n) & n > 0 & n < umbral
  if (!any(sel)) return("")
  items <- items[sel, , drop = FALSE]
  vars <- unique(as.character(items$variable))
  grupos <- vapply(vars, function(v) {
    cols <- unique(as.character(items$columna[as.character(items$variable) == v]))
    paste0(.notas_pie_unir_es(paste0("«", cols, "»")), " (", v, ")")
  }, character(1))
  paste0(
    "Bases reducidas (menos de ", format(umbral, scientific = FALSE, trim = TRUE),
    " casos): ", paste(unname(grupos), collapse = ", "),
    ". Sus porcentajes deben leerse con cautela."
  )
}

.notas_pie_alpha <- function(alpha) {
  a <- suppressWarnings(as.numeric(alpha)[1])
  if (is.na(a)) a <- 0.05
  format(a, scientific = FALSE, trim = TRUE, decimal.mark = ".")
}

# Nota de significancia (ítem 1e). `metodo`: "z" (proporciones), "cluster"
# (repeat cluster-robust) o "welch" (medias). Sin «Letras por estrato» ni
# «Fuente».
.notas_pie_significancia <- function(metodo = c("z", "cluster", "welch"), alpha = 0.05) {
  metodo <- match.arg(metodo)
  a <- .notas_pie_alpha(alpha)
  base <- "Las letras comparan las columnas de una misma variable de cruce. "
  if (identical(metodo, "welch")) {
    return(paste0(
      base,
      "Una letra en una celda indica que esa media es significativamente mayor ",
      "que la de la columna identificada con esa letra (prueba t de Welch con ",
      "corrección de Bonferroni, nivel de significancia de ", a, ")."
    ))
  }
  prueba <- if (identical(metodo, "cluster")) {
    "contrastes cluster-robust por persona con corrección de Bonferroni"
  } else {
    "prueba z de diferencia de proporciones con corrección de Bonferroni"
  }
  paste0(
    base,
    "Una letra en una celda indica que esa proporción es significativamente mayor ",
    "que la de la columna identificada con esa letra (", prueba,
    ", nivel de significancia de ", a, "). ",
    "«.a» indica una columna excluida de la comparación porque su ",
    "proporción es 0 % o 100 %."
  )
}

# Líneas del pie de una tabla de cruces. `estratos_totales` es la lista que
# arma exportar_cruces_multi(): por variable de cruce presente en la tabla,
# `labels`, `s_lbl` y `n_sin_peso` (casos válidos sin ponderar por columna).
.cruces_lineas_pie <- function(notas, var, cruces, estratos_totales = list()) {
  notas <- .notas_pie_normalizar(notas)
  base <- .notas_pie_base(notas, var)
  cruces <- as.character(cruces %||% character(0))
  presentes <- cruces[cruces %in% names(estratos_totales)]

  lineas <- c(
    .notas_pie_linea_cruces(notas$fuente, base),
    .notas_pie_lineas_por_cruce(notas, presentes)
  )

  if (isTRUE(notas$base_reducida$activo) && length(presentes)) {
    items <- do.call(rbind, lapply(presentes, function(s) {
      info <- estratos_totales[[s]]
      labs <- as.character(info$labels %||% character(0))
      n <- suppressWarnings(as.numeric(info$n_sin_peso %||% rep(NA_real_, length(labs))))
      if (!length(labs) || length(n) != length(labs)) return(NULL)
      data.frame(
        variable = rep(as.character(info$s_lbl %||% s), length(labs)),
        columna = labs,
        n = n,
        stringsAsFactors = FALSE
      )
    }))
    reducida <- .notas_pie_linea_base_reducida(items, notas$base_reducida$umbral)
    if (nzchar(reducida)) lineas <- c(lineas, reducida)
  }

  attr(lineas, "ajustar_alto") <- length(lineas) > 1L || nzchar(base)
  lineas
}

# Escribe el pie (una fila por línea, estilo nota, combinada a lo ancho de la
# tabla, borde superior solo en la primera) y devuelve la fila siguiente.
.cruces_escribir_pie <- function(wb, hoja, st, fila, ncol_tbl, lineas) {
  ajustar <- isTRUE(attr(lineas, "ajustar_alto"))
  ncol_tbl <- max(1L, as.integer(ncol_tbl))
  ancho <- min(60 + 16 * (ncol_tbl - 1L), 220)
  for (i in seq_along(lineas)) {
    openxlsx::writeData(wb, hoja, lineas[[i]], startRow = fila, startCol = 1)
    openxlsx::addStyle(wb, hoja, st$note, rows = fila, cols = 1, gridExpand = TRUE)
    openxlsx::mergeCells(wb, hoja, rows = fila, cols = 1:ncol_tbl)
    if (i == 1L) {
      openxlsx::addStyle(
        wb, hoja, st$footer_top,
        rows = fila, cols = 1:ncol_tbl,
        gridExpand = TRUE, stack = TRUE
      )
    }
    if (ajustar) {
      openxlsx::setRowHeights(
        wb, hoja, rows = fila,
        heights = .calc_row_height(lineas[[i]], col_width = ancho, font_size = 9)
      )
    }
    fila <- fila + 1L
  }
  fila
}
