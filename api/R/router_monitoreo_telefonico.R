# =============================================================================
# router_monitoreo_telefonico.R — endpoints propios del monitoreo telefónico
# =============================================================================
#
# Unidad 4.2: el monitoreo telefónico gana identidad propia en la API. Estos
# endpoints cubren la semántica EXCLUSIVA de la familia telefónica; los
# endpoints genéricos de router_monitoreo.R siguen despachando por familia
# para no romper al frontend actual (la migración del frontend a estas rutas
# es la fase siguiente de 4.2).
#
# Contrato:
#   POST /api/monitoreo/telefonico/report/pdf
#     Construye el modelo de avance telefónico (falla con E_PERFIL_NO_TELEFONICO
#     si el proyecto no es de familia telefónica) y lanza el job de render.
#   GET  /api/monitoreo/telefonico/report/pdf/download
#     Descarga el último PDF generado por ESTE endpoint (sesión propia:
#     monitoreo_telefonico_report_pdf); E_NO_REPORTE_TELEFONICO si no hay.
# =============================================================================

# Frontera testeable del POST: resuelve snapshot + config de la sesión y
# construye el modelo telefónico. Separado del handler para poder fijar el
# contrato in-process sin levantar plumber.
.monitoreo_telefonico_report_model_from_session <- function(sid, config = NULL, include_targets = FALSE) {
  s <- session_get(sid)
  snapshot <- s$monitoreo_snapshot %||% NULL
  # Igual que el endpoint genérico: el corte a cliente hereda el filtro
  # real/prueba definido en Carga sin mutar la fuente.
  snapshot <- monitoreo_client_snapshot_with_carga_universe(snapshot, s)
  if (is.null(snapshot) || !is.data.frame(snapshot$data) || !nrow(snapshot$data)) {
    stop_api(409, "E_NO_MONITOREO_DATA", "Sincroniza datos antes de generar el avance telefónico.")
  }
  cfg <- monitoreo_normalize_config(config %||% s$monitoreo_config %||% list(), snapshot$data)
  build_monitoreo_telefonico_report_model(
    snapshot = snapshot,
    cfg = cfg,
    include_targets = isTRUE(include_targets)
  )
}

# Frontera testeable del download: devuelve el meta con path listo o corta con
# E_NO_REPORTE_TELEFONICO. Si el job sigue vivo intenta resolverlo una vez.
.monitoreo_telefonico_pdf_meta_ready <- function(sid) {
  s <- session_get(sid)
  meta <- s$monitoreo_telefonico_report_pdf %||% NULL
  if (is.null(meta) || !isTRUE(meta$disponible) || is.null(meta$path) || !file.exists(meta$path)) {
    if (!is.null(meta$job_id)) {
      # Silencioso a propósito: un job desaparecido o aún corriendo se trata
      # como "PDF no disponible" y cae al 404 de abajo con código propio.
      j <- tryCatch(job_poll(meta$job_id), error = function(e) NULL)
      if (!is.null(j) && identical(j$status, "done") && !is.null(j$result_path) && file.exists(j$result_path)) {
        meta$path <- j$result_path
        meta$disponible <- TRUE
        meta$generated_at <- format(j$finished_at, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
        session_set(sid, "monitoreo_telefonico_report_pdf", meta)
      }
    }
  }
  if (is.null(meta) || !isTRUE(meta$disponible) || is.null(meta$path) || !file.exists(meta$path)) {
    stop_api(404, "E_NO_REPORTE_TELEFONICO", "No hay PDF de avance telefónico generado todavía.")
  }
  meta
}

mount_monitoreo_telefonico <- function(pr) {
  pr |>
    plumber::pr_post("/api/monitoreo/telefonico/report/pdf", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      include_targets <- .monitoreo_bool(parsed$include_targets %||% parsed$includeTargets, FALSE)
      model <- .monitoreo_telefonico_report_model_from_session(
        sid,
        config = parsed$config %||% NULL,
        include_targets = include_targets
      )
      model_path <- job_save_rds(sid, "monitoreo_telefonico_report_model", model)
      filename <- .export_filename(sid, "avance_telefonico_monitoreo", "pdf")
      pdf_job_runner <- monitoreo_telefonico_report_pdf_job_runner
      # Trampa conocida de los workers callr: la función se re-resuelve por
      # nombre en el namespace del paquete dentro del worker.
      attr(pdf_job_runner, "prosecnur_job_function_name") <- "monitoreo_telefonico_report_pdf_job_runner"
      job_id <- job_submit(
        sid = sid,
        kind = "monitoreo.telefonico_advance_pdf",
        func = pdf_job_runner,
        args = list(model_path = model_path, include_targets = include_targets),
        result_filename = filename,
        on_complete = function(j) {
          if (identical(j$status, "done") && !is.null(j$result_path) && file.exists(j$result_path)) {
            session_set(j$sid, "monitoreo_telefonico_report_pdf", list(
              disponible = TRUE,
              path = j$result_path,
              generated_at = format(j$finished_at, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
              include_targets = include_targets,
              report_kind = model$report_kind %||% ""
            ))
          }
          j$result_data
        }
      )
      session_set(sid, "monitoreo_telefonico_report_pdf", list(
        disponible = FALSE,
        job_id = job_id,
        generated_at = NULL,
        include_targets = include_targets,
        report_kind = model$report_kind %||% ""
      ))
      list(ok = TRUE, job_id = job_id, kind = "monitoreo.telefonico_advance_pdf")
    })) |>
    plumber::pr_get("/api/monitoreo/telefonico/report/pdf/download", wrap_endpoint(function(req, res, sid = NULL, inline = NULL, ...) {
      effective_sid <- session_header(req)
      if ((is.null(effective_sid) || !nzchar(effective_sid)) && is.character(sid) && length(sid) >= 1L && nzchar(sid[[1]])) {
        effective_sid <- sid[[1]]
      }
      meta <- .monitoreo_telefonico_pdf_meta_ready(effective_sid)
      n <- file.info(meta$path)$size
      bytes <- readBin(meta$path, what = "raw", n = n)
      res$setHeader("Content-Type", "application/pdf")
      res$setHeader("Content-Length", as.character(n))
      modo <- if (is.character(inline) && length(inline) >= 1L && inline[[1]] %in% c("1", "true", "TRUE")) "inline" else "attachment"
      res$setHeader("Content-Disposition", sprintf('%s; filename="%s"', modo, basename(meta$path)))
      res$body <- bytes
      res
    }))
}
