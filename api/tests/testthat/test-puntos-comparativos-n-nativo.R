source("setup-load-all.R")

# G11 (Gonzalo, 2026-10-13): la lámina nativa de puntos comparativos dice el n de cada público, como la imagen; sin él
# la nota al pie define una «n» que no aparece en la lámina.
test_that("cada público de la lámina nativa lleva su n junto al nombre; la cifra queda sola", {
  d <- data.frame(grupo = c("Docentes", "Estudiantes"), porcentaje = c(43, 71.5), n = c(12L, 289L), stringsAsFactors = FALSE)
  g <- graficar_puntos_comparativos(d, var_grupo = "grupo", var_valor = "porcentaje", var_n = "n")
  e <- attr(g, "pulso_espec")
  expect_identical(e$forma, "lollipop")
  expect_identical(e$rotulos, c("Docentes (n = 12)", "Estudiantes (n = 289)"))
  expect_false(any(grepl("n =", e$cifras, fixed = TRUE)))
})
