sm_sav_test_xlsx <- function(sheets) {
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  for (sheet_name in names(sheets)) {
    openxlsx::addWorksheet(wb, sheet_name)
    openxlsx::writeData(wb, sheet_name, sheets[[sheet_name]])
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

sm_sav_test_inst <- function() {
  list(
    survey = data.frame(
      type = c(
        "select_one yesno",
        "integer",
        "text",
        "select_multiple estudios",
        "select_one escala",
        "text"
      ),
      name = c("p1", "p2", "p3", "p7", "p13", "p24_1"),
      list_name = c("yesno", NA, NA, "estudios", "escala", NA),
      label = c(
        "Acepta participar?",
        "Edad:",
        "Correo",
        "Estudios realizados",
        "Evalúe la utilidad",
        "Función 1:"
      ),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("yesno", "yesno", "estudios", "estudios", "escala", "escala"),
      name = c("1", "2", "bach", "maest", "1", "2"),
      label = c("Sí", "No", "Bachiller", "Maestría", "Bajo", "Alto"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
}

sm_sav_test_zip <- function(files) {
  zip_path <- tempfile(fileext = ".zip")
  tmp_dir <- tempfile("sm_sav_zip_")
  dir.create(tmp_dir, recursive = TRUE)
  old <- setwd(tmp_dir)
  on.exit({
    setwd(old)
    unlink(tmp_dir, recursive = TRUE, force = TRUE)
  }, add = TRUE)
  rel_files <- character(0)
  for (nm in names(files)) {
    rel <- file.path("Bases finales", nm)
    dir.create(dirname(rel), recursive = TRUE, showWarnings = FALSE)
    haven::write_sav(files[[nm]], rel)
    rel_files <- c(rel_files, rel)
  }
  zip::zipr(zipfile = zip_path, files = rel_files)
  zip_path
}

sm_sav_test_raw <- function() {
  data.frame(
    respondent_id = c("R-1", "R-2"),
    collector_id = c("COL-A", "COL-A"),
    response_status = c("completed", "completed"),
    q0001 = haven::labelled(c(1, 2), labels = c("Sí" = 1, "No" = 2)),
    q0002 = c(31, 32),
    q0007_0001 = haven::labelled(c(1, NA), labels = c("Bachiller" = 1)),
    q0007_0002 = haven::labelled(c(NA, 1), labels = c("Maestría" = 1)),
    q0013_0001 = haven::labelled(c(2, 1), labels = c("Bajo" = 1, "Alto" = 2)),
    q0024_0001 = c("Rol A", "Rol B"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

test_that("ZIP SAV matchea nombres acentuados/problematicos a bases existentes", {
  base_names <- c(
    "ingenieria_civil",
    "ingenieria_electronica",
    "ingenieria_geologica",
    "ingenieria_industrial",
    "ingenieria_informatica",
    "ingenieria_mecanica",
    "ingenieria_mecatronica",
    "ingenieria_de_minas",
    "ingenieria_de_las_telecomunicaciones"
  )
  labels <- c(
    "Ingeniería Civil",
    "Ingeniería Electrónica",
    "Ingeniería Geológica",
    "Ingeniería Industrial",
    "Ingeniería Informática",
    "Ingeniería Mecánica",
    "Ingeniería Mecatrónica",
    "Ingeniería de Minas",
    "Ingeniería de las Telecomunicaciones"
  )
  bases <- stats::setNames(
    lapply(seq_along(base_names), function(i) list(nombre = base_names[[i]], source_alias = labels[[i]])),
    base_names
  )
  files <- c(
    "Bases finales/Revisión Civil.sav",
    "Bases finales/Revisión Electrónica.sav",
    "Bases finales/Revisión Geológica.sav",
    "Bases finales/Revisión Industrial.sav",
    "Bases finales/Revisión Informativa.sav",
    "Bases finales/Revisión Mecánica.sav",
    "Bases finales/Revisión Mecatrónica.sav",
    "Bases finales/Revisión Minas.sav",
    "Bases finales/Revisión Telecomunicaciones.sav"
  )

  mapped <- vapply(files, .sm_sav_match_entry_to_base, character(1), bases = bases, explicit_map = list())

  expect_equal(unname(mapped), base_names)
})

test_that("SAV SurveyMonkey normaliza metadata, select_multiple, matrices y faltantes", {
  inst <- sm_sav_test_inst()
  converted <- .sm_sav_convert_entry_data(
    sm_sav_test_raw(),
    inst,
    base_name = "ingenieria_industrial",
    base_meta = list(survey_id = "527", source_alias = "Ingeniería Industrial"),
    entry_name = "Bases finales/Revisión Industrial.sav"
  )
  out <- converted$data
  audit <- converted$audit

  expect_equal(nrow(out), 2L)
  expect_equal(out$response_id, c("R-1", "R-2"))
  expect_equal(out$collector_id, c("COL-A", "COL-A"))
  expect_equal(as.numeric(out$p1), c(1, 2))
  expect_equal(as.character(out$p7), c("bach", "maest"))
  expect_equal(as.character(out$p13), c("2", "1"))
  expect_equal(out$p24_1, c("Rol A", "Rol B"))
  expect_true("p3" %in% names(out))
  expect_true("p3" %in% unlist(audit$missing_variables, use.names = FALSE))
  expect_true(any(grepl("se completaron vacías", unlist(audit$warnings, use.names = FALSE), fixed = TRUE)))
})

test_that("ZIP SAV inspecciona sin mutar e importa reemplazando data y preservando XLSForm", {
  sid <- session_create()
  estudio_set_processing_mode(sid, "independent_siblings")
  inst <- sm_sav_test_inst()
  xls_path <- sm_sav_test_xlsx(list(
    survey = inst$survey,
    choices = inst$choices,
    settings = data.frame(form_title = "Industrial", form_id = "industrial")
  ))
  old_data <- data.frame(p1 = "2", p2 = 99, p3 = "old", stringsAsFactors = FALSE)
  old_data_path <- sm_sav_test_xlsx(list(datos = old_data))
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

  zip_path <- sm_sav_test_zip(list("Revisión Industrial.sav" = sm_sav_test_raw()))
  zip_meta <- save_upload(sid, "sav_bundle", "Bases finales.zip", readBin(zip_path, "raw", n = file.info(zip_path)$size))
  before <- session_get(sid)$estudio$bases$ingenieria_industrial
  inspection <- sm_multibase_sav_bundle_inspect(sid, zip_meta$file_id)
  after_inspection <- session_get(sid)$estudio$bases$ingenieria_industrial

  expect_true(inspection$ok)
  expect_equal(inspection$n_files, 1L)
  expect_equal(inspection$n_matched, 1L)
  expect_equal(inspection$files[[1]]$action, "replace_data")
  expect_equal(inspection$files[[1]]$change_plan$effects$xlsform, "preserved")
  expect_equal(inspection$files[[1]]$change_plan$effects$data, "replaced")
  expect_equal(after_inspection$data_file_id, before$data_file_id)

  imported <- sm_multibase_sav_bundle_import(sid, zip_meta$file_id)
  expect_true(imported$ok)
  expect_equal(imported$imported_bases, 1L)

  s <- session_get(sid)
  base <- s$estudio$bases$ingenieria_industrial
  expect_equal(base$source_kind, "surveymonkey_sav_bundle")
  expect_equal(base$xlsform_file_id, xmeta$file_id)
  expect_equal(base$surveymonkey_sav_bundle_file_id, zip_meta$file_id)
  expect_true(nzchar(base$surveymonkey_sav_bundle_snapshot_file_id))
  expect_true(nzchar(base$surveymonkey_effective_data_file_id))
  expect_false(identical(base$data_file_id, dmeta$file_id))
  expect_equal(base$n_filas, 2L)

  imported_df <- as.data.frame(.read_data_any_path(get_file(sid, base$data_file_id)$path, "xlsx"))
  expect_equal(as.character(imported_df$p7), c("bach", "maest"))
  expect_equal(as.character(imported_df$p24_1), c("Rol A", "Rol B"))

  tmp <- tempfile(fileext = ".pulso")
  build_pulso(sid, tmp, project_name = "SAV Bundle Offline")
  loaded <- load_pulso(tmp)
  loaded_base <- session_get(loaded$session_id)$estudio$bases$ingenieria_industrial
  expect_equal(loaded_base$source_kind, "surveymonkey_sav_bundle")
  expect_true(nzchar(loaded_base$surveymonkey_sav_bundle_snapshot_file_id))
  expect_equal(loaded_base$xlsform_file_id, xmeta$file_id)
})

test_that("ZIP SAV bloquea archivos sin base durante inspeccion", {
  sid <- session_create()
  estudio_set_processing_mode(sid, "independent_siblings")
  inst <- sm_sav_test_inst()
  xls_path <- sm_sav_test_xlsx(list(
    survey = inst$survey,
    choices = inst$choices
  ))
  old_data <- data.frame(p1 = "1", stringsAsFactors = FALSE)
  old_data_path <- sm_sav_test_xlsx(list(datos = old_data))
  xmeta <- save_upload(sid, "xlsform", "civil_xlsform.xlsx", readBin(xls_path, "raw", n = file.info(xls_path)$size))
  dmeta <- save_upload(sid, "data", "civil_data.xlsx", readBin(old_data_path, "raw", n = file.info(old_data_path)$size))
  rp_inst <- reporte_instrumento(path = xmeta$path)
  rp_data <- reporte_data(old_data, instrumento = rp_inst)
  estudio_add_base(
    sid,
    "ingenieria_civil",
    xmeta$file_id,
    dmeta$file_id,
    "xlsx",
    rp_data,
    rp_inst,
    n_filas = nrow(old_data),
    n_columnas = ncol(old_data),
    extra_meta = list(processing_mode = "independent_siblings", source_alias = "Ingeniería Civil")
  )

  zip_path <- sm_sav_test_zip(list("Revisión Fantasma.sav" = sm_sav_test_raw()))
  zip_meta <- save_upload(sid, "sav_bundle", "Bases finales.zip", readBin(zip_path, "raw", n = file.info(zip_path)$size))
  inspection <- sm_multibase_sav_bundle_inspect(sid, zip_meta$file_id)

  expect_false(inspection$ok)
  expect_equal(inspection$n_blocking, 1L)
  expect_true(grepl("no coincide", unlist(inspection$warnings, use.names = FALSE)[1], fixed = TRUE))
})
