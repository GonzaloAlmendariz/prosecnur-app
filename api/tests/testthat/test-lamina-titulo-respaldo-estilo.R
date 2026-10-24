source("setup-load-all.R")

# CCSS Perfil 2026 (CCSS-19): en la ruta de respaldo, el título del gráfico que se conserva (dice otra cosa que el título de la
# lámina) salía en el coral centrado del preset, mientras el encabezado de un panel nativo va en azul, negrita y a la izquierda
# (`.lam_panel_titulo`, lamina_paneles.R). Con el marco estándar toma el estilo del encabezado nativo (lamina_titulo_lienzo.R).

.tre_lienzo <- function() {
  df <- data.frame(cat = c("A", "B", "C"), N = 100, p = c(.5, .3, .2))
  suppressWarnings(suppressMessages(graficar_barras_agrupadas(df, var_categoria = "cat", var_n = "N", cols_porcentaje = "p",
    etiquetas_series = c(p = "Total"), titulo = "Agrupaciones presenciales", color_titulo = .std_color("coral"),
    usar_canvas = TRUE, exportar = "rplot", ancho = 12, alto = 5)))
}
.tre_capa <- function(g) g$layers[[which(names(g$layers) == "pulso_encabezado:titulo")]]

test_that("con marco estándar el título conservado va en azul, negrita y a la izquierda", {
  m <- list(activo = TRUE, titulo = "El voluntariado es la agrupación más frecuente", sub = NULL)
  l <- .tre_capa(.lam_respaldo_grafico(.tre_lienzo(), m))
  expect_equal(toupper(l$aes_params$colour), toupper(.std_color("azul")))
  expect_equal(l$aes_params$fontface, "bold")
  expect_equal(l$aes_params$hjust, 0)
  expect_lt(l$data$x, 0.1)
})

test_that("sin marco estándar (plantilla propia) el título no se toca", {
  l <- .tre_capa(.lam_respaldo_grafico(.tre_lienzo(), list(activo = FALSE)))
  expect_equal(toupper(l$aes_params$colour), toupper(.std_color("coral")))
  expect_equal(l$aes_params$hjust, 0.5)
})

# CCSS-27 y CCSS-28 (ronda R11): el encabezado alineado a la izquierda arrancaba ~0.11 in antes que el título de la lámina y
# quedaba pegado a su segunda línea. Ahora arranca en el borde del texto del título (margen + sangría de 0.1 in) y el cajón
# deja aire bajo el bloque de título.
test_that("el encabezado arranca en el borde del texto del título de la lámina", {
  pic <- list(left = 0.5, top = 1.6, width = 12.3, height = 5)
  m <- list(activo = TRUE, titulo = "Otro título", sub = NULL, pic = pic)
  l <- .tre_capa(.lam_respaldo_grafico(.tre_lienzo(), m))
  esperado <- (.std_geom("margen_izq") + .LAM_SANGRIA_TXT - pic$left) / pic$width
  expect_equal(l$data$x, esperado, tolerance = 1e-6)
})

test_that("con encabezado de panel el cajón deja aire bajo el título de la lámina", {
  pic <- list(left = 0.5, top = 1.0, width = 12.3, height = 5.5)
  m <- .lam_respaldo_marco(TRUE, "El voluntariado es la agrupación presencial más frecuente y 28 % no participa en ninguna", NULL, NULL, NULL)
  m$pic <- pic
  p <- .lam_respaldo_grafico(.tre_lienzo(), m)
  sp <- .lam_respaldo_cajon(list(), m, pic, p)
  expect_gte(sp$loc$top, .lam_titulo_fin(m$titulo, NULL) + 0.2)
})
