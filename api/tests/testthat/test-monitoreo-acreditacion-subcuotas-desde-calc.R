# Enviar a Monitoreo lleva el reparto por estrato (L29 del loop de mejoras de
# Cálculo de muestra, 2026-09-27). El traspaso copiaba la meta total (317) y
# perdía distribucion_estratos: Monitoreo seguía el total sin ver que Puno
# pedía 30. Monitoreo ya sabe seguir sub_cuotas; faltaba el puente.

test_that("L29: el reparto por estrato del calculador llega como subcuotas a Monitoreo", {
  comp <- list(id = "c1", actor = "Población objetivo", tecnica = "prob_estratificado",
    resultado = list(n_objetivo = 317L, n_operativo = 502L, distribucion_estratos = list(
      list(estrato = "Arequipa", N = 1500L, n = 81L, n_campo = 128L),
      list(estrato = "Cusco", N = 450L, n = 30L, n_campo = 48L),
      list(estrato = "Lima", N = 3000L, n = 176L, n_campo = 278L),
      list(estrato = "Puno", N = 50L, n = 30L, n_campo = 48L))))
  acr <- monitoreo_acreditacion_from_calc(list(componentes = list(comp)))
  sub <- acr$componentes[[1]]$seguimiento$sub_cuotas_progreso
  expect_setequal(names(sub), c("Arequipa", "Cusco", "Lima", "Puno"))
  expect_identical(sub$Puno$cuota, 30L)
  expect_identical(sub$Lima$cuota, 176L)
  expect_identical(sum(vapply(sub, function(s) s$cuota, integer(1))), 317L)
  expect_identical(acr$componentes[[1]]$meta$n_objetivo, 317L)
})

test_that("L29: sin estratos (o el total de un MAS) no inventa subcuotas", {
  comp <- list(id = "c1", actor = "Hogares", tecnica = "prob_aleatorio_simple",
               resultado = list(n_objetivo = 323L, n_operativo = 509L))
  acr <- monitoreo_acreditacion_from_calc(list(componentes = list(comp)))
  expect_length(acr$componentes[[1]]$seguimiento$sub_cuotas_progreso, 0L)
})

test_that("L29: las subcuotas declaradas mandan sobre el reparto", {
  comp <- list(id = "c1", actor = "Docentes", tecnica = "no_prob_cuotas",
               meta = list(sub_cuotas = list(TC = 50L, TPA = 50L)),
               resultado = list(n_objetivo = 100L, distribucion_estratos = list(
                 list(estrato = "X", N = 10L, n = 10L))))
  sub <- monitoreo_acreditacion_from_calc(list(componentes = list(comp)))$componentes[[1]]$seguimiento$sub_cuotas_progreso
  expect_setequal(names(sub), c("TC", "TPA"))
})
