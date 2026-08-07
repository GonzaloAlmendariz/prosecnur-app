source("setup-load-all.R")

# La columna extra lleva la cifra que resume la lamina —el top-two-box— y su
# tamano de fabrica era 3 pt: mas pequeno que cualquier otro texto del grafico.
# Dos rutas del motor ya lo subian a 11 a mano, senal de que el defecto nunca
# sirvio.

test_that("la cifra de la barra extra nace legible", {
  fml <- formals(graficar_barras_apiladas)
  size_extra <- eval(fml$size_barra_extra)
  size_ejes <- eval(fml$size_ejes)
  expect_gte(size_extra, size_ejes)
  expect_gte(eval(fml$size_titulo_extra), 8)
})

test_that("la escala de acuerdo va de rojo a verde, sin azul en el extremo", {
  # El azul marino que ocupaba el extremo positivo es el color de la marca, no
  # el de «lo mejor»: rompia la lectura de un vistazo, porque el ojo busca el
  # verde.
  pal <- .reporte_plan_pulso_palette_for_levels(
    c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo",
      "Totalmente de acuerdo", "SIN INF"))
  rgb_de <- function(x) grDevices::col2rgb(x)[, 1]
  peor <- rgb_de(pal[["Totalmente en desacuerdo"]])
  mejor <- rgb_de(pal[["Totalmente de acuerdo"]])
  # El extremo negativo tira a rojo y el positivo a verde.
  expect_gt(peor["red"], peor["green"])
  expect_gt(mejor["green"], mejor["red"])
  expect_gt(mejor["green"], mejor["blue"])
  # Y el residual sin informacion se queda gris.
  gris <- rgb_de(pal[["SIN INF"]])
  expect_lt(max(gris) - min(gris), 12)
})

test_that("una dicotomia se pinta en dos tonos del mismo azul", {
  # Rojo contra azul marca una de las dos como mala, y en «¿Conoce el
  # reglamento?» el «No» es un dato, no una falta.
  pal <- .reporte_plan_pulso_palette_for_levels(c("Sí", "No"))
  rgb_de <- function(x) grDevices::col2rgb(x)[, 1]
  for (nivel in c("Sí", "No")) {
    v <- rgb_de(pal[[nivel]])
    expect_gt(v["blue"], v["red"])
  }
  # Dos tonos distintos, no el mismo color repetido.
  expect_false(identical(pal[["Sí"]], pal[["No"]]))
  # Y uno claramente mas oscuro que el otro.
  expect_gt(sum(rgb_de(pal[["No"]])), sum(rgb_de(pal[["Sí"]])))
})

test_that("tres o mas categorias sin recorrido no usan la escala de acuerdo", {
  pal <- .reporte_plan_pulso_palette_for_levels(c("Lima", "Arequipa", "Cusco"))
  expect_equal(unname(pal[1]), "#081F5C")
})
