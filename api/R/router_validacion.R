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

# Recorta el preview de `_limpieza_simulate` a sólo los campos serializables
# que el frontend necesita. Los campos pesados / no-serializables
# (`data_final`, `evaluacion_final`, `logs`) son utilizados internamente
# por `limpieza_finalize` y los export helpers, pero no van al JSON: jsonlite
# revienta con "C stack usage too close to the limit" porque
# `evaluacion_final$bundle` contiene closures cíclicas.
.limpieza_preview_public <- function(preview) {
  if (is.null(preview)) return(NULL)
  list(
    before = preview$before,
    after = preview$after,
    impact = preview$impact,
    residual_final = preview$residual_final,
    decisions_ready = preview$decisions_ready
  )
}

# -----------------------------------------------------------------------------
# .resolve_explorar_data: devuelve la data para el explorador según fuente.
#   - "raw" (default): data cargada originalmente (comportamiento histórico).
#   - "final": la data tras aplicar todas las decisiones de Limpieza.
#     Requiere que Limpieza ya se haya finalizado (artifacts$finalized_at).
#     Si no, lanza 409 con mensaje claro.
#
# Devuelve list(data = <data.frame>, effective_base = <char>).
# -----------------------------------------------------------------------------
.resolve_explorar_data <- function(sid, base_nombre = NULL, fuente = "raw") {
  fuente <- if (is.null(fuente)) "raw" else as.character(fuente)
  if (!(fuente %in% c("raw", "final"))) {
    stop_api(400, "E_BAD_FUENTE",
             sprintf("fuente debe ser 'raw' o 'final' (recibido: '%s').", fuente))
  }

  data_sources <- estudio_data_sources(sid)
  inst_sources <- estudio_inst_sources(sid)
  effective_base <- if (!is.null(base_nombre) && nzchar(base_nombre)) base_nombre
                     else if (length(data_sources) > 0L) names(data_sources)[1]
                     else NULL
  if (is.null(effective_base) ||
      is.null(data_sources[[effective_base]]) ||
      is.null(inst_sources[[effective_base]])) {
    stop_api(409, "E_NO_DATA_INST",
             "No hay data o instrumento cargado para esta base.")
  }

  inst <- inst_sources[[effective_base]]

  if (identical(fuente, "raw")) {
    return(list(
      data = data_sources[[effective_base]],
      instrumento = inst,
      effective_base = effective_base,
      fuente = "raw"
    ))
  }

  # fuente == "final": requiere Limpieza finalizada.
  scope <- validacion_scope_get(sid, effective_base)
  preview <- scope$limpieza_preview %||% NULL
  artifacts <- scope$limpieza_artifacts %||% NULL
  finalized_at <- artifacts$finalized_at %||% NULL
  if (is.null(preview) || is.null(preview$data_final) ||
      is.null(finalized_at) || !nzchar(as.character(finalized_at))) {
    stop_api(409, "E_NOT_FINALIZED",
             "La base final aún no se ha cerrado. Termina Limpieza primero.")
  }

  list(
    data = preview$data_final,
    instrumento = inst,
    effective_base = effective_base,
    fuente = "final"
  )
}

# Devuelve los paths (xlsform, data) de la base especificada. Para
# multi-base: lee `s$estudio$bases[[base]]$xlsform_file_id` y
# `data_file_id` del file store. Para legacy: busca el último xlsform y
# data de s$files (comportamiento viejo). Lanza 409 si falta alguno.
.resolve_base_files <- function(sid, base_nombre = NULL) {
  s <- session_get(sid)
  # Si la base viene nombrada o el estudio existe con bases, usar scope.
  if (!is.null(base_nombre) && nzchar(base_nombre)) {
    # Valida existencia y resuelve.
    b_resolved <- .resolve_base_nombre(s, base_nombre)
  } else if (!is.null(s$estudio) && length(s$estudio$bases) > 0L) {
    b_resolved <- names(s$estudio$bases)[1]
  } else {
    b_resolved <- NULL
  }
  if (!is.null(b_resolved)) {
    meta_b <- s$estudio$bases[[b_resolved]]
    xls_meta <- get_file(sid, meta_b$xlsform_file_id)
    dat_meta <- get_file(sid, meta_b$data_file_id)
    return(list(
      base_nombre = b_resolved,
      xlsform = xls_meta,
      data = dat_meta,
      data_ext = meta_b$data_ext %||% dat_meta$ext %||% tolower(tools::file_ext(dat_meta$path))
    ))
  }
  # Fallback legacy single-base.
  xls_meta <- .require_xlsform(sid)
  dat_meta <- .require_data_file(sid)
  list(
    base_nombre = NULL,
    xlsform = xls_meta,
    data = dat_meta,
    data_ext = dat_meta$ext %||% tolower(tools::file_ext(dat_meta$path))
  )
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

.limpieza_invalidate_outputs <- function(sid, base_nombre = NULL) {
  validacion_scope_set(sid, base_nombre, "limpieza_preview", NULL)
  validacion_scope_set(sid, base_nombre, "limpieza_artifacts", list())
  invisible(TRUE)
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

    # =========================================================================
    # Fase 2 v2 — Endpoints scoped por base vía header X-Base-Nombre.
    # Fallback a primera base del estudio o modo legacy. Los endpoints
    # v1 (/api/validacion/plan, /auditoria, /graficos/*) fueron removidos
    # tras el cutover completo al v2; cualquier referencia histórica a
    # esas rutas ahora devuelve 404.
    # =========================================================================

    # --- Limpieza (Sprint 5) — KPIs + top reglas + top vars con deep-links --
    plumber::pr_get("/api/validacion/v2/limpieza", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      scope <- .get_base_scope(sid, base)
      limpieza <- build_limpieza(scope, sid = sid, base_nombre = base)
      list(
        ok = TRUE,
        base_nombre = base %||% NA_character_,
        progreso = limpieza$progreso,
        summary = limpieza$summary,
        kpis = limpieza$kpis,
        top_reglas = limpieza$top_reglas,
        top_variables = limpieza$top_variables,
        decision_queue = limpieza$decision_queue,
        decision_draft = limpieza$decision_draft,
        module_stats = limpieza$module_stats,
        before_after_preview = .limpieza_preview_public(limpieza$before_after_preview),
        artifacts = limpieza$artifacts,
        actions = list()
      )
    })) |>

    plumber::pr_get("/api/validacion/v2/limpieza/decisions", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      scope <- .get_base_scope(sid, base)
      list(
        ok = TRUE,
        base_nombre = base %||% NA_character_,
        decisions = scope$limpieza_draft %||% list()
      )
    })) |>

    plumber::pr_post("/api/validacion/v2/limpieza/decision", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      scope <- .get_base_scope(sid, base)
      upsert <- .limpieza_upsert_decision(scope$limpieza_draft %||% list(), parsed)
      validacion_scope_set(sid, base, "limpieza_draft", upsert$decisions)
      .limpieza_invalidate_outputs(sid, base)
      limpieza <- build_limpieza(.get_base_scope(sid, base), sid = sid, base_nombre = base)
      list(
        ok = TRUE,
        decision = upsert$decision,
        decision_draft = limpieza$decision_draft,
        before_after_preview = .limpieza_preview_public(limpieza$before_after_preview),
        summary = limpieza$summary
      )
    })) |>

    plumber::pr_delete("/api/validacion/v2/limpieza/decision/<id>", wrap_endpoint(function(req, res, id = NULL) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      if (is.null(id) || !nzchar(id)) stop_api(400, "E_MISSING_ID", "Falta id de decisión.")
      scope <- .get_base_scope(sid, base)
      kept <- .limpieza_delete_decision(scope$limpieza_draft %||% list(), id)
      validacion_scope_set(sid, base, "limpieza_draft", kept)
      .limpieza_invalidate_outputs(sid, base)
      limpieza <- build_limpieza(.get_base_scope(sid, base), sid = sid, base_nombre = base)
      list(ok = TRUE, id = id, decision_draft = limpieza$decision_draft, summary = limpieza$summary)
    })) |>

    plumber::pr_get("/api/validacion/v2/limpieza/preview", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      scope <- .get_base_scope(sid, base)
      preview <- .limpieza_simulate(sid, base, scope, scope$limpieza_draft %||% list())
      validacion_scope_set(sid, base, "limpieza_preview", preview)
      list(ok = TRUE, base_nombre = base %||% NA_character_, before_after_preview = .limpieza_preview_public(preview))
    })) |>

    plumber::pr_post("/api/validacion/v2/limpieza/finalize", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      scope <- .get_base_scope(sid, base)
      limpieza_finalize(sid = sid, base_nombre = base, scope = scope)
    })) |>

    # --- Reporte HTML autocontenido (Sprint 5 — stretch) --------------------
    # Exporta un HTML standalone (CSS inline, sin recursos externos) con el
    # estado de validación: progreso, KPIs, top reglas violadas, reglas
    # custom. Queda guardado en el file store para descarga vía
    # /api/files/<file_id>/download?sid=... — igual patrón que el resto de
    # exports del API.
    plumber::pr_post("/api/validacion/v2/report/html", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      scope <- .get_base_scope(sid, base)
      s <- session_get(sid)

      estudio_nombre <- if (!is.null(s$estudio)) as.character(s$estudio$nombre %||% NA) else NA_character_
      limpieza_payload <- build_limpieza(scope, sid = sid, base_nombre = base)
      html <- build_report_html(
        scope = scope,
        base_nombre = base,
        estudio_nombre = estudio_nombre,
        generated_at = Sys.time(),
        limpieza_payload = limpieza_payload
      )

      file_id <- uuid::UUIDgenerate()
      downloads_dir <- file.path(s$dir, "downloads")
      dir.create(downloads_dir, showWarnings = FALSE, recursive = TRUE)
      out_path <- file.path(downloads_dir,
                             sprintf("reporte_validacion_%s.html", file_id))
      writeLines(html, out_path, useBytes = TRUE)
      size <- file.info(out_path)$size

      # Registrar en file store con nombre limpio (sin UUID) para que la
      # descarga salga como "reporte_validacion.html" y no el path interno.
      meta <- list(
        file_id = file_id,
        kind = "validacion_report_html",
        original_name = "reporte_validacion.html",
        path = out_path,
        size = as.integer(size),
        ext = "html",
        uploaded_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
      )
      files <- s$files
      files[[file_id]] <- meta
      session_set(sid, "files", files)

      list(ok = TRUE, file_id = file_id, size = meta$size,
           original_name = meta$original_name)
    })) |>

    # --- Instrumento: estado general (HEAD-like) -----------------------------
    plumber::pr_get("/api/validacion/v2/instrumento/estado", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      scope <- .get_base_scope(sid, base)
      n_reglas <- if (!is.null(scope$plan_result) && !is.null(scope$plan_result$bundle) &&
                      length(scope$plan_result$bundle$rules %||% list())) {
        length(scope$plan_result$bundle$rules)
      } else if (!is.null(scope$plan_result) && !is.null(scope$plan_result$plan)) {
        nrow(scope$plan_result$plan)
      } else 0L
      list(
        ok = TRUE,
        base_nombre = base %||% NA_character_,
        plan_construido = !is.null(scope$plan_result),
        auditoria_corrida = !is.null(scope$evaluacion),
        n_reglas = as.integer(n_reglas)
      )
    })) |>

    # --- Instrumento: construir plan desde XLSForm (scoped por base) ---------
    plumber::pr_post("/api/validacion/v2/instrumento/plan", wrap_endpoint(function(req, res, incluir = NULL) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      # Resolver archivos de la base (multi-base) o legacy.
      files <- .resolve_base_files(sid, base)
      # El inst_limpieza scoped por base: leemos on-demand y lo cacheamos
      # en el scope (Sprint 3 podría querer un helper global, pero por
      # ahora se lee en cada construcción y no pasa nada porque el XLSForm
      # no cambia entre builds).
      inst <- leer_xlsform_limpieza(files$xlsform$path, verbose = FALSE)

      incluir_final <- if (is.null(incluir)) list(
        required = TRUE, other = TRUE, relevant = TRUE,
        constraint = TRUE, calculate = TRUE, choice_filter = TRUE,
        repeat_min1 = FALSE, tiempo_ventana = FALSE
      ) else as.list(incluir)

      compat <- validation_profile_for_base(files$base_nombre %||% base)
      bundle <- build_validation_bundle(
        instrumento = inst,
        reglas_custom = list(),
        incluir = incluir_final,
        compatibility = compat
      )
      plan <- bundle$plan %||% compile_rules_to_plan(bundle$rules)
      resumen <- tryCatch(
        dplyr::arrange(
          dplyr::count(plan, `Tipo`, name = "n_reglas"),
          dplyr::desc(n_reglas)
        ),
        error = function(e) NULL
      )
      plan_result <- list(plan = plan, bundle = bundle, resumen = resumen,
                          secciones = inst$meta$section_map, meta = inst$meta)
      validacion_scope_set(sid, base, "plan_result", plan_result)
      # Al reconstruir el plan, la evaluación vieja ya no aplica.
      validacion_scope_set(sid, base, "evaluacion", NULL)
      .limpieza_invalidate_outputs(sid, base)

      list(
        ok = TRUE,
        base_nombre = files$base_nombre %||% NA_character_,
        n_reglas = as.integer(nrow(plan)),
        resumen = if (!is.null(resumen)) .plan_rows_preview(resumen, n = 50) else list(),
        plan_preview = .plan_rows_preview(plan, n = 50)
      )
    })) |>

    # --- Instrumento: exportar plan a Excel (scoped) -------------------------
    plumber::pr_post("/api/validacion/v2/instrumento/plan/export", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      scope <- .get_base_scope(sid, base)
      if (is.null(scope$plan_result)) {
        stop_api(409, "E_NO_PLAN",
                 "Primero construye el plan con POST /api/validacion/v2/instrumento/plan.")
      }
      files <- .resolve_base_files(sid, base)
      inst <- leer_xlsform_limpieza(files$xlsform$path, verbose = FALSE)

      s <- session_get(sid)
      file_id <- uuid::UUIDgenerate()
      out_path <- file.path(s$dir, "downloads",
                             sprintf("plan_limpieza_%s.xlsx", file_id))
      exportar_plan_limpieza(
        plan = scope$plan_result$plan,
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
      files_map <- s$files
      files_map[[file_id]] <- meta
      session_set(sid, "files", files_map)
      list(ok = TRUE, file_id = file_id, size = meta$size)
    })) |>

    # --- Instrumento: importar plan editado en Excel (scoped) ----------------
    plumber::pr_post("/api/validacion/v2/instrumento/plan/import", wrap_endpoint(function(req, res, file_id = NULL) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      if (is.null(file_id) || !nzchar(file_id)) {
        stop_api(400, "E_MISSING_FILE_ID", "Body must include file_id")
      }
      meta <- get_file(sid, file_id)
      prev <- .get_base_scope(sid, base)$plan_result
      compat <- validation_profile_for_base(base)
      imported <- validation_bundle_from_plan_xlsx(
        path = meta$path,
        existing_bundle = prev$bundle %||% NULL,
        compatibility = compat
      )
      plan_df <- imported$plan %||% cargar_plan_excel(meta$path)

      new_result <- if (is.null(prev)) {
        list(plan = plan_df, bundle = imported, resumen = NULL, secciones = NULL, meta = NULL)
      } else {
        prev$plan <- plan_df
        prev$bundle <- imported
        prev
      }
      validacion_scope_set(sid, base, "plan_result", new_result)
      validacion_scope_set(sid, base, "evaluacion", NULL)
      .limpieza_invalidate_outputs(sid, base)
      list(
        ok = TRUE,
        n_reglas = as.integer(nrow(plan_df)),
        plan_preview = .plan_rows_preview(plan_df, n = 50)
      )
    })) |>

    # --- Instrumento: auditoría async (scoped) -------------------------------
    plumber::pr_post("/api/validacion/v2/instrumento/auditoria", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      scope <- .get_base_scope(sid, base)
      if (is.null(scope$plan_result)) {
        stop_api(409, "E_NO_PLAN",
                 "Primero construye o importa el plan.")
      }
      files <- .resolve_base_files(sid, base)

      # Capturamos base nombre efectivo para el callback (puede ser NULL
      # en legacy).
      base_effective <- files$base_nombre

      compat <- validation_profile_for_base(base_effective %||% base)
      bundle_efectivo <- scope$plan_result$bundle %||%
        validation_bundle_from_plan_df(scope$plan_result$plan,
                                       existing_bundle = scope$plan_result$bundle %||% NULL,
                                       compatibility = compat)

      # Filtrar reglas desactivadas (toggle "ignorar") antes de correr.
      desactivadas <- scope$reglas_desactivadas %||% character(0)
      if (length(desactivadas) && length(bundle_efectivo$rules %||% list())) {
        bundle_efectivo$rules <- Filter(function(r) !(r$id %in% desactivadas), bundle_efectivo$rules)
        bundle_efectivo$plan <- compile_rules_to_plan(bundle_efectivo$rules)
      }

      # api_path para que el subprocess callr pueda cargar el paquete.
      api_path <- .app_api_dir()

      job_id <- job_submit(
        sid = sid,
        kind = "validacion.v2.auditoria",
        func = function(data_path, data_ext, xlsform_path, bundle, base_name, api_path) {
          # Locale UTF-8 para que `pkgload::load_all()` pueda parsear
          # archivos .R con caracteres acentuados (el subprocess callr
          # no hereda las opciones locale del main process).
          tryCatch(
            Sys.setlocale("LC_ALL", "en_US.UTF-8"),
            warning = function(w) NULL, error = function(e) NULL
          )
          options(encoding = "UTF-8")
          # El subprocess callr::r_bg arranca limpio — cargamos el
          # paquete para tener disponibles `evaluar_consistencia` y
          # compañía. Mismo patrón que router_analitica.R / router_graficos.R.
          if (requireNamespace("pkgload", quietly = TRUE)) {
            pkgload::load_all(api_path, quiet = TRUE)
          } else if (requireNamespace("devtools", quietly = TRUE)) {
            devtools::load_all(api_path, quiet = TRUE)
          }
          inst <- leer_xlsform_limpieza(xlsform_path, verbose = FALSE)
          datos <- read_validation_data_ast(
            path = data_path,
            ext = data_ext,
            instrumento = inst
          )
          ev <- evaluate_validation_bundle(
            bundle = bundle,
            data_input = datos,
            compatibility = validation_profile_for_base(base_name),
            strict = FALSE
          )
          total_raw <- tryCatch(total_inconsistencias(ev), error = function(e) NULL)
          total_scalar <- if (is.numeric(total_raw) && length(total_raw) == 1) {
            as.integer(total_raw)
          } else if (is.list(total_raw) && !is.null(total_raw$cabecera)) {
            ca <- total_raw$cabecera
            as.integer(if (is.data.frame(ca)) ca$Total_inconsistencias[1] else ca[[1]]$Total_inconsistencias)
          } else NA_integer_
          list(ev = ev, total = total_scalar)
        },
        args = list(
          data_path = files$data$path,
          data_ext = files$data_ext,
          xlsform_path = files$xlsform$path,
          bundle = bundle_efectivo,
          base_name = base_effective %||% base,
          api_path = api_path
        ),
        on_complete = function(j) {
          raw <- j$result_data
          validacion_scope_set(j$sid, base_effective, "evaluacion", raw$ev)
          .limpieza_invalidate_outputs(j$sid, base_effective)
          list(
            ok = TRUE,
            total_inconsistencias = raw$total %||% NA_integer_
          )
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "validacion.v2.auditoria")
    })) |>

    # --- Instrumento: resultado consolidado (view descriptors) ---------------
    plumber::pr_get("/api/validacion/v2/instrumento/resultado", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      scope <- .get_base_scope(sid, base)
      if (is.null(scope$evaluacion)) {
        stop_api(409, "E_NO_AUDITORIA",
                 "Primero corre la auditoría con POST /api/validacion/v2/instrumento/auditoria")
      }
      ev <- scope$evaluacion
      resumen <- ev$resumen
      total_raw <- tryCatch(total_inconsistencias(ev), error = function(e) NULL)
      total <- if (is.numeric(total_raw) && length(total_raw) == 1) {
        as.integer(total_raw)
      } else if (is.list(total_raw) && !is.null(total_raw$cabecera)) {
        ca <- total_raw$cabecera
        as.integer(if (is.data.frame(ca)) ca$Total_inconsistencias[1] else ca[[1]]$Total_inconsistencias)
      } else NA_integer_

      # KPIs: total, reglas con casos, reglas sin casos.
      n_reglas_con_casos <- if (!is.null(resumen)) {
        sum(resumen$n_inconsistencias > 0L, na.rm = TRUE)
      } else 0L
      n_reglas_total <- if (!is.null(resumen)) nrow(resumen) else 0L
      sev_total <- if (is.na(total) || total == 0L) "success" else
                   if (total < 10L) "warn" else "danger"

      kpis <- list(
        vd_kpi_card(
          title = "Total de inconsistencias",
          value = if (is.na(total)) "—" else as.integer(total),
          subtitle = "Casos detectados por las reglas activas",
          severidad = sev_total,
          icon = "alert-triangle"
        ),
        vd_kpi_card(
          title = "Reglas con casos",
          value = as.integer(n_reglas_con_casos),
          subtitle = sprintf("de %d reglas evaluadas", n_reglas_total),
          severidad = if (n_reglas_con_casos == 0L) "success" else "neutral",
          icon = "list-checks"
        ),
        vd_kpi_card(
          title = "Reglas sin casos",
          value = as.integer(n_reglas_total - n_reglas_con_casos),
          subtitle = "Reglas que pasaron sin inconsistencias",
          severidad = "success",
          icon = "check-circle"
        )
      )

      # Top reglas violadas + heatmap sección × tipo.
      top_reglas <- .vd_top_reglas(resumen, n = 8L)
      heatmap   <- .vd_heatmap_seccion_tipo(resumen)

      # Resumen tabla: versión ligera para el drill (solo las reglas con
      # casos o ejecución fallida; el usuario puede clickear para el
      # detalle). Limitamos a 500 filas para no inundar el payload.
      resumen_tabla <- if (!is.null(resumen) && nrow(resumen)) {
        mask <- (resumen$n_inconsistencias > 0L) |
                (!is.na(resumen$estado_dinamico) &
                   resumen$estado_dinamico != "correcta")
        mask[is.na(mask)] <- FALSE
        r_sub <- resumen[mask, , drop = FALSE]
        r_sub <- r_sub[order(-r_sub$n_inconsistencias), , drop = FALSE]
        .plan_rows_preview(utils::head(r_sub, 500L), n = 500L)
      } else list()

      list(
        ok = TRUE,
        base_nombre = base %||% NA_character_,
        kpis = kpis,
        top_reglas = top_reglas,
        heatmap = heatmap,
        resumen_tabla = resumen_tabla
      )
    })) |>

    # --- Instrumento: drill por regla (vista enriquecida) --------------------
    # Retorna objeto rico: metadata humana de la regla + lista de casos con
    # UUID detectado. Payload:
    #   { ok, regla: {id, nombre, nombre_tecnico, objetivo, tipo_observacion,
    #                 seccion, categoria, variables:[], variable_roles,
    #                 procesamiento, activa, n_inconsistencias, porcentaje},
    #     casos: [{uuid, ...campos}], uuid_col: string }
    plumber::pr_post("/api/validacion/v2/instrumento/regla", wrap_endpoint(function(req, res, id_regla = NULL, ...) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      scope <- .get_base_scope(sid, base)
      if (is.null(scope$evaluacion)) {
        stop_api(409, "E_NO_AUDITORIA", "Corre la auditoría primero.")
      }
      if (is.null(id_regla) || !nzchar(id_regla)) {
        stop_api(400, "E_MISSING_ID_REGLA", "Body debe incluir id_regla")
      }
      files <- .resolve_base_files(sid, base)
      inst <- tryCatch(leer_xlsform_limpieza(files$xlsform$path, verbose = FALSE),
                       error = function(e) NULL)
      # auditar_regla devuelve list(resumen, expresion, objetivo, casos).
      aud <- auditar_regla(scope$evaluacion, ids = id_regla,
                           inst = inst, verbose = FALSE)

      # Metadata humana de la regla — priorizar `plan_result$plan` que
      # trae columnas en español; fallback a `ev$reglas_meta`.
      plan_df <- scope$plan_result$plan %||% NULL
      reglas_meta <- scope$evaluacion$reglas_meta %||% NULL

      .col <- function(df, candidates, default = NA_character_) {
        if (is.null(df)) return(default)
        hit <- intersect(candidates, names(df))
        if (!length(hit)) return(default)
        val <- as.character(df[[hit[1]]])
        if (length(val) == 0L) default else val[1]
      }

      .col_list <- function(df, col) {
        if (is.null(df) || !(col %in% names(df))) return(NULL)
        df[[col]][[1]] %||% NULL
      }

      row_idx_plan <- if (!is.null(plan_df)) {
        which(as.character(plan_df$`ID` %||% plan_df$id_regla) == id_regla)[1]
      } else integer(0)
      row_plan <- if (length(row_idx_plan) && !is.na(row_idx_plan)) {
        plan_df[row_idx_plan, , drop = FALSE]
      } else NULL

      row_idx_meta <- if (!is.null(reglas_meta)) {
        which(as.character(reglas_meta$id_regla) == id_regla)[1]
      } else integer(0)
      row_meta <- if (length(row_idx_meta) && !is.na(row_idx_meta)) {
        reglas_meta[row_idx_meta, , drop = FALSE]
      } else NULL

      nombre_regla <- .col(row_plan, c("Nombre de regla", "Nombre de la regla", "nombre_regla")) |>
        (\(x) if (is.na(x)) .col(row_meta, "nombre_regla") else x)()
      nombre_tecnico <- .col(row_plan, c("Nombre técnico", "_nombre_tecnico", "nombre_tecnico")) |>
        (\(x) if (is.na(x)) .col(row_meta, "nombre_tecnico") else x)()
      objetivo <- if (length(aud$objetivo) && !is.na(aud$objetivo[1])) aud$objetivo[1]
                   else .col(row_plan, c("Objetivo", "objetivo")) |>
                        (\(x) if (is.na(x)) .col(row_meta, "objetivo") else x)()
      procesamiento <- if (length(aud$expresion) && !is.na(aud$expresion[1])) aud$expresion[1]
                        else .col(row_plan, c("Procesamiento", "Procesamiento (R)", "procesamiento"))
      tipo_obs <- .col(row_plan, c("Tipo de observación", "tipo_observacion")) |>
        (\(x) if (is.na(x)) .col(row_meta, "tipo_observacion") else x)()
      seccion <- .col(row_plan, c("Sección", "seccion")) |>
        (\(x) if (is.na(x)) .col(row_meta, "seccion") else x)()
      categoria <- .col(row_plan, c("Categoría", "categoria")) |>
        (\(x) if (is.na(x)) .col(row_meta, "categoria") else x)()
      tabla <- .col(row_plan, c("Tabla", "tabla", "Hoja base", "hoja_base")) |>
        (\(x) if (is.na(x)) .col(row_meta, "tabla") else x)()

      # Variables involucradas: extraer de plan_result (Variable 1/2/3) o meta.
      vars <- c(
        .col(row_plan, c("Variable 1", "variable_1")),
        .col(row_plan, c("Variable 2", "variable_2")),
        .col(row_plan, c("Variable 3", "variable_3"))
      )
      if (all(is.na(vars)) && !is.null(row_meta)) {
        # Usar `.col` (que verifica existencia de columna sin warning) en
        # vez de `row_meta$variable_N` directo, porque row_meta puede
        # venir de un resumen que no tenga esas columnas todavía.
        vars <- c(
          as.character(.col(row_meta, "variable_1") %||% NA),
          as.character(.col(row_meta, "variable_2") %||% NA),
          as.character(.col(row_meta, "variable_3") %||% NA)
        )
      }
      vars <- vars[!is.na(vars) & nzchar(vars)]
      variable_roles <- .col_list(row_meta, "variable_roles")
      if (is.null(variable_roles) && !is.null(row_plan) && "_variable_roles_json" %in% names(row_plan)) {
        raw_roles <- as.character(row_plan[["_variable_roles_json"]] %||% "")
        if (nzchar(raw_roles)) {
          variable_roles <- tryCatch(
            jsonlite::fromJSON(raw_roles, simplifyVector = FALSE),
            error = function(e) NULL
          )
        }
      }
      if (is.null(variable_roles)) {
        variable_roles <- list(
          target = vars[1] %||% NA_character_,
          drivers = as.list(vars[-1] %||% character(0)),
          compare = list(),
          gate = list(),
          all = as.list(vars)
        )
      }
      presentation <- .col_list(row_meta, "presentation")
      if (is.null(presentation) && !is.null(row_plan) && "_presentation_json" %in% names(row_plan)) {
        raw_presentation <- as.character(row_plan[["_presentation_json"]] %||% "")
        if (nzchar(raw_presentation)) {
          presentation <- tryCatch(
            jsonlite::fromJSON(raw_presentation, simplifyVector = FALSE),
            error = function(e) NULL
          )
        }
      }
      if (is.null(presentation)) {
        presentation <- list()
      }

      # ¿Está la regla en la lista de desactivadas?
      desactivadas <- scope$reglas_desactivadas %||% character(0)
      activa <- !(id_regla %in% desactivadas)

      # Resumen numérico desde aud$resumen.
      n_inc <- if (!is.null(aud$resumen) && nrow(aud$resumen)) {
        as.integer(aud$resumen$n_inconsistencias[1])
      } else NA_integer_
      pct <- if (!is.null(aud$resumen) && nrow(aud$resumen)) {
        as.numeric(aud$resumen$porcentaje[1])
      } else NA_real_

      # Extraer casos del primer elemento de aud$casos.
      casos_df <- if (length(aud$casos) > 0L) aud$casos[[1]] else NULL
      case_ids <- character(0)
      # Detectar columna UUID: buscar nombres típicos.
      uuid_col <- NULL
      if (!is.null(casos_df) && nrow(casos_df)) {
        candidatos_uuid <- c("_uuid", "uuid", "_id", "_submission_id",
                              "_submission_uuid", "id_caso", "fila_id")
        for (cname in candidatos_uuid) {
          if (cname %in% names(casos_df)) { uuid_col <- cname; break }
        }
        if (!is.null(uuid_col)) {
          case_ids <- as.character(casos_df[[uuid_col]])
        } else {
          case_map <- .limpieza_rule_case_map(scope$evaluacion, id_regla)
          case_ids <- case_map$case_ids %||% character(0)
          if (length(case_ids) == nrow(casos_df)) {
            uuid_col <- "_pulso_case_id"
          } else {
            case_ids <- sprintf("%s::row::%d", tabla %||% "principal", seq_len(nrow(casos_df)))
            uuid_col <- "_pulso_case_id"
          }
        }
      }

      list(
        ok = TRUE,
        regla = list(
          id = id_regla,
          nombre = if (is.na(nombre_regla)) id_regla else nombre_regla,
          nombre_tecnico = if (is.na(nombre_tecnico)) NA_character_ else nombre_tecnico,
          objetivo = if (is.na(objetivo)) NA_character_ else objetivo,
          tipo_observacion = if (is.na(tipo_obs)) NA_character_ else tipo_obs,
          seccion = if (is.na(seccion)) NA_character_ else seccion,
          categoria = if (is.na(categoria)) NA_character_ else categoria,
          tabla = if (is.na(tabla)) NA_character_ else tabla,
          variables = as.list(vars),
          variable_roles = variable_roles,
          presentation = presentation,
          procesamiento = if (is.null(procesamiento) || is.na(procesamiento)) NA_character_ else procesamiento,
          activa = activa,
          n_inconsistencias = n_inc,
          porcentaje = pct
        ),
        uuid_col = uuid_col %||% NA_character_,
        case_ids = as.list(case_ids),
        casos = if (!is.null(casos_df)) {
          .plan_rows_preview(utils::head(casos_df, 500L), n = 500L)
        } else list()
      )
    })) |>

    # --- Instrumento: toggle activar/desactivar una regla --------------------
    # Body: { activa: true|false }. Persiste en scope$reglas_desactivadas.
    # Invalida la evaluación porque las reglas efectivas cambiaron.
    plumber::pr_handle("PATCH", "/api/validacion/v2/instrumento/regla/<id_regla>/activa",
      wrap_endpoint(function(req, res, id_regla = NULL, ...) {
        sid <- session_header(req)
        base <- .get_base_nombre(req)
        if (is.null(id_regla) || !nzchar(id_regla)) {
          stop_api(400, "E_MISSING_ID_REGLA", "Path debe incluir id_regla.")
        }
        body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
        Encoding(body_raw) <- "UTF-8"
        parsed <- tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
                            error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e)))
        activa <- isTRUE(parsed$activa)

        scope <- .get_base_scope(sid, base)
        des <- scope$reglas_desactivadas %||% character(0)
        if (activa) {
          des <- setdiff(des, id_regla)
        } else {
          des <- unique(c(des, id_regla))
        }
        validacion_scope_set(sid, base, "reglas_desactivadas", des)
        # Invalidar evaluación — hay que re-correr con las reglas efectivas.
        validacion_scope_set(sid, base, "evaluacion", NULL)
        .limpieza_invalidate_outputs(sid, base)

        list(ok = TRUE, id_regla = id_regla, activa = activa,
             n_desactivadas = length(des))
    })) |>

    # --- Instrumento: editar atributos humanos de una regla ------------------
    # Body: subconjunto de {nombre, objetivo, tipo_observacion, categoria,
    # mensaje}. Actualiza plan_result$plan in-place (respetando nombres de
    # columna que use el plan). Invalida la evaluación.
    plumber::pr_handle("PATCH", "/api/validacion/v2/instrumento/regla/<id_regla>/atributos",
      wrap_endpoint(function(req, res, id_regla = NULL, ...) {
        sid <- session_header(req)
        base <- .get_base_nombre(req)
        if (is.null(id_regla) || !nzchar(id_regla)) {
          stop_api(400, "E_MISSING_ID_REGLA", "Path debe incluir id_regla.")
        }
        body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
        Encoding(body_raw) <- "UTF-8"
        parsed <- tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
                            error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e)))

        scope <- .get_base_scope(sid, base)
        plan_df <- scope$plan_result$plan
        if (is.null(plan_df)) stop_api(409, "E_NO_PLAN", "Plan no existe en esta base.")
        # Identificar fila por id_regla.
        id_col <- if ("ID" %in% names(plan_df)) "ID" else
                   if ("id_regla" %in% names(plan_df)) "id_regla" else NULL
        if (is.null(id_col)) {
          stop_api(500, "E_PLAN_NO_ID", "Plan no tiene columna de ID.")
        }
        row_idx <- which(as.character(plan_df[[id_col]]) == id_regla)
        if (!length(row_idx)) {
          stop_api(404, "E_REGLA_NOT_FOUND",
                   sprintf("Regla '%s' no existe en el plan.", id_regla))
        }

        # Mapa atributo canónico → columnas candidatas del plan.
        mapa <- list(
          nombre = c("_nombre_humano", "Nombre de la regla", "Nombre de regla", "nombre_regla"),
          objetivo = c("Objetivo", "objetivo"),
          tipo_observacion = c("Tipo de observación", "tipo_observacion", "_tipo_regla"),
          categoria = c("Categoría", "categoria", "_categoria_ux"),
          mensaje = c("Mensaje", "mensaje")
        )

        for (campo in names(mapa)) {
          if (!is.null(parsed[[campo]])) {
            nuevo <- as.character(parsed[[campo]])
            col <- intersect(mapa[[campo]], names(plan_df))
            if (length(col)) {
              plan_df[row_idx, col[1]] <- nuevo
            }
          }
        }

        new_plan_result <- scope$plan_result
        new_plan_result$plan <- plan_df
        new_plan_result$bundle <- validation_bundle_from_plan_df(
          plan_df = plan_df,
          existing_bundle = scope$plan_result$bundle %||% NULL,
          compatibility = validation_profile_for_base(base)
        )
        validacion_scope_set(sid, base, "plan_result", new_plan_result)
        validacion_scope_set(sid, base, "evaluacion", NULL)
        .limpieza_invalidate_outputs(sid, base)

        list(ok = TRUE, id_regla = id_regla,
              fila = .plan_rows_preview(plan_df[row_idx, , drop = FALSE], n = 1L))
    })) |>

    # --- Explorar: inventario de variables agrupadas por sección ------------
    plumber::pr_get("/api/validacion/v2/explorar/variables", wrap_endpoint(function(req, res, fuente = "raw") {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      .get_base_scope(sid, base)  # valida existencia

      resolved <- .resolve_explorar_data(sid, base, fuente)
      inv <- .explorar_inventario(
        data = resolved$data,
        instrumento = resolved$instrumento
      )
      list(
        ok = TRUE,
        base_nombre = resolved$effective_base %||% NA_character_,
        fuente = resolved$fuente,
        n_variables = as.integer(inv$n_variables),
        secciones = inv$secciones
      )
    })) |>

    # --- Explorar: univariado ------------------------------------------------
    plumber::pr_post("/api/validacion/v2/explorar/univariado", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      var <- as.character(parsed$var %||% "")
      if (!nzchar(var)) stop_api(400, "E_MISSING_VAR", "Body debe incluir 'var'.")
      filtros <- parsed$filtros %||% NULL
      fuente <- parsed$fuente %||% "raw"

      resolved <- .resolve_explorar_data(sid, base, fuente)
      view <- build_view_univariado(
        data = resolved$data,
        var = var,
        instrumento = resolved$instrumento,
        filtros = filtros
      )
      view$base_nombre <- resolved$effective_base
      view$fuente <- resolved$fuente
      view
    })) |>

    # --- Explorar: bivariado -------------------------------------------------
    plumber::pr_post("/api/validacion/v2/explorar/bivariado", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      var_x <- as.character(parsed$var_x %||% "")
      var_y <- as.character(parsed$var_y %||% "")
      filtros <- parsed$filtros %||% NULL
      fuente <- parsed$fuente %||% "raw"
      if (!nzchar(var_x) || !nzchar(var_y)) {
        stop_api(400, "E_MISSING_VARS", "Body debe incluir 'var_x' y 'var_y'.")
      }
      resolved <- .resolve_explorar_data(sid, base, fuente)
      view <- build_view_bivariado(
        data = resolved$data,
        var_x = var_x, var_y = var_y,
        instrumento = resolved$instrumento,
        filtros = filtros
      )
      list(ok = TRUE, base_nombre = resolved$effective_base,
            fuente = resolved$fuente, view = view)
    })) |>

    # --- Explorar: valores distintos de una variable (para filtro UI) -------
    # GET con ?var=<name>. Retorna las opciones disponibles con label +
    # frecuencia. Usa el tipo detectado para resolver SM (retorna dummies).
    plumber::pr_get("/api/validacion/v2/explorar/valores", wrap_endpoint(function(req, res, var = NULL, fuente = "raw") {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      if (is.null(var) || !nzchar(var)) {
        stop_api(400, "E_MISSING_VAR", "Falta ?var=<nombre>")
      }
      resolved <- .resolve_explorar_data(sid, base, fuente)
      df <- resolved$data
      inst <- resolved$instrumento
      tipo <- .explorar_tipo_var(var, survey = inst$survey %||% NULL, df = df)
      # Para num / fecha: devolvemos rango + cuantiles para que el UI
      # pueda armar un slider/inputs con defaults sensatos.
      if (tipo == "num" && var %in% names(df)) {
        x <- suppressWarnings(as.numeric(df[[var]]))
        x <- x[is.finite(x)]
        if (!length(x)) {
          return(list(ok = TRUE, var = var, tipo = "num",
                       opciones = list(), rango = NULL))
        }
        qs <- stats::quantile(x, c(0, 0.01, 0.25, 0.5, 0.75, 0.99, 1),
                                na.rm = TRUE)
        return(list(
          ok = TRUE, var = var, tipo = "num", opciones = list(),
          rango = list(
            min = unname(qs[1]), max = unname(qs[7]),
            p1  = unname(qs[2]), p99 = unname(qs[6]),
            q1  = unname(qs[3]), q3  = unname(qs[5]),
            mediana = unname(qs[4]),
            n_validos = length(x)
          )
        ))
      }
      if (tipo == "fecha" && var %in% names(df)) {
        dates <- suppressWarnings(as.Date(df[[var]]))
        dates <- dates[!is.na(dates)]
        if (!length(dates)) {
          return(list(ok = TRUE, var = var, tipo = "fecha",
                       opciones = list(), rango = NULL))
        }
        return(list(
          ok = TRUE, var = var, tipo = "fecha", opciones = list(),
          rango = list(
            min = as.character(min(dates)),
            max = as.character(max(dates)),
            n_validos = length(dates)
          )
        ))
      }
      tab <- if (tipo == "sm") {
        .explorar_tab_frec_sm(df, var, inst)
      } else {
        .explorar_tab_frec_so(df, var, inst)
      }
      opciones <- if (!is.null(tab) && nrow(tab)) {
        lapply(seq_len(nrow(tab)), function(i) {
          list(
            code = as.character(tab$code[i]),
            label = as.character(tab$label[i]),
            n = as.integer(tab$n[i])
          )
        })
      } else list()
      list(ok = TRUE, var = var, tipo = tipo, opciones = opciones,
            rango = NULL)
    })) |>

    # --- Reglas custom: listar -----------------------------------------------
    plumber::pr_get("/api/validacion/v2/reglas_custom", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      scope <- .get_base_scope(sid, base)
      list(
        ok = TRUE,
        base_nombre = base %||% NA_character_,
        reglas = scope$reglas_custom %||% list()
      )
    })) |>

    # --- Reglas custom: crear ------------------------------------------------
    plumber::pr_post("/api/validacion/v2/reglas_custom", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      # Validar schema (lanza stop_api si falla).
      .validar_regla_custom(parsed)
      # Asignar ID auto si no viene.
      scope <- .get_base_scope(sid, base)
      existing <- scope$reglas_custom %||% list()
      new_id <- if (nzchar(parsed$id %||% "")) as.character(parsed$id)
                 else {
                   i <- 1L
                   repeat {
                     cand <- sprintf("RC_%03d", i)
                     if (!any(vapply(existing, function(r) identical(as.character(r$id), cand), logical(1)))) break
                     i <- i + 1L
                   }
                   cand
                 }
      nueva <- list(
        id = new_id,
        created_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
        activa = isTRUE(parsed$activa %||% TRUE),
        nombre = as.character(parsed$nombre %||% new_id),
        tipo = as.character(parsed$tipo),
        variables = as.list(unlist(parsed$variables)),
        params = parsed$params %||% list(),
        mensaje = as.character(parsed$mensaje %||% parsed$nombre %||% new_id),
        severidad = .regla_severidad(parsed)
      )
      existing[[length(existing) + 1L]] <- nueva
      validacion_scope_set(sid, base, "reglas_custom", existing)
      # No invalidamos evaluación hasta que se "ejecute".
      .limpieza_invalidate_outputs(sid, base)
      list(ok = TRUE, regla = nueva)
    })) |>

    # --- Reglas custom: editar -----------------------------------------------
    plumber::pr_handle("PUT", "/api/validacion/v2/reglas_custom/<id>",
      wrap_endpoint(function(req, res, id = NULL, ...) {
        sid <- session_header(req)
        base <- .get_base_nombre(req)
        if (is.null(id) || !nzchar(id)) stop_api(400, "E_MISSING_ID", "Falta id")
        body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
        Encoding(body_raw) <- "UTF-8"
        parsed <- tryCatch(
          jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
          error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
        )
        # Si viene tipo/variables/params, validar antes.
        if (!is.null(parsed$tipo)) .validar_regla_custom(parsed)
        scope <- .get_base_scope(sid, base)
        existing <- scope$reglas_custom %||% list()
        idx <- which(vapply(existing, function(r) identical(as.character(r$id), id), logical(1)))
        if (!length(idx)) stop_api(404, "E_REGLA_NOT_FOUND",
                                    sprintf("Regla '%s' no existe.", id))
        r <- existing[[idx]]
        # Merge: campos del body pisan los existentes.
        for (campo in c("activa", "nombre", "tipo", "variables", "params",
                         "mensaje", "severidad")) {
          if (!is.null(parsed[[campo]])) {
            r[[campo]] <- if (campo == "variables") as.list(unlist(parsed[[campo]]))
                          else parsed[[campo]]
          }
        }
        existing[[idx]] <- r
        validacion_scope_set(sid, base, "reglas_custom", existing)
        .limpieza_invalidate_outputs(sid, base)
        list(ok = TRUE, regla = r)
    })) |>

    # --- Reglas custom: borrar -----------------------------------------------
    plumber::pr_delete("/api/validacion/v2/reglas_custom/<id>",
      wrap_endpoint(function(req, res, id = NULL) {
        sid <- session_header(req)
        base <- .get_base_nombre(req)
        if (is.null(id) || !nzchar(id)) stop_api(400, "E_MISSING_ID", "Falta id")
        scope <- .get_base_scope(sid, base)
        existing <- scope$reglas_custom %||% list()
        filtered <- Filter(function(r) !identical(as.character(r$id), id), existing)
        if (length(filtered) == length(existing)) {
          stop_api(404, "E_REGLA_NOT_FOUND", sprintf("Regla '%s' no existe.", id))
        }
        validacion_scope_set(sid, base, "reglas_custom", filtered)
        .limpieza_invalidate_outputs(sid, base)
        list(ok = TRUE, id = id)
    })) |>

    # --- Reglas custom: ejecutar ---------------------------------------------
    # Compila todas las reglas activas, las concatena al plan_result$plan
    # (mismo shape) y corre evaluar_consistencia. Guarda la evaluación en
    # scope$evaluacion para que InstrumentoTab la muestre con las reglas
    # custom mezcladas (id_regla = RC_*, categoría = "custom").
    plumber::pr_post("/api/validacion/v2/reglas_custom/ejecutar",
      wrap_endpoint(function(req, res) {
        sid <- session_header(req)
        base <- .get_base_nombre(req)
        scope <- .get_base_scope(sid, base)
        reglas <- scope$reglas_custom %||% list()
        activas <- Filter(function(r) isTRUE(r$activa), reglas)
        if (!length(activas)) {
          stop_api(409, "E_NO_REGLAS_ACTIVAS",
                   "No hay reglas custom activas para ejecutar.")
        }
        files <- .resolve_base_files(sid, base)
        base_effective <- files$base_nombre

        compat <- validation_profile_for_base(base_effective %||% base)
        bundle_inst <- scope$plan_result$bundle %||%
          if (!is.null(scope$plan_result$plan)) {
            validation_bundle_from_plan_df(
              plan_df = scope$plan_result$plan,
              existing_bundle = scope$plan_result$bundle %||% NULL,
              compatibility = compat
            )
          } else {
            list(rules = list(), plan = compile_rules_to_plan(list()), compatibility = compat)
          }

        desactivadas <- scope$reglas_desactivadas %||% character(0)
        if (length(desactivadas) && length(bundle_inst$rules %||% list())) {
          bundle_inst$rules <- Filter(function(r) !(r$id %in% desactivadas), bundle_inst$rules)
        }
        bundle_custom <- bridge_reglas_custom_list(activas)
        bundle_final <- bundle_inst
        bundle_final$rules <- .dedup_rules_exact(c(bundle_inst$rules %||% list(), bundle_custom))
        bundle_final$plan <- compile_rules_to_plan(bundle_final$rules)

        api_path <- .app_api_dir()

        job_id <- job_submit(
          sid = sid,
          kind = "validacion.v2.reglas_custom.ejecutar",
          func = function(data_path, data_ext, xlsform_path, bundle, base_name, api_path) {
            tryCatch(Sys.setlocale("LC_ALL", "en_US.UTF-8"),
                     warning = function(w) NULL, error = function(e) NULL)
            options(encoding = "UTF-8")
            if (requireNamespace("pkgload", quietly = TRUE)) {
              pkgload::load_all(api_path, quiet = TRUE)
            } else if (requireNamespace("devtools", quietly = TRUE)) {
              devtools::load_all(api_path, quiet = TRUE)
            }
            inst <- leer_xlsform_limpieza(xlsform_path, verbose = FALSE)
            datos <- read_validation_data_ast(
              path = data_path,
              ext = data_ext,
              instrumento = inst
            )
            ev <- evaluate_validation_bundle(
              bundle = bundle,
              data_input = datos,
              compatibility = validation_profile_for_base(base_name),
              strict = FALSE
            )
            total_raw <- tryCatch(total_inconsistencias(ev), error = function(e) NULL)
            total <- if (is.numeric(total_raw) && length(total_raw) == 1) {
              as.integer(total_raw)
            } else if (is.list(total_raw) && !is.null(total_raw$cabecera)) {
              ca <- total_raw$cabecera
              as.integer(if (is.data.frame(ca)) ca$Total_inconsistencias[1] else ca[[1]]$Total_inconsistencias)
            } else NA_integer_
            list(ev = ev, total = total)
          },
          args = list(
            data_path = files$data$path,
            data_ext = files$data_ext,
            xlsform_path = files$xlsform$path,
            bundle = bundle_final,
            base_name = base_effective %||% base,
            api_path = api_path
          ),
          on_complete = function(j) {
            raw <- j$result_data
            validacion_scope_set(j$sid, base_effective, "evaluacion", raw$ev)
            .limpieza_invalidate_outputs(j$sid, base_effective)
            list(ok = TRUE, total_inconsistencias = raw$total %||% NA_integer_)
          }
        )
        list(ok = TRUE, job_id = job_id,
              kind = "validacion.v2.reglas_custom.ejecutar",
              n_custom = length(activas))
    }))
}
