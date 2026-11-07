# Columnas de inicio, fin y duración: patrones anclados y valores que sean instantes
# (monitoreo_columnas_tiempo.R). Caso real: Acreditación 2026, 29/10.

datos_acreditacion <- function() {
  data.frame(
    respondent_id = c("1", "2", "3"),
    date_modified = c("2026-10-29T23:33:00+00:00", "2026-10-30T01:00:00+00:00", "2026-10-30T02:00:00+00:00"),
    total_time = c("300", "420", "15"),
    q0007__los_fines_y_prop_ositos_de_la_universidad = c("De acuerdo", "Muy de acuerdo", "En desacuerdo"),
    q0012__tiempo_que_lleva_en_la_pucp = c("1 año", "3 años", "5 años"),
    stringsAsFactors = FALSE
  )
}

test_that("una pregunta que contiene «fin» o «tiempo» no se toma por fin ni por duración", {
  cfg <- monitoreo_default_config(datos_acreditacion())
  expect_identical(cfg$end_var, "")
  expect_identical(cfg$start_var, "")
  expect_identical(cfg$duration_var, "total_time")
})

test_that("las columnas de inicio y fin reales se siguen detectando", {
  d <- datos_acreditacion()
  d$start <- c("2026-10-29T23:28:00+00:00", "2026-10-30T00:53:00+00:00", "2026-10-30T01:59:45+00:00")
  d$end <- d$date_modified
  cfg <- monitoreo_default_config(d)
  expect_identical(cfg$start_var, "start")
  expect_identical(cfg$end_var, "end")
})

test_that("una configuración guardada con una pregunta como fin se limpia al normalizar", {
  d <- datos_acreditacion()
  cfg <- monitoreo_normalize_config(list(end_var = "q0007__los_fines_y_prop_ositos_de_la_universidad"), d)
  expect_identical(cfg$end_var, "")
})

test_that("sin datos con qué comprobar se respeta la columna declarada", {
  expect_identical(.monitoreo_columna_de_tiempo("fin", NULL), "fin")
  expect_identical(.monitoreo_columna_de_tiempo("", datos_acreditacion()), "")
})
