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
  expect_null(session_get(sid)$public_artifact)
  expect_null(session_get(sid)$public_artifact_payload)
})

test_that("staging de monitoreo usa runtime publico minimo", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  old_root <- Sys.getenv("PULSO_APP_ROOT", unset = NA_character_)
  repo_root <- normalizePath(file.path(testthat::test_path("..", ".."), ".."), mustWork = FALSE)
  Sys.setenv(PULSO_APP_ROOT = repo_root)
  on.exit({
    if (is.na(old_root)) Sys.unsetenv("PULSO_APP_ROOT") else Sys.setenv(PULSO_APP_ROOT = old_root)
  }, add = TRUE)
  session_set(sid, "estudio", list(nombre = "Demo ACNUR", bases = list()))
  publication_model <- monitoreo_space_test_model(
    family = "territorial_fieldwork",
    audience = "client",
    sections = list(
      portada = monitoreo_space_test_section("portada", "Portada", list(list(Campo = "Registros", Valor = "25"))),
      resumen_avance = monitoreo_space_test_section("resumen_avance", "Resumen de avance", list(list(Indicador = "Efectivas", Valor = "12"))),
      avance_por_distrito = monitoreo_space_test_section("avance_por_distrito", "Avance por distrito", list(list(Distrito = "Norte", Válidas = 8L, Meta = 10L, `% avance` = "80%"))),
      avance_diario = monitoreo_space_test_section("avance_diario", "Avance diario", list(list(Fecha = "2026-06-18", Efectivas = 3L))),
      fuentes_actualizacion = monitoreo_space_test_section("fuentes_actualizacion", "Fuentes y actualización")
    )
  )

  prepared <- .dashboard_publish_prepare_space(
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
    public_payload = list(monitoreo_report = list(ok = TRUE, publication_model = publication_model))
  )
  on.exit(unlink(prepared$stage, recursive = TRUE, force = TRUE), add = TRUE)

  expect_equal(prepared$artifact_kind, "monitoreo")
  expect_true(file.exists(file.path(prepared$stage, "api", "R", "public_runtime.R")))
  expect_true(file.exists(file.path(prepared$stage, "api", "inst", "www", "index.html")))
  expect_true(file.exists(file.path(prepared$stage, "api", "inst", "www", "space", "index.html")))
  expect_true(file.exists(file.path(prepared$stage, "api", "inst", "www", "space", "publication_model.json")))
  expect_true(file.exists(file.path(prepared$stage, "api", "inst", "www", "space", "space_manifest.json")))
  space_html <- paste(readLines(file.path(prepared$stage, "api", "inst", "www", "space", "index.html"), warn = FALSE), collapse = " ")
  expect_true(grepl('class="space-topbar"', space_html, fixed = TRUE))
  expect_true(grepl("data-section-link", space_html, fixed = TRUE))
  expect_true(grepl("data-table-search", space_html, fixed = TRUE))
  expect_true(grepl("data-table-reset", space_html, fixed = TRUE))
  expect_true(grepl('data-chart="daily-status"', space_html, fixed = TRUE))
  expect_true(grepl('data-chart="daily-effective"', space_html, fixed = TRUE))
  expect_true(grepl('data-chart="cumulative-progress"', space_html, fixed = TRUE))
  expect_true(grepl("space-plotly-chart", space_html, fixed = TRUE))
  expect_true(grepl('data-chart-layer="daily-bars"', space_html, fixed = TRUE))
  expect_true(grepl('data-chart-layer="cumulative-line"', space_html, fixed = TRUE))
  expect_false(dir.exists(file.path(prepared$stage, "frontend")))
  expect_false(file.exists(file.path(prepared$stage, "api", "R", "router_dashboard.R")))
  expect_false(file.exists(file.path(prepared$stage, "api", "R", "router_carga.R")))
})

test_that("publicador HF sube publication_model.json por Git LFS", {
  patterns <- .hf_lfs_track_patterns()
  expect_true("data/*.pulso" %in% patterns)
  expect_true("api/inst/www/space/publication_model.json" %in% patterns)
})

test_that("render_monitoreo_space despacha variantes y separa secciones por audiencia", {
  internal_sentinals <- list(
    gps_territorio = monitoreo_space_test_section("gps_territorio", "GPS y territorio", list(list(`ID caso` = "RAW-ID-1", lat = -12.1, lon = -77.1))),
    auditoria_tecnica = monitoreo_space_test_section("auditoria_tecnica", "Auditoría técnica", list(list(response_id = "RID-SECRET"))),
    casos_accionables = monitoreo_space_test_section("casos_accionables", "Casos accionables", list(list(Prioridad = "Alta")))
  )
  territorial_client <- monitoreo_space_test_model(
    family = "territorial_fieldwork",
    audience = "client",
    sections = c(list(
      portada = monitoreo_space_test_section("portada", "Portada", list(list(Campo = "Registros", Valor = "30"))),
      resumen_avance = monitoreo_space_test_section("resumen_avance", "Resumen de avance", list(list(Indicador = "Efectivas", Valor = "18"))),
      avance_por_distrito = monitoreo_space_test_section("avance_por_distrito", "Avance por distrito", list(list(Distrito = "Centro", Válidas = 9L, Meta = 12L, `% avance` = "75%"))),
      avance_por_ump = monitoreo_space_test_section("avance_por_ump", "Avance por UMP", list(list(UMP = "UMP-01", Válidas = 5L, Meta = 6L))),
      avance_diario = monitoreo_space_test_section("avance_diario", "Avance diario", list(list(Fecha = "2026-06-18", Efectivas = 4L))),
      cuotas_resumen = monitoreo_space_test_section("cuotas_resumen", "Cuotas resumen")
    ), internal_sentinals)
  )
  out_dir <- tempfile("space_")
  out <- render_monitoreo_space(territorial_client, out_dir)
  html <- paste(readLines(file.path(out_dir, "index.html"), warn = FALSE), collapse = " ")
  json <- paste(readLines(file.path(out_dir, "publication_model.json"), warn = FALSE), collapse = " ")
  expect_equal(unname(out[["variant"]]), "territorial_client")
  expect_true(grepl("Reporte de avance territorial", html, fixed = TRUE))
  expect_true(grepl("Avance por distrito", html, fixed = TRUE))
  expect_true(grepl('class="space-topbar"', html, fixed = TRUE))
  expect_true(grepl("data-section-link", html, fixed = TRUE))
  expect_true(grepl('class="section-card"', html, fixed = TRUE))
  expect_true(grepl("data-table-search", html, fixed = TRUE))
  expect_true(grepl("data-table-reset", html, fixed = TRUE))
  expect_true(grepl("status-chip", html, fixed = TRUE))
  expect_true(grepl('data-chart="daily-status"', html, fixed = TRUE))
  expect_true(grepl('data-chart="daily-effective"', html, fixed = TRUE))
  expect_true(grepl('data-chart="cumulative-progress"', html, fixed = TRUE))
  expect_true(grepl("space-plotly-chart", html, fixed = TRUE))
  expect_true(grepl('data-chart-layer="daily-bars"', html, fixed = TRUE))
  expect_true(grepl('data-chart-layer="cumulative-line"', html, fixed = TRUE))
  expect_true(grepl("Meta/cuota territorial", html, fixed = TRUE))
  expect_false(grepl("GPS y territorio|Auditoría técnica|Casos accionables|RAW-ID-1|RID-SECRET|-12\\.1|-77\\.1", paste(html, json)))

  territorial_internal <- territorial_client
  territorial_internal$audience <- "internal"
  territorial_internal$resumen_operativo <- monitoreo_space_test_section("resumen_operativo", "Resumen operativo", list(list(Indicador = "Registros", Valor = "30")))
  territorial_internal$validacion_tiempos <- monitoreo_space_test_section("validacion_tiempos", "Validación de tiempos", list(list(Clasificación = "Muy corto", Casos = 1L)))
  territorial_internal$ocurrencias_campo <- monitoreo_space_test_section("ocurrencias_campo", "Ocurrencias en campo", list(list(Estado = "Registrada", Casos = 1L)))
  territorial_internal$cuotas_ump <- monitoreo_space_test_section("cuotas_ump", "Cuotas sexo y edad", list(
    list(UMP = "UMP-01", Distrito = "Centro", Responsable = "Ana", Válidas = 6L, `Cuota esperada` = 6L, `% avance` = "100%", `Estado cuota` = "Completa"),
    list(UMP = "UMP-02", Distrito = "Centro", Responsable = "Bruno", Válidas = 3L, `Cuota esperada` = 6L, `% avance` = "50%", `Estado cuota` = "En campo")
  ))
  territorial_internal$base_tecnica <- monitoreo_space_test_section("base_tecnica", "Base técnica", list(list(response_id = "TER-RAW-BASE", Campo = "gps_inicio")))
  out_dir2 <- tempfile("space_")
  out2 <- render_monitoreo_space(territorial_internal, out_dir2)
  html2 <- paste(readLines(file.path(out_dir2, "index.html"), warn = FALSE), collapse = " ")
  expect_equal(unname(out2[["variant"]]), "territorial_internal")
  expect_true(grepl('data-card="territorial-ump"', html2, fixed = TRUE))
  expect_true(grepl("data-table-filter", html2, fixed = TRUE))
  expect_true(grepl("technical-section", html2, fixed = TRUE))
  expect_true(grepl('data-chart="daily-status"', html2, fixed = TRUE))
  expect_true(grepl("Validación de tiempos", html2, fixed = TRUE))
  expect_true(grepl("GPS y territorio", html2, fixed = TRUE))
  expect_true(grepl("Ocurrencias en campo", html2, fixed = TRUE))
  expect_true(grepl("Auditoría técnica", html2, fixed = TRUE))
})

test_that("render_monitoreo_space cubre acreditacion y tolera secciones faltantes", {
  accreditation_client <- monitoreo_space_test_model(
    family = "accreditation_monitoring",
    audience = "client",
    sections = list(
      portada = monitoreo_space_test_section("portada", "Portada", list(list(Campo = "Registros", Valor = "80"))),
      resumen_ejecutivo = monitoreo_space_test_section("resumen_ejecutivo", "Resumen ejecutivo", list(list(Indicador = "Efectivas", Valor = "45"))),
      avance_general = monitoreo_space_test_section("avance_general", "Avance general", list(list(Indicador = "Total", Efectivas = 45L, Universo = 80L))),
      avance_por_actor = monitoreo_space_test_section("avance_por_actor", "Avance por actor", list(list(Actor = "Docentes", Universo = 80L, Efectivas = 20L, Pendientes = 60L, `% avance universo` = "25.0%", `Estado de avance` = "En avance"))),
      avance_por_segmento = monitoreo_space_test_section("avance_por_segmento", "Avance por segmento", list(list(Segmento = "Facultad", Efectivas = 15L))),
      cobertura_pendientes = monitoreo_space_test_section("cobertura_pendientes", "Cobertura y pendientes", list(list(Actor = "Docentes", Universo = 80L, Efectivas = 20L, Pendientes = 60L, `% cobertura` = "25.0%"))),
      pendientes_por_actor = monitoreo_space_test_section("pendientes_por_actor", "Pendientes por actor", list(list(response_id = "RID-INTERNAL"))),
      auditoria_tecnica = monitoreo_space_test_section("auditoria_tecnica", "Auditoría técnica", list(list(response_id = "RID-AUDIT")))
    )
  )
  out_dir <- tempfile("space_")
  out <- render_monitoreo_space(accreditation_client, out_dir)
  html <- paste(readLines(file.path(out_dir, "index.html"), warn = FALSE), collapse = " ")
  json <- paste(readLines(file.path(out_dir, "publication_model.json"), warn = FALSE), collapse = " ")
  expect_equal(unname(out[["variant"]]), "accreditation_client")
  expect_true(grepl("Reporte de avance para cliente", html, fixed = TRUE))
  expect_true(grepl("Avance por actor", html, fixed = TRUE))
  expect_true(grepl('class="space-topbar"', html, fixed = TRUE))
  expect_true(grepl('data-card="actor-progress"', html, fixed = TRUE))
  expect_true(grepl("data-table-search", html, fixed = TRUE))
  expect_true(grepl("status-chip", html, fixed = TRUE))
  expect_true(grepl("Avance diario", html, fixed = TRUE))
  expect_true(grepl('data-chart="daily-status"', html, fixed = TRUE))
  expect_true(grepl('data-chart="daily-effective"', html, fixed = TRUE))
  expect_true(grepl('data-chart="cumulative-progress"', html, fixed = TRUE))
  expect_true(grepl("space-plotly-chart", html, fixed = TRUE))
  expect_true(grepl('data-chart-layer="daily-bars"', html, fixed = TRUE))
  expect_true(grepl('data-chart-layer="cumulative-line"', html, fixed = TRUE))
  expect_true(grepl("Universo esperado", html, fixed = TRUE))
  expect_true(grepl("Avance por segmento", html, fixed = TRUE))
  expect_true(grepl("Cobertura y pendientes", html, fixed = TRUE))
  expect_false(grepl("Mínimo/meta|Brechas de cumplimiento", html))
  expect_false(grepl("Pendientes por actor|Auditoría técnica|RID-INTERNAL|RID-AUDIT", paste(html, json)))
  expect_false(grepl("Recomendación|Acción sugerida|Comentario operativo|Próximo paso|Diagnóstico|Riesgo", html))

  accreditation_internal <- accreditation_client
  accreditation_internal$audience <- "internal"
  accreditation_internal$resumen_operativo <- monitoreo_space_test_section("resumen_operativo", "Resumen operativo")
  accreditation_internal$control_seguimiento <- monitoreo_space_test_section("control_seguimiento", "Control de seguimiento")
  accreditation_internal$casos_accionables <- monitoreo_space_test_section("casos_accionables", "Casos accionables")
  out_dir2 <- tempfile("space_")
  out2 <- render_monitoreo_space(accreditation_internal, out_dir2)
  html2 <- paste(readLines(file.path(out_dir2, "index.html"), warn = FALSE), collapse = " ")
  expect_equal(unname(out2[["variant"]]), "accreditation_internal")
  expect_true(grepl('data-chart="daily-status"', html2, fixed = TRUE))
  expect_true(grepl("Pendientes por actor", html2, fixed = TRUE))
  expect_true(grepl("Control de seguimiento", html2, fixed = TRUE))
  expect_true(grepl("Auditoría técnica", html2, fixed = TRUE))
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

test_that("publicacion interna de monitoreo exige Space privado", {
  err <- expect_error(
    monitoreo_publish_space(
      sid = "sin-sesion-necesaria",
      hf_username = "pulso",
      hf_token = "hf_dummy",
      space_name = "monitoreo-interno",
      private = FALSE,
      audience = "internal"
    ),
    class = "api_error"
  )
  expect_equal(err$code, "E_MONITOREO_INTERNAL_PRIVATE")
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
