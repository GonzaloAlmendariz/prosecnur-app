plan_test_workbook <- function(path) {
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Cronograma")
  grid <- matrix("", nrow = 9, ncol = 10)
  grid[1, 1] <- "Cronograma Estudio ACNUR"
  grid[2, 1] <- "Actualizado al 20/05/2026"
  grid[3, 3:10] <- c("Semana 1", rep("", 7))
  grid[4, 3:10] <- c("Mi", "J", "V", "S", "D", "L", "M", "Mi")
  grid[5, 1:10] <- c("Actividades", "Responsables", as.character(20:27))
  grid[6, 1] <- "I. PLANIFICACION Y VALIDACION"
  grid[7, 1] <- "Trabajo de campo"
  grid[7, 2] <- "Pulso"
  grid[7, 3:6] <- "X"
  grid[8, 1] <- "Entrega de informe"
  grid[8, 2] <- "Pulso"
  grid[8, 9:10] <- "X"
  openxlsx::writeData(wb, "Cronograma", grid, colNames = FALSE)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
}

test_that("plan de trabajo entiende cronogramas XLSX con grilla diaria", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  path <- tempfile(fileext = ".xlsx")
  plan_test_workbook(path)

  plan <- .plan_normalize_import(path, list(original_name = "cronograma.xlsx"))

  expect_equal(plan$schema, "plan_trabajo_v1")
  expect_match(plan$title, "Cronograma Estudio ACNUR")
  expect_equal(length(plan$tasks), 2L)
  expect_equal(plan$phases[[1]], "I. PLANIFICACION Y VALIDACION")

  fieldwork <- plan$tasks[[1]]
  expect_equal(fieldwork$activity, "Trabajo de campo")
  expect_equal(fieldwork$start_date, "2026-05-20")
  expect_equal(fieldwork$end_date, "2026-05-23")
  expect_true("monitoreo" %in% unlist(fieldwork$sync_targets, use.names = FALSE))

  report <- plan$tasks[[2]]
  expect_equal(report$kind, "milestone")
  expect_true("reportes" %in% unlist(report$sync_targets, use.names = FALSE))
  expect_equal(length(plan$windows), 2L)
})

test_that("plan de trabajo se persiste como estado propio y expone sincronizacion", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "project_dirty", FALSE)

  path <- tempfile(fileext = ".xlsx")
  plan_test_workbook(path)
  meta <- save_upload(sid, "plan_trabajo", "cronograma.xlsx", readBin(path, "raw", n = file.info(path)$size))
  plan <- .plan_normalize_import(meta$path, meta)
  session_set(sid, "plan_trabajo", plan)

  state <- .plan_state_payload(sid)
  saved <- session_get(sid)
  expect_true(isTRUE(saved$project_dirty))
  expect_equal(state$readiness$task_count, 2L)
  expect_true(any(vapply(state$sync, function(item) item$module_id == "monitoreo", logical(1))))

  next_state <- .plan_state_payload(sid)
  expect_equal(next_state$plan$source$file_id, meta$file_id)

  exported <- .plan_export_xlsx(sid, plan)
  expect_equal(exported$kind, "plan_trabajo_xlsx")
  expect_true(file.exists(exported$path))
  expect_match(exported$original_name, "plan_trabajo")
})

test_that("plan de trabajo permite actualizar una actividad sin tocar otros modulos", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  path <- tempfile(fileext = ".xlsx")
  plan_test_workbook(path)
  plan <- .plan_normalize_import(path, list(original_name = "cronograma.xlsx"))
  plan <- .plan_update_task(plan, "task_001", list(status = "active", notes = "Inicio confirmado por coordinacion."))

  expect_equal(plan$tasks[[1]]$status, "active")
  expect_match(plan$tasks[[1]]$notes, "Inicio confirmado")
  expect_true("monitoreo" %in% unlist(plan$tasks[[1]]$sync_targets, use.names = FALSE))
})

test_that("diseno del estudio lee plan de trabajo como fuente transversal", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "plan_trabajo", list(
    title = "Cronograma de campo",
    tasks = list(list(id = "task_001", activity = "Trabajo de campo")),
    milestones = list(list(id = "task_002", activity = "Entrega de informe")),
    windows = list(list(module_id = "monitoreo"))
  ))

  state <- .diseno_estudio_state_payload(sid)
  expect_equal(state$protocol$workplan_tasks_count, 1L)
  expect_equal(state$protocol$workplan_milestones_count, 1L)
  expect_true(any(vapply(state$sources, function(item) item$id == "plan-trabajo" && item$state == "ready", logical(1))))
})
