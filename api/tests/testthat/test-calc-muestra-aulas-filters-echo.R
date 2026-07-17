# W2 — Eco de filtros para frescura del marco (contrato UI).
#
# El marco construido expone en `frame$filters_echo` los filtros de criterio
# 7/8 NORMALIZADOS con los que se construyo, para que la UI marque "marco
# desactualizado" cuando el usuario cambie el criterio sin reconstruir.
# Clave estable para el frontend: frame.filters_echo con exactamente
# { require_min_prevalence, min_prevalence_pct, require_faculty_prevalence,
#   min_faculty_prevalence_pct, require_cycle_homogeneity,
#   min_cycle_homogeneity_pct }.

.filters_echo_base <- function() {
  data.frame(
    student_id = paste0("s", 1:40),
    aula_id = rep(paste0("A", 1:8), each = 5),
    curso_id = rep(paste0("C", 1:8), each = 5),
    curso = rep(paste("Curso", 1:8), each = 5),
    horario = rep(c("manana", "tarde"), length.out = 40),
    facultad = rep(c("FAC1", "FAC2"), each = 20),
    programa = rep(c("P1", "P2"), length.out = 40),
    sexo = rep(c("F", "M"), length.out = 40),
    edad = 20,
    condicion = "regular",
    nivel = "pregrado",
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
}

test_that("el marco ecoa los filtros efectivos del criterio 7/8 con los que se construyo", {
  cfg <- list(
    filters = list(
      min_eligible_per_class = 1L,
      require_min_prevalence = TRUE,
      min_prevalence_pct = 0.7,
      require_faculty_prevalence = TRUE,
      min_faculty_prevalence_pct = 0.85,
      require_cycle_homogeneity = TRUE,
      min_cycle_homogeneity_pct = 0.9
    ),
    selector = list(seed = 3L, n_aulas = 2L, replacement_waves = 0L,
                    strata_cols = list("faculty"), monte_carlo_n = 0L)
  )
  frame <- calc_muestra_aulas_construir(base_madre = .filters_echo_base(), config = cfg)

  echo <- frame$filters_echo
  expect_true(is.list(echo))
  expect_setequal(names(echo), c(
    "require_min_prevalence", "min_prevalence_pct",
    "require_faculty_prevalence", "min_faculty_prevalence_pct",
    "require_cycle_homogeneity", "min_cycle_homogeneity_pct"
  ))
  expect_true(isTRUE(echo$require_min_prevalence))
  expect_equal(echo$min_prevalence_pct, 0.7)
  expect_true(isTRUE(echo$require_faculty_prevalence))
  expect_equal(echo$min_faculty_prevalence_pct, 0.85)
  expect_true(isTRUE(echo$require_cycle_homogeneity))
  expect_equal(echo$min_cycle_homogeneity_pct, 0.9)

  # El eco refleja lo NORMALIZADO efectivo, no el input crudo: coincide con
  # los filtros de la config adjunta al marco.
  expect_equal(echo$min_faculty_prevalence_pct, frame$config$filters$min_faculty_prevalence_pct)
})

test_that("sin criterios activos el eco expone los defaults apagados", {
  cfg <- list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(seed = 3L, n_aulas = 2L, replacement_waves = 0L,
                    strata_cols = list("faculty"), monte_carlo_n = 0L)
  )
  frame <- calc_muestra_aulas_construir(base_madre = .filters_echo_base(), config = cfg)
  echo <- frame$filters_echo
  expect_false(isTRUE(echo$require_min_prevalence))
  expect_false(isTRUE(echo$require_faculty_prevalence))
  expect_false(isTRUE(echo$require_cycle_homogeneity))
  expect_equal(echo$min_prevalence_pct, 0.8)
  expect_equal(echo$min_faculty_prevalence_pct, 0.8)
  expect_equal(echo$min_cycle_homogeneity_pct, 0.8)
})

test_that("el frame demo expone el mismo contrato de eco", {
  demo <- tryCatch(calc_muestra_aulas_demo_hsvg_2025(), error = function(e) NULL)
  skip_if(is.null(demo), "preset demo no disponible en este entorno")
  expect_true(is.list(demo$frame$filters_echo))
  expect_setequal(names(demo$frame$filters_echo), c(
    "require_min_prevalence", "min_prevalence_pct",
    "require_faculty_prevalence", "min_faculty_prevalence_pct",
    "require_cycle_homogeneity", "min_cycle_homogeneity_pct"
  ))
})
