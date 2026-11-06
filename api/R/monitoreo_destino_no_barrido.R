# La base de control nunca se escribe en el documento del barrido.
#
# Regla de Gonzalo (2026-11-02): «los enumeradores solo tienen acceso a la base
# de barrido no la de control». Lo que Monitoreo publica —pestañas internas,
# ejecutivo, reporte a cliente, rondas de supervisión— no puede caer en el
# Sheets que se comparte con campo. Se compara el documento destino con cada
# fuente conectada con rol `barrido`.

#' Ids de los documentos conectados como fuente de barrido.
#' @keywords internal
.monitoreo_documentos_de_barrido <- function(sources = list()) {
  ids <- vapply(sources %||% list(), function(f) {
    if (!is.list(f) || !identical(.monitoreo_scalar(f$role, ""), "barrido")) return("")
    .monitoreo_extract_spreadsheet_id(.monitoreo_scalar((f$sheet_binding %||% list())$spreadsheet_id, ""))
  }, character(1))
  unique(ids[nzchar(ids)])
}

#' Se niega a publicar en un documento conectado como fuente de barrido.
#'
#' @param s la sesión (lee `monitoreo_sources`).
#' @param spreadsheet_id el destino que se va a escribir.
#' @param que qué se iba a publicar, para el mensaje.
#' @return invisible(TRUE) si el destino no es un barrido.
#' @keywords internal
monitoreo_guarda_destino_no_barrido <- function(s, spreadsheet_id, que = "la base de control") {
  destino <- .monitoreo_extract_spreadsheet_id(.monitoreo_scalar(spreadsheet_id, ""))
  if (!nzchar(destino)) return(invisible(TRUE))
  if (destino %in% .monitoreo_documentos_de_barrido((s %||% list())$monitoreo_sources)) {
    stop_api(
      409, "E_MONITOREO_DESTINO_ES_BARRIDO",
      sprintf(paste(
        "Ese Sheets es la base de barrido, la que ven los enumeradores: %s no se publica ahí.",
        "Usa otro documento, el de control del equipo."), que),
      details = list(spreadsheet_id = destino)
    )
  }
  invisible(TRUE)
}
