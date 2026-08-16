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

  # El parser produce la forma v1 a propósito: es una función pura Excel→plan.
  # Quien aplica el esquema vigente es `.plan_rebuild_derived`, por donde pasa
  # la ruta real de import (ver el test siguiente).
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

test_that("un cronograma importado sale del rebuild con los campos del ADR 0047", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  path <- tempfile(fileext = ".xlsx")
  plan_test_workbook(path)

  # La ruta real de import envuelve el parser en `.plan_rebuild_derived`: sin
  # eso, un cronograma recién importado quedaría sin prioridad, etiquetas ni
  # forma temporal hasta reabrir el proyecto, y el payload sería heterogéneo
  # según de dónde vino la tarea.
  plan <- .plan_rebuild_derived(.plan_normalize_import(path, list(original_name = "cronograma.xlsx")))

  expect_equal(plan$schema, "plan_trabajo_v3")
  for (t in plan$tasks) {
    for (campo in c("priority", "priority_rank", "tags", "reminders", "links",
                    "blocked_by", "archived_at", "kind_manual", "fase",
                    "fase_manual", "temporal_kind")) {
      expect_true(campo %in% names(t), info = paste("tarea", t$id, "sin", campo))
    }
  }
  # Trabajo de campo va del 20 al 23 de mayo: es un rango.
  expect_equal(plan$tasks[[1]]$temporal_kind, "rango")
})

test_that("el tipo elegido por el usuario sobrevive a una edición posterior", {
  # Regresión del ADR 0047: `.plan_update_task` recalculaba `kind` desde el
  # texto de la actividad en CADA edición, así que la elección del usuario se
  # revertía sola en el guardado siguiente.
  plan <- .plan_create_task(.plan_empty_plan(), list(
    activity = "Levantamiento en campo",
    start_date = "2026-03-01",
    end_date = "2026-03-20",
    kind = "activity"
  ))
  id <- plan$tasks[[1]]$id
  # El texto dice "campo": la heurística querría `fieldwork_window`.
  expect_equal(plan$tasks[[1]]$kind, "activity")
  expect_true(plan$tasks[[1]]$kind_manual)

  plan <- .plan_update_task(plan, id, list(responsible = "Equipo B"))
  expect_equal(plan$tasks[[1]]$kind, "activity")

  # Sin elección explícita, la heurística sí sugiere y sigue mandando.
  plan2 <- .plan_create_task(.plan_empty_plan(), list(
    activity = "Levantamiento en campo",
    start_date = "2026-03-01",
    end_date = "2026-03-20"
  ))
  expect_equal(plan2$tasks[[1]]$kind, "fieldwork_window")
  expect_false(plan2$tasks[[1]]$kind_manual)
})

test_that("una tarea archivada sale de hitos y ventanas pero no del plan", {
  plan <- .plan_create_task(.plan_empty_plan(), list(
    activity = "Entrega de informe final",
    start_date = "2026-04-05",
    end_date = "2026-04-05",
    kind = "milestone"
  ))
  expect_equal(length(plan$milestones), 1L)

  plan$tasks[[1]]$archived_at <- "2026-04-10T10:00:00Z"
  plan <- .plan_rebuild_derived(plan)

  expect_equal(length(plan$tasks), 1L)
  expect_equal(length(plan$milestones), 0L)
  expect_equal(length(plan$windows), 0L)
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

test_that("plan de trabajo crea actividades manuales sobre un plan vacio", {
  plan <- .plan_empty_plan()
  expect_equal(length(plan$tasks), 0L)

  plan <- .plan_create_task(plan, list(
    activity = "Reunion de arranque",
    responsible = "Coordinacion",
    start_date = "2026-08-01",
    end_date = "2026-08-01",
    kind = "milestone"
  ))
  expect_equal(length(plan$tasks), 1L)
  task <- plan$tasks[[1]]
  expect_match(task$id, "^task_m_")
  expect_equal(task$kind, "milestone")
  expect_equal(task$duration_days, 1L)
  expect_equal(length(plan$milestones), 1L)

  plan <- .plan_create_task(plan, list(
    activity = "Trabajo de campo",
    start_date = "2026-08-05",
    end_date = "2026-08-09"
  ))
  expect_equal(length(plan$tasks), 2L)
  expect_equal(plan$tasks[[2]]$duration_days, 5L)
})

test_that("plan de trabajo normaliza horas HH:MM en tareas manuales", {
  plan <- .plan_empty_plan()
  plan <- .plan_create_task(plan, list(
    activity = "Reunión",
    start_date = "2026-08-01",
    end_date = "2026-08-01",
    start_time = "9:5",
    end_time = "10:30"
  ))
  task <- plan$tasks[[1]]
  expect_equal(task$start_time, "")       # "9:5" es invalida
  expect_equal(task$end_time, "10:30")

  id <- task$id
  plan <- .plan_update_task(plan, id, list(start_time = "09:00", end_time = "25:00"))
  updated <- plan$tasks[[1]]
  expect_equal(updated$start_time, "09:00")
  expect_equal(updated$end_time, "")      # 25:00 fuera de rango
})

test_that("plan de trabajo rechaza actividad sin nombre y elimina por id", {
  plan <- .plan_empty_plan()
  expect_error(.plan_create_task(plan, list(activity = "")))

  plan <- .plan_create_task(plan, list(activity = "Piloto"))
  id <- plan$tasks[[1]]$id
  plan <- .plan_create_task(plan, list(activity = "Analisis"))
  expect_equal(length(plan$tasks), 2L)

  plan <- .plan_delete_task(plan, id)
  expect_equal(length(plan$tasks), 1L)
  expect_equal(plan$tasks[[1]]$activity, "Analisis")
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

  protocol <- .diseno_protocol_summary(session_get(sid))
  expect_equal(protocol$workplan_tasks_count, 1L)
  expect_equal(protocol$workplan_milestones_count, 1L)
  statuses <- .diseno_module_statuses(session_get(sid), protocol)
  expect_true(any(vapply(statuses, function(item) item$id == "plan-trabajo" && item$state == "ready", logical(1))))
})
