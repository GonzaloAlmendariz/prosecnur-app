# GOAL validación extrínseca · sembradores que se activan por lo que el
# instrumento NO acotó.
#
# En ACNUR V3 solo 7 de 141 preguntas capturables declaraban `constraint`. La
# duración del trámite aceptó un -6 y la fecha del resultado una posterior al
# cierre de campo, y las 442 reglas derivadas del XLSForm no vieron ninguna de
# las dos porque el formulario no les dio nada que mirar.

.sc_survey <- function(...) {
  base <- data.frame(
    type = c("integer", "integer", "date", "date", "text"),
    name = c("MesesReva", "saldo", "date_reva_sit", "fecha_ok", "comentario"),
    constraint = c(NA, NA, NA, ". <= today()", NA),
    label = c("¿Cuántos meses duró el proceso?", "Saldo del mes",
              "¿En qué fecha recibió el resultado?", "Fecha con tope", "Comentario"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  utils::modifyList(list(base), list(...))[[1]]
}

test_that("propone un piso solo cuando hay un negativo y el resto no lo es", {
  sv <- .sc_survey()
  d <- data.frame(
    MesesReva = c(-6, 1, 1, 2, 3, 4, 8, 0),      # un negativo entre no negativos
    saldo = c(-40, -12, 5, -3, 8, -1, 2, -7),     # negativos legítimos
    stringsAsFactors = FALSE, check.names = FALSE
  )
  props <- prosecnurapp:::reglas_semilla_rango_numerico(d, sv)
  vars <- vapply(props, function(p) as.character(p$variables[[1]]), character(1))

  expect_true("MesesReva" %in% vars)
  expect_false("saldo" %in% vars)               # el signo parece parte de la variable

  p <- props[[which(vars == "MesesReva")]]
  expect_equal(p$tipo, "rango_num")
  expect_equal(p$params$min, 0)
  expect_equal(p$severidad, "error")
  expect_equal(p$semilla$n_casos_afectados, 1L)
  expect_true(grepl("constraint", p$semilla$porque))
})

test_that("no propone piso si la variable ya tiene constraint o no tiene negativos", {
  sv <- .sc_survey()
  sv$constraint[sv$name == "MesesReva"] <- ". >= 0"
  d <- data.frame(MesesReva = c(-6, 1, 2), saldo = c(1, 2, 3),
                  stringsAsFactors = FALSE, check.names = FALSE)
  expect_length(prosecnurapp:::reglas_semilla_rango_numerico(d, sv), 0L)

  sv2 <- .sc_survey()
  d2 <- data.frame(MesesReva = c(0, 1, 2, 3), saldo = c(1, 2, 3, 4),
                   stringsAsFactors = FALSE, check.names = FALSE)
  expect_length(prosecnurapp:::reglas_semilla_rango_numerico(d2, sv2), 0L)
})

test_that("propone techo a la fecha declarada que supera la de su propio envío", {
  sv <- .sc_survey()
  d <- data.frame(
    `_submission_time` = c("2026-08-03", "2026-08-04", "2026-08-05"),
    date_reva_sit = c("2026-03-02", "2026-08-17", "2026-07-10"),
    fecha_ok = c("2026-08-20", "2026-08-20", "2026-08-20"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  props <- prosecnurapp:::reglas_semilla_fecha_declarada(d, sv)
  vars <- vapply(props, function(p) as.character(p$variables[[1]]), character(1))

  expect_true("date_reva_sit" %in% vars)
  expect_false("fecha_ok" %in% vars)            # ya tiene constraint

  p <- props[[which(vars == "date_reva_sit")]]
  expect_equal(p$tipo, "rango_fecha")
  expect_equal(p$params$max, "2026-08-05")      # último día de recolección
  expect_equal(p$semilla$n_casos_afectados, 1L)
})

test_that("no propone techo si ninguna fecha declarada supera su envío", {
  sv <- .sc_survey()
  d <- data.frame(
    `_submission_time` = c("2026-08-03", "2026-08-04"),
    date_reva_sit = c("2026-03-02", "2026-07-10"),
    fecha_ok = c("2026-01-01", "2026-01-02"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  expect_length(prosecnurapp:::reglas_semilla_fecha_declarada(d, sv), 0L)
})

test_that("un criterio ya escrito a mano no se vuelve a proponer", {
  sv <- .sc_survey()
  d <- data.frame(
    `_submission_time` = c("2026-08-03", "2026-08-04", "2026-08-05"),
    MesesReva = c(-6, 1, 2),
    date_reva_sit = c("2026-03-02", "2026-08-17", "2026-07-10"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  ya <- list(
    list(tipo = "rango_num", variables = list("MesesReva")),
    list(tipo = "rango_fecha", variables = list("date_reva_sit"))
  )
  expect_length(prosecnurapp:::reglas_semilla_rango_numerico(d, sv, ya), 0L)
  expect_length(prosecnurapp:::reglas_semilla_fecha_declarada(d, sv, ya), 0L)
})

test_that("los dos sembradores entran en reglas_semilla_todas y quedan marcados", {
  sv <- .sc_survey()
  d <- data.frame(
    `_submission_time` = rep(c("2026-08-03", "2026-08-04", "2026-08-05"), each = 3),
    MesesReva = c(-6, 1, 1, 2, 2, 3, 4, 8, 0),
    date_reva_sit = c("2026-03-02", "2026-08-17", rep("2026-07-10", 7)),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  props <- prosecnurapp:::reglas_semilla_todas(d, list(), survey = sv)
  tipos <- vapply(props, function(p) as.character(p$tipo), character(1))
  expect_true(all(c("rango_num", "rango_fecha") %in% tipos))
  expect_true(all(vapply(props, function(p) identical(p$origen, "sembrado"), logical(1))))
})
