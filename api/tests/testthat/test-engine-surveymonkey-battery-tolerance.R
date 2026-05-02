# Tests para P1 #5: tolerancia de firma en battery.
# El detector acepta batteries cuando la firma de etiquetas dominante cubre
# al menos 80% del grupo. Items minoritarios quedan como select_one con su
# propia lista y reciben aviso "battery_outlier" en la hoja diagnostico.

.write_temp_sav <- function(df) {
  path <- tempfile(fileext = ".sav")
  haven::write_sav(df, path)
  path
}

test_that("battery con 1 outlier de 5 (20%) se forma con 4 items + outlier marcado", {
  likert_a <- c("Muy malo" = 1, "Malo" = 2, "Bueno" = 3, "Muy bueno" = 4)
  likert_b <- c("Nada" = 1, "Poco" = 2, "Mucho" = 3, "Demasiado" = 4)
  df <- tibble::tibble(
    P1_1 = haven::labelled(c(1, 2, 3), likert_a),
    P1_2 = haven::labelled(c(2, 3, 4), likert_a),
    P1_3 = haven::labelled(c(3, 4, 1), likert_a),
    P1_4 = haven::labelled(c(4, 1, 2), likert_a),
    P1_5 = haven::labelled(c(1, 2, 3), likert_b)  # outlier
  )
  path <- .write_temp_sav(df)
  on.exit(unlink(path), add = TRUE)

  out <- surveymonkey_xlsform(surveymonkey_leer(path))
  diag <- out$diagnostico

  # 4 conformes deberían ser battery_item
  bt_rows <- diag[diag$kind_guess == "battery_item", ]
  expect_equal(nrow(bt_rows), 4L,
    info = "se esperan 4 items battery_item (P1_1..P1_4)")
  expect_setequal(bt_rows$name_raw, c("P1_1", "P1_2", "P1_3", "P1_4"))

  # P1_5 debería quedar como select_one con aviso battery_outlier
  outlier_row <- diag[diag$name_raw == "P1_5", ]
  expect_equal(outlier_row$aviso_tipo, "battery_outlier")
  expect_match(outlier_row$type_final, "^select_one")

  # El begin_group sigue presente en survey
  has_begin_group <- any(grepl("^begin_group$", out$survey$type))
  expect_true(has_begin_group, info = "el begin_group debe formarse")
})

test_that("battery con 50/50 firmas distintas NO se forma (bajo el threshold)", {
  likert_a <- c("Muy malo" = 1, "Bueno" = 2)
  likert_b <- c("Nunca" = 1, "Siempre" = 2)
  df <- tibble::tibble(
    P2_1 = haven::labelled(c(1, 2, 1), likert_a),
    P2_2 = haven::labelled(c(2, 1, 2), likert_a),
    P2_3 = haven::labelled(c(1, 2, 1), likert_b),
    P2_4 = haven::labelled(c(2, 1, 2), likert_b)
  )
  path <- .write_temp_sav(df)
  on.exit(unlink(path), add = TRUE)

  out <- surveymonkey_xlsform(surveymonkey_leer(path))
  diag <- out$diagnostico

  # Ninguno debería ser battery_item
  expect_equal(sum(diag$kind_guess == "battery_item"), 0L,
    info = "50/50 está bajo el threshold del 80%, no debe formar battery")

  # Cada uno cae como select_one independiente
  expect_equal(sum(grepl("^select_one", diag$type_final, useBytes = TRUE)), 4L)

  # Y debería emitirse aviso 'battery_descartada' por la heurística previa
  avisos <- diag[!is.na(diag$aviso_tipo) & diag$aviso_tipo == "battery_descartada", ]
  expect_true(nrow(avisos) >= 2L,
    info = "se esperan avisos battery_descartada para el grupo fragmentado")
})
