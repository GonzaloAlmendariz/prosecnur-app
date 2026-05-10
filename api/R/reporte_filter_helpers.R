# =============================================================================
# Helpers compartidos de filtros declarativos
# =============================================================================

#' @keywords internal
.apply_named_filters <- function(df, filters = list(), arg_name = "filtros") {
  `%||%` <- function(x, y) if (!is.null(x)) x else y

  if (is.null(filters) || !length(filters)) return(df)
  if (!is.list(filters)) stop("`", arg_name, "` debe ser una lista nombrada.", call. = FALSE)

  .split_filter_values <- function(x) {
    if (is.null(x)) return(character(0))
    vals <- as.character(x)
    vals <- trimws(vals[!is.na(vals)])
    vals <- unlist(strsplit(vals, "\\s*,\\s*", perl = TRUE), use.names = FALSE)
    vals <- trimws(vals[!is.na(vals)])
    vals[nzchar(vals)]
  }

  .apply_rule_rows <- function(out, rules) {
    if (is.null(rules) || !NROW(rules)) return(out)
    for (i in seq_len(NROW(rules))) {
      rule <- rules[i, , drop = FALSE]
      nm <- trimws(as.character(rule$variable %||% "")[1])
      op <- trimws(as.character(rule$op %||% "eq")[1])
      val <- rule$value %||% ""
      vals <- .split_filter_values(val)

      # Mientras el usuario edita una fila incompleta, no debe romper el export.
      if (!nzchar(nm) || !length(vals)) next
      if (!(nm %in% names(out))) {
        stop("La variable de filtro `", nm, "` no existe en `data`.", call. = FALSE)
      }

      xv_chr <- trimws(as.character(out[[nm]]))
      xv_num <- suppressWarnings(as.numeric(out[[nm]]))
      vals_num <- suppressWarnings(as.numeric(vals))

      keep <- switch(
        op,
        eq = !is.na(xv_chr) & xv_chr %in% vals,
        neq = is.na(xv_chr) | !(xv_chr %in% vals),
        `in` = !is.na(xv_chr) & xv_chr %in% vals,
        notin = is.na(xv_chr) | !(xv_chr %in% vals),
        contains = !is.na(xv_chr) & grepl(tolower(vals[1]), tolower(xv_chr), fixed = TRUE),
        gt = !is.na(xv_num) & xv_num > vals_num[1],
        lt = !is.na(xv_num) & xv_num < vals_num[1],
        gte = !is.na(xv_num) & xv_num >= vals_num[1],
        lte = !is.na(xv_num) & xv_num <= vals_num[1],
        !is.na(xv_chr) & xv_chr %in% vals
      )
      keep[is.na(keep)] <- FALSE
      out <- out[keep, , drop = FALSE]
    }
    out
  }

  # La UI nueva guarda filtros como filas: [{ variable, op, value }, ...].
  # Mantenerlo aquí evita que el export falle cuando el usuario borra o edita
  # reglas sin pasar por el formato legacy de lista nombrada.
  if (is.data.frame(filters)) {
    if (all(c("variable", "op", "value") %in% names(filters))) {
      return(.apply_rule_rows(out = df, rules = filters))
    }
  }

  # Formato del dashboard (UI de Pulso): [{var, valores: [...]}, ...].
  # Se normaliza a la forma legacy `list(var = c(vals))` y se delega al
  # loop final. Comportamiento permisivo (matching .dashboard_apply_filtros
  # en dashboard_pane.R): vars inexistentes y filtros incompletos se
  # ignoran silenciosamente — un endpoint del dashboard no debe romper
  # porque el usuario tenga un filtro sobre una var que ya no está en
  # data tras un cambio de curación.
  if (length(filters) > 0L) {
    is_dashboard_list <- all(vapply(filters, function(x) {
      is.list(x) && all(c("var", "valores") %in% names(x))
    }, logical(1)))
    if (isTRUE(is_dashboard_list)) {
      df_cols <- names(df)
      named <- list()
      for (f in filters) {
        var <- as.character(f$var %||% "")[1]
        vals <- as.character(unlist(f$valores %||% list()))
        vals <- trimws(vals[!is.na(vals)])
        vals <- vals[nzchar(vals)]
        if (!nzchar(var) || !length(vals) || !(var %in% df_cols)) next
        named[[var]] <- vals
      }
      if (!length(named)) return(df)
      filters <- named
    }
  }

  out <- df
  f_names <- names(filters)
  is_rule_list <- length(filters) > 0L &&
    all(vapply(filters, function(x) {
      is.list(x) && any(c("variable", "op", "value") %in% names(x))
    }, logical(1)))
  if (isTRUE(is_rule_list)) {
    rules <- data.frame(
      variable = vapply(filters, function(x) as.character(x$variable %||% "")[1], character(1)),
      op       = vapply(filters, function(x) as.character(x$op %||% "eq")[1], character(1)),
      value    = vapply(filters, function(x) paste(.split_filter_values(x$value %||% ""), collapse = ","), character(1)),
      stringsAsFactors = FALSE
    )
    return(.apply_rule_rows(out = out, rules = rules))
  }

  if (is.null(f_names) || any(!nzchar(trimws(f_names)))) {
    stop("`", arg_name, "` debe ser una lista nombrada por variable.", call. = FALSE)
  }

  for (nm in f_names) {
    if (!(nm %in% names(out))) {
      stop("La variable de filtro `", nm, "` no existe en `data`.", call. = FALSE)
    }

    vals <- as.character(filters[[nm]])
    vals <- trimws(vals[!is.na(vals)])
    vals <- vals[nzchar(vals)]
    if (!length(vals)) next

    xv <- trimws(as.character(out[[nm]]))
    keep <- !is.na(xv) & xv %in% vals
    out <- out[keep, , drop = FALSE]
  }

  out
}
