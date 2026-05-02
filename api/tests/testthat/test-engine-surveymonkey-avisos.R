# Tests de los avisos diagnósticos: confirma que la hoja `diagnostico`
# detecta grupos que parecían battery/multi pero quedaron descartados,
# para que el usuario sepa por qué quedaron variables sueltas.

.write_temp_sav <- function(df) {
  path <- tempfile(fileext = ".sav")
  haven::write_sav(df, path)
  path
}

test_that("aviso 'battery_descartada' aparece cuando los items tienen firmas distintas", {
  # P1_1 y P1_2 parecen battery (mismo stem, sufijo numérico, ambos con
  # n_value_labels > 1) pero las opciones difieren → no es battery.
  df <- tibble::tibble(
    P1_1 = haven::labelled(
      c(1, 2, 3),
      c("Bajo" = 1, "Medio" = 2, "Alto" = 3)
    ),
    P1_2 = haven::labelled(
      c(1, 2, 3),
      c("Nunca" = 1, "A veces" = 2, "Siempre" = 3)
    )
  )
  path <- .write_temp_sav(df)
  on.exit(unlink(path), add = TRUE)

  out <- surveymonkey_xlsform(surveymonkey_leer(path))
  diag <- out$diagnostico

  avisos <- diag[!is.na(diag$aviso_tipo), ]
  expect_true(nrow(avisos) >= 2L,
    info = "Se esperan al menos 2 filas con aviso (P1_1 y P1_2)")
  expect_true(all(avisos$aviso_tipo == "battery_descartada"),
    info = "Todos los avisos deberían ser de tipo battery_descartada")
  expect_match(avisos$aviso_mensaje[1], "firmas distintas|opciones de respuesta difieren")
})

test_that("multi-select con sufijo alfabético se detecta positivamente (P1#6)", {
  # P2_a y P2_b son dummies (n_value_labels=1) con sufijo alfabético —
  # ahora el detector las reconoce como select_multiple en vez de avisar.
  df <- tibble::tibble(
    P2_a = haven::labelled(c(1, NA, 1), c("Opción A" = 1)),
    P2_b = haven::labelled(c(NA, 1, 1), c("Opción B" = 1))
  )
  path <- .write_temp_sav(df)
  on.exit(unlink(path), add = TRUE)

  out <- surveymonkey_xlsform(surveymonkey_leer(path))
  diag <- out$diagnostico

  expect_equal(sum(diag$kind_guess == "select_multiple_dummy"), 2L,
    info = "P2_a y P2_b deberían ser select_multiple_dummy")
  expect_equal(sum(!is.na(diag$aviso_tipo)), 0L,
    info = "El detector positivo cubre el caso, sin avisos")

  # En survey, debe aparecer un select_multiple madre.
  expect_match(out$survey$type[1], "^select_multiple")
})

test_that("aviso 'multi_descartada' aparece para sufijos alfabéticos NO dummy", {
  # P3_a y P3_b tienen value labels >1 (no son dummies) pero sufijo alfabético
  # → no califican como multi ni battery (firmas distintas) → aviso.
  df <- tibble::tibble(
    P3_a = haven::labelled(c(1, 2, 3), c("Bajo" = 1, "Medio" = 2, "Alto" = 3)),
    P3_b = haven::labelled(c(1, 2, 3), c("Frío" = 1, "Tibio" = 2, "Caliente" = 3))
  )
  path <- .write_temp_sav(df)
  on.exit(unlink(path), add = TRUE)

  out <- surveymonkey_xlsform(surveymonkey_leer(path))
  diag <- out$diagnostico

  avisos <- diag[!is.na(diag$aviso_tipo), ]
  expect_true(nrow(avisos) >= 1L,
    info = "se espera al menos un aviso")
})

test_that("happy path: una battery bien formada NO produce avisos", {
  likert <- c(
    "Totalmente en desacuerdo" = 1,
    "En desacuerdo" = 2,
    "De acuerdo" = 3,
    "Totalmente de acuerdo" = 4
  )
  df <- tibble::tibble(
    P3_1 = haven::labelled(c(1, 2, 3, 4), likert),
    P3_2 = haven::labelled(c(2, 3, 4, 1), likert),
    P3_3 = haven::labelled(c(3, 4, 1, 2), likert)
  )
  path <- .write_temp_sav(df)
  on.exit(unlink(path), add = TRUE)

  out <- surveymonkey_xlsform(surveymonkey_leer(path))
  diag <- out$diagnostico

  avisos <- diag[!is.na(diag$aviso_tipo), ]
  expect_equal(nrow(avisos), 0L,
    info = "Una battery bien formada no debería producir avisos")

  # Sanity: detección positiva → kind_guess = battery_item para los 3.
  battery_rows <- diag[diag$kind_guess == "battery_item", ]
  expect_equal(nrow(battery_rows), 3L)
})
