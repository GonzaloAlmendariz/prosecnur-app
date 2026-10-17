# Un texto que no encaja en ningún grupo puede quedar en «Otro» por decisión.

.teo_row <- list(parent = "P8", tipo = "select_one", modo_so = "padre", text_col = "P8_otro",
                 parent_col = "P8", use = TRUE)
.teo_data <- function(otros) {
  n <- length(otros)
  data.frame(P8 = rep("88", n), P8_otro = otros, stringsAsFactors = FALSE)
}
.teo_grupos <- list(P8 = list(list(label = "Antes de 2016", respuestas = list("antes de 2015"))))

test_that("los textos dejados en Otro no se avisan y uno nuevo sí", {
  data_df <- .teo_data(c("antes de 2015", "no recuerdo", "intercambio"))
  sin <- .codif_textos_sin_codigo("P8", .teo_grupos, list(.teo_row), data_df)
  expect_identical(sin[[1]]$textos, 2L)
  en_otro <- list(P8 = list(.normalize_text("no recuerdo"), .normalize_text("intercambio")))
  expect_length(.codif_textos_sin_codigo("P8", .teo_grupos, list(.teo_row), data_df, en_otro = en_otro), 0L)
  # Otra versión de las respuestas trae un texto que nadie revisó.
  data2 <- .teo_data(c("antes de 2015", "no recuerdo", "intercambio", "trasladado"))
  otra <- .codif_textos_sin_codigo("P8", .teo_grupos, list(.teo_row), data2, en_otro = en_otro)
  expect_identical(otra[[1]]$textos, 1L)
  expect_identical(unlist(otra[[1]]$ejemplos), "trasladado")
})

test_that("dejados en Otro cuentan como decididos: la pregunta queda completa", {
  data_df <- .teo_data(c("antes de 2015", "no recuerdo"))
  stats <- .pregunta_stats(.teo_row, data_df)
  sin_decidir <- .codif_material_de_pregunta(.teo_row, data_df, stats, n_codificadas = 1L)
  expect_identical(.codif_status_de_pregunta("select_one", "padre", TRUE, sin_decidir$n_respuestas,
                                             sin_decidir$n_unicas, sin_decidir$n_codificadas), "en-curso")
  decidido <- .codif_material_de_pregunta(.teo_row, data_df, stats, n_codificadas = 1L,
                                          en_otro = list(.normalize_text("no recuerdo")))
  expect_identical(.codif_status_de_pregunta("select_one", "padre", TRUE, decidido$n_respuestas,
                                             decidido$n_unicas, decidido$n_codificadas), "completo")
})

test_that("registrar y revertir guarda en el estado de la base", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  codif_set(sid, "familias_draft", list(rows = list(.teo_row)))
  codif_set(sid, "grupos_recod", .teo_grupos)
  testthat::local_mocked_bindings(codif_data_cached = function(sid) .teo_data(c("antes de 2015", "no recuerdo")))
  expect_identical(codif_textos_en_otro_set(sid, "P8"), 1L)
  expect_identical(unlist(codif_get(sid, "textos_en_otro")$P8), .normalize_text("no recuerdo"))
  codif_textos_en_otro_set(sid, "P8", revertir = TRUE)
  expect_null(codif_get(sid, "textos_en_otro")$P8)
  expect_error(codif_textos_en_otro_set(sid, ""), class = "api_error")
})
