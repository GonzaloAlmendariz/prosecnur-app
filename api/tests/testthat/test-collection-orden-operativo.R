# «No estaria en orden del primer curso-horario al ultimo y los reemplazos asi
# como los extras deberian estar en ese orden de importancia» —Gonzalo, mirando
# la tabla del plan de recoleccion.
#
# El sorteo ya tiene la cadena resuelta: `operational_sequence` la comparten el
# titular y sus reservas, y `replacement_order` dice el lugar dentro de ella. El
# handoff copiaba las filas en el orden crudo, que agrupa por rol, asi que la
# tabla ensenaba titulares sueltos y despues un bloque de banco. La cadena —la
# unidad con la que se decide cuando un aula cae— no se veia por ninguna parte.

.u <- function(code, role, seq = NA, ord = NA) list(
  unit_id = code, label = code, role = role,
  dimensions = list(legacy_ref = code, operational_sequence = seq, replacement_order = ord)
)

.codigos <- function(us) vapply(us, function(u) u$unit_id, character(1))

test_that("cada titular sale con sus reservas detras, y las cadenas en orden", {
  # De entrada, agrupadas por rol: todos los titulares y luego todas las reservas.
  entrada <- list(
    .u("CH 1", "titular", 1), .u("CH 2", "titular", 2),
    .u("R 2.1", "chain_reserve", 2, 1), .u("R 1.1", "chain_reserve", 1, 1),
    .u("R 1.2", "chain_reserve", 1, 2)
  )
  salida <- prosecnurapp:::.collection_orden_operativo(entrada)
  expect_identical(.codigos(salida), c("CH 1", "R 1.1", "R 1.2", "CH 2", "R 2.1"))
})

test_that("el banco va al final, detras de todas las cadenas", {
  entrada <- list(
    .u("EXTRA 1", "extra_reserve_pool", 1),
    .u("CH 2", "titular", 2),
    .u("EXTRA 2", "extra_reserve_pool", 2),
    .u("CH 1", "titular", 1)
  )
  expect_identical(
    .codigos(prosecnurapp:::.collection_orden_operativo(entrada)),
    c("CH 1", "CH 2", "EXTRA 1", "EXTRA 2")
  )
})

test_that("el titular va antes que sus reservas aunque llegue despues", {
  entrada <- list(.u("R 1.1", "chain_reserve", 1, 1), .u("CH 1", "titular", 1))
  expect_identical(
    .codigos(prosecnurapp:::.collection_orden_operativo(entrada)),
    c("CH 1", "R 1.1")
  )
})

test_that("una unidad sin secuencia conserva su posicion, no se inventa un sitio", {
  # Inventarle un numero la moveria a un sitio arbitrario, que es peor que
  # dejarla donde estaba.
  entrada <- list(.u("CH 1", "titular", 1), .u("SIN SEQ", "titular"), .u("CH 2", "titular", 2))
  expect_identical(
    .codigos(prosecnurapp:::.collection_orden_operativo(entrada)),
    c("CH 1", "CH 2", "SIN SEQ")
  )
})

test_that("una lista vacia no rompe nada", {
  expect_length(prosecnurapp:::.collection_orden_operativo(list()), 0L)
})
