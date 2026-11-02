# Monitoreo lee los resultados de la supervisión de la base que arma Material
# (ADR 0125 A3): pestaña «Supervisión <lote_id>», tres columnas fijas por «Código».

rondas_fx <- function() {
  .monitoreo_supervision_rondas_normalizar(list(rondas = list(
    list(numero = 1L, generada_el = "2026-11-01", casos = data.frame(CodPulso = "P1", Enumerador = "Ana", check.names = FALSE)),
    list(numero = 2L, generada_el = "2026-11-02", casos = data.frame(CodPulso = "P2", Enumerador = "Beto", check.names = FALSE))
  )))
}

test_that("las rondas con documento en Material se leen de su pestaña; las demás quedan pendientes", {
  docs <- list(`ronda-1` = list(lote_id = "ronda-1", spreadsheet_id = "SUP1", pestana = "Supervisión ronda-1"))
  pedidas <- character(0)
  valores_de <- function(id, pestana) {
    pedidas <<- c(pedidas, paste(id, pestana))
    list(
      list("Código", "Enumerador", "Nombre", "Observaciones del supervisor", "Estatus de la llamada de supervisión", "Veredicto"),
      list("P1", "Ana", "#REF!", "Todo bien", "Contestó", "Confirmada")
    )
  }
  out <- monitoreo_supervision_leer_material(rondas_fx(), docs, valores_de, ahora = "2026-11-02T09:00:00Z")
  expect_identical(pedidas, "SUP1 Supervisión ronda-1")
  expect_identical(out$leidas, 1L)
  expect_identical(out$pendientes, 2L)
  r1 <- out$rondas[[1]]$resultados
  expect_identical(r1$estado, "leida")
  expect_identical(r1$fuente, "material")
  # Sólo la llave y las tres fijas: nombre (y su #REF!) no se guardan.
  expect_setequal(names(r1$filas), c("Código", "Observaciones del supervisor", "Estatus de la llamada de supervisión", "Veredicto"))
  expect_identical(r1$filas$Veredicto, "Confirmada")
})

test_that("a una pestaña sin las columnas fijas se la lee igual y se avisa", {
  docs <- list(`ronda-1` = list(lote_id = "ronda-1", spreadsheet_id = "SUP1", pestana = "Supervisión ronda-1"))
  valores_de <- function(id, pestana) list(list("Código", "Veredicto"), list("P1", "No contactado"))
  out <- monitoreo_supervision_leer_material(rondas_fx(), docs, valores_de)
  expect_match(out$avisos, "Observaciones del supervisor")
  expect_identical(out$rondas[[1]]$resultados$filas$Veredicto, "No contactado")
})

test_that("si la pestaña de Material no se puede leer, la ronda queda marcada y se avisa", {
  docs <- list(`ronda-2` = list(lote_id = "ronda-2", spreadsheet_id = "SUP2", pestana = "Supervisión ronda-2"))
  out <- monitoreo_supervision_leer_material(rondas_fx(), docs, function(id, p) stop("sin acceso"))
  expect_identical(out$rondas[[2]]$resultados$estado, "pestana_borrada")
  expect_length(out$avisos, 1L)
  expect_identical(out$pendientes, 1L)
})

test_that("si la llave del barrido no se llama «Código», la primera columna es la llave", {
  docs <- list(`ronda-1` = list(lote_id = "ronda-1", spreadsheet_id = "SUP1", pestana = "Supervisión ronda-1"))
  valores_de <- function(id, pestana) list(
    list("proGres", "Enumerador", "Observaciones del supervisor", "Estatus de la llamada de supervisión", "Veredicto"),
    list("00123", "Ana", "", "Contestó", "Confirmada")
  )
  out <- monitoreo_supervision_leer_material(rondas_fx(), docs, valores_de)
  f <- out$rondas[[1]]$resultados$filas
  expect_identical(f$Código, "00123")
  expect_length(out$avisos, 0L)
})
