# =============================================================================
# Validación v2 — helpers compartidos
# =============================================================================
# Extrae el nombre de base efectivo desde el request. Prioridad:
#   1) Header X-Base-Nombre
#   2) Query param base_nombre
#   3) Body JSON base_nombre
#   4) NULL → resuelve a la primera base del estudio (o legacy).
.get_base_nombre <- function(req) {
  # HTTP_X_BASE_NOMBRE es el nombre del header en Rook (plumber).
  # `req$HEADERS` puede no existir — uso tryCatch para ser defensivo.
  h <- tryCatch(
    req$HTTP_X_BASE_NOMBRE %||% req$HEADERS[["X-Base-Nombre"]],
    error = function(e) NULL
  )
  if (!is.null(h) && nzchar(h)) return(as.character(h))
  q <- tryCatch(
    req$args$base_nombre %||% req$QUERY$base_nombre,
    error = function(e) NULL
  )
  if (!is.null(q) && nzchar(q)) return(as.character(q))
  # Body JSON (aplicable solo a POST/PATCH). tryCatch por si bodyRaw es
  # raw(0) o cualquier estructura inesperada.
  body_raw <- tryCatch({
    if (!is.null(req$bodyRaw) && length(req$bodyRaw) > 0L) rawToChar(req$bodyRaw)
    else req$postBody %||% ""
  }, error = function(e) "")
  if (is.character(body_raw) && nzchar(body_raw)) {
    parsed <- tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
                       error = function(e) NULL)
    if (!is.null(parsed) && !is.null(parsed$base_nombre) &&
        nzchar(parsed$base_nombre)) {
      return(as.character(parsed$base_nombre))
    }
  }
  NULL
}

# Valida y resuelve el scope de validación para una base concreta. Usa
# `.resolve_base_nombre()` de session_store.R. Si pide una base que no
# existe, lanza 404.
.get_base_scope <- function(sid, base_nombre = NULL) {
  # Esta llamada valida existencia + resuelve fallbacks legacy.
  validacion_scope_get(sid, base_nombre)
}

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
  inst <- leer_xlsform_limpieza(meta$path, verbose = FALSE)
  session_set(sid, "inst_limpieza", inst)
  inst
}

.plan_rows_preview <- function(plan, n = 50) {
  df <- utils::head(plan, n)
  rows <- vector("list", nrow(df))
  for (i in seq_len(nrow(df))) {
    row <- as.list(df[i, , drop = FALSE])
    row <- lapply(row, function(v) {
      if (length(v) == 0) NA
      else if (length(v) == 1) unname(v)
      else unname(v)
    })
    rows[[i]] <- row
  }
  rows
}

.ggplot_to_png <- function(gg, width = 14, height = 10, dpi = 120) {
  tmp <- tempfile(fileext = ".png")
  ggplot2::ggsave(tmp, plot = gg, width = width, height = height, dpi = dpi, bg = "white")
  tmp
}

# prosecnur's GraficarSecciones/GraficarPreguntas use grid::unit() without the
# namespace prefix and without declaring grid as an Import. Attach it explicitly.
.with_grid <- function(fn) {
  suppressPackageStartupMessages(requireNamespace("grid"))
  if (!"package:grid" %in% search()) attachNamespace("grid")
  fn()
}

mount_validacion <- function(pr) {
  pr |>
    plumber::pr_post("/api/validacion/plan", wrap_endpoint(function(req, res, incluir = NULL, idioma = "es") {
      sid <- session_header(req)
      .require_xlsform(sid)
      inst <- .ensure_inst_limpieza(sid)

      incluir_final <- if (is.null(incluir)) list(
        required = TRUE, other = TRUE, relevant = TRUE,
        constraint = TRUE, calculate = TRUE, choice_filter = TRUE,
        repeat_min1 = FALSE, tiempo_ventana = FALSE
      ) else as.list(incluir)

      plan <- generar_plan_limpieza(x = inst, incluir = incluir_final)
      resumen <- tryCatch(
        dplyr::arrange(
          dplyr::count(plan, `Tipo de observación`, name = "n_reglas"),
          dplyr::desc(n_reglas)
        ),
        error = function(e) NULL
      )
      plan_result <- list(plan = plan, resumen = resumen,
                          secciones = inst$meta$section_map, meta = inst$meta)
      session_set(sid, "plan_result", plan_result)

      list(
        ok = TRUE,
        n_reglas = nrow(plan),
        resumen = if (!is.null(resumen)) .plan_rows_preview(resumen, n = 50) else list(),
        plan_preview = .plan_rows_preview(plan, n = 50)
      )
    })) |>
    plumber::pr_post("/api/validacion/plan/export", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      if (is.null(s$plan_result)) stop_api(409, "E_NO_PLAN", "Build the plan first with POST /api/validacion/plan")
      inst <- .ensure_inst_limpieza(sid)

      file_id <- uuid::UUIDgenerate()
      out_path <- file.path(s$dir, "downloads", sprintf("plan_limpieza_%s.xlsx", file_id))
      exportar_plan_limpieza(
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
    plumber::pr_post("/api/validacion/plan/import", wrap_endpoint(function(req, res, file_id = NULL) {
      sid <- session_header(req)
      if (is.null(file_id) || !nzchar(file_id)) stop_api(400, "E_MISSING_FILE_ID", "Body must include file_id")
      meta <- get_file(sid, file_id)
      plan_df <- cargar_plan_excel(meta$path)

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

      job_id <- job_submit(
        sid = sid,
        kind = "validacion.auditoria",
        func = function(data_path, data_ext, plan) {
          datos <- switch(data_ext,
            xlsx = readxl::read_excel(data_path),
            xls  = readxl::read_excel(data_path),
            csv  = utils::read.csv(data_path, stringsAsFactors = FALSE),
            sav  = haven::read_sav(data_path),
            stop(sprintf("Unsupported data extension: %s", data_ext))
          )
          ev <- evaluar_consistencia(
            datos = datos,
            plan = plan,
            contar_na_como_inconsistencia = FALSE
          )
          total_raw <- tryCatch(total_inconsistencias(ev), error = function(e) NULL)
          total_scalar <- if (is.numeric(total_raw) && length(total_raw) == 1) {
            as.integer(total_raw)
          } else if (is.list(total_raw) && !is.null(total_raw$cabecera)) {
            ca <- total_raw$cabecera
            as.integer(if (is.data.frame(ca)) ca$Total_inconsistencias[1] else ca[[1]]$Total_inconsistencias)
          } else NA_integer_
          top <- tryCatch({
            r <- ev$resumen
            if (!is.null(r) && "n_inconsistencias" %in% names(r)) {
              r <- r[order(-r$n_inconsistencias), , drop = FALSE]
              utils::head(r, 20)
            } else r
          }, error = function(e) NULL)
          list(ev = ev, total = total_scalar, top = top, resumen = ev$resumen)
        },
        args = list(
          data_path = data_meta$path,
          data_ext = data_meta$ext,
          plan = s$plan_result$plan
        ),
        on_complete = function(j) {
          raw <- j$result_data
          session_set(j$sid, "evaluacion", raw$ev)
          list(
            ok = TRUE,
            total_inconsistencias = raw$total,
            resumen = if (!is.null(raw$resumen)) .plan_rows_preview(raw$resumen, n = 200) else list(),
            top_reglas = if (!is.null(raw$top)) .plan_rows_preview(raw$top, n = 20) else list()
          )
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "validacion.auditoria")
    })) |>
    plumber::pr_post("/api/validacion/auditoria/regla", wrap_endpoint(function(req, res, id_regla = NULL) {
      sid <- session_header(req)
      s <- session_get(sid)
      if (is.null(s$evaluacion)) stop_api(409, "E_NO_AUDITORIA", "Run auditoría first with POST /api/validacion/auditoria")
      if (is.null(id_regla)) stop_api(400, "E_MISSING_ID_REGLA", "Body must include id_regla")
      inst <- tryCatch(.ensure_inst_limpieza(sid), error = function(e) NULL)
      detalle <- auditar_regla(s$evaluacion, ids = id_regla, inst = inst, verbose = FALSE)
      list(ok = TRUE, detalle = .plan_rows_preview(detalle, n = 200))
    })) |>
    plumber::pr_get("/api/validacion/graficos/secciones", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      inst <- .ensure_inst_limpieza(sid)
      gg <- .with_grid(function() GraficarSecciones(inst))
      png <- .ggplot_to_png(gg, width = 16, height = 10)
      plumber::include_file(png, res, content_type = "image/png")
    })) |>
    plumber::pr_get("/api/validacion/graficos/preguntas", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      inst <- .ensure_inst_limpieza(sid)
      gg <- .with_grid(function() GraficarPreguntas(inst))
      png <- .ggplot_to_png(gg, width = 16, height = 10)
      plumber::include_file(png, res, content_type = "image/png")
    })) |>

    # =========================================================================
    # Fase 2 v2 — Stubs (Sprint 1). Contrato: todos scoped por base vía
    # header X-Base-Nombre (o query/body base_nombre). Respuestas mock para
    # que el frontend pueda armarse; el contenido real llega en Sprints 2-5.
    # =========================================================================
    plumber::pr_get("/api/validacion/v2/panorama", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      scope <- .get_base_scope(sid, base)
      list(
        ok = TRUE,
        base_nombre = base %||% NA_character_,
        progreso = list(
          plan_construido = !is.null(scope$plan_result),
          auditoria_corrida = !is.null(scope$evaluacion),
          n_reglas_custom = length(scope$reglas_custom %||% list())
        ),
        kpis = list(),
        top_reglas = NULL,
        top_variables = NULL,
        actions = list()
      )
    })) |>
    plumber::pr_get("/api/validacion/v2/instrumento/estado", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      scope <- .get_base_scope(sid, base)
      list(
        ok = TRUE,
        base_nombre = base %||% NA_character_,
        plan_construido = !is.null(scope$plan_result),
        auditoria_corrida = !is.null(scope$evaluacion),
        n_reglas = if (!is.null(scope$plan_result)) nrow(scope$plan_result) else 0L,
        views = list()
      )
    })) |>
    plumber::pr_get("/api/validacion/v2/explorar/variables", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      # Resolver el scope valida que la base existe si viene especificada.
      .get_base_scope(sid, base)
      list(
        ok = TRUE,
        base_nombre = base %||% NA_character_,
        secciones = list(),  # list(nombre, variables: [{name, label, tipo, n_validos, n_nulos}])
        n_variables = 0L
      )
    })) |>
    plumber::pr_get("/api/validacion/v2/reglas_custom", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      scope <- .get_base_scope(sid, base)
      list(
        ok = TRUE,
        base_nombre = base %||% NA_character_,
        reglas = scope$reglas_custom %||% list()
      )
    }))
}
