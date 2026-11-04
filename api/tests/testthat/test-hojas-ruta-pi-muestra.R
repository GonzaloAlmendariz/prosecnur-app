# π de titulares y reemplazos en la muestra exportada (ADR 0131 §5, paso 3).

.pim_cfg <- function(estrato = NULL, n = 240, ...) {
  ss <- list(design_effect = 1)
  if (!is.null(estrato)) ss$estrato <- estrato
  c(list(territorios = c("150110", "070106", "040101"), sample_size_mode = "external_total", n_objetivo = n,
         sample_size = ss), list(...))
}

.pim_rows <- function(x) .hojas_ruta_rows_df(x)

test_that("las titulares publican estrato, π y regla; la π es la del sorteo por distrito", {
  s <- hojas_ruta_sample_preview_integrado(.pim_cfg())
  expect_true(s$ok)
  b <- .pim_rows(s$blocks)
  expect_true(all(c("estrato", "pi", "pi_regla") %in% names(b)))
  expect_true(all(is.finite(b$pi) & b$pi > 0 & b$pi <= 1))
  expect_identical(unique(b$pi_regla), "pps_sistematico_distrito")
  expect_identical(as.character(b$estrato), as.character(b$ubigeo))
  # Misma fórmula del sorteo sobre el marco del distrito.
  cfg <- s$config
  frame <- hojas_ruta_inei_frame(cfg$frame_source)
  for (u in unique(b$ubigeo)) {
    df <- frame[frame$ubigeo == u, , drop = FALSE]
    m <- .hojas_ruta_sorteo_medida(df, .hojas_ruta_sorteo_cfg_distrito(cfg, df))
    pi <- .hojas_ruta_sorteo_pi(m, sum(b$ubigeo == u))
    esperado <- pi[match(b$id_manzana[b$ubigeo == u], df$id_manzana)]
    expect_equal(b$pi[b$ubigeo == u], esperado, info = u)
  }
})

test_that("el reemplazo pareado de la misma zona hereda π y estrato de su titular", {
  s <- hojas_ruta_sample_preview_integrado(.pim_cfg(replacement_policy = "paired_by_titular_zone"))
  b <- .pim_rows(s$blocks)
  r <- .pim_rows(s$replacement_blocks)
  expect_gt(nrow(r), 0L)
  expect_true(all(c("estrato", "pi", "pi_fuente") %in% names(r)))
  tit <- match(r$titular_id_manzana, b$id_manzana)
  misma <- r$zona == b$zona[tit]
  expect_true(all(r$pi_fuente[misma] == "hereda_titular"))
  expect_equal(r$pi[misma], b$pi[tit][misma])
  expect_identical(as.character(r$estrato), as.character(b$estrato[tit]))
  expect_true(all(misma))
  expect_false(any(vapply(s$alerts, function(a) identical(a$code, "W_REPLACEMENT_PI_OTRA_ZONA"), logical(1))))
})

test_that("con la política por defecto (otra zona) el reemplazo no hereda π y la muestra lo avisa", {
  s <- hojas_ruta_sample_preview_integrado(.pim_cfg())
  r <- .pim_rows(s$replacement_blocks)
  expect_true(all(is.na(r$pi)))
  expect_true(all(r$pi_fuente == "otra_zona_sin_pi"))
  expect_true(any(vapply(s$alerts, function(a) identical(a$code, "W_REPLACEMENT_PI_OTRA_ZONA"), logical(1))))
})

test_that("con estrato provincia la π publicada suma por estrato lo esperado y el reemplazo la hereda", {
  s <- hojas_ruta_sample_preview_integrado(.pim_cfg("provincia"))
  expect_true(s$ok)
  b <- .pim_rows(s$blocks)
  expect_identical(unique(b$pi_regla), "pps_sistematico_estrato")
  expect_setequal(unique(b$estrato), c("1501", "0701", "0401"))
  expect_true(all(is.finite(b$pi) & b$pi > 0 & b$pi <= 1))
  a <- hojas_ruta_estrato_asignacion(s$config$territorios, 40L, s$config)
  # La π de una titular es la mezcla de su distrito.
  frame <- hojas_ruta_inei_frame(s$config$frame_source)
  u <- b$ubigeo[[1]]
  df <- frame[frame$ubigeo == u, , drop = FALSE]
  m <- .hojas_ruta_sorteo_medida(df, .hojas_ruta_sorteo_cfg_distrito(s$config, df))
  pi <- hojas_ruta_estrato_pi(m, a$distritos$esperado[a$distritos$ubigeo == u])
  expect_equal(b$pi[b$ubigeo == u], pi[match(b$id_manzana[b$ubigeo == u], df$id_manzana)])
  r <- .pim_rows(s$replacement_blocks)
  tit <- match(r$titular_id_manzana, b$id_manzana)
  expect_identical(as.character(r$estrato), as.character(b$estrato[tit]))
})

test_that("un reemplazo en otra zona queda sin π y avisa", {
  b <- data.frame(ubigeo = "070106", zona = "01", id_manzana = "X1", stringsAsFactors = FALSE)
  r <- data.frame(ubigeo = "070106", zona = "02", id_manzana = "X2", titular_id_manzana = "X1", stringsAsFactors = FALSE)
  frame <- data.frame(ubigeo = "070106", zona = c("01", "02"), manzana = c("1", "2"), id_manzana = c("X1", "X2"),
                      viviendas = c(10, 20), stringsAsFactors = FALSE)
  out <- hojas_ruta_pi_muestra(b, r, frame, list(sampling_method = "pps", measure_var = "viviendas",
                                                 sample_size = list(), territorios = "070106", entrevistas_por_manzana = 8))
  expect_equal(out$blocks$pi, 10 / 30)
  expect_true(is.na(out$replacements$pi))
  expect_identical(out$replacements$pi_fuente, "otra_zona_sin_pi")
  expect_identical(out$alerts[[1]]$code, "W_REPLACEMENT_PI_OTRA_ZONA")
})

test_that("un reemplazo sin zona no hereda π y no rompe con NA", {
  b <- data.frame(ubigeo = "070106", zona = "01", id_manzana = "X1", stringsAsFactors = FALSE)
  r <- data.frame(ubigeo = "070106", zona = NA_character_, id_manzana = "X2", titular_id_manzana = "X1", stringsAsFactors = FALSE)
  frame <- data.frame(ubigeo = "070106", zona = c("01", "02"), manzana = c("1", "2"), id_manzana = c("X1", "X2"),
                      viviendas = c(10, 20), stringsAsFactors = FALSE)
  out <- hojas_ruta_pi_muestra(b, r, frame, list(sampling_method = "pps", measure_var = "viviendas",
                                                 sample_size = list(), territorios = "070106", entrevistas_por_manzana = 8))
  expect_true(is.na(out$replacements$pi))
  expect_identical(out$replacements$pi_fuente, "otra_zona_sin_pi")
})
