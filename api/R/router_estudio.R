# Router de gestión del estudio y sus bases (v0.2+, multi-base).
#
# Un "estudio" es el contenedor de 1..16 bases (pares instrumento+data).
# La Fase 1 de la UI lo usa para armar el estudio base por base antes
# de analizar.
#
# Endpoints:
#   GET    /api/estudio                     → metadata del estudio + lista de bases
#   PATCH  /api/estudio                     → renombrar el estudio
#   POST   /api/estudio/base                → agregar una base (body: nombre, xlsform_file_id, data_file_id)
#   DELETE /api/estudio/base/<nombre>       → quitar una base
#   PATCH  /api/estudio/base/<nombre>       → renombrar una base (body: nombre_nuevo)
#
# El flujo típico del frontend:
#   1) Sube XLSForm y data con /api/files/upload (ya existente).
#   2) POST /api/estudio/base con los file_ids y un nombre → el router
#      lee ambos archivos, construye rp_inst + rp_data y los guarda en
#      la sesión bajo el nombre dado.
#   3) Repetir 1-2 por cada base del estudio (hasta 16).

# Convierte el metadata de una base en un payload serializable. Excluye
# los rp_data / rp_inst que son objetos R pesados.
.estudio_file_payload <- function(s, file_id) {
  fid <- as.character(file_id %||% "")
  if (!nzchar(fid) || is.null(s) || is.null(s$files[[fid]])) {
    return(list(file_id = fid, filename = if (nzchar(fid)) fid else NA_character_, kind = NA_character_))
  }
  fm <- s$files[[fid]]
  filename <- as.character(fm$original_name %||% fm$filename %||% basename(fm$path %||% fid))
  if (!nzchar(filename)) filename <- fid
  list(
    file_id = fid,
    filename = filename,
    kind = as.character(fm$kind %||% NA_character_)
  )
}

.estudio_records_payload <- function(x) {
  if (is.null(x)) return(list())
  if (is.data.frame(x)) {
    return(unname(lapply(seq_len(nrow(x)), function(i) as.list(x[i, , drop = FALSE]))))
  }
  if (is.list(x)) return(unname(x))
  list()
}

.estudio_scalar <- function(x, default = "") {
  if (is.null(x) || !length(x)) return(default)
  out <- as.character(x[[1]] %||% default)
  if (is.na(out)) default else trimws(out)
}

.estudio_suggestion_key <- function(value) {
  out <- iconv(as.character(value %||% ""), to = "ASCII//TRANSLIT")
  out <- tolower(trimws(out))
  out <- gsub("[^a-z0-9]+", " ", out)
  trimws(out)
}

.estudio_suggestion_slug <- function(value, fallback = "base") {
  out <- .estudio_suggestion_key(value)
  out <- gsub("\\s+", "_", out)
  out <- gsub("^_+|_+$", "", out)
  if (!nzchar(out)) fallback else out
}

.estudio_suggestion_records <- function(value) {
  if (is.null(value)) return(list())
  if (is.data.frame(value)) {
    return(unname(lapply(seq_len(nrow(value)), function(i) as.list(value[i, , drop = FALSE]))))
  }
  if (!is.list(value)) return(list())
  unname(lapply(value, function(item) if (is.list(item)) item else list(value = item)))
}

.estudio_suggestion_profile <- function(s) {
  cfg <- s$monitoreo_config %||% list()
  cfg$monitoreo_profile %||% s$monitoreo_profile %||% list()
}

.estudio_suggestion_sources <- function(s) {
  cfg <- s$monitoreo_config %||% list()
  snapshot <- s$monitoreo_snapshot %||% list()
  .estudio_suggestion_records(
    s$monitoreo_sources %||% snapshot$sources %||% cfg$sources %||% cfg$fuentes %||% list()
  )
}

.estudio_suggestion_source_title <- function(src) {
  .estudio_scalar(
    src$survey_title %||% (src$dimensions %||% list())$survey_title %||%
      src$title %||% src$label %||% src$name %||% src$survey_id %||% src$asset_uid %||% src$id,
    ""
  )
}

.estudio_suggestion_actor <- function(src) {
  dims <- src$dimensions %||% list()
  direct <- .estudio_scalar(dims$actor %||% dims$carrera %||% dims$segmento %||% dims$unidad, "")
  if (nzchar(direct)) return(direct)
  haystack <- .estudio_suggestion_key(paste(
    .estudio_scalar(src$id, ""),
    .estudio_scalar(src$label, ""),
    .estudio_suggestion_source_title(src),
    collapse = " "
  ))
  actors <- list(
    estudiantes = "Estudiantes",
    docentes = "Docentes",
    administrativos = "Administrativos",
    egresados = "Egresados",
    empleadores = "Empleadores",
    autoridades = "Autoridades"
  )
  for (key in names(actors)) {
    if (grepl(key, haystack, fixed = TRUE)) return(actors[[key]])
  }
  ""
}

.estudio_suggestion_channel_label <- function(value) {
  key <- .estudio_suggestion_key(value)
  if (!nzchar(key)) return("")
  if (grepl("telefon|phone|llamada", key)) return("Telefónico")
  if (grepl("whatsapp", key)) return("WhatsApp")
  if (grepl("sms", key)) return("SMS")
  if (grepl("ficha|qr|presencial", key)) return("Ficha QR")
  if (grepl("correo|email|mail", key)) return("Correo")
  if (grepl("web|online|link|enlace", key)) return("Correo")
  "Mixto"
}

.estudio_suggestion_source_channel <- function(src) {
  dims <- src$dimensions %||% list()
  direct <- .estudio_scalar(dims$canal %||% dims$channel %||% dims$modalidad %||% dims$medio, "")
  if (nzchar(direct)) {
    label <- .estudio_suggestion_channel_label(direct)
    return(if (nzchar(label)) label else direct)
  }
  fallback <- paste(.estudio_scalar(src$label, ""), .estudio_suggestion_source_title(src))
  label <- .estudio_suggestion_channel_label(fallback)
  if (nzchar(label)) label else ""
}

.estudio_suggestion_collection_strategy <- function(channel) {
  key <- .estudio_suggestion_key(channel)
  if (grepl("whatsapp", key)) return("whatsapp_link")
  if (grepl("correo|email|mail", key)) return("email")
  if (grepl("web|online|link|enlace|ficha|qr", key)) return("web_link")
  if (grepl("telefon|phone|llamada", key)) return("campo")
  "campo"
}

.estudio_suggestion_source_enabled <- function(src) {
  enabled <- src$enabled
  if (is.null(enabled) || !length(enabled)) return(TRUE)
  isTRUE(enabled[[1]]) || identical(as.character(enabled[[1]]), "TRUE")
}

.estudio_suggestion_response_count <- function(src) {
  direct <- suppressWarnings(as.numeric(src$response_count %||% src$n_rows %||% src$total %||% NA_real_)[1])
  if (is.finite(direct)) return(as.integer(direct))
  collectors <- .estudio_suggestion_records(src$collectors %||% list())
  if (!length(collectors)) return(NA_integer_)
  counts <- vapply(collectors, function(collector) {
    value <- collector$active_response_count %||% collector$response_count %||% collector$responses %||% 0
    out <- suppressWarnings(as.numeric(value)[1])
    if (is.finite(out)) out else 0
  }, numeric(1))
  as.integer(sum(counts, na.rm = TRUE))
}

.estudio_suggestion_collector_ids <- function(src) {
  collectors <- .estudio_suggestion_records(src$collectors %||% list())
  ids <- vapply(collectors, function(collector) {
    .estudio_scalar(collector$collector_id %||% collector$id, "")
  }, character(1))
  as.list(unique(ids[nzchar(ids)]))
}

.estudio_suggestion_source_payload <- function(src) {
  kind <- .estudio_scalar(src$kind, "")
  actor <- .estudio_suggestion_actor(src)
  channel <- .estudio_suggestion_source_channel(src)
  list(
    source_id = .estudio_scalar(src$id %||% src$key, ""),
    kind = kind,
    label = .estudio_scalar(src$label %||% src$name, ""),
    title = .estudio_suggestion_source_title(src),
    actor = actor,
    actor_key = .estudio_suggestion_slug(actor, "sin_actor"),
    channel = channel,
    collection_strategy = .estudio_suggestion_collection_strategy(channel),
    role = .estudio_scalar(src$role, ""),
    integration_mode = .estudio_scalar(src$integration_mode, ""),
    survey_id = .estudio_scalar(src$survey_id, ""),
    asset_uid = .estudio_scalar(src$asset_uid, ""),
    base_url = .estudio_scalar(src$base_url, ""),
    connection_profile_id = .estudio_scalar(src$connection_profile_id, ""),
    version_id = .estudio_scalar(src$version_id %||% src$kobo_version_id, ""),
    deployment_active = isTRUE(src$deployment_active),
    response_count = .estudio_suggestion_response_count(src),
    collector_ids = .estudio_suggestion_collector_ids(src),
    enabled = .estudio_suggestion_source_enabled(src),
    last_sync_at = .estudio_scalar(src$last_sync_at, "")
  )
}

.estudio_suggestion_group_survey_input <- function(group_sources, actor) {
  sm_sources <- Filter(function(src) identical(src$kind, "surveymonkey") && nzchar(src$survey_id), group_sources)
  if (!length(sm_sources)) return(NULL)
  channels <- unique(vapply(sm_sources, function(src) src$channel, character(1)))
  channels <- channels[nzchar(channels)]
  channel <- if (length(channels) > 1L) "Mixto" else (channels[[1]] %||% "")
  collection_strategy <- if (identical(channel, "Mixto")) "campo" else .estudio_suggestion_collection_strategy(channel)
  source_inputs <- lapply(sm_sources, function(src) {
    out <- list(
      survey_id = src$survey_id,
      label = src$label %||% src$title %||% actor,
      source_alias = actor,
      source_title = src$title %||% src$label %||% actor,
      channel = src$channel,
      source_channel = src$channel,
      collection_strategy = src$collection_strategy,
      response_statuses = as.list("completed"),
      keep_missing_status = FALSE
    )
    if (length(src$collector_ids %||% list())) out$collector_ids <- src$collector_ids
    out
  })
  primary <- source_inputs[[1]]
  out <- list(
    survey_id = primary$survey_id,
    label = actor,
    source_alias = actor,
    source_title = actor,
    channel = channel,
    source_channel = channel,
    collection_strategy = collection_strategy,
    response_statuses = as.list("completed"),
    keep_missing_status = FALSE
  )
  if (length(source_inputs) > 1L ||
      length(primary$collector_ids %||% list()) ||
      !identical(primary$channel %||% "", channel)) {
    out$sources <- source_inputs
  } else {
    if (length(primary$collector_ids %||% list())) out$collector_ids <- primary$collector_ids
  }
  out
}

.estudio_suggestion_group_kobo_input <- function(group_sources, actor) {
  kobo_sources <- Filter(function(src) identical(src$kind, "kobo") && nzchar(src$asset_uid), group_sources)
  if (!length(kobo_sources)) return(NULL)
  primary <- kobo_sources[[1]]
  out <- list(
    asset_uid = primary$asset_uid,
    label = actor,
    source_alias = actor,
    source_title = primary$title %||% primary$label %||% actor,
    title = primary$title %||% primary$label %||% actor,
    base_url = primary$base_url %||% "",
    connection_profile_id = primary$connection_profile_id %||% "",
    channel = primary$channel %||% "",
    source_channel = primary$channel %||% "",
    collection_strategy = primary$collection_strategy %||% ""
  )
  source_inputs <- lapply(kobo_sources, function(src) {
    list(
      asset_uid = src$asset_uid,
      label = src$label %||% src$title %||% actor,
      source_alias = actor,
      source_title = src$title %||% src$label %||% actor,
      title = src$title %||% src$label %||% actor,
      base_url = src$base_url %||% "",
      connection_profile_id = src$connection_profile_id %||% "",
      channel = src$channel %||% "",
      source_channel = src$channel %||% "",
      collection_strategy = src$collection_strategy %||% ""
    )
  })
  if (length(source_inputs) > 1L ||
      !identical(primary$base_url %||% "", out$base_url) ||
      !identical(primary$connection_profile_id %||% "", out$connection_profile_id)) {
    out$sources <- source_inputs
  }
  out
}

.estudio_processing_suggestions_payload <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) stop_api(404, "E_NO_SESSION", "Sin sesión.")
  profile <- .estudio_suggestion_profile(s)
  profile_family <- .estudio_scalar(profile$family, "")
  profile_variant <- .estudio_scalar(profile$variant, "")
  sources_raw <- .estudio_suggestion_sources(s)
  sources <- lapply(sources_raw, .estudio_suggestion_source_payload)
  sources <- Filter(function(src) isTRUE(src$enabled), sources)
  survey_sources <- Filter(function(src) {
    src$kind %in% c("surveymonkey", "kobo") &&
      (.estudio_suggestion_key(src$role) %in% c("", "respuestas", "respuesta") ||
         nzchar(src$survey_id) || nzchar(src$asset_uid))
  }, sources)
  is_acreditacion <- identical(profile_family, "acreditacion") ||
    any(grepl("acreditacion", .estudio_suggestion_key(vapply(sources, function(src) {
      paste(src$label, src$title, src$source_id, collapse = " ")
    }, character(1)))))

  warnings <- list()
  if (!is_acreditacion && length(survey_sources)) {
    warnings <- c(warnings, "Hay fuentes de encuesta en Monitoreo, pero no se detectó perfil de acreditación.")
  }

  groups <- list()
  if (is_acreditacion && length(survey_sources)) {
    keyed <- split(survey_sources, vapply(survey_sources, function(src) {
      actor_key <- src$actor_key
      if (!nzchar(actor_key) || identical(actor_key, "sin_actor")) {
        actor_key <- .estudio_suggestion_slug(src$label %||% src$title, "sin_actor")
      }
      paste(src$kind, actor_key, sep = "::")
    }, character(1)))
    groups <- lapply(names(keyed), function(key) {
      rows <- keyed[[key]]
      actor <- rows[[1]]$actor
      if (!nzchar(actor)) actor <- rows[[1]]$label %||% rows[[1]]$title %||% "Sin actor"
      platform <- rows[[1]]$kind
      response_counts <- vapply(rows, function(src) {
        value <- suppressWarnings(as.numeric(src$response_count)[1])
        if (is.finite(value)) value else 0
      }, numeric(1))
      survey_input <- if (identical(platform, "surveymonkey")) {
        .estudio_suggestion_group_survey_input(rows, actor)
      } else {
        NULL
      }
      kobo_input <- if (identical(platform, "kobo")) {
        .estudio_suggestion_group_kobo_input(rows, actor)
      } else {
        NULL
      }
      list(
        id = paste("monitoreo", "acreditacion", platform, .estudio_suggestion_slug(actor), sep = ":"),
        project_kind = "acreditacion",
        actor = actor,
        actor_key = .estudio_suggestion_slug(actor, "sin_actor"),
        platform = platform,
        label = sprintf("%s · %s", actor, if (identical(platform, "surveymonkey")) "SurveyMonkey" else "Kobo"),
        recommended_base_name = .estudio_suggestion_slug(actor, "base"),
        source_count = length(rows),
        response_count = as.integer(sum(response_counts, na.rm = TRUE)),
        importable = (identical(platform, "surveymonkey") && !is.null(survey_input)) ||
          (identical(platform, "kobo") && !is.null(kobo_input)),
        import_mode = if (identical(platform, "surveymonkey")) "surveymonkey_independent_sibling" else if (!is.null(kobo_input)) "kobo_independent_sibling" else "kobo_detected",
        confidence = if (all(vapply(rows, function(src) nzchar(src$actor), logical(1)))) "high" else "medium",
        survey_input = survey_input %||% NA,
        kobo_input = kobo_input %||% NA,
        sources = rows
      )
    })
    actor_order <- c("estudiantes", "docentes", "administrativos", "egresados", "empleadores", "autoridades")
    groups <- groups[order(vapply(groups, function(group) {
      hit <- match(group$actor_key, actor_order)
      if (is.na(hit)) 999L else hit
    }, integer(1)), vapply(groups, function(group) group$actor, character(1)))]
  }

  sm_groups <- Filter(function(group) identical(group$platform, "surveymonkey"), groups)
  kobo_groups <- Filter(function(group) identical(group$platform, "kobo"), groups)
  list(
    ok = TRUE,
    source = "monitoreo",
    project_kind = if (is_acreditacion) "acreditacion" else NA_character_,
    profile_family = if (nzchar(profile_family)) profile_family else NA_character_,
    profile_variant = if (nzchar(profile_variant)) profile_variant else NA_character_,
    has_suggestions = length(groups) > 0L,
    message = if (length(groups)) {
      sprintf("Detecté %d grupo%s de encuesta desde Monitoreo.", length(groups), if (length(groups) == 1L) "" else "s")
    } else if (is_acreditacion) {
      "Monitoreo está en acreditación, pero no encontré fuentes activas de encuesta para Procesamiento."
    } else {
      "No encontré un monitoreo de acreditación con fuentes de encuesta listas para sugerir."
    },
    summary = list(
      monitoring_sources_count = length(sources),
      survey_sources_count = length(survey_sources),
      actors_count = length(unique(vapply(groups, function(group) group$actor_key, character(1)))),
      surveymonkey_groups = length(sm_groups),
      kobo_groups = length(kobo_groups)
    ),
    warnings = warnings,
    groups = groups
  )
}

.estudio_choice_key <- function(x) {
  out <- iconv(as.character(x %||% ""), to = "ASCII//TRANSLIT")
  out <- tolower(trimws(out))
  out <- gsub("[^a-z0-9]+", " ", out)
  trimws(out)
}

.estudio_select_list_name <- function(type) {
  type <- .estudio_scalar(type, "")
  parts <- unlist(strsplit(type, "\\s+"), use.names = FALSE)
  if (length(parts) >= 2L && parts[[1]] %in% c("select_one", "select_multiple")) parts[[2]] else ""
}

.estudio_positive_choices_payload <- function(choices, list_name) {
  list_name <- .estudio_scalar(list_name, "")
  if (!nzchar(list_name) || is.null(choices) || !is.data.frame(choices) || !nrow(choices)) return(list())
  if (!all(c("list_name", "name") %in% names(choices))) return(list())
  rows <- choices[as.character(choices$list_name) == list_name, , drop = FALSE]
  if (!nrow(rows)) return(list())
  label_cols <- c(intersect(c("label", "label::es"), names(rows)), grep("^label", names(rows), value = TRUE))
  label_col <- unique(label_cols)[1] %||% NA_character_
  labels <- if (!is.na(label_col)) as.character(rows[[label_col]]) else as.character(rows$name)
  keys <- unique(c(.estudio_choice_key(rows$name), .estudio_choice_key(labels)))
  yes_keys <- c("1", "si", "yes", "true", "acepta", "acepto", "accepted", "y")
  keep <- vapply(seq_len(nrow(rows)), function(i) {
    any(c(.estudio_choice_key(rows$name[[i]]), .estudio_choice_key(labels[[i]])) %in% yes_keys)
  }, logical(1))
  if (!any(keep)) return(list())
  rows <- rows[keep, , drop = FALSE]
  labels <- labels[keep]
  unname(lapply(seq_len(nrow(rows)), function(i) {
    label <- ifelse(is.na(labels[[i]]), "", labels[[i]])
    list(name = .estudio_scalar(rows$name[[i]], ""), label = .estudio_scalar(label, ""))
  }))
}

.estudio_xlsform_variables_payload <- function(meta, s = NULL) {
  fid <- as.character(meta$xlsform_file_id %||% "")
  if (!nzchar(fid) || is.null(s)) return(list())
  base_name <- as.character(meta$nombre %||% "")
  inst <- if (nzchar(base_name) && !is.null(s$rp_inst_sources[[base_name]])) {
    s$rp_inst_sources[[base_name]]
  } else {
    if (is.null(s$files[[fid]])) return(list())
    path <- as.character(s$files[[fid]]$path %||% "")
    if (!nzchar(path) || !file.exists(path)) return(list())
    tryCatch(reporte_instrumento(path = path), error = function(e) NULL)
  }
  survey <- inst$survey %||% NULL
  choices <- inst$choices %||% NULL
  if (is.null(survey) || !is.data.frame(survey) || !nrow(survey) || !"name" %in% names(survey)) {
    return(list())
  }
  type_raw <- as.character(survey$type %||% "")
  type_base <- tolower(trimws(sub("\\s+.*$", "", type_raw)))
  non_question_types <- c(
    "begin_group", "end_group", "begin_repeat", "end_repeat",
    "note", "start", "end", "today", "deviceid", "username",
    "phonenumber", "simserial", "subscriberid", "audit", "background-audio"
  )
  names_raw <- as.character(survey$name %||% "")
  keep <- !is.na(names_raw) & nzchar(names_raw) & !(type_base %in% non_question_types)
  if (!any(keep)) return(list())
  label_cols <- c(intersect(c("label", "label::es"), names(survey)), grep("^label", names(survey), value = TRUE))
  label_col <- unique(label_cols)[1] %||% NA_character_
  labels <- if (!is.na(label_col)) as.character(survey[[label_col]]) else names_raw
  rows <- survey[keep, , drop = FALSE]
  labels <- labels[keep]
  type_base <- type_base[keep]
  type_raw <- type_raw[keep]
  names_raw <- names_raw[keep]
  unname(lapply(seq_along(names_raw), function(i) {
    choice_list <- .estudio_select_list_name(type_raw[[i]])
    list(
      name = names_raw[[i]],
      label = ifelse(is.na(labels[[i]]), "", labels[[i]]),
      type = type_base[[i]],
      choice_list = choice_list,
      positive_choices = .estudio_positive_choices_payload(choices, choice_list)
    )
  }))
}

.estudio_consent_from_spec <- function(x, fallback = list()) {
  .estudio_scalar(
    x$consent_var %||% x$consentimiento_var %||% x$consent_question %||%
      fallback$consent_var %||% fallback$consentimiento_var %||% fallback$consent_question,
    ""
  )
}

.estudio_consent_candidate_score <- function(name, label, type = "") {
  nm <- .estudio_choice_key(name)
  lab <- .estudio_choice_key(label)
  typ <- .estudio_choice_key(type)
  text <- paste(nm, lab)
  if (!grepl("^select one|select_one|select$", typ) && !grepl("^p[0-9]+$", nm)) return(0L)
  if (grepl("actividades|vinculacion|gustaria participar|participar con la carrera", lab) &&
      !grepl("consent|consentimiento|continuar|encuesta|entrevista", lab)) {
    return(0L)
  }
  if (grepl("consent|consentimiento", text)) return(100L)
  if (grepl("desea continuar|continuar con la encuesta|continuar encuesta", lab)) return(95L)
  if (grepl("acepta|acepto|aceptar", lab) && grepl("participar|encuesta|entrevista|estudio", lab)) return(90L)
  if (grepl("autoriz", lab) && grepl("encuesta|entrevista|estudio", lab)) return(80L)
  0L
}

.estudio_consent_candidates <- function(variables, current = "") {
  current <- .estudio_scalar(current, "")
  out <- if (nzchar(current)) current else character(0)
  if (is.null(variables) || !length(variables)) return(unique(out))
  scores <- vapply(variables, function(item) {
    item <- item %||% list()
    .estudio_consent_candidate_score(item$name, item$label, item$type)
  }, integer(1))
  if (any(scores > 0L)) {
    ordered <- order(scores, decreasing = TRUE)
    names <- vapply(variables[ordered], function(item) .estudio_scalar((item %||% list())$name, ""), character(1))
    out <- c(out, names[scores[ordered] > 0L])
  }
  unique(out[nzchar(out)])
}

.estudio_base_consent_var <- function(meta, variables = list()) {
  spec <- meta$surveymonkey_source_spec %||% list()
  direct <- if (is.list(spec)) .estudio_consent_from_spec(spec) else ""
  if (!nzchar(direct) && is.list(spec)) {
    sources <- spec$sources %||% spec$campaigns %||% list()
    for (source in sources) {
      direct <- .estudio_consent_from_spec(source)
      if (nzchar(direct)) break
    }
  }
  if (!nzchar(direct)) direct <- .estudio_consent_from_spec(meta, meta$response_filter %||% list())
  if (nzchar(direct)) return(direct)
  candidates <- .estudio_consent_candidates(variables)
  if (length(candidates)) return(candidates[[1]])
  ""
}

.estudio_base_status_payload <- function(meta, s = NULL) {
  base_name <- as.character(meta$nombre %||% "")
  validacion <- meta$validacion %||% list()
  codif <- if (!is.null(s) && !is.null(s$codif_por_base)) {
    s$codif_por_base[[base_name]] %||% list()
  } else {
    list()
  }
  xls <- .estudio_file_payload(s, meta$xlsform_file_id)
  dat <- .estudio_file_payload(s, meta$data_file_id)
  is_adapted <- identical(as.character(xls$kind %||% ""), "instrumento_adaptado") &&
    identical(as.character(dat$kind %||% ""), "data_adaptada")
  active <- if (!is.null(s) && !is.null(s$estudio)) {
    identical(as.character(s$estudio$active_base %||% ""), base_name)
  } else {
    FALSE
  }
  analitica_status <- if (!is.null(s) && is.list(s$analitica_status_por_base)) {
    s$analitica_status_por_base[[base_name]] %||% list()
  } else {
    list()
  }
  graficos_status <- if (!is.null(s) && is.list(s$graficos_status_por_base)) {
    s$graficos_status_por_base[[base_name]] %||% list()
  } else {
    list()
  }
  analitica_done <- any(vapply(c(
    "analitica_prep_ok", "analitica_codebook_ok", "analitica_frecuencias_ok",
    "analitica_cruces_ok", "analitica_spss_ok", "analitica_dim_ok",
    "analitica_bases_data_ok", "analitica_bases_instrumento_ok",
    "analitica_bases_sav_ok", "analitica_bases_csv_ok",
    "analitica_bases_xlsx_ok",
    "analitica_enumeradores_ok", "analitica_multibase_ok", "analitica_panel_ok",
    "analitica_ficha_tecnica_ok"
  ), function(k) isTRUE(analitica_status[[k]]), logical(1)))
  graficos_done <- any(vapply(c("graficos_ppt_ok", "graficos_word_ok"), function(k) {
    isTRUE(graficos_status[[k]])
  }, logical(1)))
  list(
    imported = isTRUE(suppressWarnings(as.integer(meta$n_filas %||% 0L) > 0L)),
    validacion = !is.null(validacion$evaluacion) ||
      length(validacion$limpieza_artifacts %||% list()) > 0L ||
      length(validacion$reglas_custom %||% list()) > 0L,
    codificacion = is_adapted || !is.null(codif$plantilla_codigos_file_id) ||
      length(codif$grupos_recod %||% list()) > 0L,
    codificacion_adaptada = is_adapted,
    analitica = isTRUE(analitica_done) || (active && (
      isTRUE((s %||% list())$analitica_prep_ok) ||
        isTRUE((s %||% list())$analitica_codebook_ok) ||
        isTRUE((s %||% list())$analitica_frecuencias_ok) ||
        isTRUE((s %||% list())$analitica_cruces_ok) ||
        isTRUE((s %||% list())$analitica_spss_ok) ||
        isTRUE((s %||% list())$analitica_dim_ok)
    )),
    graficos = isTRUE(graficos_done) || (active && (
      isTRUE((s %||% list())$graficos_ppt_ok) ||
        isTRUE((s %||% list())$graficos_word_ok)
    )),
    shared_logic_from = as.character(codif$shared_logic_from %||% NA_character_)
  )
}

.estudio_char_vector <- function(x) {
  if (is.null(x) || !length(x)) return(character(0))
  if (is.list(x) && !is.data.frame(x)) {
    x <- unlist(x, recursive = FALSE, use.names = FALSE)
  }
  out <- trimws(as.character(x %||% character(0)))
  out[!is.na(out) & nzchar(out)]
}

.estudio_int_value <- function(x) {
  if (is.null(x) || !length(x)) return(NA_integer_)
  out <- suppressWarnings(as.integer(x[[1]]))
  if (is.na(out)) NA_integer_ else out
}

.estudio_int_pick <- function(...) {
  values <- list(...)
  for (value in values) {
    out <- .estudio_int_value(value)
    if (!is.na(out)) return(out)
  }
  NA_integer_
}

.estudio_count_value <- function(x, keys) {
  if (is.null(x) || !is.list(x) || !length(x)) return(NA_integer_)
  nms <- names(x)
  if (is.null(nms)) return(NA_integer_)
  key_norm <- .estudio_choice_key(keys)
  for (i in seq_along(x)) {
    nm <- .estudio_choice_key(nms[[i]])
    if (nzchar(nm) && nm %in% key_norm) {
      return(.estudio_int_value(x[[i]]))
    }
  }
  NA_integer_
}

.estudio_sm_channel_key <- function(value) {
  key <- .estudio_choice_key(value)
  if (!nzchar(key)) return("")
  if (grepl("whatsapp", key, fixed = TRUE)) return("whatsapp")
  if (grepl("sms", key, fixed = TRUE)) return("sms")
  if (grepl("presencial|qr|ficha", key)) return("presencial")
  if (grepl("correo|email|mail|web|online|link|enlace", key)) return("correo")
  if (grepl("telef|fono|phone|campo", key)) return("telefono")
  if (grepl("mixto|multicanal", key)) return("mixto")
  "mixto"
}

.estudio_sm_channel_label <- function(source, fallback = "") {
  raw <- .estudio_scalar(
    source$source_channel %||% source$channel %||% source$canal,
    ""
  )
  if (!nzchar(raw)) raw <- .estudio_scalar(source$collection_strategy %||% fallback, "")
  key <- .estudio_sm_channel_key(raw)
  switch(
    key,
    correo = "Correo",
    telefono = "Telefónico",
    whatsapp = "WhatsApp",
    presencial = "Ficha QR",
    sms = "SMS",
    mixto = "Mixto",
    ""
  )
}

.estudio_sm_source_items <- function(x) {
  if (is.null(x) || !is.list(x) || !length(x)) return(list())
  sources <- x$sources %||% x$campaigns %||% list()
  if (is.list(sources) && length(sources)) return(unname(sources))
  has_source_identity <- nzchar(.estudio_scalar(
    x$survey_id %||% x$id %||% x$source_title %||% x$title %||% x$label,
    ""
  ))
  if (has_source_identity) list(x) else list()
}

.estudio_sm_source_record <- function(source, index = NA_integer_, fallback = list()) {
  source <- source %||% list()
  if (!is.list(source)) source <- list()
  survey_id <- .estudio_scalar(source$survey_id %||% source$id %||% fallback$survey_id, "")
  source_title <- .estudio_scalar(
    source$source_title %||% source$title %||% source$label %||% source$source_alias %||% fallback$source_title,
    survey_id
  )
  source_alias <- .estudio_scalar(
    source$source_alias %||% source$label %||% source_title %||% fallback$source_alias,
    source_title
  )
  channel <- .estudio_sm_channel_label(source, fallback$channel %||% fallback$source_channel %||% "")
  collector_ids <- unique(c(
    .estudio_char_vector(source$collector_ids),
    .estudio_char_vector(source$collector_id),
    .estudio_char_vector(names(source$kept_collector_counts %||% list())),
    .estudio_char_vector(names(source$collector_counts %||% list()))
  ))
  collector_ids <- collector_ids[nzchar(collector_ids) & collector_ids != "(vacio)"]
  collector_count <- length(collector_ids)
  if (!collector_count && is.list(source$collectors %||% NULL)) {
    collector_count <- length(source$collectors)
  }

  completed_records <- .estudio_int_pick(
    source$completed_records,
    source$completed,
    .estudio_count_value(source$original_status_counts %||% source$status_counts, c("completed", "complete")),
    .estudio_count_value(source$kept_status_counts, c("completed", "complete"))
  )
  effective_records <- .estudio_int_pick(source$effective_records, source$completed_with_consent)
  included_records <- .estudio_int_pick(source$included_records, source$included, source$kept_rows)
  valid_records <- .estudio_int_pick(source$valid_records, included_records, effective_records, source$kept_rows)
  raw_records <- .estudio_int_pick(source$raw_records, source$raw_total, source$original_rows)
  excluded_records <- .estudio_int_pick(source$excluded_records, source$excluded, source$excluded_rows)
  has_data_count <- any(!is.na(c(valid_records, included_records, effective_records)) & c(valid_records, included_records, effective_records) > 0L)

  list(
    index = .estudio_int_value(index),
    survey_id = survey_id,
    source_alias = source_alias,
    source_title = source_title,
    channel = channel,
    channel_key = .estudio_sm_channel_key(channel),
    collection_strategy = .estudio_scalar(source$collection_strategy %||% fallback$collection_strategy, ""),
    collector_ids = as.list(collector_ids),
    collector_count = as.integer(collector_count),
    consent_var = .estudio_scalar(
      source$consent_var %||% source$consentimiento_var %||% source$consent_question %||% fallback$consent_var,
      ""
    ),
    raw_records = raw_records,
    completed_records = completed_records,
    effective_records = effective_records,
    included_records = included_records,
    valid_records = valid_records,
    excluded_records = excluded_records,
    enters_data = isTRUE(has_data_count)
  )
}

.estudio_sm_source_records <- function(x, fallback = list()) {
  items <- .estudio_sm_source_items(x)
  if (!length(items)) return(list())
  unname(lapply(seq_along(items), function(i) {
    .estudio_sm_source_record(items[[i]], index = i, fallback = fallback)
  }))
}

.estudio_sm_source_match <- function(records, source = list(), index = NA_integer_) {
  if (!length(records)) return(NULL)
  survey_id <- .estudio_scalar(source$survey_id, "")
  if (nzchar(survey_id)) {
    matches <- Filter(function(record) identical(.estudio_scalar(record$survey_id, ""), survey_id), records)
    if (length(matches) == 1L) return(matches[[1]])
  }
  idx <- .estudio_int_value(index)
  if (!is.na(idx) && idx >= 1L && idx <= length(records)) return(records[[idx]])
  NULL
}

.estudio_sm_source_merge <- function(base, patch) {
  if (is.null(base)) base <- list()
  if (is.null(patch)) return(base)
  for (nm in names(patch)) {
    value <- patch[[nm]]
    if (nm %in% c(
      "raw_records", "completed_records", "effective_records", "included_records",
      "valid_records", "excluded_records", "collector_count", "index"
    )) {
      if (!is.na(.estudio_int_value(value))) base[[nm]] <- .estudio_int_value(value)
    } else if (identical(nm, "collector_ids")) {
      base[[nm]] <- as.list(unique(c(.estudio_char_vector(base[[nm]]), .estudio_char_vector(value))))
      base$collector_count <- as.integer(length(base[[nm]]))
    } else if (identical(nm, "enters_data")) {
      base[[nm]] <- isTRUE(base[[nm]]) || isTRUE(value)
    } else {
      current <- .estudio_scalar(base[[nm]], "")
      candidate <- .estudio_scalar(value, "")
      if (!nzchar(current) && nzchar(candidate)) base[[nm]] <- candidate
    }
  }
  base
}

.estudio_sm_source_summary <- function(meta) {
  if (is.null(meta) || !is.list(meta)) return(NULL)
  source_kind <- .estudio_scalar(meta$source_kind %||% (meta$response_filter %||% list())$kind, "")
  if (is.null(meta$surveymonkey_source_spec) &&
      !grepl("surveymonkey", source_kind, ignore.case = TRUE)) {
    return(NULL)
  }
  spec <- meta$surveymonkey_source_spec %||% list()
  filter <- meta$response_filter %||% list()
  audit <- meta$surveymonkey_decision_audit %||% list()
  fallback <- list(
    survey_id = meta$survey_id,
    source_alias = meta$source_alias,
    source_title = meta$source_title,
    channel = meta$source_channel,
    source_channel = meta$source_channel,
    consent_var = meta$consent_var
  )
  spec_records <- .estudio_sm_source_records(spec, fallback)
  filter_records <- .estudio_sm_source_records(filter, fallback)
  audit_records <- .estudio_sm_source_records(audit, fallback)
  records <- list()
  matched_filter <- logical(length(filter_records))
  matched_audit <- logical(length(audit_records))

  seed_records <- if (length(spec_records)) spec_records else if (length(filter_records)) filter_records else audit_records
  for (i in seq_along(seed_records)) {
    record <- seed_records[[i]]
    filter_match <- .estudio_sm_source_match(filter_records, record, i)
    audit_match <- .estudio_sm_source_match(audit_records, record, i)
    if (!is.null(filter_match)) {
      match_idx <- which(vapply(filter_records, function(x) identical(x, filter_match), logical(1)))[1]
      if (!is.na(match_idx)) matched_filter[[match_idx]] <- TRUE
    }
    if (!is.null(audit_match)) {
      match_idx <- which(vapply(audit_records, function(x) identical(x, audit_match), logical(1)))[1]
      if (!is.na(match_idx)) matched_audit[[match_idx]] <- TRUE
    }
    records[[length(records) + 1L]] <- .estudio_sm_source_merge(
      .estudio_sm_source_merge(record, filter_match),
      audit_match
    )
  }
  if (length(filter_records)) {
    for (i in seq_along(filter_records)) {
      if (isTRUE(matched_filter[[i]])) next
      audit_match <- .estudio_sm_source_match(audit_records, filter_records[[i]], i)
      records[[length(records) + 1L]] <- .estudio_sm_source_merge(filter_records[[i]], audit_match)
    }
  }
  if (length(audit_records)) {
    for (i in seq_along(audit_records)) {
      if (isTRUE(matched_audit[[i]])) next
      records[[length(records) + 1L]] <- audit_records[[i]]
    }
  }
  records <- Filter(function(x) {
    nzchar(.estudio_scalar(x$survey_id, "")) || nzchar(.estudio_scalar(x$source_title, ""))
  }, records)
  if (!length(records)) return(NULL)

  channel_keys <- unique(vapply(records, function(x) .estudio_scalar(x$channel_key, ""), character(1)))
  channel_keys <- channel_keys[nzchar(channel_keys)]
  channel_labels <- unique(vapply(records, function(x) .estudio_scalar(x$channel, ""), character(1)))
  channel_labels <- channel_labels[nzchar(channel_labels)]
  sum_field <- function(field) {
    vals <- vapply(records, function(x) .estudio_int_value(x[[field]]), integer(1))
    if (!any(!is.na(vals))) return(NA_integer_)
    as.integer(sum(vals[!is.na(vals)]))
  }
  has_key <- function(key) any(channel_keys == key)
  source_active <- function(key) {
    any(vapply(records, function(x) identical(.estudio_scalar(x$channel_key, ""), key) && isTRUE(x$enters_data), logical(1)))
  }
  list(
    kind = "surveymonkey_source_summary",
    source_count = as.integer(length(records)),
    main_survey_id = .estudio_scalar(meta$survey_id %||% records[[1]]$survey_id, ""),
    channel_label = if (length(channel_keys) > 1L) "Mixto" else if (length(channel_labels)) channel_labels[[1]] else "",
    channels = as.list(channel_labels),
    has_phone = has_key("telefono"),
    has_email = has_key("correo"),
    phone_active = source_active("telefono"),
    email_active = source_active("correo"),
    total_raw_records = sum_field("raw_records"),
    total_effective_records = sum_field("effective_records"),
    total_included_records = sum_field("included_records"),
    total_valid_records = sum_field("valid_records"),
    total_excluded_records = sum_field("excluded_records"),
    active_data_rows = .estudio_int_value(meta$n_filas),
    active_data_columns = .estudio_int_value(meta$n_columnas),
    sources = records
  )
}

.estudio_multi_integrated_payload <- function(multi, s = NULL) {
  if (is.null(multi) || !is.list(multi) || !length(multi)) return(NULL)
  guide_fid <- as.character(multi$guide_xlsform_file_id %||% "")
  origins <- .estudio_records_payload(multi$origins %||% list())
  origins <- lapply(origins, function(origin) {
    origin <- as.list(origin)
    xfid <- as.character(origin$xlsform_file_id %||% "")
    dfid <- as.character(origin$data_file_id %||% "")
    origin$xlsform_file_name <- .estudio_file_payload(s, xfid)$filename
    origin$data_file_name <- .estudio_file_payload(s, dfid)$filename
    origin
  })
  label_overrides <- multi$label_overrides_by_key %||% list()
  if (is.atomic(label_overrides) && !is.null(names(label_overrides))) {
    label_overrides <- as.list(label_overrides)
  }
  label_overrides_standard <- multi$label_overrides_standard %||% list()
  if (is.atomic(label_overrides_standard) && !is.null(names(label_overrides_standard))) {
    label_overrides_standard <- as.list(label_overrides_standard)
  }
  list(
    version = as.integer(multi$version %||% 1L),
    kind = as.character(multi$kind %||% "integrated_instruments"),
    origin_key_name = as.character(multi$origin_key_name %||% "origen"),
    guide_xlsform_file_id = guide_fid,
    guide = .estudio_file_payload(s, guide_fid),
    origins = origins,
    variant_map = .estudio_records_payload(multi$variant_map %||% list()),
    label_overrides_standard = label_overrides_standard,
    label_overrides_by_key = label_overrides,
    imported_at = as.character(multi$imported_at %||% NA_character_)
  )
}

.estudio_base_payload <- function(meta, s = NULL) {
  multi_payload <- .estudio_multi_integrated_payload(meta$multi_integrated, s)
  xlsform_variables <- .estudio_xlsform_variables_payload(meta, s)
  consent_var <- .estudio_base_consent_var(meta, xlsform_variables)
  sm_source_summary <- .estudio_sm_source_summary(meta)
  list(
    nombre          = meta$nombre,
    xlsform_file_id = meta$xlsform_file_id,
    xlsform_file_name = .estudio_file_payload(s, meta$xlsform_file_id)$filename,
    data_file_id    = meta$data_file_id,
    data_file_name  = .estudio_file_payload(s, meta$data_file_id)$filename,
    data_ext        = meta$data_ext,
    n_filas         = meta$n_filas,
    n_columnas      = meta$n_columnas,
    added_at        = meta$added_at,
    processing_mode = as.character(meta$processing_mode %||% NA_character_),
    source_kind     = as.character(meta$source_kind %||% NA_character_),
    survey_id       = as.character(meta$survey_id %||% NA_character_),
    source_alias    = as.character(meta$source_alias %||% NA_character_),
    source_title    = as.character(meta$source_title %||% NA_character_),
    source_channel  = as.character(meta$source_channel %||% NA_character_),
    consent_var     = if (nzchar(consent_var)) consent_var else NA_character_,
    consent_candidates = as.list(.estudio_consent_candidates(xlsform_variables, consent_var)),
    xlsform_variables = xlsform_variables,
    sibling_family_id = as.character(meta$sibling_family_id %||% NA_character_),
    imported_at     = as.character(meta$imported_at %||% NA_character_),
    surveymonkey_source_spec = meta$surveymonkey_source_spec %||% NA,
    surveymonkey_raw_snapshot_file_id = as.character(meta$surveymonkey_raw_snapshot_file_id %||% NA_character_),
    surveymonkey_effective_data_file_id = as.character(meta$surveymonkey_effective_data_file_id %||% NA_character_),
    surveymonkey_workbook_file_id = as.character(meta$surveymonkey_workbook_file_id %||% NA_character_),
    surveymonkey_workbook_snapshot_file_id = as.character(meta$surveymonkey_workbook_snapshot_file_id %||% NA_character_),
    surveymonkey_workbook_import = meta$surveymonkey_workbook_import %||% NA,
    surveymonkey_sav_bundle_file_id = as.character(meta$surveymonkey_sav_bundle_file_id %||% NA_character_),
    surveymonkey_sav_bundle_snapshot_file_id = as.character(meta$surveymonkey_sav_bundle_snapshot_file_id %||% NA_character_),
    surveymonkey_sav_bundle_import = meta$surveymonkey_sav_bundle_import %||% NA,
    surveymonkey_decision_policy = meta$surveymonkey_decision_policy %||% NA,
    surveymonkey_decision_audit = meta$surveymonkey_decision_audit %||% NA,
    surveymonkey_decision_updated_at = as.character(meta$surveymonkey_decision_updated_at %||% NA_character_),
    surveymonkey_refreshed_at = as.character(meta$surveymonkey_refreshed_at %||% NA_character_),
    surveymonkey_last_refresh = meta$surveymonkey_last_refresh %||% NA,
    surveymonkey_source_summary = sm_source_summary %||% NA,
    surveymonkey_sources = if (is.null(sm_source_summary)) list() else sm_source_summary$sources,
    kobo_source_spec = meta$kobo_source_spec %||% NA,
    kobo_effective_data_file_id = as.character(meta$kobo_effective_data_file_id %||% NA_character_),
    logic_template_base = as.character(meta$logic_template_base %||% NA_character_),
    logic_template_applied_at = as.character(meta$logic_template_applied_at %||% NA_character_),
    logic_template_status = as.character(meta$logic_template_status %||% NA_character_),
    response_filter = meta$response_filter %||% NA_character_,
    status          = .estudio_base_status_payload(meta, s),
    multi_integrated = if (is.null(multi_payload)) NA else multi_payload
  )
}

# Payload completo del estudio para GET /api/estudio y session/state.
# IMPORTANTE: jsonlite serializa NULL dentro de un named list como `{}`
# (objeto vacío), lo que rompe el frontend cuando React intenta
# renderizarlo. Usamos NA_character_ para que salga como `null` JSON.
.estudio_payload <- function(sid) {
  bases <- estudio_list_bases(sid)
  s <- session_get(sid, required = FALSE)
  nombre_raw <- if (is.null(s) || is.null(s$estudio)) NULL else s$estudio$nombre
  mode <- if (is.null(s)) "multibase" else estudio_processing_mode(sid)
  max_bases <- if (identical(mode, "independent_siblings") &&
                   exists(".ESTUDIO_INDEPENDENT_SIBLINGS_MAX_BASES", mode = "any")) {
    .ESTUDIO_INDEPENDENT_SIBLINGS_MAX_BASES
  } else {
    .ESTUDIO_MAX_BASES
  }
  list(
    nombre   = if (is.null(nombre_raw) || !nzchar(nombre_raw)) NA_character_ else nombre_raw,
    processing_mode = mode,
    active_base = if (is.null(s)) NA_character_ else as.character(estudio_active_base(sid) %||% NA_character_),
    independent_siblings = if (is.null(s) || is.null(s$estudio)) NA else (s$estudio$independent_siblings %||% NA),
    n_bases  = length(bases),
    bases    = lapply(bases, .estudio_base_payload, s = s),
    max_bases = max_bases
  )
}

.estudio_xlsform_read_sheets <- function(path) {
  sheets <- tryCatch(readxl::excel_sheets(path), error = function(e) character())
  read_sheet <- function(name) {
    if (!(name %in% sheets)) return(data.frame())
    as.data.frame(
      readxl::read_excel(path, sheet = name, .name_repair = "minimal"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  }
  list(
    survey = read_sheet("survey"),
    choices = read_sheet("choices"),
    settings = read_sheet("settings"),
    paper = read_sheet("paper"),
    diagnostico = read_sheet("diagnostico")
  )
}

.estudio_xlsform_write_sheets <- function(sheets, path) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop_api(500, "E_NO_OPENXLSX", "openxlsx no está disponible para escribir XLSForm.")
  }
  wb <- openxlsx::createWorkbook()
  for (sheet_name in c("survey", "choices", "settings", "paper", "diagnostico")) {
    df <- sheets[[sheet_name]]
    if (is.null(df) || (!nrow(df) && !ncol(df) && !(sheet_name %in% c("survey", "choices", "settings")))) next
    df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
    openxlsx::addWorksheet(wb, sheet_name)
    openxlsx::writeData(wb, sheet_name, df)
    openxlsx::freezePane(wb, sheet_name, firstActiveRow = 2)
    if (ncol(df)) openxlsx::setColWidths(wb, sheet_name, cols = seq_len(ncol(df)), widths = "auto")
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  invisible(path)
}

.estudio_logic_columns <- function(survey_a, survey_b) {
  candidates <- c(
    "relevant", "constraint", "constraint_message",
    "required", "required_message", "readonly",
    "calculation", "calculate", "choice_filter",
    "default", "trigger"
  )
  cols <- unique(c(names(survey_a %||% data.frame()), names(survey_b %||% data.frame())))
  cols[grepl("^(relevant|constraint|constraint_message|required|required_message|readonly|calculation|calculate|choice_filter|default|trigger)$",
             cols, ignore.case = FALSE) | cols %in% candidates]
}

.estudio_cell_chr <- function(x) {
  out <- as.character(x %||% "")
  out[is.na(out)] <- ""
  out
}

.estudio_label_col <- function(df) {
  if (!is.data.frame(df) || !ncol(df)) return(NULL)
  hits <- c(intersect(c("label", "label::es"), names(df)), grep("^label", names(df), value = TRUE))
  hits <- unique(hits)
  if (length(hits)) hits[[1]] else NULL
}

.estudio_select_list_for_var <- function(survey, var) {
  if (!is.data.frame(survey) || !all(c("type", "name") %in% names(survey))) return("")
  idx <- which(.estudio_cell_chr(survey$name) == as.character(var))[1]
  if (is.na(idx)) return("")
  type <- .estudio_cell_chr(survey$type[idx])
  if (!grepl("^select_(one|multiple)\\s+", type, perl = TRUE)) return("")
  out <- sub("^select_(one|multiple)\\s+", "", type, perl = TRUE)
  sub("\\s+.*$", "", out, perl = TRUE)
}

.estudio_norm_choice_label <- function(x) {
  x <- .estudio_cell_chr(x)
  x <- tolower(x)
  x_ascii <- iconv(x, from = "", to = "ASCII//TRANSLIT")
  x <- ifelse(is.na(x_ascii), x, x_ascii)
  x <- gsub("[[:punct:]]+", " ", x, perl = TRUE)
  x <- gsub("\\s+", " ", x, perl = TRUE)
  trimws(x)
}

.estudio_choice_label_for_code <- function(choices, list_name, code) {
  label_col <- .estudio_label_col(choices)
  if (!is.data.frame(choices) || is.null(label_col) ||
      !all(c("list_name", "name") %in% names(choices))) {
    return("")
  }
  idx <- which(.estudio_cell_chr(choices$list_name) == as.character(list_name) &
                 .estudio_cell_chr(choices$name) == as.character(code))[1]
  if (is.na(idx)) "" else .estudio_cell_chr(choices[[label_col]][idx])
}

.estudio_choice_code_for_label <- function(choices, list_name, label) {
  label_col <- .estudio_label_col(choices)
  if (!is.data.frame(choices) || is.null(label_col) ||
      !all(c("list_name", "name") %in% names(choices))) {
    return("")
  }
  rows <- choices[.estudio_cell_chr(choices$list_name) == as.character(list_name), , drop = FALSE]
  if (!nrow(rows)) return("")
  target <- .estudio_norm_choice_label(label)
  labels <- .estudio_norm_choice_label(rows[[label_col]])
  idx <- which(labels == target)[1]
  if (is.na(idx)) "" else .estudio_cell_chr(rows$name[idx])
}

.estudio_remap_choice_code <- function(var, code,
                                       template_survey, template_choices,
                                       target_survey, target_choices) {
  var <- as.character(var %||% "")
  code <- as.character(code %||% "")
  if (!nzchar(var) || !nzchar(code)) {
    return(list(code = code, label = "", changed = FALSE))
  }
  template_list <- .estudio_select_list_for_var(template_survey, var)
  target_list <- .estudio_select_list_for_var(target_survey, var)
  if (!nzchar(template_list) || !nzchar(target_list)) {
    return(list(code = code, label = "", changed = FALSE))
  }
  label <- .estudio_choice_label_for_code(template_choices, template_list, code)
  if (!nzchar(label)) return(list(code = code, label = "", changed = FALSE))
  mapped <- .estudio_choice_code_for_label(target_choices, target_list, label)
  if (!nzchar(mapped)) return(list(code = code, label = label, changed = FALSE))
  list(code = mapped, label = label, changed = !identical(as.character(mapped), as.character(code)))
}

.estudio_replace_logic_matches <- function(expr, pattern, rebuild,
                                           template_survey, template_choices,
                                           target_survey, target_choices) {
  matches <- gregexpr(pattern, expr, perl = TRUE)
  starts <- matches[[1]]
  if (!length(starts) || starts[[1]] < 0L) return(list(expression = expr, remaps = list()))
  lens <- attr(matches[[1]], "match.length")
  cap_starts <- attr(matches[[1]], "capture.start")
  cap_lens <- attr(matches[[1]], "capture.length")
  original <- expr
  out <- expr
  offset <- 0L
  remaps <- list()
  for (k in seq_along(starts)) {
    caps <- vapply(seq_len(ncol(cap_starts)), function(c) {
      st <- cap_starts[k, c]
      ln <- cap_lens[k, c]
      if (is.na(st) || st < 0L || is.na(ln) || ln < 0L) "" else substr(original, st, st + ln - 1L)
    }, character(1))
    repl <- rebuild(caps, template_survey, template_choices, target_survey, target_choices)
    if (!is.null(repl$remap) && isTRUE(repl$remap$changed)) {
      remaps[[length(remaps) + 1L]] <- repl$remap
    }
    start <- starts[k] + offset
    end <- start + lens[k] - 1L
    out <- paste0(substr(out, 1L, start - 1L), repl$text, substr(out, end + 1L, nchar(out)))
    offset <- offset + nchar(repl$text) - lens[k]
  }
  list(expression = out, remaps = remaps)
}

.estudio_remap_logic_expression <- function(expr,
                                            template_survey, template_choices,
                                            target_survey, target_choices) {
  expr <- .estudio_cell_chr(expr)
  if (!nzchar(expr) || is.null(template_choices) || is.null(target_choices)) {
    return(list(expression = expr, remaps = data.frame(
      reference = character(), from = character(), to = character(), label = character(),
      stringsAsFactors = FALSE
    )))
  }
  selected_pattern <- "selected\\(\\s*\\$\\{([^}]+)\\}\\s*,\\s*(['\"])([^'\"]+)\\2\\s*\\)"
  selected <- .estudio_replace_logic_matches(
    expr,
    selected_pattern,
    function(caps, template_survey, template_choices, target_survey, target_choices) {
      var <- caps[[1]]
      quote <- caps[[2]]
      old_code <- caps[[3]]
      mapped <- .estudio_remap_choice_code(var, old_code, template_survey, template_choices, target_survey, target_choices)
      list(
        text = sprintf("selected(${%s}, %s%s%s)", var, quote, mapped$code, quote),
        remap = list(reference = var, from = old_code, to = mapped$code, label = mapped$label, changed = mapped$changed)
      )
    },
    template_survey, template_choices, target_survey, target_choices
  )
  expr <- selected$expression

  compare_pattern <- "(\\$\\{([^}]+)\\}\\s*(?:!?=|==)\\s*)(['\"])([^'\"]+)\\3"
  compared <- .estudio_replace_logic_matches(
    expr,
    compare_pattern,
    function(caps, template_survey, template_choices, target_survey, target_choices) {
      prefix <- caps[[1]]
      var <- caps[[2]]
      quote <- caps[[3]]
      old_code <- caps[[4]]
      mapped <- .estudio_remap_choice_code(var, old_code, template_survey, template_choices, target_survey, target_choices)
      list(
        text = paste0(prefix, quote, mapped$code, quote),
        remap = list(reference = var, from = old_code, to = mapped$code, label = mapped$label, changed = mapped$changed)
      )
    },
    template_survey, template_choices, target_survey, target_choices
  )
  remaps <- c(selected$remaps, compared$remaps)
  remaps_df <- if (length(remaps)) {
    do.call(rbind, lapply(remaps, function(x) data.frame(
      reference = as.character(x$reference %||% ""),
      from = as.character(x$from %||% ""),
      to = as.character(x$to %||% ""),
      label = as.character(x$label %||% ""),
      stringsAsFactors = FALSE
    )))
  } else {
    data.frame(reference = character(), from = character(), to = character(), label = character(), stringsAsFactors = FALSE)
  }
  list(expression = compared$expression, remaps = remaps_df)
}

.estudio_apply_template_logic_survey <- function(template_survey, target_survey,
                                                 template_choices = NULL,
                                                 target_choices = NULL,
                                                 clear_target_logic = FALSE) {
  if (!is.data.frame(template_survey) || !is.data.frame(target_survey) ||
      !"name" %in% names(template_survey) || !"name" %in% names(target_survey)) {
    stop_api(400, "E_XLSFORM_SURVEY_INVALIDO",
             "Los XLSForms deben tener hoja survey con columna 'name'.")
  }
  logic_cols <- .estudio_logic_columns(template_survey, target_survey)
  if (!length(logic_cols)) {
    return(list(
      survey = target_survey,
      logic_columns = character(),
      applied_variables = character(),
      skipped_missing_variables = character(),
      changed_cells = 0L,
      missing_references = data.frame(variable = character(), reference = character(), stringsAsFactors = FALSE),
      remapped_choices = data.frame(variable = character(), column = character(), reference = character(), from = character(), to = character(), label = character(), stringsAsFactors = FALSE)
    ))
  }
  for (col in logic_cols) {
    if (!(col %in% names(template_survey))) template_survey[[col]] <- ""
    if (!(col %in% names(target_survey))) target_survey[[col]] <- ""
  }

  template_names <- .estudio_cell_chr(template_survey$name)
  target_names <- .estudio_cell_chr(target_survey$name)
  template_logic <- template_survey[, logic_cols, drop = FALSE]
  has_logic <- apply(template_logic, 1L, function(row) any(nzchar(.estudio_cell_chr(row))))
  candidate_idx <- which(nzchar(template_names) & (has_logic | isTRUE(clear_target_logic)))
  applied <- character()
  skipped <- character()
  changed <- 0L
  missing_refs <- list()
  remapped_choices <- list()

  target_name_set <- unique(target_names[nzchar(target_names)])
  for (i in candidate_idx) {
    var <- template_names[[i]]
    j <- which(target_names == var)[1]
    if (is.na(j)) {
      if (isTRUE(has_logic[[i]])) skipped <- c(skipped, var)
      next
    }
    row_changed <- FALSE
    expr_values <- character()
    for (col in logic_cols) {
      before <- .estudio_cell_chr(target_survey[[col]][j])
      after <- .estudio_cell_chr(template_survey[[col]][i])
      remapped <- .estudio_remap_logic_expression(
        after,
        template_survey = template_survey,
        template_choices = template_choices,
        target_survey = target_survey,
        target_choices = target_choices
      )
      after <- remapped$expression
      if (nrow(remapped$remaps)) {
        tmp <- remapped$remaps
        tmp$variable <- var
        tmp$column <- col
        remapped_choices[[length(remapped_choices) + 1L]] <- tmp[, c("variable", "column", "reference", "from", "to", "label"), drop = FALSE]
      }
      if (!identical(before, after)) {
        target_survey[[col]][j] <- after
        changed <- changed + 1L
        row_changed <- TRUE
      }
      if (nzchar(after)) expr_values <- c(expr_values, after)
    }
    if (isTRUE(has_logic[[i]])) applied <- c(applied, var)
    refs <- unique(unlist(regmatches(expr_values, gregexpr("\\$\\{[^}]+\\}", expr_values, perl = TRUE)), use.names = FALSE))
    refs <- gsub("^\\$\\{|\\}$", "", refs)
    refs <- refs[nzchar(refs) & !(refs %in% target_name_set)]
    if (length(refs)) {
      missing_refs[[length(missing_refs) + 1L]] <- data.frame(
        variable = rep(var, length(refs)),
        reference = refs,
        stringsAsFactors = FALSE
      )
    }
    if (!row_changed) next
  }

  list(
    survey = target_survey,
    logic_columns = logic_cols,
    applied_variables = unique(applied),
    skipped_missing_variables = unique(skipped),
    changed_cells = as.integer(changed),
    missing_references = if (length(missing_refs)) do.call(rbind, missing_refs) else data.frame(variable = character(), reference = character(), stringsAsFactors = FALSE),
    remapped_choices = if (length(remapped_choices)) do.call(rbind, remapped_choices) else data.frame(variable = character(), column = character(), reference = character(), from = character(), to = character(), label = character(), stringsAsFactors = FALSE)
  )
}

.estudio_xlsform_logic_value_count <- function(survey) {
  if (is.null(survey) || !is.data.frame(survey) || !nrow(survey)) return(0L)
  cols <- intersect(
    c("relevant", "constraint", "constraint_message", "readonly",
      "calculation", "calculate", "choice_filter", "default", "trigger"),
    names(survey)
  )
  if (!length(cols)) return(0L)
  values <- trimws(as.character(unlist(survey[, cols, drop = FALSE], use.names = FALSE)))
  values[is.na(values)] <- ""
  as.integer(sum(nzchar(values)))
}

.estudio_xlsform_logic_inventory <- function(sid, bases = NULL) {
  s <- session_get(sid)
  bases <- bases %||% (s$estudio$bases %||% list())
  base_names <- names(bases)
  rows <- list()
  sheets <- list()
  for (base_name in base_names) {
    file_id <- as.character(bases[[base_name]]$xlsform_file_id %||% "")
    if (!nzchar(file_id)) next
    meta <- tryCatch(get_file(sid, file_id), error = function(e) NULL)
    if (is.null(meta) || is.null(meta$path) || !file.exists(meta$path)) next
    xls <- tryCatch(.estudio_xlsform_read_sheets(meta$path), error = function(e) NULL)
    if (is.null(xls) || !is.data.frame(xls$survey)) next
    sheets[[base_name]] <- xls
    rows[[length(rows) + 1L]] <- data.frame(
      base = base_name,
      logic_value_count = .estudio_xlsform_logic_value_count(xls$survey),
      stringsAsFactors = FALSE
    )
  }
  data <- if (length(rows)) {
    do.call(rbind, rows)
  } else {
    data.frame(base = character(), logic_value_count = integer(), stringsAsFactors = FALSE)
  }
  list(data = data, sheets = sheets)
}

.estudio_select_xlsform_logic_template <- function(sid,
                                                   bases = NULL,
                                                   explicit_template = NULL,
                                                   targets = character()) {
  s <- session_get(sid)
  bases <- bases %||% (s$estudio$bases %||% list())
  base_names <- names(bases)
  explicit_template <- as.character(explicit_template %||% "")
  if (nzchar(explicit_template) && explicit_template %in% base_names) {
    inv <- .estudio_xlsform_logic_inventory(sid, bases)
    return(list(base = explicit_template, sheets = inv$sheets[[explicit_template]], inventory = inv$data))
  }

  family <- s$estudio$independent_siblings %||% list()
  family_template <- as.character(family$template_base %||% "")
  inv <- .estudio_xlsform_logic_inventory(sid, bases)
  if (!nrow(inv$data)) return(list(base = "", sheets = NULL, inventory = inv$data))

  if (nzchar(family_template) && family_template %in% base_names) {
    return(list(base = family_template, sheets = inv$sheets[[family_template]], inventory = inv$data))
  }

  candidates <- inv$data
  non_targets <- candidates[!(candidates$base %in% targets), , drop = FALSE]
  if (nrow(non_targets)) candidates <- non_targets
  candidates <- candidates[order(-candidates$logic_value_count, candidates$base), , drop = FALSE]
  template_base <- as.character(candidates$base[1] %||% "")
  list(base = template_base, sheets = inv$sheets[[template_base]], inventory = inv$data)
}

estudio_sync_shared_xlsform_logic_if_needed <- function(sid,
                                                        targets = NULL,
                                                        min_delta = 1L) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s) || !estudio_is_independent_siblings(sid)) {
    return(list(ok = TRUE, applied = FALSE, reason = "not_independent_siblings"))
  }
  family <- s$estudio$independent_siblings %||% list()
  if (!isTRUE(family$shared_logic)) {
    return(list(ok = TRUE, applied = FALSE, reason = "shared_logic_disabled"))
  }
  bases <- s$estudio$bases %||% list()
  base_names <- names(bases)
  if (length(base_names) < 2L) {
    return(list(ok = TRUE, applied = FALSE, reason = "not_enough_bases"))
  }
  targets <- as.character(targets %||% base_names)
  targets <- targets[nzchar(targets) & targets %in% base_names]
  if (!length(targets)) {
    targets <- as.character(s$estudio$active_base %||% "")
    targets <- targets[nzchar(targets) & targets %in% base_names]
  }
  if (!length(targets)) {
    return(list(ok = TRUE, applied = FALSE, reason = "no_targets"))
  }

  selected <- .estudio_select_xlsform_logic_template(
    sid,
    bases = bases,
    explicit_template = NULL,
    targets = targets
  )
  template_base <- as.character(selected$base %||% "")
  inventory <- selected$inventory
  if (!nzchar(template_base) || !nrow(inventory)) {
    return(list(ok = TRUE, applied = FALSE, reason = "template_unavailable"))
  }
  template_count <- inventory$logic_value_count[match(template_base, inventory$base)][1]
  if (is.na(template_count) || template_count <= 0L) {
    return(list(ok = TRUE, applied = FALSE, reason = "template_without_logic"))
  }
  target_counts <- inventory$logic_value_count[match(targets, inventory$base)]
  target_counts[is.na(target_counts)] <- 0L
  needs <- targets[(template_count - target_counts) >= as.integer(min_delta)]
  needs <- setdiff(needs, template_base)
  if (!length(needs)) {
    return(list(
      ok = TRUE,
      applied = FALSE,
      reason = "already_synced",
      template_base = template_base,
      logic_value_count = as.integer(template_count)
    ))
  }

  out <- estudio_apply_template_xlsform_logic(
    sid,
    template_base = template_base,
    targets = needs,
    clear_target_logic = FALSE
  )
  out$applied <- length(out$updated_bases %||% list()) > 0L
  out$reason <- ""
  out
}

estudio_apply_template_xlsform_logic <- function(sid,
                                                 template_base = NULL,
                                                 targets = NULL,
                                                 clear_target_logic = FALSE) {
  if (!estudio_is_independent_siblings(sid)) {
    stop_api(409, "E_NOT_INDEPENDENT_SIBLINGS",
             "Esta acción solo está disponible para bases hermanas independientes.")
  }
  s <- session_get(sid)
  bases <- s$estudio$bases %||% list()
  base_names <- names(bases)
  if (length(base_names) < 2L) {
    stop_api(409, "E_NOT_ENOUGH_BASES",
             "Se necesitan al menos dos bases hermanas para aplicar lógica compartida.")
  }
  target_hint <- as.character(targets %||% character(0))
  target_hint <- target_hint[nzchar(target_hint) & target_hint %in% base_names]
  selected_template <- .estudio_select_xlsform_logic_template(
    sid,
    bases = bases,
    explicit_template = template_base,
    targets = target_hint
  )
  template_base <- as.character(selected_template$base %||% "")
  if (!nzchar(template_base)) {
    stop_api(404, "E_TEMPLATE_BASE_NOT_FOUND", "No encontré la base plantilla indicada.")
  }
  targets <- as.character(targets %||% setdiff(base_names, template_base))
  targets <- targets[nzchar(targets) & targets %in% base_names & targets != template_base]
  if (!length(targets)) {
    stop_api(400, "E_NO_TARGETS", "No hay bases hermanas destino para aplicar la lógica.")
  }

  template_meta <- get_file(sid, bases[[template_base]]$xlsform_file_id)
  template_sheets <- .estudio_xlsform_read_sheets(template_meta$path)
  template_survey <- template_sheets$survey
  if (!is.data.frame(template_survey) || !"name" %in% names(template_survey)) {
    stop_api(400, "E_TEMPLATE_XLSFORM_INVALIDO", "La base plantilla no tiene una hoja survey válida.")
  }

  now <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  rows <- list()
  updated <- character()
  for (target in targets) {
    target_base <- bases[[target]]
    target_meta <- get_file(sid, target_base$xlsform_file_id)
    target_sheets <- .estudio_xlsform_read_sheets(target_meta$path)
    applied <- .estudio_apply_template_logic_survey(
      template_survey = template_survey,
      target_survey = target_sheets$survey,
      template_choices = template_sheets$choices,
      target_choices = target_sheets$choices,
      clear_target_logic = isTRUE(clear_target_logic)
    )
    rows[[length(rows) + 1L]] <- list(
      base = target,
      applied_variables = as.list(applied$applied_variables),
      skipped_missing_variables = as.list(applied$skipped_missing_variables),
      missing_references = .estudio_records_payload(applied$missing_references),
      n_applied_variables = as.integer(length(applied$applied_variables)),
      n_skipped_missing_variables = as.integer(length(applied$skipped_missing_variables)),
      n_missing_references = as.integer(nrow(applied$missing_references)),
      changed_cells = as.integer(applied$changed_cells),
      logic_columns = as.list(applied$logic_columns),
      remapped_choices = .estudio_records_payload(applied$remapped_choices),
      n_remapped_choices = as.integer(nrow(applied$remapped_choices))
    )
    if (applied$changed_cells <= 0L) next

    target_sheets$survey <- applied$survey
    out_path <- tempfile(sprintf("%s_logic_", target), fileext = ".xlsx")
    on.exit(unlink(out_path), add = TRUE)
    .estudio_xlsform_write_sheets(target_sheets, out_path)
    raw <- readBin(out_path, what = "raw", n = file.info(out_path)$size)
    original_name <- sprintf("%s_xlsform_logica_%s.xlsx", target, format(Sys.time(), "%Y%m%d_%H%M%S", tz = "UTC"))
    new_meta <- save_upload(sid, "xlsform", original_name, raw)
    new_inst <- reporte_instrumento(path = new_meta$path)

    data_meta <- get_file(sid, target_base$data_file_id)
    data_df <- .read_data_from_path(data_meta$path, data_meta$ext)
    data_df <- normalize_data_for_xlsform(data_df, new_inst)
    .carga_assert_data_xlsform_compatible(data_df, new_inst)
    new_rp_data <- reporte_data(data_df, instrumento = new_inst)

    estudio_preserve_original_base_files(sid, target)
    estudio_replace_base_files(
      sid,
      target,
      xlsform_file_id = new_meta$file_id,
      rp_inst = new_inst,
      rp_data = new_rp_data,
      n_filas = as.integer(nrow(data_df)),
      n_columnas = as.integer(ncol(data_df))
    )
    updated <- c(updated, target)
  }

  s <- session_get(sid)
  family <- s$estudio$independent_siblings %||% list()
  family$template_base <- template_base
  family$logic_policy <- "shared_template"
  family$shared_logic <- TRUE
  family$status <- "xlsform_logic_applied"
  family$logic_applied_at <- now
  family$logic_sync <- list(
    kind = "xlsform_logic",
    template_base = template_base,
    targets = as.list(targets),
    updated_bases = as.list(updated),
    clear_target_logic = isTRUE(clear_target_logic),
    applied_at = now,
    results = rows
  )
  family$updated_at <- now
  s$estudio$independent_siblings <- family
  for (target in targets) {
    meta <- s$estudio$bases[[target]]
    meta$logic_template_base <- template_base
    meta$logic_template_applied_at <- now
    meta$logic_template_status <- if (target %in% updated) "updated" else "unchanged"
    s$estudio$bases[[target]] <- meta
  }
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s

  list(
    ok = TRUE,
    template_base = template_base,
    targets = as.list(targets),
    updated_bases = as.list(updated),
    n_targets = as.integer(length(targets)),
    n_updated_bases = as.integer(length(updated)),
    results = rows,
    estudio = .estudio_payload(sid)
  )
}

mount_estudio <- function(pr) {
  pr |>
    plumber::pr_get("/api/estudio", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) {
        # Sin sesión todavía: devolvemos un estudio vacío (mejor que 404).
        return(list(
          nombre = NULL,
          processing_mode = "multibase",
          active_base = NULL,
          n_bases = 0L,
          bases = list(),
          max_bases = .ESTUDIO_MAX_BASES
        ))
      }
      .estudio_payload(sid)
    })) |>
    plumber::pr_get("/api/estudio/processing-suggestions", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) {
        return(list(
          ok = TRUE,
          source = "monitoreo",
          project_kind = NA_character_,
          profile_family = NA_character_,
          profile_variant = NA_character_,
          has_suggestions = FALSE,
          message = "Abre un proyecto con Monitoreo para recibir sugerencias de Procesamiento.",
          summary = list(
            monitoring_sources_count = 0L,
            survey_sources_count = 0L,
            actors_count = 0L,
            surveymonkey_groups = 0L,
            kobo_groups = 0L
          ),
          warnings = list(),
          groups = list()
        ))
      }
      .estudio_processing_suggestions_payload(sid)
    })) |>
    plumber::pr_handle("PATCH", "/api/estudio", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) stop_api(404, "E_NO_SESSION", "Sin sesión.")
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      nombre <- parsed$nombre
      estudio_set_nombre(sid, nombre)
      .estudio_payload(sid)
    })) |>
    plumber::pr_post("/api/estudio/base", wrap_endpoint(function(req, res, ...) {
      # Agrega una base al estudio actual. Lee xlsform y data del file
      # store usando los file_ids que el frontend subió previamente.
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) {
        # Si no hay sesión aún, creamos una para arrancar el estudio.
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      nombre          <- as.character(parsed$nombre %||% "")
      xlsform_file_id <- as.character(parsed$xlsform_file_id %||% "")
      data_file_id    <- as.character(parsed$data_file_id %||% "")
      # Si el frontend no manda nombre, generamos uno automático libre
      # (base_1, base_2, …). Esto habilita el flujo de "+ Agregar otra
      # base" sin fricción — el usuario renombra después.
      if (!nzchar(nombre)) nombre <- estudio_next_auto_name(sid)
      if (!nzchar(xlsform_file_id)) stop_api(400, "E_MISSING_XLSFORM", "Falta 'xlsform_file_id'.")
      if (!nzchar(data_file_id))    stop_api(400, "E_MISSING_DATA",    "Falta 'data_file_id'.")

      # Resolver los archivos del file store de la sesión.
      xls_meta <- get_file(sid, xlsform_file_id)
      dat_meta <- get_file(sid, data_file_id)
      data_ext <- tolower(dat_meta$ext %||% tools::file_ext(dat_meta$original_name))
      if (!nzchar(data_ext)) data_ext <- tolower(tools::file_ext(dat_meta$path))

      # Parsear instrumento + data igual que hace /api/system/demo.
      rp_inst <- reporte_instrumento(path = xls_meta$path)
      data_df <- .read_data_from_path(dat_meta$path, dat_meta$ext)
      data_df <- normalize_data_for_xlsform(data_df, rp_inst)
      .carga_assert_data_xlsform_compatible(data_df, rp_inst)
      rp_data <- reporte_data(data_df, instrumento = rp_inst)

      base_meta <- estudio_add_base(
        sid,
        nombre          = nombre,
        xlsform_file_id = xlsform_file_id,
        data_file_id    = data_file_id,
        data_ext        = data_ext,
        rp_data         = rp_data,
        rp_inst         = rp_inst,
        n_filas         = as.integer(nrow(data_df)),
        n_columnas      = as.integer(ncol(data_df))
      )

      # Si es la primera base, también seteamos analitica_prep_ok y
      # analitica_fuente para preservar el contrato legacy con el frontend.
      if (length(estudio_list_bases(sid)) == 1L) {
        session_set(sid, "analitica_prep_ok", TRUE)
        session_set(sid, "analitica_fuente", sprintf("estudio:%s", nombre))
      }

      list(
        ok        = TRUE,
        base      = .estudio_base_payload(base_meta, session_get(sid, required = FALSE)),
        n_bases   = length(estudio_list_bases(sid)),
        max_bases = .ESTUDIO_MAX_BASES
      )
    })) |>
    plumber::pr_delete("/api/estudio/base/<nombre>", wrap_endpoint(function(req, res, nombre) {
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) stop_api(404, "E_NO_SESSION", "Sin sesión.")
      estudio_remove_base(sid, as.character(nombre))
      list(ok = TRUE, n_bases = length(estudio_list_bases(sid)))
    })) |>

    # Convierte un single-base legacy (XLSForm + data cargados via
    # /api/carga/instrumento + /api/carga/data) en un estudio multi-base
    # con UNA base inicial con el nombre que el usuario elija. Reutiliza
    # los archivos ya subidos al file store — el usuario no vuelve a
    # subir. Body: { nombre: "docentes" }.
    plumber::pr_post("/api/estudio/from-session", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      s <- session_get(sid)

      # Si ya hay un estudio inicializado con bases, esto es no-op — el
      # endpoint solo convierte single-base legacy.
      if (!is.null(s$estudio) && length(s$estudio$bases) > 0L) {
        stop_api(409, "E_ALREADY_MULTIBASE",
                 "Este estudio ya tiene bases. Usa POST /api/estudio/base para agregar otras.")
      }

      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      nombre <- as.character(parsed$nombre %||% "")
      # Auto-generar nombre si el frontend no lo manda — esto es el
      # caso cuando se convierte silenciosamente single → multi desde
      # el botón "+ Agregar otra base".
      if (!nzchar(nombre)) nombre <- estudio_next_auto_name(sid)
      if (grepl("\\$|\\s", nombre)) {
        stop_api(400, "E_BASE_NOMBRE_INVALIDO",
                 "El nombre no puede contener '$' ni espacios.")
      }

      # Tomar los últimos files del session store con kind correcto.
      files <- s$files %||% list()
      xls_meta <- NULL
      dat_meta <- NULL
      for (fid in names(files)) {
        f <- files[[fid]]
        if (identical(f$kind, "xlsform")) xls_meta <- f
        if (f$kind %in% c("data", "sav"))  dat_meta <- f
      }
      if (is.null(xls_meta)) stop_api(409, "E_NO_XLSFORM", "No hay XLSForm cargado en la sesión.")
      if (is.null(dat_meta)) stop_api(409, "E_NO_DATA",    "No hay base de datos cargada en la sesión.")

      # Re-parsear con reporte_instrumento + reporte_data (el single-base
      # legacy usaba `leer_instrumento_xlsform` que es más ligero y no
      # produce el objeto rp_inst que el estudio multi-base necesita).
      rp_inst <- reporte_instrumento(path = xls_meta$path)
      data_df <- .read_data_from_path(dat_meta$path, dat_meta$ext)
      data_df <- normalize_data_for_xlsform(data_df, rp_inst)
      .carga_assert_data_xlsform_compatible(data_df, rp_inst)
      rp_data <- reporte_data(data_df, instrumento = rp_inst)

      data_ext <- tolower(dat_meta$ext %||% tools::file_ext(dat_meta$original_name %||% dat_meta$path))

      base_meta <- estudio_add_base(
        sid,
        nombre          = nombre,
        xlsform_file_id = xls_meta$file_id,
        data_file_id    = dat_meta$file_id,
        data_ext        = data_ext,
        rp_data         = rp_data,
        rp_inst         = rp_inst,
        n_filas         = as.integer(nrow(data_df)),
        n_columnas      = as.integer(ncol(data_df))
      )

      # Limpiar artefactos single-base que ya quedaron obsoletos tras la
      # promoción a multi-base (rp_data_sources ya tiene el mirror).
      session_set(sid, "instrumento",   NULL)
      session_set(sid, "inst_limpieza", NULL)
      session_set(sid, "data_raw_meta", NULL)
      # analitica_prep_ok ya lo setea estudio_add_base cuando es primera.
      if (length(estudio_list_bases(sid)) == 1L) {
        session_set(sid, "analitica_prep_ok", TRUE)
        session_set(sid, "analitica_fuente", sprintf("estudio:%s", nombre))
      }

      list(
        ok        = TRUE,
        base      = .estudio_base_payload(base_meta, session_get(sid, required = FALSE)),
        n_bases   = length(estudio_list_bases(sid)),
        max_bases = .ESTUDIO_MAX_BASES
      )
    })) |>
    plumber::pr_get("/api/estudio/active-base", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) {
        return(list(active = NULL, options = list(), processing_mode = "multibase"))
      }
      bases <- names(estudio_list_bases(sid))
      active <- estudio_active_base(sid)
      list(
        active = as.character(active %||% NA_character_),
        options = as.list(bases),
        processing_mode = estudio_processing_mode(sid)
      )
    })) |>
    plumber::pr_post("/api/estudio/active-base", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) stop_api(404, "E_NO_SESSION", "Sin sesión.")
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      source <- as.character(parsed$base_nombre %||% parsed$source %||% parsed$active %||% "")
      if (!nzchar(source)) stop_api(400, "E_MISSING_BASE", "Falta 'base_nombre' en el body.")
      estudio_active_base_set(sid, source)
      list(
        ok = TRUE,
        active = as.character(estudio_active_base(sid) %||% NA_character_),
        options = as.list(names(estudio_list_bases(sid))),
        processing_mode = estudio_processing_mode(sid)
      )
    })) |>
    plumber::pr_post("/api/estudio/independent-siblings/promote", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) stop_api(404, "E_NO_SESSION", "Sin sesión.")
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "{}")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      estudio_promote_independent_siblings(
        sid,
        active_base = parsed$active_base %||% parsed$base_nombre %||% parsed$source,
        nombre_nuevo = parsed$nombre_nuevo %||% parsed$rename_to,
        source_alias = parsed$source_alias %||% parsed$alias,
        source_title = parsed$source_title,
        survey_id = parsed$survey_id,
        source_kind = parsed$source_kind %||% "existing_project",
        sibling_family_id = parsed$sibling_family_id
      )
      .estudio_payload(sid)
    })) |>
    plumber::pr_post("/api/estudio/independent-siblings/apply-template-logic", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) stop_api(404, "E_NO_SESSION", "Sin sesión.")
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "{}")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      estudio_apply_template_xlsform_logic(
        sid,
        template_base = parsed$template_base %||% parsed$base_plantilla,
        targets = parsed$targets %||% parsed$bases_destino,
        clear_target_logic = isTRUE(parsed$clear_target_logic)
      )
    })) |>
    plumber::pr_get("/api/estudio/codif-source", wrap_endpoint(function(req, res) {
      # Devuelve la base actualmente activa para codificación + las
      # opciones disponibles (todas las bases del estudio).
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) {
        return(list(active = NULL, options = list(), processing_mode = "multibase"))
      }
      bases <- names(estudio_list_bases(sid))
      list(
        active = as.character(estudio_active_base(sid) %||% NA_character_),
        options = as.list(bases),
        processing_mode = estudio_processing_mode(sid)
      )
    })) |>
    plumber::pr_post("/api/estudio/codif-source", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) stop_api(404, "E_NO_SESSION", "Sin sesión.")
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      source <- as.character(parsed$source %||% "")
      if (!nzchar(source)) stop_api(400, "E_MISSING_SOURCE", "Falta 'source' en el body.")
      codif_source_set(sid, source)
      list(
        ok = TRUE,
        active = as.character(estudio_active_base(sid) %||% NA_character_),
        options = as.list(names(estudio_list_bases(sid))),
        processing_mode = estudio_processing_mode(sid)
      )
    })) |>
    plumber::pr_handle("PATCH", "/api/estudio/base/<nombre>", wrap_endpoint(function(req, res, nombre, ...) {
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) stop_api(404, "E_NO_SESSION", "Sin sesión.")
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      nombre_nuevo <- as.character(parsed$nombre_nuevo %||% "")
      if (!nzchar(nombre_nuevo)) stop_api(400, "E_MISSING_NOMBRE", "Falta 'nombre_nuevo'.")
      estudio_rename_base(sid, as.character(nombre), nombre_nuevo)
      .estudio_payload(sid)
    })) |>
    plumber::pr_handle("PATCH", "/api/estudio/base/<nombre>/metadata", wrap_endpoint(function(req, res, nombre, ...) {
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) stop_api(404, "E_NO_SESSION", "Sin sesión.")
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      estudio_update_base_metadata(sid, as.character(nombre), parsed)
      .estudio_payload(sid)
    })) |>

    # PATCH /api/estudio/base/<nombre>/files
    # Reemplaza el XLSForm y/o la data de una base existente. El usuario
    # puede enviar xlsform_file_id, data_file_id o ambos. Re-parsea lo que
    # cambia y actualiza los maps internos. Invalida artefactos derivados
    # (evaluación, plan_result, analítica preparada) porque la base
    # cambió.
    plumber::pr_handle("PATCH", "/api/estudio/base/<nombre>/files",
      wrap_endpoint(function(req, res, nombre, ...) {
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) stop_api(404, "E_NO_SESSION", "Sin sesión.")
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      xls_fid <- as.character(parsed$xlsform_file_id %||% "")
      dat_fid <- as.character(parsed$data_file_id    %||% "")
      if (!nzchar(xls_fid) && !nzchar(dat_fid)) {
        stop_api(400, "E_NOTHING_TO_REPLACE",
                 "Envia al menos xlsform_file_id o data_file_id.")
      }

      # Necesitamos el instrumento (nuevo o actual) para re-parsear la
      # data, porque reporte_data depende de rp_inst.
      s <- session_get(sid)
      base_actual <- s$estudio$bases[[as.character(nombre)]]
      if (is.null(base_actual)) stop_api(404, "E_BASE_NOT_FOUND",
                                         sprintf("Base '%s' no existe.", nombre))

      new_rp_inst <- NULL
      if (nzchar(xls_fid)) {
        xls_meta <- get_file(sid, xls_fid)
        new_rp_inst <- reporte_instrumento(path = xls_meta$path)
      }
      # Si no se reemplaza XLSForm, uso el que ya estaba para re-parsear
      # data (si es que se reemplaza).
      rp_inst_efectivo <- new_rp_inst %||% s$rp_inst_sources[[as.character(nombre)]]

      new_rp_data <- NULL
      new_data_ext <- NULL
      n_filas_new <- NA_integer_
      n_cols_new  <- NA_integer_
      if (nzchar(dat_fid)) {
        dat_meta <- get_file(sid, dat_fid)
        new_data_ext <- tolower(dat_meta$ext %||% tools::file_ext(dat_meta$original_name %||% dat_meta$path))
        data_df <- .read_data_from_path(dat_meta$path, dat_meta$ext)
        data_df <- normalize_data_for_xlsform(data_df, rp_inst_efectivo)
        .carga_assert_data_xlsform_compatible(data_df, rp_inst_efectivo)
        new_rp_data <- reporte_data(data_df, instrumento = rp_inst_efectivo)
        n_filas_new <- as.integer(nrow(data_df))
        n_cols_new  <- as.integer(ncol(data_df))
      } else if (nzchar(xls_fid)) {
        # Reemplazo solo de XLSForm: re-parsear la data actual con el
        # nuevo instrumento para mantener consistencia.
        dat_meta <- get_file(sid, base_actual$data_file_id)
        data_df <- .read_data_from_path(dat_meta$path, dat_meta$ext)
        data_df <- normalize_data_for_xlsform(data_df, new_rp_inst)
        .carga_assert_data_xlsform_compatible(data_df, new_rp_inst)
        new_rp_data <- reporte_data(data_df, instrumento = new_rp_inst)
        n_filas_new <- as.integer(nrow(data_df))
        n_cols_new  <- as.integer(ncol(data_df))
      }

      estudio_replace_base_files(
        sid, as.character(nombre),
        xlsform_file_id = if (nzchar(xls_fid)) xls_fid else NULL,
        data_file_id    = if (nzchar(dat_fid)) dat_fid else NULL,
        data_ext        = new_data_ext,
        rp_data         = new_rp_data,
        rp_inst         = new_rp_inst,
        n_filas         = n_filas_new,
        n_columnas      = n_cols_new
      )

      # Invalidar artefactos que dependían de la versión anterior.
      session_set(sid, "evaluacion",  NULL)
      session_set(sid, "plan_result", NULL)
      session_set(sid, "analitica_prep_ok", FALSE)

      .estudio_payload(sid)
    })) |>

    # POST /api/estudio/init
    # Marca la sesión como "va a ser multi-base" creando un estudio
    # vacío (sin bases todavía). Habilita que el usuario active el
    # toggle antes de subir archivos — la UI muestra el BasesPanel en
    # estado vacío con el form de "Agregar base" listo. Si ya existe
    # un estudio con bases, no hace nada (idempotente).
    plumber::pr_post("/api/estudio/init", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      estudio_ensure(sid)
      .estudio_payload(sid)
    })) |>

    # POST /api/estudio/downgrade-to-single
    # Si el estudio tiene exactamente 1 base, la "baja" al estado
    # single-base legacy (s$instrumento, s$data_raw_meta, s$rp_data,
    # s$rp_inst) y destruye el estudio. Permite al usuario volver al
    # flujo de carga simple sin perder los archivos cargados. Rechaza
    # si hay 0 bases (nada que degradar) o >1 bases (no es reversible
    # sin pérdida).
    plumber::pr_post("/api/estudio/downgrade-to-single", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      if (is.null(s$estudio)) {
        stop_api(409, "E_NOT_MULTIBASE", "No hay estudio activo para degradar.")
      }
      # Caso especial: estudio vacío (init sin haber subido bases).
      # Apagar el toggle solo destruye el estudio — no hay archivos que
      # restaurar porque nunca se crearon bases.
      if (length(s$estudio$bases) == 0L) {
        session_set(sid, "estudio", NULL)
        session_set(sid, "rp_data_sources", list())
        session_set(sid, "rp_inst_sources", list())
        return(list(ok = TRUE))
      }
      if (length(s$estudio$bases) > 1L) {
        stop_api(409, "E_MULTIPLE_BASES",
                 "El estudio tiene varias bases. Quita las extras antes de volver al modo simple.")
      }

      base <- s$estudio$bases[[1]]
      xls_meta <- get_file(sid, base$xlsform_file_id)
      dat_meta <- get_file(sid, base$data_file_id)

      # Restaurar single-base state que el frontend consume desde
      # /session/state para renderizar los dos boxes como "cargados".
      inst_light <- leer_instrumento_xlsform(xls_meta$path)
      session_set(sid, "instrumento", inst_light)
      session_set(sid, "data_raw_meta", list(
        file_id = base$data_file_id,
        path    = dat_meta$path,
        ext     = base$data_ext %||% dat_meta$ext %||% tolower(tools::file_ext(dat_meta$original_name %||% dat_meta$path))
      ))
      # rp_data / rp_inst ya están en s (mirror de la primera base). Los
      # dejamos intactos: la analítica sigue operando como legacy single.

      # Destruir el estudio (y los maps _sources).
      session_set(sid, "estudio",         NULL)
      session_set(sid, "rp_data_sources", list())
      session_set(sid, "rp_inst_sources", list())
      session_set(sid, "analitica_fuente", "legacy:single")

      list(ok = TRUE)
    }))
}
