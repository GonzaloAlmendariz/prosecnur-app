# Vara V4 del GOAL de UI: lo que el motor no pudo hacer se dice, no se omite.
#
# Una regla `relevant` o `constraint` que depende de `pulldata()` no se puede
# evaluar sin el dataset externo, y el introspector la descarta. Eso está bien
# y está registrado: `bundle$discarded` guarda fila, campo, origen y expresión.
#
# El problema era que ese registro no salía del backend. El endpoint del plan
# exponía `no_soportadas` —las que fallaron al compilar— y nada más, así que un
# plan que deja preguntas sin cubrir se leía exactamente igual que uno que las
# cubre todas.
#
# Las dos listas van separadas a propósito: no son lo mismo. `no_soportadas` es
# una expresión que se rompió; `descartadas` es una limitación declarada del
# motor. El entregable tiene que poder decirlo distinto.

.pull_survey <- function() {
  data.frame(
    stringsAsFactors = FALSE, check.names = FALSE,
    type = c("text", "integer", "text"),
    name = c("nombre_padron", "edad", "libre"),
    `label::Spanish (es)` = c("Nombre", "Edad", "Libre"),
    relevant = c("pulldata('padron','activo','id',${id}) = '1'", "", ""),
    constraint = c("", ". >= pulldata('padron','edad_min','id',${id})", ""),
    calculation = c("", "", ""),
    required = c("", "", "")
  )
}

test_that("el motor registra qué descartó por depender de un dataset externo", {
  res <- prosecnurapp:::infer_rules_from_xlsform(
    list(survey = .pull_survey(), choices = data.frame())
  )
  descartadas <- res$discarded %||% list()

  expect_length(descartadas, 2L)
  campos <- vapply(descartadas, function(d) as.character(d$field %||% ""), character(1))
  filas <- vapply(descartadas, function(d) as.character(d$row_name %||% ""), character(1))
  origenes <- vapply(descartadas, function(d) as.character(d$origin %||% ""), character(1))

  expect_setequal(campos, c("relevant", "constraint"))
  expect_setequal(filas, c("nombre_padron", "edad"))
  expect_true(all(origenes == "pulldata"))
  # Y con la expresión literal, que es lo que permite ir a buscarla al XLSForm.
  expect_true(all(grepl("pulldata", vapply(descartadas,
    function(d) as.character(d$expression %||% ""), character(1)), fixed = TRUE)))
})

test_that("descartadas y no_soportadas no se mezclan", {
  # El control: si se volcaran a la misma lista, el cliente no podría
  # distinguir «el motor no soporta esto» de «esta expresión se rompió».
  res <- prosecnurapp:::infer_rules_from_xlsform(
    list(survey = .pull_survey(), choices = data.frame())
  )
  expect_length(res$discarded %||% list(), 2L)
  expect_length(res$unsupported %||% list(), 0L)
})

test_that("un formulario sin pulldata no descarta nada", {
  survey <- data.frame(
    stringsAsFactors = FALSE, check.names = FALSE,
    type = "integer", name = "edad",
    `label::Spanish (es)` = "Edad",
    relevant = "", constraint = ". >= 0", calculation = "", required = ""
  )
  res <- prosecnurapp:::infer_rules_from_xlsform(
    list(survey = survey, choices = data.frame())
  )
  expect_length(res$discarded %||% list(), 0L)
})

test_that("el bundle conserva lo descartado hasta el borde del router", {
  # `descartadas` en el payload del plan se sirve de `bundle$discarded`. Si el
  # puente dejara de propagarlo, el endpoint volvería a callarse sin que
  # ninguna prueba del introspector se entere.
  bridge <- readLines("../../R/validacion_ast_bridge.R", warn = FALSE)
  expect_true(any(grepl("discarded = instr_res$discarded", bridge, fixed = TRUE)))

  router <- readLines("../../R/router_validacion.R", warn = FALSE)
  expect_true(any(grepl("descartadas <- bundle$discarded", router, fixed = TRUE)))
  expect_true(any(grepl("n_descartadas = length(descartadas)", router, fixed = TRUE)))
})
