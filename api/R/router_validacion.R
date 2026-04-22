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
          plan = scope$plan_result$plan,
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

    # --- Instrumento: drill por regla (casos individuales) -------------------
    plumber::pr_post("/api/validacion/v2/instrumento/regla", wrap_endpoint(function(req, res, id_regla = NULL) {
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
      detalle <- auditar_regla(scope$evaluacion, ids = id_regla,
                               inst = inst, verbose = FALSE)
      list(ok = TRUE, detalle = .plan_rows_preview(detalle, n = 500L))
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
