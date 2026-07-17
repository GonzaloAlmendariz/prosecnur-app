# parametros$estadistico_conglomerado ∈ {media, mediana, min_media_mediana}
# (acuerdo metodológico 2026-07-15): estadístico del tamaño de conglomerado
# para las cuotas por estrato. Default "media" = comportamiento histórico bit
# a bit; "mediana" opera cuando el estrato aporta mediana_conglomerado (la
# calcula el perfil del marco: est_aula_mediana por facultad) y degrada
# DECLARADAMENTE a la media cuando no hay mediana (estadistico_usado audita).

test_that("estadistico_conglomerado se normaliza con default media (back-compat)", {
  comp <- calc_muestra_normalize_componente(list(tecnica = "prob_conglomerado_multietapico"))
  expect_identical(comp$parametros$estadistico_conglomerado, "media")

  comp2 <- calc_muestra_normalize_componente(list(
    tecnica = "prob_conglomerado_multietapico",
    parametros = list(estadistico_conglomerado = "mediana")
  ))
  expect_identical(comp2$parametros$estadistico_conglomerado, "mediana")

  # Round-trip idempotente (whitelist del componente).
  comp3 <- calc_muestra_normalize_componente(comp2)
  expect_identical(comp3$parametros$estadistico_conglomerado, "mediana")

  # Valor inválido degrada al default.
  malo <- calc_muestra_normalize_componente(list(
    tecnica = "prob_conglomerado_multietapico",
    parametros = list(estadistico_conglomerado = "promedio_raro")
  ))
  expect_identical(malo$parametros$estadistico_conglomerado, "media")
})

test_that("mediana_conglomerado del estrato sobrevive la normalización", {
  comp <- calc_muestra_normalize_componente(list(
    tecnica = "prob_conglomerado_multietapico",
    marco = list(estratos = list(
      list(label = "FAC1", N = 4000, mediana_conglomerado = 25)
    ))
  ))
  expect_equal(comp$marco$estratos[[1]]$mediana_conglomerado, 25)
})

test_that("aulas_por_estrato usa la mediana cuando existe y degrada declarado cuando no", {
  comp <- list(
    tecnica = "prob_conglomerado_multietapico",
    marco = list(
      estado = "validado",
      estratos = list(
        list(label = "FAC1", N = 4000, promedio_conglomerado = 40,
             mediana_conglomerado = 25, tau = 0.5),
        list(label = "FAC2", N = 2000, promedio_conglomerado = 30, tau = 0.5)
      )
    ),
    parametros = list(estadistico_conglomerado = "mediana",
                      promedio_conglomerado = 25, tau = 0.5)
  )
  res <- calc_muestra_calcular_componente(comp)
  ape <- res$aulas_por_estrato
  expect_identical(ape[[1]]$estadistico_usado, "mediana")
  expect_equal(ape[[1]]$avg_conglomerado, 25)
  # FAC2 no trae mediana: degradación declarada a la media del estrato.
  expect_identical(ape[[2]]$estadistico_usado, "media")
  expect_equal(ape[[2]]$avg_conglomerado, 30)
  # Metadato declarado en la salida de cuotas.
  expect_identical(res$estadistico_conglomerado, "mediana")
})

test_that("min_media_mediana toma el mínimo y media reproduce el histórico", {
  base_comp <- function(estadistico) {
    list(
      tecnica = "prob_conglomerado_multietapico",
      marco = list(
        estado = "validado",
        estratos = list(
          list(label = "FAC1", N = 4000, promedio_conglomerado = 40,
               mediana_conglomerado = 25, tau = 0.5)
        )
      ),
      parametros = list(estadistico_conglomerado = estadistico,
                        promedio_conglomerado = 25, tau = 0.5)
    )
  }
  res_min <- calc_muestra_calcular_componente(base_comp("min_media_mediana"))
  expect_identical(res_min$aulas_por_estrato[[1]]$estadistico_usado, "min_media_mediana")
  expect_equal(res_min$aulas_por_estrato[[1]]$avg_conglomerado, 25)

  # Default media: mismo avg que el motor histórico (back-compat bit a bit).
  res_media <- calc_muestra_calcular_componente(base_comp("media"))
  expect_identical(res_media$aulas_por_estrato[[1]]$estadistico_usado, "media")
  expect_equal(res_media$aulas_por_estrato[[1]]$avg_conglomerado, 40)
})
