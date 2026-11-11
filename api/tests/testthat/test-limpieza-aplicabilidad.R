# Una decisión que no llega a ninguna fila no se aplica a todas ni se publica
# como aplicada (E2 y E4b de la revisión metodológica de M2).

.ap_ev <- function(df, flag_n = 0, tabla = "principal", tablas = NULL) {
  list(resumen = tibble::tibble(id_regla = "R1", tabla = tabla, flag = "f", n_inconsistencias = flag_n),
       datos_tablas = tablas %||% list(principal = df), datos = df)
}

.ap_correccion <- function(tipo, params, extra = list()) {
  c(list(id = "PD_1", source_id = "R1", action_type = tipo, target_variable = "edad",
         action_params = params, status = "ready", rationale = "x"), extra)
}

test_that("E2: una corrección de la regla entera no toca ninguna fila cuando la regla ya no marca casos", {
  df <- data.frame(respondent_id = sprintf("r%d", 1:6), edad = c(15, 20, 21, 22, 23, 24), f = FALSE)
  scope <- list(evaluacion = .ap_ev(df))
  casos <- list(
    set_value = list(value = 99),
    impute_value = list(method = "fixed", fixed_value = 99),
    replace_value = list(from_value = "20", to_value = "99"),
    recode_map = list(recode_map = list(`20` = "99")),
    nullify_fields = list()
  )
  for (tipo in names(casos)) {
    d <- .ap_correccion(tipo, casos[[tipo]])
    out <- .limpieza_apply_decisions_to_data(df, scope, list(d))
    expect_identical(out$impact$cells_changed, 0L, label = tipo)
    expect_identical(out$data$edad, df$edad, label = tipo)
    expect_true(any(grepl("PD_1 no se aplica: la regla ya no marca casos", out$warnings, fixed = TRUE)),
                label = tipo)
    a <- .limpieza_decisiones_con_aplicabilidad(list(d), scope)
    expect_false(a[[1]]$aplicable, label = tipo)
    expect_identical(a[[1]]$motivo_no_aplicable, "regla_sin_casos", label = tipo)
  }
  # Una exclusión de la regla entera tampoco: y lo dice.
  e <- list(id = "PD_2", source_id = "R1", action_type = "exclude_cases", status = "ready", rationale = "x")
  out <- .limpieza_apply_decisions_to_data(df, scope, list(e))
  expect_identical(nrow(out$data), 6L)
  expect_true(any(grepl("PD_2 no se aplica", out$warnings, fixed = TRUE)))
})

test_that("E2: con casos marcados, la corrección de la regla entera llega solo a ellos", {
  df <- data.frame(respondent_id = sprintf("r%d", 1:6), edad = c(15, 20, 21, 22, 23, 24),
                   f = c(TRUE, FALSE, FALSE, FALSE, FALSE, FALSE))
  scope <- list(evaluacion = .ap_ev(df, 1))
  out <- .limpieza_apply_decisions_to_data(df, scope, list(.ap_correccion("set_value", list(value = 99))))
  expect_identical(out$data$edad, c(99, 20, 21, 22, 23, 24))
  expect_true(.limpieza_decisiones_con_aplicabilidad(
    list(.ap_correccion("set_value", list(value = 99))), scope)[[1]]$aplicable)
})

test_that("ignorar una regla no necesita filas: sigue aplicable", {
  df <- data.frame(respondent_id = "a", f = FALSE)
  d <- list(id = "PD_1", source_id = "R1", action_type = "ignore_rule", status = "ready", rationale = "x")
  a <- .limpieza_decisiones_con_aplicabilidad(list(d), list(evaluacion = .ap_ev(df)))
  expect_true(a[[1]]$aplicable)
})

test_that("E4b: la regla entera de una hija identificada por número de registro no llega a la principal y lo dice", {
  madre <- data.frame(`_uuid` = c("A", "B", "C"), x = 1:3, check.names = FALSE)
  hija <- data.frame(`_index` = 1:3, y = 1:3, f = c(TRUE, FALSE, FALSE), check.names = FALSE)
  ev <- .ap_ev(madre, 1, tabla = "rep", tablas = list(principal = madre, rep = hija))
  d <- list(id = "PD_1", source_id = "R1", action_type = "exclude_cases", status = "ready", rationale = "x")
  scope <- list(evaluacion = ev, limpieza_draft = list(d))
  out <- .limpieza_apply_decisions_to_data(madre, scope, list(d))
  expect_identical(nrow(out$data), 3L)
  expect_true(any(grepl("PD_1 no se aplica", out$warnings, fixed = TRUE)))
  a <- .limpieza_decisiones_con_aplicabilidad(list(d), scope)
  expect_false(a[[1]]$aplicable)
  expect_identical(a[[1]]$motivo_no_aplicable, "sin_filas_en_principal")
  # Con el id del envío heredado sí llega (al encuestado entero, como antes).
  hija$`_uuid` <- c("A", "A", "B")
  scope$evaluacion$datos_tablas$rep <- hija
  out2 <- .limpieza_apply_decisions_to_data(madre, scope, list(d))
  expect_identical(out2$data$`_uuid`, c("B", "C"))
  expect_true(.limpieza_decisiones_con_aplicabilidad(list(d), scope)[[1]]$aplicable)
})

test_that("E4b: una exclusión explícita cuyos casos no están en la base se publica no aplicable", {
  madre <- data.frame(`_uuid` = c("A", "B", "C"), x = 1:3, f = TRUE, check.names = FALSE)
  d <- list(id = "PD_1", source_id = "R1", action_type = "exclude_cases", status = "ready", rationale = "x",
            target_case_ids = list("Z"), identificacion_casos = list(metodo = "anterior", columna = "_uuid"))
  scope <- list(evaluacion = .ap_ev(madre, 3), limpieza_draft = list(d))
  a <- .limpieza_decisiones_con_aplicabilidad(list(d), scope)
  expect_false(a[[1]]$aplicable)
  expect_identical(a[[1]]$motivo_no_aplicable, "sin_filas_en_principal")
  out <- .limpieza_apply_decisions_to_data(madre, scope, list(d))
  expect_identical(nrow(out$data), 3L)
  expect_true(any(grepl("PD_1 no se aplica", out$warnings, fixed = TRUE)))
})

test_that("sin auditoría no se sabe si una decisión llega a sus casos", {
  d <- list(id = "PD_1", source_id = "R1", action_type = "exclude_cases", status = "ready", rationale = "x")
  a <- .limpieza_decisiones_con_aplicabilidad(list(d), list(evaluacion = NULL))
  expect_true(is.na(a[[1]]$aplicable))
})

test_that("la vista previa publica por HTTP la decisión que ya no llega a ningún caso", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad()))
  .m2_auditar(sid, "Personas")
  d <- list(id = "PD_009", source_id = "RC_001", action_type = "exclude_cases", status = "ready",
            rationale = "x", target_case_ids = list("u99"),
            identificacion_casos = list(metodo = "anterior", columna = "respondent_id"))
  validacion_scope_set(sid, "Personas", "limpieza_draft", list(d))
  r <- .m1_http(.m1_router(), sid, "GET", "/api/validacion/v2/limpieza", query = "base_nombre=Personas")
  expect_identical(r$status, 200L)
  expect_false(r$body$decision_draft[[1]]$aplicable)
  expect_identical(r$body$decision_draft[[1]]$motivo_no_aplicable, "sin_filas_en_principal")
  avisos <- unlist(r$body$before_after_preview$warnings)
  expect_true(any(grepl("PD_009 no se aplica", avisos, fixed = TRUE)))
})
