# Planner: cronograma, ventana de campo y etapa operativa (ADR 0123 §5–§6).
#
# Lo que fija: el Planner va primero. La ventana y la etapa son propuestas que
# Monitoreo y Hojas de ruta comparan desde su lado; aquí no se lee a ninguno de
# los dos, y la ventana sin declarar sale sólo del cronograma propio.

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

# Hojas de ruta y Monitoreo territorial «en uso»: con muestra sorteada y familia
# territorial. Sin eso sus etapas son valores por defecto y no cuentan.
.plc_en_uso <- function(hojas = NULL, monitoreo = NULL, ventanas = NULL) {
  out <- list()
  if (!is.null(hojas)) {
    out$hojas_ruta_active_phase <- hojas
    out$hojas_ruta_runs <- list(field = list(workspace_outputs = list(sample = list(list(id = "b1")))))
  }
  if (!is.null(monitoreo)) {
    out$monitoreo_config <- list(monitoreo_profile = list(family = "territorial", route_selected = TRUE),
                                 territorial = list(active_route_phase = monitoreo, phase_windows = ventanas))
  }
  out
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

test_that("sin declarar, la ventana es la fase Campo del cronograma y no se lee a Hojas ni a Monitoreo", {
  sid <- .plc_sesion(c(list(plan_trabajo = .plc_plan()),
                       .plc_en_uso(hojas = "pilot", monitoreo = "field",
                                   ventanas = list(field = list(start_at = "2026-11-20T10:00:00Z")))))
  antes <- .plc_huella(sid)
  cal <- .planner_calendario(session_get(sid))
  expect_identical(.plc_huella(sid), antes)
  expect_equal(cal$campo, list(inicio = "2026-11-10", fin = "2026-11-28"))
  expect_equal(cal$ventana[c("inicio", "fin", "fuente", "origen")],
               list(inicio = "2026-11-10", fin = "2026-11-28", fuente = "cronograma", origen = "vacio"))
  expect_true(is.na(cal$etapa$valor))
  expect_equal(cal$etapa$origen, "vacio")
  expect_null(cal$etapa$fuentes)
  expect_length(cal$avisos, 0L)
})

test_that("cambiar Hojas de ruta o Monitoreo no cambia el calendario (ADR 0123 §5)", {
  sin <- .planner_calendario(session_get(.plc_sesion(list(plan_trabajo = .plc_plan()))))
  con <- .planner_calendario(session_get(.plc_sesion(c(
    list(plan_trabajo = .plc_plan()),
    .plc_en_uso(hojas = "field", monitoreo = "pilot", ventanas = list(field = list(start_at = "2026-12-01"))),
    list(monitoreo_config = list(strategy_phases = list(list(id = "f1", start_date = "2026-11-12", end_date = "2026-12-02"))))))))
  sin$hoy <- NULL; con$hoy <- NULL
  expect_identical(con, sin)
})

test_that("declaradas, la etapa y la ventana mandan sin avisos y sin escribir en otros módulos", {
  sid <- .plc_sesion(c(list(plan_trabajo = .plc_plan()), .plc_en_uso(hojas = "field", monitoreo = "pilot")))
  .planner_declarar(sid, "etapa", list(valor = "campo"), 0L)
  .planner_declarar(sid, "ventana", list(inicio = "2026-11-12", fin = "2026-12-02"), 1L)
  s <- session_get(sid)
  p <- .planner_payload(s)
  expect_equal(p$planner$etapa$valor, "campo")
  expect_equal(p$origen$etapa, "declarado")
  cal <- .planner_calendario(s)
  expect_equal(cal$etapa$valor, "campo")
  expect_equal(cal$etapa$origen, "declarado")
  expect_true(cal$etapa$declarable)
  expect_equal(cal$ventana[c("inicio", "fin", "fuente", "origen")],
               list(inicio = "2026-11-12", fin = "2026-12-02", fuente = "planner", origen = "declarado"))
  expect_length(cal$avisos, 0L)
  # Persistidas planas, como las demás secciones (ADR 0122 §6).
  expect_equal(s$planner$etapa$valor, "campo")
  expect_equal(s$planner$ventana, list(inicio = "2026-11-12", fin = "2026-12-02"))
  # Declarar no escribe en Hojas de ruta ni en Monitoreo.
  expect_equal(s$hojas_ruta_active_phase, "field")
  expect_equal(s$monitoreo_config$territorial$active_route_phase, "pilot")
})

test_that("la etapa es piloto o campo", {
  sid <- .plc_sesion()
  err <- tryCatch(.planner_declarar(sid, "etapa", list(valor = "cierre"), 0L), error = identity)
  expect_equal(err$code, "E_PLANNER_INVALIDO")
})

test_that("la ventana necesita inicio y fin, en ese orden", {
  sid <- .plc_sesion()
  for (malo in list(list(inicio = "2026-11-10"), list(inicio = "2026-11-10", fin = "2026-11-01"),
                    list(inicio = "2026-02-30", fin = "2026-03-02"))) {
    err <- tryCatch(.planner_declarar(sid, "ventana", malo, 0L), error = identity)
    expect_equal(err$code, "E_PLANNER_INVALIDO")
  }
})

test_that("la ventana declarada sobrevive al guardado y no viaja al publicar", {
  sid <- .plc_sesion()
  .planner_declarar(sid, "ventana", list(inicio = "2026-11-10", fin = "2026-12-02"), 0L)
  ruta <- withr::local_tempfile(fileext = ".pulso")
  build_pulso(sid, ruta, project_name = "ventana", allow_empty_overwrite = TRUE)
  ld <- suppressMessages(load_pulso(ruta))
  withr::defer(session_delete(ld$session_id))
  expect_equal(.planner_payload(session_get(ld$session_id))$planner$ventana, list(inicio = "2026-11-10", fin = "2026-12-02"))
  expect_null(.planner_para_publicar(session_get(sid))$ventana)
})
