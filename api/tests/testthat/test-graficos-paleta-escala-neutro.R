source("setup-load-all.R")

# Una escala de siete pasos con medio neutro («Regular») pinta el medio en el gris neutro, no en el verde olivo que daba
# interpolar los cuatro colores Likert (Gonzalo, revisión del PPT v7 de CCSS, lámina 65: «Regular no debería ser verde»).

test_that("siete pasos con medio neutro: negativos a amarillo, medio gris, positivos a verde", {
  niv <- c("Pésima", "Muy mala", "Mala", "Regular", "Buena", "Muy buena", "Excelente")
  p <- .paleta_likert_recetario(niv)
  ln <- unname(.std_paleta("likert_neutro")); lk <- unname(.std_paleta("likert"))
  expect_identical(unname(p["Regular"]), ln[3])
  expect_identical(toupper(unname(p[c("Pésima", "Mala", "Buena", "Excelente")])), toupper(c(lk[1], lk[2], lk[3], lk[4])))
})

test_that("cuatro y cinco pasos no cambian, y sin medio neutro sigue la interpolación", {
  expect_identical(.paleta_rampa_escala(4L), unname(.std_paleta("likert"))[1:4])
  expect_identical(.paleta_rampa_escala(5L, c("a", "b", "regular", "d", "e")), unname(.std_paleta("likert_neutro"))[1:5])
  expect_identical(.paleta_rampa_escala(7L, c("a", "b", "c", "d", "e", "f", "g")),
                   grDevices::colorRampPalette(unname(.std_paleta("likert"))[1:4])(7))
})
