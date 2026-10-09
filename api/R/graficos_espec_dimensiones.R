# =============================================================================
# graficos_espec_dimensiones.R — lo que afirman los gráficos de dimensiones (ADR 0093, N5)
# =============================================================================
#
# Capa pura de los mapas de calor y el comparativo de dimensiones del recetario
# (recetario_m3d.R). Se arma desde el payload del motor (`.dim_build_payload`),
# así graficador_dimensiones.R —congelado— no crece: el render del plan adjunta
# esta especificación a lo que devuelve el graficador.

#' Especificación de un mapa de calor por dimensión (lámina 92, recetario_m3d.R:43-60)
#'
#' Filas = dimensiones (sin la fila «Total cruce»), columnas = Total y los grupos del cruce, en su orden.
#' Las cifras se redondean primero (desde 0.5 sube) y la diferencia con el Total se calcula entre cifras
#' redondeadas, como el recetario.
#' @param payload Resultado de `.dim_build_payload()`.
#' @param titulo_cruce Encabezado del bloque de grupos («Sexo»); `NULL` sin encabezado.
#' @return Lista `heatmap/1` con `filas`, `columnas` (rotulo, n), `valores` (matriz redondeada filas x columnas),
#'   `valores_crudos` (sin redondear: deciden el tramo de color),
#'   `col_total` (índice de la columna Total o `NA`), `bloques` (encabezados de grupos de columnas) y `rango`.
#' @keywords internal
preparar_heatmap_dim <- function(payload, titulo_cruce = NULL, rotulo_total = "Total") {
  sc <- as.data.frame(payload$score_heat, stringsAsFactors = FALSE)
  sc <- sc[!(sc$tipo %in% "total_cruce") & !(sc$axis_label %in% "Total cruce"), , drop = FALSE]
  if (!nrow(sc)) return(NULL)
  filas <- setdiff(as.character(payload$axis_order_heat %||% unique(sc$axis_label)), "Total cruce")
  filas <- filas[filas %in% sc$axis_label]
  cols <- as.character(payload$group_order_natural %||% payload$group_order %||% unique(sc$grupo))
  cols <- cols[cols %in% sc$grupo]
  crudo <- matrix(NA_real_, length(filas), length(cols), dimnames = list(filas, cols))
  for (k in seq_len(nrow(sc))) {
    i <- match(sc$axis_label[k], filas); j <- match(sc$grupo[k], cols)
    if (!is.na(i) && !is.na(j)) crudo[i, j] <- suppressWarnings(as.numeric(sc$score_raw[k]))
  }
  v <- crudo; v[] <- .pulso_round_half_up(as.vector(crudo), 0)
  n <- vapply(cols, function(g) { b <- suppressWarnings(as.numeric(sc$base[sc$grupo == g])); b <- b[is.finite(b)]; if (length(b)) max(b) else NA_real_ }, 0)
  col_total <- match("Total", cols)
  rot <- cols; if (!is.na(col_total)) rot[col_total] <- rotulo_total
  bloques <- if (!is.null(titulo_cruce) && nzchar(titulo_cruce)) {
    grupo_cols <- setdiff(seq_along(cols), col_total)
    if (length(grupo_cols)) list(list(titulo = titulo_cruce, cols = grupo_cols)) else list()
  } else list()
  # Como el recetario: el rango y el tramo de cada celda salen del valor sin redondear; se escribe el redondeado.
  lo <- max(0, floor(min(crudo, na.rm = TRUE) / 5) * 5); hi <- min(100, ceiling(max(crudo, na.rm = TRUE) / 5) * 5)
  if (hi <= lo) { lo <- max(0, lo - 5); hi <- min(100, hi + 5) }
  list(version = "heatmap/1", tipo = "heatmap_dim", filas = filas, columnas = data.frame(rotulo = rot, n = unname(n), stringsAsFactors = FALSE),
       valores = v, valores_crudos = crudo, col_total = col_total, bloques = bloques, rango = c(lo, hi))
}

#' Especificación de un comparativo de dimensiones entre dos grupos (lámina 94, recetario_m3d.R:79-98)
#'
#' Del mismo payload que el mapa de calor: las dos primeras columnas que no son el Total. La diferencia se
#' calcula entre cifras redondeadas y se escribe sin signo («3 pts»), como el recetario.
#' @keywords internal
preparar_comparativo_dim <- function(payload) {
  h <- preparar_heatmap_dim(payload)
  if (is.null(h)) return(NULL)
  g <- setdiff(seq_len(ncol(h$valores)), h$col_total)
  if (length(g) != 2L) return(NULL)
  V <- h$valores[, g, drop = FALSE]
  d <- V[, 2] - V[, 1]
  list(version = "comparativo_dim/1", tipo = "comparativo_dim", filas = h$filas, grupos = h$columnas$rotulo[g], n = h$columnas$n[g],
       valores = V, valores_crudos = h$valores_crudos[, g, drop = FALSE],
       textos_diferencia = ifelse(d == 0, "0", sprintf("%d pts", as.integer(abs(d)))))
}

#' Adjunta a lo que devuelve un graficador de dimensiones su especificación nativa
#'
#' El render del plan (reporte_plan_ppt.R) envuelve la llamada al graficador con esto: recalcula el payload con
#' los mismos argumentos (`.dim_build_payload`) y adjunta `heatmap/1` o `comparativo_dim/1`. Si el payload no
#' se puede armar, el gráfico vuelve tal cual (la lámina sigue por la ruta anterior).
#' @param p Lo que devolvió el graficador.
#' @param args Argumentos con que se lo llamó.
#' @param tipo `"heatmap"` o `"comparativo"`.
#' @keywords internal
.espec_dim_adjuntar <- function(p, args, tipo = c("heatmap", "comparativo")) {
  tipo <- match.arg(tipo)
  if (is.null(p)) return(p)
  espec <- tryCatch({
    ctx <- .dim_build_context(args$data, instrumento = args$instrumento)
    payload <- .dim_build_payload(ctx, modo = args$modo %||% "general", objetivo = args$objetivo, cruce = args$cruce,
                                  incluir_total = if (identical(tipo, "heatmap")) args$incluir_total %||% TRUE else TRUE,
                                  filtros = args$filtros %||% list(), iter_var = args$iter_var, iter_level = args$iter_level)
    titulo_cruce <- if (!is.null(args$cruce)) {
      lbl <- attr(args$data[[args$cruce]], "label", exact = TRUE); if (is.null(lbl) || !nzchar(lbl)) NULL else as.character(lbl)[1]
    }
    if (identical(tipo, "heatmap")) preparar_heatmap_dim(payload, titulo_cruce = titulo_cruce) else preparar_comparativo_dim(payload)
  }, error = function(e) NULL)
  if (!is.null(espec)) attr(p, "pulso_espec") <- espec
  p
}
