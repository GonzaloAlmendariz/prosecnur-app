# Helpers de `mount_monitoreo` — modo público y exposición del dashboard.
#
# Extraídos de `router_monitoreo.R`, que está congelado a crecimiento
# (`agentic/manifest.json` → `policy.frozen_growth_files`). Mismo paquete y
# mismo namespace: el traslado no cambia comportamiento, solo reparte el
# archivo. La lógica de dominio nueva va al engine, no aquí.

.monitoreo_public_dashboard <- function(dashboard, include_reports = TRUE) {
  if (is.null(dashboard) || !is.list(dashboard)) return(NULL)
  out <- list(
    ok = isTRUE(dashboard$ok),
    kpis = dashboard$kpis %||% list(),
    progress = .monitoreo_df_records(dashboard$progress),
    production = .monitoreo_df_records(dashboard$production),
    inconsistencies = .monitoreo_df_records(dashboard$inconsistencies)
  )
  if (isTRUE(include_reports) && !is.null(dashboard$acreditacion_reports)) {
    out$acreditacion_reports <- dashboard$acreditacion_reports
  }
  if (isTRUE(include_reports) && !is.null(dashboard$territorial_reports)) {
    # Cap de payload en la frontera HTTP (unidad 3.5, monitoreo_perf.R).
    out$territorial_reports <- monitoreo_perf_cap_territorial_reports(dashboard$territorial_reports)
  }
  if (isTRUE(include_reports) && !is.null(dashboard$aulas_universitarias_reports)) {
    out$aulas_universitarias_reports <- dashboard$aulas_universitarias_reports
  }
  out
}
.monitoreo_public_select_records <- function(rows, fields, max_rows = Inf) {
  if (is.null(rows)) return(list())
  if (is.data.frame(rows)) {
    rows <- .monitoreo_df_records(rows)
  } else if (!is.list(rows)) {
    return(list())
  }
  rows <- Filter(is.list, rows)
  if (!length(rows)) return(list())
  if (is.finite(max_rows)) rows <- utils::head(rows, max_rows)
  unname(lapply(rows, function(row) {
    present <- intersect(fields, names(row))
    out <- row[present]
    out[!vapply(out, is.null, logical(1))]
  }))
}
.monitoreo_public_profile <- function(profile = list()) {
  list(
    family = .monitoreo_scalar(profile$family, ""),
    variant = .monitoreo_scalar(profile$variant, ""),
    status = .monitoreo_scalar(profile$status, "")
  )
}
.monitoreo_public_audience <- function(value = NULL) {
  audience <- tolower(.monitoreo_scalar(value, "client"))
  if (!audience %in% c("client", "internal")) "client" else audience
}
.monitoreo_public_internal_payload <- function(data, cfg, snapshot, dashboard, family, base) {
  reports <- if (identical(family, "territorial")) {
    dashboard$territorial_reports %||% list()
  } else {
    dashboard$acreditacion_reports %||% list()
  }
  base$internal <- list(
    schema = "monitoreo_internal_full_report_v1",
    family = family,
    generated_at = base$generated_at,
    synced_at = base$synced_at,
    n_rows = as.integer(nrow(data)),
    dashboard = .monitoreo_public_dashboard(dashboard, include_reports = TRUE),
    reports = reports,
    config = cfg,
    snapshot = list(
      synced_at = .monitoreo_scalar(snapshot$synced_at, ""),
      errors = snapshot$errors %||% list(),
      rows = .monitoreo_df_records(data)
    )
  )
  if (identical(family, "acreditacion")) {
    client <- reports$client_report %||% monitoreo_acreditacion_client_report_model(data, cfg)
    base$accreditation <- list(
      schema = "monitoreo_internal_accreditation_report_v1",
      title = .monitoreo_scalar(client$title, "Reporte interno de monitoreo"),
      generated_at = .monitoreo_scalar(client$generated_at, base$generated_at),
      has_targets = isTRUE(client$has_targets),
      summary = client$summary %||% list(),
      actors = client$actors %||% list(),
      daily_general = client$daily_general %||% list(),
      daily_actor = client$daily_actor %||% list(),
      sources = client$sources %||% list(),
      client_report = client,
      reports = reports,
      internal_queries = reports$internal_queries %||% list(),
      sheets = reports$sheets %||% list(),
      snapshot_rows = .monitoreo_df_records(data)
    )
  } else {
    base$territorial <- c(
      list(
        schema = "monitoreo_internal_territorial_report_v1",
        generated_at = .monitoreo_scalar(reports$generated_at, base$generated_at)
      ),
      reports,
      list(snapshot_rows = .monitoreo_df_records(data))
    )
  }
  base
}
.monitoreo_public_report_payload <- function(sid, audience = NULL) {
  s <- session_get(sid)
  embedded <- s$public_artifact_payload$monitoreo_report %||% NULL
  if (is.list(embedded)) return(embedded)
  snapshot <- s$monitoreo_snapshot %||% NULL
  sources <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
  data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  data <- .monitoreo_apply_source_metadata_to_data(data, sources)
  if (!nrow(data)) {
    stop_api(409, "E_NO_MONITOREO_DATA", "No hay un corte de monitoreo publicado.")
  }
  cfg <- monitoreo_normalize_config(s$monitoreo_config %||% snapshot$config %||% list(), data)
  profile <- cfg$monitoreo_profile %||% monitoreo_normalize_profile(list())
  publication_family <- detect_monitoreo_family(config = s$monitoreo_config %||% snapshot$config %||% list(), data = data)
  family <- .monitoreo_publication_engine_family(publication_family)
  audience <- .monitoreo_public_audience(audience %||% s$public_artifact$audience %||% "client")
  report_scope <- .monitoreo_publication_report_scope(publication_family, audience)
  dashboard <- .monitoreo_dashboard_for_session(
    sid,
    data,
    cfg,
    include_reports = TRUE,
    report_scope = report_scope
  )
  base <- list(
    ok = TRUE,
    generated_at = .monitoreo_now_iso(),
    synced_at = .monitoreo_scalar(snapshot$synced_at, ""),
    n_rows = as.integer(nrow(data)),
    audience = audience,
    profile = .monitoreo_public_profile(modifyList(profile, list(family = family)))
  )
  base$publication_model <- monitoreo_publication_model(
    data,
    cfg,
    audience = audience,
    include_targets = FALSE,
    dashboard = dashboard,
    synced_at = base$synced_at,
      context = list(session_id = sid, family = publication_family)
  )

  if (identical(audience, "internal")) {
    return(.monitoreo_public_internal_payload(data, cfg, snapshot, dashboard, family, base))
  }

  if (identical(family, "acreditacion")) {
    reports <- dashboard$acreditacion_reports %||% list()
    client <- reports$client_report %||% monitoreo_acreditacion_client_report_model(data, cfg)
    client_actor_records <- .monitoreo_public_select_records(client$actors, c(
      "Actor", "Universo", "Efectivas", "Parciales", "Rechazos plataforma",
      "Rechazo", "Sin respuesta plataforma", "Sin respuesta", "Referencia operativa",
      "Referencia etiqueta", "Avance universo", "Primer día", "Última efectiva",
      "Origen avance"
    ))
    client_actor_records <- lapply(client_actor_records, function(row) {
      row$Rechazo <- row$Rechazo %||% row$`Rechazos plataforma` %||% 0L
      row$`Rechazos plataforma` <- NULL
      row
    })
    base$generated_at <- .monitoreo_scalar(client$generated_at, base$generated_at)
    base$accreditation <- list(
      schema = "monitoreo_public_accreditation_report_v1",
      title = .monitoreo_scalar(client$title, "Reporte de avance"),
      generated_at = .monitoreo_scalar(client$generated_at, base$generated_at),
      has_targets = FALSE,
      summary = .monitoreo_public_select_records(client$summary, c("Indicador", "Valor")),
      actors = client_actor_records,
      daily_general = .monitoreo_public_select_records(client$daily_general, c(
        "Fecha", "Efectivas", "Total respuestas", "Acumulado"
      )),
      daily_actor = .monitoreo_public_select_records(client$daily_actor, c(
        "Actor", "Fecha", "Efectivas", "Total respuestas", "Acumulado"
      )),
      sources = .monitoreo_public_select_records(client$sources, c(
        "Actor", "Canal", "Fuente", "Efectivas",
        "Total respuestas", "Primer día", "Última respuesta", "Última efectiva"
      ))
    )
    return(base)
  }

  if (identical(family, "territorial")) {
    report <- dashboard$territorial_reports %||% list()
    advance <- report$advance %||% list()
    district_progress <- advance$district_progress %||% report$district_progress %||% list()
    daily <- advance$daily %||% report$daily %||% list()
    quota <- report$route_quota_progress %||% list()
    base$generated_at <- .monitoreo_scalar(report$generated_at, base$generated_at)
    base$territorial <- list(
      schema = "monitoreo_public_territorial_report_v1",
      generated_at = .monitoreo_scalar(report$generated_at, base$generated_at),
      active_route_phase = .monitoreo_scalar(report$active_route_phase, cfg$territorial$active_route_phase %||% ""),
      phase_note = .monitoreo_scalar(report$phase_note, ""),
      kpis = report$kpis %||% list(),
      advance = list(
        total_respuestas = as.integer(advance$total_respuestas %||% report$kpis$total_respuestas %||% 0L),
        validas = as.integer(advance$validas %||% report$kpis$validas %||% 0L),
        meta = advance$meta %||% report$kpis$meta %||% NA,
        avance_pct = advance$avance_pct %||% report$kpis$avance_pct %||% NA,
        brecha = advance$brecha %||% NA
      ),
      district_progress = .monitoreo_public_select_records(district_progress, c(
        "ubigeo", "distrito", "meta", "total", "validas", "avance_pct", "brecha"
      )),
      daily = .monitoreo_public_select_records(daily, c(
        "date", "date_label", "total", "validas"
      )),
      route_quota_progress = list(
        configured = isTRUE(quota$configured),
        summary = quota$summary %||% NULL,
        district_summary = quota$district_summary %||% NULL,
        districts = .monitoreo_public_select_records(quota$districts %||% list(), c(
          "ubigeo", "distrito", "configured", "status", "target", "validas", "missing_total"
        ), max_rows = 200L)
      )
    )
    return(base)
  }

  stop_api(
    409,
    "E_MONITOREO_PUBLIC_PROFILE",
    "El reporte publico de Monitoreo soporta acreditacion y territorial."
  )
}
.monitoreo_public_collector_source_channel <- function(source) {
  dims <- source$dimensions %||% list()
  channel <- .monitoreo_scalar(
    dims$canal %||% dims$channel %||% dims$modalidad %||% source$channel %||% source$canal,
    ""
  )
  if (nzchar(channel)) return(channel)
  text <- .monitoreo_text_key(paste(source$label %||% "", source$survey_id %||% ""))
  if (grepl("whatsapp", text)) return("WhatsApp")
  if (grepl("telefon|phone", text)) return("Telefónico")
  if (grepl("qr|presencial|ficha", text)) return("Ficha QR")
  if (grepl("sms", text)) return("SMS")
  if (grepl("correo|email|mail|web|online", text)) return("Correo")
  ""
}
.monitoreo_public_collector_modality_from_channel <- function(channel) {
  key <- .monitoreo_text_key(channel)
  if (grepl("whatsapp", key)) return("whatsapp")
  if (grepl("sms", key)) return("sms")
  if (grepl("telefon", key)) return("telefono")
  if (grepl("qr|presencial|ficha", key)) return("presencial")
  if (grepl("correo|email|mail|web|online", key)) return("email")
  "mixto"
}
.monitoreo_public_collector <- function(source, collector, detail, recipient_summary, saved, data) {
  detail <- detail %||% list()
  saved <- saved %||% list()
  collector_id <- .monitoreo_scalar(detail$id %||% collector$id %||% collector$collector_id, "")
  collector_type <- tolower(.monitoreo_scalar(detail$type %||% collector$type, ""))
  raw_collector_name <- .monitoreo_scalar(
    detail$name %||%
      detail$title %||%
      detail$collector_name %||%
      detail$display_name %||%
      detail$nickname %||%
      collector$name %||%
      collector$title %||%
      collector$collector_name %||%
      collector$display_name %||%
      collector$nickname,
    ""
  )
  saved_collector_name <- .monitoreo_scalar(saved$collector_name %||% saved$label %||% saved$nombre, "")
  collector_name <- .monitoreo_best_collector_name(raw_collector_name, saved_collector_name, collector_id)
  url_present <- nzchar(.monitoreo_scalar(detail$url %||% collector$url, ""))
  active_response_count <- .monitoreo_snapshot_count(data, .monitoreo_scalar(source$id, ""), collector_id)
  suggested_use <- .monitoreo_collector_suggest_use(collector_type, recipient_summary, url_present)
  if (identical(suggested_use, "sin_clasificar") &&
      active_response_count > 0L &&
      as.integer(recipient_summary$total %||% 0L) == 0L) {
    suggested_use <- "enlace_abierto"
  }
  configured_use <- .monitoreo_scalar(saved$operational_use %||% saved$uso_operativo, "")
  if (!configured_use %in% c("correo_autoaplicado", "telefono_asistido", "presencial_qr", "enlace_abierto", "sms", "mixto", "sin_clasificar")) {
    configured_use <- suggested_use
  }
  modality <- .monitoreo_scalar(saved$modality %||% saved$modalidad, .monitoreo_collector_use_modality(configured_use))
  if (!modality %in% c("email", "whatsapp", "sms", "telefono", "presencial", "mixto")) {
    modality <- .monitoreo_collector_use_modality(configured_use)
  }
  channel <- .monitoreo_scalar(saved$channel %||% saved$canal, "")
  source_channel <- .monitoreo_public_collector_source_channel(source)
  if (!nzchar(channel)) {
    channel <- source_channel
  }
  if (!nzchar(channel)) {
    channel <- switch(modality, email = "Correo", whatsapp = "WhatsApp", sms = "SMS", telefono = "Telefónico", presencial = "Ficha QR", "Mixto")
  }
  if (identical(modality, "mixto") && nzchar(source_channel)) {
    modality <- .monitoreo_public_collector_modality_from_channel(channel)
  }
  enabled <- .monitoreo_bool(saved$enabled %||% saved$activo %||% saved$included %||% saved$incluido, TRUE)
  roster_required <- .monitoreo_bool(saved$roster_required %||% saved$requiere_base_casos, identical(configured_use, "telefono_asistido"))
  response_count <- suppressWarnings(as.integer(detail$response_count %||% collector$response_count %||% 0L))
  warnings <- character(0)
  if (identical(configured_use, "telefono_asistido") && isTRUE(recipient_summary$available) && as.integer(recipient_summary$total %||% 0L) == 0L) {
    warnings <- c(warnings, "Telefono asistido necesita destinatarios o base de casos.")
  }
  if (identical(configured_use, "telefono_asistido") && isTRUE(roster_required)) {
    warnings <- c(warnings, "Requiere base operativa para intentos, responsable y estado de llamada.")
  }

  list(
    id = paste(.monitoreo_scalar(source$id, ""), collector_id, sep = "::"),
    source_id = .monitoreo_scalar(source$id, ""),
    source_label = .monitoreo_scalar(source$label, ""),
    survey_id = .monitoreo_scalar(source$survey_id, ""),
    collector_id = collector_id,
    collector_name = collector_name,
    collector_type = collector_type,
    enabled = enabled,
    channel = channel,
    operational_use = configured_use,
    configured_use = configured_use,
    suggested_use = suggested_use,
    modality = modality,
    roster_required = roster_required,
    response_count = if (is.finite(response_count)) as.integer(response_count) else 0L,
    active_response_count = active_response_count,
    url_present = url_present,
    recipient_summary = recipient_summary,
    metadata_source = "surveymonkey_sync",
    warnings = as.list(unique(warnings))
  )
}
