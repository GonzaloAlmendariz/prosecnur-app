# =============================================================================
# Helpers compartidos de filtros declarativos
# =============================================================================

#' @keywords internal
.apply_named_filters <- function(df, filters = list(), arg_name = "filtros") {
  if (is.null(filters) || !length(filters)) return(df)
  if (!is.list(filters)) stop("`", arg_name, "` debe ser una lista nombrada.", call. = FALSE)

  out <- df
  f_names <- names(filters)
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
