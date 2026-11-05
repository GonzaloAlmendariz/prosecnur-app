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

# U6 del checklist de mandos del mazo (2026-11-05): pista gris, un color por opción y marca de la mediana se eligen en la
# tarjeta del gráfico, que escribe `args` y `overrides` en espejo. Un plan que los trae en un solo lado se completa.
plan_de <- function(graficador, args) {
  list(slides = list(list(id = "s1", tipo = "p_slide_1_grafico",
                          payload = list(titulo = "T", grafico = list(graficador = graficador, args = args)))))
}
grafico_de <- function(p) p$slides[[1]]$payload$grafico

test_that("los mandos de la tarjeta sueltos en args pasan a overrides", {
  g <- grafico_de(.graficos_migrar_args_a_overrides(plan_de("p_barras_agrupadas",
    list(var = "x", pista_barras = "nunca", colorear_por_opcion = TRUE))))
  expect_identical(g$args$overrides$pista_barras, "nunca")
  expect_true(isTRUE(g$args$overrides$colorear_por_opcion))
  expect_identical(g$args$pista_barras, "nunca")
  h <- grafico_de(.graficos_migrar_args_a_overrides(plan_de("p_histograma", list(var = "edad", marca_mediana = "triangulo"))))
  expect_identical(h$args$overrides$marca_mediana, "triangulo")
})

test_that("un valor ya en overrides no se pisa y args se alinea con él", {
  g <- grafico_de(.graficos_migrar_args_a_overrides(plan_de("p_barras_categoricas",
    list(var = "x", pista_barras = "siempre", overrides = list(pista_barras = "nunca")))))
  expect_identical(g$args$overrides$pista_barras, "nunca")
  # La tarjeta lee `args`: muestra lo que el motor dibuja.
  expect_identical(g$args$pista_barras, "nunca")
  solo_ov <- grafico_de(.graficos_migrar_args_a_overrides(plan_de("p_histograma",
    list(var = "edad", overrides = list(marca_mediana = "triangulo")))))
  expect_identical(solo_ov$args$marca_mediana, "triangulo")
})

test_that("el espejo es idempotente y un plan sin esos mandos queda igual", {
  p <- .normalize_plan(plan_de("p_barras_agrupadas", list(var = "x", pista_barras = "nunca")))
  expect_identical(.normalize_plan(p)$slides, p$slides)
  sin <- plan_de("p_barras_agrupadas", list(var = "x", overrides = list(decimales = 0)))
  expect_identical(.graficos_migrar_args_a_overrides(sin), sin)
})

test_that("un segundo cambio desde la tarjeta llega: el espejo no queda con el valor viejo", {
  # Primer guardado: la tarjeta escribe los dos lados.
  p1 <- .normalize_plan(plan_de("p_barras_agrupadas",
    list(var = "x", pista_barras = "nunca", overrides = list(pista_barras = "nunca"))))
  # Segundo cambio sobre el plan ya normalizado: otra vez los dos lados.
  g <- grafico_de(p1)
  g$args$pista_barras <- "siempre"; g$args$overrides$pista_barras <- "siempre"
  p1$slides[[1]]$payload$grafico <- g
  g2 <- grafico_de(.normalize_plan(p1))
  expect_identical(g2$args$overrides$pista_barras, "siempre")
})

test_that("«Casos junto al %» del histograma llega a overrides desde la tarjeta (U10)", {
  expect_true("mostrar_frecuencia" %in% .GRAFICOS_ARGS_ESPEJO_OVERRIDES)
})
