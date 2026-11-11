# Conteo previo de una regla propia sin guardarla
# (POST /api/validacion/v2/reglas_custom/probar, reglas_custom_probar.R).
#
# Cifras (nivel: fila de la tabla principal de la base pedida):
#   n_filas  filas que evalúa la auditoría (tras el criterio de caso válido);
#   n_base   las que cumplen el filtro "Solo revisar cuando" (todas sin filtro);
#   n_casos  las que la regla marca; proporcion = n_casos / n_base.
# Datos: `.m1_datos()` en helper-validacion-m1.R (tabla en
# test-reglas-custom-condiciones.R).

.m1_probar <- function(pr, sid, regla, query = "") {
  .m1_http(pr, sid, "POST", "/api/validacion/v2/reglas_custom/probar",
           body = as.character(jsonlite::toJSON(regla, auto_unbox = TRUE, null = "null")),
           query = query)
}

test_that("cuenta los casos de un rango y devuelve los ejemplos con su identificador", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  r <- .m1_probar(.m1_router(), sid, .m1_regla_edad(id = ""))
  expect_identical(r$status, 200L)
  b <- r$body
  expect_identical(b$base_nombre, "Personas")
  expect_true(b$evaluada)
  expect_false(b$base_vacia)
  expect_false(b$filtro_previo)
  expect_identical(b$n_filas, 10L)
  expect_identical(b$n_base, 10L)
  expect_identical(b$n_casos, 3L)
  expect_equal(b$proporcion, 0.3)
  expect_identical(vapply(b$ejemplos, function(e) e$id_caso, character(1)), c("u01", "u04", "u08"))
  v <- b$ejemplos[[1]]$valores[[1]]
  expect_identical(v$variable, "edad")
  expect_identical(v$valor, "15")
  expect_identical(v$papel, "revisada")
  expect_true(v$falla)
})

test_that("con filtro previo, la base son los casos que lo cumplen y se marca la condición que se cumplió", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  r <- .m1_probar(.m1_router(), sid, .m1_regla_item_alguna(id = ""))
  expect_identical(r$status, 200L)
  b <- r$body
  expect_true(b$filtro_previo)
  # P8_6 = 1 en 7 filas; de ellas 4 tienen alguna de P16_7, P16_8 o P16_9.
  expect_identical(b$n_base, 7L)
  expect_identical(b$n_casos, 4L)
  expect_equal(b$proporcion, 4 / 7)
  expect_identical(vapply(b$ejemplos, function(e) e$id_caso, character(1)), c("u01", "u04", "u05", "u08"))

  falla <- function(e) {
    stats::setNames(vapply(e$valores, function(x) isTRUE(x$falla), logical(1)),
                    vapply(e$valores, function(x) x$variable, character(1)))
  }
  papel <- function(e) {
    stats::setNames(vapply(e$valores, function(x) x$papel, character(1)),
                    vapply(e$valores, function(x) x$variable, character(1)))
  }
  # u01: solo P16_7; u08: P16_7 y P16_9.
  expect_identical(falla(b$ejemplos[[1]])[c("p16_7", "p16_8", "p16_9", "p8_6")],
                   c(p16_7 = TRUE, p16_8 = FALSE, p16_9 = FALSE, p8_6 = FALSE))
  expect_identical(falla(b$ejemplos[[4]])[c("p16_7", "p16_8", "p16_9")],
                   c(p16_7 = TRUE, p16_8 = FALSE, p16_9 = TRUE))
  expect_identical(papel(b$ejemplos[[1]])[["p8_6"]], "filtro")
})

test_that("en una coherencia se marca la pregunta revisada, no la que la activa", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  b <- .m1_probar(.m1_router(), sid, .m1_regla_p4_p21(id = ""))$body
  expect_identical(b$n_casos, 5L)
  expect_identical(b$n_base, 10L)
  e <- b$ejemplos[[1]]$valores
  roles <- stats::setNames(lapply(e, function(x) list(papel = x$papel, falla = x$falla)),
                           vapply(e, function(x) x$variable, character(1)))
  expect_identical(roles$p21, list(papel = "revisada", falla = TRUE))
  expect_identical(roles$p4, list(papel = "condicion", falla = FALSE))
  # El P21 vacío de u10 viaja como null, no como "NA".
  u10 <- b$ejemplos[[5]]
  expect_identical(u10$id_caso, "u10")
  expect_null(Filter(function(x) x$variable == "p21", u10$valores)[[1]]$valor)
})

test_that("no guarda la regla ni toca la evaluación de la sesión", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad()))
  ev_previa <- list(resumen = data.frame(id_regla = "RC_001", n_inconsistencias = 3L), marca = "previa")
  validacion_scope_set(sid, "Personas", "evaluacion", ev_previa)
  s <- session_get(sid); s$project_dirty <- FALSE; .session_env[[sid]] <- s
  antes <- session_get(sid)$estudio$bases

  r <- .m1_probar(.m1_router(), sid, .m1_regla_hermanos(id = ""))
  expect_identical(r$status, 200L)
  expect_identical(r$body$n_casos, 4L)
  despues <- session_get(sid)
  expect_identical(despues$estudio$bases, antes)
  expect_false(isTRUE(despues$project_dirty))
})

test_that("multibase: cuenta en la base pedida o en la activa, no en la primera", {
  dir <- withr::local_tempdir()
  # Personas (activa) con 30 filas, Hogares (la primera) con las 10 de siempre.
  datos <- .m1_datos()[rep(1:10, 3), ]
  datos$respondent_id <- sprintf("p%02d", 1:30)
  sid <- .m1_sesion(dir, activa = "Personas", datos_personas = datos)
  withr::defer(session_delete(sid))
  pr <- .m1_router()

  activa <- .m1_probar(pr, sid, .m1_regla_edad(id = ""))$body
  expect_identical(activa$base_nombre, "Personas")
  expect_identical(activa$n_filas, 30L)
  expect_identical(activa$n_casos, 9L)
  # Tope de 20 ejemplos aunque la regla marque más casos.
  edad_baja <- .m1_regla("", "rango_num", list("edad"), list(min = 99))
  tope <- .m1_probar(pr, sid, edad_baja)$body
  expect_identical(tope$n_casos, 27L)
  expect_identical(tope$n_ejemplos, 20L)

  hogares <- .m1_probar(pr, sid, .m1_regla_edad(id = ""), query = "base_nombre=Hogares")$body
  expect_identical(hogares$base_nombre, "Hogares")
  expect_identical(hogares$n_filas, 10L)
  expect_identical(hogares$n_casos, 3L)
})

test_that("el criterio de caso válido del estudio reduce las filas, como en la auditoría", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  cfg <- validacion_scope_get(sid, "Personas")$operational_config
  cfg$caso_valido <- list(enabled = TRUE, condiciones = list(
    list(variable = "p4", operador = "==", valores = list("1"))
  ))
  validacion_scope_set(sid, "Personas", "operational_config", cfg)
  b <- .m1_probar(.m1_router(), sid, .m1_regla_edad(id = ""))$body
  # P4 = 1 en 7 filas; edad fuera de rango entre ellas: 15 y 30.
  expect_identical(b$n_filas, 7L)
  expect_identical(b$n_base, 7L)
  expect_identical(b$n_casos, 2L)
})

test_that("una pregunta que no está en la base no se cuenta como cero", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  b <- .m1_probar(.m1_router(), sid, .m1_regla("", "rango_num", list("no_existe"), list(min = 1)))$body
  expect_false(b$evaluada)
  expect_identical(b$estado, "no_aplicable")
  expect_true(nzchar(b$motivo))
  expect_null(b$n_casos)
  expect_null(b$n_base)
  expect_null(b$proporcion)
})

test_that("una pregunta excluida de la validación se dice", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  validacion_scope_set(sid, "Personas", "variables_excluidas", "edad")
  b <- .m1_probar(.m1_router(), sid, .m1_regla_edad(id = ""))$body
  expect_false(b$evaluada)
  expect_identical(b$estado, "variable_excluida")
  expect_match(b$motivo, "edad")
  expect_null(b$n_casos)
})

test_that("base sin respuestas: base_vacia, sin proporción", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir, datos_personas = .m1_datos()[0, ])
  withr::defer(session_delete(sid))
  b <- .m1_probar(.m1_router(), sid, .m1_regla_edad(id = ""))$body
  expect_true(b$base_vacia)
  expect_false(b$evaluada)
  expect_identical(b$n_casos, 0L)
  expect_identical(b$n_base, 0L)
  expect_null(b$proporcion)
  expect_length(b$ejemplos, 0L)
})

test_that("una regla inválida responde 400 con el código del esquema", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  pr <- .m1_router()
  r <- .m1_probar(pr, sid, .m1_regla("", "rango_num", list("edad"), list()))
  expect_identical(r$status, 400L)
  expect_identical(r$body$error$code, "E_REGLA_RANGO_VACIO")
  r2 <- .m1_probar(pr, sid, .m1_regla("", "condiciones", list("edad"), list(modo = "todas")))
  expect_identical(r2$status, 400L)
  expect_identical(r2$body$error$code, "E_REGLA_CONDICIONES_VACIAS")
  # Con la regla envuelta en {regla: ...} también se lee.
  r3 <- .m1_http(pr, sid, "POST", "/api/validacion/v2/reglas_custom/probar",
                 body = as.character(jsonlite::toJSON(list(regla = .m1_regla_edad(id = "")), auto_unbox = TRUE)))
  expect_identical(r3$status, 200L)
  expect_identical(r3$body$n_casos, 3L)
})

test_that("el conteo previo coincide con lo que marca la auditoría", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  reglas <- list(.m1_regla_edad("RC_001"), .m1_regla_p4_p21("RC_002"),
                 .m1_regla_hermanos("RC_003"), .m1_regla_item_alguna("RC_004"))
  pr <- .m1_router()
  previos <- vapply(reglas, function(r) {
    r2 <- r; r2$id <- ""
    .m1_probar(pr, sid, r2)$body$n_casos
  }, integer(1))
  validacion_scope_set(sid, "Personas", "reglas_custom", reglas)
  registro <- new.env(); registro$llamadas <- list()
  local_mocked_bindings(job_submit = .m1_jobs_en_proceso(registro))
  expect_identical(.m1_http(pr, sid, "POST", "/api/validacion/v2/auditoria")$status, 200L)
  res <- validacion_scope_get(sid, "Personas")$evaluacion$resumen
  auditados <- vapply(c("RC_001", "RC_002", "RC_003", "RC_004"), function(id) {
    as.integer(res$n_inconsistencias[res$id_regla == id])
  }, integer(1))
  expect_identical(unname(auditados), previos)
  expect_identical(previos, c(3L, 5L, 4L, 4L))
})
