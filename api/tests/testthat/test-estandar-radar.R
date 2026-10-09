# ADR 0092 (F2.7d) — el radar del recetario: con valores altos el eje arranca en
# el múltiplo de 5 bajo el mínimo y los anillos se rotulan cada 5 puntos sobre la
# diagonal, sin rotular el centro.

.radar_labels <- function(p) {
  b <- ggplot2::ggplot_build(p)$data
  unlist(lapply(b, function(d) if ("label" %in% names(d)) grep("%$", as.character(d$label), value = TRUE)))
}

test_that("con valores de 84 a 98 el eje va de 80 a 100 y rotula 85, 90, 95 y 100", {
  d <- data.frame(eje = rep(c("A", "B", "C", "D", "E", "F"), 2), grupo = rep(c("G1", "G2"), each = 6),
                  valor = c(96, 94, 92, 98, 90, 88, 84, 90, 85, 95, 91, 86))
  p <- suppressWarnings(graficar_radar(d, escala_valor = "proporcion_100"))
  expect_setequal(unique(.radar_labels(p)), c("85%", "90%", "95%", "100%"))
})

test_that("con valores bajos el eje sigue desde 0", {
  d <- data.frame(eje = rep(c("A", "B", "C"), 2), grupo = rep(c("G1", "G2"), each = 3),
                  valor = c(20, 45, 60, 30, 50, 70))
  p <- suppressWarnings(graficar_radar(d, escala_valor = "proporcion_100"))
  expect_true("100%" %in% .radar_labels(p))
  expect_false("0%" %in% .radar_labels(p))   # el centro no se rotula
})

test_that("unos limites declarados mandan sobre el piso automatico", {
  d <- data.frame(eje = rep(c("A", "B", "C"), 2), grupo = rep(c("G1", "G2"), each = 3),
                  valor = c(90, 92, 94, 91, 93, 95))
  p <- suppressWarnings(graficar_radar(d, escala_valor = "proporcion_100", limites = c(0, 1)))
  expect_true("25%" %in% .radar_labels(p))
})
