# Ola 2, E2b (diag4/e2_fuera_vivo.R): en la agrupada con cruce, cuando la cifra no cabe en su barra el motor decide
# `fuera = TRUE` y la pinta con el color de fuera (el azul de la marca), pero la deja posicionada como si fuera dentro
# (a media barra, centrada). Azul sobre la barra azul: la cifra es invisible. Origen 48df566fd.
#
# Contrato: cada cifra o arranca donde termina su barra, o contrasta con el relleno de su barra (WCAG >= 3).

.ola2_e2b_grafico <- function() {
  set.seed(2)
  cats <- paste("Opción", LETTERS[1:10])
  df <- data.frame(categoria = cats, N = 400, pct_1 = runif(10, .3, .6), pct_2 = runif(10, .3, .6),
                   pct_3 = runif(10, .3, .6), pct_4 = runif(10, .3, .6))
  # El panel de barras lo arma el motor con ggplot y lo pega en el lienzo con cowplot::draw_plot: se captura ahí para
  # leer sus capas con ggplot_build (el lienzo sólo guarda el grob).
  paneles <- list()
  orig <- cowplot::draw_plot
  local_mocked_bindings(draw_plot = function(plot, ...) { paneles[[length(paneles) + 1L]] <<- plot; orig(plot, ...) },
                        .package = "cowplot")
  g <- suppressMessages(suppressWarnings(graficar_barras_agrupadas(
    data = df, var_categoria = "categoria", var_n = "N", cols_porcentaje = paste0("pct_", 1:4),
    etiquetas_series = c(pct_1 = "G1", pct_2 = "G2", pct_3 = "G3", pct_4 = "G4"),
    usar_canvas = TRUE, orientacion = "horizontal", ancho = 12.5, alto = 6, exportar = "rplot")))
  list(g = g, panel = paneles[[1]])
}

test_that("E2b: con cifra fuera, ninguna cifra queda dentro de su barra con un color que no contrasta", {
  skip_if_not_installed("cowplot")
  r <- .ola2_e2b_grafico()
  cr <- attr(r$g, "pulso_barras_agrupadas_cruce")
  # Precondición: este cruce 10x4 a 6 in decide sacar la cifra (si deja de hacerlo, el test no mide E2b).
  expect_true(isTRUE(cr$cifra_fuera))

  b <- ggplot2::ggplot_build(r$panel)
  capas <- vapply(r$panel$layers, function(l) class(l$geom)[1], character(1))
  barras <- b$data[[which(capas %in% c("GeomCol", "GeomBar", "GeomRect"))[1]]]
  textos <- b$data[[which(capas == "GeomText")[1]]]
  textos <- textos[!is.na(textos$label) & nzchar(as.character(textos$label)), , drop = FALSE]
  expect_gt(nrow(textos), 0L)

  # Cada cifra con su barra: la misma posición esquivada (x) en el panel (coord_flip: y es el largo de la barra).
  i_barra <- vapply(textos$x, function(x) which.min(abs(barras$x - x)), integer(1))
  fin_barra <- barras$ymax[i_barra]
  relleno <- barras$fill[i_barra]
  contraste <- mapply(.ola2_contraste, textos$colour, relleno)
  fuera <- textos$y >= fin_barra - 1e-9
  malas <- which(!(fuera | contraste >= 3))
  expect_identical(
    sprintf("%s en y=%.3f (barra hasta %.3f) %s sobre %s, contraste %.2f",
            textos$label[malas], textos$y[malas], fin_barra[malas], textos$colour[malas], relleno[malas], contraste[malas]),
    character(0))
})

test_that("E2b: con cifra fuera, todas las cifras del cruce van fuera de su barra (hjust 0, tras el final)", {
  skip_if_not_installed("cowplot")
  r <- .ola2_e2b_grafico()
  b <- ggplot2::ggplot_build(r$panel)
  capas <- vapply(r$panel$layers, function(l) class(l$geom)[1], character(1))
  barras <- b$data[[which(capas %in% c("GeomCol", "GeomBar", "GeomRect"))[1]]]
  textos <- b$data[[which(capas == "GeomText")[1]]]
  textos <- textos[!is.na(textos$label) & nzchar(as.character(textos$label)), , drop = FALSE]
  i_barra <- vapply(textos$x, function(x) which.min(abs(barras$x - x)), integer(1))
  expect_true(all(textos$y > barras$ymax[i_barra]))
  expect_true(all(textos$hjust == 0))
})
