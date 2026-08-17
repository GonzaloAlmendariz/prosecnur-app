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

test_that("las medidas salen en centimetros", {
  # El OOXML mide en EMU y officer en pulgadas, pero un informe que dice
  # «0.303 in» obliga a convertir para compararlo con una regla o con la guía
  # del canvas, que ya acota en cm.
  expect_true(all(c("grosor_escala_cm", "grosor_categorica_cm") %in% names(.VERIF_UMBRALES)))
  expect_false(any(grepl("_in$", names(.VERIF_UMBRALES))))
  # Y los umbrales son los del entregable aprobado, no números redondos.
  expect_equal(.VERIF_UMBRALES$grosor_escala_cm, 0.77)
  expect_equal(.VERIF_UMBRALES$grosor_categorica_cm, 0.65)
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

# --- R4: el rojo institucional es color de título, no extremo de escala -------

test_that("un rojo seguido del amarillo es rampa", {
  # El criterio es la vecindad, no el color: el mismo `#CA5651` pinta los
  # títulos del entregable aprobado 67 veces sin ser nunca escala.
  xml <- paste0('<a:srgbClr val="CA5651"/><a:srgbClr val="FFD965"/>')
  expect_identical(.verif_rojo_en_rampa(xml), 1L)
})

test_that("un rojo de titulo no cuenta como rampa", {
  xml <- '<a:srgbClr val="CA5651"/><a:srgbClr val="081F5C"/>'
  expect_identical(.verif_rojo_en_rampa(xml), 0L)
  # Ni el último color del XML, que no tiene vecino que lo delate.
  expect_identical(.verif_rojo_en_rampa('<a:srgbClr val="CA5651"/>'), 0L)
})

test_that("cuenta cada rampa, no solo si hay alguna", {
  xml <- paste(rep('<a:srgbClr val="CA5651"/><a:srgbClr val="FFD966"/>', 3), collapse = "")
  expect_identical(.verif_rojo_en_rampa(xml), 3L)
})

# --- R7: el título no se pega al borde ---------------------------------------

test_that("lee el borde superior del titulo en centimetros", {
  # El título se reconoce por su cuerpo de 24 pt y no por el nombre de su
  # placeholder, que cambia entre plantillas.
  xml <- paste0('<p:sp><a:rPr sz="2400"/><a:off x="0" y="', round(0.37 * 914400),
                '"/><a:ext cx="100" cy="100"/></p:sp>')
  expect_equal(.verif_titulo_top_cm(xml), 0.37 * 2.54, tolerance = 1e-6)
})

test_that("una lamina sin titulo no inventa una medida", {
  expect_true(is.na(.verif_titulo_top_cm('<p:sp><a:rPr sz="1400"/></p:sp>')))
  expect_true(is.na(.verif_titulo_top_cm("")))
})

test_that("las dos reglas ya no figuran como no cubiertas", {
  # Un informe que sigue declarando sin cubrir algo que ya mide se lee como si
  # tuviera menos alcance del que tiene.
  skip_if_not(requireNamespace("officer", quietly = TRUE))
  pptx <- tempfile(fileext = ".pptx")
  print(officer::read_pptx(), target = pptx)
  nc <- verificar_mazo(pptx)$no_cubierto
  expect_false(any(grepl("^R4|^R7", nc)))
  expect_true(any(grepl("^R6|^R8|^R9|^R10", nc)))
})

# --- R9: una cifra blanca sobre un tramo claro no se lee ---------------------

.forma <- function(x, y, w, h, col, texto = "") {
  list(x = x, y = y, w = w, h = h, col = col, texto = texto)
}

test_that("una cifra blanca sobre naranja cuenta como ilegible", {
  # Es la regresión posible de la receta 4: al pasar el extremo negativo de rojo
  # oscuro a naranja claro, la cifra blanca que se leía deja de leerse.
  formas <- list(
    .forma(1, 1, 2, 0.4, "F4B183"),
    .forma(1.8, 1.1, 0.3, 0.2, "FFFFFF", "8%")
  )
  expect_identical(.verif_texto_ilegible(formas), 1L)
})

test_that("una cifra blanca sobre verde oscuro se lee", {
  formas <- list(
    .forma(1, 1, 2, 0.4, "70AD47"),
    .forma(1.8, 1.1, 0.3, 0.2, "FFFFFF", "46%")
  )
  expect_identical(.verif_texto_ilegible(formas), 0L)
})

test_that("se cruza por POSICION, no por orden en el XML", {
  # El método por forma devuelve el relleno de la propia caja, no el del
  # segmento de debajo: por eso el recetario no pudo medirlo. Una cifra fuera
  # del segmento claro no cuenta aunque esté declarada justo al lado.
  formas <- list(
    .forma(1, 1, 2, 0.4, "F4B183"),
    .forma(9, 1.1, 0.3, 0.2, "FFFFFF", "8%")
  )
  expect_identical(.verif_texto_ilegible(formas), 0L)
})

test_that("sin tramos claros no hay nada ilegible", {
  formas <- list(.forma(1, 1, 0.3, 0.2, "FFFFFF", "8%"))
  expect_identical(.verif_texto_ilegible(formas), 0L)
  expect_identical(.verif_texto_ilegible(list()), 0L)
})

test_that("cuenta cada cifra, no solo si hay alguna", {
  formas <- list(
    .forma(1, 1, 4, 0.4, "FFD965"),
    .forma(1.5, 1.1, 0.3, 0.2, "FFFFFF", "8%"),
    .forma(2.5, 1.1, 0.3, 0.2, "FFFFFF", "9%"),
    .forma(3.5, 1.1, 0.3, 0.2, "FFFFFF", "7%")
  )
  expect_identical(.verif_texto_ilegible(formas), 3L)
})

# --- R8 y B2: arranque del bloque y aire entre premisas ----------------------

test_that("el arranque es el borde superior de la primera barra", {
  xml <- .lamina(.barra(y = 3.0, h = 0.40), .barra(y = 3.5, h = 0.40))
  expect_equal(.verif_arranque_cm(.verif_formas(xml)), 3.0 * 2.54, tolerance = 1e-6)
})

test_that("el hueco entre premisas separa las DOS poblaciones", {
  # Dos públicos pegados (0.1) y un salto a la premisa siguiente (0.8). Medir
  # la mezcla con un estadístico resumen no distingue una cosa de la otra, y
  # esa confusión ya costó perseguir un alto variable que no existía.
  xml <- .lamina(
    .barra(y = 1.0, h = 0.30), .barra(y = 1.4, h = 0.30),
    .barra(y = 2.5, h = 0.30), .barra(y = 2.9, h = 0.30)
  )
  h <- .verif_hueco_entre_premisas_cm(.verif_formas(xml))
  expect_equal(h, 0.8 * 2.54, tolerance = 0.05)
})

test_that("una lamina con huecos uniformes no inventa un valor", {
  # Sin dos poblaciones distinguibles no hay «entre premisas» que medir, y
  # devolver la mediana de todo sería fabricarlo.
  xml <- .lamina(
    .barra(y = 1.0, h = 0.30), .barra(y = 1.5, h = 0.30),
    .barra(y = 2.0, h = 0.30), .barra(y = 2.5, h = 0.30)
  )
  expect_true(is.na(.verif_hueco_entre_premisas_cm(.verif_formas(xml))))
})

test_that("con menos de cuatro barras no se mide el hueco", {
  xml <- .lamina(.barra(y = 1.0, h = 0.30), .barra(y = 1.5, h = 0.30))
  expect_true(is.na(.verif_hueco_entre_premisas_cm(.verif_formas(xml))))
})


# --- P36: la vara medía una paleta y el mazo tiene dos -----------------------
#
# `barras_por_grafico` sale de `barras_escala`, que sólo cuenta la RAMPA, y el
# techo se aplicaba luego a las dos paletas. Los graficos AZULES del aprobado
# llegan a 8 barras y a 1.8049 cm de grosor, y nada de eso lo miraba nadie.
# Medido con las reglas nuevas: el aprobado da CERO —cumple sus propios techos
# por construccion— y el motor daba SEIS, invisibles hasta ahora.

test_that("los techos de la azul existen y son los del aprobado", {
  expect_equal(.VERIF_UMBRALES$barras_por_grafico_categorico, 8L)
  expect_equal(.VERIF_UMBRALES$grosor_categorico_max_cm, 1.81)
})


test_that("el techo de grosor NO se redondea hacia abajo", {
  # El valor exacto del aprobado es 1.8049. A dos decimales hacia abajo, la
  # PROPIA referencia incumplia su techo por cinco milesimas, y un techo que la
  # referencia no cumple no mide conformidad.
  expect_gt(.VERIF_UMBRALES$grosor_categorico_max_cm, 1.8049)
})


test_that("los techos de la azul son techos, no pisos", {
  # `grosor_categorica_cm` es el PISO —que la barra no salga demasiado fina— y
  # `grosor_categorico_max_cm` el techo. Confundirlos invierte la regla.
  expect_lt(.VERIF_UMBRALES$grosor_categorica_cm,
            .VERIF_UMBRALES$grosor_categorico_max_cm)
})


test_that("el techo de la azul es MAS ancho que el de la rampa", {
  # Una barra dicotomica aguanta mas filas: no reparte su ancho entre cuatro
  # tramos con su cifra dentro. Es la misma medicion que gobierna
  # `.PARTICION_MAX_BARRAS_DICOTOMICA`.
  expect_gt(.VERIF_UMBRALES$barras_por_grafico_categorico,
            .VERIF_UMBRALES$barras_por_grafico)
})
