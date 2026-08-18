# El frontend declara courseLevelRanges como Record<string, Array<[number,
# number]>> (pares POSICIONALES; frontend/src/api/calcMuestra.ts) y el motor
# los normaliza con .cm_criterios_normalize_rangos, que solo leia $min/$max.
# Todo par posicional daba NA y se descartaba EN SILENCIO: la facultad
# desaparecia del mapa, el evaluador con mapa vacio deja pasar todo y el
# criterio de nivel configurado en la UI nunca filtraba. El .pulso guardaba
# courseLevelRanges = [] — medido en HSVG2026 (S2 del loop de replicacion
# 2025). Estos tests fijan el contrato: los shapes que produce el POST del
# front (matriz jsonlite simplificada, lista de listas, lista de vectores)
# tienen que normalizar a {min,max} y FILTRAR igual que el shape canonico.

.rff_pairs <- function(fac_curso, nivel) {
  paste0(fac_curso, .cm_catalogo_pair_fld, nivel)
}

test_that("los pares posicionales del front normalizan igual que {min,max}", {
  canon <- .cm_criterios_normalize_nivel_por_unidad(
    list(DERECHO = list(list(min = 0, max = 0), list(min = 2, max = 10)))
  )
  # Shape 1: lista de listas sin nombres — [[0,0],[2,10]] parseado sin simplificar.
  ll <- .cm_criterios_normalize_nivel_por_unidad(
    list(DERECHO = list(list(0, 0), list(2, 10)))
  )
  # Shape 2: lista de vectores numericos.
  lv <- .cm_criterios_normalize_nivel_por_unidad(
    list(DERECHO = list(c(0, 0), c(2, 10)))
  )
  # Shape 3: matriz — jsonlite::fromJSON simplifica [[0,0],[2,10]] a matrix 2x2.
  lm <- .cm_criterios_normalize_nivel_por_unidad(
    jsonlite::fromJSON('{"DERECHO":[[0,0],[2,10]]}', simplifyVector = TRUE)
  )
  expect_identical(ll, canon)
  expect_identical(lv, canon)
  expect_identical(lm, canon)
  # La forma canonica quedo con sus dos rangos enteros.
  expect_length(canon$DERECHO, 2L)
  expect_identical(canon$DERECHO[[2]], list(min = 2L, max = 10L))
})

test_that("un rango normalizado desde pares FILTRA de verdad", {
  # No basta con que el shape sobreviva: el evaluador tiene que recortar el
  # nivel 1 y dejar pasar el 0 y el 5, igual que con el shape canonico.
  ranges <- .cm_criterios_normalize_nivel_por_unidad(
    jsonlite::fromJSON('{"DERECHO":[[0,0],[2,10]]}', simplifyVector = TRUE)
  )
  ok <- .cm_criterios_eval_course_ranges(
    course_pairs = c(.rff_pairs("DERECHO", 1), .rff_pairs("DERECHO", 0), .rff_pairs("DERECHO", 5)),
    ranges = ranges,
    faculty_keys = c("DERECHO", "DERECHO", "DERECHO")
  )
  expect_false(ok[[1]])
  expect_true(ok[[2]])
  expect_true(ok[[3]])
})

test_that("un par suelto [min, max] sin anidar tambien se acepta", {
  r <- .cm_criterios_normalize_rangos(c(2, 10))
  expect_identical(r, list(list(min = 2L, max = 10L)))
})

test_that("la exencion y la basura no se confunden con pares", {
  # La exencion sigue reconociendose en sus tres formas con el codigo nuevo.
  for (entrada in list("exenta", list("exenta"), list(exenta = TRUE))) {
    r <- .cm_criterios_normalize_nivel_por_unidad(list(GESTION = entrada))
    expect_true(.cm_criterios_es_rango_exento(r$GESTION))
  }
  # Un par con un extremo no parseable se descarta, no degrada a 0.
  expect_length(.cm_criterios_normalize_rangos(list(list("x", 10))), 0L)
  # Una lista de DOS rangos {min,max} sin nombres externos no se colapsa a un
  # par: unlist daria 4 numeros y el guard de longitud 2 no debe dispararse.
  r <- .cm_criterios_normalize_rangos(list(list(min = 0, max = 0), list(min = 2, max = 10)))
  expect_length(r, 2L)
})

test_that("normalizar dos veces es estable (el router y el constructor repasan)", {
  una <- .cm_criterios_normalize_nivel_por_unidad(
    list(DERECHO = list(list(0, 0), list(2, 10)), GESTION = "exenta")
  )
  dos <- .cm_criterios_normalize_nivel_por_unidad(una)
  expect_identical(una, dos)
})
