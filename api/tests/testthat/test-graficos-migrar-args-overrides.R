source("setup-load-all.R")

# Los mandos que el render lee sólo de `overrides` (significancia de las multiapiladas por cruce, orden de barras)
# también llegan cuando el plan los trae en `args`. CCSS 2026-11-03: 11 láminas sin marcas y 42 gráficos sin orden.

plan_con <- function(args) {
  list(slides = list(list(id = "s1", tipo = "p_slide_1_grafico",
                          payload = list(titulo = "T", grafico = list(graficador = "p_barras_multiapiladas", args = args)))))
}

test_that("mostrar_significancia y orden_barras sueltos en args pasan a overrides", {
  p <- .graficos_migrar_args_a_overrides(plan_con(list(var = "x", cruces = "sexo", modo = "cruce",
                                                      mostrar_significancia = TRUE, orden_barras = "mayor_menor")))
  ov <- p$slides[[1]]$payload$grafico$args$overrides
  expect_true(isTRUE(ov$mostrar_significancia))
  expect_identical(ov$orden_barras, "mayor_menor")
  # args no se borra: el camino que sí los lee desde args sigue igual
  expect_true(isTRUE(p$slides[[1]]$payload$grafico$args$mostrar_significancia))
})

test_that("lo que overrides ya declara no se pisa y un plan correcto queda igual", {
  args <- list(var = "x", orden_barras = "mayor_menor", overrides = list(orden_barras = "instrumento"))
  p <- .graficos_migrar_args_a_overrides(plan_con(args))
  expect_identical(p$slides[[1]]$payload$grafico$args$overrides$orden_barras, "instrumento")
  sin_mandos <- plan_con(list(var = "x", overrides = list(decimales = 0)))
  expect_identical(.graficos_migrar_args_a_overrides(sin_mandos), sin_mandos)
})

test_that("la migración corre en todo camino que normaliza el plan y es idempotente", {
  p1 <- .normalize_plan(plan_con(list(var = "x", cruces = "sexo", mostrar_significancia = TRUE)))
  expect_true(isTRUE(p1$slides[[1]]$payload$grafico$args$overrides$mostrar_significancia))
  expect_identical(.normalize_plan(p1)$slides, p1$slides)
})

test_that("también recorre las láminas de varias ranuras", {
  p <- list(slides = list(list(id = "s2", tipo = "p_slide_2_graficos", payload = list(
    izquierda = list(graficador = "p_barras_agrupadas", args = list(var = "a", orden_barras = "mayor_menor")),
    derecha = list(graficador = "p_barras_agrupadas", args = list(var = "b"))))))
  q <- .graficos_migrar_args_a_overrides(p)
  expect_identical(q$slides[[1]]$payload$izquierda$args$overrides$orden_barras, "mayor_menor")
  expect_null(q$slides[[1]]$payload$derecha$args$overrides)
})
