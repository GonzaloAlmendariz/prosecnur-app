# Formato del xlsx de la BBDD: la hoja de códigos NO lleva la fila de etiquetas
# (fila 2), la de etiquetas SÍ, y los anchos de columna están acotados (no el
# "auto" sin tope que producía columnas exageradamente anchas).

library(testthat)

.fx_data <- function() {
  d <- data.frame(
    sexo = c(1L, 2L),
    comentario_muy_largo = c(
      "Un comentario de texto libre francamente larguísimo que en auto se desbordaría",
      "Otro"
    ),
    stringsAsFactors = FALSE
  )
  attr(d$sexo, "label") <- "Sexo de la persona entrevistada"
  attr(d$comentario_muy_largo, "label") <- "Comentario abierto del encuestador"
  d
}

test_that("la hoja de códigos NO tiene fila de etiquetas; datos arrancan en fila 2", {
  skip_if_not(requireNamespace("openxlsx", quietly = TRUE), "openxlsx no disponible")
  d <- .fx_data()
  out <- tempfile(fileext = ".xlsx"); on.exit(unlink(out), add = TRUE)
  .bases_write_xlsx(d, d, out, valores = "ambos")

  cod <- openxlsx::read.xlsx(out, sheet = "codigos", colNames = FALSE)
  expect_equal(as.character(cod[1, 1]), "sexo")          # fila 1 = nombre técnico
  expect_equal(as.character(cod[2, 1]), "1")             # fila 2 = DATO (no la etiqueta)
  expect_false(as.character(cod[2, 1]) == "Sexo de la persona entrevistada")
})

test_that("la hoja de etiquetas conserva la fila 2 de labels; datos en fila 3", {
  skip_if_not(requireNamespace("openxlsx", quietly = TRUE), "openxlsx no disponible")
  d <- .fx_data()
  out <- tempfile(fileext = ".xlsx"); on.exit(unlink(out), add = TRUE)
  .bases_write_xlsx(d, d, out, valores = "ambos")

  etq <- openxlsx::read.xlsx(out, sheet = "etiquetas", colNames = FALSE)
  expect_equal(as.character(etq[1, 1]), "sexo")
  expect_equal(as.character(etq[2, 1]), "Sexo de la persona entrevistada")
  expect_equal(as.character(etq[3, 1]), "1")
})

test_that("hoja única de códigos (valores='codigos') tampoco lleva fila de etiquetas", {
  skip_if_not(requireNamespace("openxlsx", quietly = TRUE), "openxlsx no disponible")
  d <- .fx_data()
  out <- tempfile(fileext = ".xlsx"); on.exit(unlink(out), add = TRUE)
  .bases_write_xlsx(d, d, out, valores = "codigos")

  dat <- openxlsx::read.xlsx(out, sheet = "datos", colNames = FALSE)
  expect_equal(as.character(dat[1, 1]), "sexo")
  expect_equal(as.character(dat[2, 1]), "1")  # dato en fila 2, sin fila de etiqueta
})

test_that("los anchos de columna están acotados por hoja (códigos < etiquetas)", {
  skip_if_not(requireNamespace("openxlsx", quietly = TRUE), "openxlsx no disponible")
  d <- .fx_data()
  out <- tempfile(fileext = ".xlsx"); on.exit(unlink(out), add = TRUE)
  .bases_write_xlsx(d, d, out, valores = "ambos")

  wb <- openxlsx::loadWorkbook(out)
  # colWidths es una lista por POSICIÓN de hoja (sin nombres): [[1]]=codigos, [[2]]=etiquetas.
  w_cod <- suppressWarnings(as.numeric(wb$colWidths[[1]]))
  w_lab <- suppressWarnings(as.numeric(wb$colWidths[[2]]))
  w_cod <- w_cod[is.finite(w_cod)]; w_lab <- w_lab[is.finite(w_lab)]
  expect_true(length(w_cod) > 0 && length(w_lab) > 0)
  expect_true(all(w_cod <= 16L))   # tope de códigos
  expect_true(all(w_lab <= 32L))   # tope de etiquetas
})
