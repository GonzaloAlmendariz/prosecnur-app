.manual_repeat_fixture <- function(include_link = TRUE) {
  survey <- data.frame(
    type = c("text", "begin_repeat", "text", "select_one yesno", "end_repeat"),
    name = c("nombre", "rep_items", "item", "ok", "rep_items"),
    label = c("Nombre", "Items", "Item", "Correcto", ""),
    relevant = c("", "${nombre} != ''", "", "", ""),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("yesno", "yesno"), name = c("1", "0"), label = c("Sí", "No"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  parent <- data.frame(`_index` = 1:2, `_id` = c("a", "b"), nombre = c("Ana", "Beto"),
                       stringsAsFactors = FALSE, check.names = FALSE)
  child <- data.frame(item = c("x", "y", "z"), ok = c("1", "0", "1"),
                      stringsAsFactors = FALSE, check.names = FALSE)
  if (isTRUE(include_link)) child$`_parent_index` <- c(1L, 2L, 2L)
  list(survey = survey, choices = choices, parent = parent, child = child)
}

.manual_repeat_workbook <- function(fx, child_name = "rep_items", extra = TRUE) {
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  for (nm in c("datos", child_name)) openxlsx::addWorksheet(wb, nm)
  openxlsx::writeData(wb, "datos", fx$parent)
  openxlsx::writeData(wb, child_name, fx$child)
  if (isTRUE(extra)) {
    openxlsx::addWorksheet(wb, "extra")
    openxlsx::writeData(wb, "extra", data.frame(foo = 1))
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.manual_repeat_inst_path <- function(fx) {
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", fx$survey)
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", fx$choices)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

test_that("carga manual materializa hoja repeat como base hija e ignora extras", {
  fx <- .manual_repeat_fixture()
  data_path <- .manual_repeat_workbook(fx)
  inst_path <- .manual_repeat_inst_path(fx)
  sid <- session_create()
  on.exit({ session_delete(sid); unlink(c(data_path, inst_path), force = TRUE) }, add = TRUE)
  save_upload(sid, "xlsform", "form.xlsx", readBin(inst_path, "raw", file.info(inst_path)$size))
  save_upload(sid, "data", "respuestas.xlsx", readBin(data_path, "raw", file.info(data_path)$size))

  expect_true(estudio_init_default_base(sid))
  s <- session_get(sid)
  expect_setequal(names(s$estudio$bases), c("default", "rep_items"))
  child <- s$estudio$bases$rep_items
  expect_equal(child$source_kind, "xlsx_repeat")
  expect_equal(child$parent_base, "default")
  expect_equal(child$repeat_group, "rep_items")
  expect_equal(child$link_key, "_parent_index")
  expect_equal(child$parent_index_key, "_index")
  expect_equal(child$n_filas, 3L)
  expect_true(all(c("item", "ok", "_parent_index") %in% names(s$rp_data_sources$rep_items)))

  before <- c(child$xlsform_file_id, child$data_file_id)
  expect_false(.carga_xlsx_register_repeat_bases(sid, "default"))
  after <- session_get(sid)$estudio$bases$rep_items
  expect_identical(c(after$xlsform_file_id, after$data_file_id), before)

  fx_changed <- fx
  fx_changed$child <- rbind(
    fx_changed$child,
    data.frame(item = "nuevo", ok = "1", `_parent_index` = 1L,
               stringsAsFactors = FALSE, check.names = FALSE)
  )
  changed_path <- .manual_repeat_workbook(fx_changed)
  on.exit(unlink(changed_path, force = TRUE), add = TRUE)
  save_upload(sid, "data", "respuestas_actualizadas.xlsx",
              readBin(changed_path, "raw", file.info(changed_path)$size))
  expect_true(estudio_init_default_base(sid))
  updated <- session_get(sid)
  expect_setequal(names(updated$estudio$bases), c("default", "rep_items"))
  expect_equal(updated$estudio$bases$rep_items$n_filas, 4L)
  expect_false(identical(updated$estudio$bases$rep_items$data_file_id, before[[2]]))
})

test_that("recarga default restaura padre y repeats si universe_filter falla", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  fx <- .manual_repeat_fixture()
  fx$survey <- rbind(
    data.frame(
      type = "text", name = "testreal", label = "Tipo de entrevista",
      relevant = "", stringsAsFactors = FALSE, check.names = FALSE
    ),
    fx$survey
  )
  fx$parent$testreal <- c("real", "test")
  data_path <- .manual_repeat_workbook(fx)
  inst_path <- .manual_repeat_inst_path(fx)
  sid <- session_create()
  on.exit({ session_delete(sid); unlink(c(data_path, inst_path), force = TRUE) }, add = TRUE)
  save_upload(sid, "xlsform", "form_universe.xlsx",
              readBin(inst_path, "raw", file.info(inst_path)$size))
  save_upload(sid, "data", "respuestas_universe.xlsx",
              readBin(data_path, "raw", file.info(data_path)$size))
  expect_true(estudio_init_default_base(sid))
  carga_universe_filter_apply(sid, "default", list(
    version = 1L, enabled = TRUE, variable = "testreal",
    real_values = list("real"), test_values = list("test"),
    missing_policy = "exclude", unassigned_policy = "unclassified"
  ))

  fx_failed <- fx
  fx_failed$parent$testreal <- c("test", "test")
  fx_failed$child <- rbind(
    fx_failed$child,
    data.frame(item = "nuevo", ok = "1", `_parent_index` = 1L,
               stringsAsFactors = FALSE, check.names = FALSE)
  )
  failed_path <- .manual_repeat_workbook(fx_failed)
  on.exit(unlink(failed_path, force = TRUE), add = TRUE)
  save_upload(sid, "data", "respuestas_solo_prueba.xlsx",
              readBin(failed_path, "raw", file.info(failed_path)$size))

  before_failure <- session_get(sid)
  scoped_names <- c("default", "rep_items")
  expect_error(
    estudio_init_default_base(sid),
    "no incluye ninguna entrevista real",
    fixed = TRUE
  )
  after_failure <- session_get(sid)
  expect_identical(
    after_failure$estudio$bases[scoped_names],
    before_failure$estudio$bases[scoped_names]
  )
  expect_identical(
    after_failure$rp_data_sources[scoped_names],
    before_failure$rp_data_sources[scoped_names]
  )
  expect_identical(after_failure$rp_data, before_failure$rp_data)
  expect_identical(names(after_failure$files), names(before_failure$files))
})

test_that("carga manual ignora hoja repeat sin vínculo y acepta fallback por id", {
  fx_bad <- .manual_repeat_fixture(include_link = FALSE)
  bad_path <- .manual_repeat_workbook(fx_bad)
  inst_path <- .manual_repeat_inst_path(fx_bad)
  sid <- session_create()
  on.exit({ session_delete(sid); unlink(c(bad_path, inst_path), force = TRUE) }, add = TRUE)
  save_upload(sid, "xlsform", "form.xlsx", readBin(inst_path, "raw", file.info(inst_path)$size))
  save_upload(sid, "data", "bad.xlsx", readBin(bad_path, "raw", file.info(bad_path)$size))
  estudio_init_default_base(sid)
  expect_identical(names(session_get(sid)$estudio$bases), "default")

  fx_ok <- .manual_repeat_fixture(include_link = FALSE)
  fx_ok$child$`_submission__id` <- c("a", "b", "b")
  ok_path <- .manual_repeat_workbook(fx_ok)
  on.exit(unlink(ok_path, force = TRUE), add = TRUE)
  meta <- save_upload(sid, "data", "fallback.xlsx", readBin(ok_path, "raw", file.info(ok_path)$size))
  expect_true(estudio_init_default_base(sid))
  child <- session_get(sid)$estudio$bases$rep_items
  expect_equal(child$source_data_file_id, meta$file_id)
  expect_equal(child$link_key, "_submission__id")
  expect_equal(child$parent_index_key, "_id")
})

test_that("load_pulso repara una madre multihoja sin hija y marca dirty", {
  fx <- .manual_repeat_fixture()
  data_path <- .manual_repeat_workbook(fx)
  inst_path <- .manual_repeat_inst_path(fx)
  sid <- session_create()
  pulso <- tempfile(fileext = ".pulso")
  on.exit({ session_delete(sid); unlink(c(data_path, inst_path, pulso), force = TRUE) }, add = TRUE)
  xm <- save_upload(sid, "xlsform", "form.xlsx", readBin(inst_path, "raw", file.info(inst_path)$size))
  dm <- save_upload(sid, "data", "respuestas.xlsx", readBin(data_path, "raw", file.info(data_path)$size))
  inst <- reporte_instrumento(path = xm$path)
  parent <- readxl::read_excel(dm$path)
  estudio_add_base(sid, "default", xm$file_id, dm$file_id, "xlsx",
                   reporte_data(parent, instrumento = inst), inst, nrow(parent), ncol(parent))
  build_pulso(sid, pulso, project_name = "Repeat legacy")

  loaded <- load_pulso(pulso)
  on.exit(session_delete(loaded$session_id), add = TRUE)
  repaired <- session_get(loaded$session_id)
  expect_true("rep_items" %in% names(repaired$estudio$bases))
  expect_true(isTRUE(repaired$project_dirty))
  expect_equal(repaired$estudio$bases$rep_items$source_kind, "xlsx_repeat")
})
