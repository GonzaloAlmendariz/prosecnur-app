# Detalle de casos de una regla por páginas (validacion_detalle_paginas.R).
#
# Ítem 22 del checklist de validación del practicante: el detalle publicaba
# los primeros 500 casos y la tabla, el caso y la Decisión tomaban ese largo
# por el total. Ahora se pide por páginas y publica `n_casos_total`.

test_that("la página de casos calcula sus posiciones y si quedan más", {
  p <- .validacion_pagina_de_casos(853L)
  expect_identical(p$indices, 1:500)
  expect_identical(p$n_total, 853L)
  expect_true(p$hay_mas)
  p2 <- .validacion_pagina_de_casos(853L, desde = 500, limite = 500)
  expect_identical(p2$indices, 501:853)
  expect_false(p2$hay_mas)
  expect_identical(.validacion_pagina_de_casos(10L, desde = 10)$indices, integer(0))
  expect_identical(.validacion_pagina_de_casos(0L)$indices, integer(0))
})

test_that("una página mal pedida falla con su causa", {
  e <- tryCatch(.validacion_pagina_de_casos(10L, limite = 0), error = identity)
  expect_identical(e$code, "E_BAD_REQUEST")
  expect_match(conditionMessage(e), "limite", fixed = TRUE)
  expect_error(.validacion_pagina_de_casos(10L, limite = 5000))
  expect_error(.validacion_pagina_de_casos(10L, desde = -1))
  expect_error(.validacion_pagina_de_casos(10L, desde = "dos"))
})

test_that("el detalle publica el total de la regla y pagina sus casos en orden", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad()))
  .m2_declarar_llave(sid, "Personas", "caso")
  .m2_auditar(sid, "Personas")
  pr <- .m1_router()

  entero <- .m1_http(pr, sid, "POST", "/api/validacion/v2/instrumento/regla",
                     body = '{"id_regla":"RC_001","base_nombre":"Personas"}')
  expect_identical(entero$status, 200L)
  expect_identical(entero$body$n_casos_total, 3L)
  expect_false(entero$body$hay_mas)

  p1 <- .m1_http(pr, sid, "POST", "/api/validacion/v2/instrumento/regla",
                 body = '{"id_regla":"RC_001","base_nombre":"Personas","limite":2}')
  expect_identical(p1$status, 200L)
  expect_identical(p1$body$n_casos_total, 3L)
  expect_true(p1$body$hay_mas)
  expect_length(p1$body$casos, 2L)
  expect_identical(unlist(p1$body$case_ids), c("u01", "u04"))
  expect_length(p1$body$esperado, 2L)

  p2 <- .m1_http(pr, sid, "POST", "/api/validacion/v2/instrumento/regla",
                 body = '{"id_regla":"RC_001","base_nombre":"Personas","desde":2,"limite":2}')
  expect_identical(p2$status, 200L)
  expect_false(p2$body$hay_mas)
  expect_identical(unlist(p2$body$case_ids), "u08")
  expect_length(p2$body$casos, 1L)
  # Las dos páginas juntas son el detalle entero, en el mismo orden.
  expect_identical(c(unlist(p1$body$case_ids), unlist(p2$body$case_ids)), unlist(entero$body$case_ids))

  mal <- .m1_http(pr, sid, "POST", "/api/validacion/v2/instrumento/regla",
                  body = '{"id_regla":"RC_001","base_nombre":"Personas","limite":0}')
  expect_identical(mal$status, 400L)
  expect_identical(mal$body$error$code, "E_BAD_REQUEST")
})
