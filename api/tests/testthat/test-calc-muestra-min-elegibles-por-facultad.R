# El mínimo de elegibles POR FACULTAD sobrevive a la falta de umbral general.
#
# `.cm_criterios_normalize_seleccion()` conserva `{byFaculty: {...}}` sin
# `threshold` porque la app manda el general sólo cuando el usuario lo cambia.
# Sus tres consumidores —marco, cascada viva y radiografía— repetían la guarda
# vieja `!is.finite(threshold)` y reemplazaban el objeto entero por uno con
# `byFaculty = list()`: la normalización salvaba los mínimos propios y el
# evaluador los tiraba tres líneas después, sin aviso.
#
# Medido el 2026-08-25 sobre HSVG26DEF con
# `minEligible = {threshold: NA, byFaculty: {ciencias_e_ingenieria: 20}}`:
# el marco dejó DENTRO 333 de las 899 aulas incluidas de Ingeniería con menos de
# 20 elegibles (una con 1) y NINGUNA fila excluida por `min_eligible_per_class`.

test_that("sin umbral general, los minimos por facultad se conservan", {
  min_elig <- list(threshold = NA_real_, byFaculty = list(ciencias_e_ingenieria = 20))

  efectivo <- .cm_criterios_min_elig_con_fallback(min_elig, 1L)

  # Lo que se perdía: la clave por facultad desaparecía del objeto efectivo.
  expect_identical(efectivo$byFaculty$ciencias_e_ingenieria, 20)
  # El general cae al piso legacy, que es lo correcto: las demás facultades no
  # declararon mínimo propio.
  expect_identical(efectivo$threshold, 1L)
})

test_that("el minimo por facultad excluye las aulas por debajo de su umbral", {
  min_elig <- .cm_criterios_min_elig_con_fallback(
    list(threshold = NA_real_, byFaculty = list(ciencias_e_ingenieria = 20)),
    1L
  )
  elegibles <- c(1, 4, 19, 20, 45, 3)
  facultades <- .cm_criterios_fac_key(c(
    rep("CIENCIAS E INGENIERIA", 5), "DERECHO"
  ))

  ok <- .cm_criterios_eval_min_eligible(elegibles, facultades, min_elig)

  # Ingeniería: sólo 20 y 45 llegan a su mínimo propio.
  expect_identical(ok[1:5], c(FALSE, FALSE, FALSE, TRUE, TRUE))
  # Derecho no declaró mínimo: la rige el general (piso 1), así que 3 pasa.
  expect_true(ok[[6]])
})

test_that("sin umbral general NI minimos por facultad manda el piso legacy", {
  efectivo <- .cm_criterios_min_elig_con_fallback(
    list(threshold = NA_real_, byFaculty = list()), 5L
  )

  expect_identical(efectivo$threshold, 5L)
  expect_length(efectivo$byFaculty, 0L)
  # Con el piso en 5, un aula de 4 elegibles queda fuera.
  expect_identical(
    .cm_criterios_eval_min_eligible(c(4, 5), .cm_criterios_fac_key(c("A", "A")), efectivo),
    c(FALSE, TRUE)
  )
})

test_that("un umbral general propio convive con las excepciones por facultad", {
  efectivo <- .cm_criterios_min_elig_con_fallback(
    list(threshold = 10, byFaculty = list(derecho = 30)), 1L
  )

  expect_identical(efectivo$threshold, 10)
  expect_identical(
    .cm_criterios_eval_min_eligible(
      c(9, 10, 29, 30),
      .cm_criterios_fac_key(c("OTRA", "OTRA", "DERECHO", "DERECHO")),
      efectivo
    ),
    c(FALSE, TRUE, FALSE, TRUE)
  )
})
