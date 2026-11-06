# El equipo de cada perfil, leído del Planner (ADR 0122 §10).

source("setup-load-all.R")

.pe_sesion <- function(estado = list(), envir = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = envir)
  s <- session_get(sid)
  for (k in names(estado)) s[k] <- list(estado[[k]])
  .session_env[[sid]] <- s
  sid
}

.pe_equipo <- function(code_format = "PXXX") list(code_format = code_format, personas = list(
  list(codigo = "P001", nombre = "Encuestador Ejemplo Uno", rol = "encuestador", perfiles = list()),
  list(codigo = "A01", nombre = "Aplicadora Ejemplo Dos", rol = "aplicador", perfiles = list()),
  list(codigo = "T01", nombre = "Operador Ejemplo Tres", rol = "operador", perfiles = list()),
  list(codigo = "P002", nombre = "Encuestadora Ejemplo Cuatro", rol = "encuestador", perfiles = list("territorial"), activo = FALSE),
  list(codigo = "S01", nombre = "Supervisor Ejemplo Cinco", rol = "supervisor", perfiles = list())
))

test_that("cada perfil recibe a los suyos: por perfil declarado o, si no, por rol", {
  sid <- .pe_sesion()
  .planner_sembrar_legado(sid, "equipo", .pe_equipo())
  s <- session_get(sid)
  codigos <- function(perfil) vapply(.planner_equipo_de(s, perfil)$personas, `[[`, "", "codigo")
  expect_equal(codigos("territorial"), c("P001", "P002", "S01"))
  expect_equal(codigos("telefonico"), c("P001", "T01", "S01"))
  expect_equal(codigos("aulas"), c("A01", "S01"))
  # Inactivo se entrega marcado: Monitoreo lo necesita para atribuir lo ya hecho.
  p002 <- Filter(function(p) p$codigo == "P002", .planner_equipo_de(s, "territorial")$personas)[[1]]
  expect_false(p002$activo)
})

test_that("leer el equipo de un perfil es puro y no lo siembra del roster de Monitoreo (ADR 0123 §2)", {
  sid <- .pe_sesion(list(monitoreo_config = list(territorial = list(enumerator_roster = list(code_format = "PXXX", assignments = list(
    list(codigo_pulso = "P001", nombre = "Encuestador Ejemplo Uno", dni = "00000000")))))))
  antes <- digest::digest(.session_env[[sid]])
  eq <- .planner_equipo_de(session_get(sid), "territorial")
  expect_identical(digest::digest(.session_env[[sid]]), antes)
  expect_equal(eq$origen, "vacio")
  expect_length(eq$personas, 0L)
  expect_false(any(grepl("00000000", unlist(eq), fixed = TRUE)))
})

test_that("con códigos que son DNI no se entrega a nadie, como en Material", {
  sid <- .pe_sesion()
  .planner_sembrar_legado(sid, "equipo", .pe_equipo("DNI"))
  eq <- .planner_equipo_de(session_get(sid), "territorial")
  expect_true(eq$bloqueado)
  expect_length(eq$personas, 0L)
})

test_that("un perfil que no existe es 404", {
  sid <- .pe_sesion()
  expect_equal(tryCatch(.planner_equipo_de(session_get(sid), "digital"), error = identity)$code, "E_PLANNER_SECCION")
})
