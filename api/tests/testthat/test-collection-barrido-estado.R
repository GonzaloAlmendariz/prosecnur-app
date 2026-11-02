# Telefónica › Barrido (revamp de Material v5): la config de la campaña dice qué documento es su
# barrido y si Monitoreo ya lo conectó como fuente. Lectura pura: se prueba sobre un estado armado.

test_that("sin barrido construido, la campaña lo dice y no inventa la conexión", {
  e <- .mtel_barrido_estado(list(), "telefonica.principal")
  expect_false(e$construido)
  expect_null(e$url)
  expect_false(e$conectado_en_monitoreo)
})

test_that("con barrido construido, da el documento, la pestaña y la fecha de esta campaña", {
  s <- list(material_telefonica_sheets = list(
    spreadsheet_id = "abc123", actualizado_en = "2026-11-02T15:00:00Z",
    pestanas = list("telefonica.principal" = "Barrido", "telefonica.egresados-r2" = "Barrido egresados-r2")))
  e <- .mtel_barrido_estado(s, "telefonica.egresados-r2")
  expect_true(e$construido)
  expect_identical(e$url, "https://docs.google.com/spreadsheets/d/abc123/edit")
  expect_identical(e$pestana, "Barrido egresados-r2")
  expect_identical(e$actualizado_en, "2026-11-02T15:00:00Z")
  expect_false(e$conectado_en_monitoreo)
})

test_that("otra campaña del mismo documento sin su pestaña no cuenta como construida", {
  s <- list(material_telefonica_sheets = list(spreadsheet_id = "abc123", pestanas = list("telefonica.principal" = "Barrido")))
  expect_false(.mtel_barrido_estado(s, "telefonica.egresados-r2")$construido)
})

test_that("está conectado sólo si el mismo Sheets es una fuente de Monitoreo", {
  base <- list(material_telefonica_sheets = list(spreadsheet_id = "abc123", pestanas = list("telefonica.principal" = "Barrido")))
  otro <- c(base, list(monitoreo_sources = list(list(kind = "google_sheets", sheet_binding = list(spreadsheet_id = "zzz999")))))
  mismo <- c(base, list(monitoreo_sources = list(
    list(kind = "kobo", asset_uid = "a1"),
    list(kind = "google_sheets", sheet_binding = list(spreadsheet_id = "abc123", sheet_name = "Barrido")))))
  expect_false(.mtel_barrido_estado(otro, "telefonica.principal")$conectado_en_monitoreo)
  expect_true(.mtel_barrido_estado(mismo, "telefonica.principal")$conectado_en_monitoreo)
})

test_that("la config de la campaña lleva el estado del barrido", {
  sid <- session_create()
  collection_campaign_create(sid, "telefonica", "Barrido de prueba")
  cfg <- collection_telefonica_config_get(sid)
  expect_false(cfg$barrido$construido)
})
