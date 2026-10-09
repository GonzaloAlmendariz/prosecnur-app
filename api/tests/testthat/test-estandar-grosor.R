# ADR 0092 (F2.1) — en las apiladas, la barra mide lo que pide la tabla del
# estándar por número de filas, medido en la lámina y no como fracción de fila.
# Línea base del 2026-10-08 en la ranura estándar: 3 de 12 alturas cumplían, y
# con 1 a 4 filas las barras medían 0.83 a 1.07 in donde el recetario pide 0.44 a 0.50.

.apilada_estandar <- function(n, grosor_estandar = TRUE, chicas = FALSE) {
  set.seed(n)
  # Sin cifras chicas (todos los segmentos >= 12 %) rige la tabla tal cual; con
  # chicas, la fila reserva el aire para las que suben (F2.3).
  p <- if (chicas) matrix(stats::runif(n * 5, 0.05, 1), n) else matrix(stats::runif(n * 5, 0.8, 1), n)
  if (chicas) p[, 1] <- 0.02
  p <- p / rowSums(p)
  d <- data.frame(categoria = sprintf("Afirmación %02d", seq_len(n)), N = 200L,
                  t1 = p[, 1], t2 = p[, 2], t3 = p[, 3], t4 = p[, 4], t5 = p[, 5])
  ranura <- .std_tipo_lamina("p_slide_1_grafico")$ranuras[[1]]
  suppressMessages(suppressWarnings(graficar_barras_apiladas(
    data = d, var_categoria = "categoria", var_n = "N", cols_porcentaje = paste0("t", 1:5),
    etiquetas_grupos = c(t1 = "TD", t2 = "D", t3 = "A", t4 = "TA", t5 = "SI"),
    colores_grupos = .std_paleta("likert"), exportar = "rplot", usar_canvas = TRUE,
    ancho = ranura$w, alto = ranura$h, grosor_estandar = grosor_estandar
  )))
}

test_that("el grosor dibujado sale de la tabla del estándar en todo el rango de filas", {
  skip_if_not_installed("cowplot")
  for (n in c(1, 2, 3, 5, 7, 9, 10, 12)) {
    lay <- attr(.apilada_estandar(n), "pulso_barras_apiladas_layout")
    # ±0.03 in, la tolerancia del banco: con muchas filas cortas manda el tope de
    # fracción (las barras no se tocan) y la barra puede quedar unas milésimas abajo.
    expect_lte(abs(lay$grosor_in - .std_grosor(n, "escala_apilada")), 0.03, label = paste(n, "filas"))
  }
})

test_that("con cifras chicas la fila gana aire si cabe y si no la barra cede hasta 0.24 in", {
  skip_if_not_installed("cowplot")
  # pocas filas: el aire cabe y la barra conserva el grosor de la tabla
  lay3 <- attr(.apilada_estandar(3, chicas = TRUE), "pulso_barras_apiladas_layout")
  expect_lte(abs(lay3$grosor_in - .std_grosor(3, "escala_apilada")), 0.03)
  # ocho filas en 4.6 in: el aire no cabe y la barra cede, pero no bajo el piso
  lay8 <- attr(.apilada_estandar(8, chicas = TRUE), "pulso_barras_apiladas_layout")
  expect_lt(lay8$grosor_in, .std_grosor(8, "escala_apilada"))
  expect_gte(lay8$grosor_in, 0.24 - 0.01)
})

test_that("con grosor_estandar = FALSE vuelve la fracción de fila previa", {
  skip_if_not_installed("cowplot")
  lay <- attr(.apilada_estandar(2, grosor_estandar = FALSE), "pulso_barras_apiladas_layout")
  expect_gt(lay$grosor_in, 0.8)
})

test_that("la traza de grosor escribe sólo con la opción puesta", {
  skip_if_not_installed("cowplot")
  destino <- tempfile(fileext = ".csv")
  withr_local <- options(pulso.traza_grosor = NULL)
  on.exit(options(withr_local), add = TRUE)
  .apilada_estandar(3)
  expect_false(file.exists(destino))
  options(pulso.traza_grosor = destino)
  .apilada_estandar(3)
  fila <- strsplit(readLines(destino), ",")[[1]]
  expect_length(fila, 7L)
  expect_equal(as.numeric(fila[5]), .std_grosor(3, "escala_apilada"), tolerance = 0.01)
})

test_that("cambiar el ancho de la capa no la deja sin barras", {
  d <- data.frame(y = c("a", "b"), x = c(1, 2))
  p <- ggplot2::ggplot(d, ggplot2::aes(x, y)) + ggplot2::geom_col(width = 0.8, orientation = "y") +
    ggplot2::geom_text(ggplot2::aes(label = x))
  q <- .grosor_reemplazar_ancho_col(p, 0.3)
  b <- ggplot2::ggplot_build(q)$data[[1]]
  expect_true(all(c("ymin", "ymax") %in% names(b)))
  expect_equal(unique(round(b$ymax - b$ymin, 3)), 0.3)
})

test_that("la columna Top Two Box mide 1 in, como en el recetario", {
  skip_if_not_installed("cowplot")
  d <- data.frame(categoria = c("A", "B", "C"), N = 200L,
                  t1 = c(.1, .2, .1), t2 = c(.2, .2, .1), t3 = c(.4, .3, .5), t4 = c(.3, .3, .3))
  ranura <- .std_tipo_lamina("p_slide_1_grafico")$ranuras[[1]]
  p <- suppressMessages(suppressWarnings(graficar_barras_apiladas(
    data = d, var_categoria = "categoria", var_n = "N", cols_porcentaje = paste0("t", 1:4),
    etiquetas_grupos = c(t1 = "TD", t2 = "D", t3 = "A", t4 = "TA"), exportar = "rplot", usar_canvas = TRUE,
    ancho = ranura$w, alto = ranura$h, mostrar_barra_extra = TRUE, barra_extra_preset = "top2box",
    top2box_labels = c("A", "TA"))))
  expect_equal(attr(p, "pulso_barras_apiladas_layout")$ancho_columna_extra_in, .std_geom("columna_top_two_box"), tolerance = 1e-6)
})
