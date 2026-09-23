# =============================================================================
# Retirar de las semanas siguientes las clases cerradas en otra
# =============================================================================
#
# CCSS, 2026-09-23: 28 filas «POR APLICAR SIN AGENDACIÓN» en las semanas 2 y 3
# de aulas que el coordinador ya había cerrado en «Semana 1».

.marc_hoja <- function(filas) c(list(as.list(.alpa_CABECERA)), filas)
.marc_fila <- function(aplicador, fecha, codigo, estado) {
  v <- as.list(rep("", length(.alpa_CABECERA))); names(v) <- .alpa_CABECERA
  v[["APLICADOR"]] <- aplicador; v[["FECHA"]] <- fecha
  v[["CURSO-HORARIO"]] <- codigo; v[["ESTADO"]] <- estado
  unname(v)
}

test_that("sólo se retiran filas de la app, de aulas cerradas en otra pestaña", {
  s1 <- .marc_hoja(list(.marc_fila("Uribe, Jesús", "22/09", "CH 7", "APLICADA SIN AGENDACIÓN")))
  s2 <- .marc_hoja(list(
    .marc_fila("", "29/09", "CH 7", "POR APLICAR SIN AGENDACIÓN"),       # se retira
    .marc_fila("Chávez, Alondra", "30/09", "CH 7", "POR APLICAR SIN AGENDACIÓN"),  # la tocó: se queda
    .marc_fila("", "30/09", "CH 9", "POR APLICAR SIN AGENDACIÓN")))      # no cerrada: se queda
  pestanas <- list(`Semana 1` = s1, `Semana 2` = s2)
  enviados <- NULL
  testthat::local_mocked_bindings(
    .monitoreo_sheets_metadata = function(id) list(sheets = list(
      list(properties = list(title = "Semana 1", sheetId = 11)),
      list(properties = list(title = "Semana 2", sheetId = 22)))),
    .cads_valores_de_pestana = function(id, hoja) pestanas[[hoja]],
    .monitoreo_sheets_batch_update = function(id, requests) { enviados <<- requests; list() }
  )
  seco <- monitoreo_aulas_retirar_cerradas_en_otras_semanas("x", ejecutar = FALSE)
  expect_length(seco$filas, 1L)
  expect_identical(seco$filas[[1]]$codigo, "CH 7")
  expect_identical(seco$filas[[1]]$fila, 2L)
  expect_null(enviados)
  hecho <- monitoreo_aulas_retirar_cerradas_en_otras_semanas("x", ejecutar = TRUE)
  expect_identical(hecho$retiradas, 1L)
  r <- enviados[[1]]$deleteDimension$range
  expect_identical(r$sheetId, 22)
  expect_identical(c(r$startIndex, r$endIndex), c(1L, 2L))
})
