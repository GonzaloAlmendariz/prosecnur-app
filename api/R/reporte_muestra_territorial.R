# =============================================================================
# Renderizado del reporte decisional del calculo muestral territorial
# =============================================================================
#
# Lee el estado actual del modulo Hojas de Ruta (config integrada + outputs
# de las etapas poblacion/muestra/cuotas) y genera un reporte Quarto al
# mismo estilo que el de aulas universitarias. La generacion va a un job
# async (patron jobs.R) para no bloquear el endpoint.

#' Renderiza el reporte decisional del calculo muestral territorial.
#'
#' @param config Config integrada de Hojas de Ruta (`hojas_ruta_config`).
#' @param territorios Lista de territorios seleccionados.
#' @param population Output de population-preview (lista de celdas).
#' @param sample_size_preview Output de sample-size-preview.
#' @param quota Output de quota-preview.
#' @param decision_log Registro opcional de decisiones.
#' @param output_file Path absoluto del archivo a generar.
#' @param formato `"html"` (default) o `"pdf"`.
#' @param quiet Reduce salida de `quarto_render`.
#' @param progress_path Ruta del archivo de progreso del job.
#' @return Invisiblemente la ruta del archivo generado.
#' @export
reporte_muestra_territorial <- function(config,
                                        territorios = list(),
                                        population = NULL,
                                        sample_size_preview = NULL,
                                        quota = NULL,
                                        decision_log = NULL,
                                        output_file,
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
             "No se encontro el ejecutable `quarto` en el sistema.")
  }

  template_qmd <- .mt_locate_template()
  if (!nzchar(template_qmd) || !file.exists(template_qmd)) {
    stop_api(500, "E_NO_TEMPLATE",
             "No se encontro la plantilla `plantillas/muestra_territorial.qmd`.")
  }

  if (!is.null(progress_path)) {
    job_progress_writer(progress_path)(
      "preparando", percent = 10, message = "Preparando bundle"
    )
  }

  tmp_root <- tempfile("reporte_muestra_territorial_")
  dir.create(tmp_root, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(tmp_root, recursive = TRUE, force = TRUE), add = TRUE)

  bundle <- list(
    config              = config,
    territorios         = territorios,
    population          = population,
    sample_size_preview = sample_size_preview,
    quota               = quota,
    decision_log        = decision_log
  )
  path_rds <- file.path(tmp_root, "bundle_muestra_territorial.rds")
  saveRDS(bundle, file = path_rds, version = 3)

  path_qmd <- file.path(tmp_root, "muestra_territorial.qmd")
  copied <- file.copy(template_qmd, path_qmd, overwrite = TRUE)
  if (!isTRUE(copied)) {
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
    titulo <- .mt_titulo_default(config, territorios)
    render_args$execute_params <- list(
      bundle_path = path_rds,
      titulo      = titulo
    )
  } else {
    stop_api(500, "E_QUARTO_OLD",
             "Version de `quarto` muy antigua: falta `execute_params`.")
  }
  if ("quiet" %in% qr_formals) render_args$quiet <- isTRUE(quiet)
  if ("output_dir" %in% qr_formals) render_args$output_dir <- tmp_root

  do.call(quarto::quarto_render, render_args)

  rendered_file <- file.path(tmp_root, out_name)
  if (!file.exists(rendered_file)) {
    stop_api(500, "E_RENDER_FALLO",
             "Quarto no produjo el archivo esperado.")
  }

  ok <- file.copy(rendered_file, output_file, overwrite = TRUE)
  if (!isTRUE(ok)) {
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

.mt_locate_template <- function() {
  candidates <- c(
    system.file("plantillas/muestra_territorial.qmd", package = "prosecnurapp"),
    system.file("plantillas/muestra_territorial.qmd", package = "prosecnur"),
    file.path(getwd(), "api", "inst", "plantillas", "muestra_territorial.qmd"),
    file.path(getwd(), "inst", "plantillas", "muestra_territorial.qmd")
  )
  hit <- candidates[nzchar(candidates) & file.exists(candidates)][1]
  if (is.na(hit)) "" else hit
}

.mt_titulo_default <- function(config, territorios) {
  if (!is.null(config$titulo) && nzchar(config$titulo)) return(config$titulo)
  if (length(territorios) == 0L) return("Calculo muestral territorial")
  n <- length(territorios)
  sprintf("Propuesta muestral territorial - %d %s",
          n, if (n == 1L) "distrito" else "distritos")
}

#' Funcion de job para renderizar el reporte en subproceso.
muestra_territorial_render_job <- function(config, territorios, population,
                                            sample_size_preview, quota,
                                            decision_log, formato = "html",
                                            result_path = NULL,
                                            progress_path = NULL) {
  if (is.null(result_path) || !nzchar(result_path)) {
    stop("result_path requerido para el job de reporte.", call. = FALSE)
  }
  reporte_muestra_territorial(
    config              = config,
    territorios         = territorios,
    population          = population,
    sample_size_preview = sample_size_preview,
    quota               = quota,
    decision_log        = decision_log,
    output_file         = result_path,
    formato             = formato,
    quiet               = TRUE,
    progress_path       = progress_path
  )
  list(ok = TRUE, path = result_path, formato = formato,
       generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
}
