test_that("variables excluidas filtran reglas objetivo sin ocultar otras inconsistencias", {
  inst <- list(
    survey = data.frame(
      type = c("text", "text"),
      name = c("p3", "p8"),
      label = c("Correo personal", "Empleador actual"),
      required = c("yes", "yes"),
      relevant = c("", ""),
      constraint = c("", ""),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(stringsAsFactors = FALSE)
  )
  datos <- data.frame(
    p3 = c("", ""),
    p8 = c("", "Empresa SAC"),
    stringsAsFactors = FALSE
  )

  bundle <- build_validation_bundle(
    instrumento = inst,
    incluir = list(required = TRUE, relevant = FALSE, constraint = FALSE)
  )
  ev <- evaluate_validation_bundle(bundle, datos, strict = FALSE)
  expect_equal(sum(ev$resumen$n_inconsistencias, na.rm = TRUE), 3L)

  filtrado <- .validacion_filter_bundle_excluded_vars(bundle, "p3")
  targets <- unlist(lapply(filtrado$rules, .validacion_rule_target_vars), use.names = FALSE)
  expect_false("p3" %in% targets)
  expect_true("p8" %in% targets)
  expect_equal(filtrado$excluded_validation_vars, list("p3"))

  ev_filtrado <- evaluate_validation_bundle(filtrado, datos, strict = FALSE)
  expect_equal(sum(ev_filtrado$resumen$n_inconsistencias, na.rm = TRUE), 1L)
})

test_that("variables excluidas toleran auditoria sin conteos por variable", {
  inst <- list(
    survey = data.frame(
      type = rep("text", 52),
      name = sprintf("p%d", seq_len(52)),
      label = sprintf("Pregunta %d", seq_len(52)),
      required = rep("yes", 52),
      relevant = rep("", 52),
      constraint = rep("", 52),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(stringsAsFactors = FALSE)
  )
  bundle <- build_validation_bundle(
    instrumento = inst,
    incluir = list(required = TRUE, relevant = FALSE, constraint = FALSE)
  )
  scope <- list(
    plan_result = list(bundle = bundle),
    evaluacion = list(
      resumen = data.frame(
        id_regla = "sin_variable",
        variable_1 = "",
        n_inconsistencias = 0L,
        stringsAsFactors = FALSE
      )
    )
  )

  opciones <- .validacion_variable_options("sid-prueba", scope = scope)

  expect_length(opciones, 52)
  expect_true(all(vapply(opciones, function(x) identical(x$n_reglas_con_casos, 0L), logical(1))))
  expect_true(all(vapply(opciones, function(x) identical(x$n_inconsistencias, 0L), logical(1))))
})
