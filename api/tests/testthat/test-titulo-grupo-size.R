# P46. El cuerpo del enunciado de bloque baja hasta que el texto cabe, con piso,
# que es la palanca del entregable aprobado: sus enunciados largos van a 12 y 13
# pt donde el motor pone 14.
#
# El `wrap_fun` se inyecta para poder probar sin dispositivo gráfico. En
# producción es `.barras_wrap_titulo_grupo()`, que mide con `grid::textGrob`.
# Aquí se usa uno determinista con la misma forma: a menor cuerpo, más
# caracteres por línea.

.wrap_falso <- function(chars_a_14 = 30) {
  function(x, pt) max(1, floor(chars_a_14 * 14 / pt))
}

test_that("si el cuerpo declarado ya cabe, no lo toca", {
  # Un bloque de nueve pulgadas sostiene cualquier cosa.
  expect_equal(
    .titulo_grupo_size_que_cabe("un enunciado corto", 9, .wrap_falso(), 14),
    14
  )
})


test_that("baja el cuerpo hasta que cabe, y ni un punto más", {
  # Medido con este envoltorio: el texto ocupa 8 líneas a 14 pt y 6 de 13 para
  # abajo, así que el alto que pide es 1.338 · 0.932 · 0.860 · 0.788 in a 14,
  # 13, 12 y 11 pt. Con un bloque de 0.80 in cabe a 11 y no a 12 — y el piso se
  # baja a 9 para que el resultado no se confunda con el piso.
  texto <- paste(rep("palabra", 24), collapse = " ")
  wf <- .wrap_falso()
  n <- .titulo_grupo_size_que_cabe(texto, 0.80, wf, 14, minimo_pt = 9)
  expect_equal(n, 11)

  lineas <- function(pt) {
    length(strsplit(stringr::str_wrap(texto, width = wf(texto, pt)), "\n", fixed = TRUE)[[1]])
  }
  cabe <- function(pt) lineas(pt) * (pt / 72) * .BARRAS_INTERLINEA_TITULO <= 0.80 + 1e-9
  expect_true(cabe(n))
  expect_false(cabe(n + 1))
})


test_that("nunca baja del piso, aunque no quepa de ninguna manera", {
  texto <- paste(rep("palabra", 200), collapse = " ")
  expect_equal(.titulo_grupo_size_que_cabe(texto, 0.2, .wrap_falso(), 14, minimo_pt = 11), 11)
  expect_equal(.titulo_grupo_size_que_cabe(texto, 0.2, .wrap_falso(), 14, minimo_pt = 9), 9)
})


test_that("manda el bloque que peor lo tiene, no el promedio", {
  # Uno holgado y uno apretado: el cuerpo tiene que salir del apretado.
  corto <- "corto"
  largo <- paste(rep("palabra", 24), collapse = " ")
  wf <- .wrap_falso()
  solo <- .titulo_grupo_size_que_cabe(largo, 0.60, wf, 14)
  juntos <- .titulo_grupo_size_que_cabe(c(corto, largo), c(9, 0.60), wf, 14)
  expect_equal(juntos, solo)
})


test_that("un solo cuerpo para toda la lámina", {
  # Es un escalar, no un vector por bloque: el aprobado usa 12 pt para los
  # cuatro enunciados de su lámina 29, y mezclar tamaños entre bloques vecinos
  # se ve.
  r <- .titulo_grupo_size_que_cabe(
    c("a", paste(rep("palabra", 24), collapse = " "), "b"),
    c(9, 0.60, 9), .wrap_falso(), 14
  )
  expect_length(r, 1L)
})


test_that("sin nada que medir devuelve el declarado y no adivina", {
  expect_equal(.titulo_grupo_size_que_cabe(character(0), numeric(0), .wrap_falso(), 14), 14)
  expect_equal(.titulo_grupo_size_que_cabe("x", 1, "no soy funcion", 14), 14)
  # Un `wrap_fun` que no sabe medir: se conserva el declarado en vez de bajar a
  # ciegas hasta el piso.
  expect_equal(.titulo_grupo_size_que_cabe("x", 0.01, function(x, pt) NA_real_, 14), 14)
  expect_equal(.titulo_grupo_size_que_cabe("x", 0.01, function(x, pt) stop("boom"), 14), 14)
})


test_that("el piso por encima del declarado no sube el cuerpo", {
  # El declarado es el techo: este helper encoge, nunca agranda.
  expect_equal(.titulo_grupo_size_que_cabe("x", 0.01, .wrap_falso(), 10, minimo_pt = 13), 10)
})


test_that("el graficador lo usa antes de envolver y de dibujar", {
  # Un helper sin consumidor no repara nada, y el consumo tiene que estar ANTES
  # del bucle que envuelve: si se calculara dentro, cada bloque saldría con su
  # propio cuerpo.
  ruta <- testthat::test_path("..", "..", "R", "graficador_barras_apiladas.R")
  skip_if_not(file.exists(ruta))
  lineas <- readLines(ruta, warn = FALSE)

  asigna <- grep("size_titulos_grupo <- .titulo_grupo_size_que_cabe(", lineas, fixed = TRUE)
  bucle  <- grep("for (i in seq_len(nrow(group_df)))", lineas, fixed = TRUE)
  expect_equal(length(asigna), 1L)
  expect_gte(length(bucle), 1L)
  expect_lt(asigna[1], bucle[1])
})
