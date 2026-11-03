# B3 (CCSS Perfil 2026, revisión v3, lámina 17): «60% (12)» se partía en dos líneas porque la caja de la cifra medía su
# tinta + 0.12 in y la caja de texto pierde 0.1 in por lado. La caja suma esos márgenes; la columna, que decide el largo
# de las barras, no cambia.

test_that("la caja de cada cifra deja su ancho de tinta libre de los márgenes internos", {
  e <- preparar_categorica(c("Callao", "La Perla", "Bellavista"), c(.60, .15, .10), c("60% (12)", "15% (3)", "10% (2)"))
  lz <- .lam_lienzo()
  .lam_barras_h(lz, e, 0.5, 1, 6, wlab = 2, g = 0.3, fila = 0.6)
  nombres <- vapply(lz$formas, function(x) regmatches(x, regexpr('name="[^"]*"', x)), "")
  cif <- lz$cajas[nombres == 'name="cifra"']
  expect_length(cif, 3L)
  ancho <- vapply(cif, function(b) b[3] - b[1], 0)
  tinta <- max(.lam_ancho_txt(e$cifras, .std_pt("rotulo_categoria"), TRUE))
  expect_true(all(ancho - 0.2 >= tinta))   # cabe en una línea: la tinta entra en el ancho útil de la caja
  # Las barras no se acortan: la mayor mide lo mismo que con la columna de siempre (0.8 in o la tinta + 0.12).
  barras <- lz$cajas[nombres == 'name="barra"']
  wcif <- max(0.8, tinta + 0.12)
  expect_equal(barras[[1]][3] - barras[[1]][1], (6 - 2 - wcif) * .60 / (.60 * 1.12), tolerance = 1e-9)   # sin escala completa: al máximo × 1.12
})
