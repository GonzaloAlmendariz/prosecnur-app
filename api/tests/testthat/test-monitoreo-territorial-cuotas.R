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

test_that("una zona con dos personas reparte su cuota y cada una lleva sus efectivas", {
  audit <- audit_cuotas()
  audit$pulso_code_normalized <- c("P101", "P102", "P101", "P101", "P103", "P101", "P102")
  asignacion <- list(
    list(id_zona = "150101", id_manzana = "150101", codigo = "P101", parte = 3L, role = "zona"),
    list(id_zona = "150101", id_manzana = "150101", codigo = "P102", parte = 1L, role = "zona"),
    list(id_zona = "150132", id_manzana = "150132", codigo = "P103", parte = 2L, role = "zona")
  )
  out <- monitoreo_territorial_avance_cuotas(envio_cuotas(), audit, asignacion)
  lima <- out$zonas[[1]]
  expect_length(lima$personas, 2L)
  expect_identical(lima$personas[[1]]$efectivas, 3L)   # P101: casos 1, 3 y 4
  expect_identical(lima$personas[[1]]$falta, 0L)
  expect_identical(lima$personas[[2]]$efectivas, 2L)   # P102: casos 2 y 7
  # El caso de P103 en SJL no es efectivo.
  expect_identical(out$zonas[[2]]$personas[[1]]$efectivas, 0L)
  expect_identical(out$zonas[[2]]$personas[[1]]$falta, 2L)
  # Sin asignación, las zonas no inventan personas.
  expect_length(monitoreo_territorial_avance_cuotas(envio_cuotas(), audit)$zonas[[1]]$personas, 0L)
})

test_that("el sexo con código de Kobo (1, 2) casa con las celdas Hombre y Mujer", {
  audit <- data.frame(ubigeo = "150101", sex = c("1", "2", "3"), age = c(20, 70, 25),
                      advance_valid = TRUE, observation_status = "sin_observacion", stringsAsFactors = FALSE)
  out <- monitoreo_territorial_avance_cuotas(envio_cuotas(), audit)
  lima <- out$zonas[[1]]
  expect_identical(lima$celdas[[1]]$efectivas, 1L)   # hombre 18 a 29
  expect_identical(lima$celdas[[2]]$efectivas, 1L)   # mujer 60 o más
  expect_identical(out$sin_celda, 1L)                # el código 3 no es una celda
})

test_that("cada zona trae su equipo, su ritmo diario y la mediana de duración", {
  audit <- audit_cuotas()
  audit$pulso_code_normalized <- c("P101", "P102", "P101", "P101", "P103", "P101", "12345678")
  audit$pulso_code_recognized <- c(TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE)
  audit$submission_date_iso <- c("2026-06-13", "2026-06-13", "2026-06-14", "2026-06-15", "2026-06-13", "2026-06-13", "2026-06-15")
  audit$duration_seconds <- c(600, 900, 1200, 300, 600, 600, NA)
  lima <- monitoreo_territorial_avance_cuotas(envio_cuotas(), audit)$zonas[[1]]
  eq <- lima$equipo
  expect_identical(vapply(eq$personas, function(p) p$codigo, ""), c("P101", "P102"))
  expect_identical(eq$personas[[1]]$efectivas, 3L)
  expect_identical(eq$personas[[1]]$dias, 3L)
  expect_identical(eq$personas[[2]]$en_observacion, 1L)
  # El código que no casa con la lista no se nombra: se cuenta.
  expect_identical(eq$sin_codigo, 1L)
  expect_false(any(grepl("12345678", unlist(eq))))
  expect_identical(vapply(lima$diario$dias, function(d) d$fecha, ""), c("2026-06-13", "2026-06-14", "2026-06-15"))
  expect_identical(vapply(lima$diario$dias, function(d) d$efectivas, 1L), c(2L, 1L, 2L))
  expect_identical(lima$diario$sin_fecha, 0L)
  expect_identical(lima$duracion_mediana_min, 12.5)   # 300, 600, 900 y 1200 s; la sin duración no entra
})

test_that("el equipo, el ritmo y la duración no pierden ni inventan casos", {
  audit <- audit_cuotas()
  audit$pulso_code_normalized <- c("P101", "P102", "P101", "P101", "P103", "P101", "P102")
  audit$submission_date_iso <- c("2026-06-13", "", "2026-06-14", "2026-06-15", "2026-06-13", "2026-06-13", "2026-06-15")
  audit$duration_seconds <- c(0, -5, 600, 1200, 600, 600, NA)
  lima <- monitoreo_territorial_avance_cuotas(envio_cuotas(), audit)$zonas[[1]]
  # Sin la marca de código reconocido no se nombra a nadie.
  expect_length(lima$equipo$personas, 0L)
  expect_identical(lima$equipo$sin_codigo, lima$efectivas)
  # La fecha vacía va aparte y la suma cuadra con las efectivas.
  expect_identical(lima$diario$sin_fecha, 1L)
  expect_identical(sum(vapply(lima$diario$dias, function(d) d$efectivas, 1L)) + lima$diario$sin_fecha, lima$efectivas)
  # Duraciones de 0 o negativas no entran en la mediana.
  expect_identical(lima$duracion_mediana_min, 15)
})

test_that("dos zonas con el mismo ubigeo se avisan", {
  envio <- envio_cuotas()
  envio$zonas[[2]]$ubigeo <- "150101"
  out <- monitoreo_territorial_avance_cuotas(envio, audit_cuotas())
  expect_length(out$avisos, 1L)
  expect_match(out$avisos[[1]], "150101")
  expect_length(monitoreo_territorial_avance_cuotas(envio_cuotas(), audit_cuotas())$avisos, 0L)
})
