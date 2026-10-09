# El divisor sellado tiene campo propio.
#
# Decision de Gonzalo (2026-08-27): «la separacion para el 5». Antes, sellar la
# decision de alumnos por CH escribia el estadistico elegido —P25 incluido—
# dentro de `promedio_conglomerado` y ponia `mediana_conglomerado` en 0. Dos
# costos: el campo decia «promedio» guardando otra cosa, y sellar BORRABA la
# mediana medida del marco, con lo que un estudio que despues quisiera volver a
# `min_media_mediana` ya no tenia con que.

.div_estrato <- function(...) {
  e <- list(label = "FAC1", N = 4000, tau = 0.5)
  modifyList(e, list(...))
}
.div_par <- function(modo = "media") {
  list(promedio_conglomerado = 25, tau = 0.5, estadistico_conglomerado = modo)
}

test_that("el divisor sellado manda sobre el par promedio/mediana", {
  e <- .div_estrato(promedio_conglomerado = 40, mediana_conglomerado = 30,
                    divisor_conglomerado = 29, divisor_estadistico = "p25")
  out <- prosecnurapp:::.cm_estadistico_conglomerado_estrato(e, .div_par("mediana"))
  expect_equal(out$valor, 29)
  # Y declara el estadistico REAL, no «media»: era justo lo que engañaba.
  expect_identical(out$usado, "p25")
})

test_that("sin sellar, la logica de siempre queda intacta", {
  e <- .div_estrato(promedio_conglomerado = 40, mediana_conglomerado = 30)
  expect_equal(prosecnurapp:::.cm_estadistico_conglomerado_estrato(e, .div_par("media"))$valor, 40)
  expect_equal(prosecnurapp:::.cm_estadistico_conglomerado_estrato(e, .div_par("mediana"))$valor, 30)
  expect_equal(prosecnurapp:::.cm_estadistico_conglomerado_estrato(e, .div_par("min_media_mediana"))$valor, 30)
})

test_that("sellar ya NO borra la mediana medida del marco", {
  # El mutante que mata: con el comportamiento viejo la mediana quedaba en 0 y
  # `min_media_mediana` degradaba a la media para siempre.
  estudio <- list(componentes = list(list(
    id = "cmp-x", actor_id = "estudiantes_facultad",
    tecnica = "prob_conglomerado_multietapico",
    marco = list(estado = "validado", estratos = list(
      .div_estrato(promedio_conglomerado = 40, mediana_conglomerado = 30)
    )),
    parametros = .div_par("min_media_mediana")
  )))
  fuente <- calc_muestra_normalize_componente(estudio$componentes[[1]])
  e <- fuente$marco$estratos[[1]]
  # La normalizacion conserva los cuatro campos, sellados o no.
  expect_equal(e$promedio_conglomerado, 40)
  expect_equal(e$mediana_conglomerado, 30)
  expect_equal(e$divisor_conglomerado, 0)
  expect_identical(e$divisor_estadistico, "")
})

test_that("el divisor sellado y su estadistico sobreviven el round-trip", {
  comp <- calc_muestra_normalize_componente(list(
    tecnica = "prob_conglomerado_multietapico",
    marco = list(estratos = list(
      .div_estrato(promedio_conglomerado = 40, mediana_conglomerado = 30,
                   divisor_conglomerado = 29, divisor_estadistico = "p25")
    ))
  ))
  e <- comp$marco$estratos[[1]]
  expect_equal(e$divisor_conglomerado, 29)
  expect_identical(e$divisor_estadistico, "p25")
  # Y las medidas del marco siguen ahi, que es la mitad que se perdia.
  expect_equal(e$promedio_conglomerado, 40)
  expect_equal(e$mediana_conglomerado, 30)

  otra <- calc_muestra_normalize_componente(comp)
  expect_equal(otra$marco$estratos[[1]]$divisor_conglomerado, 29)
  expect_equal(otra$marco$estratos[[1]]$mediana_conglomerado, 30)
})

test_that("el resultado dimensiona con el divisor sellado", {
  comp <- list(
    tecnica = "prob_conglomerado_multietapico",
    marco = list(estado = "validado", estratos = list(
      .div_estrato(promedio_conglomerado = 40, mediana_conglomerado = 30,
                   divisor_conglomerado = 29, divisor_estadistico = "p25")
    )),
    parametros = .div_par("mediana")
  )
  fila <- calc_muestra_calcular_componente(comp)$aulas_por_estrato[[1]]
  expect_equal(fila$avg_conglomerado, 29)
  expect_identical(fila$estadistico_usado, "p25")
})
