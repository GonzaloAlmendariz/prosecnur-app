# Base de reparto 2025 por distrito (ADR 0131 §2, paso 1).

.rb_cfg <- function(base = NULL, n = 240, ..., ss = list(design_effect = 1)) {
  if (!is.null(base)) ss$base_reparto <- base
  c(list(
    territorios = c("150110", "070106", "150101"),
    sample_size_mode = "external_total",
    n_objetivo = n,
    sample_size = ss
  ), list(...))
}

.rb_cuota_por_ubigeo <- function(quota) {
  cells <- .hojas_ruta_rows_df(quota$cells)
  tapply(cells$cuota, cells$ubigeo, sum)
}

.rb_preview_por_ubigeo <- function(size) {
  rows <- .hojas_ruta_rows_df(size$district_rows)
  stats::setNames(rows$n_used, rows$ubigeo)
}

test_that("base_reparto se normaliza apagada por defecto y en la lista cerrada de sample_size", {
  expect_identical(hojas_ruta_reparto_base_normalizar(NULL)$base_reparto, "cpv2017")
  expect_identical(hojas_ruta_reparto_base_normalizar(list(base_reparto = "otra"))$base_reparto, "cpv2017")
  ss <- .hojas_ruta_normalize_sample_size(list(base_reparto = "cpv2025_adultos_urbanos"))
  expect_identical(ss$base_reparto, "cpv2025_adultos_urbanos")
  expect_identical(.hojas_ruta_normalize_sample_size(list())$base_reparto, "cpv2017")
  cfg <- hojas_ruta_integrada_normalize_config(.rb_cfg("cpv2025_adultos_urbanos"))
  expect_true(hojas_ruta_reparto_base_activa(cfg$sample_size))
})

test_that("P̂25 = pob25 · u17 · a17 y g_d finito y > 0 en los 164 distritos del registro", {
  reg <- jsonlite::fromJSON(system.file("hojas_ruta", "territorios.json", package = "prosecnurapp"),
                            simplifyVector = FALSE)
  ubs <- unlist(lapply(reg$provincias, function(p) names(p$cobertura$distritos)), use.names = FALSE)
  base <- hojas_ruta_reparto_base_distritos(ubs)
  expect_identical(nrow(base), length(ubs))
  expect_true(all(is.finite(base$g) & base$g > 0))
  expect_true(all(base$u17 > 0 & base$u17 <= 1.05))
  expect_true(all(base$a17 > 0.4 & base$a17 < 0.95))
  expect_equal(base$p25, base$pob25 * base$u17 * base$a17)
  expect_equal(base$g, base$p25 / base$pob17_en_capa)
  # El insumo es el del registro, no otra cifra.
  cob <- hojas_ruta_territorio_cobertura("150101")
  fila <- base[base$ubigeo == "150101", ]
  expect_equal(fila$pob25, as.numeric(cob$pob25))
  expect_equal(fila$u17, cob$pob17_en_capa / cob$pob17_redatam)
})

test_that("falta un dato: error E_HOJAS_RUTA_BASE_2025_INCOMPLETA, nunca un factor 1", {
  err <- tryCatch(hojas_ruta_reparto_base_distritos("999999"), api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_HOJAS_RUTA_BASE_2025_INCOMPLETA")

  original <- hojas_ruta_territorio_cobertura
  testthat::local_mocked_bindings(hojas_ruta_territorio_cobertura = function(ubigeo) {
    x <- original(ubigeo)
    if (identical(x$ubigeo, "070106")) x$pob25 <- NULL
    if (identical(x$ubigeo, "150110")) x$pob17_en_capa <- 0
    x
  })
  err <- tryCatch(hojas_ruta_reparto_base_distritos(c("070106", "150110", "150101")), api_error = function(e) e)
  expect_identical(err$code, "E_HOJAS_RUTA_BASE_2025_INCOMPLETA")
  expect_match(err$message, "070106 \\(pob25\\)")
  expect_match(err$message, "150110 \\(pob17_en_capa\\)")
  expect_error(hojas_ruta_quota_preview_integrado(.rb_cfg("cpv2025_adultos_urbanos")), class = "api_error")
})

test_that("con la base 2025: Σ cuotas = n y vista previa = cuota por distrito", {
  for (n in c(240L, 600L)) {
    for (piso in c(TRUE, FALSE)) {
      cfg <- .rb_cfg("cpv2025_adultos_urbanos", n = n, ss = list(design_effect = 1, enforce_district_floor = piso))
      quota <- hojas_ruta_quota_preview_integrado(cfg)
      size <- hojas_ruta_sample_size_preview(cfg)
      expect_true(quota$ok)
      cuota <- .rb_cuota_por_ubigeo(quota)
      expect_identical(as.integer(sum(cuota)), n)
      prev <- .rb_preview_por_ubigeo(size)
      expect_identical(as.integer(prev[names(cuota)]), as.integer(cuota), info = sprintf("n=%d piso=%s", n, piso))
    }
  }
})

test_that("con la base 2025 el reparto es proporcional a P̂25 y la vista previa lo declara", {
  cfg <- .rb_cfg("cpv2025_adultos_urbanos", n = 600, ss = list(design_effect = 1, enforce_district_floor = FALSE))
  quota <- hojas_ruta_quota_preview_integrado(cfg)
  cuota <- .rb_cuota_por_ubigeo(quota)
  base <- hojas_ruta_reparto_base_distritos(names(cuota))
  route_size <- quota$route_size %||% 6L
  rutas <- as.numeric(cuota) / route_size
  esperado <- (600 / route_size) * base$p25 / sum(base$p25)
  expect_true(all(abs(rutas - esperado) < 1))

  size <- hojas_ruta_sample_size_preview(cfg)
  expect_identical(size$base_reparto$fuente, "CPV 2025 (supuestos u17, a17 de 2017)")
  expect_identical(size$base_reparto$codigo, "cpv2025_adultos_urbanos")
  expect_equal(size$total_population, as.integer(round(sum(base$p25))))
  rows <- .hojas_ruta_rows_df(size$district_rows)
  expect_equal(rows$poblacion, as.integer(round(base$p25[match(rows$ubigeo, base$ubigeo)])))
})

test_that("con la base activa las celdas sexo × edad suman P̂25 por distrito (estructura 2025, ítem 9)", {
  off <- .hojas_ruta_rows_df(hojas_ruta_quota_preview_integrado(.rb_cfg())$cells)
  on <- .hojas_ruta_rows_df(hojas_ruta_quota_preview_integrado(.rb_cfg("cpv2025_adultos_urbanos"))$cells)
  key <- function(d) paste(d$ubigeo, d$sexo, d$rango_id)
  # Mismas celdas: cambia la población de cada una, no la forma de la cuota.
  expect_setequal(key(on), key(off))
  base <- hojas_ruta_reparto_base_distritos(unique(on$ubigeo))
  suma <- tapply(on$poblacion, on$ubigeo, sum)
  expect_equal(as.numeric(suma[base$ubigeo]), base$p25, tolerance = 1e-6)
})

test_that("la medida del PPS es M · g_d con la base activa y π sigue siendo n·MOS/ΣMOS", {
  frame <- hojas_ruta_inei_frame(NULL)
  df <- frame[frame$ubigeo == "070106", , drop = FALSE]
  cfg_off <- hojas_ruta_integrada_normalize_config(.rb_cfg())
  cfg_on <- hojas_ruta_integrada_normalize_config(.rb_cfg("cpv2025_adultos_urbanos"))
  g <- hojas_ruta_reparto_base_distritos("070106")$g
  m_off <- .hojas_ruta_sorteo_medida(df, cfg_off)
  m_on <- .hojas_ruta_sorteo_medida(df, cfg_on)
  expect_equal(m_on, m_off * g)
  # Dentro del distrito g_d es constante: la π de cada manzana no cambia.
  expect_equal(.hojas_ruta_sorteo_pi(m_on, 10L), .hojas_ruta_sorteo_pi(m_off, 10L))
  pi <- .hojas_ruta_sorteo_pi(m_on, 10L)
  expect_equal(sum(pi), 10)
  # Con tope (ADR 0120) el tope se aplica sobre la medida y luego g_d: MOS' = min(M, c_d) · g_d.
  cfg_tope <- .hojas_ruta_sorteo_cfg_distrito(utils::modifyList(cfg_on, list(sampling_method = "pps_tope")), df)
  cfg_tope_off <- .hojas_ruta_sorteo_cfg_distrito(utils::modifyList(cfg_off, list(sampling_method = "pps_tope")), df)
  expect_equal(.hojas_ruta_sorteo_medida(df, cfg_tope), .hojas_ruta_sorteo_medida(df, cfg_tope_off) * g)
})

test_that("con la base 2025 la muestra se sortea entera y cuadra con la cuota", {
  cfg <- .rb_cfg("cpv2025_adultos_urbanos", n = 240)
  s <- hojas_ruta_sample_preview_integrado(cfg)
  expect_true(s$ok)
  expect_identical(as.integer(s$total_entrevistas), 240L)
})

test_that("apagada, la salida es idéntica a la de siempre (regresión)", {
  for (extra in list(list(), list(row_var = "zona"), list(sampling_method = "pps_tope"))) {
    sin_campo <- do.call(.rb_cfg, c(list(base = NULL), extra))
    apagada <- do.call(.rb_cfg, c(list(base = "cpv2017"), extra))
    expect_identical(hojas_ruta_sample_size_preview(apagada), hojas_ruta_sample_size_preview(sin_campo))
    expect_identical(hojas_ruta_quota_preview_integrado(apagada), hojas_ruta_quota_preview_integrado(sin_campo))
    expect_identical(hojas_ruta_sample_preview_integrado(apagada), hojas_ruta_sample_preview_integrado(sin_campo))
    expect_null(hojas_ruta_sample_size_preview(apagada)$base_reparto)
  }
})

test_that("la lista de territorios trae la base 2025 por distrito para la UI", {
  cols <- hojas_ruta_reparto_base_columnas(c("150110", "999999"))
  expect_identical(names(cols), c("pob25", "u17", "a17", "p25", "g"))
  expect_true(is.finite(cols$p25[[1]]) && cols$p25[[1]] > 0)
  expect_true(all(is.na(unlist(cols[2, ]))))
  agg <- data.frame(ubigeo = c("150110", "070106"), poblacion = c(1, 1))
  con <- .hojas_ruta_territorios_con_cobertura(agg)
  expect_equal(con$p25, hojas_ruta_reparto_base_distritos(agg$ubigeo)$p25)
})

test_that("la memoria de cálculo declara la base 2025 y rotula la población", {
  cfg <- .rb_cfg("cpv2025_adultos_urbanos", n = 240)
  sp <- hojas_ruta_sample_size_preview(cfg)
  d <- reporte_mt_diseno_modelo(sp$config, sp)
  expect_true("Adultos urbanos 2025 (est.)" %in% names(d$por_distrito))
  expect_true(any(grepl("CPV 2025 (supuestos u17, a17 de 2017)", d$nota_tecnica, fixed = TRUE)))
  d0 <- reporte_mt_diseno_modelo(sp$config, hojas_ruta_sample_size_preview(.rb_cfg()))
  expect_true("Población 2017" %in% names(d0$por_distrito))
  expect_false(any(grepl("CPV 2025", d0$nota_tecnica, fixed = TRUE)))
})
