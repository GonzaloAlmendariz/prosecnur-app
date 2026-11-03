# Meta o referencial por dimensión de la cuota territorial (ADR 0126).

.thcc_celdas <- function() data.frame(
  ubigeo = "150101", territorio = "Lima",
  rango_id = c("1", "2", "1", "2"), rango_edad = c("18-29", "30+", "18-29", "30+"),
  sexo = c("Hombre", "Hombre", "Mujer", "Mujer"), cuota = c(5L, 7L, 6L, 8L),
  stringsAsFactors = FALSE
)

test_that("sólo se guardan dimensiones conocidas; declarar todo «meta» es no declarar nada", {
  expect_identical(hojas_ruta_caracter_cuotas_normalizar(list(sexo = "referencial", edad = "meta", otra = "referencial")),
                   list(sexo = "referencial", edad = "meta"))
  expect_identical(hojas_ruta_caracter_cuotas_normalizar(list(sexo = "meta", edad = "meta")), list())
  expect_identical(hojas_ruta_caracter_cuotas_normalizar(list(sexo = "obligatoria")), list())
  expect_identical(hojas_ruta_caracter_cuotas_normalizar(NULL), list())
})

test_that("la configuración conserva la marca declarada", {
  cfg <- hojas_ruta_integrada_normalize_config(list(caracter_cuotas = list(sexo = "referencial")))
  expect_identical(cfg$caracter_cuotas, list(sexo = "referencial"))
  expect_identical(hojas_ruta_integrada_normalize_config(list())$caracter_cuotas, list())
})

test_that("la marca viaja en la zona y mueve la huella sólo cuando se declara", {
  sin <- .hojas_ruta_zonas_de_cuotas(.thcc_celdas())
  con <- .hojas_ruta_zonas_de_cuotas(.thcc_celdas(), caracter = list(sexo = "referencial"))
  expect_null(sin[[1]]$caracter)
  expect_identical(con[[1]]$caracter, list(sexo = "referencial"))
  # Sin declarar, la huella es la misma de siempre: ningún envío existente sale desactualizado.
  expect_identical(.hojas_ruta_cuotas_fingerprint(sin),
                   .hojas_ruta_cuotas_fingerprint(.hojas_ruta_zonas_de_cuotas(.thcc_celdas(), caracter = list())))
  expect_false(identical(.hojas_ruta_cuotas_fingerprint(sin), .hojas_ruta_cuotas_fingerprint(con)))
  # La normalización del envío no la pierde.
  envio <- .hojas_ruta_envio_normalize(list(kind = "cuotas", zonas = con))
  expect_identical(envio$zonas[[1]]$caracter, list(sexo = "referencial"))
})

test_that("sin división por sexo no hay sexo que declarar", {
  expect_identical(hojas_ruta_caracter_cuotas_normalizar(list(sexo = "referencial", edad = "referencial"), "ninguna"),
                   list(edad = "referencial"))
  cfg <- hojas_ruta_integrada_normalize_config(list(subquota_var = "ninguna", caracter_cuotas = list(sexo = "referencial")))
  expect_identical(cfg$caracter_cuotas, list())
})

test_that("la marca sobrevive la ida y vuelta por JSON del cliente y por state.rds", {
  cfg <- hojas_ruta_integrada_normalize_config(list(caracter_cuotas = list(sexo = "referencial")))
  json <- jsonlite::fromJSON(jsonlite::toJSON(cfg, auto_unbox = TRUE, null = "null"), simplifyVector = FALSE)
  expect_identical(hojas_ruta_integrada_normalize_config(json)$caracter_cuotas, list(sexo = "referencial"))
  # Sin declarar viaja como `[]` y vuelve igual de vacía.
  vacia <- jsonlite::fromJSON(jsonlite::toJSON(hojas_ruta_integrada_normalize_config(list()), auto_unbox = TRUE), simplifyVector = FALSE)
  expect_identical(hojas_ruta_integrada_normalize_config(vacia)$caracter_cuotas, list())
  f <- tempfile(fileext = ".rds"); on.exit(unlink(f), add = TRUE)
  saveRDS(cfg, f)
  expect_identical(hojas_ruta_integrada_normalize_config(readRDS(f))$caracter_cuotas, list(sexo = "referencial"))
})
