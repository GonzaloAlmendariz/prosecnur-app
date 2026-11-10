# =============================================================================
# Entrega de los reportes que se generan por job (ADR 0133, fase 5)
# =============================================================================
# El reporte de Cálculo de muestra y el reporte decisional de Hojas de ruta
# corren en un worker callr y antes terminaban sin archivo en la respuesta: el
# front lo pedía después por su ruta `/descargar`. Ahora el `on_complete`
# (proceso principal) lo registra como entregable —nombre del §3, copia junto al
# proyecto— y responde con `file_id`, `filename`, `size` y los cuatro campos del
# registro. La meta de sesión que leen las rutas `/descargar` se conserva igual,
# con el `file_id` agregado, y la ruta del worker no viaja en la respuesta.

# Respuesta pública del job a partir de lo que devolvió el worker, sin su `path`.
.reporte_job_extra <- function(j, formato) {
  datos <- j$result_data
  if (!is.list(datos)) datos <- list()
  list(formato = datos$formato %||% formato, generated_at = datos$generated_at %||% NA_character_)
}

.reporte_job_registrar <- function(sid, j, kind, clave_sesion, formato, meta_previa = list()) {
  if (is.null(j$result_path) || !file.exists(j$result_path)) {
    # Falla del job, no del pedido: jobs.R lo publica como status «error».
    stop("El reporte terminó sin archivo.", call. = FALSE)
  }
  s_now <- session_get(sid, required = FALSE)
  if (is.null(s_now)) return(.reporte_job_extra(j, formato))
  out <- entregable_registrar_job(sid, j, kind, extra = .reporte_job_extra(j, formato))
  meta_sesion <- meta_previa
  meta_sesion$disponible <- TRUE
  meta_sesion$path <- j$result_path
  meta_sesion$formato <- formato
  meta_sesion$file_id <- out$meta$file_id
  meta_sesion$generated_at <- format(j$finished_at %||% Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  session_set(sid, clave_sesion, meta_sesion)
  out$respuesta
}

#' on_complete del reporte decisional de Hojas de ruta
#' @keywords internal
.hojas_ruta_reporte_on_complete <- function(sid, j, formato) {
  .reporte_job_registrar(sid, j, "reporte_muestra_territorial", "hojas_ruta_reporte_decisional", formato)
}

#' on_complete del reporte de Cálculo de muestra
#'
#' Conserva lo que la meta ya traía (`job_id`, `stale`): la ruta `/descargar` y el
#' aviso de desactualizado la leen.
#' @keywords internal
.calc_muestra_reporte_on_complete <- function(sid, j, formato) {
  previa <- (session_get(sid, required = FALSE) %||% list())$calc_muestra_reporte %||% list()
  .reporte_job_registrar(sid, j, "reporte_calc_muestra", "calc_muestra_reporte", formato, meta_previa = previa)
}
