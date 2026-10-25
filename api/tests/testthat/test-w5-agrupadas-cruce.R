# CCSS-7 (mazo CCSS Perfil 2026, láminas 23 y 28): la barra agrupada de un CRUCE (dos o más series que son los grupos de
# otra pregunta) salía por la ruta de respaldo con el verde azulado de la paleta genérica, rótulos de fila envueltos a 30
# caracteres que caían sobre la fila siguiente, la cifra blanca más alta que su barra, la leyenda en el orden inverso al de
# las barras y una columna de rótulos de 0.45 del ancho que dejaba el gráfico en el centro de la lámina.
#
# Datos sintéticos con la forma del cruce real (5 o 4 categorías, dos grupos); nunca datos del cliente.

.w5_cruce_data <- function(categorias, p1, p2) {
  data.frame(categoria = categorias, N = 400, N_casos = 397,
             n_1 = round(p1 * 200), pct_1 = p1, nc_1 = round(p1 * 200),
             n_2 = round(p2 * 197), pct_2 = p2, nc_2 = round(p2 * 197), stringsAsFactors = FALSE)
}

.w5_cruce <- function(data, ancho = 12.51, alto = 5.51, ...) {
  graficar_barras_agrupadas(
    data = data, var_categoria = "categoria", var_n = "N", var_n_casos = "N_casos",
    cols_porcentaje = c("pct_1", "pct_2"),
    etiquetas_series = c(pct_1 = "Grupo uno", pct_2 = "Grupo dos"),
    cols_n = c(pct_1 = "n_1", pct_2 = "n_2"), cols_n_casos = c(pct_1 = "nc_1", pct_2 = "nc_2"),
    titulo = "Tiempo de llegada según el grupo", usar_canvas = TRUE, orientacion = "horizontal",
    orden_barras = "instrumento", orden_categorias_manual = as.list(data$categoria), invertir_barras = TRUE,
    canvas_w_etiquetas = 0.45, canvas_w_buf_etq_bars = 0.03, canvas_w_bars = 0.52, canvas_w_extra = 0,
    canvas_h_header_in = 1.25, canvas_h_legend_in = 0.35, canvas_h_caption_in = 0.28, canvas_h_reserva_pie_in = 0.34,
    canvas_min_filas = 7, canvas_h_toprow_in = 0.1, size_ejes = 12, size_texto_barras = 4.92, ancho_max_eje_y = 38,
    grosor_barras = 0.82, umbral_posicion = 0.07, umbral_etiqueta = 0.001, grosor_min_in = 0.256,
    textos_negrita = c("titulo", "subtitulo", "valores", "etiquetas"), font_family = "Arial",
    ancho = ancho, alto = alto, exportar = "rplot", ...)
}

.w5_cat_largas <- c(
  "Me esfuerzo en todos mis cursos, independientemente de si me gustan o no.",
  "Me involucro en los cursos que me gustan; en los demás, hago lo necesario.",
  "Depende de presiones externas como calificaciones, presión familiar, fechas límites, entre otras.",
  "Más que el contenido, me motiva avanzar rápido y graduarme.")

test_that("CCSS-7: el cruce de dos grupos sale en la paleta de marca, no en la genérica", {
  d <- .w5_cruce_data(c("Menos de 30 minutos", "Entre 30 minutos y 1 hora", "Entre 1 hora y 1 hora y 30 minutos",
                        "Entre una 1 hora y 30 minutos y 2 horas", "2 horas o más"),
                      c(.21, .20, .25, .27, .08), c(.57, .26, .11, .03, .03))
  g <- .w5_cruce(d)
  cr <- attr(g, "pulso_barras_agrupadas_cruce")
  expect_false(is.null(cr))
  expect_identical(toupper(unname(cr$colores)), toupper(unname(.std_paleta("dicotomica"))))
  expect_false("#2A9D8F" %in% toupper(unname(cr$colores)))
  # Con tres grupos, la rampa de marca de `.lam_colores_pie` (la misma de las donas nativas).
  d3 <- d; d3$pct_3 <- d$pct_2; d3$n_3 <- d$n_2; d3$nc_3 <- d$nc_2
  g3 <- graficar_barras_agrupadas(
    data = d3, var_categoria = "categoria", var_n = "N", cols_porcentaje = c("pct_1", "pct_2", "pct_3"),
    etiquetas_series = c(pct_1 = "A", pct_2 = "B", pct_3 = "C"), usar_canvas = TRUE, orientacion = "horizontal",
    ancho = 12.51, alto = 5.51, exportar = "rplot")
  expect_identical(toupper(unname(attr(g3, "pulso_barras_agrupadas_cruce")$colores)), toupper(.lam_colores_pie(3)))
})

test_that("CCSS-7: la barra de arriba de cada par es la primera serie de la leyenda", {
  d <- .w5_cruce_data(c("Uno", "Dos", "Tres"), c(.2, .5, .3), c(.6, .1, .3))
  cr <- attr(.w5_cruce(d), "pulso_barras_agrupadas_cruce")
  # coord_flip deja el primer grupo del dodge ABAJO; el cruce invierte el dodge para que la primera serie quede arriba,
  # que es como la nombra la leyenda (orden del instrumento de la variable de cruce).
  expect_true(isTRUE(cr$dodge_invertido))
  expect_identical(cr$orden_leyenda, c("Grupo uno", "Grupo dos"))
})

test_that("CCSS-7: los rótulos de fila caben en su fila y la columna de rótulos no se come el ancho", {
  skip_if_not_installed("systemfonts")
  d <- .w5_cruce_data(.w5_cat_largas, c(.67, .26, .05, .02), c(.49, .38, .08, .05))
  g <- .w5_cruce(d)
  ly <- attr(g, "pulso_barras_agrupadas_layout")
  cr <- attr(g, "pulso_barras_agrupadas_cruce")
  fila_in <- ly$h_panel_in / ly$n_categorias
  lineas <- .agrupadas_lineas_eje(.w5_cat_largas, ly$ancho_max_eje_y_eff)
  expect_lte(lineas * ly$size_ejes_eff * 1.2 / 72, fila_in * 0.92)
  # La columna mide lo que miden los rótulos envueltos (más su aire), no el 45 % declarado.
  lin <- unlist(strsplit(stringr::str_wrap(.w5_cat_largas, ly$ancho_max_eje_y_eff), "\n"))
  ancho_tinta <- max(.ancho_texto_in(lin, ly$size_ejes_eff))
  expect_lte(ly$canvas_w_etiquetas_eff * 12.51, ancho_tinta + 0.6)
  expect_gte(ly$canvas_w_etiquetas_eff * 12.51, ancho_tinta)
  expect_gt(ly$canvas_w_bars_eff, 0.60)
})

test_that("CCSS-7: la cifra dentro de la barra no es más alta que la barra", {
  d <- .w5_cruce_data(c("Menos de 30 minutos", "Entre 30 minutos y 1 hora", "Entre 1 hora y 1 hora y 30 minutos",
                        "Entre una 1 hora y 30 minutos y 2 horas", "2 horas o más"),
                      c(.21, .20, .25, .27, .08), c(.57, .26, .11, .03, .03))
  g <- .w5_cruce(d)
  cr <- attr(g, "pulso_barras_agrupadas_cruce")
  # Alto de una barra del par contra el alto de la cifra (mm de ggplot a pulgadas), con el mismo margen que el comparativo.
  expect_lte(cr$size_cifra_mm / 25.4, cr$alto_barra_in * 0.72 + 1e-6)
})

test_that("CCSS-7: una sola serie (perfil) y el comparativo no entran por la ruta del cruce", {
  d <- data.frame(categoria = c("A", "B"), N = 10, pct_1 = c(.4, .6), n_1 = c(4, 6))
  g <- graficar_barras_agrupadas(data = d, var_categoria = "categoria", var_n = "N", cols_porcentaje = "pct_1", etiquetas_series = c(pct_1 = "Porcentaje"),
                                 cols_n = c(pct_1 = "n_1"), usar_canvas = TRUE, orientacion = "horizontal",
                                 ancho = 12.51, alto = 5.51, exportar = "rplot")
  expect_null(attr(g, "pulso_barras_agrupadas_cruce"))
})

test_that("lámina 23 (R15): sin nota de significancia, el cruce usa el alto del cajón (la cabecera mide su título)", {
  # La cabecera declarada (1.25 in) para un título de una línea de 16 pt dejaba 0.8 in vacías entre el título del gráfico y
  # la primera barra; con la nota de significancia el hueco de abajo la disimulaba, sin ella el bloque se veía arriba.
  d <- .w5_cruce_data(c("Menos de 30 minutos", "Entre 30 minutos y 1 hora", "Entre 1 hora y 1 hora y 30 minutos",
                        "Entre una 1 hora y 30 minutos y 2 horas", "2 horas o más"),
                      c(.21, .20, .25, .27, .08), c(.57, .26, .11, .03, .03))
  ly <- attr(.w5_cruce(d), "pulso_barras_agrupadas_layout")
  expect_gte(ly$h_panel_in, 4.0)   # antes 3.57
  expect_lte(ly$h_total_in, 5.51 + 1e-6)
})
