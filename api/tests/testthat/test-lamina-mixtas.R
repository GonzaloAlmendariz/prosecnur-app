# Láminas de tres y cuatro gráficos del recetario (ADR 0093, N3; recetario_m2b.R).

.mx_cat <- function(rot, pct, n = NULL) preparar_categorica(rot, pct, paste0(round(100 * pct), "%"), n)
.mx_dico <- function(si) {
  df <- data.frame(item = paste0("i", seq_along(si)), actor = c("Docentes", "Estudiantes", "Egresados")[seq_along(si)], N = 100, s1 = si, s2 = 1 - si)
  preparar_escala(df, "item", "N", c("s1", "s2"), c(s1 = "Sí", s2 = "No"), var_etiqueta_categoria = "actor",
                  colores_grupos = list("Sí" = .std_paleta("dicotomica")[1], "No" = .std_paleta("dicotomica")[2]))
}
.mx_xml <- function(doc) {
  out <- tempfile(fileext = ".pptx"); print(doc, target = out)
  xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc))))
}
.mx_off <- function(xml, nombre) {
  sp <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  off <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:off"); ext <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:ext")
  data.frame(x = as.numeric(xml2::xml_attr(off, "x")) / 914400, y = as.numeric(xml2::xml_attr(off, "y")) / 914400,
             w = as.numeric(xml2::xml_attr(ext, "cx")) / 914400, h = as.numeric(xml2::xml_attr(ext, "cy")) / 914400)
}

test_that("las disposiciones tienen los rectángulos del recetario y sus filetes", {
  g <- .lam_mixta_geo("graficos_3_2mas1")
  col2 <- (.std_geom("ancho") - .std_geom("margen_izq") - .std_geom("margen_der") - 0.5) / 2
  expect_length(g$paneles, 3L)
  expect_equal(g$paneles[[3]]$x, .std_geom("margen_izq") + col2 + 0.5)
  expect_equal(g$paneles[[1]]$h, 2.15)
  expect_setequal(vapply(g$filetes, `[[`, "", "tipo"), c("h", "v"))
  g4 <- .lam_mixta_geo("paneles_4")
  expect_length(g4$paneles, 4L)
  expect_equal(g4$paneles[[3]]$y - g4$paneles[[1]]$y, g4$paneles[[1]]$h + 0.35)
  expect_null(.lam_mixta_geo("graficos_3_fila"))
})

test_that("en la cuadrícula las categóricas van en barras de 0.42 in y una categórica de dos opciones va partida", {
  e <- list(.mx_cat(c("Bachiller", "Magister", "Doctor"), c(.19, .73, .08)), .mx_cat(c("A", "B", "C", "D"), c(.4, .3, .2, .1)),
            .mx_cat(c("x", "y", "z"), c(.5, .3, .2)), .mx_cat(c("Sí", "No"), c(.98, .02), c(51, 1)))
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  o <- .lam_laminas_mixta(doc, e, "paneles_4", preguntas = list("Grado", "Dpto", "Edad", "¿Conoce la misión?"),
                          publicos = list("52 respuestas", NULL, NULL, "52 respuestas"), titulo = "Perfil", base = "Base: 52 docentes", folio = 160)
  xml <- .mx_xml(o$doc)
  expect_false(inherits(xml2::xml_find_first(xml, "//p:grpSp[p:nvGrpSpPr/p:cNvPr[@name='prosecnur:grafico:mixta']]"), "xml_missing"))
  b <- .mx_off(xml, "barra")
  expect_equal(nrow(b), 10L)                                       # 3 + 4 + 3; la cuarta es dicotomía
  expect_equal(diff(sort(unique(round(b$y[1:3], 3)))), c(.42, .42), tolerance = 1e-3)
  expect_equal(nrow(.mx_off(xml, "dicotomia:segmento")), 2L)
  expect_equal(nrow(.mx_off(xml, "separador")), 2L)
  expect_identical(xml2::xml_text(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='panel:pregunta']]")),
                   c("Grado", "Dpto", "Edad", "¿Conoce la misión?"))
})

test_that("dos escalas en la misma fila con la misma escala comparten una sola leyenda al pie", {
  likert <- {
    niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo")
    df <- data.frame(item = c("a", "b"), actor = c("Docentes", "Estudiantes"), N = 100, t1 = c(.1, .2), t2 = .2, t3 = .3, t4 = c(.4, .3))
    preparar_escala(df, "item", "N", names(niv), niv, var_etiqueta_categoria = "actor", colores_grupos = as.list(setNames(.std_paleta("likert")[1:4], niv)))
  }
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  o <- .lam_laminas_mixta(doc, list(likert, .mx_dico(c(.98, .77, .78)), .mx_dico(c(.92, .8, .81))), "graficos_3_1arriba",
                          preguntas = list("Tutoría", "Misión", "Dónde"), titulo = "Tutoría y misión", folio = 152)
  xml <- .mx_xml(o$doc)
  ley <- xml2::xml_text(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='leyenda:texto']]"))
  expect_identical(sum(ley == "Sí"), 1L)                           # una leyenda Sí/No para los dos paneles de abajo
  expect_identical(sum(ley == "De acuerdo"), 1L)                   # y la del likert de arriba
  cuadros <- .mx_off(xml, "leyenda:cuadro")
  expect_true(all(cuadros$y[cuadros$y > 5] >= .std_geom("contenido_y1") - 0.1))
})

test_that("la compuerta pide especificación en cada ranura y que el gráfico quepa en su panel", {
  p <- function(e) structure(ggplot2::ggplot(), pulso_espec = e)
  e3 <- list(p(.mx_dico(.31)), p(.mx_cat(as.character(2022:2026), c(.04, .04, .14, .57, .21))), p(.mx_cat(letters[1:6], rep(1 / 6, 6))))
  expect_true(.lam_compositor_aplica_mixta(e3, list(), "graficos_3_2mas1"))
  expect_false(.lam_compositor_aplica_mixta(e3, list(meta = list(motor_nativo = FALSE)), "graficos_3_2mas1"))
  expect_false(.lam_compositor_aplica_mixta(list(e3[[1]], ggplot2::ggplot(), e3[[3]]), list(), "graficos_3_2mas1"))
  largo <- p(.mx_cat(paste("c", 1:12), rep(1 / 12, 12)))
  expect_false(.lam_compositor_aplica_mixta(list(e3[[1]], largo, e3[[3]]), list(), "graficos_3_2mas1"))   # 12 filas no caben abajo
  expect_false(.lam_compositor_aplica_mixta(e3, list(), "graficos_3_fila"))
})

test_that("en la ruta real p_slide_3_graficos_2mas1 y p_slide_4_graficos salen nativas", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  dat <- data.frame(p1 = rep(c("1", "2"), c(31, 69)), p2 = rep(c("a", "b", "c"), c(20, 50, 30)), p3 = rep(c("x", "y", "z", "w"), 25),
                    stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("p1", "p2", "p3"), type = c("select_one sn", "select_one l2", "select_one l3"),
                                   list_name = c("sn", "l2", "l3"), label = c("¿Tiene título?", "Año", "Sueldo"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = c("sn", "sn", "l2", "l2", "l2", "l3", "l3", "l3", "l3"), name = c("1", "2", "a", "b", "c", "x", "y", "z", "w"),
                                    label = c("Sí", "No", "2023", "2024", "2025", "Bajo", "Medio", "Alto", "Muy alto"), stringsAsFactors = FALSE),
               orders_list = NULL)
  plan <- list(a = p_slide_3_graficos_2mas1(p_barras_categoricas("p1"), p_barras_agrupadas("p2"), p_barras_agrupadas("p3"), titulo = "Titulación"),
               b = p_slide_4_graficos(p_barras_agrupadas("p2"), p_barras_agrupadas("p3"), p_barras_agrupadas("p3"), p_barras_categoricas("p1"), titulo = "Perfil"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  for (k in 1:2) {
    xml <- xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k)))
    expect_false(inherits(xml2::xml_find_first(xml, "//p:grpSp[p:nvGrpSpPr/p:cNvPr[@name='prosecnur:grafico:mixta']]"), "xml_missing"))
    preg <- xml2::xml_text(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='panel:pregunta']]"))
    expect_true(all(c("Año", "Sueldo") %in% preg))
    expect_identical(xml2::xml_text(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='Folio lamina']]")), as.character(k))
  }
})
