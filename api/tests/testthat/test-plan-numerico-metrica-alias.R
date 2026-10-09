source("setup-load-all.R")

# H41 (docs/qa/checklist-motor-ppt-diagnostico-2026-10-06.md): `p_numerico(metrica = "media")` pasaba en silencio a
# "median" porque `match.arg` acepta coincidencias parciales y "media" es prefijo de "median". Un analista que pedia la
# media recibia la mediana rotulada como tal, sin aviso. La metrica se resuelve por nombre exacto o por alias en
# espanol, y lo que no se reconoce es un error.

metrica_de <- function(...) p_numerico(var = "x", ...)$args$metrica %||% p_numerico(var = "x", ...)$metrica

test_that("«media» es la media, no la mediana (H41)", {
  expect_equal(metrica_de(metrica = "media"), "mean")
  expect_equal(metrica_de(metrica = "promedio"), "mean")
  expect_equal(metrica_de(metrica = "mediana"), "median")
  expect_equal(metrica_de(metrica = "porcentaje"), "pct")
  expect_equal(metrica_de(metrica = "n"), "N")
})

test_that("los nombres canónicos se conservan y el default es la media", {
  for (m in c("mean", "median", "N", "pct")) expect_equal(metrica_de(metrica = m), m)
  expect_equal(metrica_de(), "mean")
})

test_that("una métrica que no se reconoce es un error, no una coincidencia parcial", {
  expect_error(p_numerico(var = "x", metrica = "med"))
  expect_error(p_numerico(var = "x", metrica = "moda"))
})

test_that("en el render, un alias se respeta y lo desconocido avisa (H41)", {
  expect_equal(.numerico_resolver_metrica(list(metrica = "mediana"), list(), list()), "median")
  expect_equal(.numerico_resolver_metrica(list(), list(metrica = "media"), list()), "mean")
  expect_warning(r <- .numerico_resolver_metrica(list(metrica = "moda"), list(), list()), "no reconocida")
  expect_equal(r, "mean")
})
