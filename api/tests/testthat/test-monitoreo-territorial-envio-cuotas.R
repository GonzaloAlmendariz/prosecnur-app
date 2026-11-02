# Un envío de Hojas de ruta por cuotas (kind = "cuotas", e84b0165d) no trae
# `sample`: trae `zonas`. Con `envio$sample`, el `$` de R casaba por prefijo
# `sample_fingerprint` (texto) y el siguiente `$` reventaba con «$ operator is
# invalid for atomic vectors»: 500 en /monitoreo/state y en muestra-enviada (D14).

envio_cuotas_fx <- function() {
  list(kind = "cuotas", sample_fingerprint = paste0("sha256:", strrep("a", 64)), enviado_at = "2026-11-02T10:00:00Z",
       config = list(seed = 7L), n_zonas = 1L, n_entrevistas = 4L,
       zonas = list(list(id_zona = "150101", ubigeo = "150101", nombre = "Lima", n = 4L,
                         cuotas = list(list(sexo = "Mujer", rango_id = "r1", rango_edad = "18 a 29", n = 4L)))))
}

test_that("muestra-enviada con un envío por cuotas no revienta y dice que no compara UMP", {
  out <- monitoreo_territorial_muestra_enviada_desde(envio_cuotas_fx(), list(blocks = list()), phase = "field")
  expect_identical(out$estado, "cuotas")
  expect_identical(out$ump_enviadas, 0L)
  expect_true(nzchar(out$texto))
})

test_that("la fuente de la muestra con un envío por cuotas no toma la huella por muestra", {
  f <- .monitoreo_territorial_fuente_muestra(list(config = list()), envio_cuotas_fx())
  expect_identical(f$source, "envio")
  expect_identical(f$kind, "cuotas")
  expect_identical(f$sample, list())
  expect_null(f$quota)
  expect_identical(length(f$zonas), 1L)
})

test_that("con un envío por cuotas el reporte territorial publica el avance por zona y celda", {
  n <- 4L
  end_time <- as.POSIXct("2026-06-13 15:00:00", tz = "UTC") + seq_len(n) * 60
  data <- data.frame(
    `Core/M5_district` = rep("sjm", n), `_geolocation` = rep("-12.1 -77.0", n), consent = rep("1", n),
    `Core/E1_age` = c(20, 25, 70, 30), `Core/E2_sex` = c("1", "1", "2", "2"),
    `_status` = rep("submitted_via_web", n), `_uuid` = sprintf("c-%02d", seq_len(n)), `_submitted_by` = rep("enc1", n),
    start = format(end_time - 600, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"), end = format(end_time, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  cfg <- monitoreo_normalize_config(list(monitoreo_profile = list(family = "territorial", status = "active")), data)
  context <- list(
    phase = "pilot", blocks = list(), envio_kind = "cuotas",
    zonas = list(list(id_zona = "150133", ubigeo = "150133", nombre = "SJM", n = 4L, cuotas = list(
      list(sexo = "Hombre", rango_id = "r1", rango_edad = "18-29", n = 2L),
      list(sexo = "Mujer", rango_id = "r4", rango_edad = "60+", n = 2L)))),
    asignacion_zonas = list(list(id_manzana = "150133", codigo = "P101", parte = 4L))
  )
  report <- monitoreo_territorial_reportes(data, cfg, context, report_scope = "advance_summary")
  cu <- report$cuotas
  expect_identical(cu$kind, "cuotas")
  expect_length(cu$zonas, 1L)
  expect_identical(cu$total$meta, 4L)
  # Sin manzana enviada, el ubigeo del caso decide la zona.
  expect_identical(cu$zonas[[1]]$celdas[[1]]$efectivas + cu$zonas[[1]]$celdas[[2]]$efectivas + cu$sin_celda + cu$sin_zona,
                   report$kpis$validas)
  expect_length(cu$zonas[[1]]$personas, 1L)
  # Con envío por UMP no se publica.
  expect_null(monitoreo_territorial_reportes(data, cfg, list(phase = "pilot", blocks = list()), report_scope = "advance_summary")$cuotas)
})
