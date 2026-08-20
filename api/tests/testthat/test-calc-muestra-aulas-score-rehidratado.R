# Score sobre marco rehidratado — el defecto medido el 2026-08-20: la
# persistencia no guarda `population` (derivable) y las dimensiones "student"
# del objetivo caian a la via por-aula EN SILENCIO (47,9 vs 68,6 con las
# mismas 197 filas). El score debe DECLARARLO, no callar.

.mk_base <- function() {
  data.frame(
    student_id = paste0("s", 1:80),
    aula_id = rep(paste0("A", 1:4), each = 20),
    curso_id = rep(paste0("C", 1:4), each = 20),
    curso = rep(paste("Curso", 1:4), each = 20),
    horario = "L 8", facultad = rep(c("FAC1", "FAC2"), each = 40),
    programa = "P1", sexo = rep(c("F", "M"), 40),
    edad = 20, condicion = "regular", nivel = "3", modalidad = "presencial",
    stringsAsFactors = FALSE
  )
}

test_that("el score sin population DECLARA que no es comparable", {
  skip_if_not_installed("sampling")
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(seed = 77L, n_aulas = 2L, replacement_waves = 0L,
                    selector_engine = "sistematico_pps", strata_cols = list("facultad"),
                    monte_carlo_n = 0L, simulation_runs = 0L)
  ))
  frame <- calc_muestra_aulas_construir(base_madre = .mk_base(), config = cfg)
  sel <- calc_muestra_aulas_seleccionar(frame, cfg)

  # CONTROL: con population presente, ningun aviso de rehidratado.
  con <- calc_muestra_aulas_representativity_objective(frame, sel$selection, cfg$selector, cfg$objective)
  expect_false(any(grepl("rehidratado sin population", unlist(con$warnings))))

  # El mutante que este test mata: quitar population (lo que hace la
  # persistencia) y esperar el aviso estructurado.
  frame_rehidratado <- frame
  frame_rehidratado$population <- NULL
  sin <- calc_muestra_aulas_representativity_objective(frame_rehidratado, sel$selection, cfg$selector, cfg$objective)
  expect_true(any(grepl("rehidratado sin population", unlist(sin$warnings))))
  expect_true(any(grepl("NO es comparable", unlist(sin$warnings))))
})
