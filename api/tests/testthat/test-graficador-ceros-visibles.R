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

test_that("el piso va a lo que se rotula 0 %, no solo a lo que vale cero", {
  # Un caso entre 209 es 0,48 %: se rotula «0 %» y se dibuja como una astilla.
  # Para quien lee la lámina es indistinguible de la categoría vacía.
  v <- c(0.0048, 0.5, 0.4952)
  out <- .barras_inflar_ceros(v, mostrar = TRUE, piso = 0.005,
                              cero_rotulado = c(TRUE, FALSE, FALSE))
  expect_equal(out[1], 0.005)
  expect_equal(sum(out), 1)
})

test_that("el piso es un mínimo y nunca encoge un segmento", {
  # Si se asignara en vez de comparar, un 0,7 % rotulado 0 % bajaría a 0,5 %:
  # el remedio quitaría ancho al mismo segmento que viene a hacer visible.
  v <- c(0.007, 0.993)
  out <- .barras_inflar_ceros(v, mostrar = TRUE, piso = 0.005,
                              cero_rotulado = c(TRUE, FALSE))
  expect_equal(out, v)
})

test_that(".barras_cero_rotulado usa la regla de la casa y no revienta con NA", {
  expect_equal(.barras_cero_rotulado(c(0, 0.0048, 0.005, 0.02), 0),
               c(TRUE, TRUE, FALSE, FALSE))
  expect_equal(.barras_cero_rotulado(c(NA, NaN, Inf), 0), c(FALSE, FALSE, FALSE))
})

test_that("el reparto por resto mayor cierra en 100 unidades", {
  expect_equal(sum(.pulso_pct_unidades_exactas(c(71, 105, 5, 1), 0)), 100L)
  expect_equal(.pulso_pct_unidades_exactas(c(71, 105, 5, 1), 0), c(39L, 58L, 3L, 0L))
  expect_equal(sum(.pulso_pct_unidades_exactas(c(1, 1, 1), 1)), 1000L)
})

# ---------------------------------------------------------------------------
# La regresión que importa: el mazo real
# ---------------------------------------------------------------------------
# El plan entrega los porcentajes YA redondeados a entero (`pct_int / 100`), así
# que una categoría con un caso entre 182 llega valiendo 0 exacto. Sin piso, su
# segmento mide cero y no lleva etiqueta: la barra muestra 181 casos sobre una
# base de 182 y no hay ninguna cifra visible que lo delate.

etiquetas_de <- function(p) {
  d <- ggplot2::ggplot_build(p)$data
  labs <- unlist(lapply(d, function(x) if ("label" %in% names(x)) as.character(x$label)))
  labs[nzchar(labs)]
}

apilada_182 <- function(n_ultima, ...) {
  cn <- c(71, 105, 5, n_ultima)
  # Los porcentajes van escritos a mano, con la forma exacta en que el plan los
  # entrega —enteros ya repartidos, `pct_int / 100`— y no calculados con la
  # función que este mismo arreglo introdujo: si el fixture la usara, el test
  # fallaría por «función no encontrada» en vez de por el render, que es lo que
  # tiene que medir.
  d <- data.frame(cat = "OE3", n = sum(cn),
                  p1 = 0.39, p2 = 0.58, p3 = 0.03, p4 = 0.00,
                  n_1 = cn[1], n_2 = cn[2], n_3 = cn[3], n_4 = cn[4])
  graficar_barras_apiladas(
    data = d, var_categoria = "cat", var_n = "n",
    cols_porcentaje = c("p1", "p2", "p3", "p4"),
    cols_n = c(p1 = "n_1", p2 = "n_2", p3 = "n_3", p4 = "n_4"),
    etiquetas_grupos = c(p1 = "Nada", p2 = "Poco", p3 = "Bastante", p4 = "Mucho"),
    mostrar_n_en_etiquetas = TRUE, escala_valor = "proporcion_1", decimales = 0, ...)
}

test_that("la categoría con casos que redondea a 0 % no se pierde sin interruptor", {
  p <- apilada_182(1)
  b <- ggplot2::ggplot_build(p)$data[[1]]
  anchos <- b$xmax - b$xmin

  expect_equal(min(anchos), 0.005)          # recibió el piso
  expect_equal(sum(anchos), 1)              # y la fila sigue sumando 100 %
  expect_true("0% (1)" %in% etiquetas_de(p))
})

test_that("la categoría VACÍA sigue dependiendo del interruptor", {
  # El piso automático es para el dato perdido. Enseñar la opción que nadie
  # eligió es otra cosa: una decisión de lámina, y sigue siendo opcional.
  sin <- apilada_182(0)
  expect_equal(min(ggplot2::ggplot_build(sin)$data[[1]]$xmax -
                     ggplot2::ggplot_build(sin)$data[[1]]$xmin), 0)
  expect_false(any(grepl("^0%", etiquetas_de(sin))))

  con <- apilada_182(0, mostrar_categorias_en_cero = TRUE)
  expect_equal(min(ggplot2::ggplot_build(con)$data[[1]]$xmax -
                     ggplot2::ggplot_build(con)$data[[1]]$xmin), 0.005)
})

test_that("en agrupadas el umbral de barra no borra el caso que redondea a 0 %", {
  # `umbral_barra` vale 0,01 por defecto y suprimía la barra entera. Existía
  # para que no quedaran astillas ilegibles, que es justo lo que el piso
  # resuelve mejor: suprimirla borraba el caso del gráfico y de su recuento.
  cn <- c(112, 105, 81, 54, 1, 7)
  d <- data.frame(cat = c("Networking", "Mentoría", "Charlas", "Feria",
                          "Voluntariado", "Otro"),
                  n = 209, s1 = round(cn / 209 * 100) / 100, n_1 = cn,
                  stringsAsFactors = FALSE)
  p <- graficar_barras_agrupadas(
    data = d, var_categoria = "cat", var_n = "n",
    cols_porcentaje = "s1", cols_n = c(s1 = "n_1"),
    etiquetas_series = c(s1 = "Interés"),
    mostrar_n_en_etiquetas = TRUE, escala_valor = "proporcion_1",
    orientacion = "horizontal", decimales = 0)

  b <- ggplot2::ggplot_build(p)$data[[1]]
  largos <- b$ymax - b$ymin
  expect_length(largos, 6)                  # ninguna categoría se cayó
  expect_equal(min(largos), .BARRAS_PISO_CERO)
  expect_true("0% (1)" %in% etiquetas_de(p))
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
