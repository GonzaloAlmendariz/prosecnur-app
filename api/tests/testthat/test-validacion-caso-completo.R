# Caso completo y lo esperado por fila (validacion_caso_completo.R).
#
# GET /api/validacion/v2/caso?id= devuelve las respuestas del caso agrupadas por
# sección del formulario, por código y con su etiqueta al lado, y los
# hallazgos del caso en la última auditoría. El detalle de casos de una regla
# (POST /instrumento/regla) suma por fila el enunciado de lo esperado.

.m2_sesion_caso <- function(dir) {
  sid <- .m1_sesion(dir)
  validacion_scope_set(sid, "Personas", "reglas_custom",
                       list(.m1_regla_edad(), .m1_regla_p4_p21(), .m1_regla_hermanos()))
  .m2_auditar(sid, "Personas")
  sid
}

test_that("el caso completo trae sus respuestas por sección y sus hallazgos", {
  dir <- withr::local_tempdir()
  sid <- .m2_sesion_caso(dir)
  withr::defer(session_delete(sid))
  r <- .m1_http(.m1_router(), sid, "GET", "/api/validacion/v2/caso",
                query = "id=u01&base_nombre=Personas")
  expect_identical(r$status, 200L)
  b <- r$body
  expect_identical(b$base_nombre, "Personas")
  expect_identical(b$id_caso, "u01")
  expect_identical(b$tabla, "principal")
  expect_identical(b$fila, 1L)

  vars <- b$secciones[[1]]$variables
  por_nombre <- stats::setNames(vars, vapply(vars, `[[`, "", "variable"))
  expect_identical(por_nombre$edad$valor, "15")
  expect_identical(por_nombre$edad$etiqueta, "Edad")
  # Por código, con la etiqueta de la opción al lado.
  expect_identical(por_nombre$p4$valor, "1")
  expect_identical(por_nombre$p4$valor_etiqueta, "Sí")

  # u01: edad 15 (RC_001), P4 = 1 con P21 = 4 (RC_002), hermanos 0 con P15 88
  # no se marca (RC_003 pide P15 distinto de 88).
  ids <- vapply(b$hallazgos, `[[`, "", "id_regla")
  expect_setequal(ids, c("RC_001", "RC_002"))
  expect_identical(b$n_hallazgos, 2L)
  h2 <- b$hallazgos[[which(ids == "RC_002")]]
  expect_identical(h2$clase, "caso_validar")
  expect_identical(h2$tipo_regla, "coherence")
  expect_identical(h2$anomalia_tipo, "contradiccion")
  expect_setequal(vapply(h2$variables, `[[`, "", "variable"), c("p4", "p21"))
  # Etiqueta legible del tipo, como en la cola.
  expect_identical(h2$categoria, "Coherencia entre variables")
})

test_that("la cola trae las variables y el tipo de cada regla del motor", {
  # `.limpieza_rule_catalog()` unía dos veces las columnas de `reglas_meta` y
  # la cola llegaba sin variables y con el tipo adivinado por el nombre.
  dir <- withr::local_tempdir()
  sid <- .m2_sesion_caso(dir)
  withr::defer(session_delete(sid))
  cola <- .limpieza_build_decision_queue(validacion_scope_get(sid, "Personas"))
  por_id <- stats::setNames(cola, vapply(cola, `[[`, "", "source_id"))
  expect_identical(unlist(por_id$RC_001$variables), "edad")
  expect_identical(por_id$RC_001$tipo_regla, "range")
  expect_identical(por_id$RC_001$categoria_ux, "Rangos")
  expect_setequal(unlist(por_id$RC_002$variables), c("p4", "p21"))
})

test_that("un caso que no existe responde 404 con su código", {
  dir <- withr::local_tempdir()
  sid <- .m2_sesion_caso(dir)
  withr::defer(session_delete(sid))
  pr <- .m1_router()
  r <- .m1_http(pr, sid, "GET", "/api/validacion/v2/caso", query = "id=no-existe&base_nombre=Personas")
  expect_identical(r$status, 404L)
  expect_identical(r$body$error$code, "E_CASO_NO_ENCONTRADO")
  r <- .m1_http(pr, sid, "GET", "/api/validacion/v2/caso", query = "base_nombre=Personas")
  expect_identical(r$status, 400L)
  expect_identical(r$body$error$code, "E_MISSING_ID")
  r <- .m1_http(pr, sid, "GET", "/api/validacion/v2/caso", query = "id=u01&base_nombre=Hogares")
  expect_identical(r$status, 409L)
  expect_identical(r$body$error$code, "E_NO_AUDITORIA")
})

test_that("el caso completo es de solo lectura", {
  dir <- withr::local_tempdir()
  sid <- .m2_sesion_caso(dir)
  withr::defer(session_delete(sid))
  s <- session_get(sid); s$project_dirty <- FALSE; .session_env[[sid]] <- s
  antes <- validacion_scope_get(sid, "Personas")
  r <- .m1_http(.m1_router(), sid, "GET", "/api/validacion/v2/caso", query = "id=u04&base_nombre=Personas")
  expect_identical(r$status, 200L)
  expect_false(isTRUE(session_get(sid)$project_dirty))
  expect_identical(validacion_scope_get(sid, "Personas"), antes)
})

test_that("el detalle de casos de una regla suma lo esperado por fila", {
  dir <- withr::local_tempdir()
  sid <- .m2_sesion_caso(dir)
  withr::defer(session_delete(sid))
  pr <- .m1_router()
  r <- .m1_http(pr, sid, "POST", "/api/validacion/v2/instrumento/regla",
                body = '{"id_regla":"RC_002","base_nombre":"Personas"}')
  expect_identical(r$status, 200L)
  expect_length(r$body$esperado, length(r$body$casos))
  e1 <- r$body$esperado[[1]]
  expect_identical(e1$anomalia_tipo, "contradiccion")
  expect_identical(e1$sujeto, unlist(r$body$case_ids)[1])
  expect_match(e1$choque, "1", fixed = TRUE)
  expect_true(nzchar(e1$texto))

  # Condiciones combinadas no tiene tipo de anomalía: no hay enunciado.
  r3 <- .m1_http(pr, sid, "POST", "/api/validacion/v2/instrumento/regla",
                 body = '{"id_regla":"RC_003","base_nombre":"Personas"}')
  expect_identical(r3$status, 200L)
  expect_gt(length(r3$body$casos), 0L)
  expect_length(r3$body$esperado, length(r3$body$casos))
  expect_true(all(vapply(r3$body$esperado, is.null, logical(1))))
  expect_null(r3$body$coincide_con)
})

test_that("con llave declarada (que se ignora), el detalle y el caso usan los ids de la cola", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad()))
  .m2_declarar_llave(sid, "Personas", "caso")
  .m2_auditar(sid, "Personas")
  pr <- .m1_router()
  r <- .m1_http(pr, sid, "POST", "/api/validacion/v2/instrumento/regla",
                body = '{"id_regla":"RC_001","base_nombre":"Personas"}')
  expect_identical(unlist(r$body$case_ids), c("u01", "u04", "u08"))
  expect_identical(.m2_ids_marcados(sid, "Personas", "RC_001"), unlist(r$body$case_ids))
  rc <- .m1_http(pr, sid, "GET", "/api/validacion/v2/caso", query = "id=u04&base_nombre=Personas")
  expect_identical(rc$status, 200L)
  expect_identical(rc$body$identificacion_casos$metodo, "columna_candidata")
  expect_identical(vapply(rc$body$hallazgos, `[[`, "", "id_regla"), "RC_001")
})

test_that("lo esperado se cruza por id de caso aunque las filas lleguen en otro orden", {
  df <- data.frame(respondent_id = c("a", "b", "c", "d"), edad = c(10, 20, 30, 40))
  # La regla marca b y d; el detalle las trae al revés.
  casos <- data.frame(respondent_id = c("d", "b"))
  expect_identical(.validacion_filas_de_casos(casos, df, c(2L, 4L)), c(4L, 2L))
  # Un id que no está entre los marcados no se ubica.
  expect_identical(.validacion_filas_de_casos(data.frame(respondent_id = c("d", "z")), df, c(2L, 4L)),
                   c(4L, NA_integer_))
  # Sin columna de identidad: por posición solo con el mismo largo.
  expect_identical(.validacion_filas_de_casos(data.frame(x = 1:2), df, c(2L, 4L)), c(2L, 4L))
  expect_identical(.validacion_filas_de_casos(data.frame(x = 1:3), df, c(2L, 4L)), rep(NA_integer_, 3))
})
