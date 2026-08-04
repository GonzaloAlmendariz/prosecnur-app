# B36/G-12: un plan con laminas a medio armar (grafico vacio) no puede matar
# el export completo. jsonlite rectangulariza los slides al parsear el body
# del job: la lamina sin grafico llega como graficador = NA, y nzchar(NA) es
# TRUE, asi que el guard "sin graficador" no la atrapaba y el deck entero
# moria con "Graficador no registrado: NA".

test_that("graficador NA (lamina borrador rectangularizada) rebuilds a NULL", {
  expect_null(.rebuild_graf(list(graficador = NA)))
  expect_null(.rebuild_graf(list(graficador = NA_character_, args = list())))
  expect_null(.graficos_rebuild_graf_json(list(graficador = NA)))
})

test_that("graficador vacio o ausente sigue rebuildeando a NULL", {
  expect_null(.rebuild_graf(NULL))
  expect_null(.rebuild_graf(list()))
  expect_null(.rebuild_graf(list(graficador = "")))
  expect_null(.rebuild_graf(list(graficador = "   ")))
  expect_null(.graficos_rebuild_graf_json(list()))
})

test_that("la fila rectangularizada por jsonlite (graficador NA) rebuilds a NULL", {
  # Cuando el plan trae varias laminas y jsonlite las rectangulariza a
  # data.frame, la lamina borrador queda como fila con graficador = NA.
  grafico_df <- data.frame(graficador = c("p_barras_apiladas", NA_character_))
  fila_borrador <- as.list(grafico_df[2, , drop = FALSE])
  expect_true(is.na(fila_borrador$graficador[[1]]))
  expect_null(.rebuild_graf(fila_borrador))
  expect_null(.graficos_rebuild_graf_json(fila_borrador))
})

test_that("un graficador desconocido REAL conserva su error legible", {
  expect_error(
    .rebuild_graf(list(graficador = "p_no_existe")),
    "Graficador no registrado"
  )
})

test_that("una lamina borrador completa (p_slide_1_grafico sin grafico) se arma con canvas en blanco", {
  slide <- list(
    tipo = "p_slide_1_grafico",
    payload = list(titulo = "Borrador pendiente", grafico = list())
  )
  out <- .graficos_rebuild_slide_json(slide)
  expect_false(is.null(out))
})

test_that("el relleno de slots respeta los formals opcionales", {
  fn_fake <- function(grafico, extra = NULL) list(grafico = grafico, extra = extra)
  payload <- list(titulo = "x")
  filled <- .graficos_fill_blank_graf_slots(payload, fn_fake, c("grafico", "extra"))
  expect_false(is.null(filled$grafico))
  expect_null(filled$extra)
})
