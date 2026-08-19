# Adapters read-only de Recopiladores (ADR 0046, unidad 9).
#
# Este archivo no conoce sesiones, secretos ni transporte HTTP. Las funciones
# reciben observaciones ya obtenidas o referencias pegadas por el usuario y
# devuelven previews puros. En V1 no existe ningún camino a escritura remota.

.collection_adapter_ids <- c(
  "aulas_v1",
  "manual_links_v1",
  "kobo_existing_v1",
  "surveymonkey_weblink_existing_v1",
  "surveymonkey_recipient_existing_v1"
)

.ca_text <- function(value, default = "") {
  value <- suppressWarnings(as.character(value %||% default)[1])
  if (is.na(value)) default else trimws(value)
}

.ca_rows <- function(value) {
  if (is.data.frame(value)) {
    return(lapply(seq_len(nrow(value)), function(i) as.list(value[i, , drop = FALSE])))
  }
  if (!is.list(value) || !length(value)) return(list())
  if (!is.null(names(value)) && any(names(value) %in% c("unit_id", "recipient_id", "access_ref"))) {
    return(list(value))
  }
  Filter(is.list, unname(value))
}

.ca_id <- function(prefix, value) {
  slug <- tolower(iconv(.ca_text(value, "item"), from = "", to = "ASCII//TRANSLIT", sub = ""))
  slug <- gsub("[^a-z0-9]+", "-", slug)
  slug <- gsub("^-+|-+$", "", slug)
  if (!nzchar(slug)) slug <- "item"
  paste0(prefix, "-", substr(slug, 1L, 64L))
}

.ca_url_issue <- function(url) {
  if (exists("capture_url_issue", mode = "function")) return(capture_url_issue(url))
  value <- .ca_text(url)
  if (!nzchar(value)) return("vacia")
  if (!grepl("^https?://", value, ignore.case = TRUE)) return("no_http")
  if (grepl("#/forms/[^/]+/landing", value, ignore.case = TRUE)) return("landing_kobo")
  if (grepl("#", value, fixed = TRUE)) return("fragmento")
  ""
}

# El adapter NO arma la URL final. Un `parameterized_link` declara su base en
# `access_ref` y su personalizacion en `prefill`; quien las compone es
# `.collection_access_url()`, que es el unico punto donde nace la URL que ve el
# encuestado (payload del QR y enlace del handoff a Monitoreo).
#
# Antes el adapter tambien colgaba el parametro dentro de `access_ref`, asi que
# el resolvedor lo volvia a colgar y el QR salia con `d[collectorID]` dos veces:
# el doble de payload, un QR mas denso de lo necesario y un enlace impreso que
# rompia en dos renglones. El contrato ya decia cual de los dos manda —un
# `parameterized_link` sin `prefill` "no personaliza nada"
# (`collection_contracts.R`)—, asi que la personalizacion vive en `prefill` y
# `access_ref` queda tal como el usuario la pego, con su query si la tenia.

.ca_capability <- function(provider_support, implementation, policy, evidence) {
  list(
    provider_support = provider_support,
    implementation = implementation,
    policy = policy,
    evidence = evidence
  )
}

.ca_preflight_template <- function(adapter_id) {
  remote_write <- .ca_capability("unknown", "unavailable", "disabled_v1", "current_code")
  capabilities <- switch(
    adapter_id,
    aulas_v1 = list(
      local_generation = .ca_capability("supported", "available", "allowed_v1", "current_code"),
      remote_read = .ca_capability("unknown", "unavailable", "allowed_explicit", "unknown"),
      remote_write = remote_write
    ),
    manual_links_v1 = list(
      local_generation = .ca_capability("supported", "available", "allowed_v1", "current_code"),
      remote_read = .ca_capability("unsupported", "unavailable", "disabled_v1", "declared"),
      remote_write = .ca_capability("unsupported", "unavailable", "disabled_v1", "declared")
    ),
    kobo_existing_v1 = list(
      local_generation = .ca_capability("supported", "available", "allowed_v1", "declared"),
      remote_read = .ca_capability("supported", "available", "allowed_explicit", "current_code"),
      remote_write = .ca_capability("supported", "unavailable", "disabled_v1", "current_code")
    ),
    surveymonkey_weblink_existing_v1 = list(
      local_generation = .ca_capability("supported", "available", "allowed_v1", "declared"),
      remote_read = .ca_capability("supported", "available", "allowed_explicit", "current_code"),
      remote_write = .ca_capability("supported", "unavailable", "disabled_v1", "current_code")
    ),
    surveymonkey_recipient_existing_v1 = list(
      local_generation = .ca_capability("unsupported", "unavailable", "disabled_v1", "declared"),
      native_link_reuse = .ca_capability("supported", "available", "allowed_v1", "declared"),
      remote_read = .ca_capability("supported", "available", "allowed_explicit", "current_code"),
      remote_write = .ca_capability("supported", "unavailable", "disabled_v1", "current_code")
    )
  )
  list(
    schema = "collection_capability_preflight/v1",
    adapter_id = adapter_id,
    operation_policy = "v1_read_only",
    capabilities = capabilities,
    blocking = list(),
    warnings = list()
  )
}

collection_capability_preflight <- function(adapter_id, operation = NULL, target = list()) {
  adapter_id <- .ca_text(adapter_id)
  if (!adapter_id %in% .collection_adapter_ids) {
    return(list(
      schema = "collection_capability_preflight/v1",
      adapter_id = adapter_id,
      operation_policy = "v1_read_only",
      capabilities = list(),
      blocking = list(list(code = "unknown_adapter", operation = .ca_text(operation))),
      warnings = list()
    ))
  }
  out <- .ca_preflight_template(adapter_id)
  operation <- .ca_text(operation)
  target <- if (is.list(target)) target else list()
  target_ref <- if (is.list(target$target)) target$target else target
  connection_ref <- if (is.list(target$connection_ref)) target$connection_ref else target
  if (identical(operation, "remote_write")) {
    out$blocking <- list(list(
      code = "remote_write_disabled_v1",
      operation = "remote_write",
      policy = "disabled_v1"
    ))
  }
  if (identical(operation, "remote_read") &&
      adapter_id %in% c(
        "kobo_existing_v1", "surveymonkey_weblink_existing_v1",
        "surveymonkey_recipient_existing_v1"
      )) {
    profile_id <- .ca_text(connection_ref$connection_profile_id %||% connection_ref$profile_id)
    explicit_evidence <- .ca_text(
      target$remote_read_evidence %||% connection_ref$remote_read_evidence
    )
    explicitly_requested <- isTRUE(target$remote_read_explicit %||% connection_ref$remote_read_explicit)
    if (!nzchar(profile_id) &&
        !explicitly_requested &&
        !explicit_evidence %in% c("observed", "declared")) {
      out$blocking <- c(out$blocking, list(list(
        code = "remote_read_not_explicit",
        operation = "remote_read"
      )))
    }
  }
  if (identical(adapter_id, "kobo_existing_v1") && identical(operation, "local_generation")) {
    base_url <- .ca_text(target_ref$base_access_url %||% target_ref$survey_url %||% target_ref$url)
    url_issue <- .ca_url_issue(base_url)
    if (nzchar(url_issue)) {
      out$blocking <- c(out$blocking, list(list(code = paste0("capture_url_", url_issue))))
    }
    asset_type <- tolower(.ca_text(target_ref$asset_type, "unknown"))
    if (!identical(asset_type, "survey")) {
      out$blocking <- c(out$blocking, list(list(
        code = "kobo_asset_survey_not_observed",
        observed = asset_type
      )))
    }
    if (!identical(target_ref$deployment_active, TRUE)) {
      out$blocking <- c(out$blocking, list(list(
        code = "kobo_deployment_active_not_observed"
      )))
    }
  }
  if (identical(adapter_id, "surveymonkey_weblink_existing_v1") &&
      identical(operation, "local_generation")) {
    normalized <- if (exists("sm_api_normalize_collector", mode = "function")) {
      sm_api_normalize_collector(target_ref)
    } else {
      list(type = tolower(.ca_text(target_ref$type, "unknown")))
    }
    if (!identical(normalized$type, "web_link")) {
      out$blocking <- c(out$blocking, list(list(
        code = "surveymonkey_weblink_type_not_observed",
        observed = normalized$type
      )))
    }
    base_url <- .ca_text(target_ref$base_access_url %||% target_ref$weblink_url %||% target_ref$url)
    url_issue <- .ca_url_issue(base_url)
    if (nzchar(url_issue)) {
      out$blocking <- c(out$blocking, list(list(code = paste0("capture_url_", url_issue))))
    }
    custom_variable <- .ca_text(target_ref$custom_variable)
    observed_variables <- trimws(as.character(unlist(
      target_ref$custom_variables %||% character(0),
      use.names = FALSE
    )))
    observed_variables <- observed_variables[!is.na(observed_variables) & nzchar(observed_variables)]
    if (!nzchar(custom_variable) ||
        (length(observed_variables) && !custom_variable %in% observed_variables)) {
      out$blocking <- c(out$blocking, list(list(
        code = "surveymonkey_custom_variable_not_observed",
        custom_variable = custom_variable
      )))
    }
  }
  if (identical(adapter_id, "surveymonkey_recipient_existing_v1") &&
      identical(operation, "local_generation")) {
    out$blocking <- c(out$blocking, list(list(
      code = "native_recipient_links_cannot_be_fabricated",
      operation = "local_generation"
    )))
  }
  out
}

.ca_normalize_plan <- function(input, adapter_id) {
  plan <- if (is.list(input)) input else list()
  plan$adapter <- list(id = adapter_id, version = 1L)
  plan$units <- .ca_rows(plan$units %||% plan$plan %||% list())
  plan
}

.ca_target_ref <- function(target, fields) {
  target <- if (is.list(target)) target else list()
  out <- list()
  for (field in fields) {
    value <- target[[field]]
    if (!is.null(value)) out[[field]] <- value
  }
  out
}

.ca_inspect_target <- function(adapter_id, connection_ref = list(), target_ref = list()) {
  connection_ref <- if (is.list(connection_ref)) connection_ref else list()
  target_ref <- if (is.list(target_ref)) target_ref else list()
  provider <- switch(
    adapter_id,
    kobo_existing_v1 = "kobo",
    surveymonkey_weblink_existing_v1 = "surveymonkey",
    surveymonkey_recipient_existing_v1 = "surveymonkey",
    manual_links_v1 = "manual",
    .ca_text(target_ref$provider, "manual")
  )
  base_url <- .ca_text(
    target_ref$base_access_url %||% target_ref$survey_url %||% target_ref$url %||% target_ref$weblink_url
  )
  blocking <- list()
  warnings <- list()
  if (adapter_id %in% c("kobo_existing_v1", "surveymonkey_weblink_existing_v1") && nzchar(.ca_url_issue(base_url))) {
    blocking <- list(list(code = paste0("capture_url_", .ca_url_issue(base_url)), field = "base_access_url"))
  }
  if (identical(adapter_id, "kobo_existing_v1")) {
    asset_type <- tolower(.ca_text(target_ref$asset_type, "unknown"))
    if (!asset_type %in% c("survey", "unknown")) {
      blocking <- c(blocking, list(list(code = "kobo_target_not_survey", observed = asset_type)))
    }
    if (identical(target_ref$deployment_active, FALSE)) {
      blocking <- c(blocking, list(list(code = "kobo_target_not_deployed")))
    }
    if (identical(asset_type, "unknown")) warnings <- list(list(code = "kobo_asset_type_unobserved"))
  }
  if (identical(adapter_id, "surveymonkey_weblink_existing_v1")) {
    normalized <- if (exists("sm_api_normalize_collector", mode = "function")) {
      sm_api_normalize_collector(target_ref)
    } else {
      list(type = tolower(.ca_text(target_ref$type, "unknown")))
    }
    if (!normalized$type %in% c("web_link", "weblink", "unknown")) {
      blocking <- c(blocking, list(list(code = "surveymonkey_target_not_weblink", observed = normalized$type)))
    }
    if (identical(normalized$type, "unknown")) warnings <- list(list(code = "surveymonkey_collector_type_unobserved"))
  }
  if (identical(adapter_id, "surveymonkey_recipient_existing_v1")) {
    normalized <- if (exists("sm_api_normalize_collector", mode = "function")) {
      sm_api_normalize_collector(target_ref)
    } else {
      list(type = tolower(.ca_text(target_ref$type, "unknown")))
    }
    if (!normalized$type %in% c("email", "sms", "unknown")) {
      blocking <- c(blocking, list(list(code = "surveymonkey_target_not_recipient_collector", observed = normalized$type)))
    }
  }
  preflight_operation <- switch(
    adapter_id,
    kobo_existing_v1 = "local_generation",
    surveymonkey_weblink_existing_v1 = "local_generation",
    surveymonkey_recipient_existing_v1 = "native_link_reuse",
    NULL
  )
  preflight <- collection_capability_preflight(
    adapter_id,
    operation = preflight_operation,
    target = list(connection_ref = connection_ref, target = target_ref)
  )
  blocking <- c(blocking, preflight$blocking)
  if (length(blocking)) {
    codes <- vapply(blocking, function(item) .ca_text(item$code), character(1))
    blocking <- blocking[!duplicated(codes)]
  }
  list(
    ok = !length(blocking),
    adapter_id = adapter_id,
    provider = provider,
    mode = "read_only",
    connection_ref = .ca_target_ref(connection_ref, c("connection_profile_id", "profile_id", "base_url")),
    target = .ca_target_ref(target_ref, c(
      "provider", "asset_uid", "version_id", "deployment_active", "asset_type", "auth_policy",
      "collector_id", "id", "type", "status", "base_access_url", "survey_url",
      "url", "weblink_url", "prefill_field", "return_url", "custom_variable", "custom_variables",
      "recipients", "links"
    )),
    preflight = preflight,
    blocking = blocking,
    warnings = warnings
  )
}

.ca_unit_value <- function(unit) {
  .ca_text(unit$link_key %||% unit$prefill_value %||% unit$logical_collector_id %||% unit$unit_id)
}

.ca_manual_access <- function(unit, target) {
  links <- target$links %||% list()
  by_id <- if (is.list(links) && !is.null(names(links))) links[[.ca_text(unit$unit_id)]] else NULL
  .ca_text(unit$access_ref %||% unit$link %||% unit$url %||% by_id)
}

.ca_binding <- function(unit, adapter_id, target) {
  unit_id <- .ca_text(unit$unit_id)
  logical_id <- .ca_text(unit$logical_collector_id, .ca_id("logical", unit_id))
  access_ref <- ""
  access_kind <- "manual_handoff"
  provider_collector_id <- NULL
  recipient_id <- NULL
  prefill <- list()
  if (adapter_id %in% c("aulas_v1", "manual_links_v1")) {
    access_ref <- .ca_manual_access(unit, target)
  }
  if (identical(adapter_id, "kobo_existing_v1") ||
      (identical(adapter_id, "aulas_v1") && identical(.ca_text(target$provider), "kobo"))) {
    base_url <- .ca_text(target$base_access_url %||% target$survey_url %||% target$url)
    # Con el asset conocido, el campo por defecto es la ruta XPath completa
    # (`/<asset_uid>/collectorID`): es el formato del enlace real que Gonzalo
    # confirmo en produccion, no el nombre pelado (`collectorID`) que Enketo
    # tambien puede rechazar segun el servidor. `prefill_field` sigue siendo
    # la salida de escape explicita para quien lo necesite pelado.
    asset_uid <- .ca_text(target$asset_uid)
    default_field <- if (nzchar(asset_uid)) paste0("/", asset_uid, "/collectorID") else "collectorID"
    field <- .ca_text(target$prefill_field, default_field)
    value <- .ca_unit_value(unit)
    if (!nzchar(.ca_url_issue(base_url)) && nzchar(value)) {
      access_ref <- base_url
      access_kind <- "parameterized_link"
      prefill[[field]] <- value
    }
  } else if (identical(adapter_id, "surveymonkey_weblink_existing_v1")) {
    base_url <- .ca_text(target$base_access_url %||% target$weblink_url %||% target$url)
    field <- .ca_text(target$custom_variable)
    value <- .ca_unit_value(unit)
    if (!nzchar(.ca_url_issue(base_url)) && nzchar(field) && nzchar(value)) {
      access_ref <- base_url
      access_kind <- "parameterized_link"
      prefill[[field]] <- value
    }
    provider_collector_id <- .ca_text(target$collector_id %||% target$id)
    if (!nzchar(provider_collector_id)) provider_collector_id <- NULL
  } else if (identical(adapter_id, "surveymonkey_recipient_existing_v1")) {
    recipients <- .ca_rows(target$recipients %||% list())
    match_index <- which(vapply(recipients, function(item) {
      identical(.ca_text(item$unit_id), unit_id)
    }, logical(1)))
    observed <- if (length(match_index)) recipients[[match_index[[1]]]] else list()
    recipient_id <- .ca_text(observed$recipient_id %||% observed$id)
    observed_ref <- .ca_text(observed$access_ref)
    observed_url <- .ca_text(observed$survey_link)
    access_ref <- if (nzchar(observed_ref) && !grepl("^https?://", observed_ref, ignore.case = TRUE)) {
      observed_ref
    } else if (nzchar(recipient_id) && (nzchar(observed_ref) || nzchar(observed_url))) {
      paste0("surveymonkey:recipient-link:", recipient_id)
    } else {
      ""
    }
    if (!nzchar(recipient_id)) recipient_id <- NULL
    access_kind <- "recipient_link"
    provider_collector_id <- .ca_text(target$collector_id %||% target$id)
    if (!nzchar(provider_collector_id)) provider_collector_id <- NULL
  }
  list(
    access_id = .ca_id("access", paste(adapter_id, unit_id, sep = "-")),
    logical_collector_id = logical_id,
    unit_id = unit_id,
    provider_collector_id = provider_collector_id,
    recipient_id = recipient_id,
    operator_id = NULL,
    access_kind = access_kind,
    access_ref = if (nzchar(access_ref)) access_ref else NULL,
    prefill = prefill,
    status = if (nzchar(access_ref) && (access_kind != "recipient_link" || !is.null(recipient_id))) "ready" else "missing"
  )
}

.ca_preview_deployment <- function(adapter_id, plan, target) {
  plan <- .ca_normalize_plan(plan, adapter_id)
  if (!is.list(target)) target <- list()
  target <- if (is.list(target$target)) target$target else if (is.list(target)) target else list()
  local_preflight <- collection_capability_preflight(adapter_id, "local_generation", target)
  bindings <- lapply(plan$units, .ca_binding, adapter_id = adapter_id, target = target)
  if (length(local_preflight$blocking) &&
      adapter_id %in% c("kobo_existing_v1", "surveymonkey_weblink_existing_v1")) {
    bindings <- lapply(bindings, function(binding) {
      binding$access_ref <- NULL
      binding$status <- "blocked"
      binding
    })
  }
  ready <- sum(vapply(bindings, function(binding) identical(binding$status, "ready"), logical(1)))
  provider <- switch(
    adapter_id,
    kobo_existing_v1 = "kobo",
    surveymonkey_weblink_existing_v1 = "surveymonkey",
    surveymonkey_recipient_existing_v1 = "surveymonkey",
    manual_links_v1 = "manual",
    .ca_text(target$provider, "manual")
  )
  remote_ref <- .ca_target_ref(target, c("asset_uid", "version_id", "collector_id", "id"))
  # A donde vuelve el encuestador tras enviar (`returnUrl` de Enketo): una
  # sola URL para todo el estudio, declarada por quien configura el target,
  # nunca inferida.
  return_url <- .ca_text(target$return_url)
  list(
    schema = "collection_deployment/v1",
    deployment_id = .ca_id("deployment", paste(.ca_text(plan$plan_id, "plan"), adapter_id, sep = "-")),
    plan_id = .ca_text(plan$plan_id),
    plan_fingerprint = .ca_text(plan$input_fingerprint),
    target = list(
      provider = provider, remote_ref = remote_ref,
      return_url = if (nzchar(return_url)) return_url else NULL
    ),
    capabilities = list(remote_write = list(observed = FALSE, source = "disabled_v1")),
    capability_preflight = local_preflight,
    bindings = bindings,
    coverage = list(
      units_total = as.integer(length(plan$units)),
      units_with_access = as.integer(ready),
      units_missing_access = as.integer(length(plan$units) - ready)
    ),
    sensitivity = list(
      access_urls = if (identical(adapter_id, "surveymonkey_recipient_existing_v1")) "sensitive" else "operational"
    ),
    status = if (length(plan$units) > 0L && ready == length(plan$units)) "prepared" else "draft",
    handoff = NULL
  )
}

.ca_commit_blocked <- function(adapter_id, preview, confirmation = NULL) {
  list(
    ok = FALSE,
    blocked = TRUE,
    code = "E_COLLECTION_REMOTE_WRITE_DISABLED_V1",
    adapter_id = adapter_id,
    preview = preview,
    confirmation_ignored = !is.null(confirmation),
    preflight = collection_capability_preflight(adapter_id, operation = "remote_write")
  )
}

.ca_prepare_material_instances <- function(adapter_id, deployment, template) {
  ready <- Filter(function(binding) is.list(binding) && identical(binding$status, "ready"), deployment$bindings %||% list())
  lapply(ready, function(binding) list(
    schema = "collection_material_instance/v1",
    adapter_id = adapter_id,
    deployment_id = .ca_text(deployment$deployment_id),
    unit_id = binding$unit_id,
    access_id = binding$access_id,
    template_ref = .ca_target_ref(template, c("template_id", "version", "preset")),
    status = "prepared"
  ))
}

.ca_render_artifacts <- function(adapter_id, instances) {
  list(
    ok = FALSE,
    blocked = TRUE,
    code = "E_COLLECTION_RENDERER_NOT_BOUND",
    adapter_id = adapter_id,
    instances = as.integer(length(.ca_rows(instances))),
    remote_effect = FALSE
  )
}

.ca_handoff_preview <- function(adapter_id, deployment) {
  list(
    ok = TRUE,
    dry_run = TRUE,
    adapter_id = adapter_id,
    deployment_id = .ca_text(deployment$deployment_id),
    action = "delegate_to_collection_engine",
    remote_effect = FALSE
  )
}

.ca_adapter <- function(id, provider, unit_types) {
  list(
    id = id,
    version = 1L,
    provider = provider,
    unit_types = unit_types,
    supports = function(input) {
      input <- if (is.list(input)) input else list()
      input_adapter <- .ca_text((input$adapter %||% list())$id %||% input$adapter_id)
      unit_type <- .ca_text(input$unit_type)
      provider_value <- .ca_text((input$target %||% list())$provider %||% input$provider)
      identical(input_adapter, id) || unit_type %in% unit_types || provider_value %in% provider
    },
    normalize_plan = function(input) .ca_normalize_plan(input, id),
    inspect_target = function(connection_ref = list(), target_ref = list()) {
      .ca_inspect_target(id, connection_ref, target_ref)
    },
    preview_deployment = function(plan, target) .ca_preview_deployment(id, plan, target),
    commit_deployment = function(preview, confirmation = NULL) .ca_commit_blocked(id, preview, confirmation),
    prepare_material_instances = function(deployment, template = list()) {
      .ca_prepare_material_instances(id, deployment, template)
    },
    render_artifacts = function(instances) .ca_render_artifacts(id, instances),
    handoff_to_monitoring = function(deployment) .ca_handoff_preview(id, deployment),
    capability_preflight = function(operation = NULL, target = list()) {
      collection_capability_preflight(id, operation, target)
    }
  )
}

collection_adapter_registry <- function() {
  adapters <- list(
    .ca_adapter("aulas_v1", c("manual", "kobo"), "classroom_course_schedule"),
    .ca_adapter("manual_links_v1", "manual", character(0)),
    .ca_adapter("kobo_existing_v1", "kobo", character(0)),
    .ca_adapter("surveymonkey_weblink_existing_v1", "surveymonkey", character(0)),
    .ca_adapter("surveymonkey_recipient_existing_v1", "surveymonkey", character(0))
  )
  names(adapters) <- vapply(adapters, function(adapter) adapter$id, character(1))
  adapters
}

collection_adapter_get <- function(adapter_id) {
  collection_adapter_registry()[[.ca_text(adapter_id)]]
}
