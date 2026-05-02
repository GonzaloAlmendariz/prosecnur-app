# Tests del validador empírico de skip logic (P2.9b en rol de validador).
# Ejecuta la expresión `relevant` ya aplicada sobre los datos reales y compara
# contra el patrón de NA observado en la pregunta target.

.write_temp_sav <- function(df) {
  path <- tempfile(fileext = ".sav")
  haven::write_sav(df, path)
  path
}

test_that("validador marca 'ok' cuando los datos confirman la regla", {
  # P5 está NA exactamente cuando P1 != 1 — la skip logic se cumple.
  df <- tibble::tibble(
    P1 = haven::labelled(c(1, 1, 1, 2, 2), c("Sí" = 1, "No" = 2)),
    P5 = haven::labelled(c(1, 2, 1, NA, NA), c("a" = 1, "b" = 2))
  )
  path <- .write_temp_sav(df); on.exit(unlink(path), add = TRUE)
  sm <- surveymonkey_leer(path)
  out <- surveymonkey_xlsform(sm)
  out <- surveymonkey_aplicar_logica(out, "Q1 != C1 => Ocultar P5.", sm)

  res <- surveymonkey_validar_logica(out, sm, threshold = 0.95)
  expect_equal(nrow(res), 1L)
  expect_equal(res$target[1], "p5")
  expect_equal(res$status[1], "ok")
  expect_equal(res$coverage_oculta[1], 1)
})

test_that("validador marca 'discrepancia' cuando un respondiente saltó la regla", {
  # Regla: "Ocultar P5 cuando P1 != 1". Los datos tienen un caso donde
  # P1 = 2 (debería ocultar) PERO P5 = 1 (el respondiente contestó). Eso
  # es violación real de la regla — no es no-respuesta voluntaria.
  df <- tibble::tibble(
    P1 = haven::labelled(c(1, 1, 2, 2, 2), c("Sí" = 1, "No" = 2)),
    P5 = haven::labelled(c(1, 2, 1, NA, NA), c("a" = 1, "b" = 2))
  )
  path <- .write_temp_sav(df); on.exit(unlink(path), add = TRUE)
  sm <- surveymonkey_leer(path)
  out <- surveymonkey_xlsform(sm)
  out <- surveymonkey_aplicar_logica(out, "Q1 != C1 => Ocultar P5.", sm)

  res <- surveymonkey_validar_logica(out, sm, threshold = 0.95)
  expect_equal(res$status[1], "discrepancia")
  expect_lt(res$coverage_oculta[1], 1)
  # La inconsistencia es la fila 3 (P1=2 y P5=1)
  expect_equal(res$inconsistencias[[1]], 3L)
})

test_that("no-respuesta voluntaria NO se reporta como discrepancia", {
  # Regla: "Ocultar P5 cuando P1 != 1". Los respondientes que SÍ deberían
  # ver P5 (P1=1) no la contestaron — eso es no-respuesta normal, no
  # debe reportarse como violación. coverage_oculta debe ser 1.
  df <- tibble::tibble(
    P1 = haven::labelled(c(1, 1, 1, 2, 2), c("Sí" = 1, "No" = 2)),
    P5 = haven::labelled(rep(NA_real_, 5L), c("a" = 1, "b" = 2))
  )
  path <- .write_temp_sav(df); on.exit(unlink(path), add = TRUE)
  sm <- surveymonkey_leer(path)
  out <- surveymonkey_xlsform(sm)
  out <- surveymonkey_aplicar_logica(out, "Q1 != C1 => Ocultar P5.", sm)

  res <- surveymonkey_validar_logica(out, sm, threshold = 0.95)
  expect_equal(res$status[1], "ok")
  expect_equal(res$coverage_oculta[1], 1)
  expect_equal(res$tasa_respuesta[1], 0)  # nadie contestó (info adicional)
})

test_that("validador maneja select_multiple con selected()", {
  # P5 está NA cuando ninguna opción de Q3 (multi) entre 1-3 fue seleccionada.
  # Para test: filas donde alguna de q3_1/q3_2/q3_3 está marcada → P5 con valor.
  df <- tibble::tibble(
    P3_1 = haven::labelled(c(1, NA, 1, NA, NA), c("a" = 1)),
    P3_2 = haven::labelled(c(NA, 1, NA, NA, NA), c("b" = 1)),
    P3_3 = haven::labelled(c(NA, NA, 1, NA, NA), c("c" = 1)),
    P5 = haven::labelled(c(1, 2, 1, NA, NA), c("x" = 1, "y" = 2))
  )
  path <- .write_temp_sav(df); on.exit(unlink(path), add = TRUE)
  sm <- surveymonkey_leer(path)
  out <- surveymonkey_xlsform(sm)
  out <- surveymonkey_aplicar_logica(out, "Q3 NOT IN [C1, C2, C3] => Ocultar P5.", sm)

  res <- surveymonkey_validar_logica(out, sm, threshold = 0.95)
  expect_equal(res$status[1], "ok")
})

test_that("validador retorna tibble vacío si no hay reglas aplicadas", {
  df <- tibble::tibble(P1 = haven::labelled(c(1, 2), c("a" = 1, "b" = 2)))
  path <- .write_temp_sav(df); on.exit(unlink(path), add = TRUE)
  sm <- surveymonkey_leer(path)
  out <- surveymonkey_xlsform(sm)  # sin aplicar reglas
  res <- surveymonkey_validar_logica(out, sm)
  expect_equal(nrow(res), 0L)
  expect_setequal(names(res), c("target","status","coverage_oculta","n_oculta_correcta","n_oculta_predicha","tasa_respuesta","inconsistencias","relevant"))
})

test_that(".sm_selected emula 'selected()' de XLSForm con tokens", {
  # tokens: "1 4 8" — 3 selecciones
  expect_true(.sm_selected("1 4 8", "1"))
  expect_true(.sm_selected("1 4 8", "4"))
  expect_true(.sm_selected("1 4 8", "8"))
  expect_false(.sm_selected("1 4 8", "2"))
  # No matchea sub-tokens
  expect_false(.sm_selected("14", "1"))
  expect_false(.sm_selected("14", "4"))
  # NA → FALSE
  expect_false(.sm_selected(NA, "1"))
  expect_false(.sm_selected("", "1"))
})
