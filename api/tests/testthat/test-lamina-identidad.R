# Láminas de identidad del recetario (capítulo 1; ADR 0093, N7): separador de capítulo (variante B, láminas 4, 66,
# 116…) y de subcapítulo sobrio (5, 22, 30…).

.id_mazo <- function(plan) {
  df <- data.frame(p = rep(c("a", "b"), 10))
  inst <- list(survey = data.frame(name = "p", type = "select_one l", list_name = "l", label = "P"),
               choices = data.frame(list_name = "l", name = c("a", "b"), label = c("Sí", "No")), orders_list = NULL)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = df, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  lapply(seq_len(length(officer::read_pptx(out))), function(k) xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k))))
}
.id_txt <- function(x, n) xml2::xml_text(xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))

test_that("los separadores se numeran por su orden: capítulos 1, 2… y subcapítulos n.1, n.2… que vuelven a empezar", {
  plan <- list(p_slide_seccion("A"), p_slide_seccion("A1", meta = list(nivel = "subcapitulo")), p_slide_texto("x", texto = "y"),
               p_slide_seccion("B"), p_slide_seccion("B1", meta = list(nivel = "subcapitulo")), p_slide_seccion("B2", meta = list(nivel = "subcapitulo")),
               p_slide_seccion("C", meta = list(numero = "IV", rotulo = "Parte")))
  n <- .lam_secciones_numeradas(plan)
  expect_null(n[[3]])
  expect_identical(vapply(n[-3], `[[`, "", "numero"), c("1", "1.1", "2", "2.1", "2.2", "IV"))
  expect_identical(n[[5]]$capitulo, "B"); expect_identical(n[[7]]$rotulo, "Parte")
})

test_that("el capítulo sale con su rótulo, el filete coral, el título y el subtítulo del recetario (66)", {
  lam <- .id_mazo(list(a = p_slide_seccion("Introducción"), b = p_slide_seccion("Tipos de gráficos", "Cada gráfico sobre la lámina estándar")))
  x <- lam[[2]]
  expect_identical(.id_txt(x, "seccion:rotulo"), "CAPÍTULO 2")
  expect_identical(.id_txt(x, "seccion:titulo"), "Tipos de gráficos")
  expect_identical(.id_txt(x, "seccion:subtitulo"), "Cada gráfico sobre la lámina estándar")
  fil <- xml2::xml_find_first(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='seccion:filete']]//a:srgbClr")
  expect_identical(xml2::xml_attr(fil, "val"), .lam_hex(.std_color("coral")))
  off <- xml2::xml_find_first(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='seccion:titulo']]/p:spPr/a:xfrm/a:off")
  expect_equal(as.numeric(xml2::xml_attr(off, "x")) / 914400, 2.5, tolerance = 0.01)
  expect_equal(as.numeric(xml2::xml_attr(off, "y")) / 914400, 4.42, tolerance = 0.01)
})

test_that("el subcapítulo sobrio lleva la ruta del capítulo y su número en coral (67)", {
  lam <- .id_mazo(list(a = p_slide_seccion("Introducción"), b = p_slide_seccion("Tipos de gráficos"),
                       c = p_slide_seccion("Barras y proporciones", "Categorías y rankings", meta = list(nivel = "subcapitulo"))))
  x <- lam[[3]]
  expect_identical(.id_txt(x, "seccion:ruta"), "CAPÍTULO 2: TIPOS DE GRÁFICOS")
  expect_identical(.id_txt(x, "seccion:numero"), "2.1")
  expect_identical(.id_txt(x, "seccion:titulo"), "Barras y proporciones")
})

test_that("un título que no cabe o motor_nativo = FALSE vuelven al separador de la plantilla", {
  largo <- paste(rep("Un título de capítulo larguísimo", 6), collapse = " ")
  lam <- .id_mazo(list(a = p_slide_seccion(largo), b = p_slide_seccion("Corto", meta = list(motor_nativo = FALSE)), c = p_slide_seccion("Nativo")))
  nativo <- vapply(lam, function(x) "prosecnur:seccion" %in% xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name"), TRUE)
  expect_identical(nativo, c(FALSE, FALSE, TRUE))
  expect_identical(.id_txt(lam[[3]], "seccion:rotulo"), "CAPÍTULO 3")                        # cuenta aunque los anteriores no salgan nativos
})
