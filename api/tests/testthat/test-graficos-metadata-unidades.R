source("setup-load-all.R")

# El editor visual de distribución del espacio exige la unidad para pasar de
# «Medida exacta · Unidad no publicada · Sin reparto visual» a un reparto con
# bandas. Ningún preset la publicaba, así que el analista veía «Grupo 0,22»: un
# número sin referencia.

test_that("los anchos del canvas se publican como proporción", {
  args <- list(
    list(name = "canvas_w_grupo", tipo_input = "number"),
    list(name = "canvas_w_bars",  tipo_input = "number")
  )
  out <- .graficos_estampar_unidades(args)
  expect_equal(out[[1]]$unidad, "proporción")
  expect_equal(out[[2]]$unidad, "proporción")
})

test_that("las medidas verticales se publican en pulgadas", {
  args <- list(
    list(name = "canvas_h_legend_in", tipo_input = "number"),
    list(name = "alto_por_categoria", tipo_input = "number")
  )
  out <- .graficos_estampar_unidades(args)
  expect_equal(out[[1]]$unidad, "pulgadas")
  expect_equal(out[[2]]$unidad, "pulgadas")
})

test_that("respeta la unidad que el registro ya declara", {
  # El control: si pisara lo declarado, una entrada que ya dice lo suyo perdería
  # su unidad y el estampado dejaría de ser un relleno para ser una imposición.
  args <- list(list(name = "canvas_w_grupo", unidad = "proporción"))
  expect_equal(.graficos_estampar_unidades(args)[[1]]$unidad, "proporción")
})

test_that("no inventa unidad para lo que no es una medida de layout", {
  args <- list(list(name = "size_leyenda"), list(name = "titulo"))
  out <- .graficos_estampar_unidades(args)
  expect_null(out[[1]]$unidad)
  expect_null(out[[2]]$unidad)
})

test_that("el payload real de multi_apiladas llega con las unidades puestas", {
  m <- Filter(function(x) identical(x$name, "multi_apiladas"),
              .presets_metadata_payload()$presets)[[1]]
  nm <- vapply(m$args, function(a) as.character(a$name), character(1))
  u <- function(k) as.character(m$args[[match(k, nm)]]$unidad %||% "")
  # Sin acentos: el frontend normaliza, pero la comprobación no debe depender de eso.
  expect_match(u("canvas_w_grupo"), "proporci", fixed = TRUE)
  expect_equal(u("canvas_h_legend_in"), "pulgadas")
  expect_equal(u("alto_por_categoria"), "pulgadas")
})

test_that("entradas degeneradas no rompen el registro", {
  expect_equal(.graficos_estampar_unidades(NULL), NULL)
  expect_equal(.graficos_estampar_unidades(list()), list())
  expect_equal(.graficos_estampar_unidades(list(list(sin_nombre = 1)))[[1]]$unidad, NULL)
})
