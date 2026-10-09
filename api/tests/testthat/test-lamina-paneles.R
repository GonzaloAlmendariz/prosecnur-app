# ADR 0093 (N2) — la lámina de dos gráficos del recetario (lámina 133): pregunta sobre cada panel, Likert
# compacto, filete vertical entre columnas y una sola leyenda.

.dn <- c(s1 = "Sí", s2 = "No")
.espec_si_no <- function(si) {
  d <- data.frame(item = paste0("a", seq_along(si)), actor = c("Docentes", "Estudiantes", "Egresados", "Administrativos")[seq_along(si)],
                  N = 100, s1 = si / 100, s2 = 1 - si / 100)
  preparar_escala(d, "item", "N", c("s1", "s2"), .dn, var_etiqueta_categoria = "actor",
                  colores_grupos = as.list(setNames(.std_paleta("dicotomica"), .dn)))
}
.doc_pan <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.formas_pan <- function(doc, nombre) {
  x <- doc$slide$get_slide(doc$cursor)$get()
  sp <- xml2::xml_find_all(x, sprintf("//p:grpSp[p:nvGrpSpPr/p:cNvPr[@name='prosecnur:grafico:paneles']]/p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  off <- xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:off")
  data.frame(x = as.numeric(xml2::xml_attr(off, "x")) / 914400, y = as.numeric(xml2::xml_attr(off, "y")) / 914400,
             texto = xml2::xml_text(sp))
}

test_that("dos paneles en las ranuras del estándar, filete al medio y una sola leyenda", {
  doc <- .lam_laminas_paneles(.doc_pan(), list(.espec_si_no(c(98, 77, 78, 93)), .espec_si_no(c(92, 80, 81, 100))),
                              list("¿Conoce la misión?", "¿Sabe dónde consultarla?"), "p_slide_2_graficos",
                              "Conocimiento de la misión", ante = "Dos gráficos", base = "Base: 100", folio = 3)
  preg <- .formas_pan(doc, "panel:pregunta")
  r <- Filter(function(z) identical(z$tipo, "grafico"), .std_tipo_lamina("p_slide_2_graficos")$ranuras)
  expect_equal(sort(preg$x), sort(vapply(r, function(z) z$x, 0)), tolerance = 0.01)
  sep <- .formas_pan(doc, "separador")
  expect_equal(nrow(sep), 1L)
  expect_equal(sep$x, (r[[1]]$x + r[[1]]$w + r[[2]]$x) / 2, tolerance = 0.01)
  expect_identical(sort(unique(.formas_pan(doc, "leyenda:texto")$texto)), c("No", "Sí"))
  expect_equal(nrow(.formas_pan(doc, "leyenda:texto")), 2L)   # una sola leyenda para la lámina
  expect_equal(nrow(.formas_pan(doc, "panel:rotulo")), 8L)
})

test_that("se compone nativa sólo con especificaciones de escala de la misma escala y que caben", {
  pa <- ggplot2::ggplot(); attr(pa, "pulso_espec") <- .espec_si_no(c(90, 80))
  pb <- ggplot2::ggplot(); attr(pb, "pulso_espec") <- .espec_si_no(c(70, 60))
  expect_true(.lam_compositor_aplica_paneles(list(pa, pb)))
  expect_false(.lam_compositor_aplica_paneles(list(pa, pb), list(meta = list(motor_nativo = FALSE))))
  expect_false(.lam_compositor_aplica_paneles(list(pa, ggplot2::ggplot())))
  otra <- .espec_si_no(c(70, 60)); otra$categorias$rotulo <- c("Conoce", "No conoce")
  pc <- ggplot2::ggplot(); attr(pc, "pulso_espec") <- otra
  expect_false(.lam_compositor_aplica_paneles(list(pa, pc)))   # dos escalas: dos leyendas, aún no
})

test_that("en la ruta real p_slide_2_graficos con dos apiladas sale nativa y con el folio de su posición", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  niveles <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo")
  dat <- data.frame(p1 = rep(niveles, c(4, 10, 40, 46)), p2 = rep(niveles, c(10, 20, 30, 40)), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("p1", "p2"), type = "select_one esc", list_name = "esc", label = c("Pregunta uno", "Pregunta dos"),
                                   stringsAsFactors = FALSE),
               choices = data.frame(list_name = "esc", name = niveles, label = niveles, stringsAsFactors = FALSE), orders_list = NULL)
  plan <- list(a = p_slide_texto(titulo = "Antes", texto = "x"),
               b = p_slide_2_graficos(izquierda = p_barras_apiladas("p1"), derecha = p_barras_apiladas("p2"), titulo = "Dos"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, plan = plan,
    presets = p_presets(barras_apiladas = .PRESETS_DEFAULT_PULSO$barras_apiladas), path_ppt = out, mensajes_progreso = FALSE)))
  doc <- officer::read_pptx(out)
  xml <- xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc))))
  expect_false(inherits(xml2::xml_find_first(xml, "//p:grpSp[p:nvGrpSpPr/p:cNvPr[@name='prosecnur:grafico:paneles']]"), "xml_missing"))
  folio <- xml2::xml_text(xml2::xml_find_first(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='Folio lamina']]"))
  expect_identical(folio, as.character(length(doc)))
  preg <- xml2::xml_text(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='panel:pregunta']]"))
  expect_identical(preg, c("Pregunta uno", "Pregunta dos"))
})

test_that("en la ruta real p_slide_2_graficos_vertical sale nativa, apilada, con el antetítulo de su sección (lámina 142)", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  niveles <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo")
  dat <- data.frame(p1 = rep(niveles, c(4, 10, 40, 46)), p2 = rep(niveles, c(10, 20, 30, 40)), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("p1", "p2"), type = "select_one esc", list_name = "esc", label = c("Pregunta uno", "Pregunta dos"),
                                   stringsAsFactors = FALSE),
               choices = data.frame(list_name = "esc", name = niveles, label = niveles, stringsAsFactors = FALSE), orders_list = NULL)
  plan <- list(s = p_slide_seccion(titulo = "Servicios"),
               v = p_slide_2_graficos_vertical(superior = p_barras_apiladas("p1"), inferior = p_barras_apiladas("p2"), titulo = "Tutoría"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, plan = plan,
    presets = p_presets(barras_apiladas = .PRESETS_DEFAULT_PULSO$barras_apiladas), path_ppt = out, mensajes_progreso = FALSE)))
  doc <- officer::read_pptx(out)
  xml <- xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc))))
  g <- xml2::xml_find_first(xml, "//p:grpSp[p:nvGrpSpPr/p:cNvPr[@name='prosecnur:grafico:paneles']]")
  expect_false(inherits(g, "xml_missing"))
  txt <- function(n) xml2::xml_text(xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
  expect_identical(txt("Antetitulo lamina"), "SERVICIOS")
  expect_identical(txt("Folio lamina"), as.character(length(doc)))
  preg <- xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='panel:pregunta']]")
  y <- as.numeric(xml2::xml_attr(xml2::xml_find_first(preg, "p:spPr/a:xfrm/a:off"), "y"))
  x <- as.numeric(xml2::xml_attr(xml2::xml_find_first(preg, "p:spPr/a:xfrm/a:off"), "x"))
  expect_length(preg, 2L)
  expect_identical(xml2::xml_text(preg), c("Pregunta uno", "Pregunta dos"))   # verificador de N2: no salían vacías
  expect_equal(x[1], x[2])            # apilados: misma columna
  expect_gt(y[2], y[1])
})

test_that("la lámina apilada acorta la fila para caber sobre la base; si ni con la barra mínima cabe, va por la ruta anterior", {
  # Verificador de N2: con tres públicos por panel la fila fija de 0.72 sacaba la leyenda de la lámina.
  e3 <- .espec_si_no(c(90, 80, 70)); e2 <- .espec_si_no(c(60, 50))
  expect_true(isTRUE(.lam_vertical_geo(list(e3, e2))$cabe))
  doc <- .lam_laminas_vertical(.doc_pan(), list(e3, e2), list("Pregunta A", "Pregunta B"), "Cinco barras", base = "Base", folio = 1)
  x <- doc$slide$get_slide(doc$cursor)$get()
  sp <- xml2::xml_find_all(x, "//p:grpSp[p:nvGrpSpPr/p:cNvPr[@name='prosecnur:grafico:paneles']]/p:sp")
  fondo <- max((as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:off"), "y")) +
                as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:ext"), "cy"))) / 914400)
  expect_lte(fondo, .std_geom("base_y") - 0.05)
  # tres y tres: no cabe ni con la barra de 0.24 in → la compuerta deja la lámina en la ruta anterior
  pa <- ggplot2::ggplot(); attr(pa, "pulso_espec") <- e3
  pb <- ggplot2::ggplot(); attr(pb, "pulso_espec") <- .espec_si_no(c(60, 50, 40))
  expect_false(.lam_compositor_aplica_paneles(list(pa, pb), tipo = "p_slide_2_graficos_vertical"))
  # y la geometría de dos columnas no decide por la apilada
  expect_true(.lam_compositor_aplica_paneles(list(pa, pb), tipo = "p_slide_2_graficos"))
})

test_that("dentro de los paneles la batería de afirmaciones se ordena por Top Two Box y un cruce no", {
  niv <- c(t1 = "TD", t2 = "D", t3 = "A", t4 = "TA")
  bat <- function() {
    d <- data.frame(item = c("x", "y", "z"), rotulo = c("Uno", "Dos", "Tres"), N = 100,
                    t1 = c(.3, .1, .2), t2 = c(.2, .1, .2), t3 = c(.3, .4, .3), t4 = c(.2, .4, .3))
    preparar_escala(d, "item", "N", paste0("t", 1:4), niv, var_etiqueta_categoria = "rotulo",
                    barra_extra_preset = "top2box", top2box_labels = c("A", "TA"))
  }
  ps <- lapply(1:2, function(k) { p <- ggplot2::ggplot(); attr(p, "pulso_espec") <- bat(); p })
  slide <- list(slots = list(base = "Base"), meta = list())
  sin_base <- function(...) NULL; sin_nota <- function(...) NULL
  orden_de <- function(els) {
    doc <- .lam_slide_paneles_nativa(.doc_pan(), ps, els, slide, "Paneles", presets = list(), layout = "Graficos2",
                                     master = "Office Theme", antetitulo = NULL, base_auto = sin_base, nota_de = sin_nota)
    x <- doc$slide$get_slide(doc$cursor)$get()
    sp <- xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='panel:rotulo']]")
    xs <- as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:off"), "x"))
    ys <- as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:off"), "y"))
    t <- xml2::xml_text(sp)[xs == min(xs)]; t[order(ys[xs == min(xs)])]
  }
  bateria <- list(.element_type = "barras_multiapiladas", modo = "var", var = NULL)
  expect_identical(orden_de(list(bateria, bateria)), c("Dos", "Tres", "Uno"))     # 80, 60, 50
  cruce <- list(.element_type = "barras_apiladas", var = NULL)
  expect_identical(orden_de(list(cruce, cruce)), c("Uno", "Dos", "Tres"))
})

test_that("en la lámina apilada la batería de afirmaciones también se ordena por Top Two Box", {
  niv <- c(t1 = "TD", t2 = "D", t3 = "A", t4 = "TA")
  bat <- function() {
    d <- data.frame(item = c("x", "y", "z"), rotulo = c("Uno", "Dos", "Tres"), N = 100,
                    t1 = c(.3, .1, .2), t2 = c(.2, .1, .2), t3 = c(.3, .4, .3), t4 = c(.2, .4, .3))
    preparar_escala(d, "item", "N", paste0("t", 1:4), niv, var_etiqueta_categoria = "rotulo",
                    barra_extra_preset = "top2box", top2box_labels = c("A", "TA"))
  }
  rendered <- lapply(1:2, function(k) { p <- ggplot2::ggplot(); attr(p, "pulso_espec") <- bat(); p })
  els <- rep(list(list(.element_type = "barras_multiapiladas", modo = "var", var = NULL, overrides = list(titulo = "P"))), 2)
  doc <- .lam_composicion_nativa(.doc_pan(), "graficos_2_vertical", rendered, els, list(slots = list(base = "Base"), title = "V", meta = list()))
  x <- doc$slide$get_slide(doc$cursor)$get()
  sp <- xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='panel:rotulo']]")
  ys <- as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:off"), "y"))
  t <- xml2::xml_text(sp)[order(ys)]
  expect_identical(t[1:3], c("Dos", "Tres", "Uno"))   # primer bloque: 80, 60, 50
})
