.SLIDE_REGISTRY <- list(
  p_slide_title       = list(cat = "estructural", grafs = c()),
  p_slide_section     = list(cat = "estructural", grafs = c()),
  p_slide_1           = list(cat = "contenido",   grafs = c("plot")),
  p_slide_2           = list(cat = "contenido",   grafs = c("left", "right")),
  p_slide_text_l      = list(cat = "contenido",   grafs = c("plot")),
  p_slide_text_r      = list(cat = "contenido",   grafs = c("plot")),
  p_slide_poblacion_2 = list(cat = "poblacion",   grafs = c("left", "right")),
  p_slide_poblacion_4 = list(cat = "poblacion",   grafs = c("up_left", "up_right", "bottom_left", "bottom_right")),
  p_slide_poblacion_5 = list(cat = "poblacion",   grafs = c("pic1", "pic2", "pic3", "pic4", "pic5")),
  p_slide_poblacion_6 = list(cat = "poblacion",   grafs = c("pic1", "pic2", "pic3", "pic4", "pic5", "pic6"))
)

.GRAFICADOR_REGISTRY <- c(
  "p_barras_agrupadas", "p_barras_apiladas", "p_barras_multiapiladas",
  "p_pie", "p_donut",
  "p_numerico", "p_boxplot", "p_media_rango",
  "p_radar_tabla"
)

.normalize_plan <- function(plan) {
  if (is.null(plan)) return(list(slides = list()))
  if (is.data.frame(plan)) plan <- as.list(plan)
  slides <- plan$slides %||% list()
  if (is.data.frame(slides)) {
    slides <- lapply(seq_len(nrow(slides)), function(i) {
      row <- as.list(slides[i, , drop = FALSE])
      row <- lapply(row, function(v) if (is.list(v) && length(v) == 1) v[[1]] else v)
      row
    })
  } else if (is.list(slides) && !is.null(names(slides))) {
    slides <- list(slides)
  }
  slides <- lapply(slides, function(s) {
    s <- as.list(s)
    if (!is.null(s$payload)) {
      s$payload <- if (is.data.frame(s$payload)) as.list(s$payload) else as.list(s$payload)
    }
    s
  })
  plan$slides <- slides
  plan
}

.as_json_list <- function(x) {
  if (is.null(x)) return(NULL)
  if (is.data.frame(x)) return(as.list(x))
  if (is.list(x)) return(x)
  as.list(x)
}

.require_rp_data <- function(sid) {
  s <- session_get(sid)
  if (is.null(s$rp_data) || is.null(s$rp_inst)) {
    stop_api(409, "E_NO_RP_DATA", "Primero corre Fase 4 — Preparar datos para reporte.")
  }
  s
}

.rebuild_graf <- function(g) {
  if (is.null(g)) return(NULL)
  if (is.null(g$graficador) || !nzchar(g$graficador)) return(NULL)
  if (!(g$graficador %in% .GRAFICADOR_REGISTRY)) {
    stop_api(400, "E_UNKNOWN_GRAF", sprintf("Graficador no registrado: %s", g$graficador))
  }
  fn <- getExportedValue("prosecnur", g$graficador)
  do.call(fn, as.list(g$args %||% list()))
}

.rebuild_slide <- function(s) {
  s <- as.list(s)
  tipo <- as.character(s$tipo %||% "")
  if (!nzchar(tipo)) stop_api(400, "E_MISSING_TIPO", "Slide sin tipo")
  if (!(tipo %in% names(.SLIDE_REGISTRY))) {
    stop_api(400, "E_UNKNOWN_TIPO", sprintf("Tipo de slide no registrado: %s", tipo))
  }
  fn <- getExportedValue("prosecnur", tipo)
  payload <- .as_json_list(s$payload) %||% list()
  payload <- lapply(payload, function(v) if (is.list(v) && length(v) == 1 && is.null(names(v))) v[[1]] else v)
  graf_slots <- .SLIDE_REGISTRY[[tipo]]$grafs
  for (slot_name in graf_slots) {
    if (!is.null(payload[[slot_name]])) {
      payload[[slot_name]] <- .rebuild_graf(.as_json_list(payload[[slot_name]]))
    }
  }
  allowed_args <- names(formals(fn))
  payload <- payload[names(payload) %in% allowed_args]
  do.call(fn, payload)
}

.build_presets <- function(presets_json) {
  if (is.null(presets_json) || length(presets_json) == 0) return(NULL)
  args <- lapply(presets_json, as.list)
  do.call(prosecnur::p_presets, args)
}

.build_w_presets <- function(w_json) {
  if (is.null(w_json) || length(w_json) == 0) return(NULL)
  args <- lapply(w_json, as.list)
  do.call(prosecnur::w_presets, args)
}

.validar_plan_json <- function(plan_json) {
  errs <- character(0); warns <- character(0)
  plan_json <- .normalize_plan(plan_json)
  slides <- plan_json$slides
  if (length(slides) == 0) errs <- c(errs, "El plan no tiene slides.")
  for (i in seq_along(slides)) {
    s <- as.list(slides[[i]])
    tipo <- as.character(s$tipo %||% "")
    tag <- sprintf("slide[%d]", i)
    if (!nzchar(tipo)) { errs <- c(errs, sprintf("%s: falta tipo", tag)); next }
    if (!(tipo %in% names(.SLIDE_REGISTRY))) {
      errs <- c(errs, sprintf("%s: tipo desconocido '%s'", tag, tipo)); next
    }
    payload <- .as_json_list(s$payload) %||% list()
    graf_slots <- .SLIDE_REGISTRY[[tipo]]$grafs
    for (slot_name in graf_slots) {
      slot <- .as_json_list(payload[[slot_name]])
      graf_name <- as.character(slot$graficador %||% "")
      if (!nzchar(graf_name)) {
        warns <- c(warns, sprintf("%s (%s): slot '%s' sin graficador", tag, tipo, slot_name))
      } else if (!(graf_name %in% .GRAFICADOR_REGISTRY)) {
        errs <- c(errs, sprintf("%s: graficador desconocido '%s'", tag, graf_name))
      }
    }
  }
  list(ok = length(errs) == 0, errors = errs, warnings = warns, n_slides = length(slides))
}

mount_graficos <- function(pr) {
  pr |>
    plumber::pr_get("/api/graficos/registry", wrap_endpoint(function(req, res) {
      list(
        slides = lapply(names(.SLIDE_REGISTRY), function(name) {
          reg <- .SLIDE_REGISTRY[[name]]
          fn <- tryCatch(getExportedValue("prosecnur", name), error = function(e) NULL)
          args <- if (!is.null(fn)) names(formals(fn)) else character(0)
          list(name = name, categoria = reg$cat, slots = reg$grafs, args = args)
        }),
        graficadores = lapply(.GRAFICADOR_REGISTRY, function(name) {
          fn <- tryCatch(getExportedValue("prosecnur", name), error = function(e) NULL)
          args <- if (!is.null(fn)) names(formals(fn)) else character(0)
          list(name = name, args = args)
        })
      )
    })) |>
    plumber::pr_get("/api/graficos/variables", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      if (is.null(s$rp_inst)) return(list(variables = list()))
      survey <- s$rp_inst$survey
      if (is.null(survey)) return(list(variables = list()))
      skip <- c("begin_group","end_group","begin_repeat","end_repeat","start","end","today","deviceid","note","calculate")
      vars <- list()
      for (i in seq_len(nrow(survey))) {
        tb <- as.character(survey$type_base[i] %||% survey$type[i] %||% "")
        if (tb %in% skip) next
        nm <- as.character(survey$name[i] %||% "")
        if (!nzchar(nm)) next
        vars[[length(vars) + 1]] <- list(
          name = nm,
          label = as.character(survey$label[i] %||% nm),
          tipo = tb,
          seccion = as.character(survey$group_name[i] %||% "")
        )
      }
      list(variables = vars)
    })) |>
    plumber::pr_post("/api/graficos/validar", wrap_endpoint(function(req, res, plan = NULL) {
      if (is.null(plan)) stop_api(400, "E_NO_PLAN", "Falta 'plan' en el body")
      .validar_plan_json(plan)
    })) |>
    plumber::pr_post("/api/graficos/ppt", wrap_endpoint(function(req, res, plan = NULL, presets = NULL, w_presets = NULL) {
      sid <- session_header(req)
      s <- .require_rp_data(sid)
      if (is.null(plan)) stop_api(400, "E_NO_PLAN", "Falta 'plan' en el body")
      plan <- .normalize_plan(plan)
      validation <- .validar_plan_json(plan)
      if (!validation$ok) stop_api(400, "E_INVALID_PLAN", paste(validation$errors, collapse = "; "))
      slides_r <- lapply(plan$slides, .rebuild_slide)
      plan_r <- do.call(prosecnur::p_plan, list(slides = slides_r))
      presets_r <- .build_presets(presets)

      out_path <- file.path(s$dir, "downloads", sprintf("reporte_%s.pptx", uuid::UUIDgenerate()))
      prosecnur::reporte_ppt_plan(
        data = s$rp_data,
        instrumento = s$rp_inst,
        path_ppt = out_path,
        presets = presets_r,
        plan = plan_r,
        mensajes_progreso = FALSE
      )
      meta <- .register_output_file(sid, "reporte_ppt", out_path)
      session_set(sid, "graficos_ppt_ok", TRUE)
      list(ok = TRUE, file_id = meta$file_id, size = meta$size, n_slides = length(slides_r))
    })) |>
    plumber::pr_post("/api/graficos/word", wrap_endpoint(function(req, res, plan = NULL, presets = NULL, w_presets = NULL) {
      sid <- session_header(req)
      s <- .require_rp_data(sid)
      if (is.null(plan)) stop_api(400, "E_NO_PLAN", "Falta 'plan' en el body")
      plan <- .normalize_plan(plan)
      validation <- .validar_plan_json(plan)
      if (!validation$ok) stop_api(400, "E_INVALID_PLAN", paste(validation$errors, collapse = "; "))
      slides_r <- lapply(plan$slides, .rebuild_slide)
      plan_r <- do.call(prosecnur::p_plan, list(slides = slides_r))
      presets_r <- .build_presets(presets)
      w_presets_r <- .build_w_presets(w_presets)

      out_path <- file.path(s$dir, "downloads", sprintf("reporte_%s.docx", uuid::UUIDgenerate()))
      prosecnur::reporte_word_plan(
        data = s$rp_data,
        instrumento = s$rp_inst,
        path_docx = out_path,
        presets_ppt = presets_r,
        presets_word = w_presets_r,
        plan = plan_r,
        mensajes_progreso = FALSE
      )
      meta <- .register_output_file(sid, "reporte_word", out_path)
      session_set(sid, "graficos_word_ok", TRUE)
      list(ok = TRUE, file_id = meta$file_id, size = meta$size, n_slides = length(slides_r))
    }))
}
