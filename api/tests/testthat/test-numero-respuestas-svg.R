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

test_that("el Top Two Box va centrado en su columna y una leyenda de cinco respuestas no se sale del lienzo", {
  az <- .std_color("azul")
  e2 <- list(enunciado = "El reglamento es pertinente.", publico = "Docentes",
             tramos = data.frame(pct = c(3, 8, 75, 9, 5), color = c("#F4B183", "#FFD965", "#ADD493", "#70AD47", "#BFBFBF"),
                                 etiqueta = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF"),
                                 label_color = rep(az, 5), stringsAsFactors = FALSE),
             top_two = "84%", nota_n = "N = 77")
  svg <- paste(readLines(.numero_respuestas_svg(ejemplos = list(e2), base_texto = "Base: 115 docentes")), collapse = "")
  # Rótulo y cifra del box: el mismo x y centrados (antes arrancaban en la misma x, alineados a la izquierda).
  x_rot <- as.numeric(sub('.*<text x="([0-9.]+)"[^>]*>TOP TWO BOX<.*', "\\1", svg))
  x_cif <- as.numeric(sub('.*<text x="([0-9.]+)"[^>]*>84%<.*', "\\1", svg))
  expect_equal(x_rot, x_cif)
  expect_match(svg, 'text-anchor="middle"[^>]*>TOP TWO BOX<')
  # La leyenda: su último texto termina dentro del lienzo (ancho estimado como lo estima la propia leyenda).
  m <- regmatches(svg, gregexpr('<text x="([0-9.]+)"[^>]*font-size="15"[^>]*>([^<]+)</text>', svg))[[1]]
  xs <- as.numeric(sub('<text x="([0-9.]+)".*', "\\1", m)); tx <- sub('.*>([^<]+)</text>', "\\1", m)
  expect_lte(max(xs + nchar(tx) * 15 * 0.54), .NRESP_W)
  expect_gte(min(xs), 0)
})
