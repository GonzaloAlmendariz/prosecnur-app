# F1 — Ventana sincrona 100-499 aulas sin presupuesto Monte Carlo.
#
# El gate de job usaba SOLO n de aulas (>= 500) y los presupuestos MC solo se
# activaban con n > 1200: un marco de 100-499 aulas ejecutaba 4 metodos x 500
# corridas sincronas y congelaba plumber por minutos, sin progreso ni
# cancelacion. El fix presupuesta por COSTO (aulas x corridas x metodos):
#   1. `.cm_aulas_simulation_budget` / `.cm_aulas_mc_final_budget` recortan por
#      costo total, tambien en la ventana media (via sincrona incluida).
#   2. El router decide sync vs job con `.cm_aulas_run_as_job` (n de aulas O
#      costo estimado), asi que un pedido caro pasa a modo job aunque el marco
#      sea chico.
# Estrategia de test identica a test-calc-muestra-aulas-mc-budget.R: las
# funciones de presupuesto/costo son deterministicas y se verifican directo;
# correr el comparador real a 450 aulas x 133 corridas seria inviable en CI.

.costo_sync_base <- function(n_aulas, per_class = 4L) {
  n <- n_aulas * per_class
  aula <- rep(seq_len(n_aulas), each = per_class)
  data.frame(
    student_id = paste0("s", seq_len(n)),
    aula_id = paste0("A", aula),
    curso_id = paste0("C", aula),
    curso = paste("Curso", aula),
    horario = rep(c("manana", "tarde", "noche"), length.out = n),
    facultad = paste0("FAC", (aula %% 6L) + 1L),
    programa = paste0("P", (aula %% 12L) + 1L),
    sexo = rep(c("F", "M"), length.out = n),
    edad = 20,
    condicion = "regular",
    nivel = as.character((aula %% 2L) + 1L),
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
}

test_that("los presupuestos MC recortan por COSTO tambien en la ventana 100-499 aulas", {
  # Antes: n <= 1200 devolvia lo solicitado siempre -> 450 aulas x 500 corridas
  # corrian completas. Ahora el criterio es costo total (n x corridas).
  expect_lt(prosecnurapp:::.cm_aulas_simulation_budget(450L, 500L), 500L)
  expect_equal(prosecnurapp:::.cm_aulas_simulation_budget(450L, 500L), 133L) # 60000 %/% 450
  expect_lt(prosecnurapp:::.cm_aulas_mc_final_budget(450L, 500L), 500L)
  expect_equal(prosecnurapp:::.cm_aulas_mc_final_budget(450L, 500L), 333L)   # 150000 %/% 450

  # Costos chicos intactos (goldens historicos: marcos chicos, pocas corridas).
  expect_equal(prosecnurapp:::.cm_aulas_simulation_budget(120L, 40L), 40L)
  expect_equal(prosecnurapp:::.cm_aulas_simulation_budget(30L, 500L), 500L)  # 15000 <= 60000
  expect_equal(prosecnurapp:::.cm_aulas_simulation_budget(800L, 40L), 40L)
  expect_equal(prosecnurapp:::.cm_aulas_mc_final_budget(800L, 40L), 40L)
  expect_equal(prosecnurapp:::.cm_aulas_mc_final_budget(280L, 500L), 500L)   # 140000 <= 150000

  # Marcos > 1200: formula historica byte-identica (60000/n, piso 10; 150000/n, piso 50).
  expect_equal(prosecnurapp:::.cm_aulas_simulation_budget(3000L, 500L), 20L)
  expect_equal(prosecnurapp:::.cm_aulas_mc_final_budget(3000L, 500L), 50L)
  expect_equal(prosecnurapp:::.cm_aulas_simulation_budget(1300L, 500L), 46L)
})

test_that("el costo estimado del comparador usa corridas PRESUPUESTADAS x metodos x olas", {
  cfg <- calc_muestra_aulas_normalize_config(list(
    selector = list(replacement_waves = 11L, simulation_runs = 500L)
  ))
  # 4 metodos default; runs presupuestadas a 133 a n=450; olas = 12.
  costo <- prosecnurapp:::.cm_aulas_comparar_estimated_cost(450L, cfg)
  expect_equal(costo, 450 * 4 * (12 + 133))
  # simulation_runs explicito del body pisa el del selector.
  costo_chico <- prosecnurapp:::.cm_aulas_comparar_estimated_cost(450L, cfg, simulation_runs = 10L)
  expect_equal(costo_chico, 450 * 4 * (12 + 10))
  # Subconjunto de metodos reduce el costo proporcionalmente.
  costo_1m <- prosecnurapp:::.cm_aulas_comparar_estimated_cost(450L, cfg, methods = "sistematico_pps")
  expect_equal(costo_1m, 450 * 1 * (12 + 133))
})

test_that("el costo estimado del sorteo final colapsa con engines prescritos y crece con pool_controlado", {
  cfg_prescrito <- calc_muestra_aulas_normalize_config(list(
    selector = list(selector_engine = "cube_balanceado", replacement_waves = 11L, monte_carlo_n = 500L)
  ))
  # F2: prescrito -> mc_runs = 0 -> costo = una sola seleccion del plan de olas.
  expect_equal(prosecnurapp:::.cm_aulas_seleccionar_estimated_cost(450L, cfg_prescrito), 450 * 12 * 1)

  cfg_pool <- calc_muestra_aulas_normalize_config(list(
    selector = list(selector_engine = "pool_controlado", replacement_waves = 11L,
                    monte_carlo_n = 500L, simulation_runs = 500L)
  ))
  # pool_controlado exige MC (presupuestado a 333 a n=450) -> costo alto.
  expect_equal(prosecnurapp:::.cm_aulas_seleccionar_estimated_cost(450L, cfg_pool), 450 * 12 * (1 + 333))
})

test_that("el gate sync/job dispara por n de aulas O por costo estimado", {
  umbral_costo <- prosecnurapp:::.cm_aulas_job_cost_threshold()
  expect_equal(umbral_costo, 150000)
  # n >= 500: job siempre (contrato historico, env PULSO_CALC_MUESTRA_JOB_THRESHOLD).
  expect_true(prosecnurapp:::.cm_aulas_run_as_job(500L, 0))
  # Ventana media con costo caro: job aunque n < 500 (el bug F1).
  expect_true(prosecnurapp:::.cm_aulas_run_as_job(450L, umbral_costo + 1))
  # Ventana media con pedido liviano: sigue sync.
  expect_false(prosecnurapp:::.cm_aulas_run_as_job(450L, umbral_costo))
  expect_false(prosecnurapp:::.cm_aulas_run_as_job(30L, 30 * 4 * (12 + 100)))
})

test_that("marco sintetico de ~450 aulas con 500 corridas queda presupuestado Y va a modo job", {
  # Contrato F1: "las corridas efectivas deben quedar presupuestadas (< 500) o
  # la respuesta pasar a modo job" — aqui pasan AMBAS cosas.
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(
      seed = 7L, n_aulas = 30L, replacement_waves = 11L,
      strata_cols = list("faculty"), simulation_runs = 500L, monte_carlo_n = 500L
    )
  ))
  frame <- calc_muestra_aulas_construir(base_madre = .costo_sync_base(450L), config = cfg)
  frame_n <- prosecnurapp:::.cm_aulas_frame_n(frame)
  expect_gte(frame_n, 100L)
  expect_lt(frame_n, 500L) # dentro de la ventana del bug (bajo el umbral por n)

  # 1) Las corridas efectivas quedan presupuestadas (< 500) en CUALQUIER via.
  expect_lt(prosecnurapp:::.cm_aulas_simulation_budget(frame_n, 500L), 500L)

  # 2) Y el router ya no elige la via sincrona: el costo estimado supera el
  #    umbral -> respuesta {mode: "job", job_id} con progreso y cancelacion.
  costo <- prosecnurapp:::.cm_aulas_comparar_estimated_cost(frame_n, frame$config, simulation_runs = 500L)
  expect_true(prosecnurapp:::.cm_aulas_run_as_job(frame_n, costo))
})
