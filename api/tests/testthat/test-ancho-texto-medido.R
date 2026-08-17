# P43. El criterio de «cabe o no cabe» tiene que medir, no estimar.
#
# El caso que originó esto, con sus cifras: cajón de 5.2 in, fracción de
# etiquetas 0.45, o sea 2.22 in de columna. La etiqueta «Entre 1500 y 3000
# soles» —23 caracteres a 13 pt— mide 1.958 in de verdad y cabía con un cuarto
# de pulgada de sobra; el estimado de 0.55 em por carácter le calculaba 2.28 in
# y la rechazaba **por un solo carácter**, con lo que se envolvía a dos líneas y
# el ajuste de P42 bajaba el cuerpo a 7.99 pt. El aprobado la pone a 13 pt en
# una sola línea.

test_that("el ancho medido es el de la fuente y no un promedio", {
  skip_if_not_installed("systemfonts")
  w <- .ancho_texto_in("Entre 1500 y 3000 soles", 13)
  expect_length(w, 1L)
  expect_true(is.finite(w))
  # 1.958 in medidos con Arial 13 pt. Se deja holgura por si la versión de la
  # fuente cambia, pero no tanta como para que el estimado de 0.55 —2.28 in—
  # entre en el rango: si entrara, la prueba dejaría de distinguir.
  expect_gt(w, 1.80)
  expect_lt(w, 2.10)
})


test_that("una etiqueta que cabe no se envuelve", {
  skip_if_not_installed("systemfonts")
  et <- c("Menos de 1500 soles", "Entre 1500 y 3000 soles",
          "Entre 3001 y 4500 soles", "Mas de 7500 soles")
  # Este es EL caso: 2.22 in de columna a 13 pt.
  n <- .chars_que_caben(et, 5.2 * 0.45 - 0.12, 13)
  expect_equal(n, 23L)

  # El estimado histórico devolvía 22 y por eso partía. Se comprueba aquí para
  # que la diferencia quede escrita y no dependa de recordarla.
  estimado <- floor((5.2 * 0.45 - 0.12) / (13 * .ANCHO_CHAR_EM_ESTIMADO / 72))
  expect_equal(estimado, 22)
  expect_gt(n, estimado)
})


test_that("una etiqueta que no cabe recibe un presupuesto derivado de su medida", {
  skip_if_not_installed("systemfonts")
  et <- c("Un enunciado bastante mas largo que la columna disponible")
  n <- .chars_que_caben(et, 1.0, 13)
  expect_true(is.finite(n))
  expect_lt(n, nchar(et))
  expect_gte(n, 10L)
  # Y el presupuesto tiene que ser coherente con lo medido: los `n` caracteres
  # que devuelve no pueden pedir mas de la columna.
  por_char <- .ancho_texto_in(et, 13) / nchar(et)
  expect_lte(n * por_char, 1.0 + 1e-9)
})


test_that("manda la etiqueta que mas ancho pide, no la que mas caracteres tiene", {
  skip_if_not_installed("systemfonts")
  # «1 1 1 1 1 1» tiene mas caracteres que «MMMMMMMM» y ocupa menos: medidos a
  # 13 pt, 0.85 in contra 1.22. La primera version de esta prueba puso once
  # pares y salio 1.47 in —mas ancha que la «M», justo lo contrario de lo que
  # queria demostrar—: la medicion corrigio la expectativa, no el codigo.
  angosta <- "1 1 1 1 1 1"
  ancha   <- "MMMMMMMM"
  expect_gt(nchar(angosta), nchar(ancha))
  expect_gt(.ancho_texto_in(ancha, 13), .ancho_texto_in(angosta, 13))

  # Con las dos en el eje, el presupuesto tiene que salir de la ancha.
  ancho_col <- as.numeric(.ancho_texto_in(ancha, 13)) * 0.5
  n <- .chars_que_caben(c(angosta, ancha), ancho_col, 13)
  esperado <- floor(ancho_col / (.ancho_texto_in(ancha, 13) / nchar(ancha)))
  expect_equal(n, as.integer(max(10L, esperado)))
})


test_that("sin nada que medir devuelve NA y quien llama decide el respaldo", {
  expect_true(is.na(.chars_que_caben(character(0), 2, 13)))
  expect_true(is.na(.chars_que_caben(c("algo"), NA_real_, 13)))
  expect_true(is.na(.chars_que_caben(c("algo"), -1, 13)))
  expect_true(all(is.na(.ancho_texto_in("algo", 0))))
  expect_true(all(is.na(.ancho_texto_in("algo", NA))))
})


test_that("el estimado historico se conserva como respaldo y no como criterio", {
  # Si alguien lo mueve, que sea a sabiendas: 0.55 es el percentil 75 de las
  # CAJAS de texto del mazo —relleno incluido—, no el ancho del texto, cuya
  # mediana medida es 0.507.
  expect_equal(.ANCHO_CHAR_EM_ESTIMADO, 0.55)
})


test_that("el graficador consulta la medida antes que el estimado", {
  ruta <- testthat::test_path("..", "..", "R", "graficador_barras_agrupadas.R")
  skip_if_not(file.exists(ruta))
  src <- paste(readLines(ruta, warn = FALSE), collapse = "\n")
  # La llamada medida existe...
  expect_true(grepl(".chars_que_caben(cat_lvls, ancho_columna_in, size_ejes_eff)",
                    src, fixed = TRUE))
  # ...y el estimado sobrevive solo dentro del respaldo por `is.na()`.
  expect_true(grepl("if (is.na(chars_fit))", src, fixed = TRUE))
  expect_false(grepl("size_ejes_eff * 0.55 / 72", src, fixed = TRUE))
})
