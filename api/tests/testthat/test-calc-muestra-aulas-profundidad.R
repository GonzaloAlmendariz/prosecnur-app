# Profundidad de cadena por facultad (criterio de Gonzalo, 2026-08-21:
# cobertura 99 %, piso de 2 para las facultades sin caídas propias).

.pf_cadena <- function(facultad, aplicados) {
  list(facultad = facultad, escalones = lapply(seq_len(aplicados), function(i) list(estado = "aplicado")))
}

test_that("una facultad que nunca cayó recibe el piso, no cero", {
  # Derecho: 16 titulares, ninguno necesitó reemplazo. Cero caídas en 16 aulas
  # no prueba que nunca caiga ninguna, así que no se le da profundidad 1.
  cadenas <- lapply(seq_len(16), function(i) .pf_cadena("DERECHO", 1L))
  r <- calc_muestra_aulas_profundidad_por_facultad(cadenas)
  expect_identical(r$por_facultad[["derecho"]]$profundidad, .cm_prof_min)
  expect_identical(r$por_facultad[["derecho"]]$tasa_cruda, 0)
})

test_that("una facultad chica con tasa alta NO dispara la profundidad", {
  # 3 caídas en 4 titulares: la tasa cruda es 0,75 y sin encogimiento pediría
  # 16 reemplazos por titular, MÁS que el default de 11 que este criterio viene
  # a corregir. El encogimiento hacia la global es lo que lo impide.
  cadenas <- c(
    lapply(seq_len(3), function(i) .pf_cadena("EDUCACION", 2L)),
    list(.pf_cadena("EDUCACION", 1L)),
    # Una facultad grande y estable que fija la tasa global hacia la que encoger.
    lapply(seq_len(40), function(i) .pf_cadena("CIENCIAS E INGENIERIA", 1L))
  )
  r <- calc_muestra_aulas_profundidad_por_facultad(cadenas)
  edu <- r$por_facultad[["educacion"]]
  expect_identical(edu$tasa_cruda, 0.75)
  expect_lt(edu$tasa_usada, edu$tasa_cruda)
  expect_lte(edu$profundidad, .cm_prof_max)
  expect_lt(edu$profundidad, 11L)
})

test_that("ninguna facultad supera el techo", {
  cadenas <- lapply(seq_len(30), function(i) .pf_cadena("CAOTICA", 4L))
  r <- calc_muestra_aulas_profundidad_por_facultad(cadenas)
  expect_identical(r$por_facultad[["caotica"]]$profundidad, .cm_prof_max)
})

test_that("sin histórico se declara la fuente y se cae al piso", {
  r <- calc_muestra_aulas_profundidad_por_facultad(list())
  expect_identical(r$fuente, "sin_historico")
  expect_identical(r$global, as.integer(.cm_prof_min))
  expect_length(r$por_facultad, 0L)
})

test_that("la tasa sale de titulares que CAYERON, no de escalones sueltos", {
  # La trampa del denominador: contar escalones aplicados en vez de titulares
  # con más de uno inflaría la tasa y con ella la profundidad.
  cadenas <- c(
    lapply(seq_len(9), function(i) .pf_cadena("X", 1L)),   # 9 sin caída
    list(.pf_cadena("X", 3L))                               # 1 que cayó dos veces
  )
  r <- calc_muestra_aulas_profundidad_por_facultad(cadenas)
  expect_identical(r$por_facultad[["x"]]$tasa_cruda, 0.1)
  expect_identical(r$por_facultad[["x"]]$titulares, 10L)
})

test_that("la profundidad crece con la tasa, de forma monótona", {
  expect_lte(.cm_prof_desde_tasa(0.05), .cm_prof_desde_tasa(0.2))
  expect_lte(.cm_prof_desde_tasa(0.2), .cm_prof_desde_tasa(0.5))
  # 13,5 % es la tasa global de 2025: la cobertura del 99 % pide 3.
  expect_identical(.cm_prof_desde_tasa(0.135), 3L)
})
