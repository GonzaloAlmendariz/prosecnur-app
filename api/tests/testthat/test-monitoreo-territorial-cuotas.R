# Territorial por cuotas (ADR 0125, anexo A1): el avance es por zona y celda,
# sobre la foto de envío de Hojas de ruta con kind = "cuotas".

envio_cuotas <- function() {
  list(kind = "cuotas", sample_fingerprint = "sha256:x", n_zonas = 2L, n_entrevistas = 6L, zonas = list(
    list(id_zona = "150101", ubigeo = "150101", nombre = "Lima", n = 4L, cuotas = list(
      list(sexo = "Hombre", rango_id = "r1", rango_edad = "18 a 29", n = 2L),
      list(sexo = "Mujer", rango_id = "r2", rango_edad = "60 o más", n = 2L)
    )),
    list(id_zona = "150132", ubigeo = "150132", nombre = "SJL", n = 2L, cuotas = list(
      list(sexo = "Mujer", rango_id = "r1", rango_edad = "18 a 29", n = 2L)
    ))
  ))
}

audit_cuotas <- function() {
  data.frame(
    ubigeo = c("150101", "150101", "150101", "150101", "150132", "150140", "150101"),
    sex    = c("hombre", "hombre", "mujer",  "mujer",  "Mujer",  "mujer",  "hombre"),
    age    = c(20,       25,       70,       45,       19,       30,       NA),
    advance_valid = c(TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    observation_status = c("sin_observacion", "en_observacion", "sin_observacion", "sin_observacion",
                           "no_valida", "sin_observacion", "sin_observacion"),
    stringsAsFactors = FALSE
  )
}

test_that("cuenta efectivas por zona y por celda, las en observación incluidas", {
  out <- monitoreo_territorial_avance_cuotas(envio_cuotas(), audit_cuotas())
  expect_identical(out$kind, "cuotas")
  lima <- out$zonas[[1]]
  expect_identical(lima$efectivas, 5L)
  expect_identical(lima$celdas[[1]]$efectivas, 2L)      # hombres 18 a 29
  expect_identical(lima$celdas[[1]]$en_observacion, 1L)
  expect_identical(lima$celdas[[1]]$falta, 0L)
  expect_identical(lima$celdas[[2]]$efectivas, 1L)      # mujer de 70 en «60 o más»
  expect_identical(lima$celdas[[2]]$falta, 1L)
  expect_identical(lima$celdas_completas, 1L)
  # La de SJL no es efectiva: no cuenta.
  expect_identical(out$zonas[[2]]$celdas[[1]]$efectivas, 0L)
  expect_identical(out$total$meta, 6L)
  expect_identical(out$total$celdas, 3L)
})

test_that("lo que no cae en una zona o en una celda se declara aparte", {
  out <- monitoreo_territorial_avance_cuotas(envio_cuotas(), audit_cuotas())
  expect_identical(out$sin_zona, 1L)   # 150140 no está en el envío
  # En Lima: la mujer de 45 (fuera de rangos) y el hombre sin edad.
  expect_identical(out$sin_celda, 2L)
})

test_that("un envío por UMP no es de cuotas", {
  expect_null(monitoreo_territorial_avance_cuotas(list(kind = "ump"), audit_cuotas()))
  expect_null(monitoreo_territorial_avance_cuotas(NULL, audit_cuotas()))
  vacio <- monitoreo_territorial_avance_cuotas(envio_cuotas(), data.frame())
  expect_identical(vacio$total$efectivas, 0L)
})
