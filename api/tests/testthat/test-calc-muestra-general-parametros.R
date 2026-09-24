# G2: la tabla de parámetros por técnica no puede esconder uno que importe.
# Para cada técnica del motor general se perturba cada parámetro en varios
# escenarios (con y sin estratos, estratos chicos que activan pisos y topes) y
# todo el que cambie el resultado debe estar declarado.

.firma <- function(r) {
  paste(c(unlist(r[c("n_teorico", "n_objetivo", "n_operativo", "precision_alcanzada",
                     "unidades_operativas", "cobertura_objetivo", "tasa_respuesta_esperada")]),
          unlist(lapply(r$distribucion_estratos, `[[`, "n")),
          unlist(lapply(r$cuotas_matriz, `[[`, "n"))), collapse = "|")
}

test_that("todo parámetro que mueve el resultado está declarado para su técnica", {
  base <- list(z = 1.96, p = .5, e = .05, deff = 1.2, tasa_respuesta = .9, oversample_pct = .1,
               cobertura_objetivo = .5, n_minimo_estrato = 10L, tope_operativo = 400L,
               tasa_contacto = .9, tasa_elegibilidad = .9, tau = .7)
  otro <- list(z = 2.576, p = .3, e = .08, deff = 2.5, tasa_respuesta = .5, oversample_pct = .3,
               cobertura_objetivo = .8, n_minimo_estrato = 60L, tope_operativo = 90L,
               tasa_contacto = .4, tasa_elegibilidad = .6, tau = .4)
  escenarios <- list(
    sin_estratos = list(),
    grandes = list(list(label = "A", N = 2500L), list(label = "B", N = 1400L), list(label = "C", N = 100L)),
    chicos = list(list(label = "A", N = 40L), list(label = "B", N = 70L), list(label = "C", N = 3890L))
  )
  tecnicas <- c("prob_aleatorio_simple", "sistematico", "prob_estratificado", "intencion_censal",
                "barrido", "no_prob_cuotas", "no_prob_conveniencia", "listado_externo_meta_fija")
  for (t in tecnicas) for (esc in names(escenarios)) {
    mk <- function(par) calc_muestra_normalize_componente(list(
      tecnica = t, actor = "x", actor_id = "x", origen_tamano = "formula",
      marco = list(universo_bruto = 4000L, marco_validado = 4000L, marco_contactable = 4000L,
                   estado = "validado", estratos = escenarios[[esc]]),
      parametros = par, meta = list(valor = 0)))
    b <- .firma(calc_muestra_calcular_componente(mk(base)))
    for (k in names(otro)) {
      p2 <- base; p2[[k]] <- otro[[k]]
      mueve <- !identical(.firma(calc_muestra_calcular_componente(mk(p2))), b)
      if (mueve) expect_true(k %in% .CM_PARAMETROS_POR_TECNICA[[t]],
                             info = sprintf("%s mueve «%s» (escenario %s) y no está declarado", k, t, esc))
    }
  }
})

test_that("cada parámetro declarado tiene rótulo y ayuda", {
  for (t in names(.CM_PARAMETROS_POR_TECNICA)) {
    for (p in calc_muestra_parametros_tecnica(t)$parametros) {
      expect_true(nzchar(p$rotulo) && nzchar(p$ayuda), info = paste(t, p$clave))
    }
  }
  expect_false("deff" %in% .CM_PARAMETROS_POR_TECNICA$prob_aleatorio_simple)
})

test_that("la asignación del estratificado se declara como opciones proporcional/neyman", {
  ps <- calc_muestra_parametros_tecnica("prob_estratificado")$parametros
  a <- Filter(function(p) identical(p$clave, "asignacion"), ps)[[1]]
  expect_identical(a$tipo, "opciones")
  expect_identical(unlist(a$opciones), c("proporcional", "neyman"))
  expect_true(all(vapply(Filter(function(p) p$clave != "asignacion", ps), `[[`, "", "tipo") == "numero"))
})
