# Router de los comparativos armonizados (contrato E4-E7, R4)
# ==========================================================
#
# Delgado: lee el body, resuelve filas y períodos con el motor
# (`analitica_armonizada.R`), guarda el apilado en RDS y lanza el job que
# escribe el XLSX (`reporte_comparativo.R`). Los errores de dominio (matriz sin
# armonizar, fila inexistente, variable ausente, columna de peso inexistente)
# salen síncronos, antes del job.
#
#   POST /api/analitica/armonizada/frecuencias {filas?, rotulos_periodos?,
#        notas_pregunta?, notas_generales?}
#   POST /api/analitica/armonizada/cruces      {filas?, cruces?, rotulos_periodos?,
#        notas_pregunta?, notas_generales?}
#
# Sin `cruces`, el comparativo de cruces usa las filas de la matriz marcadas
# `cruce` (segmentos del estudio, ADR 0107).
#
# `notas_pregunta` es {<id|etiqueta|variable de la fila>: "texto"} y se imprime
# bajo el pie de esa pregunta. `notas_generales` es ["texto", ...] y se imprime
# bajo el pie de todas. Errores de dominio R4b (409): E_ARMONIZADA_PESO_NO_DECLARADO,
# E_ARMONIZADA_MAPA_ROTO, E_ARMONIZADA_SELECT_MULTIPLE. Notas mal formadas: 400
# E_ARMONIZADA_NOTAS_INVALIDAS.
#
# Respuesta: {ok, job_id, kind, periodos}. El resultado del job (GET /api/jobs/<id>)
# trae {ok, file_id, filename, size, sha256, artifacts[deliverable, manifest],
# periodos, resumen}. `resumen.preguntas[*].sin_mapa` y `resumen.avisos`
# declaran los casos sin correspondencia y las sumas de pesos desviadas.

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
                               alpha = inp$alpha, show_sig = inp$show_sig, extras = inp$extras)
  } else {
    modelo <- armonizada_modelo_frecuencias(inp$ap)
    report("writing", percent = 70, message = "Escribiendo el comparativo simple...")
    reporte_comparativo_simple(modelo, result_path, inp$rotulos, notas = inp$notas,
                               extras = inp$extras)
  }
  resumen$avisos <- armonizada_avisos(inp$ap, inp$rotulos, (inp$extras %||% list())$notas_pregunta)
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

# Notas libres del body: {clave: texto} y [texto]. Sin cadenas vacías.
.armonizada_extras <- function(body) {
  np <- body$notas_pregunta %||% list()
  ng <- body$notas_generales %||% list()
  es_texto <- function(x) is.character(x) && length(x) == 1L && !is.na(x)
  if (!is.list(np) || (length(np) && (is.null(names(np)) || any(!nzchar(names(np))))) ||
      !all(vapply(np, es_texto, logical(1)))) {
    stop_api(400, "E_ARMONIZADA_NOTAS_INVALIDAS",
             "'notas_pregunta' debe ser un objeto {pregunta: texto}.")
  }
  if (!(is.list(ng) || is.character(ng)) || !all(vapply(as.list(ng), es_texto, logical(1)))) {
    stop_api(400, "E_ARMONIZADA_NOTAS_INVALIDAS", "'notas_generales' debe ser una lista de textos.")
  }
  np <- np[nzchar(trimws(unlist(np)))]
  ng <- unlist(ng, use.names = FALSE)
  list(notas_pregunta = lapply(np, trimws), notas_generales = trimws(ng[nzchar(trimws(ng))]))
}

.armonizada_submit <- function(sid, tipo, body) {
  cfg <- .analitica_get_config(sid)
  cc <- cfg$cruces %||% list()
  cruces_refs <- body$cruces
  # ADR 0107: sin `cruces`, los segmentos de cruce del estudio.
  if (identical(tipo, "cruces") && !length(.armz_refs(cruces_refs))) {
    cruces_refs <- segmentos_cruces_por_defecto(sid)
  }
  if (identical(tipo, "cruces") && !length(.armz_refs(cruces_refs))) {
    stop_api(400, "E_ARMONIZADA_SIN_CRUCES",
             "Elige al menos una variable de cruce armonizada o declara un segmento de cruce del estudio.")
  }
  extras <- .armonizada_extras(body)
  # ADR 0107: la nota de cada segmento usado como cruce va al pie de todas sus tablas.
  if (identical(tipo, "cruces")) {
    extras$notas_generales <- unique(c(segmentos_notas_de_cruces(sid, cruces_refs), extras$notas_generales))
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
    show_sig = isTRUE(cc$show_sig %||% TRUE), filename = filename, extras = extras
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
