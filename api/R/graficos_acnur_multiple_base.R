# =============================================================================
# graficos_acnur_multiple_base.R: valores de una pregunta de opción múltiple para la base de la lámina ACNUR
# =============================================================================
#
# Ítem 48 (checklist-validacion-practicante, RMS 2026 con la plantilla ACNUR): en la base del estudio una pregunta de
# opción múltiple no trae su columna de texto ("HACC04"), sólo una columna por opción en la base procesada ("HACC04.1",
# "HACC04.2"...). La semántica ACNUR buscaba la columna de texto, no la encontraba y dejaba la nota vacía: esas láminas
# salían sin "N respuestas de la muestra total". Aquí se rearma el texto ("1 5 96") desde las columnas por opción.

#' Texto de una pregunta de opción múltiple rearmado desde sus columnas por opción
#'
#' @param data Base con las columnas por opción (`<nombre>.<código>`, `<nombre>/<código>` o `<nombre>_<código>`).
#' @param name Nombre de la pregunta.
#' @param codigos Códigos de la lista de opciones.
#' @return Vector de texto con los códigos marcados separados por espacio (`NA` si la fila no respondió), o `NULL` si la
#'   base no tiene columnas por opción.
#' @keywords internal
.graficos_acnur_multiple_desde_opciones <- function(data, name, codigos) {
  if (!is.data.frame(data) || !nrow(data) || !length(codigos)) return(NULL)
  cols <- character(0); cods <- character(0)
  for (cod in codigos) {
    col <- intersect(paste0(name, c(".", "/", "_"), cod), names(data))[1]
    if (is.na(col)) next
    cols <- c(cols, col); cods <- c(cods, cod)
  }
  if (!length(cols)) return(NULL)
  marcas <- vapply(cols, function(cc) {
    v <- suppressWarnings(as.numeric(as.character(data[[cc]])))
    !is.na(v) & v == 1
  }, logical(nrow(data)))
  if (is.null(dim(marcas))) marcas <- matrix(marcas, nrow = nrow(data))
  apply(marcas, 1L, function(m) if (any(m)) paste(cods[m], collapse = " ") else NA_character_)
}

#' Los valores de una pregunta para la semántica ACNUR: su columna o, en opción múltiple, sus columnas por opción
#'
#' La base procesada se lee una sola vez por fuente (`ctx$cache`).
#' @return Vector de valores o `NULL` si la pregunta no está en la base.
#' @keywords internal
.graficos_acnur_valores_pregunta <- function(sid, source_name, variable, ctx) {
  name <- .graficos_scalar_chr(variable$name, "")
  data <- ctx$data
  if (is.data.frame(data) && name %in% names(data)) return(as.character(data[[name]]))
  if (!identical(.graficos_base_type(variable$tipo), "select_multiple")) return(NULL)
  codigos <- vapply(variable$choices %||% list(), function(x) .graficos_scalar_chr((x %||% list())$name, ""), character(1))
  codigos <- codigos[nzchar(codigos)]
  fuera <- .graficos_acnur_multiple_desde_opciones(data, name, codigos)
  if (!is.null(fuera)) return(fuera)
  cache <- ctx$cache
  procesada <- if (is.environment(cache) && exists("procesada", envir = cache, inherits = FALSE)) {
    get("procesada", envir = cache)
  } else {
    p <- tryCatch(.graficos_processing_sources(sid)$data_sources[[source_name]], error = function(e) NULL)
    if (is.environment(cache)) assign("procesada", p, envir = cache)
    p
  }
  if (!is.data.frame(procesada) || nrow(procesada) != NROW(data)) return(NULL)
  .graficos_acnur_multiple_desde_opciones(procesada, name, codigos)
}
