# El verificador del mazo mide sobre geometría construida a mano.
#
# Existe porque el medidor con el que se dio V5 por cerrada tenía un fallo de
# agrupación: conservaba sólo el primer eje de cada columna y descartaba el
# resto de barras, así que veía 18 gráficos donde hay 74 y declaraba «0 bajo el
# piso» sin haber mirado la mayoría. Un medidor sin pruebas propias no es una
# vara: es una opinión con decimales.

.sp <- function(x, y, w, h, col, texto = "") {
  t <- if (nzchar(texto)) sprintf("<a:t>%s</a:t>", texto) else ""
  sprintf(paste0('<p:sp><a:off x="%.0f" y="%.0f"/><a:ext cx="%.0f" cy="%.0f"/>',
                 '<a:solidFill><a:srgbClr val="%s"/></a:solidFill>%s</p:sp>'),
          x * 914400, y * 914400, w * 914400, h * 914400, col, t)
}

.lamina <- function(...) paste0("<p:sld>", paste0(..., collapse = ""), "</p:sld>")

# Una barra apilada: varios segmentos en la misma fila, mismo alto.
.barra <- function(y, h, x0 = 1.0, ancho_total = 4.0, n_seg = 2L) {
  w <- ancho_total / n_seg
  paste0(vapply(seq_len(n_seg), function(k) {
    .sp(x0 + (k - 1L) * w, y, w, h, .VERIF_RAMPA[[k]])
  }, character(1)), collapse = "")
}

test_that("agrupa los segmentos de una fila en una sola barra", {
  xml <- .lamina(.barra(y = 1.0, h = 0.40, n_seg = 4L),
                 .barra(y = 1.5, h = 0.40, n_seg = 4L))
  g <- .verif_graficos(.verif_segmentos(.verif_formas(xml), .VERIF_RAMPA))

  expect_length(g, 1L)
  expect_identical(g[[1]]$n, 2L)
  expect_equal(g[[1]]$grosor, 0.40)
})

test_that("no pierde barras cuyo eje varia dentro de la misma columna", {
  # El fallo que motivó este test: ejes en 1.00, 1.05 y 1.10 son el MISMO
  # gráfico, y el agrupador roto se quedaba sólo con el primero.
  xml <- .lamina(
    .barra(y = 1.0, h = 0.40, x0 = 1.00),
    .barra(y = 1.5, h = 0.40, x0 = 1.05),
    .barra(y = 2.0, h = 0.40, x0 = 1.10)
  )
  g <- .verif_graficos(.verif_segmentos(.verif_formas(xml), .VERIF_RAMPA))

  expect_length(g, 1L)
  expect_identical(g[[1]]$n, 3L)
})

test_that("separa dos graficos que viven en columnas distintas", {
  xml <- .lamina(
    .barra(y = 1.0, h = 0.40, x0 = 1.0, ancho_total = 4.0),
    .barra(y = 1.5, h = 0.40, x0 = 1.0, ancho_total = 4.0),
    .barra(y = 1.0, h = 0.25, x0 = 7.2, ancho_total = 4.0),
    .barra(y = 1.5, h = 0.25, x0 = 7.2, ancho_total = 4.0)
  )
  g <- .verif_graficos(.verif_segmentos(.verif_formas(xml), .VERIF_RAMPA))

  expect_length(g, 2L)
  expect_setequal(vapply(g, function(x) x$grosor, numeric(1)), c(0.40, 0.25))
})

test_that("la leyenda no se cuenta como un grafico", {
  # Cuadraditos de leyenda: mismos colores de la rampa, pero diminutos.
  leyenda <- paste0(vapply(1:4, function(k) {
    .sp(2 + k * 0.6, 5.0, 0.12, 0.12, .VERIF_RAMPA[[k]])
  }, character(1)), collapse = "")
  xml <- .lamina(.barra(y = 1.0, h = 0.40), .barra(y = 1.5, h = 0.40), leyenda)
  g <- .verif_graficos(.verif_segmentos(.verif_formas(xml), .VERIF_RAMPA))

  expect_length(g, 1L)
  expect_identical(g[[1]]$n, 2L)
})

test_that("la caja de etiqueta no se cuenta como barra categorica", {
  # Mismo azul que la barra, pero lleva texto propio.
  xml <- .lamina(
    .sp(1.0, 1.0, 3.0, 0.30, .VERIF_AZUL),
    .sp(1.0, 1.5, 3.0, 0.30, .VERIF_AZUL),
    .sp(1.0, 2.0, 3.0, 0.159, .VERIF_AZUL, texto = "Muy de acuerdo")
  )
  g <- .verif_graficos(.verif_segmentos(.verif_formas(xml), .VERIF_AZUL,
                                        exigir_sin_texto = TRUE))
  expect_length(g, 1L)
  expect_identical(g[[1]]$n, 2L)
  expect_equal(g[[1]]$grosor, 0.30)
})

test_that("el grosor es la moda, no la media", {
  # Una cabecera más alta conviviendo con las barras no debe mover el grosor.
  xml <- .lamina(
    .barra(y = 1.0, h = 0.40), .barra(y = 1.5, h = 0.40),
    .barra(y = 2.0, h = 0.40), .barra(y = 0.4, h = 0.90)
  )
  g <- .verif_graficos(.verif_segmentos(.verif_formas(xml), .VERIF_RAMPA))
  expect_equal(g[[1]]$grosor, 0.40)
})

test_that("un grafico de una sola barra no entra", {
  xml <- .lamina(.barra(y = 1.0, h = 0.40))
  expect_length(.verif_graficos(.verif_segmentos(.verif_formas(xml), .VERIF_RAMPA)), 0L)
})

test_that("el informe declara lo que NO mira", {
  # Un informe que calla lo que no comprueba se lee como si lo hubiera aprobado.
  pptx <- tempfile(fileext = ".pptx")
  skip_if_not(requireNamespace("officer", quietly = TRUE))
  doc <- officer::read_pptx()
  print(doc, target = pptx)

  r <- verificar_mazo(pptx)
  expect_true(length(r$no_cubierto) > 0L)
  expect_true(is.data.frame(r$hallazgos))
  expect_true(all(c("regla", "lamina", "valor", "esperado") %in% names(r$hallazgos)))
})
