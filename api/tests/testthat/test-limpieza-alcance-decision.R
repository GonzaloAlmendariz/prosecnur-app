# A qué casos llega una decisión sobre la regla entera (D-F2, M4;
# limpieza_alcance_decision.R).
#
# "Ignorar la regla" sigue a la última auditoría; excluir, corregir e imputar
# quedan en los casos que la regla marcaba al pasar a lista, y los que una
# auditoría posterior marque de nuevo quedan pendientes. Por decisión se
# publican `seguimiento`, `casos_nuevos`, `casos_que_ya_no_marca`,
# `n_casos_aplicados` y `alcance`.

# Personas: edad c(15, 18, 20, 30, 22, 16, 25, 26, NA, 19). La regla de 16 a 25
# marca u01, u04 y u08; con 17 a 27 marca u01, u04 y u06 (u06 = 16 es nuevo y
# u08 = 26 ya no se marca).
.da_sesion <- function(dir) {
  sid <- .m1_sesion(dir)
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad()))
  .m2_auditar(sid, "Personas")
  sid
}

.da_reauditar_17_27 <- function(sid) {
  regla <- .m1_regla_edad(); regla$params$min <- 17; regla$params$max <- 27
  validacion_scope_set(sid, "Personas", "reglas_custom", list(regla))
  .m2_auditar(sid, "Personas")
}

.da_guardar <- function(sid, cuerpo) {
  r <- .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/decision", body = cuerpo)
  expect_identical(r$status, 200L)
  r$body
}

.da_limpieza <- function(sid) {
  r <- .m1_http(.m1_router(), sid, "GET", "/api/validacion/v2/limpieza", query = "base_nombre=Personas")
  expect_identical(r$status, 200L)
  r$body
}

test_that("D-F2: una exclusión de la regla entera no alcanza los casos nuevos y los deja pendientes", {
  dir <- withr::local_tempdir()
  sid <- .da_sesion(dir)
  withr::defer(session_delete(sid))
  .da_guardar(sid, '{"source_id":"RC_001","action_type":"exclude_cases","status":"ready","rationale":"Fuera del universo","base_nombre":"Personas"}')
  .da_reauditar_17_27(sid)

  scope <- validacion_scope_get(sid, "Personas")
  d <- scope$limpieza_draft[[1]]
  out <- .limpieza_apply_decisions_to_data(.m1_datos(), scope, list(d))
  expect_setequal(setdiff(.m1_datos()$respondent_id, out$data$respondent_id), c("u01", "u04", "u08"))

  b <- .da_limpieza(sid)
  pub <- b$decision_draft[[1]]
  expect_identical(pub$seguimiento, "congelada")
  expect_identical(pub$n_casos_al_decidir, 3L)
  expect_identical(unlist(pub$casos_nuevos), "u06")
  expect_identical(unlist(pub$casos_que_ya_no_marca), "u08")
  expect_identical(pub$n_casos_aplicados, 3L)
  expect_identical(pub$alcance, "caso")
  expect_true(pub$aplicable)
  # La cola cuenta el caso nuevo como pendiente: la base no queda lista.
  q <- Filter(function(x) identical(x$source_id, "RC_001"), b$decision_queue)[[1]]
  expect_identical(q$n_casos, 3L)
  expect_identical(q$n_casos_cubiertos, 2L)
  expect_identical(q$n_casos_pendientes, 1L)
  expect_true(q$pending)
  expect_false(b$summary$ready_to_finalize)
})

test_that("D-F2: una corrección de la regla entera también queda en sus casos", {
  dir <- withr::local_tempdir()
  sid <- .da_sesion(dir)
  withr::defer(session_delete(sid))
  .da_guardar(sid, '{"source_id":"RC_001","action_type":"set_value","target_variable":"edad","action_params":{"value":20},"status":"ready","rationale":"x","base_nombre":"Personas"}')
  .da_reauditar_17_27(sid)
  scope <- validacion_scope_get(sid, "Personas")
  out <- .limpieza_apply_decisions_to_data(.m1_datos(), scope, scope$limpieza_draft)
  # Cambian u01, u04 y u08 (la lista); u06 (16, nuevo) queda como estaba.
  expect_identical(out$data$edad, c(20, 18, 20, 20, 22, 16, 25, 20, NA, 19))
})

test_that("D-F2: ignorar la regla sigue a la última auditoría y cubre los casos nuevos", {
  dir <- withr::local_tempdir()
  sid <- .da_sesion(dir)
  withr::defer(session_delete(sid))
  .da_guardar(sid, '{"source_id":"RC_001","action_type":"ignore_rule","status":"ready","rationale":"x","base_nombre":"Personas"}')
  .da_reauditar_17_27(sid)
  b <- .da_limpieza(sid)
  pub <- b$decision_draft[[1]]
  expect_identical(pub$seguimiento, "sigue_a_la_regla")
  expect_null(pub$casos_nuevos)
  expect_identical(pub$n_casos_aplicados, 3L)
  q <- Filter(function(x) identical(x$source_id, "RC_001"), b$decision_queue)[[1]]
  expect_false(q$pending)
  expect_identical(q$n_casos_cubiertos, 3L)
})

test_that("D-F2: volver a guardarla con incluir_casos_nuevos resuelve la lista de nuevo", {
  dir <- withr::local_tempdir()
  sid <- .da_sesion(dir)
  withr::defer(session_delete(sid))
  b1 <- .da_guardar(sid, '{"source_id":"RC_001","action_type":"exclude_cases","status":"ready","rationale":"x","base_nombre":"Personas"}')
  id <- b1$decision$id
  .da_reauditar_17_27(sid)
  # Guardarla otra vez sin pedirlo conserva la lista de entonces.
  b2 <- .da_guardar(sid, sprintf('{"id":"%s","source_id":"RC_001","action_type":"exclude_cases","status":"ready","rationale":"y","base_nombre":"Personas"}', id))
  expect_identical(unlist(b2$decision$target_case_ids_resueltos), c("u01", "u04", "u08"))
  b3 <- .da_guardar(sid, sprintf('{"id":"%s","source_id":"RC_001","action_type":"exclude_cases","status":"ready","rationale":"y","incluir_casos_nuevos":true,"base_nombre":"Personas"}', id))
  # O2: congelados más nuevos (u08 sigue: lo congelado es congelado).
  expect_setequal(unlist(b3$decision$target_case_ids_resueltos), c("u01", "u04", "u08", "u06"))
  expect_null(b3$decision$incluir_casos_nuevos)
  pub <- b3$decision_draft[[1]]
  expect_length(pub$casos_nuevos, 0L)
})

test_that("D-F2: una lista vacía no se aplica a nadie y lo dice; sin registro sigue a la auditoría", {
  df <- data.frame(respondent_id = sprintf("r%d", 1:4), edad = c(15, 20, 21, 30), f = c(TRUE, FALSE, FALSE, TRUE))
  ev <- list(resumen = tibble::tibble(id_regla = "R1", tabla = "principal", flag = "f", n_inconsistencias = 2L),
             datos_tablas = list(principal = df), datos = df)
  scope <- list(evaluacion = ev)
  vacia <- list(id = "PD_1", source_id = "R1", action_type = "exclude_cases", status = "ready", rationale = "x",
                target_case_ids_resueltos = list(),
                identificacion_casos = list(metodo = "anterior", columna = "respondent_id"))
  out <- .limpieza_apply_decisions_to_data(df, scope, list(vacia))
  expect_identical(nrow(out$data), 4L)
  expect_true(any(grepl("la regla no marcaba casos cuando se dio por lista", out$warnings, fixed = TRUE)))
  a <- .limpieza_decisiones_con_aplicabilidad(list(vacia), scope)[[1]]
  expect_false(a$aplicable)
  expect_identical(a$motivo_no_aplicable, "sin_casos_al_decidir")
  s <- limpieza_seguimiento_decision(vacia, scope)
  expect_identical(s$seguimiento, "congelada")
  expect_setequal(unlist(s$casos_nuevos), c("r1", "r4"))

  # Una decisión anterior al registro no tiene lista: sigue a la auditoría.
  antigua <- vacia; antigua$target_case_ids_resueltos <- NULL; antigua$identificacion_casos <- NULL
  out2 <- .limpieza_apply_decisions_to_data(df, scope, list(antigua))
  expect_identical(out2$data$respondent_id, c("r2", "r3"))
  expect_identical(limpieza_seguimiento_decision(antigua, scope)$seguimiento, "sin_registro")
})

test_that("D-F3: una decisión sobre la regla de un grupo repetido declara que llega al encuestado", {
  madre <- data.frame(`_uuid` = c("A", "B", "C"), x = 1:3, check.names = FALSE)
  hija <- data.frame(`_uuid` = c("A", "A", "B"), `_index` = 1:3, y = 1:3, f = c(TRUE, TRUE, FALSE),
                     check.names = FALSE)
  ev <- list(resumen = tibble::tibble(id_regla = "R1", tabla = "rep", flag = "f", n_inconsistencias = 2L),
             datos_tablas = list(principal = madre, rep = hija), datos = madre)
  scope <- list(evaluacion = ev)
  d <- list(id = "PD_1", source_id = "R1", action_type = "exclude_cases", status = "ready", rationale = "x",
            target_case_ids_resueltos = list("A"),
            identificacion_casos = list(metodo = "anterior", columna = "_uuid"))
  s <- limpieza_seguimiento_decision(d, scope)
  expect_identical(s$alcance, "encuestado")
  expect_identical(s$n_casos_aplicados, 1L)
  out <- .limpieza_apply_decisions_to_data(madre, scope, list(d))
  expect_identical(out$data$`_uuid`, c("B", "C"))
})

# --- Ronda 2 (VERIFICACION_MOTOR_M4: B1, B2, O1, O2, O3) ----------------------

test_that("B1: borrar una decisión y crear otra no repite el id de una viva", {
  dir <- withr::local_tempdir()
  sid <- .da_sesion(dir)
  withr::defer(session_delete(sid))
  validacion_scope_set(sid, "Personas", "reglas_custom",
                       list(.m1_regla_edad(), .m1_regla_p4_p21(), .m1_regla_hermanos()))
  .m2_auditar(sid, "Personas")
  a <- .da_guardar(sid, '{"source_id":"RC_001","action_type":"exclude_cases","status":"ready","rationale":"x","base_nombre":"Personas"}')$decision$id
  b <- .da_guardar(sid, '{"source_id":"RC_002","action_type":"exclude_cases","status":"ready","rationale":"x","base_nombre":"Personas"}')$decision$id
  r <- .m1_http(.m1_router(), sid, "DELETE", paste0("/api/validacion/v2/limpieza/decision/", a),
                query = "base_nombre=Personas")
  expect_identical(r$status, 200L)
  c3 <- .da_guardar(sid, '{"source_id":"RC_003","action_type":"exclude_cases","status":"draft","base_nombre":"Personas"}')$decision$id
  expect_false(identical(c3, b))
  ids <- vapply(validacion_scope_get(sid, "Personas")$limpieza_draft, `[[`, "", "id")
  expect_false(anyDuplicated(ids) > 0L)
})

test_that("B1: guardar con el mismo id y otra regla no hereda la lista de la regla anterior", {
  dir <- withr::local_tempdir()
  sid <- .da_sesion(dir)
  withr::defer(session_delete(sid))
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad(), .m1_regla_hermanos()))
  .m2_auditar(sid, "Personas")
  id <- .da_guardar(sid, '{"source_id":"RC_001","action_type":"exclude_cases","status":"ready","rationale":"x","base_nombre":"Personas"}')$decision$id
  b <- .da_guardar(sid, sprintf('{"id":"%s","source_id":"RC_003","action_type":"exclude_cases","status":"ready","rationale":"x","base_nombre":"Personas"}', id))
  marca3 <- .m2_ids_marcados(sid, "Personas", "RC_003")
  expect_setequal(unlist(b$decision$target_case_ids_resueltos), marca3)
  scope <- validacion_scope_get(sid, "Personas")
  out <- .limpieza_apply_decisions_to_data(.m1_datos(), scope, scope$limpieza_draft)
  expect_setequal(setdiff(.m1_datos()$respondent_id, out$data$respondent_id), marca3)
})

test_that("O1: pasar de ignorar a excluir congela con la auditoría vigente", {
  dir <- withr::local_tempdir()
  sid <- .da_sesion(dir)
  withr::defer(session_delete(sid))
  id <- .da_guardar(sid, '{"source_id":"RC_001","action_type":"ignore_rule","status":"ready","rationale":"x","base_nombre":"Personas"}')$decision$id
  .da_reauditar_17_27(sid)
  b <- .da_guardar(sid, sprintf('{"id":"%s","source_id":"RC_001","action_type":"exclude_cases","status":"ready","rationale":"x","base_nombre":"Personas"}', id))
  expect_setequal(unlist(b$decision$target_case_ids_resueltos), c("u01", "u04", "u06"))
})

test_that("O2: incluir los casos nuevos suma a la lista y no saca a los que ya no marca", {
  dir <- withr::local_tempdir()
  sid <- .da_sesion(dir)
  withr::defer(session_delete(sid))
  id <- .da_guardar(sid, '{"source_id":"RC_001","action_type":"exclude_cases","status":"ready","rationale":"x","base_nombre":"Personas"}')$decision$id
  .da_reauditar_17_27(sid)
  b <- .da_guardar(sid, sprintf('{"id":"%s","source_id":"RC_001","action_type":"exclude_cases","status":"ready","rationale":"x","incluir_casos_nuevos":true,"base_nombre":"Personas"}', id))
  expect_setequal(unlist(b$decision$target_case_ids_resueltos), c("u01", "u04", "u08", "u06"))
  pub <- b$decision_draft[[1]]
  expect_length(pub$casos_nuevos, 0L)
  expect_identical(unlist(pub$casos_que_ya_no_marca), "u08")
  expect_identical(pub$n_casos_aplicados, 4L)
})

test_that("O3: n_casos_aplicados cuenta la lista que se aplica, no lo que la regla marca hoy", {
  dir <- withr::local_tempdir()
  sid <- .da_sesion(dir)
  withr::defer(session_delete(sid))
  .da_guardar(sid, '{"source_id":"RC_001","action_type":"exclude_cases","status":"ready","rationale":"x","base_nombre":"Personas"}')
  # De 16 a 29 la regla marca solo u01 (15) y u04 (30); la lista sigue con 3.
  regla <- .m1_regla_edad(); regla$params$max <- 29
  validacion_scope_set(sid, "Personas", "reglas_custom", list(regla))
  .m2_auditar(sid, "Personas")
  pub <- .da_limpieza(sid)$decision_draft[[1]]
  expect_identical(pub$n_casos_aplicados, 3L)
  expect_identical(unlist(pub$casos_que_ya_no_marca), "u08")
})

test_that("B2: una lista congelada por número de fila sin la numeración de origen no se lleva a otra fila", {
  dir <- withr::local_tempdir()
  d0 <- .m1_datos(); d0$respondent_id <- NULL
  sid <- .m1_sesion(dir, datos_personas = d0)
  withr::defer(session_delete(sid))
  validacion_scope_set(sid, "Personas", "operational_config", normalize_validation_operational_config(list(
    version = 2L, caso_valido = list(enabled = TRUE, condiciones = list(
      list(variable = "p21", operador = "!=", valores = list("2")))))))
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad()))
  .m2_auditar(sid, "Personas")
  sc <- validacion_scope_get(sid, "Personas")
  # Registro de la ventana anterior a la fila de origen: filas contadas sobre
  # la tabla filtrada (C01, C04 y C08) y marca sin numeración.
  vieja <- list(id = "PD_001", source_id = "RC_001", action_type = "exclude_cases", status = "ready",
                rationale = "x", target_case_ids = list(),
                target_case_ids_resueltos = list("principal::row::1", "principal::row::3", "principal::row::7"),
                identificacion_casos = list(metodo = "anterior", columna = "posicion"))
  a <- .limpieza_decisiones_con_aplicabilidad(list(vieja), sc)[[1]]
  expect_false(a$aplicable)
  expect_identical(a$motivo_no_aplicable, "numeracion_anterior")
  sim <- .limpieza_simulate(sid, "Personas", sc, list(vieja))
  expect_identical(sim$impact$cases_excluded, 0L)
})

test_that("una decisión sin target_case_ids no lee su lista resuelta como casos elegidos", {
  d <- list(source_id = "R1", action_type = "ignore_rule", target_case_ids_resueltos = list("a"))
  expect_length(.limpieza_ids_explicitos(d), 0L)
  p <- .limpieza_validate_decision(list(source_id = "R1", action_type = "exclude_cases",
                                        target_case_ids_resueltos = list("a")))
  expect_length(p$target_case_ids, 0L)
})
