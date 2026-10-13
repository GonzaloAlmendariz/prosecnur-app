# Router de los comparativos armonizados (contrato E4-E7, R4)
# ==========================================================
#
# Delgado: lee el body, resuelve filas y períodos con el motor
# (`analitica_armonizada.R`), guarda el apilado en RDS y lanza el job que
# escribe el XLSX (`reporte_comparativo.R`). Los errores de dominio (matriz sin
# armonizar, fila inexistente, variable ausente, columna de peso inexistente)
# salen síncronos, antes del job.
#
#   POST /api/analitica/armonizada/frecuencias {filas?, rotulos_periodos?}
#   POST /api/analitica/armonizada/cruces      {filas?, cruces, rotulos_periodos?}
#
# Respuesta: {ok, job_id, kind}. El resultado del job (GET /api/jobs/<id>)
# trae {ok, file_id, filename, size, sha256, artifacts[deliverable, manifest],
# periodos, resumen}.

#' Worker del job: modelo + writer + manifest.
#'
#' @param input_path RDS con `tipo`, `ap`, `rotulos`, `notas`, `alpha`,
#'   `show_sig` y `filename`.
#' @keywords internal
armonizada_job_worker <- function(input_path, result_path, progress_path = NULL) {
  report <- job_progress_writer(progress_path)
  report("loading", percent = 10, message = "Cargando la serie armonizada...")
  inp <- readRDS(input_path)
  report("building", percent = 40, message = "Calculando las tablas por medición...")
  resumen <- if (identical(inp$tipo, "cruces")) {
    modelo <- armonizada_modelo_cruces(inp$ap, alpha = inp$alpha)
    report("writing", percent = 70, message = "Escribiendo el comparativo de cruces...")
    reporte_comparativo_cruces(modelo, result_path, inp$rotulos, notas = inp$notas,
                               alpha = inp$alpha, show_sig = inp$show_sig)
  } else {
    modelo <- armonizada_modelo_frecuencias(inp$ap)
    report("writing", percent = 70, message = "Escribiendo el comparativo simple...")
    reporte_comparativo_simple(modelo, result_path, inp$rotulos, notas = inp$notas)
  }
  manifest_path <- paste0(result_path, ".manifest.json")
  reporte_comparativo_manifest(manifest_path, inp$tipo, result_path, inp$filename,
                               inp$ap$periodos, inp$rotulos, inp$ap$ponderacion, resumen)
  report("done", percent = 99, message = "Comparativo generado.")
  list(resumen = resumen, manifest_path = manifest_path)
}
attr(armonizada_job_worker, "prosecnur_job_function_name") <- "armonizada_job_worker"

.armonizada_kind <- function(tipo) {
  if (identical(tipo, "cruces")) "comparativo_cruces" else "comparativo_simple"
}

# Registra el XLSX (deliverable) y el manifest con su huella.
.armonizada_registrar <- function(sid, tipo, result_path, manifest_path) {
  kind <- .armonizada_kind(tipo)
  out_name <- .export_filename(sid, kind, "xlsx")
  meta <- .register_output_file(sid, kind, result_path, original_name = out_name)
  man <- .register_output_file(sid, paste0(kind, "_manifest"), manifest_path,
                               original_name = sub("\\.xlsx$", "_manifest.json", out_name))
  sha <- function(p) tolower(digest::digest(file = p, algo = "sha256"))
  artefacto <- function(m, role) list(file_id = m$file_id, filename = m$original_name,
                                      role = role, size = m$size, sha256 = sha(m$path),
                                      mime = if (identical(role, "manifest")) "application/json" else
                                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  list(meta = meta, artifacts = list(artefacto(meta, "deliverable"), artefacto(man, "manifest")))
}

.armonizada_submit <- function(sid, tipo, body) {
  cfg <- .analitica_get_config(sid)
  cc <- cfg$cruces %||% list()
  cruces_refs <- body$cruces
  if (identical(tipo, "cruces") && !length(.armz_refs(cruces_refs))) {
    stop_api(400, "E_ARMONIZADA_SIN_CRUCES",
             "Elige al menos una variable de cruce armonizada.")
  }
  ap <- .armz_preparar(sid, cfg, filas_refs = body$filas,
                       cruces_refs = if (identical(tipo, "cruces")) cruces_refs else NULL)
  rotulos <- .armz_rotulos(ap$periodos, body$rotulos_periodos)
  alpha <- suppressWarnings(as.numeric(cc$alpha %||% 0.05)[1])
  if (is.na(alpha) || alpha <= 0 || alpha >= 1) alpha <- 0.05
  kind <- .armonizada_kind(tipo)
  filename <- .export_filename(sid, kind, "xlsx")
  input_path <- job_save_rds(sid, paste0("armonizada_", tipo), list(
    tipo = tipo, ap = ap, rotulos = rotulos, notas = cfg$notas, alpha = alpha,
    show_sig = isTRUE(cc$show_sig %||% TRUE), filename = filename
  ))
  periodos_out <- lapply(ap$periodos, function(b) list(base = b, rotulo = unname(rotulos[[b]])))
  job_kind <- paste0("analitica.armonizada.", tipo)
  job_id <- job_submit(
    sid = sid,
    kind = job_kind,
    func = armonizada_job_worker,
    args = list(input_path = input_path),
    result_filename = filename,
    on_complete = function(j) {
      manifest_path <- (j$result_data %||% list())$manifest_path %||% paste0(j$result_path, ".manifest.json")
      if (!file.exists(j$result_path) || !file.exists(manifest_path)) {
        stop_api(500, "E_ARMONIZADA_SIN_RESULTADO", "El comparativo no produjo su archivo.")
      }
      reg <- .armonizada_registrar(j$sid, tipo, j$result_path, manifest_path)
      list(ok = TRUE, file_id = reg$meta$file_id, filename = reg$meta$original_name,
           size = reg$meta$size, sha256 = reg$artifacts[[1]]$sha256,
           artifacts = reg$artifacts, periodos = periodos_out,
           resumen = (j$result_data %||% list())$resumen)
    }
  )
  list(ok = TRUE, job_id = job_id, kind = job_kind, periodos = periodos_out)
}

mount_armonizada <- function(pr) {
  pr |>
    plumber::pr_post("/api/analitica/armonizada/frecuencias", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      .armonizada_submit(sid, "frecuencias", .analitica_json_body(req))
    })) |>
    plumber::pr_post("/api/analitica/armonizada/cruces", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      .armonizada_submit(sid, "cruces", .analitica_json_body(req))
    }))
}
