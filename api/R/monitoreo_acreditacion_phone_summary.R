.monitoreo_acreditacion_phone_summary_report <- function(data,
                                                          cfg,
                                                          profile,
                                                          cached_reports = list(),
                                                          cached_client_report = NULL,
                                                          report_scope = "phone_summary") {
  client_report <- if (identical(profile$family %||% "", "telefonico")) {
    cached_client_report %||% .monitoreo_client_report_model(data, cfg, detail = "advance_summary")
  } else {
    cached_client_report %||% list(
      schema = "monitoreo_client_report_v1",
      generated_at = .monitoreo_now_iso(),
      title = "Reporte de avance",
      summary = list(),
      actors = list(),
      daily_general = list(),
      daily_actor = list(),
      sources = list(),
      collector_sources = list(),
      controls = list(),
      client_report = cfg$client_report %||% .monitoreo_client_report_config(list()),
      has_targets = FALSE,
      sheets = list()
    )
  }
  cached_sheets <- cached_reports$sheets %||% list()
  cached_sheet <- function(id) {
    if (!length(cached_sheets)) return(NULL)
    matches <- Filter(function(sheet) identical(sheet$id %||% "", id), cached_sheets)
    if (length(matches)) matches[[1L]] else NULL
  }
  accreditation_phone <- identical(profile$family %||% "", "acreditacion")
  phone_scope_data <- if (isTRUE(accreditation_phone)) {
    .monitoreo_report_phone_scope_data(data, profile, cfg)
  } else {
    data
  }
  phone_sheet <- if (isTRUE(accreditation_phone)) {
    .monitoreo_report_sheet(
      "monitoreo_telefonico",
      "Monitoreo telefónico",
      "Seguimiento de llamadas, estados, responsables, pendientes e incidencias.",
      .monitoreo_report_phone_blocks(phone_scope_data, profile, cfg)
    )
  } else {
    cached_sheet("monitoreo_telefonico") %||%
      .monitoreo_report_sheet(
        "monitoreo_telefonico",
        "Monitoreo telefónico",
        "Seguimiento de llamadas, estados, responsables, pendientes e incidencias.",
        .monitoreo_report_phone_blocks(phone_scope_data, profile, cfg)
      )
  }
  alerts_sheet <- if (isTRUE(accreditation_phone)) {
    scoped_alerts <- if (nrow(phone_scope_data)) {
      .monitoreo_report_alerts_df(phone_scope_data, profile)
    } else {
      data.frame()
    }
    .monitoreo_report_sheet("alertas", "Alertas", "Observaciones de consistencia del barrido y el cruce de respuestas.", list(
      .monitoreo_report_block("alertas", "Observaciones detectadas", scoped_alerts)
    ))
  } else {
    cached_sheet("alertas") %||%
      .monitoreo_report_sheet("alertas", "Alertas", "Observaciones de consistencia del barrido y el cruce de respuestas.", list(
        .monitoreo_report_block("alertas", "Observaciones detectadas", .monitoreo_report_alerts_df(phone_scope_data, profile))
      ))
  }
  list(
    schema = "apps_script_acreditacion_v1",
    generated_at = .monitoreo_now_iso(),
    report_scope = report_scope,
    reference_tabs = as.list(c("Monitoreo telefónico", "Alertas")),
    internal_queries = if (isTRUE(accreditation_phone)) list() else cached_reports$internal_queries %||% list(),
    client_report = client_report,
    sheets = list(phone_sheet, alerts_sheet)
  )
}
