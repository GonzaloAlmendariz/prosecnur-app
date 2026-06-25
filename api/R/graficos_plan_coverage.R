# Inventario, cobertura y sugerencia automatica para planes de Graficos.
#
# Mantener esta logica fuera del router permite reutilizarla desde la UI,
# tests y flujos futuros de exportacion sin acoplarla a PPT o Word.

.graficos_scalar_chr <- function(x, default = "") {
  if (is.null(x) || !length(x)) return(default)
  out <- as.character(x[[1]] %||% default)
  if (is.na(out)) default else trimws(out)
}

.graficos_base_type <- function(x) {
  x <- tolower(trimws(.graficos_scalar_chr(x, "")))
  sub("\\s+.*$", "", x)
}

.graficos_norm_text_key <- function(x) {
  out <- iconv(enc2utf8(as.character(x %||% "")), to = "ASCII//TRANSLIT")
  out <- tolower(trimws(out))
  out <- gsub("[^a-z0-9]+", "_", out)
  gsub("^_+|_+$", "", out)
}

.graficos_is_blank_cell <- function(x) {
  if (is.null(x)) return(TRUE)
  if (length(x) == 0L) return(TRUE)
  if (is.logical(x)) return(is.na(x))
  if (is.numeric(x)) return(is.na(x))
  txt <- trimws(as.character(x))
  is.na(txt) | !nzchar(txt)
}

.graficos_var_non_empty_n <- function(data, var) {
  if (is.null(data) || !is.data.frame(data) || !nzchar(var) || !(var %in% names(data))) {
    return(0L)
  }
  x <- data[[var]]
  sum(!.graficos_is_blank_cell(x))
}

.graficos_var_has_data <- function(data, var) {
  .graficos_var_non_empty_n(data, var) > 0L
}

.graficos_is_recoded_var <- function(name) {
  grepl("(^|_)recod$", .graficos_scalar_chr(name, ""), ignore.case = TRUE)
}

.graficos_raw_name_for_recod <- function(name) {
  sub("(^|_)recod$", "", .graficos_scalar_chr(name, ""), ignore.case = TRUE)
}

.graficos_other_parent_candidates <- function(name) {
  nm <- .graficos_scalar_chr(name, "")
  candidates <- c(
    sub("(_other|_otros|_otro|_specify|_especifique)$", "", nm, ignore.case = TRUE),
    sub("(other|otros|otro)$", "", nm, ignore.case = TRUE)
  )
  unique(candidates[nzchar(candidates) & candidates != nm])
}

.graficos_is_open_child_var <- function(name) {
  grepl("(_other|_otros|_otro|_specify|_especifique)$|(^|_)other$", .graficos_scalar_chr(name, ""),
        ignore.case = TRUE)
}

.graficos_source_kind_map <- function(sid) {
  s <- session_get(sid, required = FALSE)
  bases <- (s$estudio %||% list())$bases %||% list()
  if (!is.list(bases) || !length(bases)) return(list())
  out <- list()
  for (nm in names(bases)) {
    meta <- bases[[nm]] %||% list()
    out[[nm]] <- .graficos_scalar_chr(meta$source_kind %||% meta$kind %||% "", "")
  }
  out
}

.graficos_all_data_sources <- function(sid) {
  if (exists(".pulso_rebuild_estudio_runtime_sources", mode = "function")) {
    tryCatch(.pulso_rebuild_estudio_runtime_sources(sid), error = function(e) FALSE)
  }
  out <- tryCatch(estudio_data_sources(sid), error = function(e) list())
  out <- .graficos_named_source_list(out)
  if (length(out)) return(out)
  s <- session_get(sid, required = FALSE)
  if (!is.null(s$rp_data_sources)) {
    out <- .graficos_named_source_list(s$rp_data_sources)
    if (length(out)) return(out)
  }
  if (!is.null(s$rp_data) && is.data.frame(s$rp_data)) return(list(default = s$rp_data))
  list()
}

.graficos_simplify_source_kind <- function(kind) {
  kind <- tolower(.graficos_scalar_chr(kind, ""))
  if (!nzchar(kind)) return("unknown")
  if (startsWith(kind, "surveymonkey")) return("surveymonkey")
  if (startsWith(kind, "kobo")) return("kobo")
  if (kind %in% c("manual", "xlsform", "existing_project", "uploaded", "local")) return("xlsform")
  kind
}

.graficos_group_path_for_row <- function(survey, i) {
  for (col in c("group_path", "path", "group_label", "group_name", "seccion", "section")) {
    if (col %in% names(survey)) {
      val <- .graficos_scalar_chr(survey[[col]][i], "")
      if (nzchar(val)) return(val)
    }
  }
  ""
}

.graficos_section_looks_like_page <- function(section) {
  key <- .graficos_norm_text_key(section)
  !nzchar(key) ||
    grepl("^(page|pagina|pag|section|seccion|grupo|group)(_?[0-9]+)?$", key) ||
    grepl("^(page|pagina|pag|section|seccion|grupo|group)_[0-9]+$", key)
}

.graficos_section_is_reliable <- function(section, source_kind) {
  simplified <- .graficos_simplify_source_kind(source_kind)
  if (identical(simplified, "surveymonkey")) return(FALSE)
  if (!nzchar(.graficos_scalar_chr(section, ""))) return(FALSE)
  if (.graficos_section_looks_like_page(section)) return(FALSE)
  simplified %in% c("kobo", "xlsform") || identical(simplified, "unknown")
}

.graficos_is_identifier_like <- function(name, label = "") {
  key <- paste(.graficos_norm_text_key(name), .graficos_norm_text_key(label))
  grepl(
    paste(c(
      "\\b(id|uuid|token|codigo|code|key|llave)\\b",
      "correo|email|mail",
      "telefono|phone|celular|whatsapp",
      "\\bnombre\\b|apellidos?",
      "empresa|organizacion|institucion_de_contacto",
      "direccion|address",
      "comentario|observacion|sugerencia"
    ), collapse = "|"),
    key,
    perl = TRUE
  )
}

.graficos_graphable_reason <- function(item) {
  tipo <- .graficos_base_type(item$tipo)
  if (!isTRUE(item$data_available)) return(list(graphable = FALSE, reason = "vacía"))
  if (.graficos_is_identifier_like(item$name, item$label)) {
    return(list(graphable = FALSE, reason = "identificador/contacto/texto sensible"))
  }
  if (tipo %in% c("select_one", "select_multiple")) {
    return(list(graphable = TRUE, reason = ""))
  }
  if (.graficos_is_recoded_var(item$name) && length(item$choices %||% list()) > 0L) {
    return(list(graphable = TRUE, reason = ""))
  }
  if (tipo %in% c("text", "geopoint", "geotrace", "geoshape", "image", "audio", "video", "file", "barcode")) {
    return(list(graphable = FALSE, reason = "abierta cruda"))
  }
  list(graphable = FALSE, reason = sprintf("tipo no graficable (%s)", tipo %||% ""))
}

.graficos_finalize_var_metadata <- function(vars) {
  if (!length(vars)) return(vars)
  by_name <- stats::setNames(seq_along(vars), vapply(vars, function(v) .graficos_scalar_chr(v$name), character(1)))

  # Primero, metadata basica de graficabilidad.
  for (i in seq_along(vars)) {
    vars[[i]]$is_recoded <- .graficos_is_recoded_var(vars[[i]]$name)
    vars[[i]]$raw_parent <- if (isTRUE(vars[[i]]$is_recoded)) .graficos_raw_name_for_recod(vars[[i]]$name) else NULL
    vars[[i]]$preferred_variable <- .graficos_scalar_chr(vars[[i]]$name)
    vars[[i]]$covered_by <- NULL
    vars[[i]]$integrated_in <- NULL
    vars[[i]]$is_preferred <- TRUE

    g <- .graficos_graphable_reason(vars[[i]])
    vars[[i]]$graphable <- isTRUE(g$graphable)
    vars[[i]]$exclusion_reason <- .graficos_scalar_chr(g$reason, "")
  }

  # Si hay recodificada con datos, la original queda cubierta por ella.
  for (i in seq_along(vars)) {
    if (!isTRUE(vars[[i]]$is_recoded) || !isTRUE(vars[[i]]$graphable)) next
    parent <- .graficos_scalar_chr(vars[[i]]$raw_parent, "")
    if (!nzchar(parent) || !(parent %in% names(by_name))) next
    j <- by_name[[parent]]
    vars[[j]]$preferred_variable <- vars[[i]]$name
    vars[[j]]$covered_by <- vars[[i]]$name
    vars[[j]]$is_preferred <- FALSE
  }

  # Campos "other/otros" se consideran integrados si existe madre o madre recodificada.
  for (i in seq_along(vars)) {
    if (!.graficos_is_open_child_var(vars[[i]]$name)) next
    candidates <- .graficos_other_parent_candidates(vars[[i]]$name)
    target <- ""
    for (cand in candidates) {
      recod <- paste0(cand, "_recod")
      if (recod %in% names(by_name)) {
        target <- recod
        break
      }
      if (cand %in% names(by_name)) {
        target <- cand
        break
      }
    }
    if (nzchar(target)) {
      vars[[i]]$integrated_in <- target
      vars[[i]]$covered_by <- target
      vars[[i]]$is_preferred <- FALSE
      vars[[i]]$graphable <- FALSE
      vars[[i]]$exclusion_reason <- "integrada en otra variable"
    }
  }

  vars
}

.graficos_extract_vars_from_inst <- function(rp_inst, data = NULL, source_name = "", source_kind = "") {
  if (is.null(rp_inst)) return(list())
  survey <- rp_inst$survey
  if (is.null(survey) || !is.data.frame(survey) || !nrow(survey)) return(list())
  choices <- rp_inst$choices %||% rp_inst$choices_raw %||% NULL
  vs <- list()
  for (i in seq_len(nrow(survey))) {
    tb <- as.character(survey$type_base[i] %||% survey$type[i] %||% "")
    tb <- .graficos_base_type(tb)
    if (tb %in% .graficos_var_skip_types) next
    nm <- as.character(survey$name[i] %||% "")
    if (!nzchar(nm)) next
    list_name <- .graficos_list_name_for_row(survey, i)
    choice_meta <- .graficos_choices_for_list(choices, list_name)
    section <- as.character(survey$group_name[i] %||% "")
    group_path <- .graficos_group_path_for_row(survey, i)
    n_non_empty <- .graficos_var_non_empty_n(data, nm)
    vs[[length(vs) + 1L]] <- list(
      name = nm,
      label = as.character(survey$label[i] %||% nm),
      tipo = tb,
      seccion = section,
      list_name = list_name,
      choices = choice_meta$items,
      scale_signature = choice_meta$signature,
      data_available = n_non_empty > 0L,
      n_non_empty = n_non_empty,
      source_kind = .graficos_simplify_source_kind(source_kind),
      group_path = group_path,
      section_reliable = .graficos_section_is_reliable(group_path %||% section, source_kind)
    )
  }
  .graficos_finalize_var_metadata(vs)
}

.graficos_ref_parts <- function(ref) {
  ref <- .graficos_scalar_chr(ref, "")
  idx <- regexpr("\\$", ref, fixed = FALSE)[[1]]
  if (is.na(idx) || idx < 1L) return(list(source = "", name = ref))
  list(source = substr(ref, 1L, idx - 1L), name = substr(ref, idx + 1L, nchar(ref)))
}

.graficos_collect_strings <- function(x) {
  if (is.null(x)) return(character(0))
  if (is.character(x)) return(trimws(x[nzchar(trimws(x))]))
  if (is.atomic(x)) return(character(0))
  if (is.list(x)) return(unlist(lapply(x, .graficos_collect_strings), use.names = FALSE))
  character(0)
}

.graficos_collect_refs_from_args <- function(args) {
  if (!is.list(args)) return(character(0))
  refs <- character(0)
  for (key in intersect(names(args), c("var", "vars", "cruces", "cruce", "variable", "variables", "objetivo"))) {
    refs <- c(refs, .graficos_collect_strings(args[[key]]))
  }
  if (is.list(args$bloques)) {
    refs <- c(refs, unlist(lapply(args$bloques, .graficos_collect_refs_from_args), use.names = FALSE))
  }
  unique(refs[nzchar(refs)])
}

.graficos_collect_plan_refs <- function(plan) {
  plan <- .normalize_plan(plan)
  slides <- plan$slides %||% list()
  refs <- character(0)
  for (slide in slides) {
    payload <- .as_json_list((slide %||% list())$payload) %||% list()
    for (value in payload) {
      graf <- .as_json_list(value)
      if (is.null(graf$graficador)) next
      refs <- c(refs, .graficos_collect_refs_from_args(graf$args %||% list()))
    }
  }
  unique(refs[nzchar(refs)])
}

.graficos_coverage_exclusions <- function(config = NULL) {
  cfg <- .graficos_normalize_config(config %||% list())
  rules <- cfg$scope_rules %||% list()
  exclusions <- rules$coverage_exclusions %||% rules$coverageExclusions %||% list()
  unique(.graficos_collect_strings(exclusions))
}

.graficos_ref_matches_var <- function(ref, source, name) {
  parts <- .graficos_ref_parts(ref)
  if (nzchar(parts$source)) {
    identical(parts$source, source) && identical(parts$name, name)
  } else {
    identical(parts$name, name)
  }
}

.graficos_is_var_ref_in <- function(refs, source, name) {
  any(vapply(refs, .graficos_ref_matches_var, logical(1), source = source, name = name))
}

.graficos_var_status <- function(v, source, included_refs, exclusions) {
  name <- .graficos_scalar_chr(v$name, "")
  if (.graficos_is_var_ref_in(exclusions, source, name)) return("excluida_intencionalmente")
  if (!isTRUE(v$data_available)) return("vacía")
  if (nzchar(.graficos_scalar_chr(v$integrated_in, ""))) return("integrada_en_otra_variable")
  if (nzchar(.graficos_scalar_chr(v$covered_by, ""))) return("cubierta_por_recodificada")
  if (!isTRUE(v$graphable)) return("no_graficable")
  if (.graficos_is_var_ref_in(included_refs, source, name)) return("cubierta")
  "sin_usar"
}

.graficos_plan_coverage <- function(sid, plan = NULL, config = NULL) {
  plan <- .normalize_plan(plan %||% (.graficos_config_get(sid)$plan %||% list(slides = list())))
  cfg <- .graficos_effective_config(sid, config)
  payload <- .graficos_variables_sources_payload(sid, scoped = TRUE)
  included_refs <- .graficos_collect_plan_refs(plan)
  exclusions <- .graficos_coverage_exclusions(cfg)

  sources <- lapply(payload$sources %||% list(), function(src) {
    source_name <- .graficos_scalar_chr(src$name, "default")
    vars <- lapply(src$variables %||% list(), function(v) {
      status <- .graficos_var_status(v, source_name, included_refs, exclusions)
      countable <- isTRUE(v$graphable) && isTRUE(v$is_preferred) && status != "excluida_intencionalmente"
      c(v, list(status = status, coverage_countable = countable))
    })
    list(
      name = source_name,
      source_kind = .graficos_scalar_chr(src$source_kind, "unknown"),
      variables = vars
    )
  })

  all_vars <- unlist(lapply(sources, `[[`, "variables"), recursive = FALSE)
  count_status <- function(status) sum(vapply(all_vars, function(v) identical(v$status, status), logical(1)))
  graphable_countable <- vapply(all_vars, function(v) isTRUE(v$coverage_countable), logical(1))
  included_countable <- vapply(all_vars, function(v) isTRUE(v$coverage_countable) && identical(v$status, "cubierta"), logical(1))

  warnings <- character(0)
  if (any(vapply(sources, function(src) {
    identical(.graficos_simplify_source_kind(src$source_kind), "surveymonkey") &&
      any(vapply(src$variables, function(v) nzchar(.graficos_scalar_chr(v$seccion, "")), logical(1)))
  }, logical(1)))) {
    warnings <- c(warnings, "Se ignoraron páginas/grupos SurveyMonkey como secciones temáticas sugeridas.")
  }

  list(
    ok = TRUE,
    summary = list(
      total_variables = length(all_vars),
      graphable_variables = sum(graphable_countable),
      included_graphable = sum(included_countable),
      unused_graphable = sum(graphable_countable) - sum(included_countable),
      not_graphable = count_status("no_graficable"),
      empty = count_status("vacía"),
      covered_by_recod = count_status("cubierta_por_recodificada"),
      integrated = count_status("integrada_en_otra_variable"),
      excluded_intentionally = count_status("excluida_intencionalmente"),
      included_refs = length(included_refs)
    ),
    sources = sources,
    warnings = as.list(unique(warnings))
  )
}

.graficos_var_choice_n <- function(v) length(v$choices %||% list())

.graficos_is_ordinal_signature <- function(v) {
  n <- .graficos_var_choice_n(v)
  isTRUE(v$graphable) &&
    identical(.graficos_base_type(v$tipo), "select_one") &&
    nzchar(.graficos_scalar_chr(v$scale_signature, "")) &&
    n >= 3L && n <= 7L
}

.graficos_chart_for_var <- function(v, ref) {
  n_choices <- .graficos_var_choice_n(v)
  label <- .graficos_scalar_chr(v$label, ref)
  tipo <- .graficos_base_type(v$tipo)
  if (identical(tipo, "select_multiple")) {
    return(list(graficador = "p_barras_agrupadas", args = list(var = ref, titulo = label, mostrar_ceros = FALSE)))
  }
  if (n_choices == 2L) {
    return(list(graficador = "p_pie", args = list(var = ref, titulo = label)))
  }
  if (n_choices > 8L) {
    return(list(graficador = "p_barras_agrupadas", args = list(var = ref, titulo = label, mostrar_ceros = FALSE)))
  }
  list(graficador = "p_barras_apiladas", args = list(var = ref, titulo = label))
}

.graficos_plan_slide_id <- local({
  counter <- 0L
  function(prefix = "sug") {
    counter <<- counter + 1L
    sprintf("%s-%04d-%s", prefix, counter, paste(sample(c(letters, 0:9), 5, TRUE), collapse = ""))
  }
})

.graficos_add_section_slide <- function(slides, title) {
  title <- .graficos_scalar_chr(title, "")
  if (!nzchar(title)) return(slides)
  slides[[length(slides) + 1L]] <- list(
    id = .graficos_plan_slide_id("sec"),
    tipo = "p_slide_seccion",
    payload = list(titulo = title, subtitulo = "", introduccion_word = "")
  )
  slides
}

.graficos_pack_simple_graphs <- function(graphs, section_title = "") {
  slides <- list()
  i <- 1L
  while (i <= length(graphs)) {
    remaining <- length(graphs) - i + 1L
    if (remaining >= 2L) {
      title <- section_title
      if (!nzchar(title)) title <- "Resultados por pregunta"
      slides[[length(slides) + 1L]] <- list(
        id = .graficos_plan_slide_id("auto"),
        tipo = "p_slide_2_graficos_narrativo",
        payload = list(
          titulo = title,
          texto = "",
          izquierda = graphs[[i]]$graf,
          derecha = graphs[[i + 1L]]$graf,
          base = "",
          pie = "",
          etiqueta = ""
        )
      )
      i <- i + 2L
    } else {
      slides[[length(slides) + 1L]] <- list(
        id = .graficos_plan_slide_id("auto"),
        tipo = "p_slide_1_grafico_narrativo",
        payload = list(
          titulo = graphs[[i]]$title,
          texto = "",
          grafico = graphs[[i]]$graf,
          base = "",
          pie = "",
          etiqueta = ""
        )
      )
      i <- i + 1L
    }
  }
  slides
}

.graficos_suggested_plan <- function(sid, config = NULL) {
  cfg <- .graficos_effective_config(sid, config)
  coverage <- .graficos_plan_coverage(sid, plan = list(slides = list()), config = cfg)
  warnings <- coverage$warnings %||% list()
  slides <- list()

  for (src in coverage$sources %||% list()) {
    source <- .graficos_scalar_chr(src$name, "default")
    vars <- src$variables %||% list()
    vars <- Filter(function(v) {
      isTRUE(v$graphable) &&
        isTRUE(v$is_preferred) &&
        !identical(v$status, "excluida_intencionalmente") &&
        isTRUE(v$data_available)
    }, vars)
    if (!length(vars)) next

    section_key <- vapply(vars, function(v) {
      if (isTRUE(v$section_reliable)) {
        path <- .graficos_scalar_chr(v$group_path %||% v$seccion, "")
        if (nzchar(path)) return(path)
      }
      "Variables sugeridas"
    }, character(1))
    section_levels <- unique(section_key)

    for (section in section_levels) {
      section_vars <- vars[section_key == section]
      if (!length(section_vars)) next
      if (!identical(section, "Variables sugeridas")) {
        slides <- .graficos_add_section_slide(slides, section)
      }

      used <- rep(FALSE, length(section_vars))
      names(used) <- vapply(section_vars, function(v) .graficos_scalar_chr(v$name), character(1))

      # Baterias ordinales con misma escala: usar multi-apiladas en bloques.
      sigs <- unique(vapply(section_vars, function(v) .graficos_scalar_chr(v$scale_signature, ""), character(1)))
      for (sig in sigs[nzchar(sigs)]) {
        idx <- which(vapply(section_vars, function(v) identical(.graficos_scalar_chr(v$scale_signature, ""), sig) && .graficos_is_ordinal_signature(v), logical(1)))
        idx <- idx[!used[idx]]
        if (length(idx) < 3L) next
        chunks <- split(idx, ceiling(seq_along(idx) / 4))
        for (chunk in chunks) {
          chunk_vars <- section_vars[chunk]
          refs <- vapply(chunk_vars, function(v) {
            ref <- .graficos_scalar_chr(v$name)
            if (!identical(source, "default")) paste0(source, "$", ref) else ref
          }, character(1))
          labels <- vapply(chunk_vars, function(v) .graficos_scalar_chr(v$label, v$name), character(1))
          choices_n <- .graficos_var_choice_n(chunk_vars[[1]])
          slides[[length(slides) + 1L]] <- list(
            id = .graficos_plan_slide_id("auto"),
            tipo = "p_slide_1_grafico_narrativo",
            payload = list(
              titulo = section,
              texto = "",
              grafico = list(
                graficador = "p_barras_multiapiladas",
                args = list(
                  modo = "var",
                  vars = as.list(refs),
                  titulo = labels[[1]],
                  top2box = choices_n %in% c(4L, 5L),
                  wrap_y = 60
                )
              ),
              base = "",
              pie = "",
              etiqueta = ""
            )
          )
          used[chunk] <- TRUE
        }
      }

      simple <- list()
      for (idx in which(!used)) {
        v <- section_vars[[idx]]
        ref <- .graficos_scalar_chr(v$name)
        if (!identical(source, "default")) ref <- paste0(source, "$", ref)
        simple[[length(simple) + 1L]] <- list(
          title = .graficos_scalar_chr(v$label, ref),
          graf = .graficos_chart_for_var(v, ref)
        )
      }
      slides <- c(slides, .graficos_pack_simple_graphs(simple, section_title = if (identical(section, "Variables sugeridas")) "" else section))
    }
  }

  plan <- list(slides = slides)
  next_coverage <- .graficos_plan_coverage(sid, plan = plan, config = cfg)
  list(
    ok = TRUE,
    plan = plan,
    coverage = next_coverage,
    warnings = as.list(unique(c(
      unlist(warnings, use.names = FALSE),
      if (!length(slides)) "No se encontraron variables graficables con datos para sugerir un plan." else character(0)
    )))
  )
}
