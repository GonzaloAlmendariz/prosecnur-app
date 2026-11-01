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

test_that("la ventana de campo sale del cronograma y la etapa de Hojas de ruta", {
  sid <- .plc_sesion(c(list(plan_trabajo = .plc_plan()), .plc_en_uso(hojas = "pilot")))
  antes <- .plc_huella(sid)
  cal <- .planner_calendario(session_get(sid))
  expect_identical(.plc_huella(sid), antes)
  expect_false(isTRUE(session_get(sid)$project_dirty))
  expect_equal(cal$campo, list(inicio = "2026-11-10", fin = "2026-11-28"))
  expect_equal(cal$etapa$valor, "piloto")
  expect_true(cal$etapa$declarable)
  expect_equal(cal$etapa$origen, "proyectado")
})

test_that("si Hojas de ruta y Monitoreo no dicen la misma etapa, se avisa y no se elige", {
  sid <- .plc_sesion(c(list(plan_trabajo = .plc_plan()),
                       .plc_en_uso(hojas = "field", monitoreo = "pilot",
                                   ventanas = list(field = list(start_at = "2026-11-12T00:00:00Z")))))
  cal <- .planner_calendario(session_get(sid))
  expect_true(is.na(cal$etapa$valor))
  expect_setequal(vapply(cal$avisos, `[[`, "", "codigo"), c("etapa_no_coincide", "campo_no_coincide"))
  expect_equal(cal$etapa$fuentes$monitoreo$campo_desde, "2026-11-12")
})

test_that("las dos etapas iguales no avisan", {
  sid <- .plc_sesion(.plc_en_uso(hojas = "field", monitoreo = "field"))
  cal <- .planner_calendario(session_get(sid))
  expect_equal(cal$etapa$valor, "campo")
  expect_length(cal$avisos, 0L)
})

# --- El Planner declara la etapa (decisión de Meta B sobre el ADR 0122) ---------

test_that("la etapa se siembra si Hojas de ruta y Monitoreo coinciden", {
  sid <- .plc_sesion(.plc_en_uso(hojas = "pilot", monitoreo = "pilot"))
  p <- .planner_payload(session_get(sid))
  expect_equal(p$planner$etapa$valor, "piloto")
  expect_equal(p$origen$etapa, "proyectado")
  expect_false("etapa_sin_acuerdo" %in% vapply(p$conflictos, `[[`, "", "codigo"))
})

test_that("si discrepan, la etapa queda sin valor y es un conflicto para el usuario", {
  sid <- .plc_sesion(.plc_en_uso(hojas = "field", monitoreo = "pilot"))
  p <- .planner_payload(session_get(sid))
  expect_true(is.na(p$planner$etapa$valor))
  expect_true("etapa_sin_acuerdo" %in% vapply(p$conflictos, `[[`, "", "codigo"))
})

test_that("declarada, la etapa manda y se dice qué módulo sigue en otra", {
  sid <- .plc_sesion(.plc_en_uso(hojas = "field", monitoreo = "pilot"))
  .planner_declarar(sid, "etapa", list(valor = "campo"), 0L)
  p <- .planner_payload(session_get(sid))
  expect_equal(p$planner$etapa$valor, "campo")
  expect_equal(p$origen$etapa, "declarado")
  expect_length(p$conflictos, 0L)
  cal <- .planner_calendario(session_get(sid))
  expect_equal(cal$etapa$valor, "campo")
  expect_equal(cal$etapa$origen, "declarado")
  expect_true(cal$etapa$declarable)
  desfasados <- Filter(function(a) identical(a$codigo, "etapa_modulo_desfasado"), cal$avisos)
  expect_equal(vapply(desfasados, `[[`, "", "fuente"), "monitoreo")
  # Persistida plana, como las demás secciones (ADR 0122 §6).
  expect_equal(session_get(sid)$planner$etapa$valor, "campo")
  # Declarar no escribe en Hojas de ruta ni en Monitoreo.
  expect_equal(session_get(sid)$hojas_ruta_active_phase, "field")
  expect_equal(session_get(sid)$monitoreo_config$territorial$active_route_phase, "pilot")
})

test_that("la etapa es piloto o campo", {
  sid <- .plc_sesion()
  err <- tryCatch(.planner_declarar(sid, "etapa", list(valor = "cierre"), 0L), error = identity)
  expect_equal(err$code, "E_PLANNER_INVALIDO")
})

test_that("las etapas por defecto de un estudio no territorial no cuentan como fuente", {
  # Forma de acnur_pdm y acrconta: Hojas en `field` sin muestra y Monitoreo
  # territorial en `pilot` con otra familia. Nadie eligió esas etapas.
  sid <- .plc_sesion(list(
    hojas_ruta_active_phase = "field",
    hojas_ruta_runs = list(field = list(workspace_outputs = list(sample = list()))),
    monitoreo_config = list(monitoreo_profile = list(family = "telefonico", route_selected = TRUE),
                            territorial = list(active_route_phase = "pilot"))
  ))
  cal <- .planner_calendario(session_get(sid))
  expect_length(cal$etapa$fuentes, 0L)
  expect_true(is.na(cal$etapa$valor))
  expect_length(.planner_payload(session_get(sid))$conflictos, 0L)
})

# --- La ventana de campo, PROPUESTA del Planner (Gonzalo vía Meta B, 2026-10-31) --

.plc_fases_monitoreo <- function(...) {
  list(monitoreo_config = list(monitoreo_profile = list(family = "telefonico"), strategy_phases = list(...)))
}

test_that("sin fuentes, la ventana queda vacía y no inventa fechas", {
  sid <- .plc_sesion()
  cal <- .planner_calendario(session_get(sid))
  expect_equal(cal$ventana[c("inicio", "fin", "fuente", "origen")],
               list(inicio = "", fin = "", fuente = "", origen = "proyectado"))
  expect_true(cal$ventana$propuesta)
  expect_true(cal$ventana$declarable)
})

test_that("se siembra de las fases de Monitoreo: del primer inicio al último fin", {
  sid <- .plc_sesion(c(
    .plc_fases_monitoreo(list(id = "f1", start_date = "2026-11-12", end_date = "2026-11-20"),
                         list(id = "f2", start_date = "2026-11-21", end_date = "2026-12-02"),
                         list(id = "f3")),
    list(plan_trabajo = .plc_plan())))
  antes <- .plc_huella(sid)
  cal <- .planner_calendario(session_get(sid))
  expect_equal(cal$ventana$inicio, "2026-11-12")
  expect_equal(cal$ventana$fin, "2026-12-02")
  expect_equal(cal$ventana$fuente, "monitoreo")
  expect_equal(cal$ventana$fuentes$cronograma[c("inicio", "fin")], list(inicio = "2026-11-10", fin = "2026-11-28"))
  p <- .planner_payload(session_get(sid))
  expect_equal(p$planner$ventana, list(inicio = "2026-11-12", fin = "2026-12-02"))
  expect_equal(p$origen$ventana, "proyectado")
  # Leer no escribe nada.
  expect_identical(.plc_huella(sid), antes)
})

test_that("en territorial se siembra del inicio del campo y, sin Monitoreo, del cronograma", {
  sid <- .plc_sesion(.plc_en_uso(monitoreo = "field", ventanas = list(field = list(start_at = "2026-06-12T10:00:00Z"))))
  v <- .planner_calendario(session_get(sid))$ventana
  expect_equal(v[c("inicio", "fin", "fuente")], list(inicio = "2026-06-12", fin = "", fuente = "monitoreo"))
  expect_equal(v$fuentes$monitoreo$de, "territorial")

  sid2 <- .plc_sesion(list(plan_trabajo = .plc_plan()))
  v2 <- .planner_calendario(session_get(sid2))$ventana
  expect_equal(v2[c("inicio", "fin", "fuente")], list(inicio = "2026-11-10", fin = "2026-11-28", fuente = "cronograma"))
})

test_that("declarada, la propuesta manda y se dice qué fuente cuenta otra ventana, sin escribir en ella", {
  sid <- .plc_sesion(c(
    .plc_fases_monitoreo(list(id = "f1", start_date = "2026-11-12", end_date = "2026-12-02")),
    list(plan_trabajo = .plc_plan())))
  .planner_declarar(sid, "ventana", list(inicio = "2026-11-10", fin = "2026-12-02"), 0L)
  s <- session_get(sid)
  cal <- .planner_calendario(s)
  expect_equal(cal$ventana[c("inicio", "fin", "fuente", "origen")],
               list(inicio = "2026-11-10", fin = "2026-12-02", fuente = "planner", origen = "declarado"))
  codigos <- vapply(cal$avisos, `[[`, "", "codigo")
  expect_setequal(codigos, c("ventana_monitoreo_distinta", "ventana_cronograma_distinta"))
  expect_match(cal$avisos[[which(codigos == "ventana_monitoreo_distinta")]]$mensaje, "del 2026-11-12 al 2026-12-02")
  # Persistida plana; Monitoreo y el cronograma siguen como estaban.
  expect_equal(s$planner$ventana, list(inicio = "2026-11-10", fin = "2026-12-02"))
  expect_equal(s$monitoreo_config$strategy_phases[[1]]$start_date, "2026-11-12")
  expect_equal(.planner_payload(s)$origen$ventana, "declarado")
  # Alineado Monitoreo con la propuesta, el aviso se va.
  s$monitoreo_config$strategy_phases[[1]]$start_date <- "2026-11-10"
  expect_false("ventana_monitoreo_distinta" %in% vapply(.planner_calendario(s)$avisos, `[[`, "", "codigo"))
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
