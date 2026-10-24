source("setup-load-all.R")
source("test-lamina-bloque-titulo.R", local = TRUE)

# P2 (checklist-motor-ppt-ccss-2026-10-24, CCSS Perfil 2026 lámina 37): la agrupada de once categorías de opción múltiple va por
# la ruta de respaldo (el gráfico entra como lienzo). Dos defectos de forma:
#  1. El título del lienzo («Agrupaciones presenciales») se dibuja centrado en el borde superior del cajón —la mitad de su alto
#     sobresale— y con un título de lámina de dos líneas quedaba pegado a la segunda línea.
#     Decisión: con el marco estándar el título del gráfico se SUPRIME cuando repite el título o el subtítulo de la lámina (sería
#     el mismo texto dos veces) y se BAJA cuando dice otra cosa (es la pregunta y el titular no la nombra): el cajón cede lo que
#     el título sobresale del lienzo. No choca nunca.
#  2. Los rótulos se envolvían a 32 caracteres en una columna de 5,5 in y, con tres líneas por fila, se encogían al piso de 8 pt
#     mientras sobraba ancho. Ahora se ensancha (se envuelve con el ancho real de la columna) antes de encoger.
# Cifras, denominadores, orden y colores no cambian.

.tgl_cats <- c("Voluntariado", "Académica (grupos de lectura, seminarios temáticos, grupos de estudio, entre otros)", "Deportiva",
               "Política universitaria", "Artística (música, teatro, artes plásticas y/o danza)", "Profesional", "Religiosa",
               "Política nacional", "Entretenimiento (videojuegos, juegos de mesa, entre otros)", "Otros", "Ninguna")
.tgl_pct <- c(.44, .29, .14, .14, .09, .07, .04, .04, .03, .01, .28)
.tgl_lamina37 <- function(cats = .tgl_cats, titulo = "Agrupaciones presenciales", ...) {
  df <- data.frame(categoria = cats, N = 397, pct = .tgl_pct[seq_along(cats)], stringsAsFactors = FALSE)
  suppressWarnings(graficar_barras_agrupadas(
    data = df, var_categoria = "categoria", var_n = "N", cols_porcentaje = "pct", etiquetas_series = c(pct = "Porcentaje"),
    titulo = titulo, subtitulo = "Pregunta de opción múltiple", mostrar_leyenda = FALSE, exportar = "rplot", usar_canvas = TRUE,
    size_ejes = 12, canvas_min_filas = 7, alto_por_categoria = 0.64, canvas_w_etiquetas = 0.45, canvas_w_bars = 0.52, canvas_w_extra = 0,
    canvas_h_header_in = 0.52, encabezado_separacion_in = 0.52, encabezado_desplazamiento_in = 0.03, size_titulo = 16, size_subtitulo = 10,
    textos_negrita = c("titulo", "subtitulo", "valores", "etiquetas"), ancho = 12.51, alto = 5.51, ...))
}
.tgl_titulo2 <- "El voluntariado es la agrupación presencial más frecuente y 28 % no participa en ninguna"
.tgl_textos <- function(g) unlist(lapply(g$layers, function(l) if (inherits(l$geom, "GeomText")) as.character(l$data$text %||% l$data$label)))
.tgl_fin_bloque <- function(titulo) .std_geom("titulo_y") + 0.06 + max(1, .lam_titulo_lineas(titulo)) * .std_pt("titulo") * 1.2 / 72 + 0.05

test_that("el título del lienzo se suprime cuando repite el de la lámina y se conserva cuando dice otra cosa", {
  g <- .tgl_lamina37()
  repite <- .lam_respaldo_marco(TRUE, "Agrupaciones  presenciales", NULL, NULL, g)
  expect_false("Agrupaciones presenciales" %in% .tgl_textos(.lam_respaldo_grafico(g, repite)))
  expect_true("Pregunta de opción múltiple" %in% .tgl_textos(.lam_respaldo_grafico(g, repite)))   # el subtítulo no repite nada
  por_sub <- .lam_respaldo_marco(TRUE, .tgl_titulo2, "Agrupaciones presenciales", NULL, g)
  expect_false("Agrupaciones presenciales" %in% .tgl_textos(.lam_respaldo_grafico(g, por_sub)))
  otro <- .lam_respaldo_marco(TRUE, .tgl_titulo2, NULL, NULL, g)
  conservado <- .lam_respaldo_grafico(g, otro)   # se conserva, con el estilo del encabezado nativo (CCSS-19)
  expect_true("Agrupaciones presenciales" %in% .tgl_textos(conservado))
  expect_equal(length(conservado$layers), length(g$layers))
  expect_identical(.lam_respaldo_grafico(g, .lam_respaldo_marco(FALSE, "Agrupaciones presenciales", NULL, NULL, g)), g)   # plantilla propia
})

test_that("lo que el título del lienzo sobresale del cajón se mide", {
  g <- .tgl_lamina37()
  d <- .lienzo_desborde_superior_in(g, 5.4)
  expect_gt(d, 0.08); expect_lt(d, 0.3)        # 16 pt centrados en el borde: la mitad de su alto, algo más de 0.1 in
  expect_equal(.lienzo_desborde_superior_in(.lienzo_sin_encabezado(g), 5.4), 0)
  p <- ggplot2::ggplot(data.frame(x = 1:3, y = 1:3), ggplot2::aes(x, y)) + ggplot2::geom_point()
  expect_equal(.lienzo_desborde_superior_in(p, 5), 0)
})

test_that("con título de lámina de dos líneas el cajón baja lo que sobresale el título del gráfico", {
  g <- .tgl_lamina37()
  m <- .lam_respaldo_marco(TRUE, .tgl_titulo2, NULL, NULL, g)
  pic <- list(left = 0.4, top = 1.2, width = 12.5, height = 5.5)
  s <- .lam_respaldo_cajon(list(), m, pic, g)
  d <- .lienzo_desborde_superior_in(g, s$loc$height)
  expect_gte(s$loc$top - d, .tgl_fin_bloque(.tgl_titulo2) + 0.08 - 1e-3)
  expect_equal(s$loc$top + s$loc$height, pic$top + pic$height, tolerance = 1e-6)   # el fondo no se mueve
  # Un título de una línea con el cajón de la plantilla holgado no mueve nada (sin gráfico, como antes).
  m1 <- .lam_respaldo_marco(TRUE, "Título corto", NULL, NULL, g)
  expect_identical(.lam_respaldo_cajon(list(a = 1), m1, list(left = 0.4, top = 1.5, width = 12.5, height = 5), g), list(a = 1))
  expect_identical(.lam_respaldo_cajon(list(a = 1), m1, list(left = 0.4, top = 1.2, width = 12.5, height = 5)),
                   .lam_respaldo_cajon(list(a = 1), m1, list(left = 0.4, top = 1.2, width = 12.5, height = 5), NULL))
})

test_that("por la ruta real, con un título de dos líneas, el título del gráfico queda bajo el de la lámina", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg"); skip_if_not_installed("stringr")
  c <- .bt_cajas(.bt_render(.bt_agrupada(), titulo = .tgl_titulo2))
  graf <- c[grepl("^tx[0-9]+$", c$nombre), ]
  expect_gt(nrow(graf), 0)
  expect_gte(min(graf$y), .tgl_fin_bloque(.tgl_titulo2) + 0.05)
})

test_that("los rótulos largos se envuelven con el ancho de su columna antes de encoger al piso", {
  g <- .tgl_lamina37()
  ly <- attr(g, "pulso_barras_agrupadas_layout")
  expect_gte(ly$size_ejes_eff, 10)                       # antes: 8 pt, el piso
  expect_gt(ly$ancho_max_eje_y_eff, 32)                  # antes: 32 caracteres en una columna de 5.5 in
  lineas <- .agrupadas_lineas_eje(.tgl_cats, ly$ancho_max_eje_y_eff)
  expect_lte(lineas, 2L)
  # el rótulo envuelto cabe en la columna
  ancho_col <- 12.51 * ly$canvas_w_etiquetas_eff - 0.12
  envueltos <- unlist(strsplit(stringr::str_wrap(.tgl_cats, ly$ancho_max_eje_y_eff), "\n", fixed = TRUE))
  anchos <- .ancho_texto_in(envueltos, ly$size_ejes_eff)
  skip_if(all(is.na(anchos)), "sin systemfonts no se mide")
  expect_true(all(anchos <= ancho_col + 1e-6))
  # Cifras y orden no cambian.
  expect_identical(attr(g, "pulso_espec")$cifras, attr(.tgl_lamina37(), "pulso_espec")$cifras)
})

test_that("rótulos que ya caben no cambian de cuerpo ni de envoltorio", {
  cortos <- c("Voluntariado", "Deportiva", "Profesional", "Religiosa", "Otros", "Ninguna")
  ly <- attr(.tgl_lamina37(cats = cortos), "pulso_barras_agrupadas_layout")
  expect_equal(ly$size_ejes_eff, 12)
})

test_that("el ajuste conjunto de rótulos devuelve el mayor cuerpo que cabe o NULL sin poder medir", {
  r <- .agrupadas_rotulos_ensanchar(.tgl_cats, ancho_columna_in = 5.5, size_pt = 12, n_categorias = 11, alto_in = 5.51, lineheight = 1.2)
  skip_if(is.null(r), "sin systemfonts no se mide")
  expect_true(r$size >= 10 && r$size <= 12)
  expect_null(.agrupadas_rotulos_ensanchar(.tgl_cats, ancho_columna_in = NA, size_pt = 12, n_categorias = 11, alto_in = 5.51))
})
