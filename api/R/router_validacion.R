.read_data_for_validation <- function(path, ext) {
  switch(ext,
    xlsx = readxl::read_excel(path),
    xls  = readxl::read_excel(path),
    csv  = utils::read.csv(path, stringsAsFactors = FALSE),
    sav  = haven::read_sav(path),
    stop_api(400, "E_UNSUPPORTED_EXT", sprintf("Unsupported data extension: %s", ext))
  )
}

.require_xlsform <- function(sid) {
  s <- session_get(sid)
  xlsform_files <- Filter(function(f) f$kind == "xlsform", s$files)
  if (length(xlsform_files) == 0) {
    stop_api(409, "E_NO_XLSFORM", "No XLSForm uploaded yet. Upload one with kind='xlsform' first.")
  }
  xlsform_files[[length(xlsform_files)]]
}

.require_data_file <- function(sid) {
  s <- session_get(sid)
  data_files <- Filter(function(f) f$kind %in% c("data", "sav"), s$files)
  if (length(data_files) == 0) {
    stop_api(409, "E_NO_DATA", "No data file uploaded yet. Upload with kind='data' or 'sav' first.")
  }
  data_files[[length(data_files)]]
}

.ensure_inst_limpieza <- function(sid) {
  s <- session_get(sid)
  if (!is.null(s$inst_limpieza)) return(s$inst_limpieza)
  meta <- .require_xlsform(sid)
  inst <- prosecnur::leer_xlsform_limpieza(meta$path, verbose = FALSE)
  session_set(sid, "inst_limpieza", inst)
  inst
}

.plan_rows_preview <- function(plan, n = 50) {
  df <- utils::head(plan, n)
  jsonlite::toJSON(df, na = "null", dataframe = "rows", auto_unbox = TRUE) |>
    jsonlite::fromJSON(simplifyVector = FALSE)
}

.ggplot_to_png <- function(gg, width = 14, height = 10, dpi = 120) {
  tmp <- tempfile(fileext = ".png")
  ggplot2::ggsave(tmp, plot = gg, width = width, height = height, dpi = dpi, bg = "white")
  tmp
}

mount_validacion <- function(pr) {
  pr |>
    plumber::pr_post("/api/validacion/plan", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      body <- tryCatch(
        jsonlite::fromJSON(rawToChar(req$bodyRaw %||% charToRaw("{}")), simplifyVector = TRUE),
        error = function(e) list()
      )
      meta <- .require_xlsform(sid)
      .ensure_inst_limpieza(sid)

      incluir <- body$incluir %||% list(
        requeridos = TRUE, otros = TRUE, relevantes = TRUE,
        restricciones = TRUE, calculos = TRUE, controles = TRUE,
        constantes = TRUE, atipicos = TRUE
      )
      config <- prosecnur::acnur_config()

      plan_result <- prosecnur::construir_plan_limpieza(
        ruta_xlsform = meta$path,
        idioma = body$idioma %||% "es",
        config = config,
        incluir = incluir,
        silencioso = TRUE
      )
      session_set(sid, "plan_result", plan_result)

      list(
        ok = TRUE,
        n_reglas = nrow(plan_result$plan),
        resumen = .plan_rows_preview(plan_result$resumen, n = 50),
        plan_preview = .plan_rows_preview(plan_result$plan, n = 50)
      )
    })) |>
    plumber::pr_post("/api/validacion/plan/export", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      if (is.null(s$plan_result)) stop_api(409, "E_NO_PLAN", "Build the plan first with POST /api/validacion/plan")
      inst <- .ensure_inst_limpieza(sid)

      file_id <- uuid::UUIDgenerate()
      out_path <- file.path(s$dir, "downloads", sprintf("plan_limpieza_%s.xlsx", file_id))
      prosecnur::exportar_plan_limpieza(
        plan = s$plan_result$plan,
        x = inst,
        path = out_path,
        overwrite = TRUE
      )
      size <- file.info(out_path)$size
      meta <- list(
        file_id = file_id, kind = "plan_limpieza_export",
        original_name = basename(out_path), path = out_path,
        size = as.integer(size), ext = "xlsx",
        uploaded_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
      )
      files <- s$files
      files[[file_id]] <- meta
      session_set(sid, "files", files)
      list(ok = TRUE, file_id = file_id, size = meta$size)
    })) |>
    plumber::pr_post("/api/validacion/plan/import", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      body <- jsonlite::fromJSON(rawToChar(req$bodyRaw), simplifyVector = TRUE)
      if (is.null(body$file_id)) stop_api(400, "E_MISSING_FILE_ID", "Body must include file_id")
      meta <- get_file(sid, body$file_id)
      plan_df <- prosecnur::cargar_plan_excel(meta$path)

      prev <- session_get(sid)$plan_result
      new_result <- if (is.null(prev)) {
        list(plan = plan_df, resumen = NULL, secciones = NULL, meta = NULL)
      } else {
        prev$plan <- plan_df
        prev
      }
      session_set(sid, "plan_result", new_result)
      list(ok = TRUE, n_reglas = nrow(plan_df), plan_preview = .plan_rows_preview(plan_df, n = 50))
    })) |>
    plumber::pr_post("/api/validacion/auditoria", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      if (is.null(s$plan_result)) stop_api(409, "E_NO_PLAN", "Build or import the plan first")
      data_meta <- .require_data_file(sid)

      datos <- .read_data_for_validation(data_meta$path, data_meta$ext)
      ev <- prosecnur::evaluar_consistencia(
        datos = datos,
        plan = s$plan_result$plan,
        contar_na_como_inconsistencia = FALSE
      )
      session_set(sid, "evaluacion", ev)
      total <- tryCatch(prosecnur::total_inconsistencias(ev), error = function(e) NA_integer_)

      top <- tryCatch({
        r <- ev$resumen
        if (!is.null(r) && "n_inconsistencias" %in% names(r)) {
          r <- r[order(-r$n_inconsistencias), , drop = FALSE]
          utils::head(r, 20)
        } else r
      }, error = function(e) NULL)

      list(
        ok = TRUE,
        total_inconsistencias = total,
        resumen = if (!is.null(ev$resumen)) .plan_rows_preview(ev$resumen, n = 200) else NULL,
        top_reglas = if (!is.null(top)) .plan_rows_preview(top, n = 20) else NULL
      )
    })) |>
    plumber::pr_post("/api/validacion/auditoria/regla", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      if (is.null(s$evaluacion)) stop_api(409, "E_NO_AUDITORIA", "Run auditoría first with POST /api/validacion/auditoria")
      body <- jsonlite::fromJSON(rawToChar(req$bodyRaw), simplifyVector = TRUE)
      if (is.null(body$id_regla)) stop_api(400, "E_MISSING_ID_REGLA", "Body must include id_regla")
      ids <- body$id_regla
      inst <- tryCatch(.ensure_inst_limpieza(sid), error = function(e) NULL)
      detalle <- prosecnur::auditar_regla(s$evaluacion, ids = ids, inst = inst, verbose = FALSE)
      list(ok = TRUE, detalle = .plan_rows_preview(detalle, n = 200))
    })) |>
    plumber::pr_get("/api/validacion/graficos/secciones", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      inst <- .ensure_inst_limpieza(sid)
      gg <- prosecnur::GraficarSecciones(inst)
      png <- .ggplot_to_png(gg, width = 16, height = 10)
      plumber::include_file(png, res, content_type = "image/png")
    })) |>
    plumber::pr_get("/api/validacion/graficos/preguntas", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      inst <- .ensure_inst_limpieza(sid)
      gg <- prosecnur::GraficarPreguntas(inst)
      png <- .ggplot_to_png(gg, width = 16, height = 10)
      plumber::include_file(png, res, content_type = "image/png")
    }))
}
