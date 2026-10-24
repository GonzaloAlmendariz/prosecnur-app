source("setup-load-all.R")

# G6/P4 (checklist-motor-ppt-ccss-2026-10-24): un panel de lámina mixta que no cabe en pieza nativa lleva su gráfico de lienzo
# (ruta de respaldo) bajo el encabezado del panel. El lienzo de `graficar_barras_agrupadas` dibuja su título y su subtítulo con
# `cowplot::draw_text`, que sobreviven a `labs(title = NULL)`: el enunciado salía dos veces, una en el encabezado del panel y
# otra dentro del dibujo. El panel tiene un solo encabezado (el suyo); cifras, orden y colores del gráfico no cambian.

.tsd_cats <- c("Voluntariado", "Académica (grupos de lectura, seminarios temáticos, grupos de estudio, entre otros)", "Deportiva",
               "Política universitaria", "Artística (música, teatro, artes plásticas y/o danza)", "Profesional", "Religiosa",
               "Política nacional", "Entretenimiento (videojuegos, juegos de mesa, entre otros)", "Otros", "Ninguna")
.tsd_pct <- c(.44, .29, .14, .14, .09, .07, .04, .04, .03, .01, .28)

.tsd_agrupada <- function(titulo = "Agrupaciones presenciales", subtitulo = "Pregunta de opción múltiple", ancho = 5.9, alto = 2.6) {
  df <- data.frame(categoria = .tsd_cats, N = 397, pct = .tsd_pct, stringsAsFactors = FALSE)
  suppressWarnings(graficar_barras_agrupadas(
    data = df, var_categoria = "categoria", var_n = "N", cols_porcentaje = "pct", etiquetas_series = c(pct = "Porcentaje"),
    titulo = titulo, subtitulo = subtitulo, mostrar_leyenda = FALSE, exportar = "rplot", usar_canvas = TRUE,
    canvas_min_filas = 7, ancho = ancho, alto = alto))
}
.tsd_textos <- function(g) unname(unlist(lapply(g$layers, function(l) if (inherits(l$geom, "GeomText")) as.character(l$data$text %||% l$data$label))))

test_that("el lienzo de la agrupada marca sus capas de encabezado", {
  g <- .tsd_agrupada()
  expect_true(all(c("pulso_encabezado:titulo", "pulso_encabezado:subtitulo") %in% names(g$layers)), info = paste(names(g$layers), collapse = " | "))
  expect_identical(.tsd_textos(g)[names(g$layers)[vapply(g$layers, function(l) inherits(l$geom, "GeomText"), TRUE)] == "pulso_encabezado:titulo"],
                   "Agrupaciones presenciales")
})

test_that("el respaldo del panel sale sin el título ni el subtítulo del gráfico y conserva rótulos y cifras", {
  g <- .tsd_agrupada()
  lz <- .lam_lienzo()
  r <- .lam_mixta_respaldo_caja(lz, list(x = 0.5, y = 1.5, w = 6, h = 2.8, receta = list()), "Agrupaciones presenciales", NULL, g)
  tx <- .tsd_textos(r$p)
  expect_false("Agrupaciones presenciales" %in% tx)
  expect_false("Pregunta de opción múltiple" %in% tx)
  expect_true(all(c("Voluntariado", "Ninguna", "Otros") %in% tx))
  # Las cifras del gráfico no cambian (las de la capa de barras del lienzo).
  barras <- function(x) unname(Filter(function(l) inherits(l$geom, "GeomDrawGrob"), x$layers))
  expect_identical(barras(.lienzo_sin_encabezado(g)), barras(g))
})

test_that("un lienzo sin marcas pierde sólo el texto que repite el encabezado del panel", {
  g <- cowplot::ggdraw() + cowplot::draw_text("Lugar de nacimiento", x = 0.5, y = 1) + cowplot::draw_text("Lima", x = 0.2, y = 0.5)
  tx <- .tsd_textos(.lienzo_sin_encabezado(g, textos = "Lugar  de nacimiento"))
  expect_identical(tx, "Lima")
  expect_identical(.lienzo_sin_encabezado(g), g)          # sin marcas ni textos, sale como llegó
  p <- ggplot2::ggplot(data.frame(x = 1:3, y = 1:3), ggplot2::aes(x, y)) + ggplot2::geom_point()
  expect_identical(.lienzo_sin_encabezado(p, textos = "x"), p)
})

test_that("en la lámina mixta el enunciado del panel de respaldo se escribe una sola vez", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg"); skip_if_not_installed("xml2")
  nativo <- function() preparar_categorica(c("A", "B", "C"), c(.5, .3, .2), c("50%", "30%", "20%"), NULL)
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  doc <- .lam_laminas_mixta(doc, list(nativo(), nativo(), nativo(), nativo(), nativo()), "poblacion_5",
                            preguntas = list("P1", "P2", "P3", "P4", "Agrupaciones presenciales"), publicos = rep(list(NULL), 5),
                            titulo = "Perfil", base = "Base: 397", folio = 2L, respaldo = list(NULL, NULL, NULL, NULL, .tsd_agrupada()))$doc
  out <- tempfile(fileext = ".pptx"); print(doc, target = out)
  xml <- xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc))))
  todo <- xml2::xml_text(xml2::xml_find_all(xml, "//a:t"))
  expect_equal(sum(todo == "Agrupaciones presenciales"), 1L)
  expect_equal(sum(todo == "Pregunta de opción múltiple"), 0L)
  expect_true(all(c("44%", "28%", "3%") %in% gsub("\\s", "", todo)), info = paste(todo, collapse = " | "))
})

test_that("el re-render del panel que no cabe en la composición va sin título, subtítulo ni nota", {
  el <- structure(list(.element_type = "barras_agrupadas", overrides = list(titulo = "Agrupaciones presenciales", subtitulo = "x", size_ejes = 9)),
                  class = c("ppt_element", "list"))
  s <- .lam_respaldo_el_sin_encabezado(el)
  expect_identical(s$overrides$titulo, ""); expect_identical(s$overrides$subtitulo, ""); expect_identical(s$overrides$nota_pie, "")
  expect_identical(s$overrides$size_ejes, 9)
  expect_s3_class(s, "ppt_element")
})

# A12 (CCSS, `cifras_y_graficos`): el re-render del respaldo no pasaba el alto y el graficador creía tener los 6 in de su firma;
# el envoltorio se calculaba a 12 pt (cuatro líneas) y se dibujaba a 8 pt, montado sobre la fila vecina.
.tsd_a12 <- c("Mis padres o tutores solventan mis estudios", "Trabajo para solventar mis estudios",
              "Por beca de estudios (puede ser beca 18 o alguna otra beca externa a la universidad a la que se haya accedido)",
              "Por préstamo o crédito personal", "Por crédito educativo PUCP", "De otra forma", "No responde")

test_that("el respaldo de cifras_y_graficos recibe el alto real de su cajón", {
  a <- .composicion_alto_respaldo("cifras_y_graficos", 5, "En la actualidad, ¿cómo solventas tus estudios? (Recodificada)", "397 respuestas")
  expect_lte(a, 3.47); expect_gt(a, 2)
  el <- structure(list(.element_type = "barras_agrupadas", overrides = list()), class = c("ppt_element", "list"))
  expect_equal(.lam_respaldo_el_sin_encabezado(el, alto = a)$overrides$alto, a)
  expect_null(.composicion_alto_respaldo("tipo_inexistente", 1))
})

test_that("con los rótulos de A12 en 6.1 x 2.59 in las líneas caben en su fila al cuerpo con que se dibujan", {
  df <- data.frame(categoria = .tsd_a12, N = 397, pct = c(.84, .13, .13, .02, .01, 0, 0), stringsAsFactors = FALSE)
  g <- suppressMessages(suppressWarnings(graficar_barras_agrupadas(
    data = df, var_categoria = "categoria", var_n = "N", cols_porcentaje = "pct", etiquetas_series = c(pct = "Porcentaje"),
    mostrar_leyenda = FALSE, exportar = "rplot", usar_canvas = TRUE, size_ejes = 12, canvas_min_filas = 7,
    canvas_w_etiquetas = 0.45, canvas_w_bars = 0.52, canvas_w_extra = 0, ancho = 6.1, alto = 2.59)))
  ly <- attr(g, "pulso_barras_agrupadas_layout")
  skip_if(is.na(.chars_que_caben("abc", 1, 10)), "sin systemfonts no se mide")
  # Las categorías en cero no se dibujan: la fila es el alto del panel (el cajón menos la fila superior de 0.18 in, sin cabecera
  # ni leyenda) entre las filas dibujadas.
  dibujadas <- .tsd_a12[df$pct > 0]
  expect_equal(ly$n_categorias, length(dibujadas))
  lineas <- .agrupadas_lineas_eje(dibujadas, ly$ancho_max_eje_y_eff)
  expect_lte(lineas * ly$size_ejes_eff * 1.2 / 72, (2.59 - 0.18) / ly$n_categorias + 1e-6)
  expect_gte(ly$size_ejes_eff, 8)
  expect_equal(attr(g, "pulso_espec")$cifras, attr(suppressMessages(suppressWarnings(graficar_barras_agrupadas(
    data = df, var_categoria = "categoria", var_n = "N", cols_porcentaje = "pct", etiquetas_series = c(pct = "Porcentaje"),
    mostrar_leyenda = FALSE, exportar = "rplot", usar_canvas = TRUE, ancho = 6.1, alto = 6))), "pulso_espec")$cifras)
})

test_that("el alto real sólo se pasa cuando los rótulos, como se dibujaron, se montarían en la fila del cajón", {
  ag <- function(cats, pct, ...) suppressMessages(suppressWarnings(graficar_barras_agrupadas(
    data = data.frame(categoria = cats, N = 397, pct = pct, stringsAsFactors = FALSE), var_categoria = "categoria", var_n = "N",
    cols_porcentaje = "pct", etiquetas_series = c(pct = "Porcentaje"), mostrar_leyenda = FALSE, exportar = "rplot",
    usar_canvas = TRUE, size_ejes = 12, canvas_min_filas = 7, ancho = 6.1, ...)))
  expect_true(.lam_respaldo_rotulos_solapan(ag(.tsd_a12, c(.84, .13, .13, .02, .01, 0, 0)), 2.59))       # A12: hoy se monta
  cortos <- c("Principal", "Asociado", "Auxiliar", "Jefe de Práctica", "Contratado")
  expect_false(.lam_respaldo_rotulos_solapan(ag(cortos, c(.03, .11, .17, .29, .42)), 1.4))              # Arte p. 2: hoy cabe
  expect_false(.lam_respaldo_rotulos_solapan(ggplot2::ggplot(), 1))
  expect_false(.lam_respaldo_rotulos_solapan(NULL, 1))
})
