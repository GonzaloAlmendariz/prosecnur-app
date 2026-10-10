source("setup-load-all.R")

# F6.0b.6: la cifra destacada se calcula desde la base con la regla del informe.

.base <- data.frame(titulo = c(1, 1, 2, 2, 2, 2, NA, 2, 1, 2), edad = c(22, 23, 21, 25, 22, 30, 24, NA, 22, 23))
.inst <- list(survey = data.frame(name = "titulo", type = "select_one si_no", list_name = "si_no", label = "¿Tiene título?"),
              choices = data.frame(list_name = "si_no", name = c("1", "2"), label = c("Sí", "No")), orders_list = NULL)

test_that("el porcentaje de una categoría se calcula sobre quienes respondieron, sin espacio antes de %", {
  c1 <- .cifra_desde_datos(.base, "titulo", "porcentaje", categoria = "1", rotulo = "de los egresados tiene el título")
  expect_identical(c1$valor, "33%"); expect_identical(c1$detalle, "3 de 9"); expect_equal(c1$base, 9L)
  c2 <- .cifra_desde_datos(.base, "titulo", "porcentaje", categoria = "Sí", instrumento = .inst, rotulo = "x")
  expect_identical(c2$valor, "33%")                                            # la categoría también casa por su etiqueta
})

test_that("número de respuestas, mediana con unidad y media con un decimal", {
  expect_identical(.cifra_desde_datos(.base, "titulo", "n", rotulo = "egresados encuestados")$valor, "9")
  expect_identical(.cifra_desde_datos(.base, "edad", "mediana", unidad = "años", rotulo = "edad mediana")$valor, "23 años")
  expect_identical(.cifra_desde_datos(.base, "edad", "media", rotulo = "edad media")$valor, "23.6")
})

test_that("lo que no se puede calcular se dice, no se inventa", {
  expect_error(.cifra_desde_datos(.base, "no_existe", "n", rotulo = "x"), "no está en la base")
  expect_error(.cifra_desde_datos(.base, "titulo", "porcentaje", rotulo = "x"), "indica la categoría")
  expect_error(.cifra_desde_datos(data.frame(v = c(NA, NA)), "v", "n", rotulo = "x"), "no tiene respuestas válidas")
})

test_that("las cifras calculadas arman una banda válida", {
  it <- list(.cifra_desde_datos(.base, "titulo", "n", rotulo = "egresados encuestados", icono = "users"),
             .cifra_desde_datos(.base, "edad", "mediana", unidad = "años", rotulo = "edad mediana"))
  e <- pulso_cifras(it)
  expect_true(.lam_cifras_cabe(e)); expect_identical(e$items[[2]]$valor, "23 años")
})
