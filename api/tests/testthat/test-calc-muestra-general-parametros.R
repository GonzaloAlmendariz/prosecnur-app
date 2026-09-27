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
  base$promedio_conglomerado <- 25; base$asignacion <- "proporcional"
  otro <- list(z = 2.576, p = .3, e = .08, deff = 2.5, tasa_respuesta = .5, oversample_pct = .3,
               cobertura_objetivo = .8, n_minimo_estrato = 60L, tope_operativo = 90L,
               tasa_contacto = .4, tasa_elegibilidad = .6, tau = .4,
               promedio_conglomerado = 40, asignacion = "neyman")
  escenarios <- list(
    sin_estratos = list(),
    grandes = list(list(label = "A", N = 2500L), list(label = "B", N = 1400L), list(label = "C", N = 100L)),
    chicos = list(list(label = "A", N = 40L), list(label = "B", N = 70L), list(label = "C", N = 3890L)),
    # Con p por estrato la asignación mueve el n (Neyman); lo agregó el
    # verificador de E3/E7: el test original nunca la perturbaba.
    con_p = list(list(label = "A", N = 2500L, p_facultad = .05), list(label = "B", N = 1400L, p_facultad = .4),
                 list(label = "C", N = 100L, p_facultad = .7))
  )
  tecnicas <- c("prob_aleatorio_simple", "sistematico", "prob_estratificado", "intencion_censal",
                "barrido", "no_prob_cuotas", "no_prob_conveniencia", "listado_externo_meta_fija")
  for (t in tecnicas) for (esc in names(escenarios)) for (meta in c(0L, 150L, 900L)) {
    mk <- function(par) calc_muestra_normalize_componente(list(
      tecnica = t, actor = "x", actor_id = "x", origen_tamano = "formula",
      marco = list(universo_bruto = 4000L, marco_validado = 4000L, marco_contactable = 4000L,
                   estado = "validado", estratos = escenarios[[esc]]),
      parametros = par, meta = list(valor = meta)))
    b <- .firma(calc_muestra_calcular_componente(mk(base)))
    for (k in names(otro)) {
      p2 <- base; p2[[k]] <- otro[[k]]
      mueve <- !identical(.firma(calc_muestra_calcular_componente(mk(p2))), b)
      if (mueve) expect_true(k %in% .CM_PARAMETROS_POR_TECNICA[[t]],
                             info = sprintf("%s mueve «%s» (escenario %s, meta %d) y no está declarado", k, t, esc, meta))
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
  expect_identical(unlist(a$opciones), c("proporcional", "neyman", "potencia"))
  # Las únicas opciones del estratificado son la asignación y qué se estima
  # (proporción o media, H21); el resto son números.
  opciones <- vapply(Filter(function(p) identical(p$tipo, "opciones"), ps), `[[`, "", "clave")
  expect_setequal(opciones, c("asignacion", "tipo_indicador"))
})

test_that("HTTP: /api/calc-muestra/tecnicas/parametros publica el catálogo", {
  srv <- http_contract_server()
  sid <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))$json$session_id
  r <- http_get(srv, "/api/calc-muestra/tecnicas/parametros", sid = sid)
  expect_identical(r$status, 200L)
  tecs <- vapply(r$json$tecnicas, `[[`, "", "tecnica")
  expect_true(all(c("prob_aleatorio_simple", "prob_estratificado", "barrido") %in% tecs))
  est <- r$json$tecnicas[[which(tecs == "prob_estratificado")]]$parametros
  asig <- Filter(function(p) identical(p$clave, "asignacion"), est)[[1]]
  expect_identical(asig$tipo, "opciones")
  expect_identical(unlist(asig$opciones), c("proporcional", "neyman", "potencia"))
})

test_that("L7: las ayudas escriben el decimal con punto, como la pantalla (es-PE)", {
  for (tec in names(.CM_PARAMETROS_POR_TECNICA)) {
    for (p in calc_muestra_parametros_tecnica(tec)$parametros) {
      expect_false(grepl("[0-9],[0-9]", p$ayuda), info = sprintf("%s · %s: %s", tec, p$clave, p$ayuda))
    }
  }
})

test_that("L22: un piso, tope, tau o tamaño medio fuera de rango se corrige con aviso, no en silencio", {
  # -5 en el piso se volvía 30 sin decirlo: el reparto cambiaba a escondidas.
  for (k in c("n_minimo_estrato", "tope_operativo", "tau", "promedio_conglomerado")) {
    comp <- calc_muestra_normalize_componente(list(tecnica = "prob_estratificado",
                                                   parametros = setNames(list(-5), k)))
    avisos <- vapply(comp$avisos_parametros %||% list(), function(a) a$param, "")
    expect_true(k %in% avisos, info = sprintf("%s = -5 → %s sin aviso", k, format(comp$parametros[[k]])))
  }
})
