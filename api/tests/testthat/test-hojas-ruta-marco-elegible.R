# Marco elegible de Hojas de ruta (ADR 0115): normalización, filtro y resumen.

me_frame <- function() {
  data.frame(
    ubigeo = c("150101", "150101", "150101", "150101", "150102", "150102"),
    distrito = c("LIMA", "LIMA", "LIMA", "LIMA", "ANCON", "ANCON"),
    zona = c("00100", "00100", "00200", "00200", "00100", "00100"),
    id_manzana = c("m1", "m2", "m3", "m4", "m5", "m6"),
    viviendas = c(40, 0, 0, 12, 30, 5),
    poblacion = c(150, 0, 0, 45, 100, 0),
    match_level = c("cartografia_key", "sin_conteo_redatam", "cartografia_key", "cartografia_key", "cartografia_key", "cartografia_key"),
    stringsAsFactors = FALSE
  )
}

# Puntos interiores inyectados: m1 dentro del área, m4 sobre su borde, m6 sin geometría.
me_puntos <- data.frame(
  id_manzana = c("m1", "m2", "m3", "m4", "m5"),
  lon = c(-77.005, -77.020, -77.030, -77.000, -77.100),
  lat = c(-12.055, -12.055, -12.070, -12.055, -11.800),
  nse_nivel = c("3 Medio", "4 Medio bajo", "4 Medio bajo", "2 Medio alto", "5 Bajo"),
  stringsAsFactors = FALSE
)

# Reemplazo plano: modifyList mezclaría las listas de vértices en vez de reemplazarlas.
me_area <- function(...) {
  a <- list(
    id = "a1", motivo = "no_residencial", detalle = "Zona industrial",
    poligono = list(c(-77.010, -12.050), c(-77.000, -12.050), c(-77.000, -12.060), c(-77.010, -12.060))
  )
  cambios <- list(...)
  a[names(cambios)] <- cambios
  a
}

test_that("sin la clave la corrida es legacy y su marco no cambia", {
  me <- hojas_ruta_marco_elegible_normalizar(NULL)
  expect_false(me$declarado)
  expect_identical(me$minimo_viviendas, 0L)
  expect_length(me$areas_excluidas, 0)
  r <- hojas_ruta_marco_elegible_aplicar(me_frame(), me)
  expect_identical(r$frame, me_frame())
})

test_that("mínimo 0 y lista de áreas vacía dejan el marco idéntico", {
  me <- hojas_ruta_marco_elegible_normalizar(list(minimo_viviendas = 0, areas_excluidas = list()))
  expect_true(me$declarado)
  expect_identical(hojas_ruta_marco_elegible_aplicar(me_frame(), me)$frame, me_frame())
})

test_that("un mínimo inválido cae al de corridas nuevas con aviso", {
  me <- hojas_ruta_marco_elegible_normalizar(list(minimo_viviendas = -3))
  expect_identical(me$minimo_viviendas, 1L)
  expect_identical(attr(me, "alertas")[[1]]$code, "W_ELIGIBILITY_MINIMUM_INVALID")
})

test_that("las áreas se validan: motivo cerrado, detalle con «otro», evidencia con inseguridad", {
  me <- hojas_ruta_marco_elegible_normalizar(list(areas_excluidas = list(
    me_area(id = "x", motivo = "basural"),
    me_area(id = "o", motivo = "otro", detalle = ""),
    me_area(id = "s", motivo = "inseguridad"),
    me_area(id = "ok", motivo = "inseguridad", fuente = "Supervisión 2025", fecha_evidencia = "2025-11-14")
  )))
  expect_identical(vapply(me$areas_excluidas, `[[`, character(1), "id"), "ok")
  codigos <- vapply(attr(me, "alertas"), `[[`, character(1), "code")
  expect_identical(codigos, rep("W_EXCLUDED_AREA_DISCARDED", 3))
})

test_that("el polígono se canoniza: cerrado, a 1e-6, y con lon/lat corregido si venía invertido", {
  me <- hojas_ruta_marco_elegible_normalizar(list(areas_excluidas = list(
    me_area(poligono = list(c(-12.05, -77.0100000004), c(-12.05, -77.0), c(-12.06, -77.0)))
  )))
  pol <- me$areas_excluidas[[1]]$poligono
  expect_length(pol, 4)
  expect_identical(pol[[1]], pol[[4]])
  expect_identical(pol[[1]], c(-77.01, -12.05))
  expect_identical(attr(me, "alertas")[[1]]$code, "W_EXCLUDED_AREA_SWAPPED")
})

test_that("un polígono con menos de tres vértices se descarta y uno fuera de Lima avisa", {
  me <- hojas_ruta_marco_elegible_normalizar(list(areas_excluidas = list(
    me_area(id = "corto", poligono = list(c(-77.01, -12.05), c(-77.00, -12.05))),
    me_area(id = "lejos", poligono = list(c(-70, -15), c(-69.9, -15), c(-69.9, -15.1)))
  )))
  expect_identical(vapply(me$areas_excluidas, `[[`, character(1), "id"), "lejos")
  expect_setequal(vapply(attr(me, "alertas"), `[[`, character(1), "code"), c("W_EXCLUDED_AREA_DISCARDED", "W_EXCLUDED_AREA_OUTSIDE"))
})

test_that("precedencia área > mínimo, borde excluye y sin geometría se queda", {
  me <- hojas_ruta_marco_elegible_normalizar(list(minimo_viviendas = 1, areas_excluidas = list(me_area())))
  r <- hojas_ruta_marco_elegible_aplicar(me_frame(), me, puntos = me_puntos)
  expect_identical(r$criterio, c("area", "minimo", "minimo", "area", "elegible", "elegible"))
  expect_identical(r$frame$id_manzana, c("m5", "m6"))
  lima <- r$por_distrito[[1]]
  expect_identical(lima$excluida_area$manzanas, 2L)
  expect_identical(lima$excluida_minimo$manzanas, 2L)
  # m2 es cero por falta de conteo; m3 es cero censal.
  expect_identical(lima$excluida_minimo_sin_conteo, 1L)
  ancon <- r$por_distrito[[2]]
  expect_identical(ancon$sin_geometria, 1L)
})

test_that("conservación: elegibles más excluidas es el marco, por distrito y por zona, sin tolerancia", {
  me <- hojas_ruta_marco_elegible_normalizar(list(minimo_viviendas = 1, areas_excluidas = list(me_area())))
  r <- hojas_ruta_marco_elegible_aplicar(me_frame(), me, puntos = me_puntos)
  for (fila in c(r$por_distrito, r$por_zona)) {
    for (k in c("manzanas", "viviendas", "poblacion")) {
      expect_identical(fila$elegible[[k]] + fila$excluida_area[[k]] + fila$excluida_minimo[[k]], fila$total[[k]])
    }
  }
  expect_length(r$por_zona, 3)
})

test_that("la cobertura es NA cuando el distrito no tiene población, no una división por cero", {
  f <- me_frame()
  f$poblacion[f$ubigeo == "150102"] <- 0
  r <- hojas_ruta_marco_elegible_aplicar(f, hojas_ruta_marco_elegible_normalizar(list(minimo_viviendas = 1)))
  expect_true(is.na(r$por_distrito[[2]]$cobertura_poblacion))
  expect_equal(r$por_distrito[[1]]$cobertura_poblacion, 1)
})

test_that("el punto interior cae dentro aunque la manzana sea cóncava", {
  # Una «U»: el centroide de área cae en el hueco.
  u <- rbind(c(0, 0), c(3, 0), c(3, 3), c(2, 3), c(2, 1), c(1, 1), c(1, 3), c(0, 3), c(0, 0))
  p <- hojas_ruta_marco_elegible_punto_interior(u)
  expect_true(.hojas_ruta_me_punto_en_anillo(p[1], p[2], u))
  expect_false(.hojas_ruta_me_en_borde(p[1], p[2], u))
  cuadrado <- rbind(c(0, 0), c(2, 0), c(2, 2), c(0, 2))
  expect_equal(hojas_ruta_marco_elegible_punto_interior(cuadrado), c(1, 1))
})
