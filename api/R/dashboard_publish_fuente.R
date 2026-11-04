# =============================================================================
# Un tablero no se publica sin fuente
# =============================================================================
#
# El artefacto público reconstruye sus cachés desde `dashboard_source` y sus dos
# archivos (instrumento y base) en files/. Sin ellos el runtime arranca, pero el
# cliente abre «Dashboard no disponible»: una página vacía publicada como si
# fuera el tablero. Lo destapó la prueba en vivo del modo público (4 nov 2026),
# con un proyecto que tenía base cargada pero ninguna elegida para el tablero.
#
# Todos los caminos que publican un tablero pasan por aquí: el botón Publicar
# (.dashboard_publish_prepare_space → .dashboard_publish_snapshot) y el deploy
# manual (api/scripts/publicacion_preparar.R, que usa el mismo snapshot). La UI
# deshabilita el botón con este mismo motivo (features/dashboard/publish/
# accionPublicar.ts); mantener las dos frases iguales.

.PUBLICACION_MOTIVO_SIN_FUENTE <-
  "El tablero no tiene base elegida: elígela en Dashboard › Fuente antes de publicar."
.PUBLICACION_MOTIVO_FUENTE_PERDIDA <-
  "La base o el instrumento elegidos para el tablero ya no están en el proyecto: vuelve a elegirlos en Dashboard › Fuente antes de publicar."

#' Exige que el tablero tenga fuente completa antes de armar lo que se publica.
#' Falla con 409 E_DASHBOARD_SIN_FUENTE y dice qué falta en `details`.
#' @keywords internal
.publicacion_exigir_fuente_dashboard <- function(s) {
  fuente <- if (is.list(s)) s[["dashboard_source"]] %||% list() else list()
  ids <- c(
    instrumento = .planner_chr1(fuente$xlsform_file_id),
    base = .planner_chr1(fuente$data_file_id)
  )
  if (!all(nzchar(ids))) {
    stop_api(409, "E_DASHBOARD_SIN_FUENTE", .PUBLICACION_MOTIVO_SIN_FUENTE,
             details = list(falta = names(ids)[!nzchar(ids)]))
  }
  presentes <- names(s[["files"]] %||% list())
  perdidos <- ids[!ids %in% presentes]
  if (length(perdidos)) {
    stop_api(409, "E_DASHBOARD_SIN_FUENTE", .PUBLICACION_MOTIVO_FUENTE_PERDIDA,
             details = list(falta = names(perdidos), file_id = unname(perdidos)))
  }
  invisible(TRUE)
}
