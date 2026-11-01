# ADR 0122 P2: iniciar-estudio toma la familia del perfil declarado en el
# Planner y deja de leerla del cuerpo. Sin perfil, no hay diseño que iniciar.

source("setup-load-all.R")

.cmfp_sesion <- function(estado = list(), envir = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = envir)
  s <- session_get(sid)
  for (k in names(estado)) s[k] <- list(estado[[k]])
  .session_env[[sid]] <- s
  sid
}

.cmfp_planner <- function(perfiles) list(planner = list(
  schema = "planner/v1", revision = 1L, declarado_en = list(perfiles = "2026-10-31T20:00:00Z"),
  perfiles = perfiles
))

test_that("aulas por conglomerados da encuesta_estudiantes; por marco, estudio_propio", {
  sid <- .cmfp_sesion(.cmfp_planner(list(list(tipo = "aulas", seleccion = "conglomerados", diseno = "calc-muestra"))))
  expect_identical(.cm_familia_del_planner(session_get(sid)), "encuesta_estudiantes")
  sid2 <- .cmfp_sesion(.cmfp_planner(list(list(tipo = "aulas", seleccion = "marco", diseno = "calc-muestra"))))
  expect_identical(.cm_familia_del_planner(session_get(sid2)), "estudio_propio")
})

test_that("telefónico no cae en la mesa legacy", {
  sid <- .cmfp_sesion(.cmfp_planner(list(list(tipo = "telefonico", diseno = "calc-muestra"))))
  expect_identical(.cm_familia_del_planner(session_get(sid)), "estudio_propio")
})

test_that("sin perfil declarado ni proyectable, 409 en vez de inventar el tipo", {
  sid <- .cmfp_sesion(list())
  err <- tryCatch(.cm_familia_del_planner(session_get(sid)), error = identity)
  expect_equal(err$code, "E_PLANNER_SECCION_PENDIENTE")
})
