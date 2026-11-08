source("setup-load-all.R")

# U5 (ADR 0135, supuestos de la escala): el respaldo ggplot de la divergente apilaba el gris de «Sin información» pegado
# al acuerdo. Va en su propia columna, tras el lado derecho más largo y con un hueco; la lámina nativa no cambia.

test_that("en el respaldo ggplot «Sin información» no se apila con el acuerdo: va en su columna, tras un hueco", {
  skip_if_not_installed("ggplot2")
  d <- data.frame(it = c("A", "B"), n1 = c(.1, .2), n2 = c(.1, .1), n3 = c(.3, .2), n4 = c(.3, .2), n9 = c(.2, .3))
  p <- graficar_barras_divergentes(d, "it", c("n1", "n2", "n3", "n4", "n9"), escala_valor = "proporcion_1", incluir_neutro = FALSE,
                                   etiquetas_grupos = c(n1 = "TD", n2 = "D", n3 = "A", n4 = "TA", n9 = "Sin información"),
                                   codigos_grupos = c(n1 = "1", n2 = "2", n3 = "3", n4 = "4", n9 = "9"))
  capas <- vapply(p$layers, function(l) class(l$geom)[1], "")
  col <- p$data   # el apilado usa los datos del gráfico
  expect_false("n9" %in% as.character(col$.cat))
  tile <- p$layers[[which(capas == "GeomTile")[1]]]$data
  expect_identical(sort(as.character(tile$.item)), c("A", "B"))
  der <- max(tapply(col$.signo[col$.signo > 0], col$.item[col$.signo > 0], sum))
  expect_true(all(tile$.x - tile$.w / 2 > der))          # arranca después del acuerdo más largo, con hueco
  expect_equal(sort(tile$.w), c(20, 30))
  # La especificación de la lámina nativa sigue igual: la columna sin_inf fuera de los lados.
  expect_identical(attr(p, "pulso_espec")$categorias$lado, c("neg", "neg", "pos", "pos", "sin_inf"))
})
