source("setup-load-all.R")

# Una categoría con cero casos ocupa cero ancho y desaparece de la barra: el
# lector no distingue «nadie la eligió» de «no estaba en la pregunta». El apaño
# anterior era rotular «<1%», una notación que no existe en el entregable; se
# retiró y esto ocupa su lugar, pero OPCIONAL.

test_that("apagado no toca nada", {
  v <- c(0, 0.30, 0.70)
  expect_equal(.barras_inflar_ceros(v, mostrar = FALSE), v)
})

test_that("encendido el cero recibe piso y la fila sigue sumando 1", {
  v <- c(0, 0.30, 0.70)
  out <- .barras_inflar_ceros(v, mostrar = TRUE, piso = 0.005)
  expect_equal(out[1], 0.005)
  expect_equal(sum(out), 1)
  # El resto se recomprime en proporción: conserva su peso relativo.
  expect_equal(out[3] / out[2], v[3] / v[2])
})

test_that("varios ceros en la misma fila", {
  out <- .barras_inflar_ceros(c(0, 0, 0.50, 0.50), mostrar = TRUE, piso = 0.005)
  expect_equal(out[1:2], c(0.005, 0.005))
  expect_equal(sum(out), 1)
})

test_that("sin ceros no se recomprime nada", {
  # El control: si tocara filas sin ceros, estaría deformando datos correctos.
  v <- c(0.25, 0.75)
  expect_equal(.barras_inflar_ceros(v, mostrar = TRUE), v)
})

test_that("casos degenerados se dejan como están", {
  # Una fila entera de ceros no puede sumar 100 % por mucho piso que se le dé.
  expect_equal(.barras_inflar_ceros(c(0, 0), mostrar = TRUE), c(0, 0))
  # Y si los pisos se comieran la fila, el remedio sería peor.
  expect_equal(.barras_inflar_ceros(c(0, 0.001), mostrar = TRUE, piso = 0.9),
               c(0, 0.001))
  expect_equal(.barras_inflar_ceros(numeric(0), mostrar = TRUE), numeric(0))
})

test_that("el interruptor es formal del graficador y nace apagado", {
  f <- formals(graficar_barras_apiladas)
  expect_true("mostrar_categorias_en_cero" %in% names(f))
  expect_false(isTRUE(eval(f$mostrar_categorias_en_cero)))
})

test_that("inflar el ancho NO cambia la cifra rotulada", {
  # Es la razón de que `.valor_pct_real` exista: la etiqueta salía de la misma
  # columna que la geometría, así que dar ancho al cero lo habría rotulado
  # «0.5%» — justo el dato falso que esto viene a evitar.
  d <- data.frame(categoria = "Item", N = 100,
                  pct_1 = 0, pct_2 = 0.30, pct_3 = 0.70,
                  stringsAsFactors = FALSE)
  p <- graficar_barras_apiladas(
    data = d, var_categoria = "categoria", var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2", "pct_3"),
    etiquetas_grupos = c(pct_1 = "Nada", pct_2 = "Algo", pct_3 = "Mucho"),
    mostrar_valores = TRUE, mostrar_categorias_en_cero = TRUE, decimales = 0
  )
  labs <- unlist(lapply(
    Filter(function(l) inherits(l$geom, "GeomText"), p$layers),
    function(l) if ("lab" %in% names(l$data)) as.character(l$data$lab) else character()
  ))
  expect_true("0%" %in% labs)
  expect_false(any(grepl("0.5%", labs, fixed = TRUE)))
})
