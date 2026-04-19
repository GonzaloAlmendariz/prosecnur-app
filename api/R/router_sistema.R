.shutdown_flag <- new.env(parent = emptyenv())
.shutdown_flag$value <- FALSE

shutdown_requested <- function() isTRUE(.shutdown_flag$value)

mount_sistema <- function(pr) {
  pr |>
    plumber::pr_get("/api/system/health", wrap_endpoint(function(req, res) {
      list(
        ok = TRUE,
        version = as.character(utils::packageVersion("prosecnurapp")),
        prosecnur_version = as.character(utils::packageVersion("prosecnur")),
        time = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
      )
    })) |>
    plumber::pr_post("/api/system/shutdown", wrap_endpoint(function(req, res) {
      .shutdown_flag$value <- TRUE
      list(ok = TRUE, message = "Shutdown requested")
    })) |>
    plumber::pr_post("/api/system/demo", wrap_endpoint(function(req, res) {
      sid <- session_create()
      res$setHeader("X-Pulso-Session", sid)
      samples_dir <- system.file("samples", package = "prosecnurapp")
      if (!nzchar(samples_dir) || !dir.exists(samples_dir)) {
        samples_dir <- file.path(Sys.getenv("PULSO_REPO_ROOT", "."), "api", "inst", "samples")
      }
      inst_path <- file.path(samples_dir, "demo_instrumento.xlsx")
      data_path <- file.path(samples_dir, "demo_data.xlsx")
      if (!file.exists(inst_path) || !file.exists(data_path)) {
        stop_api(500, "E_DEMO_MISSING", sprintf("Samples no encontrados en %s", samples_dir))
      }
      xls_meta <- save_upload(sid, "xlsform", "demo_instrumento.xlsx", readBin(inst_path, "raw", n = file.info(inst_path)$size))
      dat_meta <- save_upload(sid, "data",    "demo_data.xlsx",        readBin(data_path, "raw", n = file.info(data_path)$size))

      inst <- prosecnur::leer_instrumento_xlsform(xls_meta$path)
      session_set(sid, "instrumento", inst)

      data_df <- readxl::read_excel(dat_meta$path)
      session_set(sid, "data_raw_meta", list(file_id = dat_meta$file_id, path = dat_meta$path, ext = "xlsx"))

      rp_inst <- prosecnur::reporte_instrumento(path = xls_meta$path)
      rp_data <- prosecnur::reporte_data(data_df, instrumento = rp_inst)
      session_set(sid, "rp_inst", rp_inst)
      session_set(sid, "rp_data", rp_data)
      session_set(sid, "analitica_prep_ok", TRUE)
      session_set(sid, "analitica_fuente", "demo")

      list(
        ok = TRUE,
        session_id = sid,
        n_preguntas = if (!is.null(inst$survey)) nrow(inst$survey) else 0L,
        n_filas = nrow(data_df),
        n_columnas = ncol(data_df)
      )
    })) |>
    plumber::pr_post("/api/session", wrap_endpoint(function(req, res) {
      existing <- session_header(req)
      if (!is.null(existing) && !is.null(session_get(existing, required = FALSE))) {
        return(list(session_id = existing, reused = TRUE))
      }
      sid <- session_create()
      res$setHeader("X-Pulso-Session", sid)
      list(session_id = sid, reused = FALSE)
    })) |>
    plumber::pr_delete("/api/session", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      ok <- session_delete(sid)
      list(ok = ok)
    })) |>
    plumber::pr_get("/api/session/state", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid, required = FALSE)
      if (is.null(s)) {
        res$status <- 404
        return(list(error = list(code = "E_NO_SESSION", message = "Session not found")))
      }
      files_by_kind <- split(
        unname(s$files),
        vapply(s$files, function(f) f$kind, character(1))
      )
      list(
        session_id = s$id,
        created_at = format(s$created_at, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
        xlsform = !is.null(files_by_kind$xlsform) && length(files_by_kind$xlsform) > 0,
        data = (!is.null(files_by_kind$data) || !is.null(files_by_kind$sav)),
        instrumento_parsed = !is.null(s$instrumento),
        data_previewed = !is.null(s$data_raw_meta),
        plan_built = !is.null(s$plan_result),
        auditoria_run = !is.null(s$evaluacion),
        codif_familias_generated = isTRUE(s$codif_familias_generated),
        codif_familias_loaded = !is.null(s$codif_familias_file_id),
        codif_plantilla_template = isTRUE(s$codif_plantilla_template),
        codif_plantilla_codigos_loaded = !is.null(s$codif_plantilla_codigos_file_id),
        codif_aplicado = isTRUE(s$codif_aplicado),
        analitica_prep_ok = isTRUE(s$analitica_prep_ok),
        analitica_codebook_ok = isTRUE(s$analitica_codebook_ok),
        analitica_frecuencias_ok = isTRUE(s$analitica_frecuencias_ok),
        analitica_cruces_ok = isTRUE(s$analitica_cruces_ok),
        analitica_spss_ok = isTRUE(s$analitica_spss_ok),
        analitica_enumeradores_ok = isTRUE(s$analitica_enumeradores_ok),
        analitica_fuente = s$analitica_fuente %||% NA_character_,
        graficos_ppt_ok = isTRUE(s$graficos_ppt_ok),
        graficos_word_ok = isTRUE(s$graficos_word_ok)
      )
    })) |>
    plumber::pr_post("/api/files/upload", wrap_endpoint(function(req, res, file = NULL, kind = NULL) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      if (is.null(file)) stop_api(400, "E_NO_FILE_FIELD", "Missing 'file' field in multipart body")

      extracted <- if (is.raw(file)) {
        list(bytes = file, original = "upload.bin")
      } else if (is.list(file) && length(file) >= 1 && is.raw(file[[1]])) {
        list(bytes = file[[1]], original = names(file)[1] %||% "upload.bin")
      } else if (is.list(file) && is.raw(file$value)) {
        list(bytes = file$value, original = file$filename %||% "upload.bin")
      } else {
        stop_api(400, "E_BAD_FILE", "Could not extract file bytes from multipart payload")
      }

      kind_str <- if (is.character(kind) && length(kind) >= 1 && nzchar(kind[[1]])) {
        as.character(kind[[1]])
      } else {
        q <- req$args %||% list()
        as.character(q$kind %||% req$QUERY_STRING %||% "")
      }
      if (!nzchar(kind_str)) {
        stop_api(400, "E_NO_KIND_FIELD",
          "Missing 'kind'. Pass it as query param (?kind=xlsform) or form field with Content-Type: text/plain.")
      }
      meta <- save_upload(sid, kind_str, extracted$original, extracted$bytes)
      res$status <- 201
      meta
    })) |>
    plumber::pr_get("/api/files/<file_id>/download", wrap_endpoint(function(req, res, file_id) {
      sid <- session_header(req)
      meta <- get_file(sid, file_id)
      n <- file.info(meta$path)$size
      bytes <- readBin(meta$path, what = "raw", n = n)
      res$setHeader("Content-Type", mime::guess_type(meta$path))
      res$setHeader("Content-Length", as.character(n))
      res$setHeader("Content-Disposition", sprintf('attachment; filename="%s"', meta$original_name))
      res$body <- bytes
      res
    }))
}
