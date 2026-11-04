# Cuotas sexo × edad con la estructura CPV 2025 cuando se reparte con la base 2025 (ADR 0131 §2).

.c25_cfg <- function(base = NULL, n = 240, ...) {
  ss <- list(design_effect = 1)
  if (!is.null(base)) ss$base_reparto <- base
  c(list(territorios = c("150110", "070106", "040101"), sample_size_mode = "external_total", n_objetivo = n,
         sample_size = ss), list(...))
}

# Población 2025 por distrito, sexo y rango (con los rangos de la configuración).
.c25_estructura <- function(cfg) {
  e <- hojas_ruta_cpv2025_edad_simple()
  ncfg <- hojas_ruta_integrada_normalize_config(cfg)
  do.call(rbind, lapply(ncfg$age_ranges, function(d) {
    mx <- if (is.na(d$max)) Inf else d$max
    s <- e[e$edad >= d$min & e$edad <= mx & e$ubigeo %in% unlist(ncfg$territorios), , drop = FALSE]
    a <- stats::aggregate(s$poblacion, s[c("ubigeo", "sexo")], sum)
    names(a)[3] <- "pob25"
    a$rango_id <- d$id
    a
  }))
}

test_that("la edad simple 2025 suma exacto pob25 por distrito", {
  e <- hojas_ruta_cpv2025_edad_simple()
  for (u in c("150110", "070106", "040101")) {
    expect_identical(as.numeric(sum(e$poblacion[e$ubigeo == u])), as.numeric(hojas_ruta_territorio_cobertura(u)$pob25))
  }
})

test_that("con la base 2025 la cuota sexo × edad sigue la estructura 2025 y Σ cuotas = n", {
  cfg <- .c25_cfg("cpv2025_adultos_urbanos")
  q <- hojas_ruta_quota_preview_integrado(cfg)
  expect_true(q$ok)
  cells <- .hojas_ruta_rows_df(q$cells)
  expect_identical(as.integer(sum(cells$cuota)), 240L)
  est <- .c25_estructura(cfg)
  m <- merge(cells, est, by = c("ubigeo", "sexo", "rango_id"))
  expect_identical(nrow(m), nrow(cells))
  # La población de la celda es la estructura 2025 escalada a P̂25 del distrito.
  for (u in unique(m$ubigeo)) {
    x <- m[m$ubigeo == u, ]
    expect_equal(x$poblacion / sum(x$poblacion), x$pob25 / sum(x$pob25), tolerance = 1e-10)
  }
  # Y la cuota del distrito se reparte con esa estructura (redondeo a enteros: ± 1 por celda).
  for (u in unique(m$ubigeo)) {
    x <- m[m$ubigeo == u, ]
    esperado <- sum(x$cuota) * x$pob25 / sum(x$pob25)
    expect_true(all(abs(x$cuota - esperado) < 1 + 1e-9))
  }
  expect_identical(hojas_ruta_sample_size_preview(cfg)$base_reparto$cuotas, "CPV 2025 (población censada)")
})

test_that("con la base apagada las cuotas son las de siempre (estructura 2017)", {
  a <- hojas_ruta_quota_preview_integrado(.c25_cfg())
  b <- hojas_ruta_quota_preview_integrado(.c25_cfg("cpv2017"))
  expect_identical(a, b)
  cells <- .hojas_ruta_rows_df(a$cells)
  est <- .c25_estructura(.c25_cfg())
  m <- merge(cells, est, by = c("ubigeo", "sexo", "rango_id"))
  x <- m[m$ubigeo == "150110", ]
  expect_false(isTRUE(all.equal(x$poblacion / sum(x$poblacion), x$pob25 / sum(x$pob25), tolerance = 1e-6)))
  expect_null(hojas_ruta_sample_size_preview(.c25_cfg())$base_reparto)
})

test_that("la memoria declara las cuotas CPV 2025 con la base activa", {
  sp <- hojas_ruta_sample_size_preview(.c25_cfg("cpv2025_adultos_urbanos"))
  d <- reporte_mt_diseno_modelo(sp$config, sp)
  expect_true(any(grepl("CPV 2025 (población censada)", d$nota_tecnica, fixed = TRUE)))
  expect_false(any(grepl("población INEI 2017 del distrito", d$nota_tecnica, fixed = TRUE)))
  d0 <- reporte_mt_diseno_modelo(sp$config, hojas_ruta_sample_size_preview(.c25_cfg()))
  expect_true(any(grepl("población INEI 2017 del distrito", d0$nota_tecnica, fixed = TRUE)))
})

test_that("la fuente de edad de la cuota dice CPV 2025 con la base activa y la de siempre apagada", {
  on <- hojas_ruta_quota_preview_integrado(.c25_cfg("cpv2025_adultos_urbanos"))
  expect_match(on$age_source$label, "CPV 2025", fixed = TRUE)
  expect_identical(on$age_source$estructura, "cpv2025")
  # El tipo se conserva: decide el aviso de edad simple, que no debe pasar a «aproximación por buckets».
  expect_identical(on$age_source$type, "edad_simple_c5p41")
  codigos <- vapply(on$alerts, function(a) a$code, character(1))
  expect_false("W_AGE_BUCKET_APPROXIMATION" %in% codigos)
  off <- hojas_ruta_quota_preview_integrado(.c25_cfg())
  expect_identical(off$age_source$label, "Edad simple oficial INEI 2017")
})
