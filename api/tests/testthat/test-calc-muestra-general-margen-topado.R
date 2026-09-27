# Margen alcanzado cuando el n a campo se topa en el marco (L3 del loop de
# mejoras, 2026-09-27).
#
# Con N = 2000, e = .03 y respuesta .3 la fórmula pide 697 completas; abordar
# 697/.3 = 2324 no cabe y se aborda el marco entero, pero 2000 · .3 = 600
# completas esperadas: el margen real es ±3.35 y se publicaba ±3.0 «validado».
# Con tope, el margen sale de las completas ESPERADAS:
#   n_esperadas = mín(n, n_campo · tasa)  (por estrato cuando hay estratos)
# y el motor dice que el margen pedido no se alcanza.

.mt_comp <- function(tecnica = "prob_aleatorio_simple", N = 2000L, e = .03, tasa = .3,
                     os = .1, estratos = list(), asignacion = "proporcional") {
  list(
    actor = "Tope", actor_id = "tope", actor_categoria = "otros",
    tecnica = tecnica, origen_tamano = "formula",
    marco = list(universo_bruto = N, marco_validado = N, marco_contactable = N,
                 estado = "validado", estratos = estratos),
    parametros = list(z = 1.96, p = .5, e = e, deff = 1, oversample_pct = os,
                      tasa_respuesta = tasa, tasa_elegibilidad = 1, tasa_contacto = 1,
                      n_minimo_estrato = 0L, asignacion = asignacion)
  )
}

test_that("L3: MAS topado en el marco publica el margen de las 600 completas esperadas", {
  r <- calc_muestra_calcular_componente(.mt_comp())
  expect_identical(as.integer(r$n_objetivo), 697L)
  expect_identical(as.integer(r$n_operativo), 2000L)
  expect_equal(r$n_completas_esperadas, 600)
  a_mano <- 1.96 * sqrt(.25 * (2000 - 600) / (600 * 1999))
  expect_equal(r$precision_alcanzada, a_mano, tolerance = 1e-9)
  expect_match(r$advertencia, "se esperan 600 completas de las 697", fixed = TRUE)
  expect_match(r$advertencia, "±3.3", fixed = TRUE)
})

test_that("L3: sin tope el margen sigue saliendo del n de la fórmula", {
  r <- calc_muestra_calcular_componente(.mt_comp(e = .05, tasa = .7))
  expect_identical(as.integer(r$n_objetivo), 323L)
  expect_identical(as.integer(r$n_operativo), 509L)
  expect_equal(r$precision_alcanzada, calc_e_desde_n_muestra(323, 2000, .5, 1.96, 1))
  expect_null(r$n_completas_esperadas)
})

test_that("L3: el estratificado topado mide el error con las completas esperadas por estrato", {
  est <- c(list(list(label = "A", N = 101L)),
           lapply(LETTERS[2:7], function(l) list(label = l, N = 1L)))
  r <- calc_muestra_calcular_componente(
    .mt_comp(tecnica = "prob_estratificado", N = 107L, e = .05, tasa = .7, estratos = est))
  campo <- vapply(r$distribucion_estratos, `[[`, integer(1), "n_campo")
  n_h <- vapply(r$distribucion_estratos, `[[`, integer(1), "n")
  esperadas <- pmin(n_h, campo * .7)
  expect_equal(r$n_completas_esperadas, sum(esperadas))
  expect_lt(r$n_completas_esperadas, as.integer(r$n_objetivo))
  expect_gt(r$precision_alcanzada, .05)
  expect_match(r$advertencia, "Abordando el marco completo se esperan", fixed = TRUE)
})

test_that("L3: la memoria dice con cuántas completas se mide el margen", {
  comp <- calc_muestra_normalize_componente(.mt_comp())
  r <- calc_muestra_calcular_componente(comp)
  m <- calc_muestra_general_memoria(comp, r)
  fila <- m[grepl("^Margen", m$paso), ]
  expect_match(fila$sustitucion, "600 completas esperadas", fixed = TRUE)
})
