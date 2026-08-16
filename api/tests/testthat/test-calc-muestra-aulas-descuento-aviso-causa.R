# El aviso del descuento apagado dice POR QUE, no solo que se apago.
#
# Dos situaciones opuestas comparten el sintoma "sin ids", y llevan a acciones
# distintas: si falta la columna el marco es recuperable —reconstruirlo desde la
# base devuelve los datos—; si la columna esta y viene vacia el marco es anonimo
# y no hay nada que recuperar. El mensaje anterior decia lo mismo en los dos
# casos, y ademas en vocabulario del motor ("no trae unique_student_ids
# parseables"), que no le dice a nadie que hacer.
#
# Medido con el estudio real de 2025-2: su `.pulso` lo guardo 0.7.1 el
# 2026-08-06, dos dias antes de que los ids pasaran a subrogarse en vez de
# borrarse (F114). Reconstruido desde su propio archivo fuente, la columna
# vuelve — o sea que en ese proyecto el aviso SI tenia una salida que ofrecer.

.desc_frame <- function(ids = NULL) {
  df <- data.frame(classroom_id = c("A1", "A2"), eligible_n = c(10L, 12L), stringsAsFactors = FALSE)
  if (!is.null(ids)) df$unique_student_ids <- ids
  df
}

test_that("sin la columna, el aviso ofrece reconstruir el marco", {
  av <- .cm_descuento_aviso_sin_ids(.desc_frame())
  expect_length(av, 1L)
  expect_true(grepl("^descuento_sin_ids:", av))
  # La salida concreta, que es lo unico accionable del mensaje.
  expect_true(grepl("reconstruir el marco desde la base", av, fixed = TRUE))
  # Y sin jerga del motor: un nombre de columna interna no viaja a la UI.
  expect_false(grepl("unique_student_ids", av, fixed = TRUE))
})

test_that("con la columna vacia, el aviso NO promete una salida que no existe", {
  # Marco anonimo: reconstruirlo no devuelve nada porque nunca hubo ids.
  # Ofrecerlo igual manda a repetir un trabajo caro para el mismo resultado.
  av <- .cm_descuento_aviso_sin_ids(.desc_frame(c("", "")))
  expect_true(grepl("anonimo", av, fixed = TRUE))
  expect_false(grepl("reconstruir", av, fixed = TRUE))
})

test_that("el estado del descuento publica el aviso que corresponde", {
  sin_col <- .cm_descuento_estado(.desc_frame(), list(sequential_discount = TRUE), "cube")
  expect_identical(sin_col$warning_code, "descuento_sin_ids")
  expect_false(sin_col$applied)
  expect_true(grepl("reconstruir el marco", sin_col$warnings, fixed = TRUE))

  anonimo <- .cm_descuento_estado(.desc_frame(c("", "")), list(sequential_discount = TRUE), "cube")
  expect_identical(anonimo$warning_code, "descuento_sin_ids")
  expect_true(grepl("anonimo", anonimo$warnings, fixed = TRUE))

  # Con ids reales no hay aviso: el descuento aplica.
  con_ids <- .cm_descuento_estado(.desc_frame(c("1|2|3", "2|3|4")), list(sequential_discount = TRUE), "cube")
  expect_true(con_ids$applied)
  expect_identical(con_ids$warning_code, "")

  # Y apagado a proposito tampoco avisa: no se desactivo nada por sorpresa.
  apagado <- .cm_descuento_estado(.desc_frame(), list(sequential_discount = FALSE), "cube")
  expect_identical(apagado$warning_code, "")
  expect_length(apagado$warnings, 0L)
})
