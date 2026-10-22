# Libro de códigos: las preguntas sin lista (numéricas, texto, calculadas) se
# documentan con su etiqueta y una línea de contenido (2026-10-16).

.cbs_df <- function() {
  df <- data.frame(
    `_uuid` = c("a", "b", "c", "d"),
    P1 = c("18", "21", "67", NA),
    P2 = c(1, 2, 1, 2),
    P8_otro = c("", "fui a la daes", NA, "otro"),
    indice = c(0.5, 1.25, 2, 2),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  attr(df$P1, "label") <- "¿Cuál es tu edad?"
  attr(df$P2, "label") <- "Sexo"
  attr(df$P2, "labels") <- c("1" = "Mujer", "2" = "Hombre")
  attr(df$P8_otro, "label") <- "Otro (especifica)"
  attr(df$indice, "label") <- "Índice"
  attr(df, "instrumento_reporte") <- list(survey = data.frame(
    type = c("text", "select_one sexo", "text", "calculate", "start"),
    name = c("P1", "P2", "P8_otro", "indice", "inicio"), stringsAsFactors = FALSE))
  df
}

test_that("la línea de contenido dice numérica con rango o texto, con sus casos", {
  expect_identical(codebook_descripcion_sin_lista(c("18", "21", "67", NA)), "Numérica (de 18 a 67)")
  expect_identical(codebook_descripcion_sin_lista(c(0.5, 1.25, 2)), "Numérica (de 0.5 a 2)")
  expect_identical(codebook_descripcion_sin_lista(c("", "fui a la daes", NA)), "Texto abierto")
  expect_identical(codebook_descripcion_sin_lista(c(NA, "")), "Sin respuestas en la base")
  expect_identical(codebook_descripcion_sin_lista(rep(1, 1500)), "Numérica (1)")
})

test_that("el Excel documenta las preguntas sin lista y deja fuera los metadatos", {
  skip_if_not_installed("openxlsx")
  df <- .cbs_df()
  out <- tempfile(fileext = ".xlsx")
  on.exit(unlink(out), add = TRUE)
  .write_codebook_from_df(df, outfile = out, ficha_tecnica = FALSE)
  m <- as.matrix(openxlsx::read.xlsx(out, colNames = FALSE, skipEmptyRows = FALSE))
  celdas <- as.character(m)
  for (v in c("P1", "P2", "P8_otro", "indice")) expect_true(v %in% m[, 1], info = v)
  expect_false("_uuid" %in% m[, 1])
  expect_true("Numérica (de 18 a 67)" %in% celdas)
  expect_true("Texto abierto" %in% celdas)
  expect_true("Contenido" %in% m[, 1])
  # La categórica sigue con su bloque de siempre.
  expect_true("Valores válidos" %in% m[, 1])
  expect_true("Mujer" %in% celdas)
})

test_that("el PDF arma bloque también para las preguntas sin lista", {
  b <- .codebook_pdf_build_blocks(.cbs_df())
  nombres <- vapply(b, `[[`, "", "name")
  expect_identical(nombres, c("P1", "P2", "P8_otro", "indice"))
  expect_identical(b[[1]]$labels, "Numérica (de 18 a 67)")
})

test_that("la exportación repone las preguntas sin lista que el filtro de Frecuencias quita, salvo excluidas", {
  full <- .cbs_df()
  filtrada <- full[, c("P2"), drop = FALSE]
  attr(filtrada, "instrumento_reporte") <- attr(full, "instrumento_reporte")
  out <- .codebook_con_sin_lista(full, filtrada, excluidas = "P8_otro")
  expect_identical(names(out), c("P1", "P2", "indice"))
  expect_identical(attr(out$P1, "label"), "¿Cuál es tu edad?")
  expect_false(is.null(attr(out, "instrumento_reporte")))
})

test_that("un calculate con orden vacío entra como sin lista y un año no lleva separador de miles", {
  skip_if_not_installed("openxlsx")
  df <- .cbs_df()
  out <- tempfile(fileext = ".xlsx")
  on.exit(unlink(out), add = TRUE)
  # El orden del instrumento trae una entrada vacía para el calculate.
  .write_codebook_from_df(df, ord = list(indice = list(names = character(0), labels = character(0))),
                          outfile = out, ficha_tecnica = FALSE)
  m <- as.matrix(openxlsx::read.xlsx(out, colNames = FALSE, skipEmptyRows = FALSE))
  expect_true("indice" %in% m[, 1])
  expect_identical(codebook_descripcion_sin_lista(c("1999", "2017")), "Numérica (de 1999 a 2017)")
})
