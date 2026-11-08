# Ola 4, A2 (G-b con datos de Arte): en «G. 2 vertical divergente con saldo» la apilada de imagen bajaba su leyenda a 11 pt
# (`.barras_leyenda_size_ajustado`) mientras la divergente la dejaba en 12. El test de la ola 3 sólo miraba un fixture
# sintético donde la banda alcanzaba; este usa el caso de la captura (cuatro grupos con Top Two Box y exclusión,
# `.ola4_clima()`), donde la banda no alcanzaba y la letra cedía.

test_that("A2: en la lámina de dos gráficos en vertical, cada rol lleva el mismo cuerpo en los dos paneles", {
  skip_if_not_installed("officer"); skip_if_not_installed("ggplot2")
  r <- .ola4_lamina_g()
  cj <- .ola2_cajas(r$pptx, 1L)
  claves <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF")
  ley <- cj[cj$texto %in% claves, , drop = FALSE]
  medio <- 1.33 + (6.88 - 1.33) / 2
  arriba <- ley[ley$y0 < medio, , drop = FALSE]; abajo <- ley[ley$y0 >= medio, , drop = FALSE]
  expect_identical(nrow(arriba), 5L); expect_identical(nrow(abajo), 5L)
  # La leyenda: el mismo cuerpo en los dos paneles y nunca bajo el del estándar.
  expect_lt(diff(range(ley$pt)), 0.1)
  expect_true(all(ley$pt >= .std_pt("leyenda") - 0.05))
  # La «Base:» de cada panel también al mismo cuerpo, y con aire bajo su leyenda (≥ 0.03 in).
  base <- cj[grepl("^Base:", cj$texto), , drop = FALSE]
  expect_identical(nrow(base), 2L)
  expect_lt(diff(range(base$pt)), 0.1)
  b_abajo <- base[which.max(base$y0), ]
  expect_gte(b_abajo$y0 - max(abajo$y1), 0.03)
})
