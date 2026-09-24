# Rejilla de casos del motor general de Cálculo de muestra (Muestra general y
# Acreditación) contra la aritmética a mano de
# docs/qa/research-calc-muestra-robustez-2026-09-23.md, sección (b).
#
# B1 es el contrato de la fórmula y pasó desde el primer día. B3 fija H03
# (la no respuesta no inflaba n) y H05 (n a campo por encima de N): nació en
# rojo y se puso verde con `.cm_general_inflar_operativo`. Los rojos de H01,
# H02, H04 y H07 se suman aquí con el commit de su fix.
#
# Alcance deliberado: el reparto que se prueba es `.cm_distribuir_con_piso`,
# que sólo consumen el estratificado y la matriz de servicios del motor general.
# El conglomerado y `calc_muestra_distribucion.R` alimentan aulas y quedan con
# el reparto legacy hasta que Gonzalo decida lo contrario.

.rejilla_comp <- function(tecnica = "prob_aleatorio_simple", N = 1000L,
                          parametros = list(), estratos = list(), meta = NULL) {
  base_par <- list(z = 1.96, p = 0.5, e = 0.05, deff = 1, oversample_pct = 0,
                   tasa_respuesta = 1, tasa_elegibilidad = 1, tasa_contacto = 1,
                   n_minimo_estrato = 0L)
  par <- utils::modifyList(base_par, parametros)
  comp <- list(
    actor = "Rejilla", actor_id = "rejilla", actor_categoria = "otros",
    tecnica = tecnica, origen_tamano = "formula",
    marco = list(universo_bruto = N, marco_validado = N, marco_contactable = N,
                 estado = "validado", estratos = estratos),
    parametros = par
  )
  if (!is.null(meta)) comp$meta <- meta
  comp
}

.rejilla_calc <- function(...) calc_muestra_calcular_componente(.rejilla_comp(...))

.rejilla_estratos <- function(N_h) {
  lapply(seq_along(N_h), function(i) list(id = paste0("e", i), label = paste0("E", i), N = N_h[[i]]))
}

# --- B1 · tamaño base (R1) --------------------------------------------------

test_that("B1: calc_n_muestra cuadra con Cochran + FPC (n0−1)/N en 18 casos a mano", {
  casos <- list(
    list(N = Inf,   p = .5,  e = .05,  z = 1.96,  deff = 1,   n = 385L),
    list(N = 1e6,   p = .5,  e = .05,  z = 1.96,  deff = 1,   n = 385L),
    list(N = 1000,  p = .5,  e = .05,  z = 1.96,  deff = 1,   n = 278L),
    list(N = 30,    p = .5,  e = .05,  z = 1.96,  deff = 1,   n = 28L),
    list(N = 500,   p = .5,  e = .10,  z = 1.96,  deff = 1,   n = 81L),
    list(N = Inf,   p = .05, e = .05,  z = 1.96,  deff = 1,   n = 73L),
    list(N = 10000, p = .05, e = .01,  z = 1.96,  deff = 1,   n = 1544L),
    list(N = Inf,   p = .5,  e = .05,  z = 2.576, deff = 1,   n = 664L),
    list(N = Inf,   p = .5,  e = .05,  z = 1.645, deff = 1,   n = 271L),
    list(N = Inf,   p = .5,  e = .05,  z = 1.96,  deff = 2,   n = 769L),
    list(N = 5000,  p = .5,  e = .05,  z = 1.96,  deff = 1.5, n = 517L),
    list(N = 3001,  p = .5,  e = .025, z = 1.96,  deff = 2,   n = 1519L),
    list(N = 1,     p = .5,  e = .05,  z = 1.96,  deff = 1,   n = 1L),
    list(N = 2,     p = .5,  e = .05,  z = 1.96,  deff = 1,   n = 2L),
    list(N = Inf,   p = .5,  e = .03,  z = 1.96,  deff = 1,   n = 1068L),
    list(N = 10000, p = .5,  e = .03,  z = 1.96,  deff = 1,   n = 965L),
    list(N = 200,   p = .3,  e = .05,  z = 1.96,  deff = 1,   n = 124L),
    list(N = 30,    p = .5,  e = .05,  z = 1.96,  deff = 2,   n = 29L)
  )
  for (k in seq_along(casos)) {
    cs <- casos[[k]]
    got <- calc_n_muestra(N = cs$N, p = cs$p, z = cs$z, e = cs$e, deff = cs$deff)
    expect_identical(as.integer(got), cs$n, info = sprintf("caso B1-%d", k))
  }
})

test_that("B1: el MAS del componente devuelve el mismo n teórico que la fórmula", {
  r <- .rejilla_calc(N = 5000L)
  expect_identical(as.integer(r$n_teorico), 357L)
  expect_identical(as.integer(r$n_objetivo), 357L)
})

# --- B3 · inflación por no respuesta y tope N (H03, H05) --------------------

test_that("B3-23: con tasa de respuesta 0.6 el MAS sale a campo con ⌈278/0.6⌉ = 464", {
  r <- .rejilla_calc(N = 1000L, parametros = list(tasa_respuesta = 0.6))
  expect_identical(as.integer(r$n_objetivo), 278L)
  expect_identical(as.integer(r$n_operativo), 464L)
})

test_that("B3-24: N grande con respuesta 0.63 → ⌈385/0.63⌉ = 612", {
  r <- .rejilla_calc(N = 1000000L, parametros = list(tasa_respuesta = 0.63))
  expect_identical(as.integer(r$n_operativo), 612L)
})

test_that("B3: el estratificado también infla por no respuesta", {
  r <- .rejilla_calc(tecnica = "prob_estratificado", N = 5000L,
                     parametros = list(tasa_respuesta = 0.6),
                     estratos = .rejilla_estratos(c(3000L, 2000L)))
  expect_identical(as.integer(r$n_objetivo), 357L)
  expect_identical(as.integer(r$n_operativo), 595L)
})

test_that("B3-25/26: n operativo nunca supera N (censo)", {
  r25 <- .rejilla_calc(N = 30L, parametros = list(tasa_respuesta = 0.6))
  expect_lte(as.integer(r25$n_operativo), 30L)
  r26 <- .rejilla_calc(N = 30L, parametros = list(oversample_pct = 0.10))
  expect_lte(as.integer(r26$n_operativo), 30L)
  # El tope se declara: quien lee el resultado sabe que es un censo del marco.
  expect_match(r25$advertencia, "censo del marco")
  expect_identical(as.integer(r25$n_operativo), 30L)
})
