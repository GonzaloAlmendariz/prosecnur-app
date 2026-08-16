# El cupo de líneas del enunciado sale del alto REAL de la fila.
#
# Estaba fijo en 3, calibrado contra el alto por defecto (0.42 in). Pero el
# motor ya ensancha la fila cuando las etiquetas de eje lo piden —hasta 1.06 in—
# y el cupo no se enteraba: el enunciado seguía cortándose a tres líneas en una
# fila que admitía el doble.

.nlineas <- function(x) length(strsplit(x, "\n", fixed = TRUE)[[1]])
.titulo <- function(n) paste(rep("linea", n), collapse = "\n")

test_that("sin alto declarado se conserva el cupo de siempre", {
  # Cambiar de constante a derivado no puede mover lo que ve un gráfico que no
  # pasa el alto.
  expect_identical(.nlineas(suppressMessages(.barras_acotar_titulo_grupo(.titulo(9), 1))), 3L)
  expect_identical(.nlineas(suppressMessages(.barras_acotar_titulo_grupo(.titulo(9), 2))), 6L)
})

test_that("el alto por defecto da el mismo cupo que la constante", {
  # 0.42 in a 13 pt con interlineado 0.86: caben 3 líneas. Que coincida con la
  # constante es lo que hace que este cambio no sea una regresión encubierta.
  n <- .nlineas(suppressMessages(
    .barras_acotar_titulo_grupo(.titulo(9), 1, alto_fila_in = 0.42, cuerpo_pt = 13)))
  expect_identical(n, 3L)
})

test_that("una fila alta admite mas lineas", {
  n <- .nlineas(suppressMessages(
    .barras_acotar_titulo_grupo(.titulo(9), 1, alto_fila_in = 1.06, cuerpo_pt = 13)))
  expect_gt(n, 3L)
})

test_that("el cupo nunca baja de la constante", {
  # Una fila estrecha no puede dejar el enunciado con menos de lo que ya daba:
  # el derivado sube el cupo, nunca lo recorta.
  n <- .nlineas(suppressMessages(
    .barras_acotar_titulo_grupo(.titulo(9), 1, alto_fila_in = 0.10, cuerpo_pt = 13)))
  expect_identical(n, 3L)
})

test_that("un cuerpo mayor reduce las lineas que caben en el mismo alto", {
  chico <- .nlineas(suppressMessages(
    .barras_acotar_titulo_grupo(.titulo(12), 1, alto_fila_in = 1.06, cuerpo_pt = 9)))
  grande <- .nlineas(suppressMessages(
    .barras_acotar_titulo_grupo(.titulo(12), 1, alto_fila_in = 1.06, cuerpo_pt = 18)))
  expect_gt(chico, grande)
})

test_that("un titulo que cabe entero no se toca ni avisa", {
  expect_silent(r <- .barras_acotar_titulo_grupo(.titulo(2), 1))
  expect_identical(.nlineas(r), 2L)
})
