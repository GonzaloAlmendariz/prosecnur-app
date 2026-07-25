# =============================================================================
# Matriz de proyectos canonicos de auditoria
# =============================================================================
#
# Extiende la auditoria canonica de una unica semilla general a una fabrica de
# proyectos .pulso sinteticos por familia. Las semillas se generan bajo demanda
# en outputs/audit-projects/seeds/ y no se versionan como binarios.

AUDIT_PROJECT_SCHEMA <- "prosecnur.audit_project.v1"
AUDIT_PROJECT_SEED_MANIFEST_SCHEMA <- "prosecnur.audit_project_seed_manifest.v1"
AUDIT_PROJECT_RUN_MANIFEST_SCHEMA <- "prosecnur.audit_project_run_manifest.v1"
AUDIT_PROJECT_SOURCE_MANIFEST_SCHEMA <- "prosecnur.audit_project_sources_manifest.v1"
AUDIT_PROJECT_CANONICAL_FLOW <- c(
  "diseno_planificacion",
  "diseno_muestral",
  "instrumento",
  "preparacion_operativa_campo",
  "levantamiento_monitoreo",
  "carga_consolidacion_data",
  "validacion_limpieza",
  "codificacion",
  "analitica",
  "productos_analisis",
  "cierre_auditoria_general"
)

audit_project_default_seed_root <- function() {
  file.path(normalizePath(file.path(.app_api_dir(), ".."), mustWork = FALSE),
            "outputs", "audit-projects", "seeds")
}

.audit_project_catalog_list <- function() {
  list(
    # `reduced_from` nombra el proyecto REAL del que se derivó la semilla, por
    # su slug en `reference_projects.R`. Vive acá y no dentro de cada función de
    # seed para que la procedencia sea un dato consultable —y verificable por
    # test— en vez de un literal enterrado en el código de construcción.
    # `NULL` significa que la familia se diseñó sin un estudio real de origen.
    territorial_lima_manzanas = list(
      slug = "territorial_lima_manzanas",
      title = "Auditoria Territorial Lima Manzanas",
      family = "territorial",
      description = "Distritos, UMP, manzanas titulares/reemplazo, filas Kobo-like, GPS, duracion, cuotas y salidas territoriales.",
      reduced_from = "acnur_acg",
      canonical_order = 1L
    ),
    acreditacion_multiactor = list(
      slug = "acreditacion_multiactor",
      title = "Auditoria Acreditacion Multiactor",
      family = "acreditacion",
      description = "Actores, canales SurveyMonkey/Kobo/Sheets, correo, llamada, enlaces personalizados y brechas de respuesta.",
      reduced_from = "acrconta",
      canonical_order = 2L
    ),
    procesamiento_multibase = list(
      slug = "procesamiento_multibase",
      title = "Auditoria Procesamiento Multibase",
      family = "procesamiento",
      description = "Tres bases sinteticas tipo SurveyMonkey/Kobo/Sheets para carga, validacion, codificacion, analitica, graficos y dashboard.",
      reduced_from = NULL,
      canonical_order = 3L
    ),
    telefonico_cuotas = list(
      slug = "telefonico_cuotas",
      title = "Auditoria Telefonica Con Cuotas",
      family = "telefonico",
      description = "Barrido telefonico, responsables, intentos, estados, cuotas por distrito/grupo y seguimiento interno.",
      reduced_from = "acnur_pdm",
      canonical_order = 4L
    )
  )
}

audit_project_catalog <- function() {
  items <- .audit_project_catalog_list()
  rows <- lapply(items, function(item) {
    data.frame(
      slug = item$slug,
      title = item$title,
      family = item$family,
      description = item$description,
      canonical_order = as.integer(item$canonical_order),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  })
  out <- do.call(rbind, rows)
  out[order(out$canonical_order), , drop = FALSE]
}

.audit_project_meta <- function(slug) {
  slug <- as.character(slug %||% "")
  catalog <- .audit_project_catalog_list()
  item <- catalog[[slug]]
  if (is.null(item)) {
    stop(sprintf("Proyecto canonico desconocido: %s", slug), call. = FALSE)
  }
  item
}

.audit_project_now <- function() {
  .audit_reference_now()
}

.audit_project_absolute_path <- function(path) {
  path <- path.expand(as.character(path %||% ""))
  if (!nzchar(path)) return(path)
  absolute <- grepl("^(/|[A-Za-z]:[\\\\/]|\\\\\\\\)", path)
  if (!absolute) path <- file.path(getwd(), path)
  normalizePath(path, mustWork = FALSE)
}

.audit_project_sha256 <- function(path) {
  .audit_reference_sha256(path)
}

.audit_project_seed_input_records <- function(paths) {
  input_paths <- c(xlsform = paths$xlsform, paths$data)
  roles <- c(
    xlsform = "xlsform",
    stats::setNames(paste0("data:", names(paths$data)), names(paths$data))
  )
  lapply(names(input_paths), function(name) {
    path <- normalizePath(input_paths[[name]], mustWork = FALSE)
    list(
      role = roles[[name]],
      path = path,
      filename = basename(path),
      ext = tolower(tools::file_ext(path)),
      size = as.integer(file.info(path)$size %||% 0L),
      sha256 = if (file.exists(path)) .audit_project_sha256(path) else NA_character_
    )
  })
}

.audit_project_seed_zip_contract <- function(project_path) {
  entries <- if (file.exists(project_path)) zip::zip_list(project_path)$filename else character()
  forbidden <- grepl(
    "generated[.]xlsx|generated[.]pdf|evidence-pack|deliverables|validation-report[.]html",
    entries,
    ignore.case = TRUE
  )
  list(
    pulso_required_entries = as.list(c("manifest.json", "state.rds")),
    pulso_file_count = length(entries),
    pulso_contains_generated_deliverables = any(forbidden),
    generated_deliverables_outside_pulso = !any(forbidden)
  )
}

.audit_project_seed_source_records <- function(sources) {
  lapply(sources %||% list(), function(src) {
    binding <- src$sheet_binding %||% list()
    mode <- src$integration_mode %||% src$mode %||% ""
    list(
      id = src$id %||% "",
      kind = src$kind %||% "",
      label = src$label %||% "",
      role = src$role %||% "",
      enabled = isTRUE(src$enabled),
      integration_mode = mode,
      mode = mode,
      simulated = TRUE,
      requires_credentials = FALSE,
      spreadsheet_id = binding$spreadsheet_id %||% NA_character_,
      sheet_name = binding$sheet_name %||% NA_character_,
      range = binding$range %||% NA_character_,
      snapshot_hash = binding$snapshot_hash %||% NA_character_
    )
  })
}

.audit_project_seed_sheet_records <- function(sheet_sources) {
  lapply(sheet_sources %||% list(), function(src) {
    list(
      id = src$id %||% "",
      label = src$label %||% "",
      role = src$role %||% "",
      integration_mode = src$integration_mode %||% "",
      mode = src$mode %||% src$integration_mode %||% "",
      spreadsheet_id = src$spreadsheet_id %||% "",
      sheet_name = src$sheet_name %||% "",
      range = src$range %||% "",
      last_read_at = src$last_read_at %||% "",
      requires_credentials = isTRUE(src$requires_credentials)
    )
  })
}

.audit_project_seed_source_manifest <- function(state) {
  sheet_contract <- state$audit_project_sheets %||% list()
  sheet_sources <- sheet_contract$sources %||% list()
  source_records <- .audit_project_seed_source_records(state$monitoreo_sources %||% list())
  source_kinds <- sort(unique(vapply(source_records, function(src) src$kind %||% "", character(1))))
  modes <- sort(unique(vapply(source_records, function(src) src$mode %||% "", character(1))))
  list(
    schema = AUDIT_PROJECT_SOURCE_MANIFEST_SCHEMA,
    audit_project_sheets_schema = sheet_contract$schema %||% "prosecnur.audit_project_sheets.v1",
    simulated = isTRUE(sheet_contract$simulated),
    no_credentials = isTRUE(sheet_contract$no_credentials),
    requires_credentials = any(vapply(source_records, function(src) isTRUE(src$requires_credentials), logical(1))),
    source_count = length(source_records),
    google_sheets_source_count = length(sheet_sources),
    source_kinds = as.list(source_kinds[nzchar(source_kinds)]),
    modes = as.list(modes[nzchar(modes)]),
    google_sheets = .audit_project_seed_sheet_records(sheet_sources),
    sources = source_records,
    publications = sheet_contract$publications %||% list()
  )
}

.audit_project_git_sha <- function() {
  .audit_reference_git_sha()
}

.audit_project_app_version <- function() {
  .audit_reference_app_version()
}

.audit_project_dir <- function(out_dir, slug) {
  file.path(.audit_project_absolute_path(out_dir), slug)
}

.audit_project_project_path <- function(out_dir, slug) {
  file.path(.audit_project_dir(out_dir, slug), paste0(slug, ".pulso"))
}

.audit_project_input_paths <- function(out_dir, slug, base_names) {
  root <- file.path(.audit_project_dir(out_dir, slug), "inputs")
  data_paths <- stats::setNames(
    file.path(root, paste0(slug, "_", base_names, "_data.xlsx")),
    base_names
  )
  list(
    root = root,
    xlsform = file.path(root, paste0(slug, "_xlsform.xlsx")),
    data = data_paths,
    manifest = file.path(.audit_project_dir(out_dir, slug), "manifest.json")
  )
}

.audit_project_base_names <- function(slug) {
  switch(slug,
    procesamiento_multibase = c("surveymonkey_api", "kobo_api", "sheets_control"),
    territorial_lima_manzanas = c("kobo_territorial"),
    acreditacion_multiactor = c("surveymonkey_acreditacion"),
    telefonico_cuotas = c("barrido_telefonico"),
    c("base")
  )
}

.audit_project_settings <- function(meta) {
  settings <- .audit_reference_settings()
  settings$form_title <- meta$title
  settings$form_id <- paste0("audit_project_", meta$slug)
  settings$version <- "2026.06.29"
  settings
}

.audit_project_data <- function(n = 72L, base_name = "base", offset = 0L) {
  data <- .audit_reference_data(n)
  idx <- seq_len(nrow(data))
  data$response_id <- sprintf("%s-%04d", toupper(gsub("[^A-Za-z0-9]+", "_", base_name)), idx)
  data$collector_id <- sprintf("collector_%s_%02d", base_name, ((idx + offset - 1L) %% 5L) + 1L)
  data$recipient_id <- sprintf("recipient_%s_%04d", base_name, idx)
  data$date_modified <- format(as.POSIXct("2026-06-01 08:00:00", tz = "UTC") + idx * 3600, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  data$response_status <- .audit_reference_pick(c("completed", "completed", "partial", "disqualified"), nrow(data), offset = offset)
  data$`_id` <- idx + offset * 1000L
  data$`_uuid` <- sprintf("uuid-%s-%04d", base_name, idx)
  data$submission_date <- as.Date("2026-06-01") + ((idx + offset - 1L) %% 14L)
  data$`_submission_time` <- format(as.POSIXct(data$submission_date, tz = "UTC") + 9 * 3600 + idx * 60, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  data$source_channel <- switch(base_name,
    kobo_api = "Kobo API",
    sheets_control = "Google Sheets controlado",
    kobo_territorial = "Kobo API",
    barrido_telefonico = "Barrido telefonico",
    "SurveyMonkey API"
  )
  data
}

.audit_project_phone_data <- function(n = 48L) {
  idx <- seq_len(n)
  distrito <- rep(c("San Juan", "Miraflores", "Villa Sur", "Centro"), length.out = n)
  grupo <- rep(c("Egresados 2020", "Egresados 2021", "Docentes TC"), length.out = n)
  estado <- rep(c("Completa", "No contesta", "No barrido", "Rechazo", "Cita"), length.out = n)
  estado[c(7, 19)] <- "No contesta"
  estado[c(11, 29)] <- "Rechazo"
  responsable <- rep(c("Ana Rojas", "Bruno Vega", "Carla Nunez"), length.out = n)
  data <- .audit_project_data(n, "barrido_telefonico", offset = 4L)
  data$.source_id <- "audit_telefonico_cuotas_barrido_telefonico"
  data$.source_role <- "barrido"
  data$.source_label <- "Base de barrido telefonico sintetica"
  data$source_channel <- "Barrido telefonico"
  data$CodPulso <- sprintf("TEL-%04d", idx)
  data$codigo_persona <- sprintf("PER-%04d", idx)
  data$distrito <- distrito
  data$grupo <- grupo
  data$dim_actor <- ifelse(grepl("Docentes", grupo), "Docentes", "Egresados")
  data$responsable <- responsable
  data$estado <- estado
  data$intentos <- (idx %% 4L) + 1L
  data$fecha <- as.Date("2026-06-03") + ((idx - 1L) %% 10L)
  data$telefono <- sprintf("+51977%06d", idx)
  data$correo <- sprintf("contacto%03d@example.invalid", idx)
  data$link_personalizado <- sprintf("https://survey.example.invalid/tel/%04d", idx)
  data$cuota_distrito <- rep(c(10L, 8L, 12L, 6L), length.out = n)
  data$response_id <- ""
  data$response_status <- ""
  data$date_modified <- ""
  data$collector_id <- ""
  data$recipient_id <- ""
  data$`_id` <- idx
  data$`_uuid` <- sprintf("uuid-telefonico-%04d", idx)
  data$submission_date <- as.Date("2026-06-03") + ((idx - 1L) %% 10L)
  data$`_submission_time` <- format(as.POSIXct("2026-06-03 09:00:00", tz = "UTC") + idx * 1800, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  responses <- data[data$estado %in% c("Completa", "Rechazo"), , drop = FALSE]
  responses$.source_id <- "qa_sm_telefonico"
  responses$.source_role <- "respuestas"
  responses$.source_label <- "SurveyMonkey seguimiento telefonico"
  responses$source_channel <- "SurveyMonkey API"
  responses$response_id <- sprintf("TEL-RESP-%04d", seq_len(nrow(responses)))
  responses$response_status <- ifelse(responses$estado == "Completa", "completed", "rejected")
  responses$date_modified <- paste0(as.character(responses$fecha), "T12:00:00Z")
  responses$collector_id <- "collector_tel"
  responses$recipient_id <- responses$CodPulso
  rbind(data, responses)
}

.audit_project_fake_spreadsheet_id <- function(slug, suffix = "control") {
  suffix <- gsub("[^A-Za-z0-9_-]+", "_", as.character(suffix %||% "control"))
  paste0("audit_sheet_", slug, "_", suffix, "_202606")
}

.audit_project_sheet_source <- function(meta,
                                        suffix,
                                        role,
                                        label,
                                        sheet_name,
                                        range = NULL,
                                        integration_mode = "connected_read",
                                        dimensions = list(),
                                        last_read_at = NULL) {
  sheet_name <- as.character(sheet_name %||% "Base")
  if (is.null(range) || !nzchar(as.character(range)[1])) {
    range <- paste0(sheet_name, "!A1:Z")
  }
  list(
    id = paste("audit", meta$slug, suffix, sep = "_"),
    kind = "google_sheets",
    label = label,
    enabled = TRUE,
    role = role,
    integration_mode = integration_mode,
    sheet_binding = list(
      spreadsheet_id = .audit_project_fake_spreadsheet_id(meta$slug, suffix),
      sheet_name = sheet_name,
      header_row = 1L,
      range = range,
      last_read_at = last_read_at %||% .audit_project_now(),
      snapshot_hash = paste0("synthetic:", meta$slug, ":", suffix)
    ),
    dimensions = dimensions
  )
}

.audit_project_apply_sheet_simulation <- function(sid, meta, sheet_sources = list(), publications = list()) {
  current <- session_get(sid)$monitoreo_sources %||% list()
  sources <- monitoreo_normalize_sources(c(current, sheet_sources))
  session_set(sid, "monitoreo_sources", sources)
  session_set(sid, "audit_project_sheets", list(
    schema = "prosecnur.audit_project_sheets.v1",
    slug = meta$slug,
    simulated = TRUE,
    no_credentials = TRUE,
    generated_at = .audit_project_now(),
    sources = Filter(Negate(is.null), lapply(sources, function(src) {
      if (!identical(src$kind, "google_sheets")) return(NULL)
      list(
        id = src$id,
        label = src$label,
        role = src$role,
        integration_mode = src$integration_mode,
        mode = src$integration_mode,
        spreadsheet_id = src$sheet_binding$spreadsheet_id,
        spreadsheet_url = paste0("https://docs.google.com/spreadsheets/d/", src$sheet_binding$spreadsheet_id, "/edit"),
        sheet_name = src$sheet_binding$sheet_name,
        range = src$sheet_binding$range,
        last_read_at = src$sheet_binding$last_read_at,
        requires_credentials = FALSE
      )
    })),
    publications = publications
  ))
  invisible(sources)
}

.audit_project_publication_spreadsheet_id <- function(meta, audience) {
  .audit_project_fake_spreadsheet_id(meta$slug, paste0("publication_", audience))
}

.audit_project_write_inputs <- function(out_dir, slug, meta) {
  base_names <- .audit_project_base_names(slug)
  paths <- .audit_project_input_paths(out_dir, slug, base_names)
  dir.create(paths$root, recursive = TRUE, showWarnings = FALSE)
  .audit_reference_write_workbook(
    paths$xlsform,
    list(
      survey = .audit_reference_survey(),
      choices = .audit_reference_choices(),
      settings = .audit_project_settings(meta)
    )
  )
  for (idx in seq_along(base_names)) {
    n <- if (identical(slug, "procesamiento_multibase")) 64L + idx * 8L else 72L
    data <- if (identical(slug, "telefonico_cuotas") && identical(base_names[[idx]], "barrido_telefonico")) {
      .audit_project_phone_data()
    } else {
      .audit_project_data(n, base_names[[idx]], offset = idx)
    }
    .audit_reference_write_workbook(
      paths$data[[base_names[[idx]]]],
      list(data = data)
    )
  }
  paths
}

.audit_project_seed_dashboard <- function(sid, meta, base_name = NULL, subtitle = NULL) {
  s <- session_get(sid)
  bases <- (s$estudio %||% list())$bases %||% list()
  base_names <- names(bases)
  base_name <- as.character(base_name %||% if (length(base_names)) base_names[[1]] else "")[1]
  if (!nzchar(base_name) || is.null(bases[[base_name]])) {
    stop("Proyecto canonico sin base disponible para Dashboard.", call. = FALSE)
  }
  base <- bases[[base_name]]
  .dashboard_import_source(
    sid,
    list(xlsform_file_id = base$xlsform_file_id, data_file_id = base$data_file_id),
    keep_curacion = TRUE
  )
  dash_cfg <- .dashboard_default_config()
  dash_cfg$titulo <- meta$title
  dash_cfg$subtitulo <- subtitle %||% sprintf(
    "Proyecto sintetico %s para auditoria canonica",
    meta$family
  )
  dash_cfg$tabs_enabled <- list(resumen = TRUE, relaciones = TRUE, base_datos = TRUE, dimensiones = TRUE)
  session_set(sid, "dashboard_config", .dashboard_config_with_defaults(dash_cfg))
  session_set(sid, "dashboard_curacion", list(
    confirmed = TRUE,
    exclude_sections = list(),
    exclude_vars = list(),
    saved_at = .audit_project_now()
  ))
  invisible(TRUE)
}

.audit_project_seed_common <- function(meta, paths, processing_mode = "multibase") {
  sid <- session_create()
  xmeta <- save_upload(
    sid,
    "xlsform",
    basename(paths$xlsform),
    readBin(paths$xlsform, "raw", n = file.info(paths$xlsform)$size)
  )
  rp_inst <- reporte_instrumento(path = xmeta$path)
  inst_limpieza <- leer_xlsform_limpieza(xmeta$path, verbose = FALSE)
  session_set(sid, "instrumento", inst_limpieza)
  session_set(sid, "inst_limpieza", inst_limpieza)
  session_set(sid, "rp_inst", rp_inst)
  estudio_ensure(sid)
  estudio_set_nombre(sid, meta$title)
  estudio_set_processing_mode(sid, processing_mode)

  for (base_name in names(paths$data)) {
    data_path <- paths$data[[base_name]]
    dmeta <- save_upload(
      sid,
      "data",
      basename(data_path),
      readBin(data_path, "raw", n = file.info(data_path)$size)
    )
    data_raw <- as.data.frame(readxl::read_excel(dmeta$path), stringsAsFactors = FALSE, check.names = FALSE)
    data_norm <- normalize_data_for_xlsform(data_raw, rp_inst)
    .carga_assert_data_xlsform_compatible(data_norm, rp_inst)
    rp_data <- reporte_data(data_norm, instrumento = rp_inst)
    estudio_add_base(
      sid,
      nombre = base_name,
      xlsform_file_id = xmeta$file_id,
      data_file_id = dmeta$file_id,
      data_ext = dmeta$ext,
      rp_data = rp_data,
      rp_inst = rp_inst,
      n_filas = as.integer(nrow(data_norm)),
      n_columnas = as.integer(ncol(data_norm)),
      extra_meta = list(
        synthetic_source = TRUE,
        source_channel = unique(as.character(data_raw$source_channel %||% ""))[1]
      )
    )
  }
  estudio_active_base_set(sid, names(paths$data)[[1]])
  .audit_project_seed_dashboard(sid, meta, names(paths$data)[[1]])
  session_set(sid, "xlsform_state", .audit_reference_xlsform_editor_state(list(xlsform = paths$xlsform)))
  sid
}

.audit_project_set_metadata <- function(sid, meta, sentinels, coverage) {
  coverage <- coverage %||% list()
  coverage$family <- coverage$family %||% meta$family
  session_set(sid, "audit_project", list(
    schema = AUDIT_PROJECT_SCHEMA,
    slug = meta$slug,
    title = meta$title,
    family = meta$family,
    generated_at = .audit_project_now(),
    synthetic = TRUE,
    inspired_by = as.list(c("ACGACNUR", "ACRCONTA")),
    copied_private_data = FALSE,
    canonical_flow = as.list(AUDIT_PROJECT_CANONICAL_FLOW),
    module_order = as.list(AUDIT_PROJECT_CANONICAL_FLOW),
    sentinels = sentinels,
    coverage = coverage
  ))
}

.audit_project_seed_territorial <- function(meta, paths) {
  sid <- .audit_project_seed_common(meta, paths)
  fixture <- monitoreo_publish_qa_fixture("territorial")
  n_rows <- nrow(fixture$data)
  fixture$data$`_id` <- seq.int(110001L, length.out = n_rows)
  fixture$data$submission_date <- fixture$data$submission_date_iso %||% as.character(Sys.Date())
  fixture$data$`_submission_time` <- paste0(fixture$data$submission_date, "T12:00:00Z")
  fixture$data$`_status` <- rep("submitted_via_web", n_rows)
  fixture$data$`_submitted_by` <- paste0("monitor_", fixture$data$responsable %||% "campo")
  fixture$data$consent <- ifelse(fixture$data$advance_valid %in% TRUE, "1", "0")
  cfg <- monitoreo_normalize_config(fixture$config, fixture$data)
  cfg$project_name <- meta$title
  cfg$monitoreo_profile$status <- "active"
  cfg$monitoreo_profile$route_selected <- TRUE
  cfg$territorial$consent_var <- "consent"
  cfg$territorial$platform_effective_var <- "consent"
  cfg$territorial$platform_effective_values <- as.list("1")
  cfg$territorial$variable_refs$valid_filter_question <- list(
    name = "consent",
    label = "Consentimiento informado"
  )
  cfg$territorial$active_route_phase <- "field"
  cfg$territorial$phase_sources$field$source_id <- "qa_kobo_territorial_respuestas"
  cfg$territorial$phase_sources$field$kobo_asset_name <- "QA Kobo Territorial"
  cfg$territorial$phase_sources$field$inspected_at <- .audit_project_now()
  session_set(sid, "monitoreo_config", cfg)
  session_set(sid, "monitoreo_snapshot", list(
    synced_at = fixture$synced_at,
    data = fixture$data,
    config = cfg,
    dashboard = fixture$dashboard,
    variables = monitoreo_variables(fixture$data),
    errors = list()
  ))
  session_set(sid, "monitoreo_sources", list(list(
    id = "qa_kobo_territorial_respuestas",
    kind = "kobo",
    role = "respuestas",
    label = "QA Kobo Territorial",
    enabled = TRUE,
    updated_at = .audit_project_now()
  ), list(
    id = "qa_kobo_territorial_ocurrencias",
    kind = "kobo",
    role = "ocurrencias",
    label = "QA Kobo Ocurrencias de campo",
    enabled = TRUE,
    updated_at = .audit_project_now()
  )))
  .audit_project_apply_sheet_simulation(
    sid,
    meta,
    list(
      .audit_project_sheet_source(
        meta,
        suffix = "hoja_ruta_operativa",
        role = "hoja_ruta",
        label = "Sheets controlado - hoja de ruta operativa",
        sheet_name = "Hoja de ruta",
        range = "Hoja de ruta!A1:AG",
        integration_mode = "connected_read",
        dimensions = list(distrito = "distrito", manzana = "advance_block_manzana", responsable = "responsable")
      ),
      .audit_project_sheet_source(
        meta,
        suffix = "avance_interno",
        role = "avance_interno",
        label = "Sheets controlado - avance interno territorial",
        sheet_name = "Avance interno",
        range = "Avance interno!A1:Z",
        integration_mode = "controlled_write",
        dimensions = list(distrito = "distrito", ump = "advance_block_ump")
      )
    ),
    publications = list(
      client = .audit_project_publication_spreadsheet_id(meta, "client"),
      internal = .audit_project_publication_spreadsheet_id(meta, "internal")
    )
  )
  hojas <- .audit_reference_hojas_ruta_state()
  session_set(sid, "hojas_ruta_config", hojas$config)
  session_set(sid, "hojas_ruta_ui_state", hojas$ui_state)
  session_set(sid, "hojas_ruta_workspace_outputs", hojas$workspace_outputs)
  session_set(sid, "hojas_ruta_runs", hojas$runs)
  session_set(sid, "hojas_ruta_active_phase", hojas$active_phase)
  s <- session_get(sid)
  base_name <- (s$estudio %||% list())$active_base %||%
    names((s$estudio %||% list())$bases %||% list())[[1]] %||%
    "kobo_territorial"
  .graficos_config_set(sid, .audit_project_territorial_graficos_config(sid, base_name))
  .graficos_status_set(sid, "graficos_ppt_ok", FALSE)
  .graficos_status_set(sid, "graficos_word_ok", FALSE)
  .audit_project_set_metadata(
    sid,
    meta,
    sentinels = list(
      incomplete_ump = "UMP-202",
      missing_gps_uuid = "uuid-territorial-0005",
      short_duration_status = "muy_corta",
      over_quota_ump = "UMP-201",
      consent_filter_var = "consent",
      consent_rejected_response = "TER-RAW-0007",
      field_occurrences_source = "qa_kobo_territorial_ocurrencias"
    ),
    coverage = list(
      monitoreo = "territorial",
      reduced_from = meta$reduced_from,
      consent_filter = TRUE,
      kobo_like_rows = nrow(fixture$data),
      google_sheets_simulados = TRUE,
      sheets_pdf_evidence_pack = TRUE,
      dashboard = TRUE,
      hojas_ruta = TRUE
    )
  )
  sid
}

.audit_project_seed_acreditacion <- function(meta, paths) {
  sid <- .audit_project_seed_common(meta, paths)
  fixture <- monitoreo_publish_qa_fixture("acreditacion")
  n_rows <- nrow(fixture$data)
  rejected <- as.character(fixture$data$status %||% "") == "rejection"
  fixture$data$q0001 <- ifelse(rejected, "No", "Si")
  fixture$data$collector_id <- paste0("sm_collector_", fixture$data$.source_id %||% "qa")
  fixture$data$recipient_id <- paste0("rcpt_", seq_len(n_rows))
  fixture$data$date_modified <- paste0(fixture$data$fecha %||% as.character(Sys.Date()), "T18:00:00Z")
  fixture$data$response_status <- ifelse(
    rejected,
    "disqualified",
    ifelse(fixture$data$efectiva %in% TRUE, "completed", ifelse(as.character(fixture$data$status %||% "") == "partial", "partial", "not_responded"))
  )
  fixture$data$email_address <- fixture$data$correo_contacto %||% ""
  fixture$data$custom_value <- fixture$data$response_id
  fixture$data$cv_id <- fixture$data$response_id
  fixture$data$link_personalizado <- paste0("https://survey.example.test/r/", fixture$data$recipient_id)
  fixture$data$source_channel <- ifelse(
    fixture$data$.source_id %in% c("qa_source_docentes", "qa_source_egresados"),
    "Telefónico",
    ifelse(
      fixture$data$.source_id %in% "qa_source_estudiantes",
      "Kobo",
      ifelse(fixture$data$.source_id %in% "qa_source_empleadores", "Correo", "Control calidad")
    )
  )
  fixture$data$dim_canal <- fixture$data$source_channel
  fixture$data$meta_dim_actor <- ifelse(
    fixture$data$dim_actor == "Docentes",
    12L,
    ifelse(fixture$data$dim_actor == "Egresados", 20L, NA_integer_)
  )
  fixture$data$meta_carrera <- ifelse(
    fixture$data$dim_actor == "Docentes" & fixture$data$carrera == "Tiempo completo",
    10L,
    ifelse(
      fixture$data$dim_actor == "Docentes" & fixture$data$carrera == "Tiempo parcial",
      2L,
      ifelse(fixture$data$dim_actor == "Egresados" & fixture$data$carrera == "Ingeniería", 20L, NA_integer_)
    )
  )
  fixture$data$meta_source_channel <- ifelse(
    fixture$data$dim_actor == "Docentes" & fixture$data$source_channel == "Telefónico",
    12L,
    ifelse(
      fixture$data$dim_actor == "Egresados" & fixture$data$source_channel == "Telefónico",
      20L,
      NA_integer_
    )
  )
  cfg <- monitoreo_normalize_config(fixture$config, fixture$data)
  cfg$project_name <- meta$title
  cfg$monitoreo_profile$status <- "active"
  cfg$monitoreo_profile$route_selected <- TRUE
  cfg$monitoreo_profile$rejection_rules <- list(list(
    enabled = TRUE,
    actor = "",
    question_patterns = as.list("q0001"),
    rejection_answers = as.list("No")
  ))
  cfg$control_vars <- as.list(c("dim_actor", "carrera", "source_channel"))
  cfg$operational_model$link_collectors <- list(
    list(
      id = "qa_source_docentes::sm_collector_qa_source_docentes",
      source_id = "qa_source_docentes",
      source_label = "QA Docentes Personalizado",
      actor = "Docentes",
      collector_id = "sm_collector_qa_source_docentes",
      collector_name = "Docentes Personalizado",
      enabled = TRUE,
      channel = "Telefónico",
      operational_use = "telefono_asistido",
      modality = "telefono",
      roster_required = TRUE
    ),
    list(
      id = "qa_source_egresados::sm_collector_qa_source_egresados",
      source_id = "qa_source_egresados",
      source_label = "QA Egresados correo y llamada",
      actor = "Egresados",
      collector_id = "sm_collector_qa_source_egresados",
      collector_name = "Egresados correo y llamada",
      enabled = TRUE,
      channel = "Telefónico",
      operational_use = "telefono_asistido",
      modality = "telefono",
      roster_required = TRUE
    )
  )
  phone_reports <- monitoreo_acreditacion_reportes(
    fixture$data,
    cfg,
    report_scope = "phone_summary",
    cached_reports = fixture$dashboard$acreditacion_reports
  )
  if (is.list(fixture$dashboard$acreditacion_reports) && is.list(phone_reports)) {
    keep_sheets <- Filter(function(sheet) {
      !identical(sheet$id %||% "", "monitoreo_telefonico") &&
        !identical(sheet$id %||% "", "alertas")
    }, fixture$dashboard$acreditacion_reports$sheets %||% list())
    fixture$dashboard$acreditacion_reports$sheets <- c(keep_sheets, phone_reports$sheets %||% list())
  }
  session_set(sid, "calc_muestra_estudio", .audit_reference_calc_muestra())
  session_set(sid, "monitoreo_config", cfg)
  session_set(sid, "monitoreo_snapshot", list(
    synced_at = fixture$synced_at,
    data = fixture$data,
    config = cfg,
    dashboard = fixture$dashboard,
    variables = monitoreo_variables(fixture$data),
    errors = list()
  ))
  session_set(sid, "monitoreo_sources", list(
    list(id = "qa_source_estudiantes", kind = "kobo", role = "respuestas", label = "QA Estudiantes Kobo", enabled = TRUE),
    list(id = "qa_source_docentes", kind = "surveymonkey", role = "respuestas", label = "QA Docentes Personalizado", enabled = TRUE),
    list(id = "qa_source_egresados", kind = "surveymonkey", role = "respuestas", label = "QA Egresados correo y llamada", enabled = TRUE),
    list(id = "qa_source_empleadores", kind = "surveymonkey", role = "respuestas", label = "QA Empleadores correo", enabled = TRUE),
    list(id = "qa_source_edge", kind = "synthetic_edge_cases", role = "control_calidad", label = "QA Casos centinela", enabled = TRUE)
  ))
  .audit_project_apply_sheet_simulation(
    sid,
    meta,
    list(
      .audit_project_sheet_source(
        meta,
        suffix = "universo_estudiantes",
        role = "universo",
        label = "Sheets controlado - universo estudiantes",
        sheet_name = "Estudiantes",
        range = "Estudiantes!A1:Z",
        dimensions = list(actor = "Estudiantes", canal = "Kobo")
      ),
      .audit_project_sheet_source(
        meta,
        suffix = "universo_docentes",
        role = "universo",
        label = "Sheets controlado - universo docentes",
        sheet_name = "Docentes",
        range = "Docentes!A1:Z",
        dimensions = list(actor = "Docentes", canal = "enlace personalizado")
      ),
      .audit_project_sheet_source(
        meta,
        suffix = "universo_egresados",
        role = "universo",
        label = "Sheets controlado - universo egresados",
        sheet_name = "Egresados",
        range = "Egresados!A1:Z",
        dimensions = list(actor = "Egresados", canal = "correo y llamada")
      ),
      .audit_project_sheet_source(
        meta,
        suffix = "universo_empleadores",
        role = "universo",
        label = "Sheets controlado - universo empleadores",
        sheet_name = "Empleadores",
        range = "Empleadores!A1:Z",
        dimensions = list(actor = "Empleadores", canal = "correo")
      ),
      .audit_project_sheet_source(
        meta,
        suffix = "barrido_egresados",
        role = "barrido",
        label = "Sheets controlado - barrido egresados",
        sheet_name = "Barrido egresados",
        range = "Barrido egresados!A1:AA",
        dimensions = list(actor = "Egresados", canal = "llamada y correo")
      ),
      .audit_project_sheet_source(
        meta,
        suffix = "barrido_docentes_personalizado",
        role = "barrido",
        label = "Sheets controlado - docentes personalizado",
        sheet_name = "Docentes Personalizado",
        range = "Docentes Personalizado!A1:AA",
        dimensions = list(actor = "Docentes", canal = "enlace personalizado")
      ),
      .audit_project_sheet_source(
        meta,
        suffix = "avance_interno",
        role = "avance_interno",
        label = "Sheets controlado - avance interno acreditacion",
        sheet_name = "Avance interno",
        range = "Avance interno!A1:Z",
        integration_mode = "controlled_write",
        dimensions = list(actor = "dim_actor")
      )
    ),
    publications = list(
      client = .audit_project_publication_spreadsheet_id(meta, "client"),
      internal = .audit_project_publication_spreadsheet_id(meta, "internal")
    )
  )
  s <- session_get(sid)
  base_name <- (s$estudio %||% list())$active_base %||%
    names((s$estudio %||% list())$bases %||% list())[[1]] %||%
    "surveymonkey_acreditacion"
  session_set(sid, "analitica_prep_ok", TRUE)
  session_set(sid, "analitica_fuente", paste0("audit_project:", base_name))
  .graficos_config_set(sid, .audit_project_acreditacion_graficos_config(sid, base_name))
  .graficos_status_set(sid, "graficos_ppt_ok", FALSE)
  .graficos_status_set(sid, "graficos_word_ok", FALSE)
  .audit_project_set_metadata(
    sid,
    meta,
    sentinels = list(
      actor_missing_date = "ACR-RAW-MISSING-DATE",
      actor_missing_actor = "ACR-RAW-MISSING-ACTOR",
      egresados_channel = "SurveyMonkey + telefonico + correo",
      docentes_channel = "enlace personalizado + correo",
      consent_rejection_rule = "q0001 == No",
      docentes_personalizado_source = "qa_source_docentes",
      egresados_surveymonkey_source = "qa_source_egresados"
    ),
    coverage = list(
      monitoreo = "acreditacion",
      reduced_from = meta$reduced_from,
      consent_filter = TRUE,
      multi_source_actor_bases = TRUE,
      actors = as.list(c("Estudiantes", "Docentes", "Egresados", "Empleadores")),
      google_sheets_simulados = TRUE,
      sheets_pdf_evidence_pack = TRUE,
      analitica = TRUE,
      graficos = TRUE,
      dashboard = TRUE,
      calc_muestra = TRUE
    )
  )
  sid
}

.audit_project_analitica_config <- function(base_names) {
  cfg <- .audit_reference_analitica_config()
  waves <- lapply(seq_along(utils::head(base_names, 2L)), function(i) {
    list(
      base = base_names[[i]],
      label = paste("Ola", i),
      suffix = paste0("ola", i),
      order = as.integer(i)
    )
  })
  cfg$panel$key <- "response_id"
  cfg$panel$waves <- waves
  cfg
}

.audit_project_graficos_config <- function(sid, base_names) {
  cfg <- .graficos_default_config(sid)
  source_label <- function(base) {
    switch(base,
      surveymonkey_api = "SurveyMonkey API",
      kobo_api = "Kobo API",
      sheets_control = "Google Sheets controlado",
      base
    )
  }
  ref <- function(base, var) paste0(base, "$", var)
  dual_slide <- function(base, id, title, left_var, left_title, right_var, right_title,
                         left_graf = "p_barras_apiladas", right_graf = "p_barras_apiladas") {
    list(
      id = paste(base, id, sep = "-"),
      tipo = "p_slide_2_graficos_narrativo",
      payload = list(
        titulo = paste(source_label(base), title, sep = " - "),
        texto = "",
        izquierda = list(
          graficador = left_graf,
          args = list(var = ref(base, left_var), titulo = left_title)
        ),
        derecha = list(
          graficador = right_graf,
          args = list(var = ref(base, right_var), titulo = right_title)
        ),
        base = "",
        pie = "",
        etiqueta = ""
      )
    )
  }
  slides <- list(
    list(
      id = "procesamiento-cover",
      tipo = "p_slide_portada",
      payload = list(
        titulo = "Auditoria Procesamiento Multibase",
        subtitulo = "SurveyMonkey, Kobo y Google Sheets en un mismo contrato de entrega"
      )
    ),
    list(
      id = "procesamiento-section",
      tipo = "p_slide_seccion",
      payload = list(
        titulo = "Resultados por base de origen",
        subtitulo = "Cada fuente conserva su prefijo y variables graficables"
      )
    )
  )
  for (base in base_names) {
    slides <- c(slides, list(
      dual_slide(base, "territorio", "Territorio", "region", "Region", "distrito", "Distrito"),
      dual_slide(base, "perfil", "Perfil", "sexo", "Sexo", "consentimiento", "Consentimiento"),
      dual_slide(base, "experiencia", "Experiencia", "satisfaccion", "Satisfaccion general", "acuerdo", "Acuerdo con la propuesta"),
      dual_slide(base, "operacion", "Operacion", "estado", "Estado de encuesta", "area", "Area principal"),
      dual_slide(base, "servicios", "Servicios y problemas", "servicios", "Servicios usados", "problemas", "Problemas detectados",
                 left_graf = "p_barras_agrupadas", right_graf = "p_barras_agrupadas")
    ))
  }
  cfg$plan$slides <- slides
  cfg$selected_slide_id <- paste(base_names[[1]], "territorio", sep = "-")
  cfg$view_mode <- "timeline"
  cfg$density <- "compact"
  cfg
}

.audit_project_territorial_graficos_config <- function(sid, first_base) {
  cfg <- .graficos_default_config(sid)
  ref <- function(var) paste0(first_base, "$", var)
  dual_slide <- function(id, title, left_var, left_title, right_var, right_title,
                         left_graf = "p_barras_apiladas", right_graf = "p_barras_apiladas") {
    list(
      id = id,
      tipo = "p_slide_2_graficos_narrativo",
      payload = list(
        titulo = title,
        texto = "",
        izquierda = list(
          graficador = left_graf,
          args = list(var = ref(left_var), titulo = left_title)
        ),
        derecha = list(
          graficador = right_graf,
          args = list(var = ref(right_var), titulo = right_title)
        ),
        base = "",
        pie = "",
        etiqueta = ""
      )
    )
  }
  cfg$plan$slides <- list(
    list(
      id = "territorial-cover",
      tipo = "p_slide_portada",
      payload = list(
        titulo = "Auditoria Territorial Lima Manzanas",
        subtitulo = "Avance de campo, cobertura territorial y calidad sintetica"
      )
    ),
    list(
      id = "territorial-section",
      tipo = "p_slide_seccion",
      payload = list(
        titulo = "Resultados territoriales",
        subtitulo = "Base Kobo sintetica y seguimiento de campo"
      )
    ),
    dual_slide("territorial-base", "Base territorial", "region", "Region", "distrito", "Distrito"),
    dual_slide("territorial-demografia", "Perfil del levantamiento", "sexo", "Sexo", "consentimiento", "Consentimiento"),
    dual_slide("territorial-experiencia", "Experiencia declarada", "satisfaccion", "Satisfaccion general", "acuerdo", "Acuerdo con la propuesta"),
    dual_slide("territorial-operacion", "Operacion y estado", "estado", "Estado de encuesta", "area", "Area principal"),
    dual_slide("territorial-servicios", "Servicios y problemas", "servicios", "Servicios usados", "problemas", "Problemas detectados", right_graf = "p_barras_agrupadas")
  )
  cfg$selected_slide_id <- "territorial-base"
  cfg$view_mode <- "timeline"
  cfg$density <- "compact"
  cfg
}

.audit_project_acreditacion_graficos_config <- function(sid, first_base) {
  cfg <- .graficos_default_config(sid)
  ref <- function(var) paste0(first_base, "$", var)
  dual_slide <- function(id, title, left_var, left_title, right_var, right_title,
                         left_graf = "p_barras_apiladas", right_graf = "p_barras_apiladas") {
    list(
      id = id,
      tipo = "p_slide_2_graficos_narrativo",
      payload = list(
        titulo = title,
        texto = "",
        izquierda = list(
          graficador = left_graf,
          args = list(var = ref(left_var), titulo = left_title)
        ),
        derecha = list(
          graficador = right_graf,
          args = list(var = ref(right_var), titulo = right_title)
        ),
        base = "",
        pie = "",
        etiqueta = ""
      )
    )
  }
  cfg$plan$slides <- list(
    list(
      id = "acreditacion-cover",
      tipo = "p_slide_portada",
      payload = list(
        titulo = "Auditoria Acreditacion Multiactor",
        subtitulo = "Actores, canales, cuotas y experiencia sintetica"
      )
    ),
    list(
      id = "acreditacion-section",
      tipo = "p_slide_seccion",
      payload = list(
        titulo = "Resultados de acreditacion",
        subtitulo = "Base multiactor y seguimiento de avance"
      )
    ),
    dual_slide("acreditacion-base", "Base multiactor", "region", "Region", "distrito", "Distrito"),
    dual_slide("acreditacion-actores", "Actores y perfil", "sexo", "Sexo", "consentimiento", "Consentimiento"),
    dual_slide("acreditacion-experiencia", "Experiencia declarada", "satisfaccion", "Satisfaccion general", "acuerdo", "Acuerdo con la propuesta"),
    dual_slide("acreditacion-operacion", "Estado y area", "estado", "Estado de encuesta", "area", "Area principal"),
    dual_slide("acreditacion-servicios", "Servicios y problemas", "servicios", "Servicios usados", "problemas", "Problemas detectados", right_graf = "p_barras_agrupadas")
  )
  cfg$selected_slide_id <- "acreditacion-base"
  cfg$view_mode <- "timeline"
  cfg$density <- "compact"
  cfg
}

.audit_project_phone_graficos_config <- function(sid, first_base) {
  cfg <- .graficos_default_config(sid)
  ref <- function(var) paste0(first_base, "$", var)
  dual_slide <- function(id, title, left_var, left_title, right_var, right_title,
                         left_graf = "p_barras_apiladas", right_graf = "p_barras_apiladas") {
    list(
      id = id,
      tipo = "p_slide_2_graficos_narrativo",
      payload = list(
        titulo = title,
        texto = "",
        izquierda = list(
          graficador = left_graf,
          args = list(var = ref(left_var), titulo = left_title)
        ),
        derecha = list(
          graficador = right_graf,
          args = list(var = ref(right_var), titulo = right_title)
        ),
        base = "",
        pie = "",
        etiqueta = ""
      )
    )
  }
  cfg$plan$slides <- list(
    list(
      id = "phone-cover",
      tipo = "p_slide_portada",
      payload = list(
        titulo = "Auditoria Telefonica Con Cuotas",
        subtitulo = "Barrido, estados, cuotas y operacion sintetica"
      )
    ),
    list(
      id = "phone-section",
      tipo = "p_slide_seccion",
      payload = list(
        titulo = "Monitoreo telefonico",
        subtitulo = "Base de barrido y resultados del contacto"
      )
    ),
    dual_slide("phone-base", "Base de barrido telefonico", "distrito", "Distrito", "estado", "Estado telefonico"),
    dual_slide("phone-profile", "Perfil del contacto", "region", "Region", "sexo", "Sexo"),
    dual_slide("phone-response", "Respuesta y acuerdo", "consentimiento", "Consentimiento", "acuerdo", "Acuerdo"),
    dual_slide("phone-experience", "Experiencia declarada", "satisfaccion", "Satisfaccion general", "servicios", "Servicios usados", right_graf = "p_barras_agrupadas"),
    dual_slide("phone-issues", "Problemas y area", "area", "Area principal", "problemas", "Problemas detectados", right_graf = "p_barras_agrupadas")
  )
  cfg$selected_slide_id <- "phone-base"
  cfg$view_mode <- "timeline"
  cfg$density <- "compact"
  cfg
}

.audit_project_seed_procesamiento <- function(meta, paths) {
  sid <- .audit_project_seed_common(meta, paths, processing_mode = "multibase")
  base_names <- names(paths$data)
  codif <- list()
  codif[[base_names[[1]]]] <- .audit_reference_codificacion_state()
  session_set(sid, "codif_por_base", codif)
  session_set(sid, "analitica_prep_ok", TRUE)
  session_set(sid, "analitica_fuente", paste0("audit_project:", base_names[[1]]))
  cfg <- .audit_project_analitica_config(base_names)
  .analitica_config_set(sid, cfg)
  panel_preview <- tryCatch(.analitica_panel_preview(sid, cfg$panel, rows = 12L), error = function(e) NULL)
  if (is.list(panel_preview)) {
    session_set(sid, "analitica_panel_ok", TRUE)
    session_set(sid, "analitica_panel_preview", panel_preview)
  }
  s <- session_get(sid)
  first_base <- s$estudio$bases[[base_names[[1]]]]
  tryCatch(
    .dashboard_import_source(
      sid,
      list(xlsform_file_id = first_base$xlsform_file_id, data_file_id = first_base$data_file_id),
      keep_curacion = TRUE
    ),
    error = function(e) NULL
  )
  dash_cfg <- .dashboard_default_config()
  dash_cfg$titulo <- meta$title
  dash_cfg$subtitulo <- "Proyecto sintetico multibase para auditoria general"
  dash_cfg$tabs_enabled <- list(resumen = TRUE, relaciones = TRUE, base_datos = TRUE, dimensiones = TRUE)
  session_set(sid, "dashboard_config", .dashboard_config_with_defaults(dash_cfg))
  session_set(sid, "dashboard_curacion", list(confirmed = TRUE, exclude_sections = list(), exclude_vars = list(), saved_at = .audit_project_now()))
  .graficos_config_set(sid, .audit_project_graficos_config(sid, base_names))
  .graficos_status_set(sid, "graficos_ppt_ok", FALSE)
  .graficos_status_set(sid, "graficos_word_ok", FALSE)
  session_set(sid, "calc_muestra_estudio", .audit_reference_calc_muestra())
  .audit_project_apply_sheet_simulation(
    sid,
    meta,
    list(
      .audit_project_sheet_source(
        meta,
        suffix = "sheets_control",
        role = "universo",
        label = "Sheets controlado - base de control multibase",
        sheet_name = "Base control",
        range = "Base control!A1:Z",
        dimensions = list(base = "sheets_control")
      ),
      .audit_project_sheet_source(
        meta,
        suffix = "publicacion_validacion",
        role = "reporte_cliente",
        label = "Sheets controlado - publicacion validacion",
        sheet_name = "Validacion",
        range = "Validacion!A1:Z",
        integration_mode = "controlled_write",
        dimensions = list(modulo = "validacion")
      )
    ),
    publications = list(
      client = .audit_project_publication_spreadsheet_id(meta, "client"),
      internal = .audit_project_publication_spreadsheet_id(meta, "internal")
    )
  )
  .audit_project_set_metadata(
    sid,
    meta,
    sentinels = list(
      bases = as.list(base_names),
      duplicated_response_key = paste0(toupper(base_names[[1]]), "-0001"),
      validation_out_of_range = "edad=17 y puntaje=108",
      open_questions = as.list(c("comentario_open", "recomendacion_open"))
    ),
    coverage = list(
      multibase = TRUE,
      bases_count = length(base_names),
      validacion_limpieza = TRUE,
      codificacion = TRUE,
      analitica = TRUE,
      graficos = TRUE,
      dashboard = TRUE,
      google_sheets_simulados = TRUE
    )
  )
  sid
}

.audit_project_phone_fixture <- function(meta) {
  out <- .audit_project_phone_data()
  cfg <- monitoreo_normalize_config(list(
    project_name = meta$title,
    monitoreo_profile = list(family = "telefonico", variant = "barrido", status = "active", route_selected = TRUE),
    status_var = "estado",
    date_var = "fecha",
    valid_statuses = c("Completa"),
    control_vars = c("distrito", "grupo", "dim_actor"),
    goals = list(
      list(filters = list(distrito = "San Juan"), meta = 10L),
      list(filters = list(distrito = "Miraflores"), meta = 8L),
      list(filters = list(distrito = "Villa Sur"), meta = 12L),
      list(filters = list(distrito = "Centro"), meta = 6L),
      list(filters = list(grupo = "Egresados 2020"), meta = 8L),
      list(filters = list(grupo = "Egresados 2021"), meta = 8L),
      list(filters = list(grupo = "Docentes TC"), meta = 6L),
      list(filters = list(dim_actor = "Egresados"), meta = 16L),
      list(filters = list(dim_actor = "Docentes"), meta = 6L)
    )
  ), out)
  dashboard <- monitoreo_build_dashboard(out, cfg, include_reports = TRUE, report_scope = "phone_summary")
  list(data = out, config = cfg, dashboard = dashboard, synced_at = "2026-06-18T12:00:00-05:00")
}

.audit_project_seed_telefonico <- function(meta, paths) {
  sid <- .audit_project_seed_common(meta, paths)
  fixture <- .audit_project_phone_fixture(meta)
  s <- session_get(sid)
  base_name <- (s$estudio %||% list())$active_base %||% names((s$estudio %||% list())$bases %||% list())[[1]] %||% "barrido_telefonico"
  s$rp_data <- fixture$data
  s$dashboard_rp_data <- fixture$data
  if (nzchar(base_name)) {
    s$rp_data_sources[[base_name]] <- fixture$data
    if (!is.null(s$estudio$bases[[base_name]])) {
      s$estudio$bases[[base_name]]$n_filas <- as.integer(nrow(fixture$data))
      s$estudio$bases[[base_name]]$n_columnas <- as.integer(ncol(fixture$data))
      s$estudio$bases[[base_name]]$synthetic_source <- TRUE
      s$estudio$bases[[base_name]]$source_channel <- "Barrido telefonico"
    }
  }
  .session_env[[sid]] <- s
  session_set(sid, "monitoreo_config", fixture$config)
  session_set(sid, "monitoreo_snapshot", list(
    synced_at = fixture$synced_at,
    data = fixture$data,
    config = fixture$config,
    dashboard = fixture$dashboard,
    variables = monitoreo_variables(fixture$data),
    errors = list()
  ))
  session_set(sid, "monitoreo_sources", list(
    list(id = "qa_sm_telefonico", kind = "surveymonkey", role = "respuestas", label = "QA SurveyMonkey Telefonico", enabled = TRUE)
  ))
  .audit_project_apply_sheet_simulation(
    sid,
    meta,
    list(
      .audit_project_sheet_source(
        meta,
        suffix = "barrido_telefonico",
        role = "barrido",
        label = "Sheets controlado - barrido telefonico",
        sheet_name = "Barrido telefonico",
        range = "Barrido telefonico!A1:AD",
        dimensions = list(distrito = "distrito", grupo = "grupo", responsable = "responsable")
      ),
      .audit_project_sheet_source(
        meta,
        suffix = "cuotas_telefonicas",
        role = "avance_interno",
        label = "Sheets controlado - cuotas telefonicas",
        sheet_name = "Cuotas",
        range = "Cuotas!A1:Z",
        integration_mode = "controlled_write",
        dimensions = list(distrito = "distrito", grupo = "grupo")
      )
    ),
    publications = list(
      client = .audit_project_publication_spreadsheet_id(meta, "client"),
      internal = .audit_project_publication_spreadsheet_id(meta, "internal")
    )
  )
  .graficos_config_set(sid, .audit_project_phone_graficos_config(sid, base_name))
  .graficos_status_set(sid, "graficos_ppt_ok", FALSE)
  .graficos_status_set(sid, "graficos_word_ok", FALSE)
  .audit_project_set_metadata(
    sid,
    meta,
    sentinels = list(
      no_contesta = "No contesta",
      cuota_incumplida = "Villa Sur",
      rechazo = "Rechazo",
      link_personalizado = "link_personalizado"
    ),
    coverage = list(
      monitoreo = "telefonico",
      reduced_from = meta$reduced_from,
      cuotas_por_distrito = TRUE,
      phone_summary = TRUE,
      survey_like_recipients = TRUE,
      google_sheets_simulados = TRUE,
      dashboard = TRUE
    )
  )
  sid
}

.audit_project_seed_session <- function(meta, paths) {
  switch(meta$slug,
    territorial_lima_manzanas = .audit_project_seed_territorial(meta, paths),
    acreditacion_multiactor = .audit_project_seed_acreditacion(meta, paths),
    procesamiento_multibase = .audit_project_seed_procesamiento(meta, paths),
    telefonico_cuotas = .audit_project_seed_telefonico(meta, paths),
    stop(sprintf("Proyecto canonico sin generador: %s", meta$slug), call. = FALSE)
  )
}

audit_project_build <- function(slug,
                                out_dir = audit_project_default_seed_root(),
                                overwrite = TRUE) {
  out_dir <- .audit_project_absolute_path(out_dir)
  meta <- .audit_project_meta(slug)
  project_path <- .audit_project_project_path(out_dir, meta$slug)
  if (file.exists(project_path) && !isTRUE(overwrite)) {
    stop(sprintf("Ya existe %s", project_path), call. = FALSE)
  }
  paths <- .audit_project_write_inputs(out_dir, meta$slug, meta)
  if (file.exists(project_path)) Sys.chmod(project_path, mode = "0644")
  sid <- .audit_project_seed_session(meta, paths)
  on.exit(session_delete(sid), add = TRUE)
  res <- build_pulso(sid, project_path, project_name = meta$title)
  Sys.chmod(project_path, mode = "0644")
  checksum <- .audit_project_sha256(project_path)
  zip_contract <- .audit_project_seed_zip_contract(project_path)
  input_records <- .audit_project_seed_input_records(paths)
  source_manifest <- .audit_project_seed_source_manifest(session_get(sid))
  manifest <- list(
    ok = TRUE,
    schema = AUDIT_PROJECT_SEED_MANIFEST_SCHEMA,
    audit_project_schema = AUDIT_PROJECT_SCHEMA,
    slug = meta$slug,
    title = meta$title,
    family = meta$family,
    canonical_order = as.integer(meta$canonical_order),
    generated_at = .audit_project_now(),
    saved_at = res$saved_at,
    synthetic = TRUE,
    copied_private_data = FALSE,
    secrets_included = FALSE,
    canonical_flow = as.list(AUDIT_PROJECT_CANONICAL_FLOW),
    project_path = normalizePath(project_path, mustWork = FALSE),
    project_sha256 = checksum,
    manifest_path = normalizePath(paths$manifest, mustWork = FALSE),
    inputs_dir = normalizePath(paths$root, mustWork = FALSE),
    input_file_count = length(input_records),
    inputs = input_records,
    simulated_source_count = source_manifest$source_count,
    simulated_google_sheets_source_count = source_manifest$google_sheets_source_count,
    simulated_source_kinds = source_manifest$source_kinds,
    source_manifest = source_manifest,
    pulso_required_entries = zip_contract$pulso_required_entries,
    pulso_file_count = zip_contract$pulso_file_count,
    pulso_contains_generated_deliverables = zip_contract$pulso_contains_generated_deliverables,
    generated_deliverables_outside_pulso = zip_contract$generated_deliverables_outside_pulso,
    app_version = .audit_project_app_version(),
    git_sha = .audit_project_git_sha(),
    size = res$size
  )
  dir.create(dirname(paths$manifest), recursive = TRUE, showWarnings = FALSE)
  writeLines(
    jsonlite::toJSON(manifest, auto_unbox = TRUE, pretty = TRUE),
    paths$manifest,
    useBytes = TRUE
  )
  c(res, manifest)
}

audit_project_build_all <- function(out_dir = audit_project_default_seed_root(),
                                    overwrite = TRUE) {
  slugs <- audit_project_catalog()$slug
  results <- lapply(slugs, audit_project_build, out_dir = out_dir, overwrite = overwrite)
  names(results) <- slugs
  list(
    ok = all(vapply(results, function(x) isTRUE(x$ok), logical(1))),
    generated_at = .audit_project_now(),
    out_dir = normalizePath(out_dir, mustWork = FALSE),
    projects = results
  )
}

audit_project_prepare_run <- function(slug,
                                      runs_root = file.path(normalizePath(file.path(.app_api_dir(), ".."), mustWork = FALSE), "outputs", "audit-runs"),
                                      seed_project = NULL,
                                      run_id = format(Sys.time(), "%Y%m%dT%H%M%SZ", tz = "UTC")) {
  meta <- .audit_project_meta(slug)
  if (is.null(seed_project) || !nzchar(as.character(seed_project))) {
    seed_project <- .audit_project_project_path(audit_project_default_seed_root(), meta$slug)
  }
  if (!file.exists(seed_project)) {
    built <- audit_project_build(meta$slug, out_dir = dirname(dirname(seed_project)))
    seed_project <- built$project_path
  }
  run_dir <- file.path(runs_root, paste(meta$slug, run_id, sep = "-"))
  project_dir <- file.path(run_dir, "project")
  dir.create(project_dir, recursive = TRUE, showWarnings = FALSE)
  project_path <- file.path(project_dir, sprintf("%s_%s.pulso", meta$slug, run_id))
  ok <- file.copy(seed_project, project_path, overwrite = TRUE)
  if (!isTRUE(ok)) stop(sprintf("No se pudo copiar %s", seed_project), call. = FALSE)
  Sys.chmod(project_path, mode = "0644")
  seed_sha <- .audit_project_sha256(seed_project)
  project_sha <- .audit_project_sha256(project_path)
  zip_contract <- .audit_project_seed_zip_contract(project_path)

  manifest_path <- file.path(run_dir, "audit-run.json")
  manifest <- list(
    schema = AUDIT_PROJECT_RUN_MANIFEST_SCHEMA,
    audit_project_schema = AUDIT_PROJECT_SCHEMA,
    run_id = run_id,
    status = "prepared",
    created_at = .audit_project_now(),
    audit_project_slug = meta$slug,
    audit_project_family = meta$family,
    synthetic = TRUE,
    copied_private_data = FALSE,
    secrets_included = FALSE,
    canonical_flow = as.list(AUDIT_PROJECT_CANONICAL_FLOW),
    seed_project_path = normalizePath(seed_project, mustWork = FALSE),
    seed_project_sha256 = seed_sha,
    seed_project = list(
      path = normalizePath(seed_project, mustWork = FALSE),
      sha256 = seed_sha,
      source = "canonical_seed"
    ),
    project_path = normalizePath(project_path, mustWork = FALSE),
    project_sha256 = project_sha,
    project_copied_from_seed = identical(seed_sha, project_sha),
    pulso_required_entries = zip_contract$pulso_required_entries,
    pulso_file_count = zip_contract$pulso_file_count,
    pulso_contains_generated_deliverables = zip_contract$pulso_contains_generated_deliverables,
    generated_deliverables_outside_pulso = zip_contract$generated_deliverables_outside_pulso,
    app_version = .audit_project_app_version(),
    git_sha = .audit_project_git_sha(),
    screenshots = list()
  )
  dir.create(dirname(manifest_path), recursive = TRUE, showWarnings = FALSE)
  writeLines(
    jsonlite::toJSON(manifest, auto_unbox = TRUE, pretty = TRUE),
    manifest_path,
    useBytes = TRUE
  )
  normalizePath(manifest_path, mustWork = FALSE)
}

.audit_project_copy_tree <- function(from, to) {
  from <- normalizePath(from, mustWork = TRUE)
  if (dir.exists(to)) unlink(to, recursive = TRUE, force = TRUE)
  dir.create(to, recursive = TRUE, showWarnings = FALSE)
  entries <- list.files(from, all.files = TRUE, no.. = TRUE, recursive = TRUE, include.dirs = TRUE)
  for (entry in entries) {
    src <- file.path(from, entry)
    dst <- file.path(to, entry)
    if (dir.exists(src)) {
      dir.create(dst, recursive = TRUE, showWarnings = FALSE)
    } else {
      dir.create(dirname(dst), recursive = TRUE, showWarnings = FALSE)
      file.copy(src, dst, overwrite = TRUE)
    }
  }
  normalizePath(to, mustWork = FALSE)
}

.audit_project_artifact_record <- function(path, role = NULL, file_id = NULL) {
  path <- normalizePath(path, mustWork = FALSE)
  list(
    role = role %||% tools::file_path_sans_ext(basename(path)),
    path = path,
    filename = basename(path),
    ext = tolower(tools::file_ext(path)),
    size = as.integer(file.info(path)$size %||% 0L),
    sha256 = .audit_project_sha256(path),
    file_id = file_id
  )
}

.audit_project_validation_report_metadata <- function(meta, s = list(), seed_project = NULL, artifacts = list()) {
  sheets <- s$audit_project_sheets %||% list()
  sources <- sheets$sources %||% list()
  seed_sha <- seed_project$sha256 %||% NA_character_
  list(
    schema = "prosecnur.audit_project_validation_report.v1",
    slug = meta$slug,
    family = meta$family,
    audit_project_schema = AUDIT_PROJECT_SCHEMA,
    synthetic = TRUE,
    external_truth_required = FALSE,
    copied_private_data = FALSE,
    secrets_included = FALSE,
    generated_deliverables_outside_pulso = TRUE,
    seed_project_sha256 = seed_sha,
    simulated_sheets = isTRUE(sheets$simulated),
    no_credentials = isTRUE(sheets$no_credentials),
    google_sheets_source_count = length(sources),
    artifact_count = length(artifacts)
  )
}

.audit_project_write_html_report <- function(path, title, rows = list(), metadata = list()) {
  esc <- function(x) {
    x <- as.character(x %||% "")
    x <- gsub("&", "&amp;", x, fixed = TRUE)
    x <- gsub("<", "&lt;", x, fixed = TRUE)
    x <- gsub(">", "&gt;", x, fixed = TRUE)
    x
  }
  fmt <- function(x) {
    if (length(x) == 0L || is.null(x)) return("")
    if (isTRUE(x)) return("true")
    if (identical(x, FALSE)) return("false")
    paste(as.character(unlist(x, use.names = FALSE)), collapse = ", ")
  }
  metadata_html <- if (length(metadata)) {
    paste(vapply(names(metadata), function(key) {
      sprintf("<tr><td>%s</td><td><code>%s</code></td></tr>", esc(key), esc(fmt(metadata[[key]])))
    }, character(1)), collapse = "\n")
  } else {
    "<tr><td colspan='2'>Sin metadata de contrato registrada.</td></tr>"
  }
  row_html <- if (length(rows)) {
    paste(vapply(rows, function(row) {
      sprintf(
        "<tr><td>%s</td><td>%s</td><td>%s</td><td><code>%s</code></td></tr>",
        esc(row$role %||% ""),
        esc(row$filename %||% ""),
        esc(row$ext %||% ""),
        esc(row$sha256 %||% "")
      )
    }, character(1)), collapse = "\n")
  } else {
    "<tr><td colspan='4'>Sin artefactos registrados.</td></tr>"
  }
  html <- paste(
    "<!doctype html>",
    "<html lang='es'>",
    "<head><meta charset='utf-8'>",
    sprintf("<title>%s</title>", esc(title)),
    "</head>",
    "<body style=\"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:32px;color:#17202a;background:#f8fafc\">",
    "<main style=\"max-width:1040px;margin:0 auto;background:white;border:1px solid #d8dee8;padding:24px\">",
    sprintf("<h1>%s</h1>", esc(title)),
    "<p>Reporte sintetico generado localmente para auditoria general de Prosecnur. No contiene credenciales ni datos reales.</p>",
    "<h2>Contrato sintetico</h2>",
    "<table style=\"width:100%;border-collapse:collapse;margin-top:12px\"><thead><tr><th>Campo</th><th>Valor</th></tr></thead><tbody>",
    metadata_html,
    "</tbody></table>",
    "<h2>Artefactos generados</h2>",
    "<table style=\"width:100%;border-collapse:collapse;margin-top:12px\"><thead><tr><th>Rol</th><th>Archivo</th><th>Tipo</th><th>SHA-256</th></tr></thead><tbody>",
    row_html,
    "</tbody></table></main></body></html>",
    sep = "\n"
  )
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  writeLines(html, path, useBytes = TRUE)
  path
}

.audit_project_zip_files <- function(files, zip_path, root_dir) {
  if (!requireNamespace("zip", quietly = TRUE)) {
    stop("El paquete R 'zip' es necesario para generar evidence packs.", call. = FALSE)
  }
  files <- normalizePath(files[file.exists(files)], mustWork = TRUE)
  root_dir <- normalizePath(root_dir, mustWork = TRUE)
  zip_path <- .audit_project_absolute_path(zip_path)
  rel <- ifelse(
    startsWith(files, paste0(root_dir, .Platform$file.sep)),
    substring(files, nchar(root_dir) + 2L),
    basename(files)
  )
  old <- getwd()
  on.exit(setwd(old), add = TRUE)
  dir.create(dirname(zip_path), recursive = TRUE, showWarnings = FALSE)
  if (file.exists(zip_path)) unlink(zip_path, force = TRUE)
  setwd(root_dir)
  zip::zip(zipfile = zip_path, files = rel)
  zip_path
}

.audit_project_manifest_write <- function(out_dir, manifest) {
  path <- file.path(out_dir, "manifest.json")
  writeLines(
    jsonlite::toJSON(manifest, auto_unbox = TRUE, null = "null", dataframe = "rows", pretty = TRUE),
    path,
    useBytes = TRUE
  )
  path
}

.audit_project_sentinel_rows <- function(s) {
  sentinels <- s$audit_project$sentinels %||% list()
  values <- vapply(sentinels, function(value) {
    paste(as.character(unlist(value, use.names = FALSE)), collapse = ", ")
  }, character(1))
  data.frame(
    key = names(values),
    value = unname(values),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.audit_project_write_sentinel_audit <- function(path, s, meta, audience = NULL) {
  payload <- list(
    schema = "prosecnur.audit_project_sentinel_audit.v1",
    generated_at = .audit_project_now(),
    slug = meta$slug,
    title = meta$title,
    family = meta$family,
    audience = audience,
    synthetic = TRUE,
    external_truth_required = FALSE,
    copied_private_data = FALSE,
    sentinels = .audit_project_sentinel_rows(s)
  )
  writeLines(
    jsonlite::toJSON(payload, auto_unbox = TRUE, null = "null", dataframe = "rows", pretty = TRUE),
    path,
    useBytes = TRUE
  )
  path
}

.audit_project_refresh_evidence_manifest <- function(evidence_dir, added_files = character()) {
  manifest_path <- file.path(evidence_dir, "manifest.json")
  if (!file.exists(manifest_path)) return(invisible(NULL))
  manifest <- jsonlite::fromJSON(manifest_path, simplifyVector = FALSE)
  evidence_dir <- normalizePath(evidence_dir, mustWork = TRUE)
  file_record <- function(path) {
    path <- normalizePath(path, mustWork = TRUE)
    rel <- if (startsWith(path, paste0(evidence_dir, .Platform$file.sep))) {
      substring(path, nchar(evidence_dir) + 2L)
    } else {
      basename(path)
    }
    info <- file.info(path)
    list(
      path = rel,
      size = as.integer(info$size %||% 0L),
      sha256 = .audit_project_sha256(path),
      modified_at = format(info$mtime, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
    )
  }
  manifest$files <- c(manifest$files %||% list(), lapply(added_files[file.exists(added_files)], file_record))
  manifest$file_count <- length(manifest$files %||% list())
  manifest$expected_zip_file_count <- manifest$file_count + if (isTRUE(manifest$manifest_included)) 1L else 0L
  manifest$total_bytes <- sum(vapply(manifest$files %||% list(), function(file) as.numeric(file$size %||% 0), numeric(1)))
  manifest$sentinel_audit_included <- any(vapply(manifest$files %||% list(), function(file) identical(file$path %||% "", "sentinel-audit.json"), logical(1)))
  manifest$sentinel_audit_schema <- "prosecnur.audit_project_sentinel_audit.v1"
  writeLines(
    jsonlite::toJSON(manifest, auto_unbox = TRUE, null = "null", dataframe = "rows", pretty = TRUE),
    manifest_path,
    useBytes = TRUE
  )
  invisible(manifest)
}

.audit_project_monitoring_deliverables <- function(sid, s, meta, out_dir) {
  snapshot <- s$monitoreo_snapshot %||% NULL
  if (is.null(snapshot) || !is.data.frame(snapshot$data) || !nrow(snapshot$data)) return(NULL)
  pack_root <- file.path(out_dir, "evidence")
  dir.create(pack_root, recursive = TRUE, showWarnings = FALSE)
  packs <- list()
  artifact_records <- list()
  for (audience in c("client", "internal")) {
    parsed <- list(
      project = meta$title,
      cut = snapshot$synced_at %||% snapshot$generated_at %||% .audit_project_now(),
      source = paste("Proyecto canonico sintetico", meta$slug),
      confirmed_full_data = TRUE,
      drift = list(
        status = "not_applicable",
        no_reference = TRUE,
        reason = "Semilla sintetica sin referencia externa validada."
      )
    )
    if (identical(audience, "client") && meta$family %in% c("territorial", "acreditacion")) {
      pdf_path <- .session_tmp(sid, sprintf("%s-%s-client-report.pdf", uuid::UUIDgenerate(), meta$slug))
      pdf_model <- .monitoreo_client_report_model_for_snapshot(
        snapshot,
        s$monitoreo_config %||% snapshot$config %||% list(),
        include_targets = FALSE
      )
      if (identical(.monitoreo_scalar(pdf_model$report_kind, ""), "territorial_advance_pdf") ||
          identical(.monitoreo_publication_family_key(pdf_model$family %||% ""), "territorial")) {
        monitoreo_territorial_advance_report_pdf(pdf_model, pdf_path, include_targets = FALSE)
      } else {
        monitoreo_acreditacion_client_report_pdf(pdf_model, pdf_path, include_targets = FALSE)
      }
      parsed$generated_pdf <- pdf_path
      parsed$pdf_validation <- list(
        required = TRUE,
        evidence = file.exists(pdf_path),
        path = normalizePath(pdf_path, mustWork = FALSE)
      )
    }
    pack <- .monitoreo_publication_evidence_pack(
      sid,
      s,
      snapshot,
      parsed = parsed,
      audience = audience,
      spreadsheet_id = .audit_project_publication_spreadsheet_id(meta, audience)
    )
    copied_dir <- file.path(pack_root, audience)
    .audit_project_copy_tree(pack$evidence_pack$out_dir, copied_dir)
    sentinel_path <- .audit_project_write_sentinel_audit(
      file.path(copied_dir, "sentinel-audit.json"),
      s,
      meta,
      audience = audience
    )
    .audit_project_refresh_evidence_manifest(copied_dir, sentinel_path)
    zip_path <- file.path(out_dir, paste0(meta$slug, "-", audience, "-evidence-pack.zip"))
    .audit_project_zip_files(list.files(copied_dir, recursive = TRUE, full.names = TRUE), zip_path, copied_dir)
    zip_meta <- .register_output_file(
      sid,
      paste0("audit_project_", audience, "_evidence_pack"),
      zip_path,
      original_name = basename(zip_path)
    )
    record <- .audit_project_artifact_record(zip_path, role = paste0("evidence_pack_", audience), file_id = zip_meta$file_id)
    artifact_records[[length(artifact_records) + 1L]] <- record
    packs[[audience]] <- list(
      ok = isTRUE(pack$ok),
      audience = audience,
      family = pack$family,
      report_scope = pack$report_scope,
      status = pack$preflight$status,
      file_id = zip_meta$file_id,
      filename = basename(zip_path),
      copied_dir = normalizePath(copied_dir, mustWork = FALSE),
      zip = record,
      tabs = as.list(pack$tabs)
    )
    unlink(pack$evidence_pack$out_dir, recursive = TRUE, force = TRUE)
  }
  list(packs = packs, artifacts = artifact_records)
}

.audit_project_processing_source_channel <- function(s, base_name, base = list()) {
  data <- s$rp_data_sources[[base_name]] %||% NULL
  observed <- if (is.data.frame(data) && "source_channel" %in% names(data)) {
    unique(as.character(data$source_channel))
  } else {
    character()
  }
  observed <- observed[!is.na(observed) & nzchar(observed)]
  observed[[1]] %||% base$extra_meta$source_channel %||% base_name
}

.audit_project_processing_deliverables <- function(sid, s, meta, out_dir, seed_project = NULL) {
  bases <- s$estudio$bases %||% list()
  rows <- lapply(names(bases), function(name) {
    base <- bases[[name]]
    data_meta <- s$files[[base$data_file_id %||% ""]] %||% list()
    data.frame(
      base = name,
      data_file_id = base$data_file_id %||% "",
      xlsform_file_id = base$xlsform_file_id %||% "",
      n_filas = as.integer(base$n_filas %||% NA_integer_),
      n_columnas = as.integer(base$n_columnas %||% NA_integer_),
      source_channel = .audit_project_processing_source_channel(s, name, base),
      original_name = data_meta$original_name %||% "",
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  })
  summary <- if (length(rows)) do.call(rbind, rows) else data.frame()
  artifacts <- list()

  csv_path <- file.path(out_dir, "analitica-summary.csv")
  utils::write.csv(summary, csv_path, row.names = FALSE, fileEncoding = "UTF-8")
  csv_meta <- .register_output_file(sid, "audit_project_analitica_csv", csv_path, original_name = basename(csv_path))
  artifacts[[length(artifacts) + 1L]] <- .audit_project_artifact_record(csv_path, "analitica_csv", csv_meta$file_id)

  if (requireNamespace("openxlsx", quietly = TRUE)) {
    xlsx_path <- file.path(out_dir, "processing-summary.xlsx")
    wb <- openxlsx::createWorkbook()
    openxlsx::addWorksheet(wb, "Bases")
    openxlsx::writeData(wb, "Bases", summary)
    openxlsx::addWorksheet(wb, "Sentinelas")
    sentinel_values <- vapply(s$audit_project$sentinels %||% list(), function(x) paste(unlist(x), collapse = ", "), character(1))
    sentinels <- data.frame(
      key = names(sentinel_values),
      value = unname(sentinel_values),
      stringsAsFactors = FALSE
    )
    openxlsx::writeData(wb, "Sentinelas", sentinels)
    openxlsx::addWorksheet(wb, "Cobertura")
    coverage <- data.frame(
      key = names(s$audit_project$coverage %||% list()),
      value = vapply(s$audit_project$coverage %||% list(), function(x) paste(unlist(x), collapse = ", "), character(1)),
      stringsAsFactors = FALSE
    )
    openxlsx::writeData(wb, "Cobertura", coverage)
    openxlsx::saveWorkbook(wb, xlsx_path, overwrite = TRUE)
    xlsx_meta <- .register_output_file(sid, "audit_project_processing_xlsx", xlsx_path, original_name = basename(xlsx_path))
    artifacts[[length(artifacts) + 1L]] <- .audit_project_artifact_record(xlsx_path, "processing_xlsx", xlsx_meta$file_id)
  }

  if (requireNamespace("haven", quietly = TRUE) && nrow(summary)) {
    sav_path <- file.path(out_dir, "analitica-summary.sav")
    haven::write_sav(summary, sav_path)
    sav_meta <- .register_output_file(sid, "audit_project_analitica_sav", sav_path, original_name = basename(sav_path))
    artifacts[[length(artifacts) + 1L]] <- .audit_project_artifact_record(sav_path, "analitica_sav", sav_meta$file_id)
  }

  html_path <- file.path(out_dir, "validation-report.html")
  .audit_project_write_html_report(
    html_path,
    paste(meta$title, "Procesamiento"),
    artifacts,
    metadata = .audit_project_validation_report_metadata(meta, s, seed_project, artifacts)
  )
  html_meta <- .register_output_file(sid, "audit_project_validation_html", html_path, original_name = basename(html_path))
  artifacts[[length(artifacts) + 1L]] <- .audit_project_artifact_record(html_path, "validation_html", html_meta$file_id)

  zip_path <- file.path(out_dir, paste0(meta$slug, "-processing-evidence-pack.zip"))
  .audit_project_zip_files(vapply(artifacts, `[[`, character(1), "path"), zip_path, out_dir)
  zip_meta <- .register_output_file(sid, "audit_project_processing_evidence_pack", zip_path, original_name = basename(zip_path))
  artifacts[[length(artifacts) + 1L]] <- .audit_project_artifact_record(zip_path, "processing_evidence_pack", zip_meta$file_id)

  list(packs = list(processing = list(ok = TRUE, file_id = zip_meta$file_id, zip = artifacts[[length(artifacts)]])), artifacts = artifacts)
}

audit_project_deliverables <- function(slug,
                                       out_dir = file.path(normalizePath(file.path(.app_api_dir(), ".."), mustWork = FALSE), "outputs", "audit-projects", "deliverables", slug),
                                       seed_project = NULL,
                                       seed_root = NULL) {
  out_dir <- .audit_project_absolute_path(out_dir)
  meta <- .audit_project_meta(slug)
  if (dir.exists(out_dir)) unlink(out_dir, recursive = TRUE, force = TRUE)
  dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
  seed_source <- "built"
  if (!is.null(seed_project) && nzchar(seed_project)) {
    seed_project <- .audit_project_absolute_path(seed_project)
    if (!file.exists(seed_project)) {
      stop(sprintf("No existe la semilla .pulso para entregables: %s", seed_project), call. = FALSE)
    }
    built <- list(
      project_path = seed_project,
      project_sha256 = .audit_project_sha256(seed_project)
    )
    seed_source <- "provided"
  } else {
    seed_root <- .audit_project_absolute_path(seed_root %||% file.path(dirname(out_dir), "_seed-projects"))
    dir.create(seed_root, recursive = TRUE, showWarnings = FALSE)
    built <- audit_project_build(meta$slug, out_dir = seed_root, overwrite = TRUE)
  }
  loaded <- load_pulso(built$project_path)
  sid <- loaded$session_id
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  if (!identical(s$audit_project$slug %||% "", meta$slug)) {
    stop(sprintf(
      "La semilla .pulso no corresponde al proyecto %s: %s",
      meta$slug,
      built$project_path
    ), call. = FALSE)
  }
  seed_project_record <- list(
    path = normalizePath(built$project_path, mustWork = FALSE),
    sha256 = built$project_sha256,
    source = seed_source
  )

  deliverables <- .audit_project_monitoring_deliverables(sid, s, meta, out_dir)
  if (is.null(deliverables)) {
    deliverables <- .audit_project_processing_deliverables(sid, s, meta, out_dir, seed_project_record)
  } else {
    html_path <- file.path(out_dir, "validation-report.html")
    .audit_project_write_html_report(
      html_path,
      meta$title,
      deliverables$artifacts,
      metadata = .audit_project_validation_report_metadata(meta, s, seed_project_record, deliverables$artifacts)
    )
    html_meta <- .register_output_file(sid, "audit_project_validation_html", html_path, original_name = basename(html_path))
    deliverables$artifacts[[length(deliverables$artifacts) + 1L]] <- .audit_project_artifact_record(html_path, "validation_html", html_meta$file_id)
  }

  manifest <- list(
    schema = "prosecnur.audit_project_deliverables_manifest.v1",
    generated_at = .audit_project_now(),
    slug = meta$slug,
    title = meta$title,
    family = meta$family,
    seed_project_sha256 = built$project_sha256,
    seed_project = seed_project_record,
    generated_deliverables_outside_pulso = TRUE,
    secrets_included = FALSE,
    copied_private_data = FALSE,
    artifacts = deliverables$artifacts
  )
  manifest_path <- .audit_project_manifest_write(out_dir, manifest)
  manifest_meta <- .register_output_file(
    sid,
    "audit_project_deliverables_manifest",
    manifest_path,
    original_name = basename(manifest_path)
  )
  manifest_record <- .audit_project_artifact_record(manifest_path, "manifest", manifest_meta$file_id)
  artifacts <- c(deliverables$artifacts, list(manifest_record))
  report <- list(
    ok = TRUE,
    schema = "prosecnur.audit_project_deliverables.v1",
    generated_at = .audit_project_now(),
    slug = meta$slug,
    title = meta$title,
    family = meta$family,
    out_dir = normalizePath(out_dir, mustWork = FALSE),
    seed_project = seed_project_record,
    evidence_packs = deliverables$packs,
    artifacts = artifacts,
    manifest = manifest_record,
    playwright_matrix_target = sprintf("make audit-project-visual-matrix PROJECT=%s", meta$slug)
  )
  writeLines(
    jsonlite::toJSON(report, auto_unbox = TRUE, null = "null", dataframe = "rows", pretty = TRUE),
    file.path(out_dir, "report.json"),
    useBytes = TRUE
  )
  report
}
