# Ensamblador editorial ACNUR. Prepara estructura, unidades y bases por
# pregunta antes de que el plan llegue al renderer PPT.

.graficos_acnur_survey_sections <- function(survey) {
  if (!is.data.frame(survey) || !nrow(survey)) return(character(0))
  type <- as.character(survey$type %||% rep("", nrow(survey)))
  base <- if ("type_base" %in% names(survey)) as.character(survey$type_base) else type
  label <- as.character(survey$label %||% survey$name %||% rep("", nrow(survey)))
  out <- rep("", nrow(survey))
  stack <- character(0)
  for (i in seq_len(nrow(survey))) {
    kind <- .graficos_base_type(base[[i]] %||% type[[i]])
    if (kind %in% c("end_group", "end_repeat")) {
      if (length(stack)) stack <- stack[-length(stack)]
      next
    }
    if (kind %in% c("begin_group", "begin_repeat")) {
      current <- .graficos_clean_dynamic_label(label[[i]] %||% "")
      if (!nzchar(current) || .graficos_section_looks_like_page(current)) current <- ""
      current_key <- .graficos_norm_text_key(current)
      if (grepl("^(rep|repeat|roster)(_|$)", current_key, perl = TRUE)) {
        current <- .graficos_acnur_repeat_section_label(survey)
      }
      stack <- c(stack, current)
      next
    }
    visible <- stack[nzchar(stack)]
    if (length(visible)) out[[i]] <- visible[[1L]]
  }
  out
}

.graficos_acnur_number <- function(x) {
  value <- suppressWarnings(as.integer(x)[1])
  if (!is.finite(value) || is.na(value)) return(NA_character_)
  format(value, big.mark = ",", scientific = FALSE, trim = TRUE)
}

.graficos_acnur_project_name <- function(sid) {
  state <- session_get(sid, required = FALSE)
  study <- ((state %||% list())$estudio %||% list())
  name <- .graficos_scalar_chr(study$nombre, "")
  if (nzchar(name)) return(name)
  bases <- study$bases %||% list()
  principal <- Filter(function(base) {
    !nzchar(.graficos_scalar_chr((base %||% list())$parent_base, "")) &&
      !nzchar(.graficos_scalar_chr((base %||% list())$repeat_group, ""))
  }, bases)
  for (base in principal) {
    source_title <- .graficos_scalar_chr(
      (base %||% list())$source_title %||% (base %||% list())$source_alias,
      ""
    )
    if (nzchar(source_title)) return(source_title)
  }
  path <- .graficos_scalar_chr((state %||% list())$project_path, "")
  if (nzchar(path)) return(tools::file_path_sans_ext(basename(path)))
  "Resultados del estudio"
}

.graficos_acnur_period_from_dates <- function(start, end, source = "") {
  start <- .graficos_scalar_chr(start, "")
  end <- .graficos_scalar_chr(end, "")
  if (!nzchar(start) || !nzchar(end)) return(NULL)
  date_label <- function(value) {
    if (exists(".validation_operational_date_label", mode = "function")) {
      return(.validation_operational_date_label(value))
    }
    value
  }
  label_start <- date_label(start)
  label_end <- date_label(end)
  start_date <- suppressWarnings(as.Date(start))
  end_date <- suppressWarnings(as.Date(end))
  cover_label <- paste(label_start, label_end, sep = " – ")
  if (!is.na(start_date) && !is.na(end_date) &&
      identical(format(start_date, "%Y"), format(end_date, "%Y"))) {
    label_start <- sub(paste0(" ", format(start_date, "%Y"), "$"), "", label_start)
    cover_label <- paste(label_start, label_end, sep = " – ")
  }
  list(
    start = start,
    end = end,
    label = paste(date_label(start), date_label(end), sep = " – "),
    cover_label = cover_label,
    source = .graficos_scalar_chr(source, "")
  )
}

.graficos_acnur_observed_field_period <- function(sid, main_source = "") {
  sources <- .graficos_all_data_sources(sid) %||% list()
  data <- sources[[main_source]]
  if (is.null(data)) data <- data.frame()
  if (!is.data.frame(data) || !nrow(data)) return(NULL)
  state <- session_get(sid, required = FALSE)
  monitoreo <- (state %||% list())$monitoreo_config %||% list()
  territorial <- monitoreo$territorial %||% list()
  configured <- c(
    .graficos_scalar_chr(territorial$date_var, ""),
    .graficos_scalar_chr(territorial$submission_time_var, ""),
    .graficos_scalar_chr(monitoreo$date_var, "")
  )
  configured <- unique(c(configured, sub("^.*/", "", configured)))
  candidates <- unique(c(
    "date", "fecha", "Core/date", "today", configured,
    "kobo_timestamp_iso", "_submission_time", "submission_time"
  ))
  candidates <- candidates[nzchar(candidates)]
  exact <- candidates[candidates %in% names(data)]
  if (!length(exact)) {
    key <- .graficos_norm_text_key(names(data))
    candidate_key <- .graficos_norm_text_key(candidates)
    hit <- which(key %in% candidate_key)[1]
    exact <- if (length(hit) && !is.na(hit)) names(data)[[hit]] else character(0)
  }
  if (!length(exact)) return(NULL)
  raw <- trimws(as.character(data[[exact[[1L]]]]))
  raw <- substr(raw, 1L, 10L)
  dates <- suppressWarnings(as.Date(raw, format = "%Y-%m-%d"))
  dates <- dates[!is.na(dates)]
  if (!length(dates)) return(NULL)
  .graficos_acnur_period_from_dates(
    as.character(min(dates)),
    as.character(max(dates)),
    source = "observed"
  )
}

.graficos_acnur_field_period <- function(sid, main_source = "") {
  cfg <- tryCatch(validacion_scope_get(sid, main_source, "operational_config"),
                  error = function(e) NULL)
  field <- (cfg %||% list())$field_period %||% list()
  if (isTRUE(field$enabled)) {
    manual <- .graficos_acnur_period_from_dates(
      field$start_date,
      field$end_date,
      source = "manual"
    )
    if (!is.null(manual)) return(manual)
  }
  .graficos_acnur_observed_field_period(sid, main_source)
}

.graficos_acnur_source_name <- function(source_kind) {
  kind <- .graficos_simplify_source_kind(source_kind)
  if (startsWith(kind, "kobo")) return("KoboToolbox")
  if (identical(kind, "surveymonkey")) return("SurveyMonkey")
  "Base de datos del estudio"
}

.graficos_acnur_repeat_unit <- function(base = list(), inst = NULL) {
  survey <- (inst %||% list())$survey %||% data.frame()
  labels <- character(0)
  if (is.data.frame(survey) && nrow(survey)) {
    kinds <- vapply(as.character(survey$type %||% ""), .graficos_base_type, character(1))
    idx <- which(!kinds %in% c("end_group", "end_repeat", "note", "calculate"))
    if (length(idx)) labels <- as.character(survey$label %||% survey$name %||% "")[idx]
  }
  grain <- attr(inst, "repeat_grain", exact = TRUE) %||% (inst %||% list())$repeat_grain %||% list()
  text <- paste(c(.graficos_scalar_chr(base$source_title, ""),
                  .graficos_scalar_chr(grain$unit_label %||% grain$unidad, ""),
                  labels), collapse = " ")
  key <- .graficos_norm_text_key(text)
  units <- list(
    servicio = "servicios", visita = "visitas", actividad = "actividades",
    integrante = "integrantes", miembro = "miembros", producto = "productos",
    atencion = "atenciones", incidente = "incidentes", curso = "cursos", evento = "eventos"
  )
  for (singular in names(units)) {
    plural <- units[[singular]]
    if (grepl(paste0("(^|_)(", singular, "|", plural, ")(_|$)"), key, perl = TRUE)) {
      return(list(singular = singular, plural = plural, inferred = TRUE))
    }
  }
  list(singular = "registro", plural = "registros", inferred = FALSE)
}

.graficos_acnur_repeat_section_label <- function(survey) {
  unit <- .graficos_acnur_repeat_unit(list(), list(survey = survey))
  if (!isTRUE(unit$inferred)) return("Resultados del bloque repetible")
  switch(
    unit$singular,
    servicio = "Evaluación del servicio recibido",
    visita = "Evaluación de la visita",
    atencion = "Evaluación de la atención recibida",
    paste("Resultados de", unit$plural)
  )
}

.graficos_acnur_source_context <- function(sid, source_name) {
  state <- session_get(sid, required = FALSE)
  bases <- (((state %||% list())$estudio %||% list())$bases %||% list())
  base <- bases[[source_name]] %||% list()
  data <- .graficos_all_data_sources(sid)[[source_name]] %||% data.frame()
  inst <- .graficos_all_inst_sources(sid)[[source_name]] %||% list()
  grain <- attr(inst, "repeat_grain", exact = TRUE) %||% list()
  is_repeat <- nzchar(.graficos_scalar_chr(base$parent_base, "")) ||
    nzchar(.graficos_scalar_chr(base$repeat_group, "")) ||
    identical(.graficos_scalar_chr(grain$kind, ""), "instancia")
  list(base = base, data = data, inst = inst, is_repeat = is_repeat,
       unit = if (is_repeat) .graficos_acnur_repeat_unit(base, inst) else NULL)
}

.graficos_acnur_special_choices <- function(variable) {
  choices <- variable$choices %||% list()
  if (!length(choices)) return(list(codes = character(0), labels = character(0)))
  codes <- vapply(choices, function(x) .graficos_scalar_chr((x %||% list())$name, ""), character(1))
  labels <- vapply(choices, function(x) .graficos_scalar_chr((x %||% list())$label, ""), character(1))
  code_key <- .graficos_norm_text_key(codes)
  label_key <- .graficos_norm_text_key(labels)
  explicit_codes <- c("90", "94", "98", "99", "no_sabe", "no_responde",
                      "no_sabe_no_responde", "prefiere_no_responder",
                      "prefer_not_to_answer", "dont_know", "refused", "nosay")
  explicit_labels <- c("no_sabe", "no_responde", "no_sabe_no_responde",
                       "no_sabe_no_opina", "prefiere_no_responder",
                       "prefiero_no_responder", "prefiere_no_contestar",
                       "prefiere_no_decir", "prefiero_no_decir",
                       "prefiero_no_contestar", "no_desea_responder",
                       "no_aplica", "no_corresponde")
  # La etiqueta del instrumento manda. Un codigo numerico canonico puede tener
  # un significado sustantivo en otra lista (p. ej. 99 = una razon declarada);
  # solo se usa como señal cuando no existe etiqueta.
  has_label <- nzchar(label_key)
  label_hit <- vapply(label_key, function(key) {
    if (!nzchar(key)) return(FALSE)
    any(vapply(explicit_labels, function(pattern) {
      grepl(paste0("(^|_)", pattern, "(_|$)"), key, perl = TRUE)
    }, logical(1)))
  }, logical(1))
  hit <- label_hit | (!has_label & code_key %in% explicit_codes)
  idx <- which(hit & nzchar(codes))
  raw_labels <- labels[idx]
  display_labels <- vapply(seq_along(idx), function(i) {
    label <- raw_labels[[i]]
    key <- label_key[[idx[[i]]]]
    canonical <- c(
      prefiere_no_decir = "Prefiere no decir",
      prefiero_no_decir = "Prefiero no decir",
      prefiere_no_responder = "Prefiere no responder",
      prefiero_no_responder = "Prefiero no responder",
      prefiere_no_contestar = "Prefiere no contestar",
      prefiero_no_contestar = "Prefiero no contestar",
      no_sabe_no_responde = "No sabe / no responde",
      no_sabe_no_opina = "No sabe / no opina",
      no_sabe = "No sabe",
      no_responde = "No responde",
      no_aplica = "No aplica",
      no_corresponde = "No corresponde"
    )
    match <- names(canonical)[vapply(names(canonical), function(pattern) {
      grepl(paste0("(^|_)", pattern, "(_|$)"), key, perl = TRUE)
    }, logical(1))][1]
    if (length(match) && !is.na(match)) canonical[[match]] else if (nzchar(label)) {
      .graficos_clean_dynamic_label(label)
    } else {
      codes[[idx[[i]]]]
    }
  }, character(1))
  list(
    codes = codes[idx],
    labels = display_labels,
    raw_labels = raw_labels[nzchar(raw_labels)]
  )
}

.graficos_acnur_multi_tokens <- function(values, allowed = character(0)) {
  lapply(trimws(as.character(values %||% character(0))), function(value) {
    if (is.na(value) || !nzchar(value)) return(character(0))
    tokens <- strsplit(value, "[[:space:];,]+", perl = TRUE)[[1]]
    tokens <- tokens[nzchar(tokens)]
    if (length(allowed)) tokens <- tokens[tokens %in% allowed]
    unique(tokens)
  })
}

.graficos_acnur_special_note <- function(values, specials) {
  if (!length(values) || !length(specials$codes)) return("")
  counts <- vapply(specials$codes, function(code) sum(values == code, na.rm = TRUE), integer(1))
  keep <- counts > 0L
  if (!any(keep)) return("")
  labels <- specials$labels
  labels[!nzchar(labels)] <- specials$codes[!nzchar(labels)]
  paste(vapply(which(keep), function(i) {
    noun <- if (identical(as.integer(counts[[i]]), 1L)) "respuesta" else "respuestas"
    sprintf("%s %s: «%s»", .graficos_acnur_number(counts[[i]]), noun, labels[[i]])
  }, character(1)), collapse = "; ")
}

.graficos_acnur_pct <- function(n, total) {
  n <- suppressWarnings(as.numeric(n)[1])
  total <- suppressWarnings(as.numeric(total)[1])
  if (!is.finite(n) || !is.finite(total) || total <= 0) return("0.0%")
  sprintf("%.1f%%", 100 * n / total)
}

.graficos_acnur_human_list <- function(values) {
  values <- trimws(as.character(values %||% character(0)))
  values <- unique(values[!is.na(values) & nzchar(values)])
  if (!length(values)) return("")
  if (length(values) == 1L) return(values[[1L]])
  if (length(values) == 2L) return(paste(values, collapse = " y "))
  paste0(paste(values[-length(values)], collapse = ", "), " y ", values[[length(values)]])
}

.graficos_acnur_base_summary <- function(n, total, unit = "respuestas") {
  # `unit` se conserva por compatibilidad de firma con callers previos, pero el
  # formato profesional no expone la palabra unidad ("respuestas"). La notación
  # es la estándar de informes de investigación: "N = <n> (<pct> del total)",
  # con el denominador implícito en el porcentaje.
  sprintf(
    "N = %s (%s del total)",
    .graficos_acnur_number(n),
    .graficos_acnur_pct(n, total)
  )
}

.graficos_acnur_question_semantics <- function(sid, source_name, variable, ctx = NULL) {
  # `ctx` depende solo de (sid, source_name), no de la variable. El caller lo
  # precomputa una vez por fuente y lo pasa: sin esto, .graficos_acnur_source_context
  # (que recarga y normaliza TODAS las bases) corría una vez por variable — el
  # cuello de botella del plan sugerido (perfilado: 82% del tiempo, ~27s).
  ctx <- ctx %||% .graficos_acnur_source_context(sid, source_name)
  data <- ctx$data
  name <- .graficos_scalar_chr(variable$name, "")
  if (!is.data.frame(data) || !name %in% names(data)) {
    return(list(note = "", exclude_options = character(0), source_note = ""))
  }
  values <- as.character(data[[name]])
  answered <- !.graficos_is_blank_cell(values)
  multiple <- identical(.graficos_base_type(variable$tipo), "select_multiple")
  specials <- .graficos_acnur_special_choices(variable)
  substantive <- answered & !(values %in% specials$codes)
  exclusions <- unique(c(specials$codes, specials$labels, specials$raw_labels %||% character(0)))
  exclusions <- exclusions[nzchar(exclusions)]

  survey <- (ctx$inst %||% list())$survey %||% data.frame()
  relevant <- ""
  if (is.data.frame(survey) && all(c("name", "relevant") %in% names(survey))) {
    idx <- which(as.character(survey$name) == name)[1]
    if (length(idx) && !is.na(idx)) relevant <- .graficos_scalar_chr(survey$relevant[[idx]], "")
  }
  eligible_known <- !nzchar(relevant)
  total <- nrow(data)
  allowed <- vapply(variable$choices %||% list(),
                    function(x) .graficos_scalar_chr((x %||% list())$name, ""),
                    character(1))
  allowed <- setdiff(allowed[nzchar(allowed)], specials$codes)
  tokens <- if (multiple) .graficos_acnur_multi_tokens(values, allowed) else vector("list", length(values))
  if (multiple) substantive <- lengths(tokens) > 0L
  n_answered <- sum(answered)
  n_valid <- sum(substantive)
  n_special <- max(0L, n_answered - n_valid)

  if (!ctx$is_repeat && multiple) {
    mentions <- sum(lengths(tokens[substantive]))
    note <- sprintf(
      "%s; %s menciones. Los porcentajes no suman 100%%.",
      .graficos_acnur_base_summary(n_valid, total, "respuestas"),
      .graficos_acnur_number(mentions)
    )
  } else if (!ctx$is_repeat) {
    note <- paste0(.graficos_acnur_base_summary(n_valid, total, "respuestas"), ".")
  } else {
    # Base por servicio/instancia: mismo formato limpio que la base principal
    # ("Base: <n> de <total> (<pct>)"). El nombre del servicio se anexa aparte en
    # `.graficos_repeat_service_note`; aquí ya no se declara la unidad
    # ("respuestas de servicio") ni el conteo de personas ("correspondientes a
    # X personas"), por pedido editorial.
    base_phrase <- .graficos_acnur_base_summary(n_valid, total)
    if (multiple) {
      note <- sprintf("%s; %s menciones. Los porcentajes no suman 100%%.",
                      base_phrase, .graficos_acnur_number(sum(lengths(tokens[substantive]))))
    } else {
      note <- sprintf("%s.", base_phrase)
    }
  }
  special_note <- .graficos_acnur_special_note(values[answered], specials)
  if (nzchar(special_note)) note <- paste0(sub("[.]$", "", note), "; ", special_note, ".")
  list(
    note = note,
    exclude_options = exclusions,
    source_note = ""
  )
}

.graficos_acnur_report_context <- function(sid, coverage) {
  state <- session_get(sid, required = FALSE)
  bases <- (((state %||% list())$estudio %||% list())$bases %||% list())
  data_sources <- .graficos_all_data_sources(sid)
  inst_sources <- .graficos_all_inst_sources(sid)
  sources <- lapply((coverage %||% list())$sources %||% list(), function(source) {
    name <- .graficos_scalar_chr(source$name, "default")
    base <- bases[[name]] %||% list()
    data <- data_sources[[name]] %||% data.frame()
    inst <- inst_sources[[name]] %||% list()
    is_repeat <- identical(.graficos_scalar_chr(source$source_role, "principal"), "repeat") ||
      nzchar(.graficos_scalar_chr(base$parent_base, ""))
    vars <- Filter(function(variable) {
      isTRUE(variable$graphable) && isTRUE(variable$is_preferred) &&
        !identical(variable$suggest_as_primary, FALSE) && isTRUE(variable$data_available) &&
        !identical(variable$status, "excluida_intencionalmente")
    }, source$variables %||% list())
    sections <- unique(vapply(vars, function(variable) {
      if (!isTRUE(variable$section_reliable)) return("")
      .graficos_scalar_chr(variable$group_path %||% variable$seccion, "")
    }, character(1)))
    sections <- sections[nzchar(sections)]
    people <- NA_integer_
    if (is_repeat && is.data.frame(data)) {
      link <- .graficos_scalar_chr(base$link_key, "")
      if (!nzchar(link) || !link %in% names(data)) {
        candidates <- c("_parent_index", "_submission__id")
        link <- candidates[candidates %in% names(data)][1] %||% ""
      }
      if (nzchar(link)) {
        keys <- trimws(as.character(data[[link]]))
        people <- length(unique(keys[!is.na(keys) & nzchar(keys)]))
      }
    }
    list(name = name, base = base, data = data, inst = inst, is_repeat = is_repeat,
         source_kind = .graficos_scalar_chr(source$source_kind_raw %||% base$source_kind, ""),
         sections = sections, unit = if (is_repeat) .graficos_acnur_repeat_unit(base, inst) else NULL,
         n_rows = if (is.data.frame(data)) nrow(data) else NA_integer_, n_people = people)
  })
  main_index <- which(!vapply(sources, function(x) isTRUE(x$is_repeat), logical(1)))[1]
  main <- if (length(main_index) && !is.na(main_index)) sources[[main_index]] else NULL
  sections <- unique(unlist(lapply(sources, function(x) x$sections), use.names = FALSE))
  list(
    sid = sid,
    study_name = .graficos_acnur_project_name(sid),
    sources = sources,
    main = main,
    repeats = Filter(function(x) isTRUE(x$is_repeat), sources),
    period = .graficos_acnur_field_period(sid, .graficos_scalar_chr((main %||% list())$name, "")),
    sections = sections[nzchar(sections)]
  )
}

.graficos_acnur_territorial_methodology <- function(context) {
  state <- session_get((context %||% list())$sid, required = FALSE)
  cfg <- (state %||% list())$hojas_ruta_config %||% list()
  if (!length(cfg)) return(list())

  sampling_method <- .graficos_norm_text_key(cfg$sampling_method)
  selection_method <- switch(
    sampling_method,
    pps = "seleccionadas al azar con probabilidad proporcional al número de viviendas",
    probability_proportional_to_size = "seleccionadas al azar con probabilidad proporcional al número de viviendas",
    srs = "seleccionadas mediante muestreo aleatorio simple",
    simple_random = "seleccionadas mediante muestreo aleatorio simple",
    "seleccionadas aleatoriamente"
  )

  age_ranges <- cfg$age_ranges %||% list()
  min_age <- suppressWarnings(min(vapply(age_ranges, function(item) {
    as.numeric((item %||% list())$min %||% NA_real_)
  }, numeric(1)), na.rm = TRUE))
  if (!is.finite(min_age)) min_age <- NA_real_
  population <- if (is.finite(min_age)) {
    sprintf(
      "Personas de %s años a más residentes en los seis distritos del estudio.",
      format(as.integer(min_age), scientific = FALSE)
    )
  } else {
    "Personas residentes en los seis distritos del estudio."
  }

  max_per_block <- suppressWarnings(as.integer(
    cfg$entrevistas_por_manzana %||% cfg$max_per_manzana %||% NA_integer_
  )[1])
  district_targets <- suppressWarnings(as.numeric(unlist(cfg$n_por_distrito %||% list(), use.names = FALSE)))
  district_targets <- district_targets[is.finite(district_targets) & district_targets > 0]
  blocks_per_district <- if (length(district_targets) && is.finite(max_per_block) && max_per_block > 0) {
    unique(ceiling(district_targets / max_per_block))
  } else {
    numeric(0)
  }
  selection <- if (length(blocks_per_district) == 1L) {
    paste0(blocks_per_district[[1L]], " manzanas titulares por distrito, ", selection_method, ".")
  } else {
    paste0("Manzanas ", selection_method, ".")
  }
  controls <- c(cfg$row_var, cfg$subquota_var, cfg$col_var)
  controls <- .graficos_norm_text_key(controls)
  controls <- controls[nzchar(controls)]
  human <- c(
    distrito = "distrito",
    sexo = "sexo",
    rango_edad = "grupo de edad",
    grupo_edad = "grupo de edad",
    edad = "grupo de edad"
  )
  controls <- unique(vapply(controls, function(key) human[[key]] %||% gsub("_", " ", key), character(1)))
  control_text <- if (length(controls)) {
    .graficos_acnur_human_list(controls)
  } else {
    "distrito, sexo y grupo de edad"
  }
  field_control <- paste0("Cuotas por ", control_text)
  if (is.finite(max_per_block) && !is.na(max_per_block)) {
    field_control <- paste0(field_control, "; hasta ", max_per_block, " entrevistas por manzana")
  }
  operational_capacity <- unique(district_targets)
  if (length(operational_capacity) == 1L && is.finite(operational_capacity)) {
    field_control <- paste0(
      field_control,
      "; capacidad operativa ", .graficos_acnur_number(operational_capacity),
      "/distrito (no analítica)"
    )
  }
  field_control <- paste0(field_control, ".")

  list(
    design = "Encuesta presencial por conglomerados, organizada en tres pares territoriales.",
    population = population,
    selection = selection,
    field_control = field_control
  )
}

.graficos_acnur_territorial_samples <- function(context) {
  main <- (context %||% list())$main %||% list()
  data <- main$data
  if (is.null(data)) data <- data.frame()
  sid <- (context %||% list())$sid
  if (!is.data.frame(data) || !nrow(data) || is.null(sid) ||
      !exists(".graficos_detect_district_values", mode = "function") ||
      !exists(".graficos_acnur_koica_pairs", mode = "function")) {
    return(list())
  }
  detected <- .graficos_detect_district_values(data, sid)
  district <- as.character(detected$distrito %||% character(0))
  counts <- table(district[nzchar(district) & district != "Otros distritos"])
  lapply(.graficos_acnur_koica_pairs(), function(pair) {
    districts <- as.character(pair$districts %||% character(0))
    district_counts <- stats::setNames(
      vapply(districts, function(name) {
        if (name %in% names(counts)) as.integer(counts[[name]]) else 0L
      }, integer(1)),
      districts
    )
    list(
      label = .graficos_scalar_chr(pair$label, ""),
      n = sum(district_counts),
      districts = district_counts
    )
  })
}

.graficos_acnur_profile_variable <- function(context, kind = c("sex", "age")) {
  kind <- match.arg(kind)
  main <- (context %||% list())$main %||% list()
  data <- main$data
  if (is.null(data)) data <- data.frame()
  survey <- (main$inst %||% list())$survey
  if (is.null(survey)) survey <- data.frame()
  if (!is.data.frame(data) || !nrow(data)) return("")

  candidates <- if (identical(kind, "sex")) {
    c("E2_sex", "Core/E2_sex", "sex", "sexo")
  } else {
    c("E1_age_calc", "Core/E1_age_calc", "age_group", "grupo_edad", "rango_edad", "E1_age", "edad")
  }
  exact <- candidates[candidates %in% names(data)]
  if (length(exact)) return(exact[[1L]])
  if (!is.data.frame(survey) || !nrow(survey) || !"name" %in% names(survey)) return("")
  label <- as.character(survey$label %||% survey$name)
  label_key <- .graficos_norm_text_key(label)
  name_key <- .graficos_norm_text_key(survey$name)
  pattern <- if (identical(kind, "sex")) "(^|_)sexo(_|$)|(^|_)sex(_|$)" else "edad|etario|age"
  hit <- which(grepl(pattern, label_key, perl = TRUE) | grepl(pattern, name_key, perl = TRUE))
  hit <- hit[as.character(survey$name[hit]) %in% names(data)]
  if (length(hit)) as.character(survey$name[[hit[[1L]]]]) else ""
}

.graficos_acnur_profile_breakdown <- function(context, variable) {
  main <- (context %||% list())$main %||% list()
  data <- main$data
  inst <- main$inst %||% list()
  survey <- inst$survey
  choices <- inst$choices %||% inst$choices_raw
  if (is.null(data)) data <- data.frame()
  if (is.null(survey)) survey <- data.frame()
  if (is.null(choices)) choices <- data.frame()
  variable <- .graficos_scalar_chr(variable, "")
  if (!is.data.frame(data) || !nrow(data) || !nzchar(variable) || !(variable %in% names(data))) {
    return("")
  }

  values <- trimws(as.character(data[[variable]]))
  values <- values[!is.na(values) & nzchar(values)]
  if (!length(values)) return("")

  display <- values
  instrument_order <- character(0)
  if (is.data.frame(survey) && nrow(survey) && "name" %in% names(survey)) {
    row <- which(as.character(survey$name) == variable)[1]
    if (length(row) && !is.na(row) &&
        exists(".graficos_list_name_for_row", mode = "function") &&
        exists(".graficos_choices_for_list", mode = "function")) {
      list_name <- .graficos_list_name_for_row(survey, row)
      meta <- .graficos_choices_for_list(choices, list_name)$items %||% list()
      if (length(meta)) {
        codes <- vapply(meta, function(item) .graficos_scalar_chr((item %||% list())$name, ""), character(1))
        labels <- vapply(meta, function(item) {
          .graficos_clean_dynamic_label(.graficos_scalar_chr((item %||% list())$label, ""))
        }, character(1))
        labels[!nzchar(labels)] <- codes[!nzchar(labels)]
        code_map <- stats::setNames(labels, codes)
        hit <- display %in% names(code_map)
        display[hit] <- unname(code_map[display[hit]])
        instrument_order <- unique(labels[nzchar(labels)])
      }
    }
  }

  observed_order <- unique(display)
  levels <- c(intersect(instrument_order, observed_order), setdiff(observed_order, instrument_order))
  counts <- table(factor(display, levels = levels))
  counts <- counts[counts > 0L]
  paste(vapply(seq_along(counts), function(i) {
    paste0(names(counts)[[i]], " ", .graficos_acnur_number(counts[[i]]))
  }, character(1)), collapse = " · ")
}

.graficos_acnur_profile_slides <- function(sid, coverage = NULL) {
  context <- .graficos_acnur_report_context(sid, coverage)
  main <- context$main %||% list()
  source <- .graficos_scalar_chr(main$name, "")
  sex <- .graficos_acnur_profile_variable(context, "sex")
  age <- .graficos_acnur_profile_variable(context, "age")
  if (!nzchar(source) || !nzchar(sex) || !nzchar(age)) return(list())

  n <- suppressWarnings(as.integer(main$n_rows)[1])
  base <- if (is.finite(n) && !is.na(n)) {
    paste0("Base: ", .graficos_acnur_number(n), " personas")
  } else {
    ""
  }
  sex_breakdown <- .graficos_acnur_profile_breakdown(context, sex)
  ref <- function(name) .graficos_ref_for_source(source, name)
  list(
    list(
      id = .graficos_plan_slide_id("acnur-profile"),
      tipo = "p_slide_2_graficos",
      payload = list(
        titulo = "Perfil de las personas encuestadas",
        izquierda = list(
          graficador = "p_pie",
          args = list(
            var = ref(sex),
            titulo = "Sexo",
            overrides = list(
              tipo_pie = "donut",
              mostrar_n_en_etiquetas = FALSE,
              size_etiquetas_pct = 5.2,
              size_nota_pie = 9.5,
              size_leyenda = 14,
              leyenda_posicion = "derecha",
              canvas_w_legend_right = 0.27,
              espaciado_vertical_cm = 0.24,
              canvas_h_caption = 0.01,
              pos_nota_pie = "centro",
              nota_pie = "",
              colores_categorias = c("#0072BC", "#00A98F", "#8FA8C8"),
              ordenar_categorias = "ninguno"
            )
          )
        ),
        derecha = list(
          graficador = "p_barras_agrupadas",
          args = list(
            var = ref("__age_group"),
            cruces = ref("__territory_pair"),
            titulo = "Edad por ámbito territorial",
            mostrar_ceros = TRUE,
            overrides = list(
              mostrar_leyenda = TRUE,
              leyenda_posicion = "abajo",
              orden_categorias_manual = c(
                "18 a 29 años", "30 a 44 años", "45 a 59 años", "60 años o más"
              ),
              colores_series = c(
                "Lima Norte" = "#0072BC",
                "Lima Este" = "#00A98F",
                "Lima Sur" = "#EF4A60"
              ),
              size_ejes = 16,
              size_leyenda = 13,
              size_texto_barras = 5.6,
              canvas_w_etiquetas = 0.28,
              canvas_w_bars = 0.72,
              canvas_h_header_in = 0.36,
              canvas_h_legend_in = 0.38,
              canvas_h_caption_in = 0.01,
              legend_key_cm = 0.35,
              legend_espaciado = 4,
              legend_n_por_fila = 3L,
              nota_pie = "",
              base_por_grupo = FALSE,
              unidad_base = "personas",
              invertir_series = FALSE,
              invertir_leyenda = FALSE,
              color_fondo = "#FFFFFF"
            )
          )
        ),
        base = base,
        pie = sex_breakdown
      )
    )
  )
}

# Constantes de contenido del estudio ACNUR-KOICA territorial. No hay dato en el
# .pulso para estos campos (son decisiones del marco metodológico del estudio),
# por eso se centralizan aquí, en el motor del perfil ACNUR, en un único lugar
# legible en vez de dispersarlos por las filas de la ficha.
.graficos_acnur_territorial_content <- function() {
  list(
    study_type = "Cuantitativo, cuasi-experimental con grupo de comparación.",
    design = paste0(
      "Territorial por conglomerados; selección probabilística de manzanas (PPS) ",
      "y sistemática de viviendas; cuotas de sexo y edad en la persona."
    ),
    sampling_frame = "Manzanas censales INEI 2017.",
    analysis_groups = paste0(
      "Intervención (SMP, SJL, Chorrillos) vs. Comparación (Los Olivos, Ate, SJM)."
    ),
    household_selection = paste0(
      "Viviendas por ruta sistemática (arranque + salto); ",
      "una persona adulta por regla."
    ),
    precision = "±4.1 pp grupo (95%); ±7.1 pp distrital (exploratorio); MDE 8.3 pp.",
    selection_sources = "proGres (ACNUR), MINEDU, MINSA-SIS, INEI 2026.",
    design_target = 1134L
  )
}

.graficos_acnur_technical_rows <- function(context, territorial = FALSE) {
  rows <- list()
  add <- function(label, detail) {
    detail <- .graficos_scalar_chr(detail, "")
    if (nzchar(detail)) rows[[length(rows) + 1L]] <<- list(criterio = label, detalle = detail)
  }
  add("Estudio", context$study_name)
  if (!is.null(context$period)) add("Periodo de campo", context$period$label)
  main_n <- suppressWarnings(as.integer((context$main %||% list())$n_rows)[1])
  if (isTRUE(territorial)) {
    methodology <- .graficos_acnur_territorial_methodology(context)
    content <- .graficos_acnur_territorial_content()
    add("Tipo de estudio", content$study_type)
    add("Diseño muestral", content$design)
    add("Marco muestral", content$sampling_frame)
    add("Población", methodology$population)
    add("Grupos de análisis", content$analysis_groups)
    add("Selección de manzanas", methodology$selection)
    add("Selección en el hogar", content$household_selection)
    add("Control muestral", methodology$field_control)
    if (is.finite(main_n) && !is.na(main_n)) {
      detail <- paste(.graficos_acnur_number(main_n), "personas")
      target <- suppressWarnings(as.integer(content$design_target)[1])
      if (is.finite(target) && !is.na(target)) {
        detail <- paste0(detail, " (meta de diseño ", .graficos_acnur_number(target), ")")
      }
      add("Muestra analizada", detail)
    }
    add("Precisión (diseño)", content$precision)
    add("Fuentes de selección de distritos", content$selection_sources)
    samples <- .graficos_acnur_territorial_samples(context)
    for (sample in samples) {
      district_text <- paste(vapply(names(sample$districts), function(name) {
        paste(name, .graficos_acnur_number(sample$districts[[name]]))
      }, character(1)), collapse = " · ")
      add(
        sample$label,
        paste0(.graficos_acnur_number(sample$n), " personas · ", district_text)
      )
    }
    return(rows)
  }
  if (is.finite(main_n) && !is.na(main_n)) {
    add("Universo incluido", paste(.graficos_acnur_number(main_n), "personas"))
  }
  for (repeat_source in context$repeats) {
    n <- suppressWarnings(as.integer(repeat_source$n_rows)[1])
    if (!is.finite(n) || is.na(n)) next
    unit <- repeat_source$unit %||% list(plural = "registros", inferred = FALSE)
    detail <- .graficos_acnur_number(n)
    if (is.finite(repeat_source$n_people) && !is.na(repeat_source$n_people)) {
      detail <- paste(detail, "aportados por", .graficos_acnur_number(repeat_source$n_people), "personas")
    }
    label <- if (isTRUE(unit$inferred)) {
      paste0(toupper(substring(unit$plural, 1L, 1L)), substring(unit$plural, 2L), " registrados")
    } else {
      "Registros del bloque repetible"
    }
    add(label, detail)
  }
  rows
}

.graficos_acnur_derived_variables <- function(context, territorial = FALSE) {
  if (!isTRUE(territorial)) return(list())
  main <- (context %||% list())$main %||% list()
  data <- main$data
  if (is.null(data)) data <- data.frame()
  sid <- (context %||% list())$sid
  source <- .graficos_scalar_chr(main$name, "")
  if (!is.data.frame(data) || !nrow(data) || is.null(sid)) return(list())

  entry <- function(name, label, origin) {
    out <- list(name = name, label = label, origin = origin)
    if (nzchar(source)) out$source <- source
    out
  }
  out <- list()

  if (exists(".graficos_detect_district_values", mode = "function") &&
      exists(".graficos_acnur_koica_pairs", mode = "function")) {
    detected <- tryCatch(.graficos_detect_district_values(data, sid), error = function(e) NULL)
    catalog <- unique(unlist(lapply(.graficos_acnur_koica_pairs(), `[[`, "districts"), use.names = FALSE))
    district <- as.character((detected %||% list())$distrito %||% character(0))
    if (any(!is.na(district) & district %in% catalog)) {
      out[[length(out) + 1L]] <- entry("__district", "Distrito", "district_crosswalk")
      out[[length(out) + 1L]] <- entry(
        "__territory_pair",
        "Ámbito territorial",
        "territorial_pair"
      )
    }
  }

  if (exists(".graficos_detect_age_groups", mode = "function")) {
    age_group <- tryCatch(.graficos_detect_age_groups(data, sid), error = function(e) character(0))
    age_group <- as.character(age_group %||% character(0))
    if (any(!is.na(age_group) & nzchar(age_group))) {
      out[[length(out) + 1L]] <- entry("__age_group", "Grupo de edad", "age_grouping")
    }
  }
  out
}

.graficos_acnur_report_inputs <- function(sid, coverage, acnur_mode = "general",
                                           map_included = FALSE,
                                           comparison_mode = "none") {
  context <- .graficos_acnur_report_context(sid, coverage)
  territorial <- identical(.graficos_scalar_chr(acnur_mode, "general"), "territorial")
  sex <- if (territorial) .graficos_acnur_profile_variable(context, "sex") else ""
  age <- if (territorial) .graficos_acnur_profile_variable(context, "age") else ""
  profile <- list(available = nzchar(sex) && nzchar(age))
  if (nzchar(sex)) profile$sex_variable <- sex
  if (nzchar(age)) profile$age_variable <- age

  list(
    period = .graficos_scalar_chr((context$period %||% list())$label, ""),
    period_source = .graficos_scalar_chr((context$period %||% list())$source, ""),
    technical_rows = .graficos_acnur_technical_rows(context, territorial),
    derived_variables = .graficos_acnur_derived_variables(context, territorial),
    profile = profile,
    map_included = isTRUE(map_included),
    comparison_mode = .graficos_scalar_chr(comparison_mode, "none")
  )
}

.graficos_acnur_table_style <- function() {
  list(
    title_color = "#0072BC",
    title_size = 24,
    table_height = 5.35,
    text_color = "#081F5C",
    first_col_fill = "#E6F3F8",
    body_fill = "#FFFFFF",
    border_color = "#B9D7E5",
    border_width = 0.65,
    first_col_size = 11.5,
    body_size = 11.5,
    padding_h = 8,
    padding_v = 3,
    min_row_height = 0.38
  )
}

# Reparte las filas de la ficha técnica en una o dos láminas para no desbordar la
# tabla (altura fija). Emite una sola lámina cuando el número de filas no supera
# el umbral editorial; en caso contrario parte en dos ("Ficha técnica" y
# "Ficha técnica (cont.)") repartiendo las filas de forma balanceada. La capacidad
# real (altura / alto mínimo de fila) acota el umbral para garantizar que ninguna
# lámina desborde.
.graficos_acnur_technical_slides <- function(rows, table_style, threshold = 11L) {
  rows <- rows %||% list()
  make_slide <- function(title, slide_rows) {
    list(
      id = .graficos_plan_slide_id("acnur"),
      tipo = "p_slide_tabla_tecnica",
      payload = list(titulo = title, filas = slide_rows, pie = "", estilo = table_style)
    )
  }
  n <- length(rows)
  table_height <- suppressWarnings(as.numeric(table_style$table_height)[1])
  min_row <- suppressWarnings(as.numeric(table_style$min_row_height)[1])
  capacity <- if (is.finite(table_height) && is.finite(min_row) && min_row > 0) {
    max(1L, as.integer(floor(table_height / min_row)))
  } else {
    NA_integer_
  }
  threshold <- suppressWarnings(as.integer(threshold)[1])
  if (!is.finite(threshold) || is.na(threshold) || threshold < 1L) threshold <- 11L
  if (is.finite(capacity) && !is.na(capacity)) threshold <- min(threshold, capacity)
  if (n <= threshold) {
    return(list(make_slide("Ficha técnica", rows)))
  }
  head_n <- as.integer(ceiling(n / 2))
  list(
    make_slide("Ficha técnica", rows[seq_len(head_n)]),
    make_slide("Ficha técnica (cont.)", rows[(head_n + 1L):n])
  )
}

.graficos_acnur_content_slides <- function(sections, single_limit = 8L,
                                            per_slide = 8L) {
  sections <- trimws(as.character(sections %||% character(0)))
  sections <- sections[!is.na(sections) & nzchar(sections)]
  if (!length(sections)) return(list())

  scalar_limit <- function(x, fallback) {
    out <- suppressWarnings(as.integer(x)[1])
    if (!is.finite(out) || is.na(out) || out < 1L) fallback else out
  }
  single_limit <- scalar_limit(single_limit, 8L)
  per_slide <- scalar_limit(per_slide, 8L)
  chunk_size <- if (length(sections) <= single_limit) length(sections) else per_slide
  chunks <- split(seq_along(sections), ceiling(seq_along(sections) / chunk_size))
  lapply(seq_along(chunks), function(page) {
    idx <- chunks[[page]]
    page_sections <- sections[idx]
    list(
      id = .graficos_plan_slide_id("acnur"),
      tipo = "p_slide_indice",
      payload = list(
        titulo = if (page == 1L) "Contenido" else paste0("Contenido · ", page),
        secciones = page_sections,
        subtemas = character(0),
        subindices = list(),
        estilo = list(
          acnur_two_column_index = TRUE,
          column_break = ceiling(length(page_sections) / 2),
          number_offset = idx[[1L]] - 1L,
          title_color = "#081F5C",
          accent_color = "#0072BC",
          text_color = "#081F5C",
          title_size = 24,
          section_size = 18
        )
      )
    )
  })
}

.graficos_acnur_report_intro_slides <- function(sid, coverage, acnur_mode = "general",
                                                index_single_limit = 8L,
                                                index_per_slide = 8L,
                                                cover_title = "") {
  # `cover_title` es un override OPT-IN: cuando el config del export trae un
  # titulo de portada explicito prevalece sobre el nombre del `.pulso`. Se
  # captura antes de reasignar la variable local `cover_title`.
  cover_title_override <- .graficos_scalar_chr(cover_title, "")
  context <- .graficos_acnur_report_context(sid, coverage)
  territorial <- identical(.graficos_scalar_chr(acnur_mode, "general"), "territorial")
  date <- .graficos_scalar_chr(
    (context$period %||% list())$cover_label %||% (context$period %||% list())$label,
    format(Sys.Date(), "%Y")
  )
  cover_title <- context$study_name
  if (territorial && identical(cover_title, "Resultados del estudio")) cover_title <- "ACNUR territorial"
  if (nzchar(cover_title_override)) cover_title <- cover_title_override
  table_style <- .graficos_acnur_table_style()
  cover_subtitle <- if (territorial) "Resultados y cobertura territorial" else "Informe de resultados"
  if (nzchar(date)) cover_subtitle <- paste(cover_subtitle, date, sep = "\n")
  cover_slide <- list(
    id = .graficos_plan_slide_id("acnur"), tipo = "p_slide_portada",
    payload = list(titulo = cover_title,
                   subtitulo = cover_subtitle,
                   fecha = "", subtexto = "")
  )
  technical_slides <- .graficos_acnur_technical_slides(
    .graficos_acnur_technical_rows(context, territorial),
    table_style
  )
  slides <- c(list(cover_slide), technical_slides)
  slides <- c(
    slides,
    .graficos_acnur_content_slides(
      context$sections,
      single_limit = index_single_limit,
      per_slide = index_per_slide
    )
  )
  slides
}
