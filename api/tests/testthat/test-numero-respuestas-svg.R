# La lamina «Numero de respuestas» del entregable aprobado no EXPLICA donde va
# el numero de respuestas: lo ENSEÑA con dos graficos de ejemplo y les cuelga
# las mismas anotaciones numeradas que el parrafo usa como notas al pie.
#
# El motor emitia titulo + parrafo + bullet, con el 80 % de la lamina en blanco.

.nresp_leer <- function(...) {
  paste(readLines(.numero_respuestas_svg(...), warn = FALSE), collapse = "")
}


test_that("la lamina trae los DOS ejemplos, no uno", {
  # El aprobado enseña el caso dicotomico —donde la base va en la nota al pie—
  # y el de escala —donde la N baja al propio grafico porque esa pregunta tuvo
  # menos respuestas—. Con un solo ejemplo la lamina explica la mitad de lo que
  # dice el parrafo.
  svg <- .nresp_leer()
  expect_true(grepl("Conoce el Plan de", svg, fixed = TRUE))
  expect_true(grepl("El contenido del Plan de", svg, fixed = TRUE))
})


test_that("las dos anclas numeradas estan, y son las del parrafo", {
  # El 1 apunta a la base al pie; el 2, a la N sobre el grafico. Sin las anclas,
  # la explicacion y el ejemplo son dos cosas sueltas en la misma pagina.
  svg <- .nresp_leer()
  expect_true(grepl("Base: 12 egresados", svg, fixed = TRUE))
  expect_true(grepl("N = 12", svg, fixed = TRUE))
  # Recuadro punteado en ambas.
  expect_gte(length(gregexpr("stroke-dasharray", svg)[[1]]), 2L)
})


test_that("el top two box del segundo ejemplo sale con su cifra", {
  svg <- .nresp_leer()
  expect_true(grepl("TOP TWO BOX", svg, fixed = TRUE))
  expect_true(grepl("58%", svg, fixed = TRUE))
})


test_that("un tramo estrecho SI escribe su cifra", {
  # El «8 %» del ejemplo dicotomico ocupa 34 px. Con el umbral en 2.2 veces el
  # cuerpo se quedaba fuera y el aprobado si lo escribe; con 1.6 entra.
  svg <- .nresp_leer()
  expect_true(grepl(">8%<", svg, fixed = TRUE))
})


test_that("un tramo de cero no escribe cifra ni rompe", {
  ej <- list(list(
    enunciado = "Prueba", publico = "Egresados",
    tramos = data.frame(pct = c(100, 0), color = c("#9DC3E6", "#336699"),
                        etiqueta = c("Sí", "No"), stringsAsFactors = FALSE)
  ))
  svg <- .nresp_leer(ejemplos = ej)
  expect_true(grepl(">100%<", svg, fixed = TRUE))
  expect_false(grepl(">0%<", svg, fixed = TRUE))
})


test_that("sin datos utilizables no se dibuja una barra vacia", {
  expect_equal(
    .nresp_barra(0, 0, 100, 20,
                 data.frame(pct = c(0, 0), color = c("#000", "#111"),
                            stringsAsFactors = FALSE)),
    ""
  )
})


test_that("el texto se escapa: un `&` no puede romper el SVG", {
  ej <- list(list(
    enunciado = "Costos & presupuestos", publico = "Egresados",
    tramos = data.frame(pct = c(60, 40), color = c("#9DC3E6", "#336699"),
                        etiqueta = c("Sí", "No"), stringsAsFactors = FALSE)
  ))
  svg <- .nresp_leer(ejemplos = ej)
  expect_true(grepl("Costos &amp; presupuestos", svg, fixed = TRUE))
})


test_that("el estilo puede cambiar los colores sin tocar el codigo", {
  svg <- .nresp_leer(style = list(text_color = "#123456"))
  expect_true(grepl("#123456", svg, fixed = TRUE))
})


test_that("un color invalido cae al de respaldo en vez de romper el SVG", {
  svg <- .nresp_leer(style = list(text_color = "no-es-un-color"))
  expect_false(grepl("no-es-un-color", svg, fixed = TRUE))
  expect_true(grepl("#081F5C", svg, fixed = TRUE))
})
