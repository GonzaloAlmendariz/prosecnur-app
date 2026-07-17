# F2 — MC de transparencia con engines de diseño prescrito.
#
# Con todo engine salvo pool_controlado, pi_final = pi_design es exacta y
# deterministica: el Monte Carlo solo llenaba la columna pi_mc "de
# transparencia". Correr 500 selecciones completas por default para una
# columna informativa congelaba la via sincrona sin aporte metodologico.
# Fix: mc_runs = 0 por default con diseño prescrito (pi_mc va NA con nota);
# la transparencia queda OPT-IN via selector$mc_prescribed_transparency.
# pool_controlado NO cambia: sus pi solo pueden estimarse por simulacion.

.mc_prescrito_base <- function() {
  data.frame(
    student_id = paste0("s", 1:60),
    aula_id = rep(paste0("A", 1:10), each = 6),
    curso_id = rep(paste0("C", 1:10), each = 6),
    curso = rep(paste("Curso", 1:10), each = 6),
    horario = rep(c("manana", "tarde", "noche"), length.out = 60),
    facultad = rep(c("FAC1", "FAC2"), each = 30),
    programa = rep(c("P1", "P2", "P3"), length.out = 60),
    sexo = rep(c("F", "M"), length.out = 60),
    edad = 20,
    condicion = "regular",
    nivel = rep(c("1", "2"), length.out = 60),
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
}

.mc_prescrito_cfg <- function(engine, ...) {
  selector <- list(
    seed = 99L,
    n_aulas = 3L,
    replacement_waves = 1L,
    selector_engine = engine,
    strata_cols = list("faculty"),
    balance_vars = list("faculty", "program"),
    monte_carlo_n = 25L,
    simulation_runs = 25L
  )
  overrides <- list(...)
  if (length(overrides)) selector <- utils::modifyList(selector, overrides)
  calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = selector
  ))
}

test_that(".cm_aulas_seleccionar_mc_runs: 0 por default con prescrito, completo con pool, opt-in transparente", {
  sel_prescrito <- .mc_prescrito_cfg("cube_balanceado")$selector
  expect_equal(prosecnurapp:::.cm_aulas_seleccionar_mc_runs(sel_prescrito, "cube_balanceado"), 0L)
  expect_equal(prosecnurapp:::.cm_aulas_seleccionar_mc_runs(sel_prescrito, "sistematico_pps"), 0L)
  expect_equal(prosecnurapp:::.cm_aulas_seleccionar_mc_runs(sel_prescrito, "estratificado_aleatorio"), 0L)

  # pool_controlado conserva la semantica historica: max(simulation_runs, monte_carlo_n).
  expect_equal(prosecnurapp:::.cm_aulas_seleccionar_mc_runs(sel_prescrito, "pool_controlado"), 25L)

  # Opt-in explicito: el usuario pide la columna pi_mc de transparencia.
  sel_optin <- .mc_prescrito_cfg("cube_balanceado", mc_prescribed_transparency = TRUE)$selector
  expect_true(isTRUE(sel_optin$mc_prescribed_transparency))
  expect_equal(prosecnurapp:::.cm_aulas_seleccionar_mc_runs(sel_optin, "cube_balanceado"), 25L)
})

test_that("seleccion con engine prescrito omite el MC: mc_runs 0, pi_mc NA con nota y pesos intactos", {
  cfg <- .mc_prescrito_cfg("cube_balanceado")
  frame <- calc_muestra_aulas_construir(base_madre = .mc_prescrito_base(), config = cfg)
  selection <- calc_muestra_aulas_seleccionar(frame, cfg)
  df <- selection$selection

  expect_true(all(df$probability_source[df$sample_role != "extra_reserve_pool"] == "prescribed_design"))
  expect_equal(unique(df$mc_runs), 0L)
  expect_true(all(is.na(df$pi_mc)))
  # Nota honesta en la celda de error MC y en la metodologia.
  expect_match(unique(df$mc_error_summary)[[1]], "MC de transparencia omitido")
  expect_match(selection$methodology$monte_carlo, "MC de transparencia omitido")

  # Invariante metodologico intacto: pi_final = pi_design y pesos finitos.
  core <- df[df$sample_role != "extra_reserve_pool", , drop = FALSE]
  expect_equal(core$pi_final, core$pi_design)
  expect_true(all(is.finite(core$pi_final) & core$pi_final > 0))
  expect_true(all(is.finite(core$weight_classroom) & core$weight_classroom > 0))
})

test_that("el opt-in de transparencia ejecuta el MC con las corridas solicitadas", {
  cfg <- .mc_prescrito_cfg("cube_balanceado", mc_prescribed_transparency = TRUE)
  frame <- calc_muestra_aulas_construir(base_madre = .mc_prescrito_base(), config = cfg)
  selection <- calc_muestra_aulas_seleccionar(frame, cfg)
  df <- selection$selection

  expect_equal(unique(df$mc_runs), 25L)
  # pi_mc estimada (finita) para las aulas del plan; pi_final sigue prescrita.
  core <- df[df$sample_role != "extra_reserve_pool", , drop = FALSE]
  expect_true(any(is.finite(core$pi_mc)))
  expect_equal(core$pi_final, core$pi_design)
  expect_match(unique(df$mc_error_summary)[[1]], "^max_se=")
})

test_that("pool_controlado conserva su MC posterior a la optimizacion", {
  cfg <- .mc_prescrito_cfg("pool_controlado", candidate_pool_size = 15L, monte_carlo_n = 8L, simulation_runs = 8L)
  frame <- calc_muestra_aulas_construir(base_madre = .mc_prescrito_base(), config = cfg)
  selection <- calc_muestra_aulas_seleccionar(frame, cfg)
  df <- selection$selection

  core <- df[df$sample_role != "extra_reserve_pool", , drop = FALSE]
  expect_true(all(core$probability_source == "monte_carlo_after_optimization"))
  expect_equal(unique(df$mc_runs), 8L)
  expect_true(all(is.finite(core$pi_final) & core$pi_final > 0))
})
