# B11 del GOAL motor PPT (carril L9, hallazgo B-H18): la leyenda de fallback
# del FODA etiquetaba los colores con sus NOMBRES ("Rojo", "Ambar", "Verde")
# en vez de su significado. Ahora usa los umbrales del semaforo.

test_that("la leyenda del FODA dice el umbral, no el nombre del color", {
  labs <- .dim_foda_legend_labels(list(cortes = c(60, 80)))
  expect_identical(labs, c("Menor a 60", "60 - 80", "Mayor a 80"))
  expect_false(any(c("Rojo", "Ambar", "Verde") %in% labs))
})

test_that("sin cortes finitos degrada a Bajo/Medio/Alto (nunca nombres de color)", {
  expect_identical(.dim_foda_legend_labels(list()), c("Bajo", "Medio", "Alto"))
  expect_identical(.dim_foda_legend_labels(list(cortes = NA)), c("Bajo", "Medio", "Alto"))
})
