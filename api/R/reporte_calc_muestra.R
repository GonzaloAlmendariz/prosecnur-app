# =============================================================================
# Renderizado de reportes del Calculador de Muestra (multi-modo)
# =============================================================================
#
# Despacha entre 2 plantillas Quarto según el modo de trabajo:
#   - estimacion_preliminar → propuesta_preliminar.qmd
#   - diseno_validado        → diseno_validado.qmd
#
# El seguimiento y cierre de campo no son alcance de este módulo
# (viven en /monitoreo).

#' Renderiza el reporte del estudio según su modo de trabajo.
#'
#' @param estudio Lista normalizada (`calc_muestra_normalize_estudio`) con
#'   componentes ya calculados.
#' @param output_file Ruta absoluta del archivo de salida.
#' @param formato "html" o "pdf".
#' @return Invisible: ruta del archivo generado.
#' @export
reporte_calc_muestra <- function(estudio, output_file,
                                  formato = c("html", "pdf"),
                                  quiet = FALSE,
                                  progress_path = NULL) {
  formato <- match.arg(formato)

  if (!requireNamespace("quarto", quietly = TRUE)) {
    stop_api(500, "E_NO_QUARTO_PKG",
             "El paquete `quarto` es necesario para generar el reporte.")
  }
  if (!nzchar(Sys.which("quarto"))) {
    stop_api(500, "E_NO_QUARTO_CLI",
             "No se encontró el ejecutable `quarto` en el sistema.")
  }

  modo <- estudio$modo_trabajo %||% "estimacion_preliminar"
  template_name <- switch(modo,
    estimacion_preliminar = "propuesta_preliminar.qmd",
    diseno_validado       = "diseno_validado.qmd",
    "propuesta_preliminar.qmd"
  )

  template_qmd <- .cm_locate_template(template_name)
  if (!nzchar(template_qmd) || !file.exists(template_qmd)) {
    stop_api(500, "E_NO_TEMPLATE",
             sprintf("No se encontró la plantilla 'plantillas/calc_muestra/%s'.",
                     template_name))
  }

  if (!is.null(progress_path)) {
    writer <- job_progress_writer(progress_path)
    writer("preparando", percent = 10, message = "Preparando bundle")
  }

  estudio <- .cm_reporte_filtrar_componentes(estudio)

  tmp_root <- tempfile("reporte_calc_muestra_")
  dir.create(tmp_root, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(tmp_root, recursive = TRUE, force = TRUE), add = TRUE)

  bundle <- list(estudio = estudio, formato = formato, modo = modo)
  path_rds <- file.path(tmp_root, "bundle_calc_muestra.rds")
  saveRDS(bundle, file = path_rds, version = 3)

  path_qmd <- file.path(tmp_root, template_name)
  if (!isTRUE(file.copy(template_qmd, path_qmd, overwrite = TRUE))) {
    stop_api(500, "E_TEMPLATE_COPY",
             "No se pudo copiar la plantilla Quarto al directorio temporal.")
  }

  out_dir <- dirname(output_file)
  if (!dir.exists(out_dir)) {
    dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
  }

  if (!is.null(progress_path)) {
    job_progress_writer(progress_path)(
      "renderizando", percent = 30, message = "Renderizando con Quarto"
    )
  }

  out_name <- basename(output_file)
  qr_formals <- names(formals(quarto::quarto_render))
  render_args <- list(input = path_qmd, output_file = out_name)
  render_args$output_format <- if (formato == "pdf") "pdf" else "html"
  if ("execute_params" %in% qr_formals) {
    render_args$execute_params <- list(
      bundle_path = path_rds,
      titulo      = estudio$titulo %||% "Cálculo muestral"
    )
  } else {
    stop_api(500, "E_QUARTO_OLD",
             "Versión de `quarto` muy antigua: falta `execute_params`.")
  }
  if ("quiet" %in% qr_formals) render_args$quiet <- isTRUE(quiet)
  if ("output_dir" %in% qr_formals) render_args$output_dir <- tmp_root

  do.call(quarto::quarto_render, render_args)

  rendered_file <- file.path(tmp_root, out_name)
  if (!file.exists(rendered_file)) {
    stop_api(500, "E_RENDER_FALLO",
             "Quarto no produjo el archivo esperado.")
  }
  if (!isTRUE(file.copy(rendered_file, output_file, overwrite = TRUE))) {
    stop_api(500, "E_COPY_FAIL",
             "No se pudo copiar el reporte renderizado a output_file.")
  }

  if (!is.null(progress_path)) {
    job_progress_writer(progress_path)(
      "done", percent = 100, message = "Reporte listo"
    )
  }

  invisible(output_file)
}

.cm_reporte_filtrar_componentes <- function(estudio) {
  ws <- estudio$workspace %||% NULL
  escenarios <- ws$escenarios %||% list()
  if (length(escenarios) == 0L || length(estudio$componentes %||% list()) == 0L) {
    return(estudio)
  }
  seleccionados <- vapply(escenarios, function(e) {
    if (!is.list(e) || !isTRUE(e$incluir_reporte)) return("")
    e$component_id %||% ""
  }, character(1))
  seleccionados <- seleccionados[nzchar(seleccionados)]
  if (length(seleccionados) == 0L) return(estudio)
  comps <- Filter(function(c) (c$id %||% "") %in% seleccionados, estudio$componentes)
  if (length(comps) > 0L) estudio$componentes <- comps
  estudio
}

.cm_locate_template <- function(template_name) {
  candidates <- c(
    system.file(file.path("plantillas", "calc_muestra", template_name),
                package = "prosecnurapp"),
    file.path(getwd(), "api", "inst", "plantillas", "calc_muestra", template_name),
    file.path(getwd(), "inst", "plantillas", "calc_muestra", template_name)
  )
  hit <- candidates[nzchar(candidates) & file.exists(candidates)][1]
  if (is.na(hit)) "" else hit
}

#' Función del job de rendering — pensada para `job_submit`.
calc_muestra_render_job <- function(estudio, formato = "html",
                                     result_path = NULL,
                                     progress_path = NULL) {
  if (is.null(result_path) || !nzchar(result_path)) {
    stop("result_path requerido para el job de reporte.", call. = FALSE)
  }
  reporte_calc_muestra(
    estudio       = estudio,
    output_file   = result_path,
    formato       = formato,
    quiet         = TRUE,
    progress_path = progress_path
  )
  list(ok = TRUE, path = result_path, formato = formato,
       generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
}
