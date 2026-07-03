source("setup-load-all.R")

.monitoreo_publish_qa_pdf_text <- function(pdf_path) {
  candidates <- c(
    Sys.getenv("PROSECNUR_PDF_PYTHON", ""),
    file.path(Sys.getenv("HOME", ""), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", "bin", "python3"),
    unname(Sys.which("python3"))
  )
  candidates <- candidates[nzchar(candidates) & file.exists(candidates)]
  candidates <- candidates[file.access(candidates, 1) == 0]
  if (!length(candidates)) return(NULL)
  script <- tempfile(fileext = ".py")
  on.exit(unlink(script, force = TRUE), add = TRUE)
  writeLines(c(
    "import sys",
    "try:",
    "    from pypdf import PdfReader",
    "except Exception:",
    "    sys.exit(7)",
    "reader = PdfReader(sys.argv[1])",
    "print('\\n'.join((page.extract_text() or '') for page in reader.pages))"
  ), script, useBytes = TRUE)
  for (python in candidates) {
    out <- tryCatch(
      system2(python, c(script, normalizePath(pdf_path, mustWork = TRUE)), stdout = TRUE, stderr = TRUE),
      error = function(e) structure(character(), status = 1L)
    )
    status <- attr(out, "status")
    if (is.null(status) || identical(as.integer(status), 0L)) return(paste(out, collapse = "\n"))
  }
  NULL
}

test_that("publicacion Sheets no reutiliza fuentes Google Sheets como destino", {
  source_sheet <- "1SOURCEaaaaaaaaaaaaaaaaaaaaaa"
  client_sheet <- "1CLIENTbbbbbbbbbbbbbbbbbbbbbb"
  internal_sheet <- "1INTERNALcccccccccccccccccccc"
  s <- list(
    monitoreo_sources = list(list(
      kind = "google_sheets",
      integration_mode = "controlled_write",
      sheet_binding = list(spreadsheet_id = source_sheet)
    )),
    monitoreo_publication_sheet_events_client = list(),
    monitoreo_publication_sheet_events_internal = list(list(spreadsheet_id = internal_sheet))
  )

  expect_equal(.monitoreo_resolve_publication_spreadsheet_id(list(), s, "client"), "")
  expect_equal(.monitoreo_resolve_publication_spreadsheet_id(list(), s, "internal"), internal_sheet)
  expect_equal(
    .monitoreo_resolve_publication_spreadsheet_id(
      list(spreadsheet_id = paste0("https://docs.google.com/spreadsheets/d/", client_sheet, "/edit")),
      s,
      "client"
    ),
    client_sheet
  )
  new_internal_sheet <- "1NEWINTERNALdddddddddddddddddd"
  expect_equal(
    .monitoreo_resolve_publication_spreadsheet_id(
      list(spreadsheet_id = paste0("https://docs.google.com/spreadsheets/d/", new_internal_sheet, "/edit?gid=0#gid=0")),
      s,
      "internal"
    ),
    new_internal_sheet
  )
  expect_equal(
    .monitoreo_resolve_publication_spreadsheet_id(
      list(spreadsheet_id = "https://docs.google.com/spreadsheets/u/0/"),
      s,
      "internal"
    ),
    ""
  )
  expect_equal(.monitoreo_extract_spreadsheet_id(paste0("https://docs.google.com/open?id=", client_sheet)), client_sheet)
})

test_that("PDF cliente acreditacion declara corte, fuentes y criterio canonico", {
  fixture <- monitoreo_publish_qa_fixture("acreditacion")
  model <- monitoreo_acreditacion_client_report_model(fixture$data, fixture$config)
  model$sheets <- monitoreo_acreditacion_client_report_sheets(model, include_targets = FALSE)
  pdf_path <- tempfile(fileext = ".pdf")
  out <- monitoreo_acreditacion_client_report_pdf(model, pdf_path, include_targets = FALSE)

  expect_equal(out, pdf_path)
  expect_true(file.exists(pdf_path))
  expect_gt(file.info(pdf_path)$size, 1000)

  pdf_text <- .monitoreo_publish_qa_pdf_text(pdf_path)
  testthat::skip_if(is.null(pdf_text), "No PDF text extractor available")
  expect_true(grepl("Corte y fuentes", pdf_text, fixed = TRUE))
  expect_true(grepl("Fuente de verdad", pdf_text, fixed = TRUE))
  expect_true(grepl("Fuentes de respuestas", pdf_text, fixed = TRUE))
  expect_true(grepl("SurveyMonkey", pdf_text, fixed = TRUE))
  expect_true(grepl("base oficial", pdf_text, ignore.case = TRUE))
  expect_true(grepl("Apps Script viejo", pdf_text, fixed = TRUE))
})

test_that("ACRDCONTA compacto genera 270/157/5/0/108 desde base canonica", {
  bridges <- data.frame(
    codigo_alumno = c("20171936", "20161132", "20196161", "20151697", "20134925", "20098175", "20150215", "20166117", "20167338"),
    CodPulso = c("1233", "1018", "1190", "1024", "1001", "1000", "1012", "1011", "1116"),
    stringsAsFactors = FALSE
  )
  n <- 270L
  base <- data.frame(
    CodPulso = sprintf("CP%03d", seq_len(n)),
    codigo_alumno = sprintf("20%06d", seq_len(n)),
    correo = sprintf("egresado%03d@conta.test", seq_len(n)),
    telefono = sprintf("988%06d", seq_len(n)),
    response_status = "",
    cv_id = "",
    email = "",
    Status = "",
    Fecha = "",
    date_modified = "",
    `Acepta participar` = "",
    .source_role = "universo",
    .source_label = "BBDD oficial - Egresados",
    dim_actor = "Egresados",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  base$CodPulso[seq_len(nrow(bridges))] <- bridges$CodPulso
  base$codigo_alumno[seq_len(nrow(bridges))] <- bridges$codigo_alumno

  response_rows <- function(idx, status, key_col = "codigo_alumno", source = "SurveyMonkey - Egresados - Web") {
    key_values <- base[[key_col]][idx]
    data.frame(
      CodPulso = "",
      codigo_alumno = if (identical(key_col, "codigo_alumno")) key_values else "",
      correo = "",
      telefono = if (identical(key_col, "telefono")) key_values else "",
      response_status = status,
      cv_id = if (identical(key_col, "cv_id")) key_values else "",
      email = if (identical(key_col, "correo")) key_values else "",
      Status = status,
      Fecha = "",
      date_modified = sprintf("2026-06-%02dT10:00:00+00:00", ((seq_along(idx) - 1L) %% 15L) + 1L),
      `Acepta participar` = "Si",
      .source_role = "respuestas",
      .source_label = source,
      dim_actor = "Egresados",
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  }

  completed <- response_rows(seq_len(157L), "completed")
  partial <- response_rows(158L:162L, "partial")
  bridge_dupes <- response_rows(seq_len(nrow(bridges)), "completed", "cv_id", "SurveyMonkey - Egresados - Telefonico")
  bridge_dupes$cv_id <- bridges$CodPulso
  email_dupes <- response_rows(1:3, "completed", "correo", "SurveyMonkey - Egresados - Correo")
  outside_base <- data.frame(
    CodPulso = "",
    codigo_alumno = "",
    correo = "",
    telefono = "",
    response_status = c("completed", "partial", "completed"),
    cv_id = c("OUT001", "OUT002", "OUT003"),
    email = "",
    Status = c("completed", "partial", "completed"),
    Fecha = "",
    date_modified = c("2026-06-16T10:00:00+00:00", "2026-06-16T11:00:00+00:00", "2026-06-16T12:00:00+00:00"),
    `Acepta participar` = c("Si", "Si", "No"),
    .source_role = "respuestas",
    .source_label = "SurveyMonkey - Egresados - Web",
    dim_actor = "Egresados",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  data <- rbind(base, completed, partial, bridge_dupes, email_dupes, outside_base)
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(
      family = "acreditacion",
      variant = "multi_actor",
      units = list(list(id = "Egresados", label = "Egresados")),
      key_rules = list(
        universe_fields = c("codigo_alumno", "CodPulso", "correo", "telefono"),
        response_fields = c("codigo_alumno", "cv_id", "email", "telefono"),
        automatic_detection = FALSE
      ),
      rejection_rules = list(list(
        question_patterns = c("acepta participar"),
        rejection_answers = c("no")
      ))
    )
  ), data)

  client_report <- monitoreo_acreditacion_client_report_model(data, cfg, detail = "advance_summary")
  report_actor <- .monitoreo_workbook_df(client_report$actors)
  expect_gt(sum(data$.source_role == "respuestas"), 162L)
  expect_equal(as.integer(report_actor$Universo[report_actor$Actor == "Egresados"]), 270L)
  expect_equal(as.integer(report_actor$Efectivas[report_actor$Actor == "Egresados"]), 157L)
  expect_equal(as.integer(report_actor$Parciales[report_actor$Actor == "Egresados"]), 5L)
  expect_equal(as.integer(report_actor$`Rechazos plataforma`[report_actor$Actor == "Egresados"]), 0L)
  expect_equal(as.integer(report_actor$`Sin respuesta`[report_actor$Actor == "Egresados"]), 108L)
  expect_equal(round(as.numeric(report_actor$`Avance universo`[report_actor$Actor == "Egresados"]) * 100, 1), 58.1)

  reports <- list(client_report = client_report, sheets = list())
  client_publication <- monitoreo_publication_model(
    data,
    cfg,
    audience = "client",
    dashboard = list(acreditacion_reports = reports),
    synced_at = "2026-06-16T12:00:00Z"
  )
  internal_publication <- monitoreo_publication_model(
    data,
    cfg,
    audience = "internal",
    dashboard = list(acreditacion_reports = reports),
    synced_at = "2026-06-16T12:00:00Z"
  )
  client_rows <- .monitoreo_workbook_df(build_client_sheets_progress_model(client_publication)$avance_por_actor$rows)
  internal_rows <- .monitoreo_workbook_df(build_internal_sheets_monitoring_model(internal_publication)$avance_por_actor$rows)
  client_effective_col <- if ("Completas" %in% names(client_rows)) "Completas" else "Efectivas"

  expect_equal(as.integer(client_rows$Universo[client_rows$Actor == "Egresados"]), 270L)
  expect_equal(as.integer(client_rows[[client_effective_col]][client_rows$Actor == "Egresados"]), 157L)
  expect_equal(as.integer(client_rows$Parciales[client_rows$Actor == "Egresados"]), 5L)
  expect_equal(as.integer(client_rows$Rechazo[client_rows$Actor == "Egresados"]), 0L)
  expect_equal(as.integer(client_rows$`Sin respuesta`[client_rows$Actor == "Egresados"]), 108L)
  expect_equal(as.numeric(client_rows$`% avance universo`[client_rows$Actor == "Egresados"]), 58.1)
  expect_equal(as.integer(internal_rows$Universo[internal_rows$Actor == "Egresados"]), 270L)
  expect_equal(as.integer(internal_rows$Efectivas[internal_rows$Actor == "Egresados"]), 157L)
  expect_equal(as.integer(internal_rows$Parciales[internal_rows$Actor == "Egresados"]), 5L)
  expect_equal(as.integer(internal_rows$Rechazo[internal_rows$Actor == "Egresados"]), 0L)
  expect_equal(as.integer(internal_rows$Pendientes[internal_rows$Actor == "Egresados"]), 108L)

  client_tabs <- monitoreo_publication_sheets_tabs(
    data,
    cfg,
    audience = "client",
    dashboard = list(acreditacion_reports = reports),
    synced_at = "2026-06-16T12:00:00Z"
  )
  expect_equal(names(client_tabs), c("Reporte", "Detalle del avance", "Avance por encuesta"))
  report_text <- paste(unlist(client_tabs[["Reporte"]], use.names = FALSE), collapse = "\n")
  detail_text <- paste(unlist(client_tabs[["Detalle del avance"]], use.names = FALSE), collapse = "\n")
  survey_text <- paste(unlist(client_tabs[["Avance por encuesta"]], use.names = FALSE), collapse = "\n")

  expect_false(grepl("DATOS DEL CORTE", report_text, fixed = TRUE))
  expect_true(grepl("MONITOREO", report_text, fixed = TRUE))
  expect_true(grepl("Seguimiento de Encuestas", report_text, fixed = TRUE))
  expect_true(grepl("Ultima actualizacion", report_text, fixed = TRUE))
  expect_true(grepl("Avance general", report_text, fixed = TRUE))
  expect_true(grepl("Respuestas en el sistema", report_text, fixed = TRUE))
  expect_true(grepl("Avance", report_text, fixed = TRUE))
  expect_true(grepl("Egresados", report_text, fixed = TRUE))
  expect_true(grepl("Completas", report_text, fixed = TRUE))
  expect_true(grepl("Parciales", report_text, fixed = TRUE))
  expect_true(grepl("Sin respuesta", report_text, fixed = TRUE))
  expect_true(grepl("DETALLE COMPLETO POR VARIABLES DE CONTROL", detail_text, fixed = TRUE))
  expect_true(grepl("157", detail_text, fixed = TRUE))
  expect_true(grepl("EFECTIVAS POR DÍA", survey_text, fixed = TRUE))
  expect_true(grepl("AVANCE POR RECOPILADOR", survey_text, fixed = TRUE))
  expect_true(grepl("SurveyMonkey - Egresados - Web", survey_text, fixed = TRUE))
  expect_true(grepl("SurveyMonkey - Egresados - Telefonico", survey_text, fixed = TRUE))
  expect_true(grepl("SurveyMonkey - Egresados - Correo", survey_text, fixed = TRUE))

  internal_tabs <- monitoreo_publication_sheets_tabs(
    data,
    cfg,
    audience = "internal",
    dashboard = list(acreditacion_reports = reports),
    synced_at = "2026-06-16T12:00:00Z"
  )
  expect_equal(names(internal_tabs), c("Resumen", "Producción", "Avance por encuesta", "Seguimiento", "Alertas", "Corte y fuentes"))
  internal_summary <- paste(unlist(internal_tabs[["Resumen"]], use.names = FALSE), collapse = "\n")
  internal_progress <- paste(unlist(internal_tabs[["Avance por encuesta"]], use.names = FALSE), collapse = "\n")
  internal_sources <- paste(unlist(internal_tabs[["Corte y fuentes"]], use.names = FALSE), collapse = "\n")

  expect_true(grepl("Equipo interno", internal_summary, fixed = TRUE))
  expect_true(grepl("157 de 270 respuestas esperadas (58.1%)", internal_summary, fixed = TRUE))
  expect_true(grepl("VISTA GENERAL", internal_summary, fixed = TRUE))
  expect_true(grepl("AVANCE POR ACTOR", internal_summary, fixed = TRUE))
  expect_true(grepl("Egresados", internal_summary, fixed = TRUE))
  expect_true(grepl("RITMO GENERAL", internal_progress, fixed = TRUE))
  expect_true(grepl("RITMO POR ACTOR", internal_progress, fixed = TRUE))
  expect_true(grepl("Completas acumuladas", internal_progress, fixed = TRUE))
  expect_true(grepl("FUENTES DEL CORTE", internal_sources, fixed = TRUE))
  expect_true(grepl("CAMPOS USADOS PARA EL CORTE", internal_sources, fixed = TRUE))
  expect_true(grepl("BBDD oficial - Egresados", internal_sources, fixed = TRUE))
  expect_true(grepl("SurveyMonkey - Egresados - Web", internal_sources, fixed = TRUE))
  expect_true(grepl("SurveyMonkey - Egresados - Telefonico", internal_sources, fixed = TRUE))
  expect_true(grepl("SurveyMonkey - Egresados - Correo", internal_sources, fixed = TRUE))

  if (requireNamespace("openxlsx", quietly = TRUE)) {
    client_xlsx <- tempfile(fileext = ".xlsx")
    internal_xlsx <- tempfile(fileext = ".xlsx")

    expect_equal(monitoreo_publication_workbook_from_tabs(client_tabs, client_xlsx, audience = "client"), client_xlsx)
    expect_equal(monitoreo_publication_workbook_from_tabs(internal_tabs, internal_xlsx, audience = "internal"), internal_xlsx)
    expect_true(file.exists(client_xlsx))
    expect_true(file.exists(internal_xlsx))
    expect_identical(openxlsx::getSheetNames(client_xlsx), names(client_tabs))
    expect_identical(openxlsx::getSheetNames(internal_xlsx), names(internal_tabs))

    assert_xlsx_checks <- function(path, expected_tabs, audience) {
      checks <- .monitoreo_publish_qa_xlsx_checks(path, expected_tabs, audience, family = "acreditacion")
      for (check_name in names(checks)) {
        expect_true(isTRUE(checks[[check_name]]), info = paste(audience, check_name))
      }
    }
    assert_xlsx_checks(client_xlsx, names(client_tabs), "client")
    assert_xlsx_checks(internal_xlsx, names(internal_tabs), "internal")

    client_xlsx_text <- paste(unlist(openxlsx::read.xlsx(
      client_xlsx,
      sheet = "Reporte",
      colNames = FALSE,
      skipEmptyRows = FALSE,
      skipEmptyCols = FALSE
    ), use.names = FALSE), collapse = "\n")
    internal_xlsx_text <- paste(unlist(openxlsx::read.xlsx(
      internal_xlsx,
      sheet = "Resumen",
      colNames = FALSE,
      skipEmptyRows = FALSE,
      skipEmptyCols = FALSE
    ), use.names = FALSE), collapse = "\n")

    expect_true(grepl("Respuestas en el sistema", client_xlsx_text, fixed = TRUE))
    expect_true(grepl("Seguimiento de Encuestas", client_xlsx_text, fixed = TRUE))
    expect_true(grepl("Avance general", client_xlsx_text, fixed = TRUE))
    expect_true(grepl("157 de 270 respuestas esperadas (58.1%)", internal_xlsx_text, fixed = TRUE))
    expect_false(grepl("145 de 270", client_xlsx_text, fixed = TRUE))
    expect_false(grepl("145 de 270", internal_xlsx_text, fixed = TRUE))
  }
})

test_that("rechazos telefonicos no inflan rechazo cliente canonico", {
  data <- data.frame(
    CodPulso = c("A1", "A2", "A3", "A1", "A2", ""),
    cv_id = c("", "", "", "", "", "A3"),
    Status = c("", "", "", "Rechazo", "Efectivo", ""),
    response_status = c("", "", "", "", "", "completed"),
    `Acepta participar` = c("", "", "", "", "", "No"),
    date_modified = c("", "", "", "2026-06-01", "2026-06-01", "2026-06-02T10:00:00+00:00"),
    .source_role = c(rep("universo", 3), rep("barrido", 2), "respuestas"),
    .source_label = c(
      rep("Base - Egresados", 3),
      rep("Barrido telefonico - Egresados", 2),
      "SurveyMonkey - Egresados - Correo"
    ),
    dim_actor = rep("Egresados", 6),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(
      family = "acreditacion",
      variant = "multi_actor",
      units = list(list(id = "Egresados", label = "Egresados")),
      key_rules = list(
        universe_fields = c("CodPulso"),
        response_fields = c("cv_id"),
        automatic_detection = FALSE
      ),
      rejection_rules = list(list(
        question_patterns = c("acepta participar"),
        rejection_answers = c("no")
      ))
    )
  ), data)

  dashboard <- monitoreo_build_dashboard(data, cfg)
  resumen <- dashboard$acreditacion_reports$sheets[[1]]$blocks[[1]]$rows[[1]]
  expect_equal(resumen$Rechazos, 1L)
  expect_equal(resumen$`Rechazos plataforma`, 1L)
  expect_equal(resumen$`Rechazos telefónicos`, 1L)

  publication <- monitoreo_publication_model(
    data,
    cfg,
    audience = "client",
    dashboard = dashboard,
    synced_at = "2026-06-02T10:00:00Z"
  )
  client_model <- build_client_sheets_progress_model(publication)
  actor_rows <- .monitoreo_workbook_df(client_model$avance_por_actor$rows)

  expect_equal(as.integer(actor_rows$Rechazo[actor_rows$Actor == "Egresados"]), 1L)
  expect_false("Rechazos telefónicos" %in% names(actor_rows))
  expect_false("Rechazos plataforma" %in% names(actor_rows))
})

test_that("rechazos solo telefonicos quedan fuera de matrices cliente", {
  data <- data.frame(
    CodPulso = c("A1", "A2", "A3", "A1", "A2", "A3"),
    Status = c("", "", "", "Rechazo", "Rechazo", "Efectivo"),
    Fecha = c("", "", "", "2026-06-01", "2026-06-01", "2026-06-02"),
    Responsable = c("", "", "", "Ana", "Luis", "Ana"),
    .source_role = c(rep("universo", 3), rep("barrido", 3)),
    .source_label = c(
      rep("Base - Egresados", 3),
      rep("Barrido telefonico - Egresados", 3)
    ),
    dim_actor = rep("Egresados", 6),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(
      family = "acreditacion",
      variant = "multi_actor",
      units = list(list(id = "Egresados", label = "Egresados")),
      key_rules = list(
        universe_fields = c("CodPulso"),
        automatic_detection = FALSE
      )
    )
  ), data)

  dashboard <- monitoreo_build_dashboard(data, cfg)
  resumen <- dashboard$acreditacion_reports$sheets[[1]]$blocks[[1]]$rows[[1]]
  expect_equal(resumen$Rechazos, 0L)
  expect_equal(resumen$`Rechazos plataforma`, 0L)
  expect_equal(resumen$`Rechazos telefónicos`, 2L)

  publication <- monitoreo_publication_model(
    data,
    cfg,
    audience = "client",
    dashboard = dashboard,
    synced_at = "2026-06-02T10:00:00Z"
  )
  client_model <- build_client_sheets_progress_model(publication)
  actor_rows <- .monitoreo_workbook_df(client_model$avance_por_actor$rows)
  daily_rows <- .monitoreo_workbook_df(client_model$avance_diario$rows)
  channel_rows <- .monitoreo_workbook_df(client_model$avance_por_canal_fuente$rows)

  expect_equal(as.integer(actor_rows$Rechazo[actor_rows$Actor == "Egresados"]), 0L)
  expect_equal(sum(as.integer(daily_rows$Rechazos), na.rm = TRUE), 0L)
  expect_equal(sum(as.integer(channel_rows$`Rechazos plataforma`), na.rm = TRUE), 0L)
})

test_that("path telefonico conserva estados operativos sin pasarlos al cliente", {
  data <- data.frame(
    CodPulso = c("A1", "A2", "A3", "A1", "A2", "A3"),
    Status = c("", "", "", "Rechazo", "No contesta", "Efectivo"),
    Fecha = c("", "", "", "2026-06-01", "2026-06-01", "2026-06-02"),
    Responsable = c("", "", "", "Ana", "Luis", "Ana"),
    .source_role = c(rep("universo", 3), rep("barrido", 3)),
    .source_label = c(
      rep("Base - Egresados", 3),
      rep("Barrido telefonico - Egresados", 3)
    ),
    dim_actor = rep("Egresados", 6),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(
      family = "telefonico",
      variant = "multi_actor",
      units = list(list(id = "Egresados", label = "Egresados")),
      key_rules = list(
        universe_fields = c("CodPulso"),
        automatic_detection = FALSE
      )
    )
  ), data)

  dashboard <- monitoreo_build_dashboard(data, cfg)
  reports <- dashboard$acreditacion_reports
  phone_sheet <- reports$sheets[[which(vapply(reports$sheets, function(sheet) identical(sheet$id, "monitoreo_telefonico"), logical(1)))]]
  phone_blocks <- stats::setNames(phone_sheet$blocks, vapply(phone_sheet$blocks, `[[`, character(1), "id"))
  status_rows <- .monitoreo_internal_records_to_df(phone_blocks$estatus_telefonico$rows)
  daily_rows <- .monitoreo_internal_records_to_df(phone_blocks$avance_efectivo_dia$rows)

  expect_true(all(c("Efectivo", "No contesta", "Rechazo") %in% status_rows$Estatus))
  expect_equal(sum(as.integer(daily_rows$`Rechazos telefónicos`), na.rm = TRUE), 1L)

  internal_publication <- monitoreo_publication_model(
    data,
    cfg,
    audience = "internal",
    dashboard = dashboard,
    synced_at = "2026-06-02T10:00:00Z"
  )
  internal_model <- build_internal_sheets_monitoring_model(internal_publication)

  expect_true("monitoreo_telefonico" %in% names(internal_model))
  internal_phone_rows <- .monitoreo_workbook_df(internal_model$monitoreo_telefonico$rows)
  expect_true(any(internal_phone_rows$Estatus == "Rechazo", na.rm = TRUE))
  expect_gte(sum(as.integer(internal_phone_rows$`Rechazos telefónicos`), na.rm = TRUE), 1L)

  client_publication <- monitoreo_publication_model(
    data,
    cfg,
    audience = "client",
    dashboard = dashboard,
    synced_at = "2026-06-02T10:00:00Z"
  )
  client_model <- build_client_sheets_progress_model(client_publication)
  client_text <- as.character(jsonlite::toJSON(client_model, auto_unbox = TRUE, null = "null"))

  expect_false("monitoreo_telefonico" %in% names(client_model))
  expect_false(grepl("Rechazos telef", client_text))
})

test_that("fallback generico de rechazo no pisa estados telefonicos", {
  actors <- data.frame(
    Actor = "Egresados",
    Universo = 3L,
    Efectivas = 1L,
    Parciales = 0L,
    Rechazos = 2L,
    `Rechazos telefónicos` = 2L,
    `Sin respuesta` = 2L,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  daily_general <- data.frame(
    Fecha = "2026-06-01",
    Efectivas = 1L,
    Parciales = 0L,
    Rechazos = 2L,
    `Rechazos telefónicos` = 2L,
    Acumulado = 1L,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  daily_actor <- data.frame(
    Fecha = "2026-06-01",
    Actor = "Egresados",
    Efectivas = 1L,
    Parciales = 0L,
    Rechazos = 2L,
    `Rechazos telefónicos` = 2L,
    Acumulado = 1L,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  frames <- list(actors = actors, daily_general = daily_general, daily_actor = daily_actor)

  totals <- .monitoreo_publication_accreditation_totals(frames)
  actor_rows <- .monitoreo_publication_accreditation_actor_df(frames, audience = "client")
  daily_rows <- .monitoreo_publication_accreditation_daily_df(frames, audience = "client")
  status_rows <- .monitoreo_acreditacion_status_table_from_client_daily(daily_general)

  expect_equal(totals$refusals, 0)
  expect_equal(as.integer(actor_rows$Rechazo[[1]]), 0L)
  expect_equal(sum(as.integer(daily_rows$Rechazos), na.rm = TRUE), 0L)
  expect_false("Rechazo" %in% as.character(status_rows$Estado %||% character(0)))

  platform_frames <- frames
  platform_frames$actors$`Rechazos plataforma` <- 1L
  expect_equal(.monitoreo_publication_accreditation_totals(platform_frames)$refusals, 1)
})

test_that("PDF cliente territorial usa conteos del Sheets cliente", {
  fixture <- monitoreo_publish_qa_fixture("territorial")
  model <- monitoreo_publication_model(
    fixture$data,
    fixture$config,
    audience = "client",
    dashboard = fixture$dashboard,
    synced_at = fixture$synced_at,
    context = list()
  )
  client_tabs <- monitoreo_publication_sheets_tabs(
    fixture$data,
    fixture$config,
    audience = "client",
    dashboard = fixture$dashboard,
    synced_at = fixture$synced_at,
    context = list()
  )
  district_rows <- client_tabs[["Avance por distrito"]][-1]
  district_effective <- vapply(district_rows, function(row) {
    suppressWarnings(as.numeric(row[["Efectivas"]] %||% NA_real_))
  }, numeric(1))
  expected_total <- sum(district_effective, na.rm = TRUE)

  pdf_path <- tempfile(fileext = ".pdf")
  out <- monitoreo_territorial_advance_report_pdf(model, pdf_path, include_targets = FALSE)

  expect_equal(out, pdf_path)
  expect_true(file.exists(pdf_path))
  expect_gt(file.info(pdf_path)$size, 1000)

  pdf_text <- .monitoreo_publish_qa_pdf_text(pdf_path)
  testthat::skip_if(is.null(pdf_text), "No PDF text extractor available")
  expect_true(grepl("Documento de avance", pdf_text, fixed = TRUE))
  expect_true(grepl("Avance del recojo territorial", pdf_text, fixed = TRUE))
  expect_true(grepl("Corte 18 jun. 2026", pdf_text, fixed = TRUE))
  expect_true(grepl("Fuente: información de campo", pdf_text, fixed = TRUE))
  expect_true(grepl(paste0("ENCUESTAS\n", expected_total), pdf_text, fixed = TRUE))
  for (value in district_effective) {
    expect_true(grepl(paste0("ENCUESTAS\n", as.integer(value)), pdf_text, fixed = TRUE))
  }
  expect_false(grepl("TER-RAW|GPS y territorio|Casos accionables|Auditoría técnica|_uuid|\\.source_id", pdf_text))
})

test_that("fixtures QA cubren familias de monitoreo y datos centinela", {
  territorial <- monitoreo_publish_qa_fixture("territorial")
  accreditation <- monitoreo_publish_qa_fixture("acreditacion")

  expect_equal(detect_monitoreo_family(config = territorial$config, data = territorial$data), "territorial_fieldwork")
  expect_equal(detect_monitoreo_family(config = accreditation$config, data = accreditation$data), "accreditation_monitoring")
  expect_true(nrow(territorial$data) >= 30)
  expect_true(nrow(accreditation$data) >= 80)
  expect_true(any(grepl("TER-RAW", territorial$data$response_id, fixed = TRUE)))
  expect_true(any(grepl("ACR-RAW", accreditation$data$response_id, fixed = TRUE)))
  expect_true(any(is.na(territorial$data$lat)))
  expect_true(any(!nzchar(accreditation$data$fecha)))
  expect_true(any(!nzchar(accreditation$data$dim_actor)))
})

test_that("modelos de publicacion separan Sheets cliente y Sheets interno", {
  fixture <- monitoreo_publish_qa_fixture("acreditacion")
  client_publication <- monitoreo_publication_model(
    fixture$data,
    fixture$config,
    audience = "client",
    dashboard = fixture$dashboard,
    synced_at = fixture$synced_at
  )
  internal_publication <- monitoreo_publication_model(
    fixture$data,
    fixture$config,
    audience = "internal",
    dashboard = fixture$dashboard,
    synced_at = fixture$synced_at
  )

  client_sheets_model <- build_client_sheets_progress_model(client_publication)
  internal_sheets_model <- build_internal_sheets_monitoring_model(internal_publication)
  app_visual_model <- extract_app_visual_progress_model(
    client_publication,
    .monitoreo_space_config("acreditacion", "client"),
    "QA Acreditación",
    fixture$synced_at,
    "18 jun. 2026"
  )
  client_accreditation_table_model <- extract_codegs_accreditation_model(client_publication, audience = "client")
  internal_accreditation_table_model <- extract_codegs_accreditation_model(internal_publication, audience = "internal")

  expect_true(all(c("progress_hero", "daily_progress", "accumulated_progress", "filters", "tables", "accreditation") %in% names(app_visual_model)))
  expect_gt(length(app_visual_model$accreditation$actors), 0)

  expect_equal(client_sheets_model$destination, "google_sheets")
  expect_equal(client_sheets_model$audience, "cliente")
  expect_equal(client_sheets_model$purpose, "progress_workbook")
  expect_equal(unlist(client_sheets_model$metadata$tab_order, use.names = FALSE), c("Reporte", "Detalle del avance", "Avance por encuesta"))
  expect_equal(client_sheets_model$app_visual_progress_model$schema, "monitoreo_app_visual_progress_model_v1")
  expect_equal(client_sheets_model$accreditation_table_model$schema, "monitoreo_accreditation_table_model_v1")
  expect_true(all(c("resumen", "avance_por_actor", "avance_por_segmento", "avance_por_canal_fuente", "cobertura_pendientes") %in% names(client_sheets_model)))
  expect_false(any(c("metas_internas_actor", "monitoreo_telefonico", "alertas_internas", "auditoria_tecnica", "base_tecnica") %in% names(client_sheets_model)))
  expect_true(all(c("actors", "universe_by_actor", "daily_matrix", "client_report_tables") %in% names(client_accreditation_table_model)))
  expect_false(any(c("telephone_monitoring", "internal_workbook_tables") %in% names(client_accreditation_table_model)))
  expect_false(isTRUE(client_accreditation_table_model$source$code_gs$available))
  expect_equal(client_accreditation_table_model$source$code_gs$status, "No disponible en /mnt/data/Code.gs")

  expect_equal(internal_sheets_model$destination, "google_sheets")
  expect_equal(internal_sheets_model$audience, "interno")
  expect_equal(internal_sheets_model$purpose, "operational_workbook")
  expect_equal(unlist(internal_sheets_model$metadata$tab_order, use.names = FALSE), c("Resumen", "Producción", "Avance por encuesta", "Seguimiento", "Alertas", "Corte y fuentes"))
  expect_equal(internal_sheets_model$accreditation_table_model$schema, "monitoreo_accreditation_table_model_v1")
  expect_true(all(c("produccion_responsable", "avance_por_canal_recopilador", "control_seguimiento", "monitoreo_telefonico", "alertas_internas", "auditoria_tecnica", "base_tecnica") %in% names(internal_sheets_model)))
  expect_gt(length(internal_sheets_model$monitoreo_telefonico$rows), 0)
  expect_true(all(c("collector_progress", "telephone_monitoring", "internal_workbook_tables") %in% names(internal_accreditation_table_model)))
  expect_false(isTRUE(internal_accreditation_table_model$source$code_gs$available))

  extraction_map <- monitoreo_publication_extraction_map()
  extraction_text <- paste(unlist(extraction_map, use.names = FALSE), collapse = "\n")
  expect_true(all(c("Source", "Concept", "Existing logic/function/component", "Publication model field", "Sheets cliente", "Sheets interno") %in% names(extraction_map)))
  expect_false("Space cliente" %in% names(extraction_map))
  expect_true(any(extraction_map$Source == "Monitoreo app"))
  expect_true(any(extraction_map$Source == "Code.gs acreditación"))
  expect_false(grepl(.monitoreo_publish_qa_secret_pattern(), extraction_text, ignore.case = TRUE, perl = TRUE))
})

test_that("QA de publicaciones genera XLSX separados por familia y audiencia", {
  testthat::skip_if_not_installed("openxlsx")
  out_dir <- tempfile("monitoreo_publish_qa_")
  report <- monitoreo_publish_qa_generate(out_dir = out_dir)

  expect_true(isTRUE(report$ok))
  expect_named(
    report$artifacts,
    c("territorial-client", "territorial-internal", "acreditacion-client", "acreditacion-internal")
  )
  expect_true(file.exists(report$extraction_map))
  expect_true(file.exists(report$logic_parity_map))

  for (name in names(report$artifacts)) {
    artifact <- report$artifacts[[name]]
    expect_true(file.exists(artifact$workbook), info = name)
    expect_true(file.exists(artifact$sheets_model), info = name)
    expect_true(file.exists(artifact$app_visual_model), info = name)
    expect_true(file.exists(artifact$accreditation_table_model), info = name)
    expect_true(isTRUE(artifact$checks$ok), info = name)
    expect_true(isTRUE(artifact$checks$checks$sheets_model_exists), info = name)
    expect_true(isTRUE(artifact$checks$checks$sheets_model_model_shape), info = name)
    expect_true(isTRUE(artifact$checks$checks$sheets_model_no_secret_like_strings), info = name)
    expect_true(isTRUE(artifact$checks$checks$sheets_model_no_recommendations), info = name)
    expect_true(isTRUE(artifact$checks$checks$app_visual_model_exists), info = name)
    expect_true(isTRUE(artifact$checks$checks$app_visual_model_model_shape), info = name)
    expect_true(isTRUE(artifact$checks$checks$app_visual_model_client_sections), info = name)
    expect_true(isTRUE(artifact$checks$checks$accreditation_table_model_exists), info = name)
    expect_true(isTRUE(artifact$checks$checks$accreditation_table_model_model_shape), info = name)
    expect_true(isTRUE(artifact$checks$checks$accreditation_table_model_audience_scope), info = name)
    expect_true(isTRUE(artifact$checks$checks$no_space_rendered), info = name)
    expect_false(file.exists(artifact$space_index), info = name)
    if (identical(artifact$audience, "client")) {
      expect_true(isTRUE(artifact$checks$checks$sheets_model_client_sections), info = name)
    } else {
      expect_true(isTRUE(artifact$checks$checks$sheets_model_internal_sections), info = name)
    }
    expect_true(isTRUE(artifact$checks$checks$daily_progress_exists), info = name)
    expect_true(isTRUE(artifact$checks$checks$cumulative_progress_ok), info = name)
    expect_true(isTRUE(artifact$checks$checks$xlsx_has_freeze), info = name)
    expect_true(isTRUE(artifact$checks$checks$xlsx_has_filter), info = name)
    expect_true(isTRUE(artifact$checks$checks$xlsx_hydrated_sheets), info = name)
    expect_true(isTRUE(artifact$checks$checks$xlsx_sheet_min_rows), info = name)
    expect_true(isTRUE(artifact$checks$checks$xlsx_sheet_min_cols), info = name)
    expect_true(isTRUE(artifact$checks$checks$xlsx_required_sections), info = name)
    expect_true(isTRUE(artifact$checks$checks$xlsx_no_missing_parts), info = name)
    expect_identical(openxlsx::getSheetNames(artifact$workbook), unlist(artifact$tab_order, use.names = FALSE))
  }

  territorial_internal <- report$artifacts[["territorial-internal"]]
  occurrences_text <- paste(unlist(openxlsx::read.xlsx(
    territorial_internal$workbook,
    sheet = "Ocurrencias de campo",
    colNames = FALSE,
    skipEmptyRows = FALSE,
    skipEmptyCols = FALSE
  ), use.names = FALSE), collapse = "\n")
  expect_true(grepl("RESUMEN DE OCURRENCIAS", occurrences_text, fixed = TRUE))
  expect_true(grepl("RANKING POR CATEGORÍA", occurrences_text, fixed = TRUE))
  expect_true(grepl("ESTADO POR UMP", occurrences_text, fixed = TRUE))
  expect_false(grepl("Estado\\nSin dato", occurrences_text))
})

test_that("workbook reutiliza tabs precomputadas sin recalcularlas", {
  testthat::skip_if_not_installed("openxlsx")
  fixture <- monitoreo_publish_qa_fixture("territorial")
  tabs <- monitoreo_publication_sheets_tabs(
    fixture$data,
    fixture$config,
    audience = "internal",
    dashboard = fixture$dashboard,
    synced_at = fixture$synced_at
  )
  out <- tempfile(fileext = ".xlsx")

  target_env <- environment(monitoreo_publication_workbook)
  previous <- get("monitoreo_publication_sheets_tabs", envir = target_env)
  was_locked <- bindingIsLocked("monitoreo_publication_sheets_tabs", target_env)
  if (was_locked) unlockBinding("monitoreo_publication_sheets_tabs", target_env)
  assign("monitoreo_publication_sheets_tabs", function(...) stop("tabs should be precomputed", call. = FALSE), envir = target_env)
  if (was_locked) lockBinding("monitoreo_publication_sheets_tabs", target_env)
  on.exit({
    if (bindingIsLocked("monitoreo_publication_sheets_tabs", target_env)) {
      unlockBinding("monitoreo_publication_sheets_tabs", target_env)
    }
    assign("monitoreo_publication_sheets_tabs", previous, envir = target_env)
    if (was_locked) lockBinding("monitoreo_publication_sheets_tabs", target_env)
  }, add = TRUE)

  expect_equal(
    monitoreo_publication_workbook(
      fixture$data,
      fixture$config,
      path = out,
      audience = "internal",
      dashboard = fixture$dashboard,
      synced_at = fixture$synced_at,
      sheets = tabs
    ),
    out
  )
  expect_true(file.exists(out))
  expect_identical(openxlsx::getSheetNames(out), names(tabs))
  checks <- .monitoreo_publish_qa_xlsx_checks(
    out,
    .monitoreo_publish_qa_expected_tabs("territorial", "internal"),
    "internal",
    family = "territorial"
  )
  expect_true(all(vapply(checks, isTRUE, logical(1))))
})

test_that("XLSX marca celdas largas antes de truncamiento silencioso", {
  testthat::skip_if_not_installed("openxlsx")
  trace_unit <- '{"case_key":"ACRDCONTA","evidence_label":"validacion","source":"SurveyMonkey"}'
  long_trace <- paste(rep(trace_unit, 900L), collapse = "")
  original_chars <- nchar(long_trace, type = "chars", allowNA = FALSE)
  tabs <- list(
    Seguimiento = list(
      "SEGUIMIENTO OPERATIVO",
      c("Campo", "Valor"),
      c("Traza interna", long_trace)
    )
  )
  out <- tempfile(fileext = ".xlsx")

  expect_warning(
    monitoreo_publication_workbook_from_tabs(tabs, out, audience = "internal"),
    NA
  )
  values <- unlist(openxlsx::read.xlsx(
    out,
    sheet = "Seguimiento",
    colNames = FALSE,
    skipEmptyRows = FALSE,
    skipEmptyCols = FALSE
  ), use.names = FALSE)
  values <- as.character(values)
  values[is.na(values)] <- ""
  text <- paste(values, collapse = "\n")

  expect_true(grepl("[Truncado para XLSX:", text, fixed = TRUE))
  expect_true(grepl(sprintf("%s caracteres originales", original_chars), text, fixed = TRUE))
  expect_lte(max(nchar(values, type = "chars", allowNA = FALSE)), .monitoreo_xlsx_max_cell_chars())
})

test_that("cache territorial interna conserva tablas comunes", {
  fixture <- monitoreo_publish_qa_fixture("territorial")
  reports <- fixture$dashboard$territorial_reports
  reports$config <- fixture$config

  routes <- .monitoreo_publication_territorial_route_rows_df(reports)
  audit <- .monitoreo_publication_territorial_audit_with_groups(reports, routes)
  quota <- .monitoreo_publication_territorial_ump_quota_df(reports)
  route_blocks <- .monitoreo_publication_gps_route_blocks_df(reports)
  gps <- .monitoreo_publication_gps_df(reports, "internal")
  master <- .monitoreo_publication_territorial_master_df(fixture$data, reports)

  cached_reports <- reports
  cached_reports$.publication_cache <- .monitoreo_publication_territorial_common_cache(reports)

  expect_equal(.monitoreo_publication_territorial_route_rows_df(cached_reports), routes)
  expect_equal(.monitoreo_publication_territorial_audit_with_groups(cached_reports), audit)
  expect_equal(.monitoreo_publication_territorial_ump_quota_df(cached_reports), quota)
  expect_equal(.monitoreo_publication_gps_route_blocks_df(cached_reports), route_blocks)
  expect_equal(.monitoreo_publication_gps_df(cached_reports, "internal"), gps)
  expect_equal(.monitoreo_publication_territorial_master_df(fixture$data, cached_reports), master)
})

test_that("cliente excluye señales internas y el interno preserva operación completa", {
  testthat::skip_if_not_installed("openxlsx")
  out_dir <- tempfile("monitoreo_publish_qa_")
  report <- monitoreo_publish_qa_generate(out_dir = out_dir)
  read_workbook_artifact <- function(name) {
    artifact <- report$artifacts[[name]]
    sheets <- openxlsx::getSheetNames(artifact$workbook)
    paste(vapply(sheets, function(sheet) {
      paste(c(sheet, unlist(openxlsx::read.xlsx(artifact$workbook, sheet = sheet, colNames = FALSE), use.names = FALSE)), collapse = "\n")
    }, character(1)), collapse = "\n")
  }

  territorial_client <- read_workbook_artifact("territorial-client")
  territorial_internal <- read_workbook_artifact("territorial-internal")
  accreditation_client <- read_workbook_artifact("acreditacion-client")
  accreditation_internal <- read_workbook_artifact("acreditacion-internal")
  all_artifacts <- paste(territorial_client, territorial_internal, accreditation_client, accreditation_internal, collapse = "\n")

  expect_false(grepl("TER-RAW|\\+519|GPS y territorio|Casos accionables|Auditoría técnica", territorial_client))
  expect_true(grepl("TER-RAW|\\+519", territorial_internal))
  expect_true(grepl("GPS y territorio", territorial_internal, fixed = TRUE))
  expect_true(grepl("Casos accionables", territorial_internal, fixed = TRUE))

  expect_false(grepl("ACR-RAW|\\+519|Mínimo/meta operativa|Mínimo esperado|Metas internas por actor|Mínimos por actor|Auditoría técnica|Trazabilidad del corte", accreditation_client))
  expect_false(grepl("Recomendación|Diagnóstico|Acción sugerida", accreditation_client))
  expect_false(grepl("Registros del corte|Trazabilidad del corte|Auditoría técnica", accreditation_internal))
  expect_true(grepl("Mínimo esperado", accreditation_internal, fixed = TRUE))
  expect_true(grepl("Mínimos por actor", accreditation_internal, ignore.case = TRUE))
  expect_true(grepl("Avance por canal y responsable", accreditation_internal, ignore.case = TRUE))
  expect_true(grepl("Responsable de carga", accreditation_internal, fixed = TRUE))
  expect_true(grepl("Seguimiento telefónico", accreditation_internal, ignore.case = TRUE))
  expect_false(grepl("hf_|HF_TOKEN|Authorization|Bearer|secret", all_artifacts, ignore.case = TRUE))
})

test_that("Seguimiento interno separa brecha mínima y estados telefónicos", {
  tracking <- data.frame(
    Unidad = c("Egresados", "Estudiantes"),
    Universo = c(270, 180),
    Mínimo = c(160, ""),
    Completas = c(157, 131),
    Parciales = c(5, 3),
    `Rechazos plataforma` = c(0, 0),
    `Rechazos telefónicos` = c(4, 2),
    `Sin respuesta` = c(108, 46),
    check.names = FALSE
  )

  presented <- .monitoreo_publication_accreditation_present_df(
    tracking,
    audience = "internal",
    purpose = "control_seguimiento"
  )

  expect_true("Brecha mínimo" %in% names(presented))
  expect_equal(as.character(presented$`Brecha mínimo`[[1]]), "3")
  expect_equal(as.character(presented$`Brecha mínimo`[[2]]), "")
  expect_equal(as.character(presented$`Rechazos plataforma`[[1]]), "0")
  expect_equal(as.character(presented$`Rechazos telefónicos`[[1]]), "4")
  expect_lt(match("Brecha mínimo", names(presented)), match("Estado", names(presented), nomatch = length(presented) + 1L))
})

test_that("Sheets acreditacion marca Avanzado y reconcilia controles sin pendientes", {
  actors <- data.frame(
    Actor = c("Docentes", "Egresados"),
    Universo = c(53L, 270L),
    Efectivas = c(52L, 163L),
    Parciales = c(0L, 5L),
    Rechazo = c(1L, 0L),
    `Sin respuesta` = c(0L, 102L),
    check.names = FALSE
  )
  summary <- .monitoreo_publication_accreditation_actor_summary_df(actors)
  expect_equal(summary$Estado[summary$Actor == "Docentes"], "Avanzado")
  expect_equal(summary$Estado[summary$Actor == "Egresados"], "En avance")

  controls <- data.frame(
    Unidad = c("Docentes", "Docentes"),
    Variable = c("Tipo de dedicación", "Tipo de dedicación"),
    Valor = c("DTC", "TPA"),
    Universo = c(10L, 43L),
    Efectivas = c(7L, 42L),
    Parciales = c(0L, 0L),
    Rechazos = c(1L, 0L),
    `Sin respuesta` = c(2L, 1L),
    check.names = FALSE
  )
  detail <- .monitoreo_publication_accreditation_control_detail_df(list(
    actors = actors,
    controls = controls
  ))
  expect_equal(as.integer(detail$`Sin respuesta`), c(0L, 0L))
  expect_equal(as.integer(detail$Efectivas), c(9L, 43L))
  expect_equal(as.character(detail$`Avance efectivo`), c("90%", "100%"))
})

test_that("Sheets acreditacion jala responsables de carga y normaliza fechas", {
  responses <- data.frame(
    CodPulso = c("A1", "A2", "A3", "A4", "A5"),
    response_status = c("completed", "completed", "partial", "completed", "completed"),
    date_modified = c(
      "2026-06-01T10:00:00+00:00",
      "2026-06-01 11:00:00",
      "2026-06-02",
      "2026-06-02T13:00:00Z",
      "2026-06-03T14:00"
    ),
    .source_role = rep("respuestas", 5),
    .source_label = c(
      "SurveyMonkey · Estudiantes · Web",
      "SurveyMonkey · Egresados · Telefónico",
      "SurveyMonkey · Docentes · Personalizado",
      "SurveyMonkey · Administrativos · Web",
      "Correo completos · Egresados"
    ),
    .source_id = c("estudiantes-web", "egresados-telefono", "docentes-whatsapp", "administrativos-web", "egresados-correo"),
    collector_id = c("web-estudiantes", "tel-egresados", "wsp-docentes", "web-admin", "correo-egresados"),
    collector_name = c("Web estudiantes", "Llamadas Egresados", "WhatsApp docentes", "Administrativos web", "Correo egresados"),
    collector_type = c("weblink", "phone", "weblink", "weblink", "email"),
    dim_actor = c("Estudiantes", "Egresados", "Docentes", "Administrativos", "Egresados"),
    dim_canal = c("Web", "Telefonico", "WhatsApp", "Web", "Web"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  base <- responses
  base$response_status <- ""
  base$date_modified <- ""
  base$.source_role <- "universo"
  base$.source_label <- paste("Universo", base$dim_actor)
  base$.source_id <- paste0("universo-", seq_len(nrow(base)))
  base$collector_id <- ""
  base$collector_name <- ""
  base$collector_type <- ""
  data <- rbind(base, responses)
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "acreditacion", variant = "multi_actor")
  ), data)
  dashboard <- monitoreo_build_dashboard(data, cfg)

  client_tabs <- monitoreo_publication_sheets_tabs(data, cfg, audience = "client", dashboard = dashboard, synced_at = "2026-06-18T12:00:00-05:00")
  internal_tabs <- monitoreo_publication_sheets_tabs(data, cfg, audience = "internal", dashboard = dashboard, synced_at = "2026-06-18T12:00:00-05:00")
  expect_equal(names(client_tabs), c("Reporte", "Detalle del avance", "Avance por encuesta"))
  expect_equal(names(internal_tabs), c("Resumen", "Producción", "Avance por encuesta", "Seguimiento", "Alertas", "Corte y fuentes"))
  client_channel <- paste(unlist(client_tabs[["Reporte"]], use.names = FALSE), collapse = "\n")
  client_survey <- paste(unlist(client_tabs[["Avance por encuesta"]], use.names = FALSE), collapse = "\n")
  internal_channel <- paste(unlist(internal_tabs[["Avance por encuesta"]], use.names = FALSE), collapse = "\n")
  internal_sources <- paste(unlist(internal_tabs[["Corte y fuentes"]], use.names = FALSE), collapse = "\n")

  expect_true(grepl("Responsable de carga", internal_channel, fixed = TRUE))
  expect_true(grepl("Canal operativo", internal_channel, fixed = TRUE))
  expect_true(grepl("Título / fuente", internal_channel, fixed = TRUE))
  expect_true(grepl("Tipo de responsable", internal_channel, fixed = TRUE))
  expect_true(grepl("Completas", internal_channel, fixed = TRUE))
  expect_true(grepl("Web estudiantes (web-estudiantes)", internal_channel, fixed = TRUE))
  expect_true(grepl("Llamadas Egresados (tel-egresados)", internal_channel, fixed = TRUE))
  expect_true(grepl("WhatsApp docentes (wsp-docentes)", internal_channel, fixed = TRUE))
  expect_true(grepl("Correo egresados (correo-egresados)", internal_channel, fixed = TRUE))
  expect_true(grepl("Enlace web", internal_channel, fixed = TRUE))
  expect_true(grepl("Telefónico", internal_channel, fixed = TRUE))
  expect_true(grepl("Correo electrónico", internal_channel, fixed = TRUE))
  expect_false(grepl("Sin dato|Sin recopilador", internal_channel))

  expect_true(all(vapply(c("2026-06-01", "2026-06-02", "2026-06-03"), function(day) {
    grepl(day, internal_channel, fixed = TRUE)
  }, logical(1))))
  expect_false(grepl("T10:00|T13:00|14:00|\\+00:00|Z", internal_channel))
  expect_true(grepl("Corte publicado", internal_sources, fixed = TRUE))
  expect_true(grepl("\\b2026-06-[0-9]{2}\\b", internal_sources))
  expect_false(grepl("2026-06-18T12:00:00|T[0-9]{2}:[0-9]{2}|\\+00:00|Z", internal_sources))
  expect_true(grepl("Respuestas en el sistema", client_channel, fixed = TRUE))
  expect_true(grepl("Seguimiento de Encuestas", client_channel, fixed = TRUE))
  expect_true(grepl("Avance general", client_channel, fixed = TRUE))
  expect_true(grepl("AVANCE POR RECOPILADOR", client_survey, fixed = TRUE))
  expect_true(grepl("Titulo", client_survey, fixed = TRUE))
  expect_true(grepl("Completas", client_survey, fixed = TRUE))
  expect_false(grepl("collector_id", client_survey))
  expect_true(grepl("Ultima actualizacion", client_channel, fixed = TRUE))
})

test_that("progreso diario acumulado es consistente en artefactos QA", {
  out_dir <- tempfile("monitoreo_publish_qa_")
  report <- monitoreo_publish_qa_generate(out_dir = out_dir)
  for (name in names(report$artifacts)) {
    if (!identical(report$artifacts[[name]]$audience, "client")) next
    model <- jsonlite::fromJSON(report$artifacts[[name]]$sheets_model, simplifyVector = FALSE)
    app_model <- model$app_visual_progress_model %||% list()
    daily <- app_model$daily_progress$rows %||% list()
    cumulative <- app_model$accumulated_progress$rows %||% list()
    expect_gt(length(daily), 0)
    expect_gt(length(cumulative), 0)
    daily_sum <- sum(vapply(daily, function(row) as.numeric(row[["Nuevas UMP efectivas"]] %||% row[["Nuevas efectivas"]] %||% 0), numeric(1)), na.rm = TRUE)
    last_accumulated <- as.numeric(utils::tail(cumulative, 1L)[[1]][["UMP efectivas acumuladas"]] %||% utils::tail(cumulative, 1L)[[1]][["Efectivas acumuladas"]] %||% NA_real_)
    expect_equal(last_accumulated, daily_sum)
  }
})

test_that("Sheets territorial interno expone workbook operativo y no base cruda", {
  fixture <- monitoreo_publish_qa_fixture("territorial")
  tabs <- monitoreo_publication_sheets_tabs(
    fixture$data,
    fixture$config,
    audience = "internal",
    dashboard = fixture$dashboard,
    synced_at = fixture$synced_at
  )
  expect_true(all(c(
    "Manzanas y responsables", "Responsables y rutas", "Cuotas sexo y edad",
    "Cierre de cuotas", "Tabla maestra", "Resumen territorial", "Ritmo diario", "Ocurrencias de campo", "Casos accionables"
  ) %in% names(tabs)))
  expect_equal(names(tabs), c(
    "Portada", "Resumen territorial", "Producción", "Ritmo diario", "Tabla maestra",
    "Manzanas y responsables", "Responsables y rutas", "Cuotas sexo y edad",
    "Cierre de cuotas", "Validación de tiempos", "GPS y territorio", "Ocurrencias de campo",
    "Base técnica", "Auditoría técnica", "Casos accionables", "Anulaciones"
  ))
  expect_false("Fuentes y actualización" %in% names(tabs))
  expect_false(any(c("Cuotas por manzana", "Llenado sexo y edad", "Ocurrencias en campo") %in% names(tabs)))

  text_tab <- function(tab) paste(unlist(tabs[[tab]], use.names = FALSE), collapse = "\n")
  cover_text <- text_tab("Portada")
  expect_true(grepl("Reporte", cover_text, fixed = TRUE))
  expect_true(grepl("Corte de datos", cover_text, fixed = TRUE))
  expect_true(grepl("Cobertura territorial", cover_text, fixed = TRUE))
  expect_true(grepl("Lectura general", cover_text, fixed = TRUE))
  expect_false(grepl("Perfil|territorial_fieldwork|Fecha y hora de generación|Alertas/casos internos|2026-06-18T", cover_text))
  operational_text <- paste(vapply(
    c("Manzanas y responsables", "Responsables y rutas", "Cuotas sexo y edad", "Ocurrencias de campo", "Casos accionables"),
    text_tab,
    character(1)
  ), collapse = "\n")

  expect_true(grepl("RELACIÓN UMP · MANZANAS DE REFERENCIA · RESPONSABLES", text_tab("Manzanas y responsables"), fixed = TRUE))
  expect_true(grepl("UMP titular", operational_text, fixed = TRUE))
  expect_true(grepl("Manzana de referencia", operational_text, fixed = TRUE))
  expect_true(grepl("Reemplazo", operational_text, fixed = TRUE))
  expect_true(grepl("Responsable", text_tab("Manzanas y responsables"), fixed = TRUE))
  expect_false(grepl("Responsable planificado|Responsable observado|Fuente del responsable", text_tab("Manzanas y responsables")))
  expect_true(grepl("Clasificación de tiempo", text_tab("Tabla maestra"), fixed = TRUE))
  expect_true(grepl("Clasificación de GPS", text_tab("Tabla maestra"), fixed = TRUE))
  expect_true(grepl("Longitud", text_tab("Tabla maestra"), fixed = TRUE))
  expect_true(grepl("Latitud", text_tab("Tabla maestra"), fixed = TRUE))
  expect_true(grepl("Altitud", text_tab("Tabla maestra"), fixed = TRUE))
  expect_true(grepl("UUID", text_tab("Tabla maestra"), fixed = TRUE))
  master_header <- tabs[["Tabla maestra"]][[1]]
  expect_true(all(match(c("Sexo", "Clasificación de tiempo", "Clasificación de GPS"), master_header) %in% .monitoreo_sheets_status_columns(master_header)))
  expect_true(grepl("Estado UMP", operational_text, fixed = TRUE))
  expect_true(grepl("Estado cuota", text_tab("Cuotas sexo y edad"), fixed = TRUE))
  expect_true(grepl("Último ingreso", text_tab("Cuotas sexo y edad"), fixed = TRUE))
  expect_false(grepl("Excedida|exceso|Exceso", text_tab("Cuotas sexo y edad")))
  expect_true(grepl("En campo", text_tab("Cuotas sexo y edad"), fixed = TRUE))
  expect_true(grepl("Efectivas (n)", text_tab("Cuotas sexo y edad"), fixed = TRUE))
  expect_true(grepl("Avance (%)", text_tab("Cuotas sexo y edad"), fixed = TRUE))
  expect_true(grepl("Hombre (n)", text_tab("Cuotas sexo y edad"), fixed = TRUE))
  expect_true(grepl("Cuota hombre (n)", text_tab("Cuotas sexo y edad"), fixed = TRUE))
  expect_true(grepl("Mujer (n)", text_tab("Cuotas sexo y edad"), fixed = TRUE))
  expect_true(grepl("Cuota mujer (n)", text_tab("Cuotas sexo y edad"), fixed = TRUE))
  expect_true(grepl("Edad 18-29 (n)", text_tab("Cuotas sexo y edad"), fixed = TRUE))
  expect_true(grepl("Cuota Edad 18-29 (n)", text_tab("Cuotas sexo y edad"), fixed = TRUE))
  expect_true(grepl("Edades hombre", text_tab("Cuotas sexo y edad"), fixed = TRUE))
  expect_true(grepl("Edades mujer", text_tab("Cuotas sexo y edad"), fixed = TRUE))
  expect_false(grepl("Cumple cuota|Criterio cuota|Sexo Hombre observado|Edad 18-29 observado|Obs Hombre 18-29|Marginales de sexo y edad", text_tab("Cuotas sexo y edad")))
  expect_true(grepl("MATRIZ ESPERADA SEXO/EDAD", text_tab("Cuotas sexo y edad"), fixed = TRUE))
  expect_false(grepl("MATRIZ OBSERVADA SEXO/EDAD POR UMP", text_tab("Cuotas sexo y edad"), fixed = TRUE))
  expect_false(grepl("EDADES EXACTAS OBSERVADAS", text_tab("Cuotas sexo y edad"), fixed = TRUE))
  expect_true(grepl("FALTANTES POR CATEGORÍA", text_tab("Cuotas sexo y edad"), fixed = TRUE))
  expect_true(grepl("RESUMEN DE CIERRE POR DISTRITO", text_tab("Cierre de cuotas"), fixed = TRUE))
  expect_true(grepl("UMP POR COMPLETAR PARA CIERRE", text_tab("Cierre de cuotas"), fixed = TRUE))
  expect_true(grepl("Encuestas por completar", text_tab("Cierre de cuotas"), fixed = TRUE))
  expect_true(grepl("Acción para campo", text_tab("Cierre de cuotas"), fixed = TRUE))
  quota_rows <- tabs[["Cuotas sexo y edad"]]
  quota_headers <- .monitoreo_sheets_table_header_rows(quota_rows)
  quota_header_index <- .monitoreo_sheets_filter_header_index("Cuotas sexo y edad", quota_rows, quota_headers)
  quota_header <- quota_rows[[quota_header_index]]
  expect_equal(match("Último ingreso", quota_header), match("UMP titular", quota_header) + 1L)
  fixture_no_audit <- fixture
  fixture_no_audit$dashboard$territorial_reports$response_audit <- list()
  fixture_no_audit$dashboard$territorial_reports$map$points <- list()
  tabs_no_audit <- monitoreo_publication_sheets_tabs(
    fixture_no_audit$data,
    fixture_no_audit$config,
    audience = "internal",
    dashboard = fixture_no_audit$dashboard,
    synced_at = fixture_no_audit$synced_at
  )
  quota_rows_no_audit <- tabs_no_audit[["Cuotas sexo y edad"]]
  quota_header_index_no_audit <- .monitoreo_sheets_filter_header_index(
    "Cuotas sexo y edad",
    quota_rows_no_audit,
    .monitoreo_sheets_table_header_rows(quota_rows_no_audit)
  )
  quota_header_no_audit <- quota_rows_no_audit[[quota_header_index_no_audit]]
  age_male_col <- match("Edades hombre", quota_header_no_audit)
  age_female_col <- match("Edades mujer", quota_header_no_audit)
  cell_at <- function(row, idx) if (length(row) >= idx) row[[idx]] else ""
  age_list_values <- vapply(
    quota_rows_no_audit[(quota_header_index_no_audit + 1L):min(length(quota_rows_no_audit), quota_header_index_no_audit + 6L)],
    function(row) paste(cell_at(row, age_male_col), cell_at(row, age_female_col)),
    character(1)
  )
  expect_true(any(grepl("22|34|51|65", age_list_values)))
  expect_false(all(trimws(age_list_values) %in% c("- -", "-", "")))
  fixture_no_status <- fixture_no_audit
  fixture_no_status$data$advance_valid <- NULL
  fixture_no_status$data$validation_status <- NULL
  fixture_no_status$data$`_status` <- "submitted"
  tabs_no_status <- monitoreo_publication_sheets_tabs(
    fixture_no_status$data,
    fixture_no_status$config,
    audience = "internal",
    dashboard = fixture_no_status$dashboard,
    synced_at = fixture_no_status$synced_at
  )
  quota_rows_no_status <- tabs_no_status[["Cuotas sexo y edad"]]
  quota_header_index_no_status <- .monitoreo_sheets_filter_header_index(
    "Cuotas sexo y edad",
    quota_rows_no_status,
    .monitoreo_sheets_table_header_rows(quota_rows_no_status)
  )
  quota_header_no_status <- quota_rows_no_status[[quota_header_index_no_status]]
  no_status_age_cols <- match(c("Edades hombre", "Edades mujer"), quota_header_no_status)
  no_status_age_values <- vapply(
    quota_rows_no_status[(quota_header_index_no_status + 1L):min(length(quota_rows_no_status), quota_header_index_no_status + 6L)],
    function(row) paste(cell_at(row, no_status_age_cols[[1]]), cell_at(row, no_status_age_cols[[2]])),
    character(1)
  )
  expect_true(any(grepl("22|34|51|65", no_status_age_values)))
  no_status_time <- paste(unlist(tabs_no_status[["Validación de tiempos"]], use.names = FALSE), collapse = "\n")
  no_status_gps <- paste(unlist(tabs_no_status[["GPS y territorio"]], use.names = FALSE), collapse = "\n")
  expect_false(grepl("Sin auditoria de tiempos|Sin respuestas válidas", no_status_time))
  expect_true(grepl("Duración|Clasificación", no_status_time))
  expect_true(grepl("[0-9]{2}:[0-9]{2}:[0-9]{2}", no_status_time))
  expect_true(grepl("Normal|Corto|Muy corto", no_status_time))
  expect_false(grepl("Sin respuestas válidas con datos GPS|El corte no contiene clasificación GPS", no_status_gps))
  expect_true(grepl("Estado GPS por respuesta|GPS parseable|Latitud|Longitud", no_status_gps))
  expect_true(grepl("TARJETAS EJECUTIVAS", text_tab("Resumen territorial"), fixed = TRUE))
  expect_true(grepl("Encuestas válidas", text_tab("Resumen territorial"), fixed = TRUE))
  expect_true(grepl("Cuota pendiente", text_tab("Resumen territorial"), fixed = TRUE))
  expect_true(grepl("UMP pendientes", text_tab("Resumen territorial"), fixed = TRUE))
  expect_true(grepl("UMP no iniciadas", text_tab("Resumen territorial"), fixed = TRUE))
  expect_false(grepl("UMP por aplicar|UMP con exceso|Completa con exceso|Excedida|exceso", text_tab("Resumen territorial")))
  expect_true(grepl("TOTAL", text_tab("Resumen territorial"), fixed = TRUE))
  expect_true(grepl("PRODUCCIÓN POR ENCUESTADOR", text_tab("Resumen territorial"), fixed = TRUE))
  expect_true(grepl("UMP cerradas por titular o reemplazo", text_tab("Resumen territorial"), fixed = TRUE))
  expect_false(grepl("MATRIZ DIARIA POR ESTADO|Estado / Fecha", text_tab("Ritmo diario")))
  expect_true(grepl("UMP FINALIZADAS POR DÍA", text_tab("Ritmo diario"), fixed = TRUE))
  expect_true(grepl("UMP finalizadas en el día", text_tab("Ritmo diario"), fixed = TRUE))
  expect_true(grepl("UMP finalizadas acumuladas", text_tab("Ritmo diario"), fixed = TRUE))
  expect_true(grepl("UMP FINALIZADAS POR DISTRITO", text_tab("Ritmo diario"), fixed = TRUE))
  expect_true(grepl("Distrito / Fecha", text_tab("Ritmo diario"), fixed = TRUE))
  expect_true(grepl("UMP FINALIZADAS POR ENCUESTADOR", text_tab("Ritmo diario"), fixed = TRUE))
  expect_true(grepl("Encuestador / Fecha", text_tab("Ritmo diario"), fixed = TRUE))
  expect_true(grepl("10 Junio", text_tab("Ritmo diario"), fixed = TRUE))
  expect_false(grepl("2026-06-", text_tab("Ritmo diario"), fixed = TRUE))
  expect_true(grepl("RESUMEN DE OCURRENCIAS", text_tab("Ocurrencias de campo"), fixed = TRUE))
  expect_true(grepl("RANKING POR CATEGORÍA", text_tab("Ocurrencias de campo"), fixed = TRUE))
  expect_true(grepl("RITMO DIARIO DE OCURRENCIAS", text_tab("Ocurrencias de campo"), fixed = TRUE))
  expect_true(grepl("QUÉ SE REPORTA CADA DÍA", text_tab("Ocurrencias de campo"), fixed = TRUE))
  expect_true(grepl("REPORTES POR DISTRITO Y DÍA", text_tab("Ocurrencias de campo"), fixed = TRUE))
  expect_true(grepl("ESTADO POR UMP", text_tab("Ocurrencias de campo"), fixed = TRUE))
  occurrence_rows <- tabs[["Ocurrencias de campo"]]
  occurrence_headers <- .monitoreo_sheets_table_header_rows(occurrence_rows)
  occurrence_filter_index <- .monitoreo_sheets_filter_header_index("Ocurrencias de campo", occurrence_rows, occurrence_headers)
  expect_true(all(c("Distrito", "UMP", "Estado", "Reportes") %in% occurrence_rows[[occurrence_filter_index]]))
  expect_true(grepl("ID respuesta", text_tab("GPS y territorio"), fixed = TRUE))
  expect_true(grepl("Estado GPS por respuesta", text_tab("GPS y territorio"), fixed = TRUE))
  expect_true(grepl("Fuera de zona", text_tab("GPS y territorio"), fixed = TRUE))
  expect_true(grepl("Fuera de distrito", text_tab("GPS y territorio"), fixed = TRUE))
  expect_true(grepl("Sin GPS", text_tab("GPS y territorio"), fixed = TRUE))
  expect_false(grepl("Casos con GPS|Casos sin GPS|GPS sospechoso", text_tab("GPS y territorio")))
  expect_false(grepl("Regla aplicada", text_tab("Validación de tiempos"), fixed = TRUE))
  expect_true(grepl("Normal", text_tab("Validación de tiempos"), fixed = TRUE))
  expect_true(grepl("Corto", text_tab("Validación de tiempos"), fixed = TRUE))
  expect_true(grepl("Muy corto", text_tab("Validación de tiempos"), fixed = TRUE))
  expect_false(grepl("Esperada|Larga|Extrema|Sin datos suficientes", text_tab("Validación de tiempos")))
  expect_false(grepl("total_respuestas|avance_pct|geo_ok|duration_p95", text_tab("Resumen territorial")))

  raw_patterns <- "_id|formhub/uuid|gps_inicio|Core/date|Core/E1_age|Core/E2_sex|duration_seconds|\\.source_id"
  expect_false(grepl(raw_patterns, operational_text))
  expect_false(grepl("Acción sugerida|Recomendación|Diagnóstico|Riesgo|Próximo paso", operational_text))

  technical_text <- paste(text_tab("Auditoría técnica"), text_tab("Base técnica"), collapse = "\n")
  expect_true(grepl("gps_inicio", technical_text, fixed = TRUE))
  expect_true(grepl("Core/E1_age", technical_text, fixed = TRUE))
  expect_true(grepl("TER-RAW", technical_text, fixed = TRUE))
})

test_that("Sheets territorial interno muestra vacio factual sin cuota sexo edad", {
  fixture <- monitoreo_publish_qa_fixture("territorial")
  strip_quota <- function(block) {
    block$sex <- list()
    block$age <- list()
    block$sex_age <- list()
    block
  }
  reports <- fixture$dashboard$territorial_reports
  reports$route_blocks <- lapply(reports$route_blocks, strip_quota)
  reports$route_quota_progress$blocks <- lapply(reports$route_quota_progress$blocks, strip_quota)
  fixture$dashboard$territorial_reports <- reports

  tabs <- monitoreo_publication_sheets_tabs(
    fixture$data,
    fixture$config,
    audience = "internal",
    dashboard = fixture$dashboard,
    synced_at = fixture$synced_at
  )
  sex_age_text <- paste(unlist(tabs[["Cuotas sexo y edad"]], use.names = FALSE), collapse = "\n")
  expect_true(grepl("Sin configuración de cuotas sexo/edad", sex_age_text, fixed = TRUE))
})

test_that("Sheets territorial usa UMP titular, cuota 8 y reemplazos sin uso no pendientes", {
  reports <- list(
    config = list(monitoreo_profile = list(family = "territorial")),
    route_quota_progress = list(blocks = list(
      list(distrito = "Distrito 1", zona = "Z1", ump = "UMP-1", manzana = "MZ-1", tipo_manzana = "titular", responsable = "Ana", validas = 8L),
      list(distrito = "Distrito 1", zona = "Z1", ump = "UMP-1R", manzana = "MZ-1R", tipo_manzana = "reemplazo", titular_hoja_num = "UMP-1", titular_manzana = "MZ-1", responsable = "Ana", validas = 0L),
      list(distrito = "Distrito 1", zona = "Z1", ump = "UMP-2", manzana = "MZ-2", tipo_manzana = "titular", responsable = "Bruno", validas = 9L),
      list(distrito = "Distrito 1", zona = "Z1", ump = "UMP-3", manzana = "MZ-3", tipo_manzana = "titular", responsable = "Carla", validas = 0L)
    ))
  )

  quota <- .monitoreo_publication_territorial_quota_df(reports)
  expect_equal(nrow(quota), 4L)
  quota_titular <- quota[quota$Tipo == "Titular", , drop = FALSE]
  quota_replacement <- quota[quota$Tipo == "Reemplazo", , drop = FALSE]
  expect_equal(nrow(quota_titular), 3L)
  expect_equal(quota_titular$`Cuota esperada`[quota_titular$UMP == "UMP-1"], 8L)
  expect_equal(quota_titular$`Estado cuota`[quota_titular$UMP == "UMP-1"], "Completa")
  expect_equal(quota_replacement$`Estado cuota`, "No iniciada")
  expect_equal(quota$`Estado cuota`[quota$UMP == "UMP-2"], "Completa")
  expect_equal(quota$`Cumple cuota`[quota$UMP == "UMP-2"], "Sí")
  expect_equal(quota$`Estado cuota`[quota$UMP == "UMP-3"], "No iniciada")

  routes <- .monitoreo_publication_territorial_routes_df(reports)
  expect_true(any(routes$Tipo == "Reemplazo"))
  expect_true(any(routes$`Estado reemplazo` == "Reemplazo sin uso"))
  expect_true(any(routes$Tipo == "Reemplazo" & routes$`Estado UMP` == "Reemplazo sin uso"))
  titulares <- routes[routes$Tipo == "Titular", , drop = FALSE]
  expect_equal(titulares$`UMP titular`, c("UMP-1", "UMP-2", "UMP-3"))
  expect_equal(titulares$Rango, c("1-8", "9-16", "17-24"))
  expect_equal(routes$Rango[routes$`Estado reemplazo` == "Reemplazo sin uso"], "1-8")

  summary <- .monitoreo_publication_route_summary_df(routes)
  expect_equal(as.integer(summary$Valor[summary$Indicador == "UMP efectivas"]), 2L)
  expect_equal(as.integer(summary$Valor[summary$Indicador == "UMP no iniciadas"]), 1L)
  expect_equal(as.integer(summary$Valor[summary$Indicador == "Reemplazos disponibles"]), 1L)

  responsible <- .monitoreo_publication_responsible_routes_df(reports)
  planned <- .monitoreo_publication_block_df(responsible, "Asignación planificada")
  expect_equal(planned$UMP, c("UMP 1", "UMP 2", "UMP 3"))
  expect_equal(planned$Rango, c("1-8", "9-16", "17-24"))
  expect_true(all(paste("Encuesta", 1:15) %in% names(planned)))
  expect_false("Encuestas extra" %in% names(planned))
  expect_true(all(c("Reemplazos disponibles", "Reemplazos usados", "Reemplazos") %in% names(planned)))
  expect_false("Fuente asignación" %in% names(planned))
  expect_equal(planned$`Encuesta 8`[planned$UMP == "UMP 3"], "Pendiente")
  expect_equal(planned$`Encuesta 9`[planned$UMP == "UMP 3"], "")
  expect_equal(planned$`Encuesta 9`[planned$UMP == "UMP 2"], "Completa")
  expect_equal(planned$`Encuesta 10`[planned$UMP == "UMP 2"], "")
  expect_false("UMP asignadas" %in% names(planned))
  expect_false(any(grepl(" estado$", names(planned), ignore.case = TRUE)))
})

test_that("detalle sexo edad usa responsable planificado cuando no hay registros observados", {
  reports <- list(
    route_quota_progress = list(blocks = list(list(
      distrito = "ATE",
      zona = "001",
      ump = "1",
      manzana = "0390",
      tipo_manzana = "titular",
      responsable = "P298 · Roncal Malpartida Jorge Luis",
      validas = 0L,
      sex = list(
        list(label = "Hombre", target = 4L, achieved = 0L, missing = 4L),
        list(label = "Mujer", target = 4L, achieved = 0L, missing = 4L)
      ),
      age = list(
        list(label = "18-29", target = 2L, achieved = 0L, missing = 2L)
      )
    )))
  )

  detail <- .monitoreo_publication_sex_age_detail_df(reports)
  expect_true(nrow(detail) > 0L)
  expect_true(all(detail$Responsable == "P298 · Roncal Malpartida Jorge Luis"))
  expect_false(any(detail$Responsable == "Sin responsable observado"))
})

test_that("formateo Sheets territorial genera estados, secciones y un filtro por hoja", {
  fixture <- monitoreo_publish_qa_fixture("territorial")
  tabs <- monitoreo_publication_sheets_tabs(
    fixture$data,
    fixture$config,
    audience = "internal",
    dashboard = fixture$dashboard,
    synced_at = fixture$synced_at
  )
  requests <- .monitoreo_sheets_professional_format_requests(123L, "Cuotas sexo y edad", tabs[["Cuotas sexo y edad"]])
  request_text <- jsonlite::toJSON(requests, auto_unbox = TRUE, null = "null")
  gps_requests <- .monitoreo_sheets_professional_format_requests(126L, "GPS y territorio", tabs[["GPS y territorio"]])
  gps_request_text <- jsonlite::toJSON(gps_requests, auto_unbox = TRUE, null = "null")

  expect_true(any(vapply(requests, function(request) !is.null(request$mergeCells), logical(1))))
  expect_true(any(vapply(requests, function(request) !is.null(request$addConditionalFormatRule), logical(1))))
  expect_true(grepl("Completa", request_text, fixed = TRUE))
  expect_false(grepl("Excedida|Con exceso|Exceso", request_text))
  expect_true(grepl("No iniciada", request_text, fixed = TRUE))
  expect_true(grepl("En zona", gps_request_text, fixed = TRUE))
  expect_true(grepl("Fuera de zona", gps_request_text, fixed = TRUE))
  expect_true(grepl("Fuera de distrito", gps_request_text, fixed = TRUE))
  expect_true(grepl("Sin GPS", gps_request_text, fixed = TRUE))
  expect_false(grepl("Lejos|Revisión|Dentro|Cerca", gps_request_text))
  expect_true(grepl("CUSTOM_FORMULA", request_text, fixed = TRUE))
  expect_false(grepl("TEXT_CONTAINS", request_text, fixed = TRUE))
  expect_false(grepl("ISNUMBER", request_text, fixed = TRUE))
  expect_false(grepl("=AND(", request_text, fixed = TRUE))
  expect_true(grepl("*1)&gt;", request_text, fixed = TRUE) || grepl("*1)>", request_text, fixed = TRUE))
  palette <- .monitoreo_sheets_status_palette()
  expect_false(identical(palette$`Cuota pendiente`$bg, palette$`No iniciada`$bg))
  expect_false(identical(palette$`En campo`$bg, palette$`No iniciada`$bg))
  expect_false(identical(palette$`Cuota pendiente`$bg, palette$`En campo`$bg))
  expect_equal(palette$`No iniciada`$bg, "#F3F4F6")
  expect_equal(palette$`No iniciada`$fg, "#4B5563")
  quota_status_summary <- .monitoreo_publication_quota_status_summary_df(data.frame(
    `Estado cuota` = c("Completa", "En campo", "Cuota pendiente", "No iniciada"),
    check.names = FALSE
  ))
  expect_equal(quota_status_summary$`Estado cuota`, c("Completas", "Subsanadas", "En campo", "Cuota pendiente", "No iniciada"))
  expect_false(any(quota_status_summary$`Estado cuota` %in% c("Falta cuota", "Pendiente")))
  expect_equal(.monitoreo_publication_date_label_scalar("2026-06-16"), "16 Junio")
  expect_equal(.monitoreo_publication_latest_date_label(c("15 Junio", "2026-06-16", "14 de Junio")), "16 Junio")
  expect_lte(sum(vapply(requests, function(request) !is.null(request$setBasicFilter), logical(1))), 1L)
  expect_true(any(vapply(requests, function(request) !is.null(request$repeatCell$cell$userEnteredFormat$numberFormat), logical(1))))
  quota_rows <- tabs[["Cuotas sexo y edad"]]
  quota_headers <- .monitoreo_sheets_table_header_rows(quota_rows)
  quota_header_index <- .monitoreo_sheets_filter_header_index("Cuotas sexo y edad", quota_rows, quota_headers)
  expect_true("Estado cuota" %in% quota_rows[[quota_header_index]])
  expect_true("Último ingreso" %in% quota_rows[[quota_header_index]])
  expect_false(any(c("Cumple cuota", "Criterio cuota") %in% quota_rows[[quota_header_index]]))
  manzana_col <- match("Manzana", quota_rows[[quota_header_index]])
  manzana_widths <- vapply(requests, function(request) {
    range <- request$updateDimensionProperties$range %||% list()
    if (!identical(range$dimension, "COLUMNS") || !isTRUE(range$startIndex == manzana_col - 1L)) return(NA_integer_)
    as.integer(request$updateDimensionProperties$properties$pixelSize %||% NA_integer_)
  }, integer(1))
  expect_true(any(manzana_widths <= 95L, na.rm = TRUE))
  expect_false(any(vapply(requests, function(request) !is.null(request$autoResizeDimensions), logical(1))))

  route_rows <- tabs[["Manzanas y responsables"]]
  route_headers <- .monitoreo_sheets_table_header_rows(route_rows)
  route_header_index <- .monitoreo_sheets_filter_header_index("Manzanas y responsables", route_rows, route_headers)
  expect_true(is.finite(route_header_index))
  expect_true("Tipo" %in% route_rows[[route_header_index]])
  route_requests <- .monitoreo_sheets_professional_format_requests(124L, "Manzanas y responsables", route_rows)
  route_filters <- Filter(function(request) !is.null(request$setBasicFilter), route_requests)
  expect_length(route_filters, 1L)
  route_filter_range <- route_filters[[1]]$setBasicFilter$filter$range
  expect_equal(route_filter_range$startRowIndex, route_header_index - 1L)
  expect_gte(route_filter_range$endColumnIndex, match("Tipo", route_rows[[route_header_index]]))
  route_last_activity_col <- match("Última actividad", route_rows[[route_header_index]])
  expect_true(is.finite(route_last_activity_col))
  route_last_activity <- vapply(route_rows[(route_header_index + 1L):length(route_rows)], function(row) {
    if (length(row) >= route_last_activity_col) row[[route_last_activity_col]] else ""
  }, character(1))
  route_last_activity <- route_last_activity[nzchar(route_last_activity)]
  expect_true(any(grepl("Junio", route_last_activity, fixed = TRUE)))
  expect_false(any(grepl("^\\d{4}-\\d{2}-\\d{2}", route_last_activity)))

  responsible_rows <- tabs[["Responsables y rutas"]]
  responsible_headers <- .monitoreo_sheets_table_header_rows(responsible_rows)
  responsible_header_index <- .monitoreo_sheets_filter_header_index("Responsables y rutas", responsible_rows, responsible_headers)
  expect_true("UMP" %in% responsible_rows[[responsible_header_index]])
  responsible_header <- responsible_rows[[responsible_header_index]]
  expect_true(all(paste("Encuesta", 1:15) %in% responsible_header))
  expect_false("Encuestas extra" %in% responsible_rows[[responsible_header_index]])
  expect_true(all(c("Reemplazos disponibles", "Reemplazos usados", "Reemplazos") %in% responsible_header))
  expect_false("Fuente asignación" %in% responsible_header)
  expect_false("UMP asignadas" %in% responsible_rows[[responsible_header_index]])
  expect_lt(match("Estado UMP", responsible_header), match("Última actividad", responsible_header))
  expect_equal(match("Última actividad", responsible_header) + 1L, match("Encuesta 1", responsible_header))
  responsible_filters <- Filter(function(request) !is.null(request$setBasicFilter), .monitoreo_sheets_professional_format_requests(125L, "Responsables y rutas", responsible_rows))
  expect_length(responsible_filters, 1L)
  expect_equal(responsible_filters[[1]]$setBasicFilter$filter$range$startRowIndex, responsible_header_index - 1L)
  responsible_last_activity_col <- match("Última actividad", responsible_rows[[responsible_header_index]])
  expect_true(is.finite(responsible_last_activity_col))
  responsible_last_activity <- vapply(responsible_rows[(responsible_header_index + 1L):length(responsible_rows)], function(row) {
    if (length(row) >= responsible_last_activity_col) row[[responsible_last_activity_col]] else ""
  }, character(1))
  responsible_last_activity <- responsible_last_activity[nzchar(responsible_last_activity)]
  expect_true(any(grepl("Junio", responsible_last_activity, fixed = TRUE)))
  expect_false(any(grepl("^\\d{4}-\\d{2}-\\d{2}", responsible_last_activity)))
})

test_that("formateo Sheets no genera rangos vacios en tablas operativas sin filas", {
  rows <- list(
    c("CASOS ACCIONABLES"),
    c("Prioridad", "Estado", "Acción", "Cantidad")
  )
  requests <- .monitoreo_sheets_professional_format_requests(456L, "Casos accionables", rows)
  ranges <- list()
  collect_ranges <- function(node) {
    if (!is.list(node)) return(invisible(NULL))
    if (all(c("startRowIndex", "endRowIndex") %in% names(node))) {
      ranges[[length(ranges) + 1L]] <<- node
    }
    lapply(node, collect_ranges)
    invisible(NULL)
  }
  collect_ranges(requests)
  empty_ranges <- Filter(function(range) {
    row_empty <- !is.null(range$startRowIndex) && !is.null(range$endRowIndex) && range$startRowIndex >= range$endRowIndex
    col_empty <- !is.null(range$startColumnIndex) && !is.null(range$endColumnIndex) && range$startColumnIndex >= range$endColumnIndex
    isTRUE(row_empty) || isTRUE(col_empty)
  }, ranges)

  expect_length(empty_ranges, 0L)
  expect_true(any(vapply(requests, function(request) !is.null(request$setBasicFilter), logical(1))))
  expect_false(any(vapply(requests, function(request) !is.null(request$addConditionalFormatRule), logical(1))))
  expect_false(any(vapply(requests, function(request) !is.null(request$repeatCell$cell$userEnteredFormat$numberFormat), logical(1))))
})
