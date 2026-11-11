# Cifras de cabecera de Hallazgos en casos distintos (limpieza_builder.R).
#
# La tarjeta "Total inconsistencias" suma regla por regla: un caso marcado por
# dos reglas cuenta dos. Eso es un conteo de hallazgos, no de casos. La
# respuesta de la limpieza publica además los casos distintos, sin cambiar el
# significado de la tarjeta.

test_that("un caso con dos hallazgos cuenta 1 caso y 2 hallazgos", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir, datos_personas = .m2_datos_un_caso_dos_hallazgos())
  withr::defer(session_delete(sid))
  validacion_scope_set(sid, "Personas", "reglas_custom",
                       list(.m1_regla_edad(), .m1_regla_p4_p21()))
  .m2_auditar(sid, "Personas")
  expect_identical(.m2_ids_marcados(sid, "Personas", "RC_001"), "u01")
  expect_identical(.m2_ids_marcados(sid, "Personas", "RC_002"), "u01")

  limpieza <- build_limpieza(validacion_scope_get(sid, "Personas"))
  cifras <- limpieza$cifras_hallazgos
  expect_identical(cifras$n_hallazgos, 2L)
  expect_identical(cifras$n_casos_con_hallazgos, 1L)
  expect_identical(cifras$n_casos_evaluados, 10L)
  expect_identical(cifras$n_reglas_con_casos, 2L)
  expect_identical(cifras$por_tabla[[1]]$tabla, "principal")
  expect_identical(cifras$por_tabla[[1]]$n_encuestados_con_hallazgos, 1L)
  expect_identical(cifras$n_encuestados_con_hallazgos, 1L)

  # La tarjeta conserva su significado: hallazgos.
  tarjeta <- Filter(function(k) identical(k$title, "Total inconsistencias"), limpieza$kpis)[[1]]
  expect_identical(as.integer(tarjeta$meta$value), 2L)
})

test_that("los casos distintos se cuentan por el id de caso de la cola en la base pedida", {
  dir <- withr::local_tempdir()
  # Hogares con los datos de M1 (varios casos marcados); Personas, un solo caso.
  sid <- .m1_sesion(dir, activa = "Hogares", datos_personas = .m2_datos_un_caso_dos_hallazgos())
  withr::defer(session_delete(sid))
  for (b in c("Hogares", "Personas")) {
    validacion_scope_set(sid, b, "reglas_custom", list(.m1_regla_edad(), .m1_regla_p4_p21()))
    .m2_auditar(sid, b)
  }
  pr <- .m1_router()
  r <- .m1_http(pr, sid, "GET", "/api/validacion/v2/limpieza", query = "base_nombre=Personas")
  expect_identical(r$status, 200L)
  expect_identical(r$body$base_nombre, "Personas")
  expect_identical(r$body$cifras_hallazgos$n_casos_con_hallazgos, 1L)

  # La base activa (Hogares) no cae en la primera ni en la pedida antes.
  r_h <- .m1_http(pr, sid, "GET", "/api/validacion/v2/limpieza")
  ids_h <- unique(c(.m2_ids_marcados(sid, "Hogares", "RC_001"),
                    .m2_ids_marcados(sid, "Hogares", "RC_002")))
  expect_identical(r_h$body$cifras_hallazgos$n_casos_con_hallazgos, length(ids_h))
  expect_identical(r_h$body$cifras_hallazgos$n_hallazgos,
                   length(.m2_ids_marcados(sid, "Hogares", "RC_001")) +
                     length(.m2_ids_marcados(sid, "Hogares", "RC_002")))
  expect_gt(r_h$body$cifras_hallazgos$n_hallazgos, r_h$body$cifras_hallazgos$n_casos_con_hallazgos)
})

test_that("sin auditoría las cifras de hallazgos van nulas, no en cero", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  r <- .m1_http(.m1_router(), sid, "GET", "/api/validacion/v2/limpieza", query = "base_nombre=Personas")
  expect_identical(r$status, 200L)
  expect_null(r$body$cifras_hallazgos)
  expect_null(r$body$identificacion_casos)
})
