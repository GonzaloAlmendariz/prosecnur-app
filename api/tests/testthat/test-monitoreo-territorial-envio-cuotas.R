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
