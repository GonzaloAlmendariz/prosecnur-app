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
  expect_equal(x[1], x[2])            # apilados: misma columna
  expect_gt(y[2], y[1])
})
