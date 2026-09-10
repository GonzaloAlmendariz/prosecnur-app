# Un estado se reconoce escrito como el equipo lo escribe.
#
# El 2026-09-10 el documento de los aplicadores traía «APLICADA SIN AGENDACION»
# —sin tilde, tecleada esa manana— y la app declara «APLICADA SIN AGENDACIÓN».
# La comparación era `TEXT_EQ` contra el canónico, así que esa celda se quedaba
# sin color y sin reconocer, y nada fallaba.

test_that("el estado se reconoce con tilde y sin ella", {
  expect_identical(aulas_distribucion_estado_canonico("APLICADA SIN AGENDACION"),
                   "APLICADA SIN AGENDACIÓN")
  expect_identical(aulas_distribucion_estado_canonico("APLICADA SIN AGENDACIÓN"),
                   "APLICADA SIN AGENDACIÓN")
  # Minúsculas y espacios de más: es una celda tecleada, no un identificador.
  expect_identical(aulas_distribucion_estado_canonico("  aplicada por reagendacion "),
                   "APLICADA POR REAGENDACIÓN")
})

test_that("lo que no es un estado declarado NO se aproxima al más parecido", {
  # Devolver «APLICADA» para «APLICADO EN PARTE» metería en el operativo un
  # estado que nadie escribió. Vacío es la respuesta honesta.
  expect_identical(aulas_distribucion_estado_canonico("APLICADO EN PARTE"), "")
  expect_identical(aulas_distribucion_estado_canonico(""), "")
  expect_identical(aulas_distribucion_estado_canonico(NULL), "")
})

test_that("«NO APLICADA» es un estado, y no es «RECHAZADA»", {
  # 2026-09-10: el aplicador fue y el aula no era la agendada. El operativo ya
  # lo usa —una fila en «STATUS DE APLICACIÓN» del libro— y la hoja de los
  # aplicadores no lo ofrecía.
  expect_true("NO APLICADA" %in% MONITOREO_AULAS_ESTADOS_DISTRIBUCION)
  expect_identical(aulas_distribucion_estado_canonico("no aplicada"), "NO APLICADA")
  colores <- prosecnurapp:::.alpa_COLOR_ESTADO
  expect_false(identical(colores[["NO APLICADA"]], colores[["RECHAZADA"]]))
})

test_that("cada estado con tilde emite DOS reglas de color, una por forma", {
  # Una sola regla deja sin pintar justo la celda tecleada a mano.
  expect_setequal(aulas_distribucion_formas_de_estado("APLICADA SIN AGENDACIÓN"),
                  c("APLICADA SIN AGENDACIÓN", "APLICADA SIN AGENDACION"))
  # Sin tildes no se duplica: dos reglas idénticas se pisarían sin motivo.
  expect_identical(aulas_distribucion_formas_de_estado("POR APLICAR"), "POR APLICAR")
})

test_that("el formato de la hoja pinta la forma SIN TILDE que hay en el documento", {
  filas <- list(
    as.list(prosecnurapp:::.alpa_CABECERA),
    as.list(c("Interno Pulso", "Jueves", "10/09", "8:15", "8:30", "8:45 a 9:15",
              "CH 51", "E201", "CIENCIAS E INGENIERÍA", "CÁLCULO", "—",
              "APLICADA SIN AGENDACION"))
  )
  reqs <- aulas_libro_plan_aplicadores_formato_requests(0L, filas)
  valores <- unlist(lapply(reqs, function(r) {
    r$addConditionalFormatRule$rule$booleanRule$condition$values[[1]]$userEnteredValue
  }), use.names = FALSE)
  expect_true("APLICADA SIN AGENDACION" %in% valores)
  expect_true("APLICADA SIN AGENDACIÓN" %in% valores)
  expect_true("NO APLICADA" %in% valores)
})

test_that("una fila con el estado sin tilde se clasifica como el equipo la marcó", {
  cab <- as.list(prosecnurapp:::.alpa_CABECERA)
  fila <- as.list(c("Interno Pulso", "Jueves", "10/09", "8:15", "8:30", "8:45 a 9:15",
                    "CH 51", "", "", "", "", "REAGENDADA"))
  plan <- list(list(operational_code = "CH 51", scheduled_venue = "E201",
                    faculty = "CIENCIAS E INGENIERÍA", course_name = "CÁLCULO",
                    teacher = "—", scheduled_date = "2026-09-10", scheduled_time = "08:45"))
  out <- monitoreo_aulas_completar_distribucion(list(cab, fila), plan = plan)
  expect_identical(out$filas[[1]]$clase, "reagendada")
})
