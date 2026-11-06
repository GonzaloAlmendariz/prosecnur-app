# ADR 0122: nombre y cliente del reporte de Cálculo salen del Planner.

source("setup-load-all.R")

.cmid_sesion <- function(estado = list(), envir = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = envir)
  s <- session_get(sid)
  for (k in names(estado)) s[k] <- list(estado[[k]])
  .session_env[[sid]] <- s
  sid
}

test_that("el reporte toma nombre y cliente declarados en el Planner", {
  sid <- .cmid_sesion(list(planner = list(
    schema = "planner/v1", revision = 1L, declarado_en = list(estudio = "2026-10-31T20:00:00Z"),
    estudio = list(nombre = "Encuesta de prueba 2026", codigo = "EP26", cliente = "Cliente ficticio")
  )))
  estudio <- calc_muestra_normalize_estudio(list(titulo = "otro"))
  estudio$decision_log <- list(estudio = list(titulo = "otro"))
  r <- .cm_estudio_con_identidad(estudio, session_get(sid))
  expect_identical(r$titulo, "Encuesta de prueba 2026")
  expect_identical(r$decision_log$estudio$titulo, "Encuesta de prueba 2026")
  expect_identical(r$contexto$cliente, "Cliente ficticio")
})

test_that("sin nombre en el Planner se conserva el del estudio", {
  sid <- .cmid_sesion(list())
  estudio <- calc_muestra_normalize_estudio(list(titulo = "Heredado"))
  expect_identical(.cm_estudio_con_identidad(estudio, session_get(sid))$titulo, "Heredado")
})
