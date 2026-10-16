# Codificación › Adaptación: la base cambió después de la última adaptación.
#
# Reemplazar las respuestas o volver a cerrar la limpieza descarta la
# adaptación aplicada y conserva el catálogo (ADR 0100 D3). La pantalla no lo
# decía: mostraba el plan igual que si nunca se hubiera adaptado. La marca
# `readaptar_desde` la deja `.codif_strip_applied_state()` cuando quita una
# adaptación que existía; deja de valer en cuanto se vuelve a adaptar.

#' ¿Hay que volver a adaptar porque la base cambió?
#' @keywords internal
codificacion_respuestas_cambiaron <- function(sid, source = NULL) {
  desde <- tryCatch(codif_get(sid, "readaptar_desde", source = source), error = function(e) NULL)
  aplicado <- tryCatch(codif_get(sid, "aplicado", source = source), error = function(e) NULL)
  !is.null(desde) && nzchar(as.character(desde)[1]) && !isTRUE(aplicado)
}

#' La adaptación terminó sobre las mismas respuestas de las que partió.
#'
#' Si la base recibió otra versión de sus respuestas mientras el job corría, el
#' resultado habla de la anterior: aplicarlo pisaría la base nueva con la
#' adaptada vieja (visto en HSyVbG, 2026-10-16). Se descarta y se dice.
#' @keywords internal
codificacion_verificar_respuestas_de_partida <- function(sid, base_name, data_fid_partida) {
  partida <- as.character(data_fid_partida %||% "")[1]
  if (is.na(partida) || !nzchar(partida)) return(invisible(TRUE))
  s <- session_get(sid, required = FALSE)
  actual <- as.character(((((s %||% list())$estudio %||% list())$bases %||% list())[[base_name]] %||% list())$data_file_id %||% "")[1]
  if (!is.na(actual) && nzchar(actual) && !identical(actual, partida)) {
    stop_api(409, "E_CODIF_RESPUESTAS_CAMBIARON",
             "Las respuestas de la base cambiaron mientras se adaptaba, así que esta adaptación se descartó. Vuelve a adaptar.")
  }
  invisible(TRUE)
}
