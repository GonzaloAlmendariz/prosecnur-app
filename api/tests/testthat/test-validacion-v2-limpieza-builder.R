# =============================================================================
# Tests para build_limpieza (Sprint 5)
# =============================================================================
# Consolida KPIs, top reglas violadas y top variables problemáticas en un
# payload listo para el frontend de Limpieza. Estos tests verifican el
# shape del output bajo 3 escenarios: scope vacío, con plan sin auditoría,
# y con evaluación completa.

# ----- Helpers ----------------------------------------------------------------

.fake_plan <- function(n = 5L) {
  tibble::tibble(
    ID = sprintf("R%03d", seq_len(n)),
    Tabla = "principal",
    `Sección` = "Validación",
    `Categoría` = "checkeo",
    `Tipo` = "custom",
    `Nombre de regla` = sprintf("Regla %d", seq_len(n)),
    `Objetivo` = sprintf("Obj %d", seq_len(n)),
    `Variable 1` = sprintf("v%d", seq_len(n)),
    `Variable 1 - Etiqueta` = NA_character_,
    `Variable 2` = NA_character_,
    `Variable 2 - Etiqueta` = NA_character_,
    `Variable 3` = NA_character_,
    `Variable 3 - Etiqueta` = NA_character_,
    `Procesamiento` = "rc_x <- rep(FALSE, length(v1))"
  )
}

.fake_resumen <- function() {
  # Shape mínimo que .limpieza_top_reglas/top_variables esperan. Los
  # builders del limpieza leen `id_regla`, `nombre_regla`, `variable_1`
  # (minúsculas/snake), no los títulos humanos del plan — son el resumen
  # post-evaluación, no el plan crudo.
  tibble::tibble(
    id_regla = c("R001", "R002", "R003"),
    nombre_regla = c("Regla 1", "Regla 2", "Regla 3"),
    variable_1 = c("edad", "edad", "ingreso"),
    seccion = c("Demografía", "Demografía", "Económico"),
    n_inconsistencias = c(20L, 5L, 0L)
  )
}

# ----- Tests ------------------------------------------------------------------

test_that("build_limpieza con scope vacío devuelve shape mínimo", {
  scope <- list()  # sin plan ni evaluación ni reglas custom
  out <- build_limpieza(scope)

  expect_true(all(c("progreso", "summary", "kpis", "top_reglas", "top_variables",
                    "decision_queue", "decision_draft", "module_stats",
                    "before_after_preview", "artifacts") %in% names(out)))
  expect_false(out$progreso$plan_construido)
  expect_false(out$progreso$auditoria_corrida)
  expect_equal(out$progreso$n_reglas_custom, 0L)
  # KPIs siempre es una lista no vacía (al menos la card de "Reglas activas").
  expect_true(is.list(out$kpis))
  expect_gt(length(out$kpis), 0L)
})

test_that("build_limpieza con plan sin evaluación refleja el plan pero no da totales", {
  scope <- list(plan_result = list(plan = .fake_plan(7L)))
  out <- build_limpieza(scope)

  expect_true(out$progreso$plan_construido)
  expect_false(out$progreso$auditoria_corrida)
  # Sin evaluación, KPIs tiene solo la card de "Reglas activas" — no
  # "Total inconsistencias".
  expect_true(is.list(out$kpis))
  expect_length(out$kpis, 1L)
})

test_that("build_limpieza con plan + evaluación produce KPIs completos", {
  ev <- list(resumen = .fake_resumen())
  scope <- list(
    plan_result = list(plan = .fake_plan(3L)),
    evaluacion = ev
  )
  out <- build_limpieza(scope)

  expect_true(out$progreso$plan_construido)
  expect_true(out$progreso$auditoria_corrida)
  # Al menos 2 KPIs cuando hay evaluación (total + reglas con casos).
  expect_gte(length(out$kpis), 2L)
})

test_that("build_limpieza cuenta reglas_custom activas en n_reglas_custom", {
  scope <- list(
    reglas_custom = list(
      list(id = "a", activa = TRUE),
      list(id = "b", activa = FALSE),
      list(id = "c", activa = TRUE)
    )
  )
  out <- build_limpieza(scope)
  # n_reglas_custom cuenta TODAS las custom (activas + inactivas); el
  # KPI las diferencia.
  expect_equal(out$progreso$n_reglas_custom, 3L)
})

test_that("build_limpieza siempre incluye top_reglas y top_variables como listas", {
  scope <- list()
  out <- build_limpieza(scope)
  expect_true(is.list(out$top_reglas))
  expect_true(is.list(out$top_variables))
})
