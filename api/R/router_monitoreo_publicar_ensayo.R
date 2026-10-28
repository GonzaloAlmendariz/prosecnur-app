# =============================================================================
# router_monitoreo_publicar_ensayo.R — ensayo «Revisar» de las publicaciones de
# Avance › Salidas a Google Sheets (Meta B, L38).
#
#   POST /api/monitoreo/publication/sheets/revisar          (Salidas, cliente/interno)
#   POST /api/monitoreo/sheets/publish/revisar               (pestañas internas)
#   POST /api/monitoreo/client-report/sheets/publish/revisar (reporte a cliente)
#
# Cada ruta es el gemelo de solo lectura de su endpoint de publicación: mismo
# body, mismo destino (`monitoreo_publicar_destino_*`), y en vez de escribir
# devuelve el diff por pestaña. Síncrono a propósito: solo lee las pestañas que
# se publicarían. Se eligió una ruta aparte y no `dry_run` sobre el endpoint de
# escritura para que un cliente que olvide la bandera nunca escriba por error.
# =============================================================================

mount_monitoreo_publicar_ensayo <- function(pr) {
  revisar <- function(destino) {
    wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      d <- destino(sid, session_get(sid), parsed)
      ensayo <- monitoreo_publicar_ensayo(d$spreadsheet_id, d$tabs)
      if (!is.null(d$audience)) ensayo$audience <- d$audience
      if (!is.null(d$preflight)) ensayo$preflight_status <- d$preflight$status %||% ""
      ensayo
    })
  }
  pr |>
    plumber::pr_post("/api/monitoreo/publication/sheets/revisar", revisar(monitoreo_publicar_destino_publicacion)) |>
    plumber::pr_post("/api/monitoreo/sheets/publish/revisar", revisar(monitoreo_publicar_destino_interno)) |>
    plumber::pr_post("/api/monitoreo/client-report/sheets/publish/revisar", revisar(monitoreo_publicar_destino_cliente))
}
