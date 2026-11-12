# "Condiciones combinadas" y "comparar con otra pregunta" en las reglas propias.
#
# Los cuatro casos del documento de revisión del equipo, como datos sintéticos
# (`.m1_datos()` en helper-validacion-m1.R), con el conteo esperado a mano:
#
#   fila  edad p4 p21 hermanos p15 p8_6 p16_7 p16_8 p16_9
#   1     15   1  4   0        88  1    1     0     0
#   2     18   1  2   0        2   1    0     0     0
#   3     20   2  5   1        3   0    1     0     0
#   4     30   1  8   0        1   1    0     1     0
#   5     22   2  1   0        88  1    0     0     1
#   6     16   1  6   1        4   0    1     0     0
#   7     25   1  3   0        NA  1    0     0     0
#   8     26   2  9   0        5   1    1     0     1
#   9     NA   1  4   1        2   0    0     0     0
#   10    19   1  NA  0        3   1    0     0     0

.m1_marca <- function(regla, datos = .m1_datos()) {
  rule <- bridge_regla_custom(regla)
  ev <- evaluate_validation_bundle(list(rules = list(rule)), datos, strict = FALSE)
  flag <- ev$datos[[rule$flag_name]]
  flag[is.na(flag)] <- FALSE
  which(flag)
}

# El texto R que va al plan (y al script de limpieza) evaluado fuera del motor,
# en un entorno que solo tiene las columnas de la base.
.m1_marca_texto <- function(regla, datos = .m1_datos()) {
  proc <- .compilar_regla_custom(regla)$Procesamiento
  expr <- sub("^[A-Za-z0-9_.]+ <- ", "", proc)
  env <- list2env(as.list(datos), parent = baseenv())
  flag <- eval(parse(text = expr), envir = env)
  flag[is.na(flag)] <- FALSE
  which(flag)
}

test_that("caso 1: edad fuera de 16 a 25", {
  expect_identical(.m1_marca(.m1_regla_edad()), c(1L, 4L, 8L))
})

test_that("caso 2: P4 = 1 y P21 entre 4, 5, 6 y 8", {
  # Como coherencia: "si P4 = 1, P21 no está entre 4, 5, 6 y 8". Un P21 vacío
  # no cumple el "no está entre" y la coherencia lo marca (fila 10).
  expect_identical(.m1_marca(.m1_regla_p4_p21()), c(1L, 4L, 6L, 9L, 10L))
  # Como condiciones combinadas, el vacío no cumple "está entre" y no se marca.
  regla <- .m1_regla("RC_012", "condiciones", list(), list(modo = "todas", condiciones = list(
    list(variable = "p4", op = "==", valor = 1),
    list(variable = "p21", op = "in", valor = list("4", "5", "6", "8"))
  )))
  expect_identical(.m1_marca(regla), c(1L, 4L, 6L, 9L))
  expect_identical(.m1_marca_texto(regla), c(1L, 4L, 6L, 9L))
})

test_that("caso 3: sin hermanos y P15 distinto de 88, con todas", {
  regla <- .m1_regla_hermanos()
  expect_silent(.validar_regla_custom(regla))
  expect_identical(.m1_marca(regla), c(2L, 4L, 8L, 10L))
  expect_identical(.m1_marca_texto(regla), c(2L, 4L, 8L, 10L))
  expect_identical(.regla_variables_efectivas(regla), c("hermanos", "p15"))
})

test_that("caso 4: P8_6 contra alguna de P16_7, P16_8 y P16_9", {
  regla <- .m1_regla_item_alguna()
  expect_identical(.m1_marca(regla), c(1L, 4L, 5L, 8L))
  expect_identical(.m1_marca_texto(regla), c(1L, 4L, 5L, 8L))
  # Con "todas" ningún caso tiene las tres.
  regla$params$modo <- "todas"
  expect_length(.m1_marca(regla), 0L)
  expect_length(.m1_marca_texto(regla), 0L)
})

test_that("una condición puede comparar con otra pregunta", {
  # p21 mayor que p15: 3 (5 > 3), 4 (8 > 1), 6 (6 > 4), 8 (9 > 5) y 9 (4 > 2);
  # la 1 no (4 < 88) y la 7 y la 10 tienen un vacío.
  regla <- .m1_regla("RC_013", "condiciones", list(), list(modo = "todas", condiciones = list(
    list(variable = "p21", op = ">", variable_comparada = "p15")
  )))
  expect_silent(.validar_regla_custom(regla))
  expect_identical(.m1_marca(regla), c(3L, 4L, 6L, 8L, 9L))
  expect_identical(.m1_marca_texto(regla), c(3L, 4L, 6L, 8L, 9L))
  expect_identical(.regla_variables_efectivas(regla), c("p21", "p15"))
  rule <- bridge_regla_custom(regla)
  expect_identical(rule$variable_roles$target, "p21")
  expect_true("p15" %in% rule$variable_roles$compare)
})

test_that("coherencia_2v compara con otra pregunta con valor_y_variable", {
  # Si P4 = 1, P21 debe ser menor que P15. Filas con P4 = 1: 1 (4<88 cumple),
  # 2 (2<2 no), 4 (8<1 no), 6 (6<4 no), 7 (P15 vacío), 9 (4<2 no), 10 (P21 vacío).
  # La comparación entre preguntas es numérica: con un vacío no se puede
  # comparar y la fila no se marca.
  regla <- .m1_regla("RC_014", "coherencia_2v", list("p4", "p21"),
                     list(op_x = "==", valor_x = 1, op_y = "<", valor_y_variable = "p15"))
  expect_silent(.validar_regla_custom(regla))
  expect_identical(.m1_marca(regla), c(2L, 4L, 6L, 9L))
  expect_identical(.m1_marca_texto(regla), c(2L, 4L, 6L, 9L))
  expect_identical(.regla_variables_efectivas(regla), c("p4", "p21", "p15"))
})

test_that("el filtro previo se aplica a las condiciones combinadas", {
  regla <- .m1_regla_hermanos()
  regla$gate_conditions <- list(list(variable = "p4", op = "==", value = "1"))
  # De 2, 4, 8 y 10 quedan las que tienen P4 = 1.
  expect_identical(.m1_marca(regla), c(2L, 4L, 10L))
})

test_that("el esquema rechaza condiciones mal formadas con su código", {
  err <- function(regla) {
    e <- tryCatch(.validar_regla_custom(regla), api_error = function(e) e)
    if (inherits(e, "api_error")) e$code else NA_character_
  }
  base <- .m1_regla_hermanos()

  sin_modo <- base; sin_modo$params$modo <- NULL
  expect_identical(err(sin_modo), "E_REGLA_CONDICIONES_MODO")
  modo_raro <- base; modo_raro$params$modo <- "ninguna"
  expect_identical(err(modo_raro), "E_REGLA_CONDICIONES_MODO")

  vacias <- base; vacias$params$condiciones <- list()
  expect_identical(err(vacias), "E_REGLA_CONDICIONES_VACIAS")
  vacias$variables <- list("p15")
  expect_identical(err(vacias), "E_REGLA_CONDICIONES_VACIAS")

  sin_var <- base; sin_var$params$condiciones[[2]]$variable <- ""
  expect_identical(err(sin_var), "E_REGLA_CONDICION_VAR")

  op_raro <- base; op_raro$params$condiciones[[1]]$op <- "~="
  expect_identical(err(op_raro), "E_REGLA_CONDICION_OP")

  sin_valor <- base; sin_valor$params$condiciones[[1]]$valor <- NULL
  expect_identical(err(sin_valor), "E_REGLA_CONDICION_VALOR")

  lista_vacia <- base
  lista_vacia$params$condiciones[[1]] <- list(variable = "p21", op = "in", valor = list())
  expect_identical(err(lista_vacia), "E_REGLA_CONDICION_VALOR")

  los_dos <- base
  los_dos$params$condiciones[[1]] <- list(variable = "p21", op = ">", valor = 3, variable_comparada = "p15")
  expect_identical(err(los_dos), "E_REGLA_CONDICION_VALOR")

  contra_si_misma <- base
  contra_si_misma$params$condiciones[[1]] <- list(variable = "p21", op = ">", variable_comparada = "p21")
  expect_identical(err(contra_si_misma), "E_REGLA_CONDICION_VALOR")

  lista_contra_variable <- base
  lista_contra_variable$params$condiciones[[1]] <- list(variable = "p21", op = "in", variable_comparada = "p15")
  expect_identical(err(lista_contra_variable), "E_REGLA_CONDICION_OP")
})

test_that("coherencia_2v rechaza valor_y y valor_y_variable a la vez o un operador de lista", {
  err <- function(regla) {
    e <- tryCatch(.validar_regla_custom(regla), api_error = function(e) e)
    if (inherits(e, "api_error")) e$code else NA_character_
  }
  r <- .m1_regla("RC_015", "coherencia_2v", list("p4", "p21"),
                 list(op_x = "==", valor_x = 1, op_y = "<", valor_y = 3, valor_y_variable = "p15"))
  expect_identical(err(r), "E_REGLA_VALOR_Y")
  r$params$valor_y <- NULL
  r$params$op_y <- "in"
  expect_identical(err(r), "E_REGLA_OP_Y")
  r$params$op_y <- "<"
  r$params$valor_y_variable <- "p21"
  expect_identical(err(r), "E_REGLA_VALOR_Y")
  r$params$valor_y_variable <- NULL
  expect_identical(err(r), "E_REGLA_VALOR_Y")
})

test_that("crear una regla de condiciones guarda las variables de sus condiciones", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  r <- .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/reglas_custom",
                body = as.character(jsonlite::toJSON(.m1_regla_hermanos(id = ""), auto_unbox = TRUE)))
  expect_identical(r$status, 200L)
  expect_identical(unlist(r$body$regla$variables), c("hermanos", "p15"))
  guardada <- validacion_scope_get(sid, "Personas")$reglas_custom[[1]]
  expect_identical(unlist(guardada$variables), c("hermanos", "p15"))
  expect_identical(guardada$tipo, "condiciones")
})

test_that("una condición puede pedir que la pregunta esté vacía o tenga respuesta, sin valor", {
  vacia <- .m1_regla("RC_020", "condiciones", list(), list(modo = "todas", condiciones = list(
    list(variable = "p4", op = "==", valor = 1),
    list(variable = "p21", op = "is_empty")
  )))
  expect_silent(.validar_regla_custom(vacia))
  expect_identical(.m1_marca(vacia), 10L)
  expect_identical(.m1_marca_texto(vacia), 10L)

  sola <- .m1_regla("RC_021", "condiciones", list(), list(modo = "todas", condiciones = list(
    list(variable = "edad", op = "is_empty")
  )))
  expect_identical(.m1_marca(sola), 9L)

  con_respuesta <- .m1_regla("RC_022", "condiciones", list(), list(modo = "todas", condiciones = list(
    list(variable = "hermanos", op = "==", valor = 1),
    list(variable = "p15", op = "not_empty")
  )))
  expect_identical(.m1_marca(con_respuesta), c(3L, 6L, 9L))
  expect_identical(.m1_marca_texto(con_respuesta), c(3L, 6L, 9L))
})

test_that("el filtro previo acepta está vacía y tiene respuesta", {
  regla <- .m1_regla("RC_023", "rango_num", list("edad"), list(min = 16, max = 25),
                     gate_conditions = list(list(variable = "p15", op = "not_empty")))
  expect_silent(.validar_regla_custom(regla))
  expect_identical(.m1_marca(regla), c(1L, 4L, 8L))
  sin_p21 <- .m1_regla("RC_024", "condiciones", list(), list(modo = "todas", condiciones = list(
    list(variable = "p4", op = "==", valor = 1))), gate_conditions = list(list(variable = "p21", op = "is_empty")))
  expect_identical(.m1_marca(sin_p21), 10L)
})
