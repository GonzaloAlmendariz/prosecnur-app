# El material de una cerrada con «Otro» emparejado son los textos de «Otro».

test_that("una cerrada con sus textos de Otro codificados queda completa, no en curso", {
  data_df <- data.frame(
    P8 = rep(as.character(2017:2026), 3),
    P8_otro = c("antes de 2015", "2014", rep(NA, 28)),
    stringsAsFactors = FALSE
  )
  row <- list(parent = "P8", tipo = "select_one", modo_so = "padre", text_col = "P8_otro", parent_col = "P8", use = TRUE)
  stats <- .pregunta_stats(row, data_df)
  expect_identical(stats$n_unicas, 10L)  # los años: no son material
  mat <- .codif_material_de_pregunta(row, data_df, stats, n_codificadas = 2L)
  expect_identical(c(mat$n_respuestas, mat$n_unicas, mat$n_codificadas), c(2L, 2L, 2L))
  expect_identical(.codif_status_de_pregunta("select_one", "padre", TRUE, mat$n_respuestas, mat$n_unicas, mat$n_codificadas),
                   "completo")
  # Con un texto sin código sigue en curso.
  parcial <- .codif_material_de_pregunta(row, data_df, stats, n_codificadas = 1L)
  expect_identical(.codif_status_de_pregunta("select_one", "padre", TRUE, parcial$n_respuestas, parcial$n_unicas, parcial$n_codificadas),
                   "en-curso")
})

test_that("una abierta o una cerrada sin texto emparejado se mide como antes", {
  data_df <- data.frame(P1 = c("a", "b", "a"), stringsAsFactors = FALSE)
  row <- list(parent = "P1", tipo = "text", text_col = "P1", use = TRUE)
  stats <- .pregunta_stats(row, data_df)
  mat <- .codif_material_de_pregunta(row, data_df, stats, n_codificadas = 1L)
  expect_identical(c(mat$n_respuestas, mat$n_unicas, mat$n_codificadas), c(3L, 2L, 1L))
})
