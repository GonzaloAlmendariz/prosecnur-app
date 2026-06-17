sm_wb_test_xlsx <- function(sheets) {
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  for (sheet_name in names(sheets)) {
    openxlsx::addWorksheet(wb, sheet_name)
    openxlsx::writeData(wb, sheet_name, sheets[[sheet_name]])
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

sm_wb_test_inst <- function() {
  list(
    survey = data.frame(
      type = c(
        "select_one yesno",
        "integer",
        "text",
        "text",
        "text",
        "select_one sexo",
        "select_multiple estudios",
        "note",
        "select_one escala",
        "select_one escala",
        "note",
        "text",
        "text"
      ),
      name = c("p1", "p2", "p3", "p4", "p5", "p6", "p7", "nota_p13", "p13_1", "p13_2", "nota_p24", "p24_1", "p24_2"),
      label = c(
        "Acepta participar?",
        "Edad:",
        "Correo",
        "Código PUCP",
        "Celular",
        "Sexo",
        "Estudios realizados",
        "Evalúe la utilidad",
        "Claridad",
        "Aplicabilidad",
        "¿Cuál es su función principal?",
        "Función 1:",
        "Función 2:"
      ),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c(
        "yesno", "yesno",
        "sexo", "sexo",
        "estudios", "estudios",
        "escala", "escala"
      ),
      name = c("1", "0", "1", "2", "bach", "maest", "5", "1"),
      label = c("Sí", "No", "Hombre", "Mujer", "Bachiller", "Maestría", "Muy útil", "Nada útil"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
}

sm_wb_test_sheet <- function(n = 2L) {
  data.frame(
    "Response ID" = seq_len(n) + 1000L,
    "Date Created" = rep("2026-05-27 10:00:00", n),
    "Response Status" = rep("Completed", n),
    "Collector ID" = rep("collector-a", n),
    "id" = paste0("CV", seq_len(n)),
    "Acepta participar?" = rep("Sí", n),
    "Edad:" = 20L + seq_len(n),
    "Sexo" = c("Hombre", "Mujer")[seq_len(n)],
    "Estudios realizados | Bachiller" = c("Sí", ""),
    "Estudios realizados | Maestría" = c("", "Sí"),
    "Evalúe la utilidad | Claridad" = rep("Muy útil", n),
    "Evalúe la utilidad | Aplicabilidad" = rep("Nada útil", n),
    "¿Cuál es su función principal? | Función 1:" = paste0("Rol ", seq_len(n)),
    check.names = FALSE
  )
}

test_that("workbook SurveyMonkey traduce headers humanos a columnas XLSForm", {
  inst <- sm_wb_test_inst()
  converted <- .sm_wb_convert_sheet_data(
    sm_wb_test_sheet(2L),
    inst,
    base_name = "ingenieria_industrial",
    base_meta = list(survey_id = "survey-a", source_alias = "Ingeniería Industrial"),
    sheet_name = "Industrial"
  )

  out <- converted$data
  audit <- converted$audit
  expect_equal(nrow(out), 2L)
  expect_equal(out$response_id, c("1001", "1002"))
  expect_equal(out$cv_id, c("CV1", "CV2"))
  expect_equal(out$p1, c("1", "1"))
  expect_equal(out$p6, c("1", "2"))
  expect_equal(out$p7, c("bach", "maest"))
  expect_equal(out$p13_1, c("5", "5"))
  expect_equal(out$p13_2, c("1", "1"))
  expect_equal(out$p24_1, c("Rol 1", "Rol 2"))
  expect_true(all(c("p3", "p4", "p5") %in% names(out)))
  expect_true(all(c("p3", "p4", "p5") %in% unlist(audit$missing_variables, use.names = FALSE)))
  expect_true(any(grepl("se completaron vacías", unlist(audit$warnings, use.names = FALSE), fixed = TRUE)))
})

test_that("workbook SurveyMonkey trata errores de Excel como faltantes auditables", {
  inst <- sm_wb_test_inst()
  sheet <- sm_wb_test_sheet(2L)
  sheet[["Edad:"]][[1]] <- "#REF!"

  converted <- .sm_wb_convert_sheet_data(
    sheet,
    inst,
    base_name = "ingenieria_industrial",
    base_meta = list(survey_id = "survey-a", source_alias = "Ingeniería Industrial"),
    sheet_name = "Industrial"
  )

  out <- converted$data
  audit <- converted$audit
  expect_true(is.na(out$p2[[1]]))
  expect_equal(as.character(out$p2[[2]]), "22")
  expect_equal(audit$n_cell_errors, 1L)
  expect_equal(audit$cell_errors[[1]]$source, "Edad:")
  expect_equal(audit$cell_errors[[1]]$variable, "p2")
  expect_true(any(grepl("errores de Excel", unlist(audit$warnings, use.names = FALSE), fixed = TRUE)))
})

test_that("workbook multibase reemplaza data y preserva XLSForm en proyecto reabrible", {
  sid <- session_create()
  estudio_set_processing_mode(sid, "independent_siblings")
  inst <- sm_wb_test_inst()
  xls_path <- sm_wb_test_xlsx(list(
    survey = inst$survey,
    choices = inst$choices,
    settings = data.frame(form_title = "Industrial", form_id = "industrial")
  ))
  old_data <- data.frame(p1 = "0", p2 = "99", p3 = "old", p4 = "old", p5 = "old", stringsAsFactors = FALSE)
  old_data_path <- sm_wb_test_xlsx(list(datos = old_data))
  xmeta <- save_upload(sid, "xlsform", "industrial_xlsform.xlsx", readBin(xls_path, "raw", n = file.info(xls_path)$size))
  dmeta <- save_upload(sid, "data", "industrial_data.xlsx", readBin(old_data_path, "raw", n = file.info(old_data_path)$size))
  rp_inst <- reporte_instrumento(path = xmeta$path)
  rp_data <- reporte_data(old_data, instrumento = rp_inst)
  estudio_add_base(
    sid,
    "ingenieria_industrial",
    xmeta$file_id,
    dmeta$file_id,
    "xlsx",
    rp_data,
    rp_inst,
    n_filas = nrow(old_data),
    n_columnas = ncol(old_data),
    extra_meta = list(
      processing_mode = "independent_siblings",
      source_alias = "Ingeniería Industrial",
      survey_id = "527"
    )
  )

  workbook_path <- sm_wb_test_xlsx(list(Industrial = sm_wb_test_sheet(2L)))
  wb_meta <- save_upload(sid, "data", "Base Cliente.xlsx", readBin(workbook_path, "raw", n = file.info(workbook_path)$size))
  inspection <- sm_multibase_workbook_inspect(sid, wb_meta$file_id)
  expect_true(inspection$ok)
  expect_equal(inspection$n_sheets, 1L)
  expect_equal(inspection$n_matched, 1L)

  imported <- sm_multibase_workbook_import(sid, wb_meta$file_id)
  expect_true(imported$ok)
  s <- session_get(sid)
  base <- s$estudio$bases$ingenieria_industrial
  expect_equal(base$source_kind, "surveymonkey_workbook")
  expect_equal(base$surveymonkey_workbook_file_id, wb_meta$file_id)
  expect_true(nzchar(base$surveymonkey_workbook_snapshot_file_id))
  expect_true(nzchar(base$surveymonkey_effective_data_file_id))
  expect_equal(base$xlsform_file_id, xmeta$file_id)
  expect_equal(base$n_filas, 2L)
  expect_true(base$n_columnas >= 20L)
  imported_df <- as.data.frame(.read_data_any_path(get_file(sid, base$data_file_id)$path, "xlsx"))
  expect_equal(as.character(imported_df$p7), c("bach", "maest"))

  tmp <- tempfile(fileext = ".pulso")
  build_pulso(sid, tmp, project_name = "Workbook Offline")
  loaded <- load_pulso(tmp)
  loaded_base <- session_get(loaded$session_id)$estudio$bases$ingenieria_industrial
  expect_equal(loaded_base$source_kind, "surveymonkey_workbook")
  expect_true(nzchar(loaded_base$surveymonkey_workbook_snapshot_file_id))
})
