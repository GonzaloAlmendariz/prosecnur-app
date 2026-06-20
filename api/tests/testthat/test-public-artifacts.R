monitoreo_space_test_section <- function(id, title, rows = list(list(Estado = "No disponible"))) {
  if (is.data.frame(rows)) rows <- .monitoreo_df_records(rows)
  columns <- unique(unlist(lapply(rows, names), use.names = FALSE))
  if (!length(columns)) columns <- "Estado"
  list(
    id = id,
    title = title,
    description = paste("Sección", title),
    columns = as.list(columns),
    rows = rows,
    n_rows = length(rows)
  )
}

monitoreo_space_test_daily_progress <- function(family = "accreditation_monitoring") {
  is_territorial <- identical(.monitoreo_publication_family_key(family), "territorial")
  list(
    schema = "monitoreo_daily_progress_v1",
    family = family,
    by_date_status = list(
      list(Fecha = "2026-06-17", Estado = if (is_territorial) "Efectiva" else "Respondió", Casos = 3L),
      list(Fecha = "2026-06-17", Estado = "Parcial", Casos = 1L),
      list(Fecha = "2026-06-18", Estado = if (is_territorial) "Efectiva" else "Respondió", Casos = 4L)
    ),
    daily_effective = list(
      list(Fecha = "2026-06-17", `Nuevas efectivas` = 3L),
      list(Fecha = "2026-06-18", `Nuevas efectivas` = 4L)
    ),
    cumulative_effective = list(
      list(Fecha = "2026-06-17", `Nuevas efectivas` = 3L, `Efectivas acumuladas` = 3L, `Universo esperado` = 20L, `% avance universo` = 15, Pendientes = 17L),
      list(Fecha = "2026-06-18", `Nuevas efectivas` = 4L, `Efectivas acumuladas` = 7L, `Universo esperado` = 20L, `% avance universo` = 35, Pendientes = 13L)
    ),
    cumulative_by_status = list(),
    by_date_actor = if (is_territorial) list() else list(list(Fecha = "2026-06-18", Actor = "Docentes", `Nuevas efectivas` = 4L, `Efectivas acumuladas` = 7L, `% avance universo` = 35, Pendientes = 13L)),
    by_date_segment = list(),
    by_date_district = if (is_territorial) list(list(Fecha = "2026-06-18", Distrito = "Centro", `Nuevas efectivas` = 4L, `Efectivas acumuladas` = 7L, `% avance cuota` = 58.3, Brecha = 5L)) else list(),
    by_date_ump = if (is_territorial) list(list(Fecha = "2026-06-18", UMP = "UMP-01", `Nuevas efectivas` = 2L, `Efectivas acumuladas` = 2L, `% avance cuota` = 33.3, Brecha = 4L)) else list(),
    target_reference = list(label = if (is_territorial) "Meta/cuota territorial" else "Universo esperado", value = if (is_territorial) 12L else 20L, configured = TRUE),
    universe_reference = list(label = "Universo", value = 20L, configured = TRUE),
    status_palette = list(Efectiva = "#166534", Respondió = "#166534", Parcial = "#2563EB"),
    empty_state = list(date = "", status = "", target = "", general = "")
  )
}

monitoreo_space_test_model <- function(family = "accreditation_monitoring", audience = "client", sections = list(), daily_progress = NULL) {
  if (is.null(daily_progress)) daily_progress <- monitoreo_space_test_daily_progress(family)
  c(
    list(
      schema = "monitoreo_publication_model_v1",
      audience = audience,
      family = family,
      generated_at = "2026-06-18T00:00:00Z",
      synced_at = "2026-06-18T00:00:00Z",
      daily_progress = daily_progress,
      tab_order = as.list(vapply(sections, function(section) section$title, character(1)))
    ),
    sections
  )
}

test_that("snapshot publico de monitoreo guarda solo metadata y payload agregado", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "estudio", list(nombre = "Demo ACNUR", bases = list()))
  session_set(sid, "monitoreo_sources", list(list(id = "fuente-viva", kind = "kobo", label = "Kobo vivo")))
  session_set(sid, "monitoreo_config", list(sentinel = "config-viva"))
  session_set(sid, "monitoreo_snapshot", list(
    data = data.frame(response_id = c("live-1", "live-2"), stringsAsFactors = FALSE),
    synced_at = "2026-06-18T12:00:00Z"
  ))
  session_set(sid, "hojas_ruta_workspace_outputs", list(sample = list(status = "progreso-vivo")))

  payload <- list(monitoreo_report = list(
    ok = TRUE,
    generated_at = "2026-06-16T00:00:00Z",
    synced_at = "2026-06-16T00:00:00Z",
    profile = list(family = "acreditacion"),
    accreditation = list(actors = list(), daily_general = list(), sources = list())
  ))
  snap <- .dashboard_publish_snapshot(
    sid,
    "Demo ACNUR",
    public_artifact = list(
      kind = "monitoreo",
      module = "monitoreo",
      title = "Demo ACNUR",
      public_scope = "aggregate",
      audience = "client",
      profile_family = "acreditacion",
      report_scope = "client_report"
    ),
    public_payload = payload
  )
  stage <- tempfile("pulso_public_test_")
  dir.create(stage, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(c(stage, snap$path), recursive = TRUE, force = TRUE), add = TRUE)
  zip::unzip(snap$path, files = "state.rds", exdir = stage)
  saved <- readRDS(file.path(stage, "state.rds"))

  expect_equal(saved$public_artifact$kind, "monitoreo")
  expect_equal(saved$public_artifact$public_scope, "aggregate")
  expect_equal(saved$public_artifact$audience, "client")
  expect_true(isTRUE(saved$public_artifact_payload$monitoreo_report$ok))
  expect_equal(length(saved$files), 0L)
  expect_null(saved$monitoreo_snapshot)
  expect_null(saved$monitoreo_sources)
  live <- session_get(sid)
  expect_null(live$public_artifact)
  expect_null(live$public_artifact_payload)
  expect_equal(live$monitoreo_sources[[1]]$id, "fuente-viva")
  expect_equal(live$monitoreo_config$sentinel, "config-viva")
  expect_equal(live$monitoreo_snapshot$data$response_id, c("live-1", "live-2"))
  expect_equal(live$hojas_ruta_workspace_outputs$sample$status, "progreso-vivo")
})

test_that("staging HF de monitoreo queda deshabilitado", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "estudio", list(nombre = "Demo ACNUR", bases = list()))

  err <- expect_error(
    .dashboard_publish_prepare_space(
      sid = sid,
      repo_id = "pulso/demo-monitoreo",
      space_name = "demo-monitoreo",
      artifact = list(
        kind = "monitoreo",
        module = "monitoreo",
        title = "Demo ACNUR",
        public_scope = "aggregate",
        profile_family = "territorial",
        report_scope = "advance_summary"
      ),
      public_payload = list(monitoreo_report = list(ok = TRUE, publication_model = list()))
    ),
    class = "api_error"
  )

  expect_equal(err$status, 410)
  expect_equal(err$code, "E_MONITOREO_HF_DISABLED")
  expect_match(err$message, "Google Sheets")
})

test_that("publicador HF ya no registra modelos Space de monitoreo en Git LFS", {
  patterns <- .hf_lfs_track_patterns()
  expect_equal(.dashboard_publish_artifact_sdk(list(kind = "dashboard")), "docker")
  expect_true("data/*.pulso" %in% patterns)
  expect_false(any(grepl("api/inst/www/space", patterns, fixed = TRUE)))
})

test_that("reporte publico de monitoreo prefiere payload embebido", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "public_artifact_payload", list(monitoreo_report = list(
    ok = TRUE,
    generated_at = "2026-06-16T00:00:00Z",
    synced_at = "2026-06-16T00:00:00Z",
    profile = list(family = "territorial"),
    territorial = list(district_progress = list())
  )))

  out <- .monitoreo_public_report_payload(sid)
  expect_true(isTRUE(out$ok))
  expect_equal(out$profile$family, "territorial")
})

test_that("builder publico de acreditacion no expone trazabilidad cruda", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  demo <- monitoreo_demo_payload(seed = 7L, n = 24L)
  demo$snapshot$data$telefono_contacto <- "PHONE-SENTINEL-999"
  demo$snapshot$data$email_contacto <- "pii-sentinel@example.test"
  demo$snapshot$data$response_id <- paste0("RID-SENTINEL-", seq_len(nrow(demo$snapshot$data)))
  demo$snapshot$data$lat <- -12.345678
  demo$snapshot$data$lon <- -77.123456
  session_set(sid, "monitoreo_sources", demo$sources)
  session_set(sid, "monitoreo_config", demo$config)
  session_set(sid, "monitoreo_snapshot", demo$snapshot)

  out <- .monitoreo_public_report_payload(sid, audience = "client")
  json <- as.character(jsonlite::toJSON(out, auto_unbox = TRUE, null = "null"))

  expect_true(isTRUE(out$ok))
  expect_equal(out$audience, "client")
  expect_equal(out$publication_model$schema, "monitoreo_publication_model_v1")
  expect_equal(out$publication_model$audience, "client")
  expect_equal(out$publication_model$family, "accreditation_monitoring")
  expect_true(all(c("resumen_ejecutivo", "avance_general", "avance_por_actor", "cobertura_pendientes", "fuentes_actualizacion") %in% names(out$publication_model)))
  expect_false(any(c("casos_accionables", "auditoria_tecnica", "base_tecnica", "validacion_tiempos", "gps_territorio") %in% names(out$publication_model)))
  expect_false(grepl("\"(internal|internal_queries|cases|alertas|auditoria|snapshot|snapshot_rows|response_id|collector_id|source_id|_geolocation|lat|lon)\"\\s*:", json))
  expect_false(grepl("PHONE-SENTINEL|pii-sentinel@example\\.test|RID-SENTINEL|-12\\.345678|-77\\.123456", json))
})

test_that("builder interno de monitoreo conserva datos operativos completos", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  demo <- monitoreo_demo_payload(seed = 8L, n = 12L)
  demo$snapshot$data$telefono_contacto <- "PHONE-SENTINEL-INTERNO"
  demo$snapshot$data$email_contacto <- "pii-interno@example.test"
  demo$snapshot$data$response_id <- paste0("RID-INTERNAL-", seq_len(nrow(demo$snapshot$data)))
  demo$snapshot$data$lat <- -12.456789
  demo$snapshot$data$lon <- -77.654321
  session_set(sid, "monitoreo_sources", demo$sources)
  session_set(sid, "monitoreo_config", demo$config)
  session_set(sid, "monitoreo_snapshot", demo$snapshot)

  out <- .monitoreo_public_report_payload(sid, audience = "internal")
  json <- as.character(jsonlite::toJSON(out, auto_unbox = TRUE, null = "null"))

  expect_true(isTRUE(out$ok))
  expect_equal(out$audience, "internal")
  expect_equal(out$internal$schema, "monitoreo_internal_full_report_v1")
  expect_equal(out$publication_model$schema, "monitoreo_publication_model_v1")
  expect_equal(out$publication_model$audience, "internal")
  expect_true(grepl("PHONE-SENTINEL-INTERNO|pii-interno@example\\.test|RID-INTERNAL-1|-12\\.456789|-77\\.654321", json))
})

test_that("publicacion HF de monitoreo responde como deshabilitada", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  err <- expect_error(
    monitoreo_publish_space(sid, "pulso", "hf_abc", "demo-monitoreo"),
    class = "api_error"
  )

  expect_equal(err$status, 410)
  expect_equal(err$code, "E_MONITOREO_HF_DISABLED")
  expect_match(err$message, "Google Sheets")
})

test_that("publicacion interna de monitoreo en Sheets exige confirmacion manual", {
  expect_silent(.monitoreo_require_internal_publication_confirmation("client", list(), channel = "publicacion Sheets"))
  expect_silent(.monitoreo_require_internal_publication_confirmation("internal", list(confirmed_full_data = TRUE), channel = "publicacion Sheets"))

  err <- expect_error(
    .monitoreo_require_internal_publication_confirmation("internal", list(), channel = "publicacion Sheets"),
    class = "api_error"
  )
  expect_equal(err$code, "E_MONITOREO_INTERNAL_CONFIRMATION")
})

test_that("modo publico permite solo descriptor y reporte agregado de monitoreo", {
  old <- Sys.getenv("PULSO_PUBLIC_MODE", unset = NA_character_)
  on.exit({
    if (is.na(old)) Sys.unsetenv("PULSO_PUBLIC_MODE") else Sys.setenv(PULSO_PUBLIC_MODE = old)
  }, add = TRUE)
  Sys.setenv(PULSO_PUBLIC_MODE = "1")

  expect_true(public_request_allowed("GET", "/api/public/artifact"))
  expect_true(public_request_allowed("GET", "/api/monitoreo/public-report"))
  expect_false(public_request_allowed("POST", "/api/monitoreo/sync"))
  expect_false(public_request_allowed("POST", "/api/monitoreo/publication/xlsx"))
  expect_false(public_request_allowed("POST", "/api/monitoreo/publication/sheets"))
  expect_false(public_request_allowed("POST", "/api/monitoreo/client-report/pdf"))
  expect_false(public_request_allowed("GET", "/api/monitoreo/client-report/pdf/download"))
})
