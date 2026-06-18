source("setup-load-all.R")

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

test_that("QA de publicaciones genera Spaces y XLSX separados por familia y audiencia", {
  testthat::skip_if_not_installed("openxlsx")
  out_dir <- tempfile("monitoreo_publish_qa_")
  report <- monitoreo_publish_qa_generate(out_dir = out_dir)

  expect_true(isTRUE(report$ok))
  expect_named(
    report$artifacts,
    c("territorial-client", "territorial-internal", "acreditacion-client", "acreditacion-internal")
  )

  for (name in names(report$artifacts)) {
    artifact <- report$artifacts[[name]]
    expect_true(file.exists(artifact$space_index), info = name)
    expect_true(file.exists(artifact$workbook), info = name)
    expect_true(isTRUE(artifact$checks$ok), info = name)
    expect_true(isTRUE(artifact$checks$checks$space_has_app_shell), info = name)
    expect_true(isTRUE(artifact$checks$checks$space_has_section_navigation), info = name)
    expect_true(isTRUE(artifact$checks$checks$space_has_section_cards), info = name)
    expect_true(isTRUE(artifact$checks$checks$space_has_table_search), info = name)
    expect_true(isTRUE(artifact$checks$checks$space_has_table_reset), info = name)
    expect_true(isTRUE(artifact$checks$checks$space_has_status_chips), info = name)
    expect_true(isTRUE(artifact$checks$checks$space_has_interaction_script), info = name)
    expect_true(isTRUE(artifact$checks$checks$space_has_plotly_like_daily_chart), info = name)
    expect_true(isTRUE(artifact$checks$checks$daily_progress_exists), info = name)
    expect_true(isTRUE(artifact$checks$checks$cumulative_progress_ok), info = name)
    expect_true(isTRUE(artifact$checks$checks$xlsx_has_freeze), info = name)
    expect_true(isTRUE(artifact$checks$checks$xlsx_has_filter), info = name)
    expect_identical(openxlsx::getSheetNames(artifact$workbook), unlist(artifact$tab_order, use.names = FALSE))
  }
})

test_that("cliente excluye señales internas y el interno preserva operación completa", {
  testthat::skip_if_not_installed("openxlsx")
  out_dir <- tempfile("monitoreo_publish_qa_")
  report <- monitoreo_publish_qa_generate(out_dir = out_dir)
  read_artifact <- function(name) {
    artifact <- report$artifacts[[name]]
    paste(
      readLines(artifact$space_index, warn = FALSE),
      readLines(file.path(artifact$space_dir, "publication_model.json"), warn = FALSE),
      collapse = "\n"
    )
  }

  territorial_client <- read_artifact("territorial-client")
  territorial_internal <- read_artifact("territorial-internal")
  accreditation_client <- read_artifact("acreditacion-client")
  accreditation_internal <- read_artifact("acreditacion-internal")
  all_spaces <- paste(territorial_client, territorial_internal, accreditation_client, accreditation_internal, collapse = "\n")

  expect_false(grepl("TER-RAW|\\+519|GPS y territorio|Casos accionables|Auditoría técnica", territorial_client))
  expect_true(grepl("TER-RAW|\\+519", territorial_internal))
  expect_true(grepl("GPS y territorio", territorial_internal, fixed = TRUE))
  expect_true(grepl("Casos accionables", territorial_internal, fixed = TRUE))

  expect_false(grepl("ACR-RAW|\\+519|Mínimo/meta operativa|Metas internas por actor|Auditoría técnica", accreditation_client))
  expect_false(grepl("Recomendación|Diagnóstico|Acción sugerida", accreditation_client))
  expect_true(grepl("ACR-RAW|\\+519", accreditation_internal))
  expect_true(grepl("Mínimo/meta operativa", accreditation_internal, fixed = TRUE))
  expect_true(grepl("Metas internas por actor", accreditation_internal, fixed = TRUE))
  expect_false(grepl("hf_|HF_TOKEN|Authorization|Bearer|secret", all_spaces, ignore.case = TRUE))
})

test_that("progreso diario acumulado es consistente en artefactos QA", {
  out_dir <- tempfile("monitoreo_publish_qa_")
  report <- monitoreo_publish_qa_generate(out_dir = out_dir)
  for (name in names(report$artifacts)) {
    model <- jsonlite::fromJSON(file.path(report$artifacts[[name]]$space_dir, "publication_model.json"), simplifyVector = FALSE)
    daily <- model$daily_progress$daily_effective
    cumulative <- model$daily_progress$cumulative_effective
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
    "Tabla maestra", "Resumen territorial", "Ritmo diario", "Ocurrencias de campo"
  ) %in% names(tabs)))
  expect_equal(names(tabs)[seq_len(3L)], c("Portada", "Tabla maestra", "Resumen territorial"))
  expect_false("Fuentes y actualización" %in% names(tabs))
  expect_false("Casos accionables" %in% names(tabs))
  expect_false(any(c("Cuotas por manzana", "Llenado sexo y edad", "Ocurrencias en campo") %in% names(tabs)))

  text_tab <- function(tab) paste(unlist(tabs[[tab]], use.names = FALSE), collapse = "\n")
  operational_text <- paste(vapply(
    c("Manzanas y responsables", "Responsables y rutas", "Cuotas sexo y edad", "Ocurrencias de campo"),
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
  quota_rows <- tabs[["Cuotas sexo y edad"]]
  quota_headers <- .monitoreo_sheets_table_header_rows(quota_rows)
  quota_header_index <- .monitoreo_sheets_filter_header_index("Cuotas sexo y edad", quota_rows, quota_headers)
  quota_header <- quota_rows[[quota_header_index]]
  expect_equal(match("Último ingreso", quota_header), match("Manzana", quota_header) + 1L)
  expect_true(grepl("TARJETAS EJECUTIVAS", text_tab("Resumen territorial"), fixed = TRUE))
  expect_true(grepl("Efectivas poblacionales", text_tab("Resumen territorial"), fixed = TRUE))
  expect_true(grepl("UMP falta cuota", text_tab("Resumen territorial"), fixed = TRUE))
  expect_true(grepl("UMP pendientes", text_tab("Resumen territorial"), fixed = TRUE))
  expect_false(grepl("UMP por aplicar|UMP con exceso|UMP no iniciadas|Completa con exceso|Excedida|exceso", text_tab("Resumen territorial")))
  expect_true(grepl("TOTAL", text_tab("Resumen territorial"), fixed = TRUE))
  expect_true(grepl("PRODUCCIÓN POR ENCUESTADOR", text_tab("Resumen territorial"), fixed = TRUE))
  expect_true(grepl("UMP completas cumpliendo cuota", text_tab("Resumen territorial"), fixed = TRUE))
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
  expect_equal(nrow(quota), 3L)
  expect_equal(quota$`Cuota esperada`[quota$UMP == "UMP-1"], 8L)
  expect_equal(quota$`Estado cuota`[quota$UMP == "UMP-1"], "Completa")
  expect_equal(quota$`Estado cuota`[quota$UMP == "UMP-2"], "Completa")
  expect_equal(quota$`Cumple cuota`[quota$UMP == "UMP-2"], "Sí")
  expect_equal(quota$`Estado cuota`[quota$UMP == "UMP-3"], "No iniciada")

  routes <- .monitoreo_publication_territorial_routes_df(reports)
  expect_true(any(routes$Tipo == "Reemplazo sin uso"))
  expect_false(any(routes$Tipo == "Reemplazo sin uso" & routes$`Estado UMP` == "No iniciada"))
  titulares <- routes[routes$Tipo == "Titular", , drop = FALSE]
  expect_equal(titulares$`UMP titular`, c("UMP-1", "UMP-2", "UMP-3"))
  expect_equal(titulares$Rango, c("1-8", "9-16", "17-24"))
  expect_equal(routes$Rango[routes$Tipo == "Reemplazo sin uso"], "1-8")

  summary <- .monitoreo_publication_route_summary_df(routes)
  expect_equal(as.integer(summary$Valor[summary$Indicador == "UMP completas"]), 2L)
  expect_equal(as.integer(summary$Valor[summary$Indicador == "UMP no iniciadas"]), 1L)
  expect_equal(as.integer(summary$Valor[summary$Indicador == "Reemplazos disponibles"]), 1L)

  responsible <- .monitoreo_publication_responsible_routes_df(reports)
  planned <- .monitoreo_publication_block_df(responsible, "Asignación planificada")
  expect_equal(planned$UMP, c("UMP-1", "UMP-2", "UMP-3"))
  expect_equal(planned$Rango, c("1-8", "9-16", "17-24"))
  expect_true(all(paste("Encuesta", 1:8) %in% names(planned)))
  expect_false("Encuestas extra" %in% names(planned))
  expect_equal(planned$`Encuesta 8`[planned$UMP == "UMP-3"], "Pendiente")
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

  expect_true(any(vapply(requests, function(request) !is.null(request$mergeCells), logical(1))))
  expect_true(any(vapply(requests, function(request) !is.null(request$addConditionalFormatRule), logical(1))))
  expect_true(grepl("Completa", request_text, fixed = TRUE))
  expect_false(grepl("Excedida|Con exceso|Exceso", request_text))
  expect_true(grepl("No iniciada", request_text, fixed = TRUE))
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
  expect_equal(quota_status_summary$`Estado cuota`, c("Completas", "En campo", "Cuota pendiente", "No iniciada"))
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
  expect_true(all(paste("Encuesta", 1:8) %in% responsible_rows[[responsible_header_index]]))
  expect_false("Encuestas extra" %in% responsible_rows[[responsible_header_index]])
  expect_false("UMP asignadas" %in% responsible_rows[[responsible_header_index]])
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
