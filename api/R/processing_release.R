# Aprobaciones metodologicas independientes por base.
#
# Esta capa no inventa un segundo estado de procesamiento: deriva readiness de
# los scopes autoritativos existentes y persiste solo el comprobante inmutable
# de que una combinacion exacta de insumos fue aprobada.

.PROCESSING_RELEASE_SCHEMA <- "processing_release/v1"
.PROCESSING_RELEASE_CATALOG_SCHEMA <- "processing_release_catalog/v1"

.processing_release_scalar <- function(value, default = "") {
  if (is.null(value) || !length(value) || is.na(value[[1]])) return(default)
  out <- as.character(value[[1]])
  if (!nzchar(out)) default else out
}

.processing_release_hash <- function(value) {
  tolower(digest::digest(value, algo = "sha256", serialize = TRUE))
}

.processing_release_file_pin <- function(s, file_id) {
  file_id <- .processing_release_scalar(file_id)
  meta <- (s$files %||% list())[[file_id]] %||% NULL
  path <- .processing_release_scalar((meta %||% list())$path)
  exists <- nzchar(path) && file.exists(path)
  list(
    file_id = file_id,
    kind = .processing_release_scalar((meta %||% list())$kind),
    size = if (exists) as.numeric(file.info(path)$size) else 0,
    sha256 = if (exists) tolower(digest::digest(file = path, algo = "sha256")) else "",
    healthy = is.list(meta) && nzchar(file_id) && exists
  )
}

.processing_release_validation_pin <- function(base_meta) {
  scope <- base_meta$validacion %||% list()
  plan <- scope$plan_result %||% list()
  evaluation <- scope$evaluacion %||% list()
  cleaning <- scope$limpieza_preview %||% list()
  artifacts <- scope$limpieza_artifacts %||% list()
  or_null <- function(value) if (is.null(value)) NULL else value
  list(
    audited = !is.null(scope$evaluacion),
    cleaning_finalized = nzchar(.processing_release_scalar(artifacts$finalized_at)),
    plan_sha256 = .processing_release_hash(list(
      plan = or_null(plan$plan),
      rules = or_null(plan$rules),
      custom_rules = scope$reglas_custom %||% list(),
      operational_config = scope$operational_config %||% list(),
      excluded_variables = scope$variables_excluidas %||% character(0)
    )),
    evaluation_sha256 = .processing_release_hash(list(
      summary = or_null(evaluation$resumen),
      rules_meta = or_null(evaluation$reglas_meta)
    )),
    cleaning_sha256 = .processing_release_hash(list(
      decisions = scope$limpieza_draft %||% list(),
      final_data = or_null(cleaning$data_final),
      impact = or_null(cleaning$impact)
    ))
  )
}

.processing_release_coding_pin <- function(s, base_name, data_pin, instrument_pin) {
  coding <- (s$codif_por_base %||% list())[[base_name]] %||% list()
  adapted <- isTRUE(coding$aplicado) &&
    identical(data_pin$kind, "data_adaptada") &&
    identical(instrument_pin$kind, "instrumento_adaptado")
  list(
    applied = isTRUE(coding$aplicado),
    adapted_pair = adapted,
    config_sha256 = .processing_release_hash(list(
      familias_draft = coding$familias_draft %||% NULL,
      familias_generated = coding$familias_generated %||% FALSE,
      marcadas = coding$marcadas %||% list(),
      grupos_recod = coding$grupos_recod %||% list(),
      respuestas_recod = coding$respuestas_recod %||% list(),
      familias_split = coding$familias_split %||% NULL,
      aplicado = isTRUE(coding$aplicado)
    ))
  )
}

.processing_release_analytics_pin <- function(s, base_name) {
  statuses <- (s$analitica_status_por_base %||% list())[[base_name]] %||% list()
  active <- .processing_release_scalar((s$estudio %||% list())$active_base)
  if (identical(active, base_name)) {
    for (key in .ESTUDIO_ANALITICA_STATUS_KEYS) {
      if (!is.null(s[[key]])) statuses[[key]] <- isTRUE(s[[key]])
    }
  }
  config <- (s$analitica_config_por_base %||% list())[[base_name]] %||%
    if (identical(active, base_name)) s$analitica_config %||% list() else list()
  required <- c("analitica_prep_ok", "analitica_frecuencias_ok", "analitica_cruces_ok")
  required_status <- stats::setNames(
    as.list(vapply(required, function(key) isTRUE(statuses[[key]]), logical(1))),
    required
  )
  list(
    required = required_status,
    ready = all(unlist(required_status, use.names = FALSE)),
    config_sha256 = .processing_release_hash(config),
    weighting_sha256 = .processing_release_hash(config$ponderacion %||% list()),
    # Solo los hitos exigidos pertenecen al contrato. Generar después un
    # codebook/SPSS opcional no debe volver stale una aprobación vigente.
    status_sha256 = .processing_release_hash(required_status)
  )
}

.processing_release_methodology_pin <- function(s, revision_id) {
  contract <- instrument_analysis_contract(s, revision_id)
  list(
    schema = contract$schema,
    configured = contract$configured,
    instrument_revision_id = contract$instrument_revision_id,
    source_sha256 = contract$source_sha256,
    policy_sha256 = contract$contract_sha256,
    proposal_schema = contract$proposal_schema,
    analysis_excluded_fields = contract$analysis_excluded_fields,
    analysis_excluded_codes = contract$analysis_excluded_codes,
    denominator_rules = contract$denominator_rules,
    ppt_plan_defaults = contract$ppt_plan_defaults,
    special_values = contract$special_values
  )
}

.processing_release_issue <- function(code, message) {
  list(code = code, message = message)
}

.processing_release_entry <- function(s, base_name) {
  base_meta <- ((s$estudio %||% list())$bases %||% list())[[base_name]] %||% list()
  entry_id <- .processing_release_scalar(base_meta$processing_intake_entry_id)
  data_pin <- .processing_release_file_pin(s, base_meta$data_file_id)
  instrument_pin <- .processing_release_file_pin(s, base_meta$xlsform_file_id)
  validation <- .processing_release_validation_pin(base_meta)
  coding <- .processing_release_coding_pin(s, base_name, data_pin, instrument_pin)
  analytics <- .processing_release_analytics_pin(s, base_name)
  methodology <- .processing_release_methodology_pin(s, base_meta$instrument_revision_id)

  blockers <- list()
  add_blocker <- function(condition, code, message) {
    if (isTRUE(condition)) blockers[[length(blockers) + 1L]] <<- .processing_release_issue(code, message)
  }
  add_blocker(!nzchar(entry_id), "missing_entry_identity", "La base no conserva la identidad estable del plan de ingreso.")
  add_blocker(!isTRUE(data_pin$healthy), "data_file_unhealthy", "El archivo de datos de la base no esta disponible.")
  add_blocker(!isTRUE(instrument_pin$healthy), "instrument_file_unhealthy", "El instrumento de la base no esta disponible.")
  add_blocker(!isTRUE(validation$audited), "validation_pending", "Falta ejecutar la auditoria de Validacion.")
  add_blocker(!isTRUE(validation$cleaning_finalized), "cleaning_pending", "Falta finalizar Limpieza para esta base.")
  add_blocker(!isTRUE(coding$adapted_pair), "coding_pending", "Falta aplicar la Codificacion y publicar su par adaptado.")
  add_blocker(!isTRUE(analytics$required$analitica_prep_ok), "analytics_prepare_pending", "Falta preparar Analitica.")
  add_blocker(!isTRUE(analytics$required$analitica_frecuencias_ok), "frequencies_pending", "Falta generar las frecuencias analiticas.")
  add_blocker(!isTRUE(analytics$required$analitica_cruces_ok), "crosses_pending", "Falta generar los cruces analiticos.")

  provenance <- list(
    processing_intake_entry_id = entry_id,
    sibling_family_id = base_meta$sibling_family_id %||% "",
    instrument_revision_id = base_meta$instrument_revision_id %||% "",
    batch_fingerprint = base_meta$batch_fingerprint %||% "",
    response_filter = base_meta$response_filter %||% list(),
    traceability = base_meta$traceability %||% list(),
    rows = base_meta$n_filas %||% NA_integer_
  )
  pins <- list(
    data = data_pin,
    instrument = instrument_pin,
    validation = validation,
    coding = coding,
    analytics = analytics,
    methodology = methodology,
    sample = list(
      n_rows = as.integer(base_meta$n_filas %||% 0L),
      weighting_sha256 = analytics$weighting_sha256
    ),
    extras_sha256 = .processing_release_hash(list(
      available = base_meta$variables_extra_checksum %||% "",
      included = base_meta$variables_extra_incluidas %||% list()
    )),
    provenance = provenance,
    provenance_sha256 = .processing_release_hash(provenance)
  )
  fingerprint <- .processing_release_hash(list(
    schema = .PROCESSING_RELEASE_SCHEMA,
    entry_id = entry_id,
    family_id = base_meta$sibling_family_id %||% "",
    pins = pins
  ))
  stored <- (s$processing_releases %||% list())[[entry_id]] %||% NULL
  approved <- is.list(stored) &&
    identical(.processing_release_scalar(stored$schema), .PROCESSING_RELEASE_SCHEMA) &&
    identical(.processing_release_scalar(stored$input_fingerprint), fingerprint)
  status <- if (approved) {
    "approved"
  } else if (is.list(stored)) {
    "stale"
  } else if (!length(blockers)) {
    "ready"
  } else {
    "pending"
  }
  list(
    base = base_name,
    base_label = .processing_release_scalar(base_meta$source_title, base_name),
    actor = .processing_release_scalar(base_meta$source_alias, base_name),
    entry_id = entry_id,
    family_id = .processing_release_scalar(base_meta$sibling_family_id),
    instrument_revision_id = .processing_release_scalar(base_meta$instrument_revision_id),
    status = status,
    ready = !length(blockers),
    approved = approved,
    input_fingerprint = fingerprint,
    blockers = blockers,
    pins = pins,
    release = if (is.list(stored)) stored else NULL
  )
}

.processing_release_catalog <- function(s) {
  estudio <- s$estudio %||% list()
  bases <- estudio$bases %||% list()
  independent <- identical(.processing_release_scalar(estudio$processing_mode), "independent_siblings")
  entries <- if (independent) {
    unname(lapply(names(bases), function(base_name) .processing_release_entry(s, base_name)))
  } else list()
  list(
    ok = TRUE,
    schema = .PROCESSING_RELEASE_CATALOG_SCHEMA,
    detected = independent && length(entries) > 0L,
    family_id = .processing_release_scalar(estudio$sibling_family_id),
    active_base = .processing_release_scalar(estudio$active_base),
    all_approved = length(entries) > 0L && all(vapply(entries, function(entry) isTRUE(entry$approved), logical(1))),
    entries = entries
  )
}

processing_release_get <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) stop_api(404, "E_NO_SESSION", "Sin sesion.")
  .processing_release_catalog(s)
}

processing_release_approve <- function(sid, base_name, expected_input_fingerprint) {
  base_name <- .processing_release_scalar(base_name)
  expected <- .processing_release_scalar(expected_input_fingerprint)
  if (!nzchar(base_name) || !nzchar(expected)) {
    stop_api(400, "E_PROCESSING_RELEASE_INPUT", "Faltan base y expected_input_fingerprint.")
  }
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) stop_api(404, "E_NO_SESSION", "Sin sesion.")
  if (is.null(((s$estudio %||% list())$bases %||% list())[[base_name]])) {
    stop_api(404, "E_PROCESSING_RELEASE_BASE", "La base solicitada no existe.")
  }
  entry <- .processing_release_entry(s, base_name)
  if (!identical(entry$input_fingerprint, expected)) {
    stop_api(409, "E_PROCESSING_RELEASE_STALE", "Los insumos cambiaron; vuelve a revisar la base.")
  }
  if (!isTRUE(entry$ready)) {
    stop_api(422, "E_PROCESSING_RELEASE_NOT_READY", "La base aun no completa el pipeline requerido.", details = list(blockers = entry$blockers))
  }
  if (isTRUE(entry$approved)) return(.processing_release_catalog(s))

  fresh <- session_get(sid)
  fresh_entry <- .processing_release_entry(fresh, base_name)
  if (!identical(fresh_entry$input_fingerprint, expected) || !isTRUE(fresh_entry$ready)) {
    stop_api(409, "E_PROCESSING_RELEASE_STALE", "Los insumos cambiaron durante la aprobacion.")
  }
  now <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  release <- list(
    schema = .PROCESSING_RELEASE_SCHEMA,
    release_id = uuid::UUIDgenerate(),
    processing_intake_entry_id = fresh_entry$entry_id,
    sibling_family_id = fresh_entry$family_id,
    base_at_approval = base_name,
    instrument_revision_id = fresh_entry$instrument_revision_id,
    input_fingerprint = fresh_entry$input_fingerprint,
    pins = fresh_entry$pins,
    approved_at = now
  )
  next_state <- fresh
  next_state$processing_releases <- next_state$processing_releases %||% list()
  next_state$processing_releases[[fresh_entry$entry_id]] <- release
  next_state <- .mark_project_dirty(next_state)
  .session_env[[sid]] <- next_state
  .processing_release_catalog(next_state)
}
