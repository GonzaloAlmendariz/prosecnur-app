# CCSS-14 y CCSS-22: cifras chicas sobre la barra apilada o divergente, sin solaparse y sin omitir ninguna.
# Criterio conservador: ninguna cifra se calla (no está en la leyenda ni en el Top Two Box); se reparten con su tinta.

.w5_caja <- function(pos, w) cbind(pos - w / 2, pos + w / 2)

test_that("dos cifras de segmentos vecinos («1% 1%») no se tocan y se reparten a ambos lados de sus segmentos", {
  cs <- c(1.00, 1.05); w <- c(0.3, 0.3)
  p <- .lam_callouts_sin_solape(cs, w, x0 = 0, x1 = 8, aire = 0.12)
  cj <- .w5_caja(p, w)
  expect_gte(cj[2, 1] - cj[1, 2], 0.12 - 1e-9)
  # Centradas en el par: la primera también se mueve (antes se clavaba y sólo corría la segunda).
  expect_equal(mean(p), mean(cs), tolerance = 1e-9)
})

test_that("una cifra sola o lejana queda sobre su segmento (sin codo)", {
  p <- .lam_callouts_sin_solape(c(1, 5), c(0.3, 0.3), 0.5, 8)
  expect_equal(p, c(1, 5))
})

test_that("el no sustantivo al final de la barra no cae sobre la cifra de su izquierda y no sale del borde", {
  cs <- c(7.6, 7.85, 7.97); w <- c(0.3, 0.3, 0.3)
  p <- .lam_callouts_sin_solape(cs, w, x0 = 2, x1 = 8, aire = 0.12)
  cj <- .w5_caja(p, w)
  expect_true(all(cj[-1, 1] - cj[-3, 2] >= 0.12 - 1e-9))
  expect_lte(max(cj[, 2]), 8 + 0.06 + 1e-9)
  expect_length(p, 3L)   # ninguna se omite
})

test_that("tres cifras apiñadas al inicio no salen por la izquierda", {
  p <- .lam_callouts_sin_solape(c(2.0, 2.02, 2.05), c(0.3, 0.3, 0.3), x0 = 2, x1 = 9, aire = 0.12)
  expect_gte(min(p - 0.15), 2 - 0.06 - 1e-9)
  expect_true(all(diff(p) >= 0.42 - 1e-9))
})
