# Codificación › Adaptación: de qué archivo se re-adapta una base.
#
# `original_*` se congela la primera vez que se adapta y no vuelve a moverse
# (`estudio_preserve_original_base_files()` sólo escribe lo vacío). Tomarlo
# siempre primero hacía que, tras reemplazar las respuestas o refrescar Kobo,
# Codificación re-adaptara desde la versión vieja: CCSS 2026-2 adaptó 467 casos
# cuando la base tenía 397, sin avisar.
#
# «Original» significa la fuente vigente antes de codificar, no cualquier
# respaldo histórico: si el archivo actual NO es el artefacto adaptado de
# Codificación, la fuente es el actual. Misma regla que
# `.analitica_original_member_id()` (router_analitica.R). Una base adaptada
# sigue re-adaptándose desde su original. Cada base resuelve su propio par.

.CODIF_FUENTE_SLOTS <- list(
  xlsform = list(actual = "xlsform_file_id", original = "original_xlsform_file_id",
                 adaptado = "instrumento_adaptado"),
  data = list(actual = "data_file_id", original = "original_data_file_id",
              adaptado = "data_adaptada")
)

#' Archivo del que Codificación lee un miembro del par de una base.
#'
#' `prefer_original = FALSE` devuelve el actual (y el original si el actual ya
#' no está registrado), como antes.
#' @keywords internal
codificacion_fuente_meta <- function(s, base, slot = c("xlsform", "data"), prefer_original = TRUE) {
  slot <- match.arg(slot)
  campos <- .CODIF_FUENTE_SLOTS[[slot]]
  .meta <- function(campo) {
    fid <- as.character((base %||% list())[[campo]] %||% "")[1]
    if (is.na(fid) || !nzchar(fid)) return(NULL)
    s$files[[fid]]
  }
  actual <- .meta(campos$actual)
  original <- .meta(campos$original)
  if (!isTRUE(prefer_original)) return(actual %||% original)
  es_adaptado <- !is.null(actual) && identical(as.character(actual$kind %||% ""), campos$adaptado)
  if (!is.null(actual) && !es_adaptado) return(actual)
  original %||% actual
}

#' Aviso cuando el n que Codificación leyó no es el de la base.
#'
#' Una adaptación sobre otro número de casos que el de la base es casi siempre
#' una fuente equivocada; se dice en vez de entregarla callada. Devuelve el
#' texto (o NULL) y lo emite sellado para el canal de avisos.
#' @keywords internal
codificacion_fuente_aviso_n <- function(sid, base_name, n_leido) {
  s <- session_get(sid, required = FALSE)
  base <- (((s %||% list())$estudio %||% list())$bases %||% list())[[as.character(base_name %||% "")[1]]]
  n_base <- suppressWarnings(as.integer((base %||% list())$n_filas %||% NA_integer_))[1]
  n_leido <- suppressWarnings(as.integer(n_leido))[1]
  if (is.na(n_base) || is.na(n_leido) || identical(n_base, n_leido)) return(NULL)
  aviso <- sprintf(
    "Codificación leyó %d casos y la base «%s» tiene %d: la adaptación no corresponde a la base vigente. Revisa la fuente antes de usarla.",
    n_leido, base_name, n_base)
  .pulso_aviso(aviso)
  aviso
}
