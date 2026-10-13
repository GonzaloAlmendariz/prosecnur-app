source("setup-load-all.R")

# G11 (2026-10-13): la nube sale con el ranking de las diez palabras más mencionadas en piezas editables (lámina 101).
.nube_fx <- function() {
  set.seed(4)
  frases <- c("más cursos prácticos", "mercado laboral", "habilidades blandas", "mejorar la malla", "proyectos reales",
              "cursos de gestión", "laboral y mercado", "proyectos interdisciplinarios", "cursos electivos", "mejorar talleres",
              "experiencia práctica", "vinculación externa")
  list(df = data.frame(txt = sample(frases, 131, TRUE), stringsAsFactors = FALSE),
       inst = list(survey = data.frame(name = "txt", type = "text", list_name = NA, label = "¿Qué cambiaría?", stringsAsFactors = FALSE),
                   choices = data.frame(list_name = character(), name = character(), label = character()), orders_list = NULL))
}

test_that("el espec de la nube trae las diez palabras más dichas, en orden, y cuántas respuestas hubo", {
  fx <- .nube_fx()
  e <- attr(graficar_nube_palabras(fx$df, var_texto = "txt"), "pulso_espec")
  expect_length(e$ranking$palabras, 10L)
  expect_false(is.unsorted(rev(e$ranking$n)))
  expect_identical(e$ranking$respuestas, 131L)
  expect_null(attr(graficar_nube_palabras(fx$df, var_texto = "txt", mostrar_ranking = FALSE), "pulso_espec")$ranking)
})

test_that("la lámina dibuja el ranking en piezas editables; sin él, la nube sola", {
  skip_if_not_installed("officer")
  fx <- .nube_fx()
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = fx$df, instrumento = fx$inst, path_ppt = out, mensajes_progreso = FALSE,
    plan = p_plan(slides = list(p_slide_1_grafico(p_nube_palabras("txt"), titulo = "Con ranking"),
                                p_slide_1_grafico(p_nube_palabras("txt", mostrar_ranking = FALSE), titulo = "Sola"))))))
  txt <- function(k, n) xml2::xml_text(xml2::xml_find_all(xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k))),
                                                          sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
  expect_length(txt(1, "ranking:palabra"), 10L)
  expect_identical(txt(1, "ranking:respuestas"), "131 respuestas abiertas")
  expect_length(txt(2, "ranking:palabra"), 0L)
  expect_identical(vapply(.preview_partes(out)$partes, `[[`, "", "estado"), c("nativa", "marco"))
})
