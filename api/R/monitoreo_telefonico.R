# =============================================================================
# monitoreo_telefonico.R — semántica exclusiva del monitoreo telefónico
# =============================================================================
#
# Unidad 4.2 del plan de mejoras: el monitoreo telefónico es un producto
# independiente de acreditación, pero su lógica vivía regada como condicionales
# `family == "telefonico"` dentro de monitoreo_engine.R (archivo congelado a
# crecimiento). Este archivo concentra la semántica que es EXCLUSIVA de la
# familia telefónica; el engine conserva solo el dispatch genérico de familia
# y lo verdaderamente compartido con acreditación.
#
# Qué vive aquí (extraído verbatim del engine, mismos nombres, mismo paquete):
#   - Filtros real/prueba y de efectividad de plataforma (masks).
#   - Conflictos de llave telefónica y conciliación barrido↔Kobo.
#   - Base telefónica, cuotas/metas por variable y los bloques de la hoja
#     "monitoreo_telefonico" del workbook de reportes.
#   - Data frames de publicación telefónica (producción, cliente e interna).
#   - El job runner del PDF de avance telefónico (sin dispatch por familia).
#
# El render del PDF (build del modelo + dibujo) sigue en
# monitoreo_telefonico_report_pdf.R; el mount HTTP propio vive en
# router_monitoreo_telefonico.R (/api/monitoreo/telefonico/*).
# =============================================================================

# --- Filtros de efectividad: real/prueba y filtro efectivo de plataforma ----

.monitoreo_report_platform_test_mask <- function(df, profile = list()) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(logical(0))
  profile <- monitoreo_normalize_profile(profile)
  if (!identical(profile$family %||% "", "telefonico")) return(rep(FALSE, nrow(df)))
  filter <- profile$platform_test_filter %||% list()
  field <- .monitoreo_scalar(filter$variable %||% "", "")
  col <- .monitoreo_report_filter_column(df, field)
  if (!nzchar(col) && !nzchar(field)) {
    clean_names <- .monitoreo_text_key(names(df))
    label_map <- .monitoreo_variable_label_map(df)
    labels <- rep("", length(clean_names))
    names(labels) <- names(df)
    if (length(label_map)) {
      matched_labels <- label_map[names(df)]
      labels[!is.na(matched_labels)] <- matched_labels[!is.na(matched_labels)]
    }
    clean_labels <- .monitoreo_text_key(labels)
    haystack <- paste(clean_names, clean_labels)
    idx <- which(grepl("testreal|test real|test_real|prueba|registro prueba|tipo registro|modo prueba", haystack))
    if (length(idx)) col <- names(df)[idx[[1L]]]
  }
  if (!nzchar(col) && !nzchar(field)) {
    idx <- which(vapply(df, function(values) {
      if (!is.character(values) && !is.factor(values)) return(FALSE)
      raw_values <- unique(trimws(as.character(values %||% "")))
      raw_values <- raw_values[nzchar(raw_values) & !is.na(raw_values)]
      if (!length(raw_values) || length(raw_values) > 12L) return(FALSE)
      clean_values <- .monitoreo_text_key(gsub("\\s*[|/]\\s*", " ", raw_values))
      has_test <- any(vapply(strsplit(clean_values, "\\s+"), function(tokens) {
        any(tokens[nzchar(tokens)] %in% c("test", "prueba", "testing", "dummy", "piloto"))
      }, logical(1)))
      has_real <- any(clean_values %in% c("real", "entrevista real") | grepl("\\breal\\b", clean_values))
      has_test && has_real
    }, logical(1)))
    if (length(idx)) col <- names(df)[idx[[1L]]]
  }
  if (!nzchar(col)) return(rep(FALSE, nrow(df)))
  raw <- as.character(df[[col]] %||% "")
  raw[is.na(raw)] <- ""
  clean <- .monitoreo_text_key(raw)
  clean_compound <- .monitoreo_text_key(gsub("\\s*[|/]\\s*", " ", raw))
  real_values <- .monitoreo_text_key(.monitoreo_chr_vec(filter$real_values %||% filter$include_values %||% filter$valid_values))
  real_values <- real_values[nzchar(real_values)]
  if (length(real_values)) {
    return(nzchar(clean) & !(clean %in% real_values | clean_compound %in% real_values))
  }
  test_values <- .monitoreo_text_key(.monitoreo_chr_vec(filter$values %||% filter$test_values %||% filter$exclude_values))
  test_values <- test_values[nzchar(test_values)]
  if (!length(test_values)) test_values <- c("test", "prueba", "testing", "dummy", "piloto")
  token_match <- vapply(strsplit(clean_compound, "\\s+"), function(tokens) {
    any(tokens[nzchar(tokens)] %in% test_values)
  }, logical(1))
  clean %in% test_values | clean_compound %in% test_values | token_match
}

.monitoreo_report_effective_filter_mask <- function(df, profile = list()) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(logical(0))
  profile <- monitoreo_normalize_profile(profile)
  filter <- profile$platform_effective_filter %||% list()
  if (!identical(profile$family %||% "", "telefonico")) {
    return(rep(TRUE, nrow(df)))
  }
  not_test <- !.monitoreo_report_platform_test_mask(df, profile)
  if (!isTRUE(filter$enabled)) return(not_test)
  # Todos los criterios declarados, no solo el primero: una efectiva cumple
  # todo lo que el estudio pide. Ver `monitoreo_filtro_efectiva.R`.
  criterios <- .monitoreo_effective_criteria(filter, profile)
  if (!length(criterios)) return(not_test)
  .monitoreo_effective_criteria_mask(df, criterios) & not_test
}

# --- Conflictos de llave y conciliación barrido↔Kobo -------------------------

# Par (código del enlace, código escrito a mano) por respuesta. Cuando difieren,
# el encuestador abrió el enlace de otro caso al levantar la encuesta y el cruce
# apunta a la persona equivocada. La detección ya existía pero solo servía para
# descontar el caso en silencio; ahora también alimenta un bloque reportable.
# Ver docs/plan-monitoreo-telefonico-2026-07.md §7.
.monitoreo_report_phone_key_pairs <- function(response_rows, profile = list()) {
  vacio <- list(cv_id = character(0), manual_code = character(0))
  if (is.null(response_rows) || !is.data.frame(response_rows) || !nrow(response_rows)) return(vacio)
  source_label_maps <- .monitoreo_source_variable_label_map(response_rows)
  clean_names <- .monitoreo_text_key(names(response_rows))
  global_labels <- .monitoreo_variable_label_map(response_rows)
  labels <- rep("", length(clean_names))
  names(labels) <- names(response_rows)
  if (length(global_labels)) {
    matched_labels <- global_labels[names(response_rows)]
    labels[!is.na(matched_labels)] <- matched_labels[!is.na(matched_labels)]
  }
  clean_labels <- .monitoreo_text_key(labels)

  first_values_from_positions <- function(positions) {
    out <- rep("", nrow(response_rows))
    positions <- unique(positions[positions > 0L & positions <= ncol(response_rows)])
    if (!length(positions)) return(out)
    for (pos in positions) {
      values <- trimws(as.character(response_rows[[pos]] %||% ""))
      values[is.na(values)] <- ""
      needs <- !nzchar(out) & nzchar(values)
      if (any(needs)) out[needs] <- values[needs]
    }
    out
  }

  cv_aliases <- .monitoreo_text_key(c(
    "cv_id", "custom_value", "recipient_cv_id", "recipient_cv_codpulso", "recipient_custom_value"
  ))
  cv_id <- first_values_from_positions(which(clean_names %in% cv_aliases))

  manual_aliases <- .monitoreo_text_key(c(
    "q0034", "q034", "q34", "codigo pulso final", "código pulso final", "codpulso final"
  ))
  manual_positions <- which(clean_names %in% manual_aliases)
  label_positions <- which(
    grepl("codigo.*pulso|cod.*pulso", clean_names) |
      grepl("codigo.*pulso|cod.*pulso", clean_labels)
  )
  if (length(source_label_maps)) {
    source_label_match <- vapply(seq_along(clean_names), function(pos) {
      any(vapply(source_label_maps, function(label_map) {
        label <- if (names(response_rows)[[pos]] %in% names(label_map)) {
          .monitoreo_scalar(label_map[[names(response_rows)[[pos]]]], "")
        } else {
          ""
        }
        grepl("codigo.*pulso|cod.*pulso", .monitoreo_text_key(label))
      }, logical(1)))
    }, logical(1))
    label_positions <- c(label_positions, which(source_label_match))
  }
  manual_code <- first_values_from_positions(c(manual_positions, label_positions))
  list(cv_id = cv_id, manual_code = manual_code)
}

.monitoreo_report_phone_key_conflict_mask <- function(response_rows, profile = list()) {
  pairs <- .monitoreo_report_phone_key_pairs(response_rows, profile)
  cv_id <- pairs$cv_id
  manual_code <- pairs$manual_code
  if (!length(cv_id)) return(logical(0))
  vapply(seq_along(cv_id), function(i) {
    nzchar(cv_id[[i]]) && nzchar(manual_code[[i]]) &&
      !isTRUE(.monitoreo_internal_code_values_match(cv_id[[i]], manual_code[[i]]))
  }, logical(1))
}

# Detalle reportable de los conflictos: qué enlace se abrió y qué código se
# escribió, para resolver caso por caso. No decide cuál gana: reporta.
.monitoreo_report_phone_key_conflict_df <- function(response_rows, profile = list()) {
  vacio <- data.frame(
    `Código del enlace` = character(0),
    `Código escrito` = character(0),
    Responsable = character(0),
    Fecha = character(0),
    check.names = FALSE
  )
  if (is.null(response_rows) || !is.data.frame(response_rows) || !nrow(response_rows)) return(vacio)
  mask <- .monitoreo_report_phone_key_conflict_mask(response_rows, profile)
  if (!length(mask) || !any(mask, na.rm = TRUE)) return(vacio)
  pairs <- .monitoreo_report_phone_key_pairs(response_rows, profile)
  idx <- which(mask)
  responsables <- .monitoreo_report_first_values(
    response_rows[idx, , drop = FALSE],
    c("Responsable", "responsable", "collector_name", "recopilador", "Encuestador")
  )
  if (!length(responsables)) responsables <- rep("", length(idx))
  fechas <- .monitoreo_report_first_values(
    response_rows[idx, , drop = FALSE],
    c("fecha", "Fecha", "date_created", "submission_time", "_submission_time", "end")
  )
  if (!length(fechas)) fechas <- rep("", length(idx))
  data.frame(
    `Código del enlace` = pairs$cv_id[idx],
    `Código escrito` = pairs$manual_code[idx],
    Responsable = as.character(responsables),
    Fecha = as.character(fechas),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
}

.monitoreo_report_phone_reconciliation <- function(phone, responses, profile = list()) {
  phone_states <- .monitoreo_report_states(phone, profile)
  response_states <- .monitoreo_report_states(responses, profile)
  phone_keys <- .monitoreo_report_key_list(phone, profile, "universo")
  response_keys <- .monitoreo_report_key_list(responses, profile, "respuesta")
  response_complete_keys <- .monitoreo_report_key_set(response_keys[response_states == "Completa"])
  response_partial_keys <- .monitoreo_report_key_set(response_keys[response_states == "Parcial"])
  response_rejection_keys <- .monitoreo_report_key_set(response_keys[response_states == "Rechazo"])
  response_any_keys <- .monitoreo_report_key_set(response_keys[response_states %in% c("Completa", "Parcial", "Rechazo")])
  phone_effective <- phone_states == "Completa"
  phone_rejection <- phone_states == "Rechazo"
  phone_platform_complete <- vapply(phone_keys, .monitoreo_report_has_key, logical(1), key_set = response_complete_keys)
  phone_platform_partial <- vapply(phone_keys, .monitoreo_report_has_key, logical(1), key_set = response_partial_keys)
  phone_platform_rejection <- vapply(phone_keys, .monitoreo_report_has_key, logical(1), key_set = response_rejection_keys)
  phone_platform_any <- vapply(phone_keys, .monitoreo_report_has_key, logical(1), key_set = response_any_keys)
  effective_conciliated <- phone_platform_complete & phone_effective
  effective_partial <- phone_platform_partial & phone_effective
  rejection_with_response <- phone_platform_any & phone_rejection
  list(
    phone_effective = as.integer(sum(phone_effective, na.rm = TRUE)),
    phone_conciliated = as.integer(sum(effective_conciliated, na.rm = TRUE)),
    phone_without_complete = as.integer(sum(phone_effective & !effective_conciliated, na.rm = TRUE)),
    phone_effective_partial = as.integer(sum(effective_partial, na.rm = TRUE)),
    phone_rejection_with_response = as.integer(sum(rejection_with_response, na.rm = TRUE)),
    phone_platform_complete = phone_platform_complete,
    phone_platform_partial = phone_platform_partial,
    phone_platform_rejection = phone_platform_rejection,
    phone_platform_any = phone_platform_any,
    phone_effective_conciliated = effective_conciliated,
    phone_effective_partial_mask = effective_partial,
    phone_rejection_with_response_mask = rejection_with_response,
    phone_keys = phone_keys,
    response_keys = response_keys,
    response_states = response_states,
    phone_states = phone_states
  )
}

# --- Base telefónica, cuotas, metas y bloques del reporte --------------------

.monitoreo_report_phone_actor_key <- function(value) {
  value <- trimws(.monitoreo_scalar(value, ""))
  if (!nzchar(value)) return("")
  .monitoreo_safe_name(value)
}

.monitoreo_report_phone_source_actor_keys <- function(data = NULL) {
  units <- .monitoreo_source_declared_actor_units(data)
  actors <- vapply(Filter(function(unit) {
    is.list(unit) && isTRUE((unit$phone %||% list())$enabled)
  }, units), function(unit) {
    .monitoreo_report_phone_actor_key(unit$actor)
  }, character(1))
  unique(actors[nzchar(actors)])
}

.monitoreo_report_phone_scope_data <- function(data, profile = list(), cfg = list()) {
  if (is.null(data) || !is.data.frame(data)) return(data.frame())
  profile <- monitoreo_normalize_profile(profile)
  if (!identical(profile$family %||% "", "acreditacion")) return(data)
  selected_actor_keys <- .monitoreo_report_phone_source_actor_keys(data)
  if (!nrow(data) || !length(selected_actor_keys)) return(data[0, , drop = FALSE])

  actors <- .monitoreo_source_declared_actor_values(data)
  if (!length(actors)) actors <- rep("", nrow(data))
  actor_keys <- vapply(actors, .monitoreo_report_phone_actor_key, character(1))
  data[nzchar(actor_keys) & actor_keys %in% selected_actor_keys, , drop = FALSE]
}

.monitoreo_report_phone_data <- function(data) {
  work <- data[.monitoreo_report_role_mask(data, "barrido"), , drop = FALSE]
  if (!nrow(work)) return(work)
  labels <- .monitoreo_text_key(work$.source_label %||% "")
  status <- .monitoreo_report_status_values(work)
  work[!grepl("puente", labels, fixed = TRUE) & .monitoreo_report_nonempty(status), , drop = FALSE]
}

.monitoreo_report_phone_like_text <- function(...) {
  text <- .monitoreo_text_key(paste(..., collapse = " "))
  grepl("telefon|phone|llamada|call", text, perl = TRUE)
}

.monitoreo_report_phone_config_entries <- function(cfg = list()) {
  entries <- .monitoreo_collector_config_entries(cfg)
  Filter(function(item) {
    if (!is.list(item) || !.monitoreo_bool(item$enabled %||% item$activo %||% TRUE, TRUE)) return(FALSE)
    use <- .monitoreo_safe_name(item$operational_use %||% item$uso_operativo)
    modality <- .monitoreo_safe_name(item$modality %||% item$modalidad)
    .monitoreo_report_phone_like_text(
      use,
      modality,
      item$channel %||% item$canal,
      item$source_label %||% item$fuente_label,
      item$collector_name %||% item$label %||% item$nombre
    ) ||
      identical(use, "telefono_asistido") ||
      identical(modality, "telefono")
  }, entries)
}

.monitoreo_report_phone_contact_mask <- function(df) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(logical(0))
  haystack <- .monitoreo_text_key(names(df))
  cols <- names(df)[grepl("telefono|celular|phone|fono", haystack, perl = TRUE)]
  if (!length(cols)) return(rep(FALSE, nrow(df)))
  out <- rep(FALSE, nrow(df))
  for (col in cols) {
    raw <- trimws(as.character(df[[col]] %||% ""))
    raw[is.na(raw)] <- ""
    out <- out | nzchar(raw)
  }
  out
}

.monitoreo_report_phone_population_data <- function(data, profile = list(), cfg = list()) {
  if (is.null(data) || !is.data.frame(data) || !nrow(data)) return(data.frame())
  base_roles <- c("universo", "base", "publico_objetivo", "público_objetivo", "poblacion", "población")
  base <- data[.monitoreo_report_role_mask(data, base_roles), , drop = FALSE]
  if (!nrow(base)) base <- data[.monitoreo_report_role_mask(data, "respuestas"), , drop = FALSE]
  if (!nrow(base)) base <- data
  if (!nrow(base)) return(base)

  entries <- .monitoreo_report_phone_config_entries(cfg)
  source_ids <- unique(.monitoreo_chr_vec(lapply(entries, function(item) item$source_id %||% item$fuente_id %||% "")))
  source_labels <- unique(.monitoreo_chr_vec(lapply(entries, function(item) item$source_label %||% item$fuente_label %||% "")))
  actor_keys <- unique(vapply(
    .monitoreo_chr_vec(lapply(entries, function(item) item$actor %||% item$unidad %||% item$dim_actor %||% "")),
    .monitoreo_report_unit_key,
    character(1)
  ))
  source_ids <- source_ids[nzchar(source_ids)]
  source_label_keys <- vapply(source_labels[nzchar(source_labels)], .monitoreo_safe_name, character(1))
  actor_keys <- actor_keys[nzchar(actor_keys)]

  configured_mask <- rep(FALSE, nrow(base))
  if (length(source_ids) && ".source_id" %in% names(base)) {
    configured_mask <- configured_mask | trimws(as.character(base$.source_id %||% "")) %in% source_ids
  }
  if (length(source_label_keys) && ".source_label" %in% names(base)) {
    labels <- vapply(as.character(base$.source_label %||% ""), .monitoreo_safe_name, character(1))
    configured_mask <- configured_mask | labels %in% source_label_keys
  }
  if (length(actor_keys)) {
    actors <- .monitoreo_report_trace_actor_values(base, profile)
    configured_mask <- configured_mask | vapply(actors, .monitoreo_report_unit_key, character(1)) %in% actor_keys
  }
  if (any(configured_mask, na.rm = TRUE)) return(base[configured_mask, , drop = FALSE])

  channel_values <- .monitoreo_report_channel_values(base)
  source_text <- if (".source_label" %in% names(base)) as.character(base$.source_label %||% "") else rep("", nrow(base))
  phone_text_mask <- vapply(seq_len(nrow(base)), function(i) {
    .monitoreo_report_phone_like_text(channel_values[[i]] %||% "", source_text[[i]] %||% "")
  }, logical(1))
  if (any(phone_text_mask, na.rm = TRUE)) return(base[phone_text_mask, , drop = FALSE])

  contact_mask <- .monitoreo_report_phone_contact_mask(base)
  if (any(contact_mask, na.rm = TRUE)) return(base[contact_mask, , drop = FALSE])
  base[0, , drop = FALSE]
}

.monitoreo_report_phone_quota_vars <- function(phone, cfg = list()) {
  configured <- .monitoreo_chr_vec(cfg$control_vars %||% cfg$variables_control %||% list())
  configured <- configured[nzchar(configured)]
  goals <- cfg$goals %||% list()
  actor_goal_names <- c(
    "Actor",
    "actor",
    "dim_actor",
    "unidad",
    "Unidad",
    "Publico objetivo",
    "Público objetivo",
    "publico_objetivo",
    "público_objetivo"
  )
  goal_vars <- character(0)
  if (length(goals)) {
    for (g in goals) {
      if (!is.list(g)) next
      filters <- g$filters %||% g$filtros %||% list()
      if (!is.list(filters) || !length(filters)) next
      filters <- filters[!vapply(filters, is.null, logical(1))]
      goal_vars <- c(goal_vars, setdiff(names(filters), actor_goal_names))
    }
  }
  fallback <- intersect(c("distrito", "grupo", "dim_segmento", "dim_carrera", "carrera", "segmento", "dim_actor"), names(phone))
  # `unique()` solo descarta nombres repetidos; `Actor` y `dim_actor` son la
  # misma dimensión con dos nombres y hay que compararlas por su contenido.
  # Ver `monitoreo_telefonico_cuotas.R`.
  .monitoreo_phone_quota_vars_unicas(phone, unique(c(configured, goal_vars, fallback)))
}

.monitoreo_report_phone_quota_value <- function(phone, idx, variable) {
  quota_col <- .monitoreo_report_col(
    phone,
    c(
      paste0("cuota_", variable),
      paste0("meta_", variable),
      paste("cuota", variable),
      paste("meta", variable)
    )
  )
  if (!nzchar(quota_col)) {
    generic_idx <- which(.monitoreo_text_key(names(phone)) %in% c("cuota", "meta", "minimo", "mínimo"))
    if (length(generic_idx)) quota_col <- names(phone)[[generic_idx[[1]]]]
  }
  if (!nzchar(quota_col)) return(NA_integer_)
  values <- suppressWarnings(as.numeric(gsub(",", ".", trimws(as.character(phone[[quota_col]][idx])))))
  values <- values[is.finite(values) & values >= 0]
  if (!length(values)) return(NA_integer_)
  as.integer(max(values, na.rm = TRUE))
}

.monitoreo_report_phone_goal_meta <- function(actor, variable, value, goals = list(), allow_actorless = TRUE) {
  if (!length(goals)) return(NA_integer_)
  actor_goal_names <- c(
    "Actor",
    "actor",
    "dim_actor",
    "unidad",
    "Unidad",
    "Publico objetivo",
    "Público objetivo",
    "publico_objetivo",
    "público_objetivo"
  )
  row_goals <- goals
  if (!isTRUE(allow_actorless)) {
    row_goals <- Filter(function(g) {
      filters <- g$filters %||% g$filtros %||% list()
      is.list(filters) && length(intersect(names(filters), actor_goal_names)) > 0L
    }, goals)
  }
  row <- list()
  row[[variable]] <- value
  row$Actor <- actor
  row$actor <- actor
  row$dim_actor <- actor
  meta <- .monitoreo_goal_meta_for_row(row, row_goals)
  if (is.finite(meta)) return(as.integer(meta))
  if (!isTRUE(allow_actorless)) return(NA_integer_)
  row <- list()
  row[[variable]] <- value
  meta <- .monitoreo_goal_meta_for_row(row, goals)
  if (is.finite(meta)) as.integer(meta) else NA_integer_
}

.monitoreo_report_phone_quota_df <- function(phone, profile = list(), cfg = list(), effective_mask = NULL) {
  if (is.null(phone) || !is.data.frame(phone) || !nrow(phone)) return(data.frame())
  variables <- .monitoreo_report_phone_quota_vars(phone, cfg)
  if (!length(variables)) return(data.frame())

  actors <- .monitoreo_report_trace_actor_values(phone, profile)
  actors[!.monitoreo_report_nonempty(actors)] <- "Sin actor"
  states <- .monitoreo_report_states(phone, profile)
  if (is.null(effective_mask) || length(effective_mask) != nrow(phone)) {
    effective_mask <- states == "Completa"
  } else {
    effective_mask <- as.logical(effective_mask)
    effective_mask[is.na(effective_mask)] <- FALSE
  }
  status_key <- .monitoreo_text_key(.monitoreo_report_status_values(phone))
  role_key <- if (".source_role" %in% names(phone)) .monitoreo_text_key(phone$.source_role %||% "") else rep("", nrow(phone))
  no_barrido_mask <- status_key %in% c("no barrido", "nobarrido", "sin status") |
    (role_key != "barrido" & states == "Sin respuesta")
  rows <- list()

  for (variable in variables) {
    if (!variable %in% names(phone)) next
    values <- .monitoreo_report_control_value(phone[[variable]], "texto")
    combos <- unique(data.frame(
      Actor = actors,
      Variable = variable,
      Valor = values,
      stringsAsFactors = FALSE,
      check.names = FALSE
    ))
    combos <- combos[nzchar(combos$Valor) & !is.na(combos$Valor), , drop = FALSE]
    if (!nrow(combos)) next

    for (i in seq_len(nrow(combos))) {
      actor <- combos$Actor[[i]]
      value <- combos$Valor[[i]]
      idx <- which(actors == actor & values == value)
      if (!length(idx)) next
      universe <- length(idx)
      effective <- sum(effective_mask[idx], na.rm = TRUE)
      partial <- sum(states[idx] == "Parcial", na.rm = TRUE)
      refusal <- sum(states[idx] == "Rechazo", na.rm = TRUE)
      unswept <- sum(no_barrido_mask[idx], na.rm = TRUE)
      meta <- .monitoreo_report_phone_goal_meta(
        actor,
        variable,
        value,
        cfg$goals %||% list(),
        allow_actorless = FALSE
      )
      if (!is.finite(meta)) meta <- .monitoreo_report_phone_quota_value(phone, idx, variable)
      meta <- if (is.finite(meta)) as.integer(meta) else NA_integer_
      gap <- if (is.finite(meta)) max(0L, meta - effective) else NA_integer_
      rows[[length(rows) + 1L]] <- data.frame(
        Actor = actor,
        Variable = variable,
        Valor = value,
        Universo = as.integer(universe),
        Meta = meta,
        Efectivas = as.integer(effective),
        Parciales = as.integer(partial),
        `Rechazos telefónicos` = as.integer(refusal),
        `No barridos` = as.integer(unswept),
        `Avance meta` = if (is.finite(meta) && meta > 0L) round(100 * effective / meta, 1) else NA_real_,
        Brecha = gap,
        `Estado cuota` = if (!is.finite(meta)) "Sin meta" else if (effective >= meta) "Cumple" else "Brecha",
        check.names = FALSE,
        stringsAsFactors = FALSE
      )
    }
  }

  goals <- cfg$goals %||% list()
  if (length(goals)) {
    actor_goal_names <- c(
      "Actor",
      "actor",
      "dim_actor",
      "unidad",
      "Unidad",
      "Publico objetivo",
      "Público objetivo",
      "publico_objetivo",
      "público_objetivo"
    )
    global_keys <- character(0)
    for (g in goals) {
      if (!is.list(g)) next
      filters <- g$filters %||% g$filtros %||% list()
      if (!is.list(filters) || !length(filters)) next
      filters <- filters[!vapply(filters, is.null, logical(1))]
      if (length(intersect(names(filters), actor_goal_names))) next
      meta <- .monitoreo_int(g$meta %||% g$objetivo %||% g$n, NA_integer_)
      if (!is.finite(meta) || meta < 0L) next
      goal_variables <- intersect(names(filters), variables)
      if (!length(goal_variables)) next
      variable <- goal_variables[[1]]
      value <- .monitoreo_scalar(filters[[variable]], "")
      if (!nzchar(value)) next
      global_key <- paste(variable, value, sep = "\r")
      if (global_key %in% global_keys) next
      idx <- seq_len(nrow(phone))
      for (filter_name in names(filters)) {
        target <- .monitoreo_scalar(filters[[filter_name]], "")
        if (!nzchar(target)) next
        if (!filter_name %in% names(phone)) {
          idx <- integer(0)
          break
        }
        filter_values <- .monitoreo_report_control_value(phone[[filter_name]], "texto")
        idx <- idx[filter_values[idx] == target]
      }
      universe <- length(idx)
      effective <- if (universe) sum(effective_mask[idx], na.rm = TRUE) else 0L
      partial <- if (universe) sum(states[idx] == "Parcial", na.rm = TRUE) else 0L
      refusal <- if (universe) sum(states[idx] == "Rechazo", na.rm = TRUE) else 0L
      unswept <- if (universe) sum(no_barrido_mask[idx], na.rm = TRUE) else 0L
      gap <- max(0L, as.integer(meta) - as.integer(effective))
      rows[[length(rows) + 1L]] <- data.frame(
        Actor = "Total",
        Variable = variable,
        Valor = value,
        Universo = as.integer(universe),
        Meta = as.integer(meta),
        Efectivas = as.integer(effective),
        Parciales = as.integer(partial),
        `Rechazos telefónicos` = as.integer(refusal),
        `No barridos` = as.integer(unswept),
        `Avance meta` = if (meta > 0L) round(100 * effective / meta, 1) else NA_real_,
        Brecha = as.integer(gap),
        `Estado cuota` = if (effective >= meta) "Cumple" else if (universe > 0L) "Brecha" else "Sin base",
        check.names = FALSE,
        stringsAsFactors = FALSE
      )
      global_keys <- c(global_keys, global_key)
    }
  }

  if (!length(rows)) return(data.frame())
  out <- do.call(rbind, rows)
  out$.__actor_order <- ifelse(out$Actor %in% c("Total", "Todos"), "", out$Actor)
  out <- out[order(out$.__actor_order, out$Variable, -out$Brecha, out$Valor), , drop = FALSE]
  out$.__actor_order <- NULL
  rownames(out) <- NULL
  utils::head(out, 240L)
}

.monitoreo_report_phone_blocks <- function(data, profile = list(), cfg = list()) {
  profile <- monitoreo_normalize_profile(profile)
  data <- .monitoreo_report_phone_scope_data(data, profile, cfg)
  phone <- .monitoreo_report_phone_data(data)
  phone_from_population <- FALSE
  if (!nrow(phone)) {
    phone <- .monitoreo_report_phone_population_data(data, profile, cfg)
    phone_from_population <- nrow(phone) > 0L
  }
  responses <- data[.monitoreo_report_role_mask(data, "respuestas"), , drop = FALSE]
  count_df <- function(values, name_col) {
    tab <- sort(table(values), decreasing = TRUE)
    data.frame(
      stats::setNames(list(names(tab), as.integer(tab)), c(name_col, "Casos")),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  }
  if (!nrow(phone)) {
    empty <- data.frame(Indicador = "Total telefónico", Casos = 0L, `% del total telefónico` = NA_real_, check.names = FALSE)
    empty_status <- data.frame(Estatus = character(0), Casos = integer(0), `% del total telefónico` = numeric(0), check.names = FALSE)
    return(list(
      .monitoreo_report_block("resumen_telefonico", "Resumen general", empty, "Sin hoja de barrido telefónico activa."),
      .monitoreo_report_block("estatus_telefonico", "Distribución por estatus", empty_status, "Sin estados telefónicos activos."),
      .monitoreo_report_block("cuotas_variable", "Cuotas por variable", data.frame(), "Sin población telefónica candidata para calcular cuotas.")
    ))
  }
  status <- .monitoreo_report_status_values(phone)
  status_key <- .monitoreo_text_key(status)
  total <- nrow(phone)
  states <- .monitoreo_report_states(phone, profile)
  role_key <- if (".source_role" %in% names(phone)) .monitoreo_text_key(phone$.source_role %||% "") else rep("", nrow(phone))
  no_barrido_mask <- status_key %in% c("no barrido", "nobarrido", "sin status") |
    (role_key != "barrido" & states == "Sin respuesta")
  no_barrido <- sum(no_barrido_mask, na.rm = TRUE)
  barridos <- total - no_barrido
  resumen <- data.frame(
    Indicador = c("Casos barridos", "No barridos", "Total telefónico"),
    Casos = as.integer(c(barridos, no_barrido, total)),
    `% del total telefónico` = if (total > 0L) round(c(barridos, no_barrido, total) / total, 4) else NA_real_,
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  dist <- count_df(status, "Estatus")
  dist$`% del total telefónico` <- if (total > 0L) round(dist$Casos / total, 4) else NA_real_
  responsables <- .monitoreo_report_responsable_values(phone)
  actors <- .monitoreo_report_trace_actor_values(phone, profile)
  actor_responsible_groups <- unique(data.frame(
    Actor = actors,
    Responsable = responsables,
    stringsAsFactors = FALSE,
    check.names = FALSE
  ))
  if (nrow(actor_responsible_groups)) {
    actor_responsible_groups <- actor_responsible_groups[order(actor_responsible_groups$Actor, actor_responsible_groups$Responsable), , drop = FALSE]
  }
  dates <- .monitoreo_report_date_values(phone)
  by_day <- count_df(dates, "Fecha")
  attempts <- .monitoreo_report_attempt_values(phone)
  if (length(attempts) != nrow(phone)) attempts <- rep(NA_real_, nrow(phone))
  reconciliation <- .monitoreo_report_phone_reconciliation(phone, responses, profile)
  phone_platform_complete <- reconciliation$phone_platform_complete
  phone_platform_partial <- reconciliation$phone_platform_partial
  phone_platform_rejection <- reconciliation$phone_platform_rejection
  phone_platform_any <- reconciliation$phone_platform_any
  phone_effective_conciliated <- reconciliation$phone_effective_conciliated
  if (length(phone_platform_complete) != nrow(phone)) phone_platform_complete <- rep(FALSE, nrow(phone))
  if (length(phone_platform_partial) != nrow(phone)) phone_platform_partial <- rep(FALSE, nrow(phone))
  if (length(phone_platform_rejection) != nrow(phone)) phone_platform_rejection <- rep(FALSE, nrow(phone))
  if (length(phone_platform_any) != nrow(phone)) phone_platform_any <- rep(FALSE, nrow(phone))
  if (length(phone_effective_conciliated) != nrow(phone)) phone_effective_conciliated <- rep(FALSE, nrow(phone))
  response_dates <- .monitoreo_report_date_values(responses)
  response_keys <- reconciliation$response_keys %||% vector("list", nrow(responses))
  response_states <- reconciliation$response_states %||% .monitoreo_report_states(responses, profile)
  if (length(response_keys) != nrow(responses)) response_keys <- .monitoreo_report_key_list(responses, profile, "respuesta")
  if (length(response_states) != nrow(responses)) response_states <- .monitoreo_report_states(responses, profile)
  response_actors <- .monitoreo_report_trace_actor_values(responses, profile)
  if (length(response_actors) != nrow(responses)) response_actors <- rep("Sin actor", nrow(responses))
  phone_key_set <- .monitoreo_report_key_set(reconciliation$phone_keys %||% .monitoreo_report_key_list(phone, profile, "universo"))
  response_has_phone_key <- if (length(response_keys)) {
    vapply(response_keys, function(item) .monitoreo_report_has_key(item, phone_key_set), logical(1))
  } else {
    logical(0)
  }
  if (length(response_has_phone_key) != nrow(responses)) response_has_phone_key <- rep(FALSE, nrow(responses))
  response_primary_keys <- if (length(response_keys)) {
    vapply(response_keys, function(item) {
      item <- item[nzchar(item)]
      if (length(item)) item[[1L]] else ""
    }, character(1))
  } else {
    character(0)
  }
  if (length(response_primary_keys) != nrow(responses)) response_primary_keys <- rep("", nrow(responses))
  response_outside_phone_complete <- response_states == "Completa" &
    .monitoreo_report_nonempty(response_primary_keys) &
    !response_has_phone_key
  phone_platform_dates <- vapply(seq_len(nrow(phone)), function(idx) {
    phone_key_values <- reconciliation$phone_keys[[idx]] %||% character(0)
    phone_key_values <- phone_key_values[nzchar(phone_key_values)]
    if (!length(phone_key_values) || !length(response_keys)) return("Sin fecha")
    matches <- which(response_states == "Completa" & vapply(response_keys, function(item) {
      length(item) > 0L && any(item %in% phone_key_values)
    }, logical(1)))
    if (!length(matches)) return("Sin fecha")
    matched_dates <- response_dates[matches]
    matched_dates <- matched_dates[.monitoreo_report_nonempty(matched_dates) & matched_dates != "Sin fecha"]
    if (length(matched_dates)) max(matched_dates, na.rm = TRUE) else "Sin fecha"
  }, character(1))
  if (length(phone_platform_dates) != nrow(phone)) phone_platform_dates <- rep("Sin fecha", nrow(phone))
  efectivo_mask <- states == "Completa"
  parcial_mask <- states == "Parcial"
  rechazo_mask <- states == "Rechazo"
  barrido_mask <- !no_barrido_mask
  incidencia_mask <- barrido_mask & !efectivo_mask
  no_answer_mask <- grepl("no contesta|no responde|no answer|nocontesta", status_key)
  call_later_mask <- grepl("contactar despues|contactar luego|llamar despues|pendiente contacto|pendiente de contacto", status_key)
  terminal_no_effective_mask <- grepl("rechazo|no existe|numero incorrecto|fuera de servicio|apagado|inubicable|inalcanz|wrong number", status_key)
  reattempt_mask <- barrido_mask & !efectivo_mask & !terminal_no_effective_mask
  low_reattempt_mask <- reattempt_mask & (is.na(attempts) | attempts < 4)
  platform_effective_dates <- c(
    phone_platform_dates[phone_platform_complete],
    response_dates[response_outside_phone_complete]
  )
  platform_effective_dates[!.monitoreo_report_nonempty(platform_effective_dates)] <- "Sin fecha"
  dates_sorted <- sort(unique(c(dates[nzchar(dates)], platform_effective_dates[nzchar(platform_effective_dates)])))
  if (!length(dates_sorted)) dates_sorted <- "Sin fecha"
  efectivo_dia <- data.frame(
    Fecha = dates_sorted,
    Efectivas = as.integer(vapply(dates_sorted, function(day) sum(platform_effective_dates == day, na.rm = TRUE), integer(1))),
    `Efectivas Kobo` = as.integer(vapply(dates_sorted, function(day) sum(platform_effective_dates == day, na.rm = TRUE), integer(1))),
    `Efectivas telefónicas` = as.integer(vapply(dates_sorted, function(day) sum(efectivo_mask & dates == day, na.rm = TRUE), integer(1))),
    Parciales = as.integer(vapply(dates_sorted, function(day) sum(parcial_mask & dates == day, na.rm = TRUE), integer(1))),
    Rechazos = as.integer(vapply(dates_sorted, function(day) sum(rechazo_mask & dates == day, na.rm = TRUE), integer(1))),
    `Rechazos telefónicos` = as.integer(vapply(dates_sorted, function(day) sum(rechazo_mask & dates == day, na.rm = TRUE), integer(1))),
    Barridos = as.integer(vapply(dates_sorted, function(day) sum(barrido_mask & dates == day, na.rm = TRUE), integer(1))),
    `Sin efectiva` = as.integer(vapply(dates_sorted, function(day) sum(incidencia_mask & dates == day, na.rm = TRUE), integer(1))),
    Incidencias = as.integer(vapply(dates_sorted, function(day) sum(incidencia_mask & dates == day, na.rm = TRUE), integer(1))),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  efectivo_dia$`Ratio incidencias` <- ifelse(efectivo_dia$Barridos > 0L, round(efectivo_dia$Incidencias / efectivo_dia$Barridos, 4), NA_real_)
  status_labels <- as.character(dist$Estatus %||% character(0))
  status_day <- if (length(status_labels)) {
    do.call(rbind, lapply(status_labels, function(label) {
      counts <- as.integer(vapply(dates_sorted, function(day) sum(status == label & dates == day, na.rm = TRUE), integer(1)))
      data.frame(
        Estado = label,
        as.data.frame(as.list(stats::setNames(counts, dates_sorted)), check.names = FALSE),
        Total = as.integer(sum(counts, na.rm = TRUE)),
        check.names = FALSE,
        stringsAsFactors = FALSE
      )
    }))
  } else {
    data.frame(Estado = character(0), Total = integer(0), check.names = FALSE)
  }
  actor_day_actors <- sort(unique(c(actors, response_actors[response_outside_phone_complete])))
  actor_day_actors <- actor_day_actors[nzchar(actor_day_actors) & !is.na(actor_day_actors)]
  actor_day_rows <- lapply(actor_day_actors, function(actor) {
    actor_mask <- actors == actor
    outside_actor_mask <- response_outside_phone_complete & response_actors == actor
    lapply(dates_sorted, function(day) {
      mask <- actor_mask & dates == day
      platform_actor_day <- sum(phone_platform_complete & actor_mask & phone_platform_dates == day, na.rm = TRUE) +
        sum(outside_actor_mask & response_dates == day, na.rm = TRUE)
      data.frame(
        Actor = actor,
        Fecha = day,
        Efectivas = as.integer(platform_actor_day),
        `Efectivas Kobo` = as.integer(platform_actor_day),
        `Efectivas telefónicas` = as.integer(sum(efectivo_mask & mask, na.rm = TRUE)),
        Parciales = as.integer(sum(parcial_mask & mask, na.rm = TRUE)),
        Rechazos = as.integer(sum(rechazo_mask & mask, na.rm = TRUE)),
        `Rechazos telefónicos` = as.integer(sum(rechazo_mask & mask, na.rm = TRUE)),
        Barridos = as.integer(sum(barrido_mask & mask, na.rm = TRUE)),
        `Sin efectiva` = as.integer(sum(incidencia_mask & mask, na.rm = TRUE)),
        Incidencias = as.integer(sum(incidencia_mask & mask, na.rm = TRUE)),
        check.names = FALSE,
        stringsAsFactors = FALSE
      )
    })
  })
  actor_day <- if (length(actor_day_rows)) do.call(rbind, unlist(actor_day_rows, recursive = FALSE)) else data.frame()
  if (nrow(actor_day)) {
    actor_day$`Ratio incidencias` <- ifelse(actor_day$Barridos > 0L, round(actor_day$Incidencias / actor_day$Barridos, 4), NA_real_)
    actor_day <- actor_day[order(actor_day$Actor, actor_day$Fecha), , drop = FALSE]
  }
  resp <- data.frame(Actor = actors, Responsable = responsables, Completa = states == "Completa", stringsAsFactors = FALSE)
  by_resp <- stats::aggregate(Completa ~ Actor + Responsable, data = resp, FUN = sum)
  names(by_resp) <- c("Actor", "Responsable", "Efectivas")
  by_resp <- by_resp[order(by_resp$Actor, -by_resp$Efectivas, by_resp$Responsable), , drop = FALSE]
  resp_ops_rows <- lapply(seq_len(nrow(actor_responsible_groups)), function(group_idx) {
    actor <- actor_responsible_groups$Actor[[group_idx]]
    owner <- actor_responsible_groups$Responsable[[group_idx]]
    mask <- responsables == owner & actors == actor
    asignados <- sum(mask, na.rm = TRUE)
    barridos_owner <- sum(mask & barrido_mask, na.rm = TRUE)
    no_barridos_owner <- sum(mask & no_barrido_mask, na.rm = TRUE)
    efectivas_owner <- sum(mask & efectivo_mask, na.rm = TRUE)
    plataforma_owner <- sum(mask & phone_platform_complete, na.rm = TRUE)
    conciliadas_owner <- sum(mask & phone_effective_conciliated, na.rm = TRUE)
    plataforma_parcial_owner <- sum(mask & phone_platform_partial, na.rm = TRUE)
    rechazos_owner <- sum(mask & rechazo_mask, na.rm = TRUE)
    incidencias_owner <- sum(mask & incidencia_mask, na.rm = TRUE)
    no_contesta_owner <- sum(mask & no_answer_mask, na.rm = TRUE)
    reintento_owner <- sum(mask & reattempt_mask, na.rm = TRUE)
    bajo_reintento_owner <- sum(mask & low_reattempt_mask, na.rm = TRUE)
    owner_attempts <- attempts[mask & reattempt_mask & !is.na(attempts)]
    data.frame(
      Actor = actor,
      Responsable = owner,
      `Casos asignados` = as.integer(asignados),
      Barridos = as.integer(barridos_owner),
      `No barridos` = as.integer(no_barridos_owner),
      Efectivas = as.integer(efectivas_owner),
      `Efectivas telefónicas` = as.integer(efectivas_owner),
      `Efectivas Kobo` = as.integer(plataforma_owner),
      `Plataforma completa` = as.integer(plataforma_owner),
      `Conciliadas por CodPulso` = as.integer(conciliadas_owner),
      Conciliadas = as.integer(conciliadas_owner),
      `Tel. efectiva sin efectiva Kobo` = as.integer(max(0L, efectivas_owner - conciliadas_owner)),
      `Tel. efectiva sin plataforma completa` = as.integer(max(0L, efectivas_owner - conciliadas_owner)),
      `Efectiva Kobo sin tel. efectiva` = as.integer(max(0L, plataforma_owner - conciliadas_owner)),
      `Plataforma completa sin tel. efectiva` = as.integer(max(0L, plataforma_owner - conciliadas_owner)),
      `Plataforma parcial` = as.integer(plataforma_parcial_owner),
      `Rechazos telefónicos` = as.integer(rechazos_owner),
      `Sin efectiva` = as.integer(incidencias_owner),
      Incidencias = as.integer(incidencias_owner),
      `No contesta` = as.integer(no_contesta_owner),
      Reintentos = as.integer(reintento_owner),
      `Reintentos bajos` = as.integer(bajo_reintento_owner),
      `Promedio intentos reintento` = if (length(owner_attempts)) round(mean(owner_attempts), 2) else NA_real_,
      `% no barrido` = if (asignados > 0L) round(no_barridos_owner / asignados, 4) else NA_real_,
      `Ratio incidencias` = if (barridos_owner > 0L) round(incidencias_owner / barridos_owner, 4) else NA_real_,
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  })
  by_resp_ops <- if (length(resp_ops_rows)) do.call(rbind, resp_ops_rows) else data.frame()
  if (nrow(by_resp_ops)) {
    by_resp_ops <- by_resp_ops[order(by_resp_ops$Actor, -by_resp_ops$`No barridos`, -by_resp_ops$Incidencias, by_resp_ops$Responsable), , drop = FALSE]
  }
  status_resp <- data.frame(Actor = actors, Responsable = responsables, Estado = status, stringsAsFactors = FALSE)
  by_status_resp <- stats::aggregate(rep(1L, nrow(status_resp)), by = list(Actor = status_resp$Actor, Responsable = status_resp$Responsable, Estado = status_resp$Estado), FUN = sum)
  names(by_status_resp) <- c("Actor", "Responsable", "Estado", "Casos")
  status_totals <- stats::aggregate(Casos ~ Actor + Responsable, data = by_status_resp, FUN = sum)
  names(status_totals) <- c("Actor", "Responsable", "Total responsable")
  by_status_resp <- merge(by_status_resp, status_totals, by = c("Actor", "Responsable"), all.x = TRUE, sort = FALSE)
  by_status_resp$`% responsable` <- ifelse(by_status_resp$`Total responsable` > 0L, round(by_status_resp$Casos / by_status_resp$`Total responsable`, 4), NA_real_)
  by_status_resp <- by_status_resp[order(by_status_resp$Actor, by_status_resp$Responsable, -by_status_resp$Casos, by_status_resp$Estado), , drop = FALSE]
  attempt_bucket <- function(values, bucket) {
    sum(!is.na(values) & floor(values) == bucket, na.rm = TRUE)
  }
  insistencia_rows <- lapply(seq_len(nrow(actor_responsible_groups)), function(group_idx) {
    actor <- actor_responsible_groups$Actor[[group_idx]]
    owner <- actor_responsible_groups$Responsable[[group_idx]]
    mask <- responsables == owner & actors == actor & no_answer_mask
    vals <- attempts[mask]
    valid <- vals[!is.na(vals)]
    data.frame(
      Actor = actor,
      Responsable = owner,
      `Casos No contesta` = as.integer(sum(mask, na.rm = TRUE)),
      `Suma intentos` = as.integer(sum(valid, na.rm = TRUE)),
      `Promedio intentos` = if (length(valid)) round(mean(valid), 2) else NA_real_,
      `Sin intentos` = as.integer(sum(is.na(vals), na.rm = TRUE)),
      `1 intento` = as.integer(attempt_bucket(vals, 1)),
      `2 intentos` = as.integer(attempt_bucket(vals, 2)),
      `3 intentos` = as.integer(attempt_bucket(vals, 3)),
      `4 intentos` = as.integer(attempt_bucket(vals, 4)),
      `5 intentos` = as.integer(attempt_bucket(vals, 5)),
      `6 intentos` = as.integer(attempt_bucket(vals, 6)),
      `7 intentos` = as.integer(attempt_bucket(vals, 7)),
      `Más de 7 intentos` = as.integer(sum(!is.na(vals) & vals > 7, na.rm = TRUE)),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  })
  insistencia <- if (length(insistencia_rows)) do.call(rbind, insistencia_rows) else data.frame()
  if (nrow(insistencia)) {
    insistencia <- insistencia[insistencia$`Casos No contesta` > 0L, , drop = FALSE]
    insistencia <- insistencia[order(insistencia$Actor, -insistencia$`Casos No contesta`, insistencia$Responsable), , drop = FALSE]
  }
  key_col <- .monitoreo_report_col(phone, c("CodPulso", "Cod Pulso", "Cód Pulso", "Codigo Pulso", "Código Pulso", "Código PUCP", "Codigo PUCP", "ID", "id", "codigo", "Código", "Codigo"))
  keys <- if (nzchar(key_col)) trimws(as.character(phone[[key_col]])) else rep("", nrow(phone))
  keys[!.monitoreo_report_nonempty(keys)] <- ""
  people <- .monitoreo_report_person_values(phone)
  people[!.monitoreo_report_nonempty(people)] <- keys[!.monitoreo_report_nonempty(people)]
  actors <- .monitoreo_report_trace_actor_values(phone, profile)
  primary_keys <- vapply(reconciliation$phone_keys %||% vector("list", nrow(phone)), function(item) {
    if (length(item)) item[[1]] else ""
  }, character(1))
  if (length(primary_keys) != nrow(phone)) primary_keys <- keys
  primary_keys[!.monitoreo_report_nonempty(primary_keys)] <- keys[!.monitoreo_report_nonempty(primary_keys)]
  if (length(keys) == nrow(phone) && any(.monitoreo_report_nonempty(keys), na.rm = TRUE)) {
    display_keys <- keys
    needs_display_key <- !.monitoreo_report_nonempty(display_keys)
    display_keys[needs_display_key] <- primary_keys[needs_display_key]
    primary_keys <- display_keys
  }
  platform_dates <- phone_platform_dates
  if (length(platform_dates) != nrow(phone)) platform_dates <- rep("Sin fecha", nrow(phone))
  quota_effective_mask <- if (nrow(responses) && !isTRUE(phone_from_population)) phone_platform_complete else NULL
  quotas <- .monitoreo_report_phone_quota_df(phone, profile, cfg, effective_mask = quota_effective_mask)
  quota_variables <- unique(as.character(quotas$Variable %||% character(0)))
  quota_variables <- quota_variables[nzchar(quota_variables) & !is.na(quota_variables)]
  quota_value_columns <- list()
  if (length(quota_variables)) {
    for (variable in quota_variables) {
      col <- .monitoreo_report_col(phone, c(variable))
      if (!nzchar(col)) next
      values <- .monitoreo_report_control_value(phone[[col]], "texto")
      if (length(values) != nrow(phone)) next
      quota_value_columns[[variable]] <- values
    }
  }
  quota_day_rows <- list()
  if (length(quota_value_columns)) {
    for (variable in names(quota_value_columns)) {
      values <- quota_value_columns[[variable]]
      valid <- phone_platform_complete &
        .monitoreo_report_nonempty(values) &
        values != "Sin dato" &
        .monitoreo_report_nonempty(platform_dates) &
        platform_dates != "Sin fecha"
      if (!any(valid, na.rm = TRUE)) next
      combos <- unique(data.frame(
        Variable = variable,
        Valor = values[valid],
        Fecha = platform_dates[valid],
        stringsAsFactors = FALSE,
        check.names = FALSE
      ))
      combos <- combos[order(combos$Variable, combos$Valor, combos$Fecha), , drop = FALSE]
      for (combo_idx in seq_len(nrow(combos))) {
        mask <- valid &
          values == combos$Valor[[combo_idx]] &
          platform_dates == combos$Fecha[[combo_idx]]
        quota_day_rows[[length(quota_day_rows) + 1L]] <- data.frame(
          Variable = combos$Variable[[combo_idx]],
          Valor = combos$Valor[[combo_idx]],
          Fecha = combos$Fecha[[combo_idx]],
          `Efectivas Kobo` = as.integer(sum(mask, na.rm = TRUE)),
          Efectivas = as.integer(sum(mask, na.rm = TRUE)),
          check.names = FALSE,
          stringsAsFactors = FALSE
        )
      }
    }
  }
  quota_day <- if (length(quota_day_rows)) do.call(rbind, quota_day_rows) else data.frame()
  platform_state <- ifelse(
    phone_platform_complete,
    "Efectiva Kobo",
    "Sin efectiva Kobo"
  )
  phone_key_display <- function(value) {
    value <- .monitoreo_scalar(value, "")
    if (!nzchar(value)) return("")
    sub("^(codpulso|cod pulso|codigo|código|id|cv_id|custom_value):", "", value, ignore.case = TRUE)
  }
  phone_case_match_label <- function(has_key, phone_effective, platform_complete) {
    if (!isTRUE(has_key)) return("Sin CodPulso para cruzar")
    if (isTRUE(phone_effective) && isTRUE(platform_complete)) return("Coincide efectiva por CodPulso")
    if (isTRUE(phone_effective) && !isTRUE(platform_complete)) return("Tel. efectiva sin efectiva Kobo")
    if (!isTRUE(phone_effective) && isTRUE(platform_complete)) return("Efectiva Kobo sin tel. efectiva")
    "Sin efectiva Kobo"
  }
  phone_duration_category <- function(status, seconds) {
    operational <- .monitoreo_territorial_duration_operational_status(status, seconds, cfg)
    out <- rep("Normal (5+ min)", length(operational))
    out[operational == "corto"] <- "Corta (2-5 min)"
    out[operational == "muy_corto"] <- "Muy corta (<2 min)"
    has_time <- .monitoreo_territorial_duration_has_time(status, seconds)
    out[!has_time] <- "Sin tiempo"
    out
  }
  phone_duration_priority <- function(status, seconds) {
    operational <- .monitoreo_territorial_duration_operational_status(status, seconds, cfg)
    out <- rep(3L, length(operational))
    out[operational == "corto"] <- 2L
    out[operational == "muy_corto"] <- 1L
    has_time <- .monitoreo_territorial_duration_has_time(status, seconds)
    out[!has_time] <- 4L
    out
  }
  has_primary_key <- .monitoreo_report_nonempty(primary_keys)
  response_duration_seconds <- if (nrow(responses)) .monitoreo_duration_seconds(responses, cfg) else numeric(0)
  response_duration_seconds[!is.finite(response_duration_seconds) | response_duration_seconds < 0] <- NA_real_
  response_duration_status <- .monitoreo_territorial_duration_status(response_duration_seconds, cfg)
  response_duration_operational <- .monitoreo_territorial_duration_operational_status(response_duration_status, response_duration_seconds, cfg)
  response_duration_label <- .monitoreo_territorial_duration_operational_label(response_duration_status, response_duration_seconds, cfg)
  response_duration_has_time <- .monitoreo_territorial_duration_has_time(response_duration_status, response_duration_seconds)
  response_duration_label[!response_duration_has_time] <- "Sin dato"
  response_duration_operational[!response_duration_has_time] <- "sin_dato"
  duration_source <- if (nrow(responses)) .monitoreo_territorial_duration_source(responses, cfg) else list(type = "missing", label = "")
  response_sources <- if (".source_label" %in% names(responses)) as.character(responses$.source_label %||% "") else rep("Kobo", nrow(responses))
  response_submitted_by <- .monitoreo_report_first_values(responses, c("_submitted_by", "submitted_by", "submitted by", "username", "usuario", "enumerador", "encuestador"))
  response_ids <- .monitoreo_report_first_values(responses, c("_uuid", "uuid", "response_id", "id_respuesta", "id respuesta", "_id", "id"))
  response_duration_effective <- response_states == "Completa"
  duration_idx <- which(response_duration_effective)
  duration_control <- if (length(duration_idx)) {
    df <- data.frame(
      CodPulso = vapply(response_primary_keys[duration_idx], phone_key_display, character(1)),
      Actor = response_actors[duration_idx],
      `Responsable plataforma` = response_submitted_by[duration_idx],
      Encuesta = response_sources[duration_idx],
      `Fecha Kobo` = response_dates[duration_idx],
      `Duración` = vapply(response_duration_seconds[duration_idx], .monitoreo_publication_format_duration, character(1)),
      `Duración segundos` = round(response_duration_seconds[duration_idx], 1),
      Clasificación = phone_duration_category(response_duration_status[duration_idx], response_duration_seconds[duration_idx]),
      `Estado duración` = response_duration_operational[duration_idx],
      `Etiqueta duración` = response_duration_label[duration_idx],
      `Fuente duración` = .monitoreo_scalar(duration_source$label, ""),
      `Tipo fuente duración` = .monitoreo_scalar(duration_source$type, ""),
      Alerta = ifelse(response_duration_operational[duration_idx] %in% c("muy_corto", "corto"), "Revisar duración", ""),
      `Response ID` = response_ids[duration_idx],
      `Orden duración` = phone_duration_priority(response_duration_status[duration_idx], response_duration_seconds[duration_idx]),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
    df[order(df$`Orden duración`, df$`Fecha Kobo`, df$CodPulso), , drop = FALSE]
  } else {
    data.frame(
      CodPulso = character(0),
      Actor = character(0),
      `Responsable plataforma` = character(0),
      Encuesta = character(0),
      `Fecha Kobo` = character(0),
      `Duración` = character(0),
      `Duración segundos` = numeric(0),
      Clasificación = character(0),
      `Estado duración` = character(0),
      `Etiqueta duración` = character(0),
      `Fuente duración` = character(0),
      `Tipo fuente duración` = character(0),
      Alerta = character(0),
      `Response ID` = character(0),
      `Orden duración` = integer(0),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  }
  comparison_label <- vapply(seq_len(nrow(phone)), function(idx) {
    phone_case_match_label(
      has_primary_key[[idx]],
      efectivo_mask[[idx]],
      phone_platform_complete[[idx]]
    )
  }, character(1))
  reconciliation_detail <- data.frame(
    CodPulso = primary_keys,
    Actor = actors,
    Responsable = responsables,
    Caso = people,
    `Estado telefónico` = status,
    `Avance telefónico` = states,
    `Avance plataforma` = platform_state,
    `Efectiva telefónica` = ifelse(efectivo_mask, "Sí", "No"),
    `Efectiva Kobo` = ifelse(phone_platform_complete, "Sí", "No"),
    `Plataforma completa` = ifelse(phone_platform_complete, "Sí", "No"),
    `Fecha Kobo` = platform_dates,
    `Coinciden efectivas` = ifelse(
      efectivo_mask | phone_platform_complete,
      ifelse(efectivo_mask & phone_platform_complete, "Sí", "No"),
      "No aplica"
    ),
    Coincidencia = comparison_label,
    Fecha = dates,
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  outside_idx <- which(response_outside_phone_complete)
  if (length(outside_idx)) {
    outside_detail <- data.frame(
      CodPulso = vapply(response_primary_keys[outside_idx], phone_key_display, character(1)),
      Actor = response_actors[outside_idx],
      Responsable = rep("Sin responsable", length(outside_idx)),
      Caso = vapply(response_primary_keys[outside_idx], phone_key_display, character(1)),
      `Estado telefónico` = rep("Fuera de base", length(outside_idx)),
      `Avance telefónico` = rep("Sin registro en barrido", length(outside_idx)),
      `Avance plataforma` = rep("Efectiva Kobo", length(outside_idx)),
      `Efectiva telefónica` = rep("No", length(outside_idx)),
      `Efectiva Kobo` = rep("Sí", length(outside_idx)),
      `Plataforma completa` = rep("Sí", length(outside_idx)),
      `Fecha Kobo` = response_dates[outside_idx],
      `Coinciden efectivas` = rep("No", length(outside_idx)),
      Coincidencia = rep("Efectiva Kobo fuera de base", length(outside_idx)),
      Fecha = rep("Sin fecha", length(outside_idx)),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
    reconciliation_detail <- rbind(reconciliation_detail, outside_detail)
  }
  if (length(quota_value_columns)) {
    for (variable in names(quota_value_columns)) {
      if (variable %in% names(reconciliation_detail)) next
      values <- quota_value_columns[[variable]]
      if (length(values) != nrow(reconciliation_detail)) {
        values <- c(values, rep("Sin dato", max(0L, nrow(reconciliation_detail) - length(values))))
      }
      reconciliation_detail[[variable]] <- values
    }
  }
  if (nrow(reconciliation_detail)) {
    mismatch_rank <- reconciliation_detail$`Coinciden efectivas` == "No" |
      reconciliation_detail$Coincidencia %in% c(
        "Sin CodPulso para cruzar",
        "Tel. efectiva sin efectiva Kobo",
        "Efectiva Kobo sin tel. efectiva"
      )
    reconciliation_detail <- reconciliation_detail[order(
      !mismatch_rank,
      reconciliation_detail$Actor,
      reconciliation_detail$Responsable,
      reconciliation_detail$CodPulso
    ), , drop = FALSE]
  }
  attempt_target <- 4
  attempts_for_ratio <- attempts
  attempts_for_ratio[is.na(attempts_for_ratio)] <- 0
  no_answer_detail <- data.frame(
    Responsable = responsables[no_answer_mask],
    Actor = actors[no_answer_mask],
    Caso = people[no_answer_mask],
    CodPulso = keys[no_answer_mask],
    Estado = status[no_answer_mask],
    Intentos = as.integer(ifelse(is.na(attempts[no_answer_mask]), 0, floor(attempts[no_answer_mask]))),
    `Intentos objetivo` = as.integer(rep(attempt_target, sum(no_answer_mask, na.rm = TRUE))),
    `Ratio insistencia` = round(attempts_for_ratio[no_answer_mask] / attempt_target, 4),
    Fecha = dates[no_answer_mask],
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  if (nrow(no_answer_detail)) {
    no_answer_detail$Caso[!.monitoreo_report_nonempty(no_answer_detail$Caso)] <- "Caso sin nombre"
    no_answer_detail$Actor[!.monitoreo_report_nonempty(no_answer_detail$Actor)] <- "Sin actor"
    no_answer_detail <- no_answer_detail[order(
      no_answer_detail$Actor,
      no_answer_detail$Responsable,
      no_answer_detail$Intentos,
      no_answer_detail$Caso
    ), , drop = FALSE]
  }
  reintento_rows <- lapply(seq_len(nrow(actor_responsible_groups)), function(group_idx) {
    actor <- actor_responsible_groups$Actor[[group_idx]]
    owner <- actor_responsible_groups$Responsable[[group_idx]]
    mask <- responsables == owner & actors == actor
    vals <- attempts[mask & reattempt_mask]
    valid <- vals[!is.na(vals)]
    data.frame(
      Actor = actor,
      Responsable = owner,
      `Casos reintentables` = as.integer(sum(mask & reattempt_mask, na.rm = TRUE)),
      `No contesta` = as.integer(sum(mask & no_answer_mask, na.rm = TRUE)),
      `Contactar después` = as.integer(sum(mask & call_later_mask, na.rm = TRUE)),
      `Otros no finales` = as.integer(sum(mask & reattempt_mask & !no_answer_mask & !call_later_mask, na.rm = TRUE)),
      `Reintentos bajos` = as.integer(sum(mask & low_reattempt_mask, na.rm = TRUE)),
      `Promedio intentos` = if (length(valid)) round(mean(valid), 2) else NA_real_,
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  })
  reintentos <- if (length(reintento_rows)) do.call(rbind, reintento_rows) else data.frame()
  if (nrow(reintentos)) {
    reintentos <- reintentos[reintentos$`Casos reintentables` > 0L, , drop = FALSE]
    reintentos <- reintentos[order(reintentos$Actor, -reintentos$`Reintentos bajos`, -reintentos$`Casos reintentables`, reintentos$Responsable), , drop = FALSE]
  }
  resp_detail_rows <- lapply(seq_len(nrow(actor_responsible_groups)), function(group_idx) {
    actor <- actor_responsible_groups$Actor[[group_idx]]
    owner <- actor_responsible_groups$Responsable[[group_idx]]
    mask <- responsables == owner & actors == actor
    owner_codes <- unique(keys[mask & .monitoreo_report_nonempty(keys)])
    owner_dates <- dates[mask & dates != "Sin fecha" & .monitoreo_report_nonempty(dates)]
    data.frame(
      Actor = actor,
      Responsable = owner,
      `Casos asignados` = as.integer(sum(mask, na.rm = TRUE)),
      `Ultima actualizacion` = if (length(owner_dates)) max(owner_dates) else "Sin fecha",
      `CodPulso asignados` = paste(utils::head(owner_codes, 12L), collapse = ", "),
      `CodPulso adicionales` = as.integer(max(0L, length(owner_codes) - 12L)),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  })
  by_resp_detail <- if (length(resp_detail_rows)) do.call(rbind, resp_detail_rows) else data.frame()
  if (nrow(by_resp_detail)) {
    by_resp_detail <- by_resp_detail[order(by_resp_detail$Actor, -by_resp_detail$`Casos asignados`, by_resp_detail$Responsable), , drop = FALSE]
  }
  standalone_phone <- identical(profile$family %||% "", "telefonico")
  blocks <- list(
    .monitoreo_report_block(
      "resumen_telefonico",
      "Resumen general",
      resumen,
      if (isTRUE(phone_from_population)) "Base telefónica inferida desde población objetivo/contactable." else ""
    ),
    .monitoreo_report_block("estatus_telefonico", "Distribución por estatus", dist),
    .monitoreo_report_block("cuotas_variable", "Cuotas por variable", quotas, "Distribución de la base telefónica por variable de control."),
    .monitoreo_report_block("avance_efectivo_variable_dia", "Avance efectivo por variable y día", quota_day, "Efectivas Kobo por variable de cuota y fecha de plataforma."),
    .monitoreo_report_block("control_tiempo_kobo", "Control de tiempos Kobo", utils::head(duration_control, 500L), "Efectivas Kobo que pasan filtro y no son pruebas, clasificadas por duración."),
    .monitoreo_report_block("produccion_dia", "Producción por día", by_day),
    .monitoreo_report_block("avance_efectivo_dia", "Avance efectivo por día", efectivo_dia),
    # Se publica en cualquier familia, no solo en el telefónico puro. `status_day`
    # ya se calcula arriba pase lo que pase, así que publicarlo no cuesta nada;
    # tenerlo escondido dejaba a la acreditación con barrido telefónico sin
    # forma de leer cómo se movieron los estados en el tiempo.
    .monitoreo_report_block("estatus_dia", "Estados telefónicos por día", status_day),
    # El mismo apilado, desglosado por cuota. Ver `monitoreo_telefonico_estados_dia.R`.
    .monitoreo_report_block(
      "estatus_actor_dia",
      "Estados telefónicos por cuota y día",
      .monitoreo_phone_status_actor_day(actors, status, dates, status_labels, dates_sorted)
    )
  )
  blocks <- c(blocks, list(
    .monitoreo_report_block("avance_efectivo_actor_dia", "Avance efectivo por actor y día", actor_day),
    .monitoreo_report_block("operacion_responsable", "Operación por responsable", utils::head(by_resp_ops, 120L)),
    .monitoreo_report_block("campo_vs_plataforma_responsable", "Barrido vs Kobo por responsable", utils::head(by_resp_ops[, intersect(names(by_resp_ops), c("Actor", "Responsable", "Casos asignados", "Barridos", "Efectivas telefónicas", "Efectivas Kobo", "Conciliadas por CodPulso", "Tel. efectiva sin efectiva Kobo", "Efectiva Kobo sin tel. efectiva", "Plataforma completa", "Conciliadas", "Tel. efectiva sin plataforma completa", "Plataforma completa sin tel. efectiva")), drop = FALSE], 120L))
  ))
  if (isTRUE(standalone_phone)) {
    blocks <- c(blocks, list(.monitoreo_report_block("comparacion_codpulso", "Comparación CodPulso: barrido vs Kobo", reconciliation_detail)))
  }
  # El conflicto de llave se descontaba en silencio; ahora se reporta para poder
  # separarlo de los pendientes por falta de registro (plan §7).
  key_conflicts <- .monitoreo_report_phone_key_conflict_df(responses, profile)
  if (nrow(key_conflicts)) {
    blocks <- c(blocks, list(.monitoreo_report_block(
      "conflicto_enlace_codpulso",
      "Enlace abierto distinto al código escrito",
      utils::head(key_conflicts, 300L),
      "El código que viajaba en el enlace no coincide con el que se escribió al levantar la encuesta. El caso queda sin cruzar hasta resolverlo."
    )))
  }
  c(blocks, list(
    .monitoreo_report_block("estatus_responsable", "Estados por responsable", utils::head(by_status_resp, 240L)),
    .monitoreo_report_block("insistencia_no_contesta", "Insistencia / rebarrido: No contesta", utils::head(insistencia, 120L)),
    .monitoreo_report_block("detalle_no_contesta", "Detalle de casos que no contestan", utils::head(no_answer_detail, 500L)),
    .monitoreo_report_block("reintentos_responsable", "No efectivos reintentables", utils::head(reintentos, 120L)),
    .monitoreo_report_block("no_barridos_responsable", "No barridos por responsable", utils::head(by_resp_ops[, intersect(names(by_resp_ops), c("Actor", "Responsable", "Casos asignados", "No barridos", "% no barrido")), drop = FALSE], 120L)),
    .monitoreo_report_block("responsables_barrido", "Responsables asignados", utils::head(by_resp_detail, 120L)),
    .monitoreo_report_block("efectivos_responsable", "Efectivos por responsable", utils::head(by_resp, 80L))
  ))
}

# --- Producción telefónica para publicación ----------------------------------

.monitoreo_publication_phone_production_summary_df <- function(reports = list()) {
  ops <- .monitoreo_workbook_block_df(reports, "monitoreo_telefonico", "operacion_responsable")
  ops <- .monitoreo_workbook_df(ops)
  if (!nrow(ops) || !"Responsable" %in% names(ops)) {
    return(.monitoreo_publication_empty_df("Sin producción telefónica por responsable para este corte."))
  }
  responsible <- trimws(as.character(ops$Responsable %||% ""))
  keep <- .monitoreo_publication_has_assigned_responsible(responsible)
  ops <- ops[keep, , drop = FALSE]
  responsible <- responsible[keep]
  if (!nrow(ops)) return(.monitoreo_publication_empty_df("Sin producción telefónica por responsable para este corte."))
  actors <- trimws(as.character(ops$Actor %||% ""))
  actors[!nzchar(actors) | is.na(actors)] <- "Todos"
  rows <- lapply(unique(responsible), function(resp) {
    part <- ops[responsible == resp, , drop = FALSE]
    part_actors <- unique(trimws(as.character(part$Actor %||% "")))
    part_actors <- part_actors[nzchar(part_actors)]
    assigned <- sum(.monitoreo_publication_num_col(part, "Casos asignados"), na.rm = TRUE)
    swept <- sum(.monitoreo_publication_num_col(part, "Barridos"), na.rm = TRUE)
    effective <- sum(.monitoreo_publication_num_col(part, c("Efectivas telefónicas", "Efectivas")), na.rm = TRUE)
    no_swept <- sum(.monitoreo_publication_num_col(part, "No barridos"), na.rm = TRUE)
    data.frame(
      Responsable = resp,
      Actores = if (length(part_actors)) paste(part_actors, collapse = " · ") else "Todos",
      `Casos asignados` = as.integer(assigned),
      Barridos = as.integer(swept),
      `No barridos` = as.integer(no_swept),
      `Efectivas telefónicas` = as.integer(effective),
      `Rechazos telefónicos` = as.integer(sum(.monitoreo_publication_num_col(part, "Rechazos telefónicos"), na.rm = TRUE)),
      `Sin efectiva` = as.integer(sum(.monitoreo_publication_num_col(part, c("Sin efectiva", "Incidencias")), na.rm = TRUE)),
      Reintentos = as.integer(sum(.monitoreo_publication_num_col(part, "Reintentos"), na.rm = TRUE)),
      `Reintentos bajos` = as.integer(sum(.monitoreo_publication_num_col(part, "Reintentos bajos"), na.rm = TRUE)),
      `% barrido` = .monitoreo_publication_pct(swept, assigned),
      `% efectividad barridos` = .monitoreo_publication_pct(effective, swept),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, rows)
  out <- out[order(
    -suppressWarnings(as.numeric(out$`Efectivas telefónicas` %||% 0)),
    -suppressWarnings(as.numeric(out$Barridos %||% 0)),
    .monitoreo_publication_responsible_sort_key(out$Responsable),
    out$Responsable
  ), , drop = FALSE]
  rownames(out) <- NULL
  out
}

.monitoreo_publication_phone_production_detail_df <- function(reports = list()) {
  assigned <- .monitoreo_workbook_block_df(reports, "monitoreo_telefonico", "responsables_barrido")
  assigned <- .monitoreo_workbook_df(assigned)
  if (nrow(assigned) && "Responsable" %in% names(assigned)) {
    responsible <- trimws(as.character(assigned$Responsable %||% ""))
    assigned <- assigned[.monitoreo_publication_has_assigned_responsible(responsible), , drop = FALSE]
    if (nrow(assigned)) {
      assigned <- .monitoreo_publication_cols_first(
        assigned,
        c("Responsable", "Actor", "Casos asignados", "Ultima actualizacion", "Última actualización", "CodPulso asignados", "CodPulso adicionales")
      )
      assigned <- assigned[order(
        .monitoreo_publication_responsible_sort_key(assigned$Responsable),
        as.character(assigned$Actor %||% ""),
        as.character(assigned$Responsable %||% "")
      ), , drop = FALSE]
      rownames(assigned) <- NULL
      return(assigned)
    }
  }
  ops <- .monitoreo_workbook_block_df(reports, "monitoreo_telefonico", "operacion_responsable")
  ops <- .monitoreo_workbook_df(ops)
  if (!nrow(ops) || !"Responsable" %in% names(ops)) {
    return(.monitoreo_publication_empty_df("Sin detalle telefónico por responsable para este corte."))
  }
  responsible <- trimws(as.character(ops$Responsable %||% ""))
  ops <- ops[.monitoreo_publication_has_assigned_responsible(responsible), , drop = FALSE]
  if (!nrow(ops)) return(.monitoreo_publication_empty_df("Sin detalle telefónico por responsable para este corte."))
  ops <- .monitoreo_publication_cols_first(
    ops,
    c("Responsable", "Actor", "Casos asignados", "Barridos", "No barridos", "Efectivas telefónicas", "Rechazos telefónicos", "Sin efectiva", "Reintentos")
  )
  ops <- ops[order(.monitoreo_publication_responsible_sort_key(ops$Responsable), as.character(ops$Actor %||% "")), , drop = FALSE]
  rownames(ops) <- NULL
  ops
}

.monitoreo_publication_phone_status_by_responsible_df <- function(reports = list()) {
  status <- .monitoreo_workbook_block_df(reports, "monitoreo_telefonico", "estatus_responsable")
  status <- .monitoreo_workbook_df(status)
  if (!nrow(status) || !"Responsable" %in% names(status)) {
    return(.monitoreo_publication_empty_df("Sin estados telefónicos por responsable para este corte."))
  }
  responsible <- trimws(as.character(status$Responsable %||% ""))
  status <- status[.monitoreo_publication_has_assigned_responsible(responsible), , drop = FALSE]
  if (!nrow(status)) return(.monitoreo_publication_empty_df("Sin estados telefónicos por responsable para este corte."))
  status <- .monitoreo_publication_cols_first(status, c("Responsable", "Actor", "Estado", "Casos", "Total responsable", "% responsable"))
  status <- status[order(
    .monitoreo_publication_responsible_sort_key(status$Responsable),
    as.character(status$Actor %||% ""),
    -suppressWarnings(as.numeric(status$Casos %||% 0)),
    as.character(status$Estado %||% "")
  ), , drop = FALSE]
  rownames(status) <- NULL
  status
}

.monitoreo_publication_phone_production_sheet_df <- function(reports = list()) {
  summary <- .monitoreo_publication_phone_present_df(.monitoreo_publication_phone_production_summary_df(reports))
  platform <- .monitoreo_publication_phone_platform_production_df(reports)
  detail <- .monitoreo_publication_phone_present_df(.monitoreo_publication_phone_production_detail_df(reports))
  status <- .monitoreo_publication_phone_present_df(.monitoreo_publication_phone_status_by_responsible_df(reports))
  .monitoreo_workbook_bind(
    .monitoreo_publication_tag_df("Ranking por responsable", summary),
    .monitoreo_publication_tag_df("Producción efectiva plataforma por responsable", platform),
    .monitoreo_publication_tag_df("Estados por responsable", status),
    .monitoreo_publication_tag_df("Detalle por responsable", detail)
  )
}

# --- Publicación telefónica: data frames cliente e interna -------------------

.monitoreo_publication_phone_client_monitoring_df <- function(reports = list()) {
  block <- function(id, title) {
    df <- .monitoreo_workbook_block_df(reports, "monitoreo_telefonico", id)
    df <- .monitoreo_publication_drop_client_identifier_cols(df)
    df <- .monitoreo_publication_phone_present_df(df)
    .monitoreo_publication_tag_df(title, df)
  }
  .monitoreo_workbook_bind(
    block("resumen_telefonico", "Resumen general"),
    block("estatus_telefonico", "Distribución por estatus"),
    block("avance_efectivo_dia", "Avance efectivo por día"),
    block("operacion_responsable", "Operación por responsable"),
    block("reintentos_responsable", "No efectivos reintentables"),
    block("no_barridos_responsable", "No barridos por responsable")
  )
}

.monitoreo_publication_phone_client_alerts_df <- function(reports = list()) {
  alerts <- .monitoreo_workbook_block_df(reports, "alertas")
  alerts <- .monitoreo_publication_drop_client_identifier_cols(alerts)
  .monitoreo_publication_nonempty_df(alerts, "Sin alertas determinísticas para este corte.")
}

.monitoreo_publication_phone_block_df <- function(reports = list(), block_id, cols = NULL) {
  df <- .monitoreo_workbook_block_df(reports, "monitoreo_telefonico", block_id)
  df <- .monitoreo_workbook_df(df)
  if (!is.null(cols)) df <- .monitoreo_publication_cols_first(df, cols)
  df
}

.monitoreo_publication_phone_block_tag <- function(reports = list(), block_id, title, cols = NULL, empty_message = NULL) {
  df <- .monitoreo_publication_phone_block_df(reports, block_id, cols)
  df <- .monitoreo_publication_phone_present_df(df)
  if (!nrow(df) && !is.null(empty_message)) df <- .monitoreo_publication_empty_df(empty_message)
  .monitoreo_publication_tag_df(title, df)
}

.monitoreo_publication_phone_summary_cards_df <- function(reports = list()) {
  summary <- .monitoreo_publication_phone_block_df(reports, "resumen_telefonico")
  daily <- .monitoreo_publication_phone_block_df(reports, "avance_efectivo_dia")
  quotas <- .monitoreo_publication_phone_block_df(reports, "cuotas_variable")
  reattempts <- .monitoreo_publication_phone_block_df(reports, "reintentos_responsable")
  differences <- .monitoreo_publication_phone_difference_summary_df(reports)

  metric <- function(df, label, col = "Casos", fallback = 0) {
    df <- .monitoreo_workbook_df(df)
    if (!nrow(df) || !"Indicador" %in% names(df) || !col %in% names(df)) return(fallback)
    hit <- which(trimws(as.character(df$Indicador %||% "")) == label)
    if (!length(hit)) return(fallback)
    value <- suppressWarnings(as.numeric(df[[col]][[hit[[1L]]]]))
    if (is.finite(value)) value else fallback
  }
  sum_col <- function(df, candidates) {
    df <- .monitoreo_workbook_df(df)
    if (!nrow(df)) return(0)
    sum(.monitoreo_publication_num_col(df, candidates), na.rm = TRUE)
  }
  total <- metric(summary, "Total telefónico")
  swept <- metric(summary, "Casos barridos")
  unswept <- metric(summary, "No barridos")
  effective <- if (nrow(differences) && "Efectivas Kobo" %in% names(differences)) {
    sum_col(differences, "Efectivas Kobo")
  } else {
    sum_col(daily, c("Efectivas Kobo", "Efectivas"))
  }
  quota_gaps <- if (nrow(quotas) && "Estado cuota" %in% names(quotas)) {
    sum(grepl("brecha", as.character(quotas$`Estado cuota` %||% ""), ignore.case = TRUE), na.rm = TRUE)
  } else {
    0L
  }
  reattempt_low <- sum_col(reattempts, "Reintentos bajos")
  pct <- function(done, target) if (is.finite(target) && target > 0) round(100 * done / target, 1) else NA_real_
  data.frame(
    Indicador = c("Casos barridos", "No barridos", "Efectivas Kobo", "Brechas de cuota", "Reintentos bajos", "Total telefónico"),
    n = as.integer(c(swept, unswept, effective, quota_gaps, reattempt_low, total)),
    `%` = c(pct(swept, total), pct(unswept, total), pct(effective, total), if (nrow(quotas)) pct(quota_gaps, nrow(quotas)) else NA_real_, NA_real_, 100),
    Estado = c(
      if (swept >= total && total > 0) "Barrido completo" else "En barrido",
      if (unswept > 0) "Pendiente" else "Sin pendientes",
      "Avance plataforma",
      if (quota_gaps > 0) "Brecha" else "Sin brechas visibles",
      if (reattempt_low > 0) "Revisar insistencia" else "Sin alerta de insistencia",
      "Base del corte"
    ),
    Lectura = c(
      "Casos con un estado telefónico registrado.",
      "Casos todavía sin barrido operativo.",
      "Efectivas válidas según plataforma cuando existe cruce.",
      "Segmentos de cuota que aún no alcanzan la meta.",
      "Casos reintentables con menos intentos que el objetivo.",
      "Universo telefónico cargado para este corte."
    ),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
}

.monitoreo_publication_phone_difference_summary_df <- function(reports = list()) {
  ops <- .monitoreo_publication_phone_block_df(reports, "campo_vs_plataforma_responsable")
  if (!nrow(ops)) ops <- .monitoreo_publication_phone_block_df(reports, "operacion_responsable")
  if (!nrow(ops) || !"Responsable" %in% names(ops)) {
    return(.monitoreo_publication_empty_df("Sin cruce teléfono-plataforma por responsable para este corte."))
  }
  responsible <- trimws(as.character(ops$Responsable %||% ""))
  keep <- .monitoreo_publication_has_assigned_responsible(responsible)
  ops <- ops[keep, , drop = FALSE]
  responsible <- responsible[keep]
  if (!nrow(ops)) {
    return(.monitoreo_publication_empty_df("Sin responsables asignados para comparar teléfono y plataforma."))
  }
  rows <- lapply(unique(responsible), function(resp) {
    part <- ops[responsible == resp, , drop = FALSE]
    part_actors <- unique(trimws(as.character(part$Actor %||% "")))
    part_actors <- part_actors[nzchar(part_actors)]
    phone_effective <- sum(.monitoreo_publication_num_col(part, c("Efectivas telefónicas", "Efectivas")), na.rm = TRUE)
    platform_effective <- sum(.monitoreo_publication_num_col(part, c("Efectivas Kobo", "Plataforma completa")), na.rm = TRUE)
    conciliated <- sum(.monitoreo_publication_num_col(part, c("Conciliadas por CodPulso", "Conciliadas")), na.rm = TRUE)
    phone_only <- sum(.monitoreo_publication_num_col(part, c("Tel. efectiva sin efectiva Kobo", "Tel. efectiva sin plataforma completa")), na.rm = TRUE)
    platform_only <- sum(.monitoreo_publication_num_col(part, c("Efectiva Kobo sin tel. efectiva", "Plataforma completa sin tel. efectiva")), na.rm = TRUE)
    assigned <- sum(.monitoreo_publication_num_col(part, "Casos asignados"), na.rm = TRUE)
    swept <- sum(.monitoreo_publication_num_col(part, "Barridos"), na.rm = TRUE)
    difference_total <- phone_only + platform_only
    compare_base <- max(phone_effective, platform_effective, conciliated, na.rm = TRUE)
    if (!is.finite(compare_base)) compare_base <- 0
    data.frame(
      Responsable = resp,
      Actores = if (length(part_actors)) paste(part_actors, collapse = " · ") else "Todos",
      `Casos asignados` = as.integer(assigned),
      Barridos = as.integer(swept),
      `Efectivas telefónicas` = as.integer(phone_effective),
      `Efectivas Kobo` = as.integer(platform_effective),
      `Conciliadas por CodPulso` = as.integer(conciliated),
      `Tel. efectiva sin efectiva Kobo` = as.integer(phone_only),
      `Efectiva Kobo sin tel. efectiva` = as.integer(platform_only),
      `Diferencias a revisar` = as.integer(difference_total),
      `Diferencia neta plataforma-teléfono` = as.integer(platform_effective - phone_effective),
      `% conciliación` = .monitoreo_publication_pct(conciliated, compare_base),
      `Estado comparativo` = if (difference_total > 0) {
        "Revisar diferencias"
      } else if (compare_base > 0) {
        "Coincide"
      } else {
        "Sin efectivas para comparar"
      },
      `Acción sugerida` = if (difference_total > 0) {
        "Revisar CodPulso, estado telefónico y envío Kobo"
      } else if (swept < assigned) {
        "Completar barrido pendiente"
      } else {
        "Sin acción inmediata"
      },
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, rows)
  out <- out[order(
    -suppressWarnings(as.numeric(out$`Diferencias a revisar` %||% 0)),
    -suppressWarnings(as.numeric(out$`Efectiva Kobo sin tel. efectiva` %||% 0)),
    -suppressWarnings(as.numeric(out$`Tel. efectiva sin efectiva Kobo` %||% 0)),
    .monitoreo_publication_responsible_sort_key(out$Responsable),
    out$Responsable
  ), , drop = FALSE]
  rownames(out) <- NULL
  out
}

.monitoreo_publication_phone_platform_production_df <- function(reports = list()) {
  diff <- .monitoreo_publication_phone_difference_summary_df(reports)
  diff <- .monitoreo_workbook_df(diff)
  if (!nrow(diff) || !"Responsable" %in% names(diff)) return(diff)
  out <- .monitoreo_publication_cols_first(
    diff,
    c(
      "Responsable", "Actores", "Efectivas Kobo", "Conciliadas por CodPulso",
      "Efectiva Kobo sin tel. efectiva", "% conciliación",
      "Estado comparativo", "Acción sugerida"
    )
  )
  .monitoreo_publication_phone_present_df(out)
}

.monitoreo_publication_phone_supervision_matrix_df <- function(reports = list()) {
  summary <- .monitoreo_publication_phone_block_df(reports, "resumen_telefonico")
  quotas <- .monitoreo_publication_phone_block_df(reports, "cuotas_variable")
  reattempts <- .monitoreo_publication_phone_block_df(reports, "reintentos_responsable")
  differences <- .monitoreo_publication_phone_difference_summary_df(reports)
  differences <- .monitoreo_workbook_df(differences)

  metric <- function(df, label, col = "Casos", fallback = 0) {
    df <- .monitoreo_workbook_df(df)
    if (!nrow(df) || !"Indicador" %in% names(df) || !col %in% names(df)) return(fallback)
    hit <- which(trimws(as.character(df$Indicador %||% "")) == label)
    if (!length(hit)) return(fallback)
    value <- suppressWarnings(as.numeric(df[[col]][[hit[[1L]]]]))
    if (is.finite(value)) value else fallback
  }
  sum_col <- function(df, candidates) {
    df <- .monitoreo_workbook_df(df)
    if (!nrow(df)) return(0)
    sum(.monitoreo_publication_num_col(df, candidates), na.rm = TRUE)
  }
  total <- metric(summary, "Total telefónico")
  swept <- metric(summary, "Casos barridos")
  unswept <- metric(summary, "No barridos")
  phone_effective <- sum_col(differences, "Efectivas telefónicas")
  platform_effective <- sum_col(differences, "Efectivas Kobo")
  difference_total <- sum_col(differences, "Diferencias a revisar")
  quota_gaps <- if (nrow(quotas) && "Estado cuota" %in% names(quotas)) {
    sum(grepl("brecha", as.character(quotas$`Estado cuota` %||% ""), ignore.case = TRUE), na.rm = TRUE)
  } else {
    0L
  }
  low_reattempts <- sum_col(reattempts, "Reintentos bajos")
  assigned_responsibles <- if (nrow(differences) && "Responsable" %in% names(differences)) {
    length(unique(as.character(differences$Responsable %||% "")))
  } else {
    0L
  }
  rows <- data.frame(
    Capa = c(
      "Avance general",
      "Cuotas",
      "Barrido por responsable",
      "Producción plataforma",
      "Conciliación teléfono-plataforma",
      "Insistencia"
    ),
    Lectura = c(
      sprintf("%s de %s casos con estado telefónico.", swept, total),
      sprintf("%s segmentos de cuota con brecha.", quota_gaps),
      sprintf("%s responsables con carga telefónica visible.", assigned_responsibles),
      sprintf("%s efectivas Kobo frente a %s efectivas telefónicas.", platform_effective, phone_effective),
      sprintf("%s diferencias agregadas entre teléfono y plataforma.", difference_total),
      sprintf("%s casos reintentables con menos intentos que el objetivo.", low_reattempts)
    ),
    Valor = as.integer(c(swept, quota_gaps, assigned_responsibles, platform_effective, difference_total, low_reattempts)),
    `%` = c(
      .monitoreo_publication_pct(swept, total),
      if (nrow(quotas)) .monitoreo_publication_pct(quota_gaps, nrow(quotas)) else NA_real_,
      NA_real_,
      .monitoreo_publication_pct(platform_effective, total),
      .monitoreo_publication_pct(difference_total, max(1, phone_effective + platform_effective)),
      NA_real_
    ),
    Estado = c(
      if (unswept > 0) "En barrido" else "Barrido completo",
      if (quota_gaps > 0) "Brecha" else "Sin brechas visibles",
      if (assigned_responsibles > 0) "Supervisión activa" else "Sin responsables",
      if (platform_effective > 0) "Avance plataforma" else "Sin efectivas Kobo",
      if (difference_total > 0) "Revisar diferencias" else "Coincide",
      if (low_reattempts > 0) "Revisar insistencia" else "Sin alerta de insistencia"
    ),
    `Uso operativo` = c(
      "Ubicar el ritmo general antes de revisar cuotas o responsables.",
      "Priorizar segmentos que aún no alcanzan la meta configurada.",
      "Entrar al detalle de barrido, no barridos y estados telefónicos.",
      "Separar producción efectiva de plataforma de producción telefónica.",
      "Comparar efectivas Kobo con efectivas por estado telefónico.",
      "Identificar casos no finales que necesitan más intentos."
    ),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  rows
}

.monitoreo_publication_phone_internal_summary_df <- function(reports = list()) {
  .monitoreo_workbook_bind(
    .monitoreo_publication_tag_df("Lectura rápida de avance", .monitoreo_publication_phone_summary_cards_df(reports)),
    .monitoreo_publication_tag_df("Matriz de supervisión telefónica", .monitoreo_publication_phone_supervision_matrix_df(reports)),
    .monitoreo_publication_phone_block_tag(
      reports,
      "estatus_telefonico",
      "Distribución por estatus",
      c("Estatus", "Casos", "% del total telefónico")
    ),
    .monitoreo_publication_phone_block_tag(
      reports,
      "estatus_dia",
      "Estados telefónicos por día",
      c("Estado")
    )
  )
}

.monitoreo_publication_phone_internal_progress_df <- function(reports = list()) {
  .monitoreo_workbook_bind(
    .monitoreo_publication_phone_block_tag(
      reports,
      "cuotas_variable",
      "Cuotas por variable",
      c("Actor", "Variable", "Valor", "Universo", "Meta", "Efectivas", "Avance meta", "Brecha", "Estado cuota", "Parciales", "Rechazos telefónicos", "No barridos")
    ),
    .monitoreo_publication_phone_block_tag(
      reports,
      "avance_efectivo_variable_dia",
      "Avance efectivo por variable y día",
      c("Variable", "Valor", "Fecha", "Efectivas Kobo", "Efectivas")
    ),
    .monitoreo_publication_phone_block_tag(
      reports,
      "avance_efectivo_dia",
      "Avance efectivo por día",
      c("Fecha", "Efectivas Kobo", "Efectivas", "Efectivas telefónicas", "Parciales", "Rechazos telefónicos", "Sin efectiva", "Barridos", "Incidencias", "Ratio incidencias")
    ),
    .monitoreo_publication_phone_block_tag(
      reports,
      "produccion_dia",
      "Producción por día",
      c("Fecha", "Casos")
    )
  )
}

.monitoreo_publication_phone_internal_reconciliation_df <- function(reports = list()) {
  .monitoreo_workbook_bind(
    .monitoreo_publication_tag_df(
      "Resumen de diferencias por responsable",
      .monitoreo_publication_phone_present_df(.monitoreo_publication_phone_difference_summary_df(reports))
    ),
    .monitoreo_publication_phone_block_tag(
      reports,
      "campo_vs_plataforma_responsable",
      "Barrido vs Kobo por responsable",
      c("Actor", "Responsable", "Casos asignados", "Barridos", "Efectivas telefónicas", "Efectivas Kobo", "Conciliadas por CodPulso", "Tel. efectiva sin efectiva Kobo", "Efectiva Kobo sin tel. efectiva")
    ),
    .monitoreo_publication_phone_block_tag(
      reports,
      "comparacion_codpulso",
      "Comparación CodPulso: barrido vs Kobo",
      c("CodPulso", "Actor", "Responsable", "Caso", "Coincidencia", "Efectiva telefónica", "Efectiva Kobo", "Fecha Kobo", "Estado telefónico", "Avance telefónico", "Avance plataforma", "Fecha")
    ),
    .monitoreo_publication_phone_block_tag(
      reports,
      "insistencia_no_contesta",
      "Insistencia / rebarrido: No contesta",
      c("Actor", "Responsable", "Casos No contesta", "Suma intentos", "Promedio intentos", "Sin intentos", "1 intento", "2 intentos", "3 intentos", "4 intentos")
    ),
    .monitoreo_publication_phone_block_tag(
      reports,
      "detalle_no_contesta",
      "Detalle de casos que no contestan",
      c("Actor", "Responsable", "Caso", "CodPulso", "Estado", "Intentos", "Intentos objetivo", "Ratio insistencia", "Fecha")
    ),
    .monitoreo_publication_phone_block_tag(
      reports,
      "no_barridos_responsable",
      "No barridos por responsable",
      c("Actor", "Responsable", "Casos asignados", "No barridos", "% no barrido")
    )
  )
}

.monitoreo_publication_phone_internal_alerts_df <- function(reports = list(), queries = list()) {
  alerts <- .monitoreo_workbook_block_df(reports, "alertas", "alertas")
  .monitoreo_workbook_bind(
    .monitoreo_publication_tag_df("Puntos de atención", .monitoreo_publication_nonempty_df(alerts, "Sin alertas internas determinísticas para este corte.")),
    .monitoreo_publication_tag_df("Casos para revisar", .monitoreo_publication_nonempty_df(.monitoreo_workbook_bind(queries$cases %||% list(), queries$issues %||% list(), queries$pending_exit %||% list()), "Sin casos accionables internos."))
  )
}

# --- Job runner del PDF de avance telefónico ---------------------------------
# A diferencia de monitoreo_client_report_pdf_job_runner (router_monitoreo.R),
# que despacha por familia para servir al endpoint genérico, este runner asume
# modelo telefónico: el endpoint /api/monitoreo/telefonico/report/pdf ya validó
# la familia al construir el modelo (E_PERFIL_NO_TELEFONICO si no corresponde).
# Mantener ambos runners es deliberado: el genérico preserva la back-compat del
# frontend actual; este es el camino propio del producto telefónico.
monitoreo_telefonico_report_pdf_job_runner <- function(model_path,
                                                       include_targets = FALSE,
                                                       result_path = NULL,
                                                       progress_path = NULL) {
  report <- if (!is.null(progress_path)) job_progress_writer(progress_path) else function(...) invisible(NULL)
  report("prepare", percent = 15, message = "Preparando avance telefónico...")
  model <- readRDS(model_path)
  report("render", percent = 55, message = "Renderizando avance telefónico...")
  monitoreo_telefonico_advance_report_pdf(model, result_path, include_targets = include_targets)
  report("export", percent = 95, message = "Guardando PDF...")
  list(ok = TRUE, size = as.numeric(file.info(result_path)$size %||% 0), filename = basename(result_path))
}
