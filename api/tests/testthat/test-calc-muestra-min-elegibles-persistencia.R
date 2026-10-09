# Los mínimos por facultad sobreviven el round-trip aunque no viaje el umbral.
#
# Medido en la app el 2026-08-25 sobre HSVG 2026: se declararon y confirmaron
# los diez mínimos por facultad del diseño, la tarjeta mostraba «Propio: ≥ 20»,
# el contador de pendientes se ponía en cero, y el `.pulso` guardaba
# `minEligible: {}`. La app manda el umbral general SÓLO cuando el usuario lo
# cambia; con el general por defecto el payload es `{byFaculty: {...}}` sin
# `threshold`, y la guarda del normalizador descartaba el objeto entero.
#
# El costo no fue cosmético: el marco se construyó con el mismo mínimo para las
# quince facultades y Artes Escénicas quedó con 33 cursos-horario en vez de 92.

.mep_normalizar <- function(minEligible) {
  est <- list(workspace = list(aulas_config = list(criterios_seleccion = list(
    byVariable = list(), minEligible = minEligible
  ))))
  calc_muestra_normalize_estudio(est)$workspace$aulas_config$criterios_seleccion$minEligible
}

test_that("los minimos por facultad sobreviven sin umbral general", {
  out <- .mep_normalizar(list(byFaculty = list(derecho = 20, artes_escenicas = 10)))
  expect_false(is.null(out))
  expect_equal(out$byFaculty$derecho, 20)
  expect_equal(out$byFaculty$artes_escenicas, 10)
})

test_that("sin umbral el threshold viaja NA y el efectivo cae al general", {
  out <- .mep_normalizar(list(byFaculty = list(derecho = 20)))
  expect_true(is.na(out$threshold))
  # El resolvedor del umbral efectivo usa `min_eligible_per_class` cuando el
  # threshold no viene: sin esto, un NA se leeria como «cero minimo».
  cfg <- list(filters = list(min_eligible_per_class = 15L),
              criterios_seleccion = list(minEligible = out))
  expect_equal(.cm_criterios_min_eligible_efectivo(cfg), 15L)
})

test_that("umbral y minimos juntos siguen viajando", {
  out <- .mep_normalizar(list(threshold = 15, byFaculty = list(derecho = 20)))
  expect_equal(out$threshold, 15)
  expect_equal(out$byFaculty$derecho, 20)
})

test_that("solo el umbral sigue viajando", {
  out <- .mep_normalizar(list(threshold = 15))
  expect_equal(out$threshold, 15)
  expect_length(out$byFaculty, 0L)
})

test_that("una tasa de asistencia suelta NO activa la suite", {
  # Es la intencion original de la guarda y no se pierde con el arreglo: un
  # attendance_rate solo neutralizaria los filtros legacy sin que nadie lo pida.
  expect_null(.mep_normalizar(list(attendance_rate = 0.7)))
})

test_that("un minEligible vacio tampoco la activa", {
  expect_null(.mep_normalizar(list()))
  expect_null(.mep_normalizar(list(byFaculty = list())))
})
