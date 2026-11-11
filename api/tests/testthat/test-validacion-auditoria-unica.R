# Auditoría única de Validación (validacion_auditoria.R).
#
# La regresión que la motivó: POST /instrumento/auditoria armaba el paquete solo
# con el plan del formulario y POST /reglas_custom/ejecutar sumaba plan y reglas
# propias, y las dos escribían la misma evaluación. Auditar desde "Reglas del
# formulario" después de ejecutar las propias borraba sus hallazgos. Y
# /ejecutar respondía 409 si había plan pero ninguna regla propia.
#
# El trabajo `callr` se sustituye por una evaluación en proceso con el mismo
# motor (`.m1_jobs_en_proceso`), que no depende de cómo cada versión definía la
# función del trabajo.

.m1_ids_evaluados <- function(sid, base) {
  as.character(validacion_scope_get(sid, base)$evaluacion$resumen$id_regla)
}

.m1_n_regla <- function(sid, base, id) {
  res <- validacion_scope_get(sid, base)$evaluacion$resumen
  as.integer(res$n_inconsistencias[as.character(res$id_regla) == id])
}

test_that("los hallazgos de las reglas propias sobreviven a una auditoría desde el formulario", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  plan <- .m1_plan(sid, "Personas")
  id_plan <- as.character(plan$rules[[1]]$id)
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad()))
  registro <- new.env(); registro$llamadas <- list()
  local_mocked_bindings(job_submit = .m1_jobs_en_proceso(registro))
  pr <- .m1_router()

  r1 <- .m1_http(pr, sid, "POST", "/api/validacion/v2/reglas_custom/ejecutar")
  expect_identical(r1$status, 200L)
  expect_setequal(.m1_ids_evaluados(sid, "Personas"), c(id_plan, "RC_001"))
  # Edad fuera de 16 a 25: 15, 30 y 26.
  expect_identical(.m1_n_regla(sid, "Personas", "RC_001"), 3L)

  r2 <- .m1_http(pr, sid, "POST", "/api/validacion/v2/instrumento/auditoria")
  expect_identical(r2$status, 200L)
  expect_setequal(.m1_ids_evaluados(sid, "Personas"), c(id_plan, "RC_001"))
  expect_identical(.m1_n_regla(sid, "Personas", "RC_001"), 3L)
})

test_that("/reglas_custom/ejecutar audita el plan aunque no haya reglas propias", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  plan <- .m1_plan(sid, "Personas")
  registro <- new.env(); registro$llamadas <- list()
  local_mocked_bindings(job_submit = .m1_jobs_en_proceso(registro))

  r <- .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/reglas_custom/ejecutar")
  expect_identical(r$status, 200L)
  expect_identical(.m1_ids_evaluados(sid, "Personas"), as.character(plan$rules[[1]]$id))
  # Edad vacía en un caso.
  expect_identical(.m1_n_regla(sid, "Personas", as.character(plan$rules[[1]]$id)), 1L)
})

test_that("sin plan ni reglas propias, cada ruta dice qué falta", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  registro <- new.env(); registro$llamadas <- list()
  local_mocked_bindings(job_submit = .m1_jobs_en_proceso(registro))
  pr <- .m1_router()

  r1 <- .m1_http(pr, sid, "POST", "/api/validacion/v2/auditoria")
  expect_identical(r1$status, 409L)
  expect_identical(r1$body$error$code, "E_NO_REGLAS_AUDITABLES")
  r2 <- .m1_http(pr, sid, "POST", "/api/validacion/v2/reglas_custom/ejecutar")
  expect_identical(r2$status, 409L)
  expect_identical(r2$body$error$code, "E_NO_REGLAS_ACTIVAS")
  r3 <- .m1_http(pr, sid, "POST", "/api/validacion/v2/instrumento/auditoria")
  expect_identical(r3$status, 409L)
  expect_identical(r3$body$error$code, "E_NO_PLAN")
  expect_length(registro$llamadas, 0L)
})

test_that("el paquete quita desactivadas e inactivas y no duplica por id", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  plan <- .m1_plan(sid, "Personas")
  id_plan <- as.character(plan$rules[[1]]$id)
  inactiva <- .m1_regla_p4_p21("RC_009"); inactiva$activa <- FALSE
  validacion_scope_set(sid, "Personas", "reglas_custom",
                       list(.m1_regla_edad(), .m1_regla_hermanos(), inactiva))
  validacion_scope_set(sid, "Personas", "reglas_desactivadas", "RC_003")

  p <- validacion_paquete_auditable(sid, "Personas")
  ids <- vapply(p$bundle$rules, function(r) r$id, character(1))
  expect_setequal(ids, c(id_plan, "RC_001"))
  expect_identical(p$n_plan, 1L)
  expect_identical(p$n_propias, 1L)
  expect_false(anyDuplicated(ids) > 0)
  expect_setequal(as.character(p$bundle$plan$ID), ids)

  # Una regla propia con el id de una del plan no se duplica: queda la del plan.
  gemela <- .m1_regla_edad(id_plan)
  validacion_scope_set(sid, "Personas", "reglas_custom", list(gemela))
  validacion_scope_set(sid, "Personas", "reglas_desactivadas", character(0))
  p2 <- validacion_paquete_auditable(sid, "Personas")
  expect_length(p2$bundle$rules, 1L)
  expect_identical(p2$bundle$rules[[1]]$fuente, plan$rules[[1]]$fuente)
})

test_that("multibase: audita la base pedida o la activa, y no toca la hermana", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir, activa = "Personas")
  withr::defer(session_delete(sid))
  .m1_plan(sid, "Hogares")
  .m1_plan(sid, "Personas")
  validacion_scope_set(sid, "Hogares", "reglas_custom", list(.m1_regla_edad("RC_010")))
  registro <- new.env(); registro$llamadas <- list()
  local_mocked_bindings(job_submit = .m1_jobs_en_proceso(registro))
  pr <- .m1_router()

  # Sin base: la activa (Personas), no la primera (Hogares).
  r1 <- .m1_http(pr, sid, "POST", "/api/validacion/v2/auditoria")
  expect_identical(r1$status, 200L)
  expect_identical(r1$body$base_nombre, "Personas")
  expect_null(validacion_scope_get(sid, "Hogares")$evaluacion)
  expect_false("RC_010" %in% .m1_ids_evaluados(sid, "Personas"))

  # Con base explícita: solo Hogares, y la evaluación de Personas queda igual.
  antes <- validacion_scope_get(sid, "Personas")$evaluacion$huella_reglas
  r2 <- .m1_http(pr, sid, "POST", "/api/validacion/v2/auditoria", query = "base_nombre=Hogares")
  expect_identical(r2$status, 200L)
  expect_identical(r2$body$base_nombre, "Hogares")
  expect_true("RC_010" %in% .m1_ids_evaluados(sid, "Hogares"))
  expect_identical(validacion_scope_get(sid, "Personas")$evaluacion$huella_reglas, antes)
  expect_identical(registro$llamadas[[2]]$args$base_name, "Hogares")

  # La base también llega por la consulta en GET y por el cuerpo en POST: los
  # handlers aceptan argumentos que no declaran (antes respondían 500).
  e <- .m1_http(pr, sid, "GET", "/api/validacion/v2/auditoria/estado", query = "base_nombre=Hogares")
  expect_identical(e$status, 200L)
  expect_identical(e$body$base_nombre, "Hogares")
  expect_identical(e$body$estado, "vigente")
  cuerpo <- as.character(jsonlite::toJSON(list(base_nombre = "Hogares"), auto_unbox = TRUE))
  r3 <- .m1_http(pr, sid, "POST", "/api/validacion/v2/reglas_custom/ejecutar", body = cuerpo)
  expect_identical(r3$status, 200L)
  expect_identical(r3$body$base_nombre, "Hogares")
  expect_identical(r3$body$n_custom, 1L)
  r4 <- .m1_http(pr, sid, "POST", "/api/validacion/v2/instrumento/auditoria", body = cuerpo)
  expect_identical(r4$status, 200L)
  expect_identical(r4$body$base_nombre, "Hogares")
})

test_that("la huella dice si las reglas cambiaron desde la última auditoría", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  .m1_plan(sid, "Personas")
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad()))
  registro <- new.env(); registro$llamadas <- list()
  local_mocked_bindings(job_submit = .m1_jobs_en_proceso(registro))
  pr <- .m1_router()
  estado <- function() .m1_http(pr, sid, "GET", "/api/validacion/v2/auditoria/estado")$body

  expect_identical(estado()$estado, "sin_auditoria")
  expect_identical(.m1_http(pr, sid, "POST", "/api/validacion/v2/auditoria")$status, 200L)
  e1 <- estado()
  expect_identical(e1$estado, "vigente")
  expect_identical(e1$n_reglas_vigentes, 2L)
  expect_identical(e1$n_reglas_auditadas, 2L)
  expect_identical(e1$huella_vigente, e1$huella_auditada)
  ev <- validacion_scope_get(sid, "Personas")$evaluacion
  expect_setequal(names(ev$huella_reglas$por_regla), .m1_ids_evaluados(sid, "Personas"))
  expect_true(nzchar(ev$auditada_en))

  # Renombrar no cambia qué casos marca: sigue vigente.
  r <- .m1_http(pr, sid, "PUT", "/api/validacion/v2/reglas_custom/RC_001",
                body = as.character(jsonlite::toJSON(list(nombre = "Edad fuera del rango"), auto_unbox = TRUE)))
  expect_identical(r$status, 200L)
  expect_identical(estado()$estado, "vigente")

  # Cambiar el rango sí.
  r <- .m1_http(pr, sid, "PUT", "/api/validacion/v2/reglas_custom/RC_001",
                body = as.character(jsonlite::toJSON(list(params = list(min = 18, max = 25)), auto_unbox = TRUE)))
  expect_identical(r$status, 200L)
  e2 <- estado()
  expect_identical(e2$estado, "desactualizada")
  expect_identical(unlist(e2$cambios$modificadas), "RC_001")

  # Una regla nueva aparece como agregada.
  r <- .m1_http(pr, sid, "POST", "/api/validacion/v2/reglas_custom",
                body = as.character(jsonlite::toJSON(.m1_regla_hermanos("RC_002"), auto_unbox = TRUE)))
  expect_identical(r$status, 200L)
  e3 <- estado()
  expect_identical(e3$estado, "desactualizada")
  expect_identical(unlist(e3$cambios$agregadas), "RC_002")

  # Una auditoría guardada antes de la huella: se comparan los ids.
  expect_identical(.m1_http(pr, sid, "POST", "/api/validacion/v2/auditoria")$status, 200L)
  ev <- validacion_scope_get(sid, "Personas")$evaluacion
  ev$huella_reglas <- NULL
  validacion_scope_set(sid, "Personas", "evaluacion", ev)
  expect_identical(estado()$estado, "sin_huella")
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad()))
  e4 <- estado()
  expect_identical(e4$estado, "desactualizada")
  expect_identical(unlist(e4$cambios$quitadas), "RC_002")
})

test_that("una regla propia que el motor no puede traducir corta la auditoría y dice cuál", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  .m1_plan(sid, "Personas")
  rota <- .m1_regla("RC_005", "tipo_inexistente", list("edad"))
  validacion_scope_set(sid, "Personas", "reglas_custom", list(rota))
  registro <- new.env(); registro$llamadas <- list()
  local_mocked_bindings(job_submit = .m1_jobs_en_proceso(registro))

  r <- .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/auditoria")
  expect_identical(r$status, 422L)
  expect_identical(r$body$error$code, "E_REGLA_NO_EVALUABLE")
  expect_identical(r$body$error$details$id_regla, "RC_005")
  expect_length(registro$llamadas, 0L)
})

test_that("las reglas de secuencia y de cruce de identidad se pueden auditar", {
  dir <- withr::local_tempdir()
  datos <- .m1_datos()
  datos$envio <- c(1, 2, 3, 5, 6, 7, 8, 9, 10, 11)
  datos$inicio <- "2026-05-01T10:00:00"
  datos$fin <- "2026-05-01T10:30:00"
  sid <- .m1_sesion(dir, datos_personas = datos)
  withr::defer(session_delete(sid))
  validacion_scope_set(sid, "Personas", "reglas_custom", list(
    .m1_regla("RC_006", "continuidad_secuencia", list("envio")),
    .m1_regla("RC_007", "cruce_identidad", list("inicio", "fin", "hermanos"))
  ))
  registro <- new.env(); registro$llamadas <- list()
  local_mocked_bindings(job_submit = .m1_jobs_en_proceso(registro))

  r <- .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/auditoria")
  expect_identical(r$status, 200L)
  # Falta el envío 4: se marca el 3, el que precede al hueco.
  expect_identical(.m1_n_regla(sid, "Personas", "RC_006"), 1L)
  # Misma llave y misma ventana: los 3 casos con hermanos = 1 y los 7 con 0.
  expect_identical(.m1_n_regla(sid, "Personas", "RC_007"), 10L)
})

# --- Contrato HTTP con el servidor real y el trabajo `callr` real -------------

test_that("HTTP: auditar acnur_acg con el trabajo real deja la huella y el estado vigente", {
  srv <- http_contract_server()
  http_contract_skip_if_no_jobs_runtime()
  pulso <- system.file("reference_projects", "acnur_acg", "acnur_acg.pulso", package = "prosecnurapp")
  if (!nzchar(pulso)) pulso <- testthat::test_path("..", "..", "inst", "reference_projects", "acnur_acg", "acnur_acg.pulso")
  skip_if_not(file.exists(pulso), "sin el proyecto acnur_acg")
  copia <- withr::local_tempdir()
  file.copy(pulso, file.path(copia, "ref.pulso"))
  abierto <- http_post_json(srv, "/api/project/open", body = list(path = file.path(copia, "ref.pulso")))
  expect_identical(abierto$status, 200L)
  sid <- abierto$json$session_id

  antes <- http_get(srv, "/api/validacion/v2/auditoria/estado", sid = sid)
  expect_identical(antes$status, 200L)
  expect_identical(antes$json$estado, "sin_auditoria")
  expect_identical(antes$json$n_reglas_vigentes, 94L)

  lanzada <- http_post_json(srv, "/api/validacion/v2/auditoria", sid = sid)
  expect_identical(lanzada$status, 200L)
  expect_identical(lanzada$json$n_reglas, 94L)
  fin <- http_wait_job(srv, lanzada$json$job_id)
  expect_identical(as.character(fin$status), "done")

  despues <- http_get(srv, "/api/validacion/v2/auditoria/estado", sid = sid)
  expect_identical(despues$json$estado, "vigente")
  expect_identical(despues$json$huella_auditada, lanzada$json$huella_reglas)
  expect_identical(http_get(srv, "/api/validacion/v2/instrumento/resultado", sid = sid)$status, 200L)

  probada <- http_post_json(srv, "/api/validacion/v2/reglas_custom/probar", sid = sid,
                            body = list(tipo = "rango_num", nombre = "Edad", variables = list("E1_age"),
                                        params = list(min = 18, max = 60)))
  expect_identical(probada$status, 200L)
  expect_true(isTRUE(probada$json$evaluada))
  expect_true(probada$json$n_base >= probada$json$n_casos)
})
