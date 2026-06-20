# Compartir planes de Graficos entre proyectos compatibles.
#
# El paquete portable contiene solo configuracion editable y assets auxiliares
# usados por el plan. No incluye data, XLSForms, SAV ni entregables generados.

.graficos_share_version <- "graficos-share/1"
.graficos_share_config_version <- "graficos/4"

.graficos_now_utc <- function() {
  format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
}

.graficos_var_skip_types <- c(
  "begin_group", "end_group", "begin_repeat", "end_repeat",
  "start", "end", "today", "deviceid", "note", "calculate"
)

.graficos_choices_label_col <- function(choices_tbl) {
  if (is.null(choices_tbl) || !is.data.frame(choices_tbl)) return(NA_character_)
  candidates <- c("label", "label::es")
  hit <- candidates[candidates %in% names(choices_tbl)][1]
  if (!length(hit) || is.na(hit)) {
    extras <- setdiff(names(choices_tbl), c("list_name", "name", "value"))
    hit <- extras[1]
  }
  if (!length(hit) || is.na(hit)) NA_character_ else hit
}

.graficos_list_name_for_row <- function(survey, i) {
  for (col in c("list_name", "list_norm")) {
    if (col %in% names(survey)) {
      x <- as.character(survey[[col]][i] %||% "")
      if (nzchar(x)) return(x)
    }
  }
  tp <- as.character(survey$type[i] %||% "")
  parts <- strsplit(tp, "\\s+")[[1]]
  if (length(parts) >= 2L && parts[1] %in% c("select_one", "select_multiple")) {
    return(parts[2])
  }
  ""
}

.graficos_choices_for_list <- function(choices, list_name) {
  if (is.null(choices) || !is.data.frame(choices) || !nzchar(list_name) ||
      !"list_name" %in% names(choices) || !"name" %in% names(choices)) {
    return(list(items = list(), signature = ""))
  }
  rows <- choices[as.character(choices$list_name) == list_name, , drop = FALSE]
  if (!nrow(rows)) return(list(items = list(), signature = ""))
  lab_col <- .graficos_choices_label_col(rows)
  items <- lapply(seq_len(nrow(rows)), function(j) {
    nm <- as.character(rows$name[j] %||% "")
    lab <- if (!is.na(lab_col) && lab_col %in% names(rows)) {
      as.character(rows[[lab_col]][j] %||% nm)
    } else {
      nm
    }
    list(name = nm, label = lab)
  })
  signature <- paste(vapply(items, function(it) {
    paste0(as.character(it$name %||% ""), "=", as.character(it$label %||% ""))
  }, character(1)), collapse = "|")
  list(items = items, signature = signature)
}

.graficos_extract_vars_from_inst <- function(rp_inst) {
  if (is.null(rp_inst)) return(list())
  survey <- rp_inst$survey
  if (is.null(survey) || !is.data.frame(survey) || !nrow(survey)) return(list())
  choices <- rp_inst$choices %||% rp_inst$choices_raw %||% NULL
  vs <- list()
  for (i in seq_len(nrow(survey))) {
    tb <- as.character(survey$type_base[i] %||% survey$type[i] %||% "")
    if (tb %in% .graficos_var_skip_types) next
    nm <- as.character(survey$name[i] %||% "")
    if (!nzchar(nm)) next
    list_name <- .graficos_list_name_for_row(survey, i)
    choice_meta <- .graficos_choices_for_list(choices, list_name)
    vs[[length(vs) + 1L]] <- list(
      name = nm,
      label = as.character(survey$label[i] %||% nm),
      tipo = tb,
      seccion = as.character(survey$group_name[i] %||% ""),
      list_name = list_name,
      choices = choice_meta$items,
      scale_signature = choice_meta$signature
    )
  }
  vs
}

.graficos_all_inst_sources <- function(sid) {
  if (exists(".pulso_rebuild_estudio_runtime_sources", mode = "function")) {
    tryCatch(.pulso_rebuild_estudio_runtime_sources(sid), error = function(e) FALSE)
  }
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(list())
  inst_sources <- if (exists("estudio_inst_sources", mode = "function")) {
    estudio_inst_sources(sid)
  } else {
    s$rp_inst_sources %||% list()
  }
  if ((is.null(inst_sources) || !length(inst_sources)) && !is.null(s$rp_inst)) {
    inst_sources <- list(default = s$rp_inst)
  }
  if (!is.list(inst_sources)) list() else inst_sources
}

.graficos_variables_sources_payload <- function(sid, scoped = TRUE) {
  inst_sources <- if (isTRUE(scoped)) {
    .graficos_processing_sources(sid)$inst_sources
  } else {
    .graficos_all_inst_sources(sid)
  }
  sources <- lapply(names(inst_sources), function(nm) {
    list(name = nm, variables = .graficos_extract_vars_from_inst(inst_sources[[nm]]))
  })
  list(
    sources = sources,
    multi = length(sources) > 1L,
    active_base = as.character(.graficos_active_base_name(sid) %||% NA_character_),
    processing_mode = if (exists("estudio_processing_mode", mode = "function")) estudio_processing_mode(sid) else "multibase"
  )
}

.graficos_share_clean_filename <- function(x, fallback = "plan_graficos.pulso-graficos.zip") {
  x <- basename(as.character(x %||% "")[1])
  if (!nzchar(x) || is.na(x)) x <- fallback
  x <- gsub("[/\\\\:*?\"<>|]", "_", x)
  if (!grepl("[.]zip$", x, ignore.case = TRUE)) x <- paste0(x, ".zip")
  x
}

.graficos_share_project_slug <- function(sid) {
  s <- session_get(sid, required = FALSE)
  label <- (s$estudio %||% list())$nombre %||% tools::file_path_sans_ext(basename(s$project_path %||% "proyecto"))
  .export_slug(label, fallback = "proyecto")
}

.graficos_share_source_vars <- function(sid) {
  payload <- .graficos_variables_sources_payload(sid, scoped = FALSE)
  active <- as.character(.graficos_active_base_name(sid) %||% "")
  sources <- payload$sources %||% list()
  if (nzchar(active)) {
    hit <- Filter(function(src) identical(as.character(src$name %||% ""), active), sources)
    if (length(hit)) return(hit[[1]]$variables %||% list())
  }
  seen <- character(0)
  out <- list()
  for (src in sources) {
    for (v in (src$variables %||% list())) {
      key <- .graficos_share_var_key(v$name %||% "")
      if (!nzchar(key) || key %in% seen) next
      seen <- c(seen, key)
      out[[length(out) + 1L]] <- v
    }
  }
  out
}

.graficos_share_asset_entries <- function(sid, cfg, stage_dir) {
  iconos <- cfg$iconos %||% list()
  if (!is.list(iconos) || !length(iconos)) return(list(assets = list(), config = cfg))

  files_dir <- file.path(stage_dir, "files", "icons")
  dir.create(files_dir, recursive = TRUE, showWarnings = FALSE)
  assets <- list()
  next_iconos <- list()

  for (ico in iconos) {
    ico <- as.list(ico)
    file_id <- as.character(ico$file_id %||% "")
    if (!nzchar(file_id)) {
      ico$path <- NULL
      next_iconos[[length(next_iconos) + 1L]] <- ico
      next
    }
    meta <- tryCatch(get_file(sid, file_id), error = function(e) NULL)
    if (is.null(meta) || is.null(meta$path) || !file.exists(meta$path)) {
      ico$path <- NULL
      next_iconos[[length(next_iconos) + 1L]] <- ico
      next
    }
    ext <- tolower(tools::file_ext(meta$path))
    if (!nzchar(ext)) ext <- tolower(as.character(meta$ext %||% "bin"))
    rel <- file.path("files", "icons", paste0(file_id, ".", ext))
    file.copy(meta$path, file.path(stage_dir, rel), overwrite = TRUE)
    assets[[length(assets) + 1L]] <- list(
      kind = "graficos_icon",
      old_file_id = file_id,
      icon_id = as.character(ico$id %||% ""),
      original_name = as.character(meta$original_name %||% paste0(file_id, ".", ext)),
      ext = ext,
      path = rel
    )
    ico$path <- NULL
    next_iconos[[length(next_iconos) + 1L]] <- ico
  }

  cfg$iconos <- next_iconos
  list(assets = assets, config = cfg)
}

.graficos_share_write_package <- function(sid, cfg) {
  s <- session_get(sid)
  stage <- tempfile("graficos_share_")
  dir.create(stage, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)

  cfg <- .graficos_normalize_config(cfg, sid = sid, include_legacy_aliases = FALSE)
  assets_result <- .graficos_share_asset_entries(sid, cfg, stage)
  cfg <- assets_result$config
  assets <- assets_result$assets
  vars <- .graficos_share_source_vars(sid)
  slides <- .normalize_plan(cfg$plan)$slides %||% list()

  app_version <- tryCatch(
    as.character(utils::packageVersion("prosecnurapp")),
    error = function(e) as.character(Sys.getenv("PROSECNUR_VERSION", "dev"))
  )
  manifest <- list(
    package_type = "graficos_plan_bundle",
    version = .graficos_share_version,
    config_version = .graficos_share_config_version,
    created_at = .graficos_now_utc(),
    app_version = app_version,
    source_project_name = (s$estudio %||% list())$nombre %||%
      tools::file_path_sans_ext(basename(s$project_path %||% "")),
    source_active_base = as.character(.graficos_active_base_name(sid) %||% ""),
    n_slides = length(slides),
    n_assets = length(assets),
    variables = vars,
    assets = assets
  )

  writeLines(
    jsonlite::toJSON(manifest, auto_unbox = TRUE, pretty = TRUE, null = "null"),
    file.path(stage, "manifest.json"),
    useBytes = TRUE
  )
  writeLines(
    jsonlite::toJSON(list(version = .graficos_share_config_version, config = cfg),
                     auto_unbox = TRUE, pretty = TRUE, null = "null"),
    file.path(stage, "config.json"),
    useBytes = TRUE
  )

  out_name <- sprintf("%s_plan_graficos_%s.pulso-graficos.zip",
                      .graficos_share_project_slug(sid),
                      format(Sys.time(), "%Y%m%d_%H%M%S", tz = "UTC"))
  out_path <- file.path(s$dir, "downloads", out_name)
  dir.create(dirname(out_path), recursive = TRUE, showWarnings = FALSE)

  old_wd <- getwd()
  setwd(stage)
  on.exit(setwd(old_wd), add = TRUE)
  entries <- list.files(".", recursive = TRUE, all.files = FALSE)
  tryCatch(
    zip::zip(zipfile = out_path, files = entries),
    error = function(e) {
      setwd(old_wd)
      stop_api(500, "E_GRAFICOS_SHARE_ZIP",
               sprintf("No se pudo crear el paquete compartible: %s", conditionMessage(e)))
    }
  )
  setwd(old_wd)

  .register_output_file(sid, "graficos_share", out_path, original_name = out_name)
}

.graficos_share_export <- function(sid) {
  cfg <- .graficos_config_get(sid)
  meta <- .graficos_share_write_package(sid, cfg)
  list(
    ok = TRUE,
    file_id = meta$file_id,
    filename = meta$original_name,
    size = meta$size,
    exported_at = .graficos_now_utc()
  )
}

.graficos_share_decode_to_file <- function(sid, filename, data_base64) {
  filename <- .graficos_share_clean_filename(filename)
  data_base64 <- sub("^data:[^;]*;base64,", "", as.character(data_base64 %||% ""))
  if (!nzchar(data_base64)) {
    stop_api(400, "E_GRAFICOS_SHARE_NO_DATA", "Falta el contenido base64 del paquete.")
  }
  bytes <- tryCatch(
    jsonlite::base64_dec(data_base64),
    error = function(e) stop_api(400, "E_GRAFICOS_SHARE_BAD_BASE64", conditionMessage(e))
  )
  save_upload(sid, "graficos_share", filename, bytes)
}

.graficos_share_read_package <- function(path, keep_stage = FALSE) {
  if (is.null(path) || !file.exists(path)) {
    stop_api(404, "E_GRAFICOS_SHARE_NO_FILE", "No se encontro el paquete compartido.")
  }
  stage <- tempfile("graficos_share_read_")
  dir.create(stage, recursive = TRUE, showWarnings = FALSE)
  if (!isTRUE(keep_stage)) {
    on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
  }
  tryCatch(
    utils::unzip(path, exdir = stage),
    error = function(e) stop_api(400, "E_GRAFICOS_SHARE_BAD_ZIP",
                                sprintf("No se pudo abrir el ZIP: %s", conditionMessage(e)))
  )
  manifest_path <- file.path(stage, "manifest.json")
  config_path <- file.path(stage, "config.json")
  if (!file.exists(manifest_path) || !file.exists(config_path)) {
    stop_api(400, "E_GRAFICOS_SHARE_BAD_PACKAGE",
             "El paquete debe contener manifest.json y config.json.")
  }
  manifest <- tryCatch(
    jsonlite::fromJSON(manifest_path, simplifyVector = FALSE),
    error = function(e) stop_api(400, "E_GRAFICOS_SHARE_BAD_MANIFEST", conditionMessage(e))
  )
  if (!identical(as.character(manifest$package_type %||% ""), "graficos_plan_bundle")) {
    stop_api(400, "E_GRAFICOS_SHARE_KIND",
             "El archivo no es un paquete de plan de Graficos.")
  }
  parsed <- tryCatch(
    jsonlite::fromJSON(config_path, simplifyVector = FALSE),
    error = function(e) stop_api(400, "E_GRAFICOS_SHARE_BAD_CONFIG", conditionMessage(e))
  )
  list(stage = stage, manifest = manifest, config = parsed$config %||% parsed)
}

.graficos_share_var_key <- function(x) {
  x <- as.character(x %||% "")
  if (!length(x)) return("")
  x <- trimws(x[1])
  if (!nzchar(x) || is.na(x)) return("")
  x <- sub("^.*\\$", "", x)
  tolower(trimws(x))
}

.graficos_share_var_code <- function(x) {
  x <- as.character(x %||% "")
  if (!length(x)) return("")
  x <- trimws(x[1])
  if (!nzchar(x) || is.na(x)) return("")
  sub("^.*\\$", "", x)
}

.graficos_share_var_map <- function(vars) {
  out <- list()
  for (v in (vars %||% list())) {
    key <- .graficos_share_var_key(v$name %||% "")
    if (nzchar(key) && is.null(out[[key]])) out[[key]] <- v
  }
  out
}

.graficos_share_collect_args_refs <- function(args) {
  refs <- character(0)
  if (!is.list(args)) return(refs)
  for (arg_name in c("var", "cruces", "cruce")) {
    v <- args[[arg_name]]
    if (is.character(v) && length(v) && nzchar(v[1])) refs <- c(refs, v[1])
  }
  vars <- args$vars
  if (is.character(vars) && length(vars) && nzchar(vars[1])) {
    refs <- c(refs, vars)
  } else if (is.list(vars)) {
    if (is.null(names(vars))) {
      refs <- c(refs, unlist(vars[vapply(vars, is.character, logical(1))], use.names = FALSE))
    } else {
      for (value in vars) {
        if (is.character(value)) refs <- c(refs, value)
        else if (is.list(value)) refs <- c(refs, unlist(value[vapply(value, is.character, logical(1))], use.names = FALSE))
      }
    }
  }
  blocks <- args$bloques
  if (is.list(blocks) && length(blocks)) {
    for (block in blocks) {
      if (is.list(block)) refs <- c(refs, .graficos_share_collect_args_refs(block))
    }
  }
  refs <- trimws(as.character(refs))
  unique(refs[nzchar(refs)])
}

.graficos_share_slide_refs <- function(slide) {
  slide <- as.list(slide)
  payload <- slide$payload %||% list()
  refs <- character(0)
  if (!is.list(payload)) return(refs)
  for (slot in payload) {
    if (is.list(slot) && !is.null(slot$graficador)) {
      refs <- c(refs, .graficos_share_collect_args_refs(slot$args %||% list()))
    }
  }
  unique(refs)
}

.graficos_share_adapt_args_refs <- function(args) {
  if (!is.list(args)) return(args)
  strip_one <- function(x) {
    if (is.character(x) && length(x)) .graficos_share_var_code(x) else x
  }
  for (arg_name in c("var", "cruces", "cruce")) {
    if (!is.null(args[[arg_name]])) args[[arg_name]] <- strip_one(args[[arg_name]])
  }
  if (!is.null(args$vars)) {
    if (is.character(args$vars)) {
      args$vars <- vapply(args$vars, .graficos_share_var_code, character(1))
    } else if (is.list(args$vars)) {
      args$vars <- lapply(args$vars, function(value) {
        if (is.character(value)) vapply(value, .graficos_share_var_code, character(1))
        else if (is.list(value)) lapply(value, function(v) if (is.character(v)) .graficos_share_var_code(v) else v)
        else value
      })
    }
  }
  if (is.list(args$bloques)) {
    args$bloques <- lapply(args$bloques, function(block) {
      if (is.list(block)) .graficos_share_adapt_args_refs(block) else block
    })
  }
  args
}

.graficos_share_adapt_slide <- function(slide) {
  slide <- as.list(slide)
  payload <- slide$payload %||% list()
  if (is.list(payload)) {
    payload <- lapply(payload, function(slot) {
      if (is.list(slot) && !is.null(slot$graficador)) {
        slot$args <- .graficos_share_adapt_args_refs(slot$args %||% list())
      }
      slot
    })
  }
  slide$payload <- payload
  slide
}

.graficos_share_slide_title <- function(slide, index = NA_integer_) {
  payload <- as.list(slide$payload %||% list())
  title <- as.character(payload$titulo %||% payload$title %||% "")
  if (length(title) && nzchar(trimws(title[1]))) return(trimws(title[1]))
  tipo <- as.character(slide$tipo %||% "slide")
  if (!is.na(index) && is.finite(index)) sprintf("%s %d", tipo, index) else tipo
}

.graficos_target_base_names <- function(sid) {
  s <- session_get(sid)
  bases <- names((s$estudio %||% list())$bases %||% list())
  if (length(bases)) return(bases)
  sources <- names(.graficos_all_inst_sources(sid))
  if (length(sources)) return(sources)
  character(0)
}

.graficos_base_label <- function(sid, base_name) {
  s <- session_get(sid, required = FALSE)
  base <- ((s$estudio %||% list())$bases %||% list())[[base_name]] %||% list()
  as.character(base$source_title %||% base$source_alias %||% base$nombre %||% base_name)
}

.graficos_config_get_for_base <- function(sid, base_name = NULL, s = NULL) {
  s <- s %||% session_get(sid, required = FALSE)
  if (is.null(s)) return(.graficos_default_config(sid))
  base_name <- as.character(base_name %||% "")
  if (nzchar(base_name)) {
    configs <- s$graficos_config_por_base
    if (is.list(configs) && !is.null(configs[[base_name]])) return(configs[[base_name]])
    return(.graficos_default_config(sid))
  }
  .graficos_config_get(sid, s)
}

.graficos_config_set_for_base <- function(sid, base_name = NULL, cfg) {
  base_name <- as.character(base_name %||% "")
  if (!nzchar(base_name)) return(.graficos_config_set(sid, cfg))
  s <- session_get(sid)
  bases <- names((s$estudio %||% list())$bases %||% list())
  if (!length(bases) || !(base_name %in% bases)) {
    return(.graficos_config_set(sid, cfg))
  }
  configs <- s$graficos_config_por_base
  if (is.null(configs) || !is.list(configs)) configs <- list()
  configs[[base_name]] <- cfg
  session_set(sid, "graficos_config_por_base", configs)
  invisible(cfg)
}

.graficos_status_invalidate_for_base <- function(sid, base_name = NULL) {
  s <- session_get(sid)
  base_name <- as.character(base_name %||% "")
  statuses <- s$graficos_status_por_base
  if (is.null(statuses) || !is.list(statuses)) statuses <- list()
  if (nzchar(base_name)) {
    current <- statuses[[base_name]]
    if (is.null(current) || !is.list(current)) current <- list()
    current$graficos_ppt_ok <- FALSE
    current$graficos_word_ok <- FALSE
    statuses[[base_name]] <- current
    session_set(sid, "graficos_status_por_base", statuses)
  }
  session_set(sid, "graficos_ppt_ok", FALSE)
  session_set(sid, "graficos_word_ok", FALSE)
  session_set(sid, "graficos_preview_cache", list())
  invisible(TRUE)
}

.graficos_share_plan_for_base <- function(sid, cfg, base_name, source_var_map) {
  cfg <- .graficos_normalize_config(cfg, sid = sid, include_legacy_aliases = FALSE)
  slides <- .normalize_plan(cfg$plan)$slides %||% list()
  inst_sources <- .graficos_all_inst_sources(sid)
  vars <- .graficos_extract_vars_from_inst(inst_sources[[base_name]])
  target_map <- .graficos_share_var_map(vars)
  target_keys <- names(target_map)

  kept <- list()
  skipped <- list()
  missing_total <- list()
  for (i in seq_along(slides)) {
    slide <- slides[[i]]
    refs <- .graficos_share_slide_refs(slide)
    ref_keys <- vapply(refs, .graficos_share_var_key, character(1))
    missing_keys <- unique(ref_keys[nzchar(ref_keys) & !(ref_keys %in% target_keys)])
    if (length(missing_keys)) {
      missing_vars <- lapply(missing_keys, function(key) {
        src <- source_var_map[[key]] %||% list(name = key, label = key)
        item <- list(
          code = as.character(src$name %||% key),
          label = as.character(src$label %||% src$name %||% key)
        )
        missing_total[[key]] <<- item
        item
      })
      skipped[[length(skipped) + 1L]] <- list(
        slide_id = as.character(slide$id %||% ""),
        slide_title = .graficos_share_slide_title(slide, i),
        tipo = as.character(slide$tipo %||% ""),
        missing_variables = missing_vars
      )
    } else {
      kept[[length(kept) + 1L]] <- .graficos_share_adapt_slide(slide)
    }
  }

  cfg$plan <- list(slides = kept)
  ids <- vapply(kept, function(slide) as.character(slide$id %||% ""), character(1))
  if (is.null(cfg$selected_slide_id) || !(as.character(cfg$selected_slide_id) %in% ids)) {
    cfg$selected_slide_id <- ids[1] %||% NULL
  }
  cfg <- .graficos_normalize_config(cfg, sid = sid, include_legacy_aliases = FALSE)

  list(
    config = cfg,
    vars = vars,
    n_expected_variables = length(unique(vapply(.graficos_share_source_vars_from_map(source_var_map), .graficos_share_var_key, character(1)))),
    n_available_variables = length(intersect(names(source_var_map), target_keys)),
    n_missing_variables = length(missing_total),
    missing_variables = unname(missing_total),
    n_slides_total = length(slides),
    n_slides_applicable = length(kept),
    n_slides_skipped = length(skipped),
    skipped_slides = skipped,
    blocking = length(kept) == 0L && length(slides) > 0L
  )
}

.graficos_share_source_vars_from_map <- function(source_var_map) {
  if (!is.list(source_var_map)) return(list())
  unname(source_var_map)
}

.graficos_share_inspect_meta <- function(sid, package_meta) {
  pkg <- .graficos_share_read_package(package_meta$path)
  manifest <- pkg$manifest
  source_var_map <- .graficos_share_var_map(manifest$variables %||% list())
  cfg <- pkg$config
  bases <- .graficos_target_base_names(sid)
  if (!length(bases)) {
    stop_api(409, "E_GRAFICOS_SHARE_NO_BASES",
             "El proyecto abierto no tiene bases con XLSForm para comparar.")
  }
  current_s <- session_get(sid)
  rows <- lapply(bases, function(base) {
    current_cfg <- .graficos_config_get_for_base(sid, base, current_s)
    current_slides <- .normalize_plan((current_cfg %||% list())$plan)$slides %||% list()
    plan <- .graficos_share_plan_for_base(sid, cfg, base, source_var_map)
    warnings <- character(0)
    if (plan$n_slides_skipped > 0L) {
      warnings <- c(warnings, sprintf(
        "%d slide%s se omitira%s por variables no disponibles.",
        plan$n_slides_skipped,
        if (plan$n_slides_skipped == 1L) "" else "s",
        if (plan$n_slides_skipped == 1L) "" else "n"
      ))
    }
    if (isTRUE(plan$blocking)) {
      warnings <- c(warnings, "Ningun slide del paquete es aplicable a esta base.")
    }
    list(
      base_name = base,
      base_label = .graficos_base_label(sid, base),
      action = "replace_graficos_plan",
      selected_default = !isTRUE(plan$blocking),
      blocking = isTRUE(plan$blocking),
      current = list(
        n_slides = length(current_slides),
        xlsform = "preservado",
        data = "preservada"
      ),
      incoming = list(
        n_slides_total = plan$n_slides_total,
        n_slides_applicable = plan$n_slides_applicable,
        n_slides_skipped = plan$n_slides_skipped
      ),
      impact = list(
        variables_expected = length(source_var_map),
        variables_available = plan$n_available_variables,
        variables_missing = plan$n_missing_variables,
        missing_variables = plan$missing_variables,
        skipped_slides = plan$skipped_slides,
        effects = c(
          "Se conserva XLSForm",
          "Se conserva la base de datos",
          "Se reemplaza el plan de Graficos",
          "Se deben regenerar PPT/Word"
        )
      ),
      warnings = as.list(warnings)
    )
  })
  n_blocking <- sum(vapply(rows, function(x) isTRUE(x$blocking), logical(1)))
  n_warnings <- sum(vapply(rows, function(x) length(x$warnings %||% list()) + length((x$impact %||% list())$missing_variables %||% list()), integer(1)))
  list(
    ok = TRUE,
    package_file_id = package_meta$file_id,
    filename = package_meta$original_name,
    manifest = list(
      version = manifest$version %||% "",
      source_project_name = manifest$source_project_name %||% "",
      source_active_base = manifest$source_active_base %||% "",
      created_at = manifest$created_at %||% "",
      n_slides = as.integer(manifest$n_slides %||% length(.normalize_plan(cfg$plan)$slides %||% list())),
      n_assets = as.integer(manifest$n_assets %||% length(manifest$assets %||% list()))
    ),
    summary = list(
      n_bases = length(rows),
      n_compatible = length(rows) - n_blocking,
      n_blocking = n_blocking,
      n_warnings = n_warnings
    ),
    default_selected_bases = as.list(vapply(rows, function(x) if (isTRUE(x$selected_default)) x$base_name else NA_character_, character(1))[vapply(rows, function(x) isTRUE(x$selected_default), logical(1))]),
    bases = rows
  )
}

.graficos_share_inspect <- function(sid, file_id = NULL, filename = NULL, data_base64 = NULL) {
  if (!is.null(file_id) && nzchar(as.character(file_id))) {
    meta <- get_file(sid, as.character(file_id))
  } else {
    meta <- .graficos_share_decode_to_file(sid, filename, data_base64)
  }
  .graficos_share_inspect_meta(sid, meta)
}

.graficos_share_materialize_assets <- function(sid, package_meta) {
  pkg <- .graficos_share_read_package(package_meta$path, keep_stage = TRUE)
  on.exit(unlink(pkg$stage, recursive = TRUE, force = TRUE), add = TRUE)
  manifest <- pkg$manifest
  assets <- manifest$assets %||% list()
  remap <- list()
  if (!length(assets)) return(list(remap = remap, config = pkg$config, manifest = manifest))

  icons_dir <- file.path(session_get(sid)$dir, "icons")
  dir.create(icons_dir, recursive = TRUE, showWarnings = FALSE)
  for (asset in assets) {
    asset <- as.list(asset)
    if (!identical(as.character(asset$kind %||% ""), "graficos_icon")) next
    rel <- as.character(asset$path %||% "")
    old_file_id <- as.character(asset$old_file_id %||% "")
    src <- file.path(pkg$stage, rel)
    if (!nzchar(old_file_id) || !file.exists(src)) next
    ext <- tolower(as.character(asset$ext %||% tools::file_ext(src) %||% "png"))
    if (!nzchar(ext)) ext <- "png"
    dest <- file.path(icons_dir, paste0(uuid::UUIDgenerate(), ".", ext))
    file.copy(src, dest, overwrite = TRUE)
    meta <- .register_output_file(
      sid,
      "graficos_icon",
      dest,
      original_name = as.character(asset$original_name %||% basename(dest))
    )
    remap[[old_file_id]] <- meta$file_id
  }
  list(remap = remap, config = pkg$config, manifest = manifest)
}

.graficos_share_apply_asset_remap <- function(cfg, remap) {
  if (!length(remap)) return(cfg)
  iconos <- cfg$iconos %||% list()
  if (is.list(iconos) && length(iconos)) {
    cfg$iconos <- lapply(iconos, function(ico) {
      ico <- as.list(ico)
      old <- as.character(ico$file_id %||% "")
      if (nzchar(old) && !is.null(remap[[old]])) ico$file_id <- remap[[old]]
      ico$path <- NULL
      ico
    })
  }
  cfg
}

.graficos_share_import <- function(sid, file_id, selected_bases = NULL) {
  meta <- get_file(sid, as.character(file_id))
  inspection <- .graficos_share_inspect_meta(sid, meta)
  selected_bases <- selected_bases %||% inspection$default_selected_bases
  selected_bases <- unique(trimws(as.character(unlist(selected_bases, use.names = FALSE))))
  selected_bases <- selected_bases[nzchar(selected_bases)]
  if (!length(selected_bases)) {
    stop_api(400, "E_GRAFICOS_SHARE_NO_SELECTION", "Selecciona al menos una base compatible.")
  }
  rows_by_base <- setNames(inspection$bases, vapply(inspection$bases, function(x) x$base_name, character(1)))
  unknown <- setdiff(selected_bases, names(rows_by_base))
  if (length(unknown)) {
    stop_api(404, "E_GRAFICOS_SHARE_BASE_UNKNOWN",
             sprintf("Base no encontrada en el plan de importacion: %s", paste(unknown, collapse = ", ")))
  }
  blocked <- selected_bases[vapply(selected_bases, function(b) isTRUE(rows_by_base[[b]]$blocking), logical(1))]
  if (length(blocked)) {
    stop_api(409, "E_GRAFICOS_SHARE_BLOCKED",
             sprintf("Estas bases no tienen slides aplicables: %s", paste(blocked, collapse = ", ")))
  }

  materialized <- .graficos_share_materialize_assets(sid, meta)
  manifest <- materialized$manifest
  source_var_map <- .graficos_share_var_map(manifest$variables %||% list())
  base_cfg <- .graficos_share_apply_asset_remap(
    .graficos_normalize_config(materialized$config, sid = sid, include_legacy_aliases = FALSE),
    materialized$remap
  )

  applied <- list()
  for (base in selected_bases) {
    planned <- .graficos_share_plan_for_base(sid, base_cfg, base, source_var_map)
    cfg <- planned$config
    .graficos_config_set_for_base(sid, base, cfg)
    .graficos_status_invalidate_for_base(sid, base)
    applied[[length(applied) + 1L]] <- list(
      base_name = base,
      n_slides_applicable = planned$n_slides_applicable,
      n_slides_skipped = planned$n_slides_skipped,
      missing_variables = planned$missing_variables,
      skipped_slides = planned$skipped_slides
    )
  }

  snapshot <- list(
    version = 1L,
    kind = "graficos_share_snapshot",
    imported_at = .graficos_now_utc(),
    package_file_id = meta$file_id,
    package_filename = meta$original_name,
    package_manifest = inspection$manifest,
    selected_bases = as.list(selected_bases),
    applied = applied,
    inspection_summary = inspection$summary
  )
  session_set(sid, "graficos_share_snapshot", snapshot)

  list(
    ok = TRUE,
    imported_at = snapshot$imported_at,
    applied_bases = applied,
    inspection = inspection
  )
}
