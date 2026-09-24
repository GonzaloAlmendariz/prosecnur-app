# Propiedad: ninguna técnica del motor general manda a campo más unidades que
# las que tiene el marco. El barrido que la formuló (2026-09-24) encontró dos
# violaciones: cuotas de docentes (275 con N = 251) y el listado externo
# (6.523 registros pedidos a un listado de 1.509).

test_that("en 2.000 componentes aleatorios de 8 técnicas, n a campo ≤ N", {
  set.seed(3)
  tecs <- c("prob_aleatorio_simple", "sistematico", "prob_estratificado", "intencion_censal",
            "barrido", "no_prob_cuotas", "no_prob_conveniencia", "listado_externo_meta_fija")
  for (k in 1:2000) {
    t <- sample(tecs, 1); N <- sample(c(5:60, 100:400, 1000:5000), 1)
    est <- if (runif(1) < .5) {
      H <- sample(2:5, 1); Nh <- as.integer(pmax(1, round(N * prop.table(runif(H)))))
      lapply(seq_len(H), function(i) list(label = paste0("E", i), N = Nh[i]))
    } else list()
    comp <- calc_muestra_normalize_componente(list(tecnica = t,
      marco = list(marco_validado = N, universo_bruto = N, marco_contactable = N, estado = "validado", estratos = est),
      parametros = list(e = sample(c(.03, .05, .1), 1), tasa_respuesta = runif(1, .2, 1),
                        oversample_pct = sample(c(0, .2, .5), 1), cobertura_objetivo = runif(1, .2, 1),
                        tasa_contacto = runif(1, .3, 1), tasa_elegibilidad = runif(1, .5, 1),
                        n_minimo_estrato = sample(c(0, 30), 1)),
      meta = list(valor = sample(c(0, 50, 500, 3000), 1))))
    r <- calc_muestra_calcular_componente(comp)
    op <- r$n_operativo %||% NA
    if (!is.na(op)) expect_lte(as.integer(op), N, label = sprintf("%s N=%d n_operativo", t, N))
  }
})

test_that("el listado que no alcanza la meta se contacta entero y dice cuántas completas esperar", {
  comp <- calc_muestra_normalize_componente(list(tecnica = "listado_externo_meta_fija",
    marco = list(marco_validado = 1000L, marco_contactable = 1000L, estado = "listado_externo"),
    parametros = list(tasa_contacto = .5, tasa_elegibilidad = .8, tasa_respuesta = .5),
    meta = list(valor = 400L)))
  r <- calc_muestra_calcular_componente(comp)
  # 400 / (.5·.8·.5) = 2.000 registros; el listado tiene 1.000 → 1.000·.2 = 200 completas.
  expect_identical(as.integer(r$n_operativo), 1000L)
  expect_identical(as.integer(r$meta_alcanzable), 200L)
  expect_match(r$advertencia, "no se alcanza con este listado")
})
