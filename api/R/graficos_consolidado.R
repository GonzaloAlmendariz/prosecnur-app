# Un unico PPT multifuente para bases hermanas independientes aprobadas.

.GRAFICOS_CONSOLIDADO_SCHEMA <- "graficos_consolidado/v1"
.GRAFICOS_CONSOLIDADO_MANIFEST_SCHEMA <- "graficos_consolidado_manifest/v1"

.graficos_consolidado_sources <- function(sid, source_order = NULL) {
  src <- list(
    data_sources = estudio_data_sources(sid),
    inst_sources = estudio_inst_sources(sid)
  )
  valid <- .graficos_filter_valid_sources(src$data_sources, src$inst_sources)
  src <- .graficos_repeat_enrich_sources(sid, valid)
  if (exists(".bases_normalize_source_contexts", mode = "function")) {
    src <- .bases_normalize_source_contexts(src$data_sources, src$inst_sources)
  }
  src <- .graficos_align_recoded_dummy_sources(src)
  src <- .graficos_apply_orden_categorias_sources(sid, src)
  common <- intersect(names(src$data_sources), names(src$inst_sources))
  if (!is.null(source_order)) common <- source_order[source_order %in% common]
  list(data_sources = src$data_sources[common], inst_sources = src$inst_sources[common])
}

.graficos_consolidado_release_pins <- function(catalog) {
  unname(lapply(catalog$entries %||% list(), function(entry) {
    pins <- entry$pins %||% list()
    provenance <- pins$provenance %||% list()
    trace <- provenance$traceability %||% list()
    list(
      base = entry$base,
      actor = entry$actor,
      processing_intake_entry_id = entry$entry_id,
      release_id = (entry$release %||% list())$release_id %||% "",
      input_fingerprint = entry$input_fingerprint,
      instrument_revision_id = entry$instrument_revision_id,
      n_rows = (pins$sample %||% list())$n_rows %||% 0L,
      weighting_sha256 = (pins$sample %||% list())$weighting_sha256 %||% "",
      provenance_sha256 = pins$provenance_sha256 %||% "",
      methodology_sha256 = (pins$methodology %||% list())$policy_sha256 %||% "",
      cut = list(
        batch_fingerprint = provenance$batch_fingerprint %||% "",
        snapshot_synced_at = trace$snapshot_synced_at %||% "",
        snapshot_sha256 = trace$snapshot_hash %||% "",
        selection_sha256 = trace$selection_sha256 %||% ""
      )
    )
  }))
}

.graficos_consolidado_methodology_rules <- function(catalog) {
  rules <- list()
  for (entry in catalog$entries %||% list()) {
    source <- .graficos_scalar_chr(entry$base, "")
    policy <- (entry$pins %||% list())$methodology %||% list()
    if (!nzchar(source) || !isTRUE(policy$configured)) next
    defaults <- policy$ppt_plan_defaults %||% list()
    denominators <- policy$denominator_rules %||% list()
    variables <- unique(c(names(defaults), names(denominators)))
    variables <- variables[!is.na(variables) & nzchar(variables)]
    for (variable in variables) {
      ppt <- defaults[[variable]] %||% list()
      denominator <- denominators[[variable]] %||% list()
      exclusions <- unique(c(
        .graficos_collect_strings(ppt$excluir_opciones %||% NULL),
        .graficos_collect_strings(denominator$exclude_codes %||% NULL)
      ))
      rules[[length(rules) + 1L]] <- list(
        source = source,
        variable = variable,
        ref = paste(source, variable, sep = "$"),
        exclusions = as.list(exclusions),
        eligible_if = .graficos_scalar_chr(denominator$eligible_if, ""),
        exclude_empty = isTRUE(denominator$exclude_empty),
        zero_denominator = .graficos_scalar_chr(denominator$zero_denominator, "")
      )
    }
  }
  rules
}

.graficos_consolidado_parse_eligibility <- function(expression) {
  expression <- .graficos_scalar_chr(expression, "")
  if (!nzchar(expression)) return(NULL)
  match <- regexec(
    "^\\s*\\$\\{([^}]+)\\}\\s*={1,2}\\s*['\"]([^'\"]+)['\"]\\s*$",
    expression,
    perl = TRUE
  )
  parts <- regmatches(expression, match)[[1]]
  if (length(parts) != 3L) return(NULL)
  list(variable = trimws(parts[[2]]), value = parts[[3]])
}

.graficos_consolidado_apply_methodology <- function(plan, rules) {
  warnings <- character(0)
  slides <- (plan %||% list())$slides %||% list()
  supported <- c("p_barras_agrupadas", "p_barras_apiladas")
  for (slide_idx in seq_along(slides)) {
    payload <- (slides[[slide_idx]] %||% list())$payload %||% list()
    for (key in names(payload)) {
      graph <- payload[[key]]
      if (!is.list(graph) || is.null(graph$graficador)) next
      args <- graph$args %||% list()
      refs <- .graficos_collect_refs_from_args(args)
      matched <- Filter(function(rule) rule$ref %in% refs, rules)
      if (!length(matched)) next
      exclusions <- unique(unlist(lapply(matched, `[[`, "exclusions"), use.names = FALSE))
      exclusions <- exclusions[!is.na(exclusions) & nzchar(exclusions)]
      graph_type <- .graficos_scalar_chr(graph$graficador, "")
      if (length(exclusions) && graph_type %in% supported) {
        args$excluir_opciones <- unique(c(
          .graficos_collect_strings(args$excluir_opciones %||% NULL),
          exclusions
        ))
      } else if (length(exclusions) && identical(graph_type, "p_barras_multiapiladas")) {
        args$overrides <- args$overrides %||% list()
        args$overrides$excluir_opciones <- unique(c(
          .graficos_collect_strings(args$overrides$excluir_opciones %||% NULL),
          exclusions
        ))
      } else if (length(exclusions)) {
        warnings <- c(warnings, sprintf(
          "methodology_exclusion_not_applied: %s no admite exclusiones automaticas (%s).",
          graph_type,
          paste(vapply(matched, `[[`, character(1), "ref"), collapse = ", ")
        ))
      }

      if (length(refs) == 1L && length(matched) == 1L) {
        eligibility <- .graficos_consolidado_parse_eligibility(matched[[1]]$eligible_if)
        if (!is.null(eligibility)) {
          args$filtros <- args$filtros %||% list()
          existing <- args$filtros[[eligibility$variable]] %||% NULL
          if (is.null(existing) || identical(as.character(existing), eligibility$value)) {
            args$filtros[[eligibility$variable]] <- eligibility$value
          } else {
            warnings <- c(warnings, sprintf(
              "methodology_eligibility_conflict: %s ya tiene otro filtro para %s.",
              matched[[1]]$ref,
              eligibility$variable
            ))
          }
        } else if (nzchar(matched[[1]]$eligible_if)) {
          warnings <- c(warnings, sprintf(
            "methodology_eligibility_unparsed: no se pudo aplicar '%s' a %s.",
            matched[[1]]$eligible_if,
            matched[[1]]$ref
          ))
        }
      } else if (any(vapply(matched, function(rule) nzchar(rule$eligible_if), logical(1)))) {
        warnings <- c(warnings, sprintf(
          "methodology_eligibility_not_applied: el grafico combina referencias con reglas distintas (%s).",
          paste(vapply(matched, `[[`, character(1), "ref"), collapse = ", ")
        ))
      }
      graph$args <- args
      payload[[key]] <- graph
    }
    slides[[slide_idx]]$payload <- payload
  }
  plan$slides <- slides
  list(plan = plan, warnings = unique(warnings))
}

.graficos_consolidado_denominator_warnings <- function(sources, rules) {
  warnings <- character(0)
  for (rule in rules) {
    if (!identical(rule$zero_denominator, "report_na_with_warning")) next
    data <- (sources$data_sources %||% list())[[rule$source]] %||% NULL
    if (!is.data.frame(data) || !rule$variable %in% names(data)) next
    eligible <- rep(TRUE, nrow(data))
    parsed <- .graficos_consolidado_parse_eligibility(rule$eligible_if)
    if (!is.null(parsed)) {
      if (!parsed$variable %in% names(data)) next
      values <- trimws(as.character(data[[parsed$variable]]))
      eligible <- !is.na(values) & values == parsed$value
    } else if (nzchar(rule$eligible_if)) {
      next
    }
    values <- trimws(as.character(data[[rule$variable]]))
    valid <- eligible & !is.na(values)
    if (isTRUE(rule$exclude_empty)) valid <- valid & nzchar(values)
    excluded <- .graficos_norm_text_key(unlist(rule$exclusions, use.names = FALSE))
    if (length(excluded)) valid <- valid & !.graficos_norm_text_key(values) %in% excluded
    valid[is.na(valid)] <- FALSE
    if (!any(valid)) {
      warnings <- c(warnings, sprintf(
        "methodology_zero_denominator: %s no tiene casos validos despues de elegibilidad y exclusiones; reportar NA.",
        rule$ref
      ))
    }
  }
  unique(warnings)
}

.graficos_consolidado_validate_refs <- function(plan, source_names) {
  refs <- .graficos_collect_plan_refs(plan)
  blockers <- list()
  if (length(source_names) > 1L) {
    unqualified <- refs[!grepl("^[^$]+\\$[^$]+$", refs)]
    if (length(unqualified)) {
      blockers[[length(blockers) + 1L]] <- list(
        code = "unqualified_multisource_reference",
        message = "Toda variable del consolidado debe indicar actor$variable.",
        refs = as.list(unqualified)
      )
    }
  }
  parts <- lapply(refs, .graficos_ref_parts)
  unknown <- refs[vapply(parts, function(part) nzchar(part$source) && !part$source %in% source_names, logical(1))]
  if (length(unknown)) {
    blockers[[length(blockers) + 1L]] <- list(
      code = "unknown_multisource_reference",
      message = "El plan referencia una fuente que no pertenece a las releases aprobadas.",
      refs = as.list(unknown)
    )
  }
  blockers
}

.graficos_consolidado_comparison_slide_count <- function(plan) {
  slides <- (plan %||% list())$slides %||% list()
  as.integer(sum(vapply(slides, function(slide) {
    payload <- (slide %||% list())$payload %||% list()
    any(vapply(payload, function(value) {
      is.list(value) &&
        identical(.graficos_scalar_chr(value$graficador, ""), "p_barras_multiapiladas") &&
        identical(.graficos_scalar_chr((value$args %||% list())$modo, ""), "var_cruce")
    }, logical(1)))
  }, logical(1))))
}

graficos_consolidado_preflight <- function(sid, config = NULL) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) stop_api(404, "E_NO_SESSION", "Sin sesion.")
  # Algunos helpers historicos de cobertura inicializan defaults de Hojas de
  # Ruta. El consolidado promete preflight puro, por lo que restauramos el
  # snapshot completo aun si una validacion intermedia falla.
  state_before <- s
  on.exit({ .session_env[[sid]] <- state_before }, add = TRUE)
  active_before <- (s$estudio %||% list())$active_base %||% NULL
  catalog <- .processing_release_catalog(s)
  blockers <- list()
  if (!isTRUE(catalog$detected) || length(catalog$entries) < 2L) {
    blockers[[length(blockers) + 1L]] <- list(
      code = "independent_releases_missing",
      message = "El consolidado requiere al menos dos bases hermanas independientes."
    )
  }
  not_approved <- Filter(function(entry) !isTRUE(entry$approved), catalog$entries %||% list())
  if (length(not_approved)) {
    blockers[[length(blockers) + 1L]] <- list(
      code = "processing_release_not_approved",
      message = "Todas las bases deben tener una release aprobada y vigente.",
      bases = as.list(vapply(not_approved, `[[`, character(1), "base"))
    )
  }
  source_order <- vapply(catalog$entries %||% list(), `[[`, character(1), "base")
  sources <- .graficos_consolidado_sources(sid, source_order)
  if (!setequal(names(sources$data_sources), source_order) ||
      !identical(names(sources$data_sources), names(sources$inst_sources))) {
    blockers[[length(blockers) + 1L]] <- list(
      code = "approved_source_unavailable",
      message = "No todas las fuentes aprobadas estan disponibles para render."
    )
  }

  cfg <- config %||% list()
  cfg$multi_actor_comparisons <- TRUE
  suggested <- .graficos_suggested_plan(sid, config = cfg)
  methodology_rules <- .graficos_consolidado_methodology_rules(catalog)
  methodology <- .graficos_consolidado_apply_methodology(
    suggested$plan %||% list(),
    methodology_rules
  )
  plan <- .normalize_plan(methodology$plan %||% list())
  validation <- .validar_plan_json(plan)
  if (!isTRUE(validation$ok)) {
    blockers[[length(blockers) + 1L]] <- list(
      code = "invalid_consolidated_plan",
      message = paste(validation$errors, collapse = "; ")
    )
  }
  blockers <- c(blockers, .graficos_consolidado_validate_refs(plan, source_order))
  release_pins <- .graficos_consolidado_release_pins(catalog)
  plan_sha256 <- .processing_release_hash(plan)
  input_fingerprint <- .processing_release_hash(list(
    schema = .GRAFICOS_CONSOLIDADO_SCHEMA,
    releases = release_pins,
    source_order = source_order,
    plan_sha256 = plan_sha256,
    config = cfg
  ))
  current <- session_get(sid)
  if (!identical((current$estudio %||% list())$active_base %||% NULL, active_before)) {
    stop_api(500, "E_GRAFICOS_CONSOLIDADO_SCOPE", "El preflight altero la base activa.")
  }
  list(
    ok = TRUE,
    schema = .GRAFICOS_CONSOLIDADO_SCHEMA,
    ready = !length(blockers),
    blockers = blockers,
    source_order = as.list(source_order),
    releases = release_pins,
    plan = plan,
    plan_sha256 = plan_sha256,
    input_fingerprint = input_fingerprint,
    n_slides = as.integer(length(plan$slides %||% list())),
    n_comparison_slides = .graficos_consolidado_comparison_slide_count(plan),
    warnings = as.list(unique(c(
      unlist(suggested$warnings %||% list(), use.names = FALSE),
      methodology$warnings,
      .graficos_consolidado_denominator_warnings(sources, methodology_rules)
    ))),
    config = cfg,
    sources = sources
  )
}

graficos_consolidado_job_runner <- function(data_path, inst_path, recipe_path,
                                             template_pptx, result_path,
                                             progress_path = NULL) {
  .pkg_fn <- function(name) get(name, envir = asNamespace("prosecnurapp"), inherits = FALSE)
  report <- .pkg_fn("job_progress_writer")(progress_path)
  recipe <- readRDS(recipe_path)
  data_sources <- readRDS(data_path)
  inst_sources <- readRDS(inst_path)
  report("loading", percent = 5, message = "Cargando releases aprobadas...")
  icon_registry <- recipe$icon_registry %||% list()
  slides <- recipe$plan$slides %||% list()
  rebuilt <- vector("list", length(slides))
  for (i in seq_along(slides)) {
    report("rebuild", current = i, total = length(slides), percent = 8 + round(42 * i / max(1, length(slides))), message = sprintf("Armando slide %s de %s...", i, length(slides)))
    rebuilt[[i]] <- .pkg_fn(".graficos_rebuild_slide_json")(
      slides[[i]], icon_registry = icon_registry
    )
  }
  report("render", percent = 58, message = "Renderizando el PPT consolidado...")
  palette_env <- .pkg_fn(".graficos_palette_env")(recipe$paletas %||% list(), parent = parent.frame())
  presets <- .pkg_fn(".build_presets")(recipe$presets %||% list())
  .pkg_fn("reporte_ppt_plan")(
    data = data_sources,
    instrumento = inst_sources,
    path_ppt = result_path,
    presets = presets,
    plan = do.call(.pkg_fn("p_plan"), list(slides = rebuilt)),
    env_diapos = palette_env,
    template_pptx = template_pptx,
    auto_otros_slides = recipe$auto_otros_slides,
    mensajes_progreso = FALSE
  )
  report("export", percent = 96, message = "Registrando PPT y procedencia...")
  list(
    path = result_path,
    n_slides = as.integer(length(rebuilt)),
    recipe_fingerprint = recipe$input_fingerprint,
    releases = recipe$releases,
    source_order = recipe$source_order,
    plan_sha256 = recipe$plan_sha256
  )
}
attr(graficos_consolidado_job_runner, "prosecnur_job_function_name") <- "graficos_consolidado_job_runner"

.graficos_consolidado_register_artifacts <- function(sid, result_path, result_data) {
  ppt_sha <- tolower(digest::digest(file = result_path, algo = "sha256"))
  ppt_meta <- .register_output_file(sid, "graficos_ppt_consolidado", result_path)
  manifest <- list(
    schema = .GRAFICOS_CONSOLIDADO_MANIFEST_SCHEMA,
    role = "manifest",
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    artifact = list(file_id = ppt_meta$file_id, filename = ppt_meta$original_name, sha256 = ppt_sha),
    n_slides = result_data$n_slides,
    recipe_fingerprint = result_data$recipe_fingerprint,
    plan_sha256 = result_data$plan_sha256,
    source_order = result_data$source_order,
    releases = result_data$releases
  )
  manifest_path <- file.path(dirname(result_path), paste0(tools::file_path_sans_ext(basename(result_path)), "_manifest.json"))
  jsonlite::write_json(manifest, manifest_path, auto_unbox = TRUE, pretty = TRUE, null = "null")
  manifest_sha <- tolower(digest::digest(file = manifest_path, algo = "sha256"))
  manifest_meta <- .register_output_file(sid, "graficos_ppt_consolidado_manifest", manifest_path)
  s <- session_get(sid)
  s$files[[ppt_meta$file_id]]$sha256 <- ppt_sha
  s$files[[ppt_meta$file_id]]$role <- "deliverable"
  s$files[[manifest_meta$file_id]]$sha256 <- manifest_sha
  s$files[[manifest_meta$file_id]]$role <- "manifest"
  .session_env[[sid]] <- s
  list(
    ok = TRUE,
    file_id = ppt_meta$file_id,
    filename = ppt_meta$original_name,
    size = ppt_meta$size,
    n_slides = result_data$n_slides,
    manifest_file_id = manifest_meta$file_id,
    artifacts = list(
      list(role = "deliverable", file_id = ppt_meta$file_id, sha256 = ppt_sha),
      list(role = "manifest", file_id = manifest_meta$file_id, sha256 = manifest_sha)
    )
  )
}

graficos_consolidado_start <- function(sid, config = NULL, presets = NULL) {
  preflight <- graficos_consolidado_preflight(sid, config = config)
  if (!isTRUE(preflight$ready)) {
    stop_api(422, "E_GRAFICOS_CONSOLIDADO_NOT_READY", "El consolidado tiene bloqueantes.", details = list(blockers = preflight$blockers))
  }
  s <- session_get(sid)
  delivery <- .graficos_delivery_options(preflight$config)
  template <- .graficos_resolve_template_pptx(
    config = preflight$config,
    profile_id = delivery$profile_id,
    template_id = delivery$template_id
  )
  enriched_presets <- .enriquecer_presets(presets %||% preflight$config$presets %||% list(), preflight$config$debug_ph)
  recipe <- list(
    schema = .GRAFICOS_CONSOLIDADO_SCHEMA,
    revision = as.integer(((s$graficos_consolidado %||% list())$revision %||% 0L) + 1L),
    input_fingerprint = preflight$input_fingerprint,
    plan_sha256 = preflight$plan_sha256,
    plan = preflight$plan,
    source_order = preflight$source_order,
    releases = preflight$releases,
    config = preflight$config,
    presets = enriched_presets,
    paletas = preflight$config$paletas %||% list(),
    icon_registry = .graficos_icon_registry(sid, preflight$config),
    auto_otros_slides = delivery$auto_otros_slides,
    updated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  )
  next_state <- s
  next_state$graficos_consolidado <- recipe
  next_state <- .mark_project_dirty(next_state)
  .session_env[[sid]] <- next_state

  sources <- preflight$sources
  data_path <- job_save_rds(sid, "graficos_consolidado_data", sources$data_sources)
  inst_path <- job_save_rds(sid, "graficos_consolidado_inst", sources$inst_sources)
  recipe_path <- job_save_rds(sid, "graficos_consolidado_recipe", recipe)
  job_id <- job_submit(
    sid = sid,
    kind = "graficos.ppt_consolidado",
    func = graficos_consolidado_job_runner,
    args = list(
      data_path = data_path,
      inst_path = inst_path,
      recipe_path = recipe_path,
      template_pptx = template
    ),
    result_filename = .export_filename(sid, "informe_consolidado", "pptx"),
    on_complete = function(job) {
      .graficos_consolidado_register_artifacts(job$sid, job$result_path, job$result_data)
    }
  )
  list(ok = TRUE, job_id = job_id, kind = "graficos.ppt_consolidado", input_fingerprint = recipe$input_fingerprint)
}
