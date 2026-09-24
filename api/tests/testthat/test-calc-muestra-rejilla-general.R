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

# --- B4 · reparto entre estratos (H01, H02) ---------------------------------

test_that("B4-27: proporcional por mayor resto (Hamilton), empates por orden", {
  expect_identical(as.integer(.cm_distribuir_con_piso(370L, c(4000L, 3500L, 2500L))),
                   c(148L, 130L, 92L))
})

test_that("B4-28: 10 sobre tres estratos iguales reparte 4,3,3 (el legacy daba 2,4,4)", {
  expect_identical(as.integer(.cm_distribuir_con_piso(10L, c(100L, 100L, 100L))), c(4L, 3L, 3L))
  # Con N_h = (1,1,1) el tope manda: 10 no caben en 3 personas, es un censo.
  expect_identical(as.integer(.cm_distribuir_con_piso(10L, c(1L, 1L, 1L))), c(1L, 1L, 1L))
})

test_that("B4: si los pisos no caben en n, no se aplican y se declara", {
  x <- .cm_distribuir_con_piso(50L, c(1000L, 1000L, 1000L), piso = 30L)
  expect_identical(sum(as.integer(x)), 50L)
  expect_true(isTRUE(attr(x, "piso_incumplible")))
})

test_that("B4-29: 5 sobre (100,1×6) suma 5 y no vacía al estrato del 94 %", {
  x <- as.integer(.cm_distribuir_con_piso(5L, c(100L, rep(1L, 6))))
  expect_identical(sum(x), 5L)
  expect_identical(x, c(5L, rep(0L, 6)))
})

test_that("B4-30/31: el piso nunca excede N_h; el excedente se redistribuye", {
  expect_identical(as.integer(.cm_distribuir_con_piso(300L, c(20L, 1000L, 1000L), piso = 30L)),
                   c(20L, 140L, 140L))
  expect_identical(as.integer(.cm_distribuir_con_piso(100L, c(20L, 1000L, 1000L), piso = 30L)),
                   c(20L, 40L, 40L))
})

test_that("B4: invariantes del reparto en 200 marcos aleatorios (suma exacta, 0 ≤ n_h ≤ N_h)", {
  set.seed(20260924)
  for (k in seq_len(200)) {
    H <- sample(2:8, 1)
    N_h <- as.integer(sample(c(1:5, 10:50, 100:3000), H, replace = TRUE))
    n <- as.integer(sample(1:sum(N_h), 1))
    piso <- sample(c(0L, 2L, 30L), 1)
    x <- as.integer(.cm_distribuir_con_piso(n, N_h, piso = piso))
    info <- sprintf("k=%d n=%d piso=%d N_h=%s -> %s", k, n, piso,
                    paste(N_h, collapse = ","), paste(x, collapse = ","))
    expect_identical(sum(x), n, info = info)
    expect_true(all(x >= 0L & x <= N_h), info = info)
  }
})

test_that("B4: el estratificado rotula censo y piso por estrato y avisa el piso que no cabe", {
  r <- .rejilla_calc(tecnica = "prob_estratificado", N = 2020L,
                     parametros = list(n_minimo_estrato = 30L),
                     estratos = .rejilla_estratos(c(20L, 1000L, 1000L)))
  reglas <- vapply(r$distribucion_estratos, `[[`, character(1), "regla")
  ns <- vapply(r$distribucion_estratos, `[[`, integer(1), "n")
  expect_identical(sum(ns), as.integer(r$n_objetivo))
  expect_identical(ns[[1]], 20L)
  expect_identical(reglas[[1]], "censo_estrato")
  chico <- .rejilla_calc(tecnica = "prob_estratificado", N = 3000L,
                         parametros = list(n_minimo_estrato = 200L, e = 0.10),
                         estratos = .rejilla_estratos(c(1000L, 1000L, 1000L)))
  expect_match(chico$advertencia, "no cabe")
})

# --- H07 · deff por defecto en diseños de elementos -------------------------

test_that("H07: el estratificado de elementos no inventa deff 1.5 cuando no se declaró", {
  comp <- .rejilla_comp(tecnica = "prob_estratificado", N = 10000L,
                        estratos = .rejilla_estratos(c(6000L, 4000L)))
  comp$parametros$deff <- NULL
  r <- calc_muestra_calcular_componente(comp)
  expect_identical(as.integer(r$n_teorico), 370L)
})

test_that("H07: las técnicas de aulas conservan el deff 1.5 por defecto", {
  for (tec in c("prob_conglomerado_multietapico", "prob_estratificado_independiente")) {
    comp <- calc_muestra_normalize_componente(list(actor = "a", actor_id = "a", tecnica = tec))
    expect_identical(comp$parametros$deff, 1.5, info = tec)
  }
  comp <- calc_muestra_normalize_componente(list(actor = "a", actor_id = "a", tecnica = "prob_aleatorio_simple"))
  expect_identical(comp$parametros$deff, 1)
})

# --- B6 · entradas fuera de rango (H04, H20) --------------------------------
# La mesa guarda el estudio entero, así que un valor fuera de rango no se
# rechaza: se corrige y la corrección queda declarada en el componente y en el
# resultado. Lo que el research pedía evitar es que se corrija EN SILENCIO.

test_that("B6-36: e = 3 se corrige a 0.05 y se declara con la pista del porcentaje", {
  comp <- calc_muestra_normalize_componente(.rejilla_comp(parametros = list(e = 3)))
  avisos <- comp$avisos_parametros
  expect_length(avisos, 1L)
  expect_identical(avisos[[1]]$param, "e")
  expect_identical(avisos[[1]]$recibido, 3)
  expect_identical(avisos[[1]]$usado, 0.05)
  expect_match(avisos[[1]]$texto, "escribe 0.03", fixed = TRUE)
  r <- calc_muestra_calcular_componente(comp)
  expect_match(r$advertencia, "fuera de rango en margen de error")
  expect_length(r$avisos_parametros, 1L)
})

test_that("B6-37: p = 0 ya no da n = 0: se usa 0.5 y se declara", {
  r <- .rejilla_calc(parametros = list(p = 0))
  expect_identical(as.integer(r$n_teorico), 278L)
  expect_match(r$advertencia, "varianza es cero")
})

test_that("B6: el aviso vive mientras el valor siga siendo el corregido", {
  c1 <- calc_muestra_normalize_componente(.rejilla_comp(parametros = list(e = 3, deff = 0.8)))
  expect_setequal(vapply(c1$avisos_parametros, `[[`, character(1), "param"), c("e", "deff"))
  c2 <- calc_muestra_normalize_componente(c1)
  expect_length(c2$avisos_parametros, 2L)
  c2$parametros$e <- 0.03
  c3 <- calc_muestra_normalize_componente(c2)
  expect_identical(vapply(c3$avisos_parametros, `[[`, character(1), "param"), "deff")
})

test_that("B6: un parámetro válido no genera avisos", {
  comp <- calc_muestra_normalize_componente(.rejilla_comp())
  expect_length(comp$avisos_parametros, 0L)
})

