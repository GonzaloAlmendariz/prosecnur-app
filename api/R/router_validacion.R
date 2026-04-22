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
      data_ext = meta_b$data_ext %||% tolower(tools::file_ext(dat_meta$path))
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
    # Fase 2 v2 — Endpoints reales (Sprint 2) y stubs (Sprints 3-5).
    # Todos scoped por base vía header X-Base-Nombre. Fallback a primera
    # base del estudio o modo legacy.
    # =========================================================================

    # --- Panorama (Sprint 5: sólo estado; KPIs y top listas vienen luego) ----
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

    # --- Instrumento: estado general (HEAD-like) -----------------------------
    plumber::pr_get("/api/validacion/v2/instrumento/estado", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      scope <- .get_base_scope(sid, base)
      n_reglas <- if (!is.null(scope$plan_result) && !is.null(scope$plan_result$plan)) {
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
      validacion_scope_set(sid, base, "plan_result", plan_result)
      # Al reconstruir el plan, la evaluación vieja ya no aplica.
      validacion_scope_set(sid, base, "evaluacion", NULL)

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
      plan_df <- cargar_plan_excel(meta$path)

      prev <- .get_base_scope(sid, base)$plan_result
      new_result <- if (is.null(prev)) {
        list(plan = plan_df, resumen = NULL, secciones = NULL, meta = NULL)
      } else {
        prev$plan <- plan_df
        prev
      }
      validacion_scope_set(sid, base, "plan_result", new_result)
      validacion_scope_set(sid, base, "evaluacion", NULL)
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

      # Filtrar reglas desactivadas (toggle "ignorar") antes de correr.
      plan_efectivo <- scope$plan_result$plan
      desactivadas <- scope$reglas_desactivadas %||% character(0)
      if (length(desactivadas) && !is.null(plan_efectivo)) {
        id_col <- if ("ID" %in% names(plan_efectivo)) "ID"
                  else if ("id_regla" %in% names(plan_efectivo)) "id_regla"
                  else NULL
        if (!is.null(id_col)) {
          keep <- !(as.character(plan_efectivo[[id_col]]) %in% desactivadas)
          plan_efectivo <- plan_efectivo[keep, , drop = FALSE]
        }
      }

      # api_path para que el subprocess callr pueda cargar el paquete.
      api_path <- file.path(Sys.getenv("PULSO_REPO_ROOT", "."), "api")

      job_id <- job_submit(
        sid = sid,
        kind = "validacion.v2.auditoria",
        func = function(data_path, data_ext, plan, api_path) {
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
          list(ev = ev, total = total_scalar)
        },
        args = list(
          data_path = files$data$path,
          data_ext = files$data_ext,
          plan = plan_efectivo,
          api_path = api_path
        ),
        on_complete = function(j) {
          raw <- j$result_data
          validacion_scope_set(j$sid, base_effective, "evaluacion", raw$ev)
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
      top_reglas <- .vd_top_reglas(resumen, n = 20L)
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
    #   { ok, regla: {id, nombre, objetivo, tipo_observacion, seccion,
    #                 categoria, variables:[], procesamiento, activa,
    #                 n_inconsistencias, porcentaje},
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

      nombre_regla <- .col(row_plan, c("Nombre de la regla", "nombre_regla")) |>
        (\(x) if (is.na(x)) .col(row_meta, "nombre_regla") else x)()
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
        vars <- c(
          as.character(row_meta$variable_1 %||% NA),
          as.character(row_meta$variable_2 %||% NA),
          as.character(row_meta$variable_3 %||% NA)
        )
      }
      vars <- vars[!is.na(vars) & nzchar(vars)]

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
      # Detectar columna UUID: buscar nombres típicos.
      uuid_col <- NULL
      if (!is.null(casos_df) && nrow(casos_df)) {
        candidatos_uuid <- c("_uuid", "uuid", "_id", "_submission_id",
                              "_submission_uuid", "id_caso", "fila_id")
        for (cname in candidatos_uuid) {
          if (cname %in% names(casos_df)) { uuid_col <- cname; break }
        }
        # Fallback: si no existe uuid, usamos _fila_idx (índice del data).
        if (is.null(uuid_col)) {
          casos_df$`_fila_idx` <- seq_len(nrow(casos_df))
          uuid_col <- "_fila_idx"
        }
      }

      list(
        ok = TRUE,
        regla = list(
          id = id_regla,
          nombre = if (is.na(nombre_regla)) id_regla else nombre_regla,
          objetivo = if (is.na(objetivo)) NA_character_ else objetivo,
          tipo_observacion = if (is.na(tipo_obs)) NA_character_ else tipo_obs,
          seccion = if (is.na(seccion)) NA_character_ else seccion,
          categoria = if (is.na(categoria)) NA_character_ else categoria,
          tabla = if (is.na(tabla)) NA_character_ else tabla,
          variables = as.list(vars),
          procesamiento = if (is.null(procesamiento) || is.na(procesamiento)) NA_character_ else procesamiento,
          activa = activa,
          n_inconsistencias = n_inc,
          porcentaje = pct
        ),
        uuid_col = uuid_col %||% NA_character_,
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
          nombre = c("Nombre de la regla", "nombre_regla"),
          objetivo = c("Objetivo", "objetivo"),
          tipo_observacion = c("Tipo de observación", "tipo_observacion"),
          categoria = c("Categoría", "categoria"),
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
        validacion_scope_set(sid, base, "plan_result", new_plan_result)
        validacion_scope_set(sid, base, "evaluacion", NULL)

        list(ok = TRUE, id_regla = id_regla,
              fila = .plan_rows_preview(plan_df[row_idx, , drop = FALSE], n = 1L))
    })) |>

    # --- Explorar: inventario de variables agrupadas por sección ------------
    plumber::pr_get("/api/validacion/v2/explorar/variables", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      .get_base_scope(sid, base)  # valida existencia

      # Resolver data + instrumento scoped por base (o legacy).
      data_sources <- estudio_data_sources(sid)
      inst_sources <- estudio_inst_sources(sid)
      effective_base <- if (!is.null(base) && nzchar(base)) base
                         else if (length(data_sources) > 0L) names(data_sources)[1]
                         else NULL
      if (is.null(effective_base) ||
          is.null(data_sources[[effective_base]]) ||
          is.null(inst_sources[[effective_base]])) {
        stop_api(409, "E_NO_DATA_INST",
                 "No hay data o instrumento cargado para esta base.")
      }
      inv <- .explorar_inventario(
        data = data_sources[[effective_base]],
        instrumento = inst_sources[[effective_base]]
      )
      list(
        ok = TRUE,
        base_nombre = effective_base %||% NA_character_,
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

      data_sources <- estudio_data_sources(sid)
      inst_sources <- estudio_inst_sources(sid)
      effective_base <- if (!is.null(base) && nzchar(base)) base
                         else if (length(data_sources) > 0L) names(data_sources)[1]
                         else NULL
      if (is.null(effective_base)) {
        stop_api(409, "E_NO_DATA_INST", "No hay data cargada.")
      }
      view <- build_view_univariado(
        data = data_sources[[effective_base]],
        var = var,
        instrumento = inst_sources[[effective_base]]
      )
      view$base_nombre <- effective_base
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
      if (!nzchar(var_x) || !nzchar(var_y)) {
        stop_api(400, "E_MISSING_VARS", "Body debe incluir 'var_x' y 'var_y'.")
      }
      data_sources <- estudio_data_sources(sid)
      inst_sources <- estudio_inst_sources(sid)
      effective_base <- if (!is.null(base) && nzchar(base)) base
                         else if (length(data_sources) > 0L) names(data_sources)[1]
                         else NULL
      if (is.null(effective_base)) {
        stop_api(409, "E_NO_DATA_INST", "No hay data cargada.")
      }
      view <- build_view_bivariado(
        data = data_sources[[effective_base]],
        var_x = var_x, var_y = var_y,
        instrumento = inst_sources[[effective_base]]
      )
      list(ok = TRUE, base_nombre = effective_base, view = view)
    })) |>

    # --- Reglas custom: stub (Sprint 4) --------------------------------------
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
