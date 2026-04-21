# Helpers de pivots para reporte_enumeradores()

#' @keywords internal
.enum_order_rows <- function(df, ordenar_por = c("total", "nombre")) {
  ordenar_por <- match.arg(ordenar_por)

  if (!nrow(df)) return(df)

  if (identical(ordenar_por, "nombre")) {
    return(df[order(as.character(df$enumerador)), , drop = FALSE])
  }

  df[order(-as.numeric(df$TOTAL), as.character(df$enumerador)), , drop = FALSE]
}

#' @keywords internal
.enum_add_total_row <- function(df) {
  if (!nrow(df)) {
    return(tibble::tibble(enumerador = "TOTAL", TOTAL = 0))
  }

  num_cols <- names(df)[vapply(df, is.numeric, logical(1))]
  out <- df

  total_row <- out[1, , drop = FALSE]
  for (nm in names(total_row)) total_row[[nm]] <- NA
  total_row$enumerador <- "TOTAL"

  for (nm in num_cols) {
    total_row[[nm]] <- sum(out[[nm]], na.rm = TRUE)
  }

  dplyr::bind_rows(out, total_row)
}

#' @keywords internal
pivot_enum_resumen <- function(
    data,
    col_enumerador,
    min_encuestas = 0,
    ordenar_por = c("total", "nombre")
) {
  ordenar_por <- match.arg(ordenar_por)

  if (!is.data.frame(data)) stop("`data` debe ser data.frame.", call. = FALSE)
  if (!col_enumerador %in% names(data)) {
    stop("`col_enumerador` no existe en `data`: ", col_enumerador, call. = FALSE)
  }

  df <- tibble::tibble(
    enumerador = as.character(data[[col_enumerador]])
  )

  df$enumerador[is.na(df$enumerador) | !nzchar(trimws(df$enumerador))] <- "(Sin enumerador)"

  out <- df |>
    dplyr::count(.data$enumerador, name = "TOTAL") |>
    dplyr::filter(.data$TOTAL >= as.numeric(min_encuestas))

  out <- .enum_order_rows(out, ordenar_por = ordenar_por)
  .enum_add_total_row(out)
}

#' Pivot enumerador x corte (columnas dinamicas con fila/columna TOTAL)
#'
#' @keywords internal
pivot_enum_x_corte <- function(
    data,
    col_enumerador,
    col_corte,
    col_modalidad = NULL,
    min_encuestas = 0,
    ordenar_por = c("total", "nombre"),
    etiqueta_sin_dato = "(Sin dato)"
) {
  ordenar_por <- match.arg(ordenar_por)

  if (!is.data.frame(data)) stop("`data` debe ser data.frame.", call. = FALSE)
  if (!col_enumerador %in% names(data)) {
    stop("`col_enumerador` no existe en `data`: ", col_enumerador, call. = FALSE)
  }
  if (is.null(col_corte) || !col_corte %in% names(data)) {
    stop("`col_corte` no existe en `data`: ", as.character(col_corte)[1], call. = FALSE)
  }

  df <- tibble::tibble(
    enumerador = as.character(data[[col_enumerador]]),
    corte = as.character(data[[col_corte]])
  )

  df$enumerador[is.na(df$enumerador) | !nzchar(trimws(df$enumerador))] <- "(Sin enumerador)"
  df$corte[is.na(df$corte) | !nzchar(trimws(df$corte))] <- etiqueta_sin_dato

  wide <- df |>
    dplyr::count(.data$enumerador, .data$corte, name = "n") |>
    tidyr::pivot_wider(
      names_from = "corte",
      values_from = "n",
      values_fill = 0,
      names_sort = TRUE
    )

  if (!nrow(wide)) {
    return(tibble::tibble(enumerador = "TOTAL", TOTAL = 0))
  }

  corte_cols <- setdiff(names(wide), "enumerador")
  if (!length(corte_cols)) {
    wide$TOTAL <- 0
  } else {
    wide$TOTAL <- rowSums(as.data.frame(wide[, corte_cols, drop = FALSE]), na.rm = TRUE)
  }

  wide <- wide |>
    dplyr::filter(.data$TOTAL >= as.numeric(min_encuestas))

  if (!nrow(wide)) {
    out <- tibble::tibble(enumerador = "TOTAL")
    for (nm in c(corte_cols, "TOTAL")) out[[nm]] <- 0
    return(out)
  }

  wide <- .enum_order_rows(wide, ordenar_por = ordenar_por)
  .enum_add_total_row(wide)
}
