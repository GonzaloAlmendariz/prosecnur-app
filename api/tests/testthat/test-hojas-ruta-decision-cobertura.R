# Decisión de cobertura del marco elegible (ADR 0115 §4, revisión de U17).

.fila_cob <- function(ubigeo, total, area = 0, minimo = 0, piloto = 0) {
  list(ubigeo = ubigeo, distrito = paste("D", ubigeo), total = list(poblacion = total),
       excluida_area = list(poblacion = area), excluida_minimo = list(poblacion = minimo), excluida_piloto = list(poblacion = piloto))
}

test_that("el umbral es 10 %: 9,99 % no exige, 10,00 % sí; la piloto no cuenta; población 0 no exige", {
  r <- hojas_ruta_marco_elegible_requiere_decision(list(
    .fila_cob("a", 10000, area = 999),
    .fila_cob("b", 10000, area = 600, minimo = 400),
    .fila_cob("c", 10000, piloto = 5000),
    .fila_cob("d", 0, area = 0)
  ))
  expect_identical(vapply(r, `[[`, character(1), "ubigeo"), "b")
  expect_equal(r[[1]]$excluida, 0.1)
})

test_that("la huella sobrevive al ida y vuelta por JSON y cambia con el mínimo o un área", {
  me <- list(declarado = TRUE, minimo_viviendas = 10L, areas_excluidas = list(
    list(id = "a1", motivo = "otro", detalle = "cerro", poligono = list(c(-77.0, -12.0), c(-77.0, -12.1), c(-77.1, -12.1)))
  ))
  h <- hojas_ruta_marco_elegible_huella(me)
  ida <- jsonlite::fromJSON(jsonlite::toJSON(me, auto_unbox = TRUE, digits = NA), simplifyVector = FALSE)
  expect_identical(hojas_ruta_marco_elegible_huella(ida), h)
  me2 <- me; me2$minimo_viviendas <- 12L
  expect_false(identical(hojas_ruta_marco_elegible_huella(me2), h))
  me3 <- me; me3$areas_excluidas[[1]]$poligono[[2]] <- c(-77.0, -12.2)
  expect_length(hojas_ruta_marco_elegible_normalizar(me)$areas_excluidas, 1)
  expect_false(identical(hojas_ruta_marco_elegible_huella(me3), h))
  expect_identical(hojas_ruta_bitacora_detalle_marco(me)$hash, h)
})

test_that("vigente: la más reciente con la misma huella que cubre los distritos que hoy exigen", {
  b <- list(
    list(accion = "decision_cobertura", detalle = list(marco_hash = "h1", ubigeos = list("a", "b"))),
    list(accion = "sorteo", detalle = list()),
    list(accion = "decision_cobertura", detalle = list(marco_hash = "h0", ubigeos = list("a", "b", "c")))
  )
  expect_identical(hojas_ruta_decision_cobertura_vigente(b, "h1", c("a"))$detalle$marco_hash, "h1")
  expect_null(hojas_ruta_decision_cobertura_vigente(b, "h1", c("a", "c")))
  expect_null(hojas_ruta_decision_cobertura_vigente(b, "h2", c("a")))
  expect_null(hojas_ruta_decision_cobertura_vigente(list(), "h1", c("a")))
})
