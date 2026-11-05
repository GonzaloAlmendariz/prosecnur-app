# Distritos de inclusión forzosa y distritos sorteados dentro de cada ciudad o área de Lima
# (ADR 0131 §1c). Reusa el registro y la configuración del test de ciudades (§1b).

.ds_registro <- function() {
  jsonlite::fromJSON(.hojas_ruta_inst_path("hojas_ruta", "territorios.json"), simplifyVector = FALSE)
}

.ds_ubigeos <- function() unlist(lapply(.ds_registro()$provincias, function(p) unlist(p$distritos)))

.ds_cfg <- function(estrato = "provincia_lima_areas", rutas = 225L, minimo = NULL, seed = NULL, base = "cpv2025_adultos_urbanos") {
  ss <- list(design_effect = 1, estrato = estrato, base_reparto = base)
  if (!is.null(minimo)) ss$rutas_minimas_distrito <- minimo
  cfg <- list(territorios = .ds_ubigeos(), sample_size_mode = "external_total", n_objetivo = rutas * 8L, entrevistas_por_manzana = 8L, sample_size = ss)
  if (!is.null(seed)) cfg$seed <- seed
  hojas_ruta_integrada_normalize_config(cfg)
}

test_that("rutas_minimas_distrito es 3 por defecto, 0 lo apaga y sólo rige con estrato provincia y base 2025", {
  expect_identical(hojas_ruta_distritos_normalizar(NULL)$rutas_minimas_distrito, 3L)
  expect_identical(hojas_ruta_distritos_normalizar(list(rutas_minimas_distrito = -2))$rutas_minimas_distrito, 3L)
  expect_identical(hojas_ruta_distritos_normalizar(list(rutas_minimas_distrito = 0))$rutas_minimas_distrito, 0L)
  expect_identical(.ds_cfg(minimo = 4L)$sample_size$rutas_minimas_distrito, 4L)
  expect_identical(.ds_cfg()$sample_size$rutas_minimas_distrito, 3L)
  expect_true(hojas_ruta_distritos_activo(.ds_cfg()$sample_size))
  expect_false(hojas_ruta_distritos_activo(.ds_cfg(minimo = 0L)$sample_size))
  expect_false(hojas_ruta_distritos_activo(.ds_cfg(base = "cpv2017")$sample_size))
  expect_false(hojas_ruta_distritos_activo(.ds_cfg(estrato = "distrito")$sample_size))
})
