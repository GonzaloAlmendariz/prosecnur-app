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
  seco <- monitoreo_aulas_retirar_cerradas_en_otras_semanas("x", ejecutar = FALSE, hoy = as.Date("2026-09-23"))
  expect_length(seco$filas, 1L)
  expect_identical(seco$filas[[1]]$codigo, "CH 7")
  expect_identical(seco$filas[[1]]$fila, 2L)
  expect_null(enviados)
  hecho <- monitoreo_aulas_retirar_cerradas_en_otras_semanas("x", ejecutar = TRUE, hoy = as.Date("2026-09-23"))
  expect_identical(hecho$retiradas, 1L)
  r <- enviados[[1]]$deleteDimension$range
  expect_identical(r$sheetId, 22)
  expect_identical(c(r$startIndex, r$endIndex), c(1L, 2L))
})

test_that("un aula con respuestas en la plataforma sale de los días siguientes, no del de hoy", {
  # «¿Y si le doy a actualizar en dos horas y ya se aplicaron sin agenda otras
  # aulas, éstas se van también?» (Gonzalo, 2026-09-23). Sí, pero la fila del
  # día se queda: es donde el coordinador anota «APLICADA SIN AGENDACIÓN».
  s1 <- .marc_hoja(list(
    .marc_fila("", "23/09", "CH 5", "POR APLICAR SIN AGENDACIÓN"),   # hoy: se queda
    .marc_fila("", "25/09", "CH 5", "POR APLICAR SIN AGENDACIÓN"))) # después: sale
  testthat::local_mocked_bindings(
    .monitoreo_sheets_metadata = function(id) list(sheets = list(
      list(properties = list(title = "Semana 1", sheetId = 11)))),
    .cads_valores_de_pestana = function(id, hoja) s1,
    .monitoreo_sheets_batch_update = function(id, requests) list()
  )
  o <- monitoreo_aulas_retirar_cerradas_en_otras_semanas("x", aplicadas = "CH 5", hoy = as.Date("2026-09-23"))
  expect_length(o$filas, 1L)
  expect_identical(o$filas[[1]]$fecha, "25/09")
})

test_that("la fila del día en que el coordinador la cerró no se toca; sí las posteriores", {
  s1 <- .marc_hoja(list(
    .marc_fila("", "22/09", "CH 7", "APLICADA SIN AGENDACIÓN"),
    .marc_fila("", "22/09", "CH 7", "POR APLICAR SIN AGENDACIÓN"),   # mismo día: se queda
    .marc_fila("", "24/09", "CH 7", "POR APLICAR SIN AGENDACIÓN")))  # después: sale
  testthat::local_mocked_bindings(
    .monitoreo_sheets_metadata = function(id) list(sheets = list(
      list(properties = list(title = "Semana 1", sheetId = 11)))),
    .cads_valores_de_pestana = function(id, hoja) s1,
    .monitoreo_sheets_batch_update = function(id, requests) list()
  )
  o <- monitoreo_aulas_retirar_cerradas_en_otras_semanas("x", hoy = as.Date("2026-09-23"))
  expect_identical(vapply(o$filas, function(x) x$fecha, ""), "24/09")
})

test_that("«Traer respuestas» corre el retiro con la distribución recordada, y sin ella no", {
  llamado <- NULL
  testthat::local_mocked_bindings(
    monitoreo_aulas_conversar_libro = function(sid, cfg) list(conversado = FALSE, motivo = "sin_destino"),
    .monitoreo_state_payload = function(sid, ...) list(),
    monitoreo_aulas_retirar_cerradas_en_otras_semanas = function(id, ejecutar = FALSE, aplicadas = character(0), ...) {
      llamado <<- list(id = id, ejecutar = ejecutar, aplicadas = aplicadas)
      list(filas = list(list(pestana = "Semana 2", codigo = "CH 7", fecha = "29/09", cerrada_en = "x")),
           retiradas = 1L)
    }
  )
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  cfg <- list(aulas_universitarias = list(
    distribucion_sheets = list(spreadsheet_id = "doc_dist"), plan = list(), partes_campo = list()))
  session_set(sid, "monitoreo_config", cfg)
  out <- monitoreo_aulas_sync_payload(sid, list(synced_at = "t"), list())
  expect_identical(llamado$id, "doc_dist")
  expect_true(llamado$ejecutar)
  expect_identical(out$distribucion_retiro$retiradas, 1L)
  # Sin distribución recordada no se llama y no viaja nada.
  llamado <- NULL
  session_set(sid, "monitoreo_config", list(aulas_universitarias = list()))
  out2 <- monitoreo_aulas_sync_payload(sid, list(synced_at = "t"), list())
  expect_null(llamado)
  expect_null(out2$distribucion_retiro)
})
