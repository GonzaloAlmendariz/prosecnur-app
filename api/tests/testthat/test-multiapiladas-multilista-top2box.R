# La columna Top Two Box declarada en la lámina llega a sus bloques.
#
# En `multilista` los bloques son elementos hijos construidos por el mismo
# constructor. Los que no heredaban `top2box` reponían el defecto `FALSE` y la
# columna no se dibujaba, aunque la lámina la declarara: el síntoma era que
# declarar `top2box = TRUE` no movía el conteo de láminas con columna.

.bloques_min <- function() {
  list(
    list(modo = "var", vars = list("base$p1")),
    list(modo = "var", vars = list("base$p2"))
  )
}

test_that("los bloques heredan la declaracion de la lamina", {
  el <- p_barras_multiapiladas(
    modo = "multilista",
    bloques = .bloques_min(),
    top2box = TRUE,
    top2box_labels = c("De acuerdo", "Muy de acuerdo")
  )

  expect_length(el$bloques, 2L)
  for (b in el$bloques) {
    expect_true(isTRUE(b$top2box))
    expect_identical(unname(b$top2box_labels), c("De acuerdo", "Muy de acuerdo"))
  }
})

test_that("un bloque puede declarar lo suyo por encima de la herencia", {
  bloques <- .bloques_min()
  bloques[[2]]$top2box_labels <- c("Satisfecho", "Muy satisfecho")

  el <- p_barras_multiapiladas(
    modo = "multilista",
    bloques = bloques,
    top2box = TRUE,
    top2box_labels = c("De acuerdo", "Muy de acuerdo")
  )

  expect_identical(unname(el$bloques[[1]]$top2box_labels), c("De acuerdo", "Muy de acuerdo"))
  expect_identical(unname(el$bloques[[2]]$top2box_labels), c("Satisfecho", "Muy satisfecho"))
})

test_that("un bloque puede apagar la columna que la lamina enciende", {
  # Una escala de dos categorías dentro de una lámina de escalas de acuerdo:
  # la columna no informa ahí y el bloque debe poder decirlo.
  bloques <- .bloques_min()
  bloques[[2]]$top2box <- FALSE

  el <- p_barras_multiapiladas(
    modo = "multilista",
    bloques = bloques,
    top2box = TRUE
  )

  expect_true(isTRUE(el$bloques[[1]]$top2box))
  expect_false(isTRUE(el$bloques[[2]]$top2box))
})

test_that("sin declaracion en la lamina los bloques siguen sin columna", {
  el <- p_barras_multiapiladas(modo = "multilista", bloques = .bloques_min())

  for (b in el$bloques) {
    expect_false(isTRUE(b$top2box))
    expect_null(b$top2box_labels)
  }
})

test_that("los codigos tambien se heredan", {
  el <- p_barras_multiapiladas(
    modo = "multilista",
    bloques = .bloques_min(),
    top2box = TRUE,
    top2box_codes = c(4L, 5L)
  )

  for (b in el$bloques) expect_identical(unname(b$top2box_codes), c(4L, 5L))
})
