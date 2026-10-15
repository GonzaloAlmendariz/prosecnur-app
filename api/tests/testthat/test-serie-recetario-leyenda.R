# G3 (checklist-histograma-serie-antetitulo-2026-10-14.md): la serie del recetario lleva la leyenda abajo por defecto;
# «derecha» conserva el nombre al final de cada línea.

.srl_df <- function() {
  df <- expand.grid(.periodo = c("2018", "2021", "2026"), .serie = c("A", "B"), stringsAsFactors = FALSE)
  df$.y <- c(70, 75, 80, 60, 62, 79)
  df$.periodo <- factor(df$.periodo, levels = c("2018", "2021", "2026"))
  df$.serie <- factor(df$.serie)
  df
}

.srl_capas_de_nombre <- function(p) {
  sum(vapply(p$layers, function(l) inherits(l$geom, "GeomText") && "g" %in% as.character(l$mapping$label[[2]] %||% ""), logical(1)))
}

test_that("por defecto la leyenda va abajo y no hay nombres al final de la línea", {
  p <- .serie_recetario(.srl_df(), c(A = "#081F5C", B = "#CA5651"))
  expect_identical(p$theme$legend.position, "bottom")
  expect_equal(.srl_capas_de_nombre(p), 0)
})

test_that("«derecha» conserva el nombre de cada serie al final de su línea, sin leyenda", {
  p <- .serie_recetario(.srl_df(), c(A = "#081F5C", B = "#CA5651"), leyenda = "derecha")
  expect_identical(p$theme$legend.position, "none")
  expect_equal(.srl_capas_de_nombre(p), 1)
})

test_that("dos cifras del mismo período y casi a la misma altura van a lados opuestos", {
  d <- data.frame(x = c(1, 2, 1, 2, 1, 2), v = c(90, 88, 74, 74, 73, 73), g = rep(c("a", "b", "c"), each = 2))
  u <- .serie_recetario_ubicar(d, c(50, 100))
  ult <- u[u$x == 2 & u$g %in% c("b", "c"), ]
  expect_false(ult$vj[1] == ult$vj[2])
})
