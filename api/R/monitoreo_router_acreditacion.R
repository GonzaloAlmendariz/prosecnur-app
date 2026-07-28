# Helpers de `mount_monitoreo` — perfil de acreditación.
#
# Extraídos de `router_monitoreo.R`, que está congelado a crecimiento
# (`agentic/manifest.json` → `policy.frozen_growth_files`). Mismo paquete y
# mismo namespace: el traslado no cambia comportamiento, solo reparte el
# archivo. La lógica de dominio nueva va al engine, no aquí.

.monitoreo_acreditacion_case_base_actor <- function(item) {
  base_source <- .monitoreo_text_key(item$base_source %||% "")
  if (!nzchar(base_source)) return("")
  actors <- c("administrativos", "docentes", "egresados", "estudiantes")
  hit <- actors[vapply(actors, function(actor) grepl(actor, base_source, fixed = TRUE), logical(1))]
  if (length(hit)) hit[[1]] else ""
}
.monitoreo_acreditacion_cached_case_actor_mismatch <- function(item) {
  if (!is.list(item)) return(FALSE)
  actor <- .monitoreo_text_key(item$actor %||% "")
  base_actor <- .monitoreo_acreditacion_case_base_actor(item)
  if (!nzchar(actor) || !nzchar(base_actor) || identical(actor, base_actor)) return(FALSE)
  identical(.monitoreo_text_key(item$advancement %||% ""), "effective") &&
    identical(.monitoreo_text_key(item$issue_type %||% ""), "efectiva_real")
}
.monitoreo_acreditacion_repair_cached_case <- function(item) {
  if (!.monitoreo_acreditacion_cached_case_actor_mismatch(item)) return(item)
  previous_base_source <- .monitoreo_scalar(item$base_source %||% "", "")
  previous_base_record <- .monitoreo_scalar(item$base_record %||% "", "")
  item$base_result <- "Fuera de base"
  item$base_source <- "Sin base operativa"
  item$base_status <- "Fuera de base"
  item$decision <- "Excluido del avance"
  item$decision_reason <- "La llave cruzaba contra una base de otro actor; queda fuera hasta revisar o decidir incluir con salvedad."
  item$advancement <- "excluded"
  item$issue_type <- "fuera_base"
  item$rule <- "Llave detectada fuera de la base del actor; queda fuera hasta corregir o decidir incluir con salvedad."
  item$pending_exit <- FALSE
  item$base_record <- previous_base_record
  item$cross_actor_base_source <- previous_base_source
  item
}
.monitoreo_acreditacion_group_total <- function(cases, field, fallback, output_field = field) {
  cases <- Filter(is.list, cases %||% list())
  if (!length(cases)) return(list())
  values <- vapply(cases, function(item) {
    value <- .monitoreo_scalar(item[[field]] %||% "", "")
    if (nzchar(value)) value else fallback
  }, character(1))
  values <- unique(values)
  lapply(values, function(value) {
    group_cases <- Filter(function(item) {
      current <- .monitoreo_scalar(item[[field]] %||% "", "")
      if (!nzchar(current)) current <- fallback
      identical(current, value)
    }, cases)
    advancement <- vapply(group_cases, function(item) .monitoreo_scalar(item$advancement %||% "", ""), character(1))
    out <- list(
      total = as.integer(length(group_cases)),
      efectivas = as.integer(sum(advancement == "effective", na.rm = TRUE)),
      parciales = as.integer(sum(advancement == "partial", na.rm = TRUE)),
      rechazos = as.integer(sum(advancement == "refusal", na.rm = TRUE)),
      pendientes = as.integer(sum(advancement == "pending", na.rm = TRUE)),
      revision = as.integer(sum(advancement == "excluded", na.rm = TRUE)),
      salen_de_pendientes = as.integer(sum(vapply(group_cases, function(item) isTRUE(item$pending_exit), logical(1)), na.rm = TRUE))
    )
    c(setNames(list(value), output_field), out)
  })
}
.monitoreo_acreditacion_repair_internal_queries <- function(internal_queries) {
  if (!is.list(internal_queries) || !is.list(internal_queries$cases)) return(internal_queries)
  repaired_cases <- lapply(internal_queries$cases, .monitoreo_acreditacion_repair_cached_case)
  changed <- sum(vapply(seq_along(repaired_cases), function(idx) {
    !identical(repaired_cases[[idx]]$advancement %||% "", internal_queries$cases[[idx]]$advancement %||% "")
  }, logical(1)))
  if (!changed) return(internal_queries)
  internal_queries$cases <- repaired_cases
  internal_queries$totals <- list(
    actor = .monitoreo_acreditacion_group_total(repaired_cases, "actor", "Sin actor"),
    date = .monitoreo_acreditacion_group_total(repaired_cases, "date", "Sin fecha"),
    channel = .monitoreo_acreditacion_group_total(repaired_cases, "channel", "Sin canal"),
    source = .monitoreo_acreditacion_group_total(repaired_cases, "source_label", "Sin fuente", "source"),
    collector = .monitoreo_acreditacion_group_total(repaired_cases, "collector_name", "Sin responsable", "collector")
  )
  internal_queries$cache_repair <- list(
    schema = "monitoreo_acreditacion_internal_queries_cache_repair_v1",
    cross_actor_effectives_reclassified = as.integer(changed)
  )
  internal_queries
}
.monitoreo_acreditacion_repair_cached_dashboard <- function(dashboard) {
  if (!is.list(dashboard) || !is.list(dashboard$acreditacion_reports)) return(dashboard)
  reports <- dashboard$acreditacion_reports
  reports$internal_queries <- .monitoreo_acreditacion_repair_internal_queries(reports$internal_queries %||% list())
  dashboard$acreditacion_reports <- reports
  dashboard
}
.monitoreo_acreditacion_apply_case_reconciliation <- function(data, config = list(), payload = list()) {
  if (!is.list(payload)) payload <- list()
  response_id <- .monitoreo_scalar(payload$response_id %||% payload$responseId, "")
  action <- .monitoreo_scalar(payload$action %||% payload$accion, "")
  if (!nzchar(response_id)) stop_api(400, "E_MONITOREO_RESPONSE_ID", "Falta response_id para guardar la decision.")
  if (!action %in% c("keep_excluded", "include_with_caveat")) {
    stop_api(400, "E_MONITOREO_DECISION_ACTION", "action debe ser keep_excluded o include_with_caveat.")
  }
  if (!is.data.frame(data) || !nrow(data)) {
    stop_api(409, "E_MONITOREO_NO_SNAPSHOT", "No hay snapshot local de monitoreo para auditar el caso.")
  }

  cfg <- monitoreo_normalize_config(config %||% list(), data)
  profile <- cfg$monitoreo_profile %||% monitoreo_normalize_profile(list())
  queries <- .monitoreo_acreditacion_internal_queries(data, profile)
  cases <- queries$cases %||% list()
  hits <- Filter(function(item) identical(.monitoreo_scalar(item$response_id, ""), response_id), cases)
  if (!length(hits)) stop_api(404, "E_MONITOREO_CASE_NOT_FOUND", "No se encontro el response_id en los casos del corte.")
  item <- hits[[1]]
  assisted <- item$assisted_review %||% list()
  reviewable_case <- .monitoreo_text_key(item$base_result %||% "") %in% c("sin cruce", "sin llave") ||
    .monitoreo_text_key(item$issue_type %||% "") %in% c("fuera_base", "sin_llave", "incluido_con_salvedad")
  if (!isTRUE(assisted$eligible) && is.null(assisted$manual_decision) && !isTRUE(reviewable_case)) {
    stop_api(409, "E_MONITOREO_CASE_NOT_REVIEWABLE", "Este caso no tiene evidencia secundaria para revision asistida.")
  }

  note <- .monitoreo_scalar(payload$note %||% payload$nota, "")
  candidate_id <- .monitoreo_scalar(payload$candidate_id %||% payload$candidateId %||% payload$assigned_case_key, "")
  selected <- NULL
  if (identical(action, "include_with_caveat")) {
    state_key <- .monitoreo_text_key(item$platform_state %||% "")
    if (!state_key %in% c("completa", "parcial")) {
      stop_api(409, "E_MONITOREO_CASE_NOT_VALIDATABLE", "Solo una respuesta completa o parcial revisable puede incluirse con salvedad en el avance.")
    }
    if (!nzchar(candidate_id)) stop_api(400, "E_MONITOREO_CANDIDATE_REQUIRED", "Selecciona una persona del universo para incluir con salvedad.")
    candidates <- c(assisted$candidates %||% list(), assisted$assignment_candidates %||% list())
    matches <- Filter(function(candidate) {
      identical(.monitoreo_scalar(candidate$candidate_id, ""), candidate_id) ||
        identical(.monitoreo_scalar(candidate$case_key, ""), candidate_id)
    }, candidates)
    if (!length(matches)) stop_api(400, "E_MONITOREO_CANDIDATE_INVALID", "La coincidencia seleccionada ya no existe en el universo actual.")
    selected <- matches[[1]]
    if (isTRUE(.monitoreo_bool(selected$already_effective %||% selected$already_answered, FALSE))) {
      stop_api(409, "E_MONITOREO_CANDIDATE_ALREADY_ANSWERED", "La persona seleccionada ya tiene una respuesta reconciliada; selecciona una persona pendiente del universo.")
    }
    warnings <- .monitoreo_chr_vec(assisted$warnings %||% list())
    has_contradiction <- any(grepl("codigo declarado no coincide|código declarado no coincide", .monitoreo_text_key(warnings)))
    selected_evidence_level <- .monitoreo_scalar(selected$evidence_level, "")
    manual_assignment <- identical(.monitoreo_scalar(selected$match_type, ""), "manual_pending") ||
      selected_evidence_level %in% c("", "manual")
    weak_assignment <- selected_evidence_level %in% c("possible")
    partial_assignment <- identical(state_key, "parcial")
    if ((isTRUE(partial_assignment) || isTRUE(has_contradiction) || isTRUE(manual_assignment) || isTRUE(weak_assignment)) && !nzchar(note)) {
      stop_api(400, "E_MONITOREO_NOTE_REQUIRED", "Agrega una nota para incluir con salvedad cuando la asignacion no nace de una coincidencia exacta o cuando codigo y correo se contradicen.")
    }
  }

  recon <- profile$reconciliation_decisions %||% list()
  include_ids <- unique(.monitoreo_chr_vec(recon$include_response_ids))
  exclude_ids <- unique(.monitoreo_chr_vec(recon$exclude_response_ids))
  if (identical(action, "include_with_caveat")) {
    include_ids <- unique(c(include_ids, response_id))
    exclude_ids <- setdiff(exclude_ids, response_id)
  } else {
    include_ids <- setdiff(include_ids, response_id)
    exclude_ids <- unique(c(exclude_ids, response_id))
  }
  manual <- .monitoreo_normalize_manual_case_reconciliations(recon$manual_case_reconciliations %||% list())
  decision <- list(
    response_id = response_id,
    actor = .monitoreo_scalar(item$actor, ""),
    action = action,
    declared_code = .monitoreo_scalar(assisted$declared_code, ""),
    declared_email = .monitoreo_scalar(assisted$declared_email, ""),
    assigned_person_label = if (is.null(selected)) "" else .monitoreo_scalar(selected$person_label, ""),
    assigned_case_key = if (is.null(selected)) "" else .monitoreo_scalar(selected$case_key, ""),
    assigned_base_source = if (is.null(selected)) "" else .monitoreo_scalar(selected$base_source, ""),
    assigned_base_row = if (is.null(selected)) 0L else .monitoreo_int(selected$base_row, 0L),
    match_type = if (is.null(selected)) "none" else .monitoreo_scalar(selected$match_type, ""),
    previous_status = .monitoreo_scalar(item$advancement, ""),
    new_status = if (identical(action, "include_with_caveat")) "included_with_caveat" else "excluded",
    note = note,
    decided_at = .monitoreo_now_iso()
  )
  manual[[response_id]] <- decision
  profile$reconciliation_decisions <- list(
    include_response_ids = as.list(include_ids),
    exclude_response_ids = as.list(exclude_ids),
    manual_case_reconciliations = manual
  )
  cfg$monitoreo_profile <- monitoreo_normalize_profile(profile, acreditacion = cfg$acreditacion)
  list(config = cfg, decision = decision, case = item, selected = selected)
}
