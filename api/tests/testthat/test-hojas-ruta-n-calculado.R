# Con la lógica «Calculado», cuotas y sorteo usan el N del cálculo, no el `n_objetivo` guardado (10 nov 2026:
# el diseño nacional TCD decía 2,412 y sorteó 20 UMP con el 120 que traía la config).

test_that("con lógica Calculado el N es el del cálculo del tamaño, no el n_objetivo guardado", {
  cfg <- hojas_ruta_integrada_normalize_config(list(
    territorios = list("150103", "150132", "150142", "150101"),
    sample_size_mode = "calculator",
    n_objetivo = 120L,
    entrevistas_por_manzana = 6L
  ))
  skip_if(!nrow(hojas_ruta_inei_frame(cfg$frame_source)), "Sin marco empaquetado")
  esperado <- as.integer(hojas_ruta_sample_size_preview(cfg)$n_used)
  out <- hojas_ruta_n_calculado(cfg)
  expect_equal(out$n_objetivo, esperado)
  expect_false(identical(out$n_objetivo, 120L))
  # Las cuotas reparten ese N, no el guardado.
  cuotas <- hojas_ruta_quota_preview_integrado(out)
  expect_equal(as.integer(cuotas$n_objetivo), esperado)
})


test_that("con N total o por distrito el N lo escribe el usuario y no se toca", {
  cfg <- hojas_ruta_integrada_normalize_config(list(
    territorios = list("150103", "150132"),
    sample_size_mode = "external_total",
    n_objetivo = 120L,
    entrevistas_por_manzana = 6L
  ))
  expect_equal(hojas_ruta_n_calculado(cfg)$n_objetivo, 120L)
})

test_that("sin territorios no hay cálculo y la config queda igual", {
  cfg <- hojas_ruta_integrada_normalize_config(list(sample_size_mode = "calculator", n_objetivo = 120L))
  expect_equal(hojas_ruta_n_calculado(cfg)$n_objetivo, 120L)
})

test_that("con estrato por distrito, las cuotas reparten por distrito lo mismo que el cálculo (con sus mínimos)", {
  # Antes: el tamaño daba 102 por distrito (manda la suma de mínimos) y las cuotas repartían 102, 54, 186 y 66
  # por población. El sorteo tiene que ser la muestra que se diseñó.
  cfg <- hojas_ruta_integrada_normalize_config(list(
    territorios = list("150132", "150142", "150103", "150101"),
    sample_size_mode = "calculator",
    n_objetivo = 120L,
    entrevistas_por_manzana = 6L
  ))
  skip_if(!nrow(hojas_ruta_inei_frame(cfg$frame_source)), "Sin marco empaquetado")
  expect_false(hojas_ruta_estrato_vigente(cfg))
  filas <- hojas_ruta_sample_size_preview(cfg)$district_rows
  esperado <- if (is.data.frame(filas)) setNames(as.integer(filas$n_used), filas$ubigeo) else
    setNames(vapply(filas, function(f) as.integer(f$n_used), integer(1)), vapply(filas, function(f) f$ubigeo, ""))
  cuotas <- hojas_ruta_quota_preview_integrado(cfg)
  celdas <- if (is.data.frame(cuotas$cells)) cuotas$cells else do.call(rbind, lapply(cuotas$cells, as.data.frame))
  por_distrito <- tapply(celdas$cuota, as.character(celdas$ubigeo), sum)
  expect_equal(as.integer(por_distrito[names(esperado)]), unname(esperado))
  expect_equal(as.integer(cuotas$total_asignado), sum(esperado))
})

test_that("con estrato provincia el reparto lo sigue dando la cuota del estrato (ADR 0131), no se fuerza por distrito", {
  cfg <- hojas_ruta_integrada_normalize_config(list(
    territorios = list("150132", "150142", "150103", "150101"),
    sample_size_mode = "calculator",
    n_objetivo = 120L,
    entrevistas_por_manzana = 6L,
    sample_size = list(estrato = "provincia")
  ))
  skip_if(!hojas_ruta_estrato_vigente(cfg), "Estrato provincia no vigente con esta config")
  out <- hojas_ruta_reparto_calculado(cfg)
  expect_false(identical(out$n_mode, "por_distrito"))
})

# Revisión metodológica del 10 nov 2026: el N escrito no se pisa, y cuotas, sorteo (con su π) y envío usan el mismo.
.cfg_lima <- function(...) c(list(territorios = list("150132", "150142", "150103", "150101"), entrevistas_por_manzana = 6L), list(...))

test_that("un N escrito no se reescribe: N total o por distrito, con o sin lógica declarada", {
  skip_if(!nrow(hojas_ruta_inei_frame("current")), "Sin marco empaquetado")
  total_de <- function(cfg) as.integer(hojas_ruta_quota_preview_integrado(cfg)$n_objetivo)
  expect_equal(total_de(.cfg_lima(n_objetivo = 120L)), 120L)                                   # sin modo: N escrito
  expect_equal(total_de(.cfg_lima(n_objetivo = 120L, sample_size_mode = "external_total")), 120L)
  por_distrito <- list("150132" = 30L, "150142" = 30L, "150103" = 30L, "150101" = 30L)
  for (cfg in list(.cfg_lima(n_mode = "por_distrito", n_por_distrito = por_distrito),
                   .cfg_lima(sample_size_mode = "external_district", n_por_distrito = por_distrito))) {
    cuotas <- hojas_ruta_quota_preview_integrado(cfg)
    celdas <- if (is.data.frame(cuotas$cells)) cuotas$cells else do.call(rbind, lapply(cuotas$cells, as.data.frame))
    expect_true(all(tapply(celdas$cuota, as.character(celdas$ubigeo), sum) == 30L))
  }
  # Un N sin modo que no es múltiplo de la ruta sigue avisando.
  expect_false(isTRUE(hojas_ruta_quota_preview_integrado(.cfg_lima(n_objetivo = 61L))$route_multiple_ok))
})

test_that("con «Calculado», el sorteo usa el mismo N en sus cuotas y en su config (la π del estrato lo lee)", {
  cfg <- .cfg_lima(sample_size_mode = "calculator", n_objetivo = 120L)
  skip_if(!nrow(hojas_ruta_inei_frame("current")), "Sin marco empaquetado")
  n_calc <- as.integer(hojas_ruta_sample_size_preview(hojas_ruta_integrada_normalize_config(cfg))$n_used)
  muestra <- hojas_ruta_sample_preview_integrado(cfg)
  expect_equal(as.integer(muestra$config$n_objetivo), n_calc)
  expect_equal(as.integer(muestra$quota$n_objetivo %||% muestra$quota$total_asignado), n_calc)
})

test_that("el envío por cuotas a Material reparte por distrito lo mismo que las cuotas", {
  cfg <- .cfg_lima(sample_size_mode = "calculator", n_objetivo = 120L)
  skip_if(!nrow(hojas_ruta_inei_frame("current")), "Sin marco empaquetado")
  cuotas <- hojas_ruta_quota_preview_integrado(cfg)
  celdas <- if (is.data.frame(cuotas$cells)) cuotas$cells else do.call(rbind, lapply(cuotas$cells, as.data.frame))
  esperado <- tapply(celdas$cuota, as.character(celdas$ubigeo), sum)
  zonas <- .hojas_ruta_zonas_vigentes(cfg)
  enviado <- setNames(vapply(zonas, function(z) as.integer(z$n), integer(1)), vapply(zonas, function(z) z$ubigeo, ""))
  expect_equal(as.integer(enviado[names(esperado)]), as.integer(esperado))
})
