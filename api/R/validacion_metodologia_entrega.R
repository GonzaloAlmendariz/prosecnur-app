# =============================================================================
# Validación › paquete metodológico (PDF + script R) como entregable (ADR 0133, fase 5)
# =============================================================================
# El job `validacion.v2.methodology_report_bundle` dejaba el ZIP sólo en
# `/api/jobs/<id>/result`, con un `filename` que traía el prefijo del job. Su
# on_complete (proceso principal) lo registra en el file store con el kind
# `metodologia_validacion` —nombre del §3 heredado del `result_filename`, copia
# junto al proyecto— y responde con file_id y los cuatro campos del registro.
# La ruta vive en router_validacion.R y sólo engancha este on_complete.

#' on_complete del paquete metodológico de Validación
#' @keywords internal
.validacion_metodologia_bundle_on_complete <- function(j, base = NULL, firma = NULL) {
  if (is.null(j$result_path) || !file.exists(j$result_path)) {
    # Falla del job, no del pedido: jobs.R lo publica como status "error".
    stop("El paquete metodológico terminó sin archivo.", call. = FALSE)
  }
  datos <- j$result_data
  if (!is.list(datos)) datos <- list()
  extra <- list(n_rules = datos$n_rules %||% NA_integer_,
                inventory_hash = datos$inventory_hash %||% NA_character_,
                entries = datos$entries %||% list())
  reg <- entregable_registrar_job(j$sid, j, "metodologia_validacion", extra = extra)
  # M5: la pestaña Cierre dice si el paquete está al día (limpieza_cierre_resumen.R).
  if (!is.null(base)) {
    .limpieza_registrar_archivo(j$sid, base, "paquete_metodologico", reg$meta, firma,
                                extra = list(contenido = .validacion_metodologia_contenido(datos$entries)))
  }
  reg$respuesta
}

#' on_complete del paquete para una base, con la firma del cierre al pedirlo
#'
#' La firma se toma al lanzar el job: el modelo del informe se armó con esas
#' decisiones, aunque cambien mientras corre. Solo captura la base y la firma.
#' @keywords internal
.validacion_metodologia_on_complete_para <- function(base, firma) {
  force(base); force(firma)
  function(j) .validacion_metodologia_bundle_on_complete(j, base = base, firma = firma)
}

# Qué trae el ZIP, por extensión de cada entrada: "pdf", "r".
.validacion_metodologia_contenido <- function(entries) {
  nombres <- vapply(entries %||% list(), function(e) {
    calc_str(if (is.list(e)) e$name %||% e$path %||% e$filename else e, "")
  }, character(1))
  unique(tolower(tools::file_ext(nombres[nzchar(nombres)])))
}
