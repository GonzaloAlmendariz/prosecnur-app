#' @keywords internal
limpiar_nombres_es <- function(x) {
  x <- tolower(trimws(x))
  x <- stringi::stri_trans_general(x, "Latin-ASCII")
  x <- gsub("[^a-z0-9]+", "_", x); x <- gsub("_+", "_", x)
  x <- gsub("^_|_$", "", x); ifelse(grepl("^[0-9]", x), paste0("col_", x), x)
}

#' @keywords internal
normalizar_procesamiento <- function(x) {
  if (is.na(x) || !nzchar(x)) return(x)
  x <- chartr("“”‘’", '""\'\'', x)
  x <- gsub("[\u00A0\u2007\u202F]", " ", x)
  x <- gsub("(?<!\\\\)\\\\b", "\\\\b", x, perl = TRUE)
  n_open <- stringr::str_count(x, "\\("); n_close <- stringr::str_count(x, "\\)")
  if (n_open > n_close) x <- paste0(x, strrep(")", n_open - n_close))
  x
}

#' @keywords internal
parsear_regla <- function(proc, nombre_regla = NA_character_) {
  if (is.na(proc) || !nzchar(proc)) return(NULL)
  tiene_puntoycoma <- grepl(";", proc, fixed = TRUE)
  n_asigs <- length(gregexpr("<-", proc, fixed = TRUE)[[1]])
  if (!tiene_puntoycoma && n_asigs == 1) {
    partes <- strsplit(proc, "<-", fixed = TRUE)[[1]]
    flag <- partes[1] |>
      trimws() |> tolower() |>
      stringi::stri_trans_general("Latin-ASCII") |>
      gsub("[^a-z0-9]+","_", x = _) |>
      gsub("_+","_", x = _) |> gsub("^_|_$","", x = _)
    rhs  <- trimws(paste(partes[-1], collapse = "<-"))
    return(list(flag = flag, rhs = rhs))
  }
  if (is.na(nombre_regla) || !nzchar(nombre_regla)) return(NULL)
  flag <- nombre_regla |>
    trimws() |> tolower() |>
    stringi::stri_trans_general("Latin-ASCII") |>
    gsub("[^a-z0-9]+","_", x = _) |>
    gsub("_+","_", x = _) |> gsub("^_|_$","", x = _)
  rhs <- proc
  if (!grepl("^\\s*\\{.*\\}\\s*$", rhs)) rhs <- paste0("{ ", rhs, " }")
  list(flag = flag, rhs = rhs)
}

#' @keywords internal
.resolver_regla <- function(evaluacion, regla, por = c("id_regla","nombre_regla","flag")) {
  por <- match.arg(por)
  stopifnot(all(c("datos","resumen","reglas_meta") %in% names(evaluacion)))
  res <- evaluacion$resumen
  if (nrow(res) == 0) return(NULL)
  fila <- switch(
    por,
    id_regla     = dplyr::filter(res, .data$id_regla == !!regla),
    nombre_regla = dplyr::filter(res, .data$nombre_regla == !!regla),
    flag         = dplyr::filter(res, .data$flag == !!regla)
  ) |> dplyr::slice(1)
  if (nrow(fila) == 0) NULL else fila
}
