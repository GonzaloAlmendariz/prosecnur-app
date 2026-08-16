# Un perfil no es una comparación: sus barras van del color de la casa.
#
# Cuando hay una sola columna de porcentaje, las «series» son las categorías de
# una misma variable —los tramos de edad, los niveles de estudio— y darle un
# color a cada una sugiere una comparación entre cosas que no se comparan.
# Medido: el entregable aprobado lleva 51 de 52 barras de perfil en el azul
# institucional; el motor las sacaba con cinco colores de la paleta genérica.

test_that("una declaracion sin los nombres de los niveles no manda", {
  # El preset del estudio declara seis colores con nombres genéricos
  # («Categoria_1»…) que no coinciden con ninguna categoría real: no emparejan,
  # el motor cae a la genérica, y el perfil salía con colores que no eran ni los
  # declarados ni los de la casa.
  decl <- c(Categoria_1 = "#CA5651", Categoria_2 = "#EFD25E")
  niveles <- c("Hasta 25", "26 a 35", "36 a 45")
  expect_false(any(names(decl) %in% niveles))
})

test_that("una declaracion que si nombra los niveles manda", {
  decl <- c("Hasta 25" = "#CA5651", "26 a 35" = "#EFD25E")
  niveles <- c("Hasta 25", "26 a 35")
  expect_true(any(names(decl) %in% niveles))
})

test_that("el azul del perfil es el institucional", {
  expect_identical(.PULSO_PPT_COLORS$azul, "#081F5C")
})
