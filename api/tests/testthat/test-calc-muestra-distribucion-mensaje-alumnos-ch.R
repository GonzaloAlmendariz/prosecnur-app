# El aviso nombra el paso que falta, no el mecanismo que lo detecta.
#
# Decia «El resultado no conserva la firma de la decision Alumnos/CH» y dejaba
# las cuatro tarjetas de la banda de Cálculo en «—». «Firma» y «Alumnos/CH» son
# vocabulario del motor: quien lo lee no sabe qué hacer.
#
# Medido en el recorrido desde cero con las bases 2026: la causa era que la
# decision de «Alumnos por CH» no estaba confirmada en Marco. Confirmando P25
# ahi y recalculando, la banda publico 2.500 / 3.750 / 403.
#
# ESTO ES UNA GUARDA DE REDACCION, y se dice para que nadie la lea como mas de
# lo que es: comprueba el texto en la fuente, no ejecuta el motor. Construir el
# componente completo para provocar el aviso exige un fixture de diseño entero
# —`.cm_dist_sensitivity` pide parametros que un stub no tiene— y eso probaria
# el pipeline, no la palabra, que es lo que aqui se protege.

.cmd_fuente <- function() {
  path <- testthat::test_path("..", "..", "R", "calc_muestra_distribucion.R")
  if (!file.exists(path)) path <- file.path("api", "R", "calc_muestra_distribucion.R")
  paste(readLines(path, warn = FALSE), collapse = "\n")
}

test_that("el aviso de Alumnos por CH nombra el paso y no habla de firmas", {
  txt <- .cmd_fuente()
  # El bloque del motivo `source_frame_hash_missing` y su mensaje.
  i <- regexpr("source_frame_hash_missing", txt, fixed = TRUE)
  expect_gt(i, 0)
  bloque <- substr(txt, i, i + 900)
  expect_true(grepl("Falta confirmar Alumnos por CH en Marco", bloque, fixed = TRUE))
  # Y el mensaje viejo no vuelve por la puerta de atras.
  expect_false(grepl("no conserva la firma de la decis", txt, fixed = TRUE))
})

test_that("los otros motivos del mismo guard siguen siendo accionables", {
  # Control: el cambio no puede haberse llevado por delante los demas avisos,
  # que ya estaban en castellano y decian que hacer.
  txt <- .cmd_fuente()
  expect_true(grepl("La distribución fue calculada con una decisión de marco anterior.", txt, fixed = TRUE))
  expect_true(grepl("No existe un marco vigente con hash verificable.", txt, fixed = TRUE))
})
