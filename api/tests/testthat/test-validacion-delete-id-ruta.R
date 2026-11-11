# Los DELETE de una decisión y de una regla propia toman el id solo de la ruta.
# Con `id` como argumento formal, Plumber también volcaba ahí los campos del
# cuerpo, y un cuerpo con `id` respondía 500 (como el PUT de reglas propias).

test_that("DELETE /limpieza/decision/<id> ignora un id en el cuerpo", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  validacion_scope_set(sid, "Personas", "limpieza_draft", list(
    list(id = "PD_001", source_id = "RC_001", action_type = "ignore_rule", status = "draft"),
    list(id = "PD_002", source_id = "RC_002", action_type = "ignore_rule", status = "draft")
  ))
  r <- .m1_http(.m1_router(), sid, "DELETE", "/api/validacion/v2/limpieza/decision/PD_001",
                body = '{"id":"PD_002","base_nombre":"Personas"}')
  expect_identical(r$status, 200L)
  expect_identical(r$body$id, "PD_001")
  quedan <- vapply(validacion_scope_get(sid, "Personas")$limpieza_draft, `[[`, "", "id")
  expect_identical(quedan, "PD_002")
})

test_that("DELETE /reglas_custom/<id> ignora un id en el cuerpo", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  validacion_scope_set(sid, "Personas", "reglas_custom",
                       list(.m1_regla_edad("RC_001"), .m1_regla_p4_p21("RC_002")))
  r <- .m1_http(.m1_router(), sid, "DELETE", "/api/validacion/v2/reglas_custom/RC_001",
                body = '{"id":"RC_002","base_nombre":"Personas"}')
  expect_identical(r$status, 200L)
  expect_identical(r$body$id, "RC_001")
  quedan <- vapply(validacion_scope_get(sid, "Personas")$reglas_custom, `[[`, "", "id")
  expect_identical(quedan, "RC_002")
})
