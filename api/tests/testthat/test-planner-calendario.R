# Planner: cronograma y etapa operativa leídos juntos (ADR 0122 §2).
#
# Lo que fija: la etapa del estudio tiene hoy tres respuestas (cronograma, Hojas
# de ruta y Monitoreo territorial). El Planner las lee sin escribir en ninguna
# y dice cuando no coinciden, en vez de elegir una en silencio.

source("setup-load-all.R")

.plc_sesion <- function(estado = list(), envir = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = envir)
  s <- session_get(sid)
  for (k in names(estado)) s[k] <- list(estado[[k]])
  s$project_path <- "/tmp/planner-calendario.pulso"
  s$project_dirty <- FALSE
  .session_env[[sid]] <- s
  sid
}

.plc_huella <- function(sid) {
  s <- .session_env[[sid]]
  s$last_access <- NULL
  digest::digest(s)
}

.plc_plan <- function(inicio = "2026-11-10", fin = "2026-11-28") {
  list(schema = "plan_trabajo_v3", tasks = list(
    list(id = "t-campo", activity = "Campo", fase = "campo", fase_manual = TRUE, kind = "fieldwork_window",
         start_date = inicio, end_date = fin)
  ))
}

test_that("un estudio sin cronograma ni etapas no inventa fechas", {
  sid <- .plc_sesion()
  cal <- .planner_calendario(session_get(sid))
  expect_equal(cal$campo, list(inicio = "", fin = ""))
  expect_true(is.na(cal$etapa$valor))
  expect_length(cal$avisos, 0L)
  expect_setequal(vapply(cal$fases, `[[`, "", "id"), BITACORA_FASES)
})

test_that("la ventana de campo sale del cronograma y la etapa de Hojas de ruta", {
  sid <- .plc_sesion(list(plan_trabajo = .plc_plan(), hojas_ruta_active_phase = "pilot"))
  antes <- .plc_huella(sid)
  cal <- .planner_calendario(session_get(sid))
  expect_identical(.plc_huella(sid), antes)
  expect_false(isTRUE(session_get(sid)$project_dirty))
  expect_equal(cal$campo, list(inicio = "2026-11-10", fin = "2026-11-28"))
  expect_equal(cal$etapa$valor, "piloto")
  expect_false(cal$etapa$declarable)
})

test_that("si Hojas de ruta y Monitoreo no dicen la misma etapa, se avisa y no se elige", {
  sid <- .plc_sesion(list(
    plan_trabajo = .plc_plan(),
    hojas_ruta_active_phase = "field",
    monitoreo_config = list(territorial = list(active_route_phase = "pilot",
                                               phase_windows = list(field = list(start_at = "2026-11-12T00:00:00Z"))))
  ))
  cal <- .planner_calendario(session_get(sid))
  expect_true(is.na(cal$etapa$valor))
  expect_setequal(vapply(cal$avisos, `[[`, "", "codigo"), c("etapa_no_coincide", "campo_no_coincide"))
  expect_equal(cal$etapa$fuentes$monitoreo$campo_desde, "2026-11-12")
})

test_that("las dos etapas iguales no avisan", {
  sid <- .plc_sesion(list(hojas_ruta_active_phase = "field",
                          monitoreo_config = list(territorial = list(active_route_phase = "field"))))
  cal <- .planner_calendario(session_get(sid))
  expect_equal(cal$etapa$valor, "campo")
  expect_length(cal$avisos, 0L)
})
