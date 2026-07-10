# `.analitica_restore_survey_case`: la codificación deja las columnas y dummies en
# minúscula (`d1_information.1`) mientras el survey usa el case original
# (`D1_information`). Frecuencias/cruces buscan case-sensitive contra el survey, así
# que sin realinear SALTAN los select_multiple y sus recodificadas.

library(testthat)

test_that("recasea dummies y columnas planas al case del survey", {
  inst <- list(survey = data.frame(
    name = c("D1_information", "D1_information_recod", "M5_district"),
    type = c("select_multiple l", "select_multiple l", "select_one d"),
    stringsAsFactors = FALSE
  ))
  data <- data.frame(row = 1:2, check.names = FALSE)
  for (c in c("d1_information.1", "d1_information.96",
              "d1_information_recod.1", "m5_district")) data[[c]] <- c(1L, 0L)
  data[["d.d1_information"]] <- c("x", "y")  # duplicado con prefijo de grupo

  out <- .analitica_restore_survey_case(data, inst)

  expect_true(all(c("D1_information.1", "D1_information.96",
                    "D1_information_recod.1", "M5_district") %in% names(out)))
  expect_false(any(c("d1_information.1", "m5_district") %in% names(out)))
  # No se pierde ni duplica ninguna columna.
  expect_equal(ncol(out), ncol(data))
})

test_that("no pisa una columna existente (guarda contra colisión)", {
  inst <- list(survey = data.frame(name = "P1", type = "select_one l",
                                   stringsAsFactors = FALSE))
  # `P1` ya existe; `p1` NO debe renombrarse a `P1` (colisionaría).
  data <- data.frame(P1 = 1L, p1 = 2L, check.names = FALSE)
  out <- .analitica_restore_survey_case(data, inst)
  expect_true(all(c("P1", "p1") %in% names(out)))
  expect_equal(ncol(out), 2L)
})

test_that("sin survey o sin cambios de case, es no-op", {
  data <- data.frame(A = 1L, B = 2L)
  expect_identical(.analitica_restore_survey_case(data, list()), data)
  inst <- list(survey = data.frame(name = c("A", "B"), type = c("i", "i"),
                                   stringsAsFactors = FALSE))
  expect_identical(names(.analitica_restore_survey_case(data, inst)), c("A", "B"))
})
