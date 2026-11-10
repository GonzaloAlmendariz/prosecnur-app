# =============================================================================
# Entrega de los archivos de Monitoreo (ADR 0133, fase 5)
# =============================================================================
# Los PDF de avance (territorial, telefónico, aulas, reporte al cliente) y el de
# producción por responsable corren en un worker callr. Su `on_complete`
# (proceso principal) los registra como entregables —nombre del §3, copia en
# `Entregables/Monitoreo`— y responde con `file_id`, `filename`, `size` y los
# cuatro campos del registro. La meta de sesión que leen las rutas heredadas
# `…/pdf/download` se conserva, con el `file_id` agregado.

#' on_complete de un PDF de Monitoreo
#'
#' `kind` es el del catálogo (`avance_*_monitoreo`, `reporte_cliente_monitoreo`,
#' `produccion_responsable_monitoreo`); `clave` la meta de sesión; `extra_meta`
#' lo que esa meta ya guardaba (include_targets, report_kind, title).
#' @keywords internal
.monitoreo_reporte_pdf_on_complete <- function(j, kind, clave, extra_meta = list()) {
  if (is.null(j$result_path) || !file.exists(j$result_path)) {
    # Falla del job, no del pedido: jobs.R lo publica como status «error».
    stop("El PDF de Monitoreo terminó sin archivo.", call. = FALSE)
  }
  if (is.null(session_get(j$sid, required = FALSE))) return(list(ok = FALSE))
  out <- entregable_registrar_job(j$sid, j, kind)
  session_set(j$sid, clave, c(list(
    disponible = TRUE,
    path = j$result_path,
    file_id = out$meta$file_id,
    generated_at = format(j$finished_at %||% Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  ), extra_meta))
  out$respuesta
}

#' Un archivo registrado tal como lo ve el cliente: sin la ruta del servidor y
#' con `filename` y los cuatro campos del registro (ADR 0133 §1)
#' @keywords internal
.monitoreo_archivo_publico <- function(meta) {
  if (!is.list(meta) || is.null(meta$file_id)) return(meta)
  publico <- meta[setdiff(names(meta), c("path", "modulo", "rotulo", "guardado_en", "aviso_guardado"))]
  publico$filename <- meta$original_name
  entregable_respuesta(publico, meta)
}
