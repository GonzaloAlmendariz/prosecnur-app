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
