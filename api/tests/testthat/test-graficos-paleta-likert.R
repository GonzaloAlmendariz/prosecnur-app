source("setup-load-all.R")

test_that("una escala de acuerdo o satisfacción sin paleta toma la Likert del estándar en su sentido, con lo especial en gris (Gonzalo, 2026-10-09)", {
  lk <- unname(.std_paleta("likert"))
  p4 <- .graficos_mk_palette(c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información"))
  expect_identical(unname(p4), c(lk[1:4], lk[5]))
  p5 <- .graficos_mk_palette(c("Muy satisfecho", "Satisfecho", "Ni satisfecho ni insatisfecho", "Insatisfecho", "Muy insatisfecho"))
  expect_identical(unname(p5), rev(unname(.std_paleta("likert_neutro"))[1:5]))      # el negativo al final: la rampa se invierte
})

test_that("lo que no es escala conserva la paleta categórica y la paleta del usuario siempre manda", {
  base <- .graficos_mk_palette(c("Redes", "Amigo", "Otro"))
  expect_identical(unname(base), c("#0B4F8C", "#2A9D8F", "#E9C46A"))
  expect_identical(unname(.graficos_mk_palette(c("Sí", "No"))), c("#0B4F8C", "#2A9D8F"))
  expect_identical(unname(.graficos_mk_palette(c("TD", "D", "A", "TA"))), c("#0B4F8C", "#2A9D8F", "#E9C46A", "#F4A261"))   # abreviada: no se adivina
  mia <- c(`Totalmente en desacuerdo` = "#111111", `En desacuerdo` = "#222222", `De acuerdo` = "#333333", `Totalmente de acuerdo` = "#444444")
  expect_identical(unname(.graficos_mk_palette(names(mia), mia)), unname(mia))
})

test_that("en la ruta real una escala apilada sin colores sale con la Likert del recetario", {
  rot <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información")
  d <- data.frame(actor = "Docentes", N = 52, p1 = 0, p2 = .02, p3 = .29, p4 = .54, p5 = .15)
  p <- suppressWarnings(graficar_barras_apiladas(data = d, var_categoria = "actor", var_n = "N", cols_porcentaje = paste0("p", 1:5),
                                                 etiquetas_grupos = setNames(rot, paste0("p", 1:5))))
  expect_identical(toupper(attr(p, "pulso_espec")$categorias$color), toupper(unname(.std_paleta("likert"))))
})
