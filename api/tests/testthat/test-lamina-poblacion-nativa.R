# Láminas de población con las piezas del recetario (docs/qa/checklist-poblacion-y-filtro-2026-10-14.md). Antes un solo
# panel que no cabía (una torta, una media, seis filas en un panel bajo) mandaba la lámina entera a la plantilla anterior.

.pn_pie <- function(k = 3, forma = "pie") {
  rot <- c("Mujer", "Hombre", "Prefiero no responder", "Otro", "Ninguno")[seq_len(k)]
  list(tipo = "pie", forma = forma, rotulos = rot, valores = rep(1 / k, k), cifras = rep("33%", k))
}

test_that("P1: la torta y la dona caben en un panel mediano y se dibujan como lámina 69 en pequeño", {
  g <- .lam_panel_geo(.pn_pie(3), 0.5, 1.65, 4.31, 2.1, pregunta = "Sexo")
  expect_identical(g$tipo, "circular"); expect_true(g$cabe)
  expect_true(.lam_panel_geo(.pn_pie(2, "donut"), 0.5, 1.65, 3.91, 2.29, pregunta = "¿Conoce la misión?")$cabe)
  expect_false(.lam_panel_geo(.pn_pie(5), 0.5, 1.65, 3.91, 1.2, pregunta = "Sexo")$cabe)            # muy bajo: respaldo
  lz <- .lam_lienzo(); .lam_panel_mixto(lz, .pn_pie(2, "donut"), 0.5, 1.65, 4.31, 2.1, "¿Conoce la misión?")
  xml <- paste(unlist(lz$formas), collapse = "")
  expect_true(grepl("dona:porcion", xml)); expect_true(grepl("dona:cifra", xml))
})

test_that("P2 y D6: una media o mediana sin grupos es una cifra destacada, con su unidad si la pregunta la dice", {
  e <- list(tipo = "numerico", metrica = "median", etiqueta = NULL, rotulos = "Total", cifras = "21.0", n = 172)
  c1 <- .lam_numerico_como_cifra(e)
  expect_identical(c1$tipo, "cifra"); expect_identical(c1$item$valor, "21.0"); expect_identical(c1$item$detalle, "Mediana de 172 respuestas")
  expect_null(.lam_numerico_como_cifra(modifyList(e, list(rotulos = c("A", "B"), cifras = c("1", "2")))))   # con grupos, no
  el <- list(.element_type = "numerico", var = "edad", title_slide = "Edad mediana (años)", overrides = list())
  esp <- lapply(list(structure(ggplot2::ggplot(), pulso_espec = e)), .lam_espec_de)[[1]]
  expect_true(isTRUE(esp$item$desde_numerico))
})

test_that("P3: en un panel ancho y bajo, las categorías que no caben como filas van en columnas", {
  cat6 <- list(tipo = "categorica", rotulos = paste(c("Quinto", "Sexto", "Séptimo", "Octavo", "Noveno", "Décimo"), "ciclo"),
               largos = rep(1 / 6, 6), valores = rep(1 / 6, 6), cifras = rep("17%", 6))
  g <- .lam_panel_geo(cat6, 0.5, 4.3, 12.52, 2.52, pregunta = "Nivel curricular")
  expect_identical(g$tipo, "columnas"); expect_true(g$cabe)
  expect_identical(.lam_panel_geo(cat6, 0.5, 1.65, 4.31, 5.07, pregunta = "Nivel curricular")$tipo, "barras")   # alto: filas
})

test_that("P4: la tira, la de cinco y la de seis tienen la geometría del estándar; la tira, con el enunciado a la izquierda", {
  for (t in c("poblacion_3_tira", "poblacion_5", "poblacion_6")) expect_false(is.null(.lam_mixta_geo(t)), info = t)
  expect_length(.lam_mixta_geo("poblacion_5")$paneles, 5L); expect_length(.lam_mixta_geo("poblacion_6")$paneles, 6L)
  expect_false(is.null(.lam_mixta_geo("poblacion_3_tira")$paneles[[1]]$receta$lateral))
})

test_that("la base que repite el número con otra unidad se cuenta una vez", {
  expect_identical(.lam_bases_sin_repetir(c("Base: 172 estudiantes", "Base: 172 respuestas")), "Base: 172 estudiantes")
  expect_identical(.lam_bases_sin_repetir(c("Base: 172 estudiantes", "Base: 52 respuestas")), c("Base: 172 estudiantes", "Base: 52 respuestas"))
})

test_that("D1: las respuestas resaltadas van en azul y negrita, las demás tenues; sin elegir, un solo color", {
  e <- preparar_categorica(c("Mujer", "Hombre", "Otro"), c(.5, .4, .1), c("50%", "40%", "10%"), resaltar_opciones = "Hombre")
  expect_identical(e$resaltar, "Hombre")
  expect_length(preparar_categorica(c("A", "B"), c(.6, .4), c("60%", "40%"))$resaltar, 0L)
  colores <- function(espec) {
    lz <- .lam_lienzo(); .lam_barras_h(lz, espec, 0.5, 1.5, 6, wlab = 1.5, g = 0.3, fila = 0.5)
    x <- paste(unlist(lz$formas), collapse = "")
    barras <- regmatches(x, gregexpr('name="barra".*?srgbClr val="([0-9A-F]{6})"', x))[[1]]
    sub('.*val="([0-9A-F]{6})"$', "\\1", barras)
  }
  c1 <- colores(e)
  expect_length(unique(c1), 2L)                                               # una azul (Hombre) y dos tenues
  expect_identical(sum(c1 == c1[2]), 1L)
  expect_length(unique(colores(preparar_categorica(c("Mujer", "Hombre", "Otro"), c(.5, .4, .1), c("50%", "40%", "10%")))), 1L)
})

test_that("D1 por la ruta real: `overrides.resaltar_opciones` llega a la lámina nativa", {
  skip_if_not_installed("officer")
  df <- data.frame(s = c(rep("1", 50), rep("2", 40), rep("3", 10)), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = "s", type = "select_one sx", list_name = "sx", label = "Sexo", stringsAsFactors = FALSE),
               choices = data.frame(list_name = "sx", name = c("1", "2", "3"), label = c("Mujer", "Hombre", "Otro"), stringsAsFactors = FALSE), orders_list = NULL)
  inst$orders_list <- .amb_orders_list(inst)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = df, instrumento = inst, path_ppt = out, mensajes_progreso = FALSE,
    plan = list(a = p_slide_1_grafico(p_barras_agrupadas("s", overrides = list(resaltar_opciones = "Hombre")), titulo = "Sexo")))))
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  rot <- xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='rotulo']]")
  negrita <- vapply(rot, function(n) identical(xml2::xml_attr(xml2::xml_find_first(n, ".//a:rPr"), "b"), "1"), TRUE)
  expect_identical(xml2::xml_text(rot)[negrita], "Hombre")
})

test_that("D3: cada gráfico decide si su panel dice sus respuestas; sin decidir, G9 las omite si todas coinciden", {
  skip_if_not_installed("officer")
  set.seed(5)
  df <- data.frame(a = sample(c("1", "2"), 100, TRUE), b = sample(c("1", "2", "3"), 100, TRUE), c = sample(c("1", "2", "3"), 100, TRUE),
                   stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("a", "b", "c"), type = "select_one l3", list_name = "l3", label = c("Pregunta A", "Pregunta B", "Pregunta C"),
                                   stringsAsFactors = FALSE),
               choices = data.frame(list_name = "l3", name = c("1", "2", "3"), label = c("Uno", "Dos", "Tres"), stringsAsFactors = FALSE), orders_list = NULL)
  inst$orders_list <- .amb_orders_list(inst)
  bases_panel <- function(ov_b) {
    out <- tempfile(fileext = ".pptx")
    suppressMessages(suppressWarnings(reporte_ppt_plan(data = df, instrumento = inst, path_ppt = out, mensajes_progreso = FALSE,
      plan = list(x = p_slide_3_graficos_poblacion_corona(superior_izquierda = p_barras_agrupadas("a"), superior_derecha = p_barras_agrupadas("b", overrides = ov_b),
                                                          inferior = p_barras_agrupadas("c"), titulo = "Perfil")))))
    x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
    xml2::xml_text(xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='panel:base']]"))
  }
  expect_length(bases_panel(list()), 0L)                                        # G9: el mismo n, sólo la base de la lámina
  expect_identical(bases_panel(list(mostrar_publico = TRUE)), "100 respuestas")  # este gráfico pide la suya
})
