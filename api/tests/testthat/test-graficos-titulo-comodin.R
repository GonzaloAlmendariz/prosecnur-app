source("setup-load-all.R")

# Q2-9: una lámina de resumen sin título con `vars = base$*` salía con «*» en coral: el título automático tomaba el
# «nombre de la variable» de la ref comodín. Sin título, la lámina sale sin título.

.tc_fuentes <- function() {
  inst <- list(survey = data.frame(name = paste0("p", 1:3), type = "select_one lk", list_name = "lk",
                                   label = c("Reglamentos", "Biblioteca", "Salud"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = "lk", name = c("1", "2", "3", "4"),
                                    label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo"),
                                    stringsAsFactors = FALSE), orders_list = NULL)
  d <- data.frame(p1 = rep(c("1", "2", "3", "4"), 5), p2 = rep(c("3", "4", "4", "2"), 5), p3 = rep(c("1", "1", "3", "4"), 5),
                  stringsAsFactors = FALSE)
  list(data_sources = list(docentes = d, estudiantes = d), inst_sources = list(docentes = inst, estudiantes = inst))
}

test_that("titulo_var no inventa un título para el comodín", {
  expect_null(titulo_var("*"))
  expect_null(titulo_var("docentes$*"))
  expect_identical(titulo_var("p1", dic_vars = data.frame(name = "p1", label = "Reglamentos")), "Reglamentos")
})

test_that("un panorama y una escala con base$* y sin título salen sin título, nunca con «*»", {
  skip_if_not_installed("officer")
  src <- .tc_fuentes()
  plan <- p_plan(slides = list(
    p_slide_1_grafico(p_panorama(vars = c("docentes$*", "estudiantes$*"), corte = c("3", "4"))),
    p_slide_1_grafico(p_barras_divergentes(vars = "docentes$*", estilo = "resumen", regla = list(tipo = "todas")))))
  out <- tempfile(fileext = ".pptx"); on.exit(unlink(out), add = TRUE)
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                                     path_ppt = out, mensajes_progreso = FALSE)))
  for (k in 1:2) {
    x <- xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k)))
    tit <- xml2::xml_text(xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='Titulo lamina']]"))
    expect_false(any(trimws(tit) %in% c("*", "docentes$*")), label = paste("lámina", k))
    textos <- xml2::xml_text(xml2::xml_find_all(x, "//a:t"))
    expect_false(any(trimws(textos) %in% c("*", "docentes$*", "estudiantes$*")), label = paste("lámina", k))
  }
})

test_that("la base de una lámina con base$* se calcula sobre las preguntas de escala de cada público, sin aviso", {
  skip_if_not_installed("officer")
  src <- .tc_fuentes()
  src$data_sources$estudiantes <- src$data_sources$estudiantes[1:12, ]
  plan <- p_plan(slides = list(p_slide_1_grafico(p_panorama(vars = c("docentes$*", "estudiantes$*"), corte = c("3", "4")), titulo = "P"),
                               p_slide_1_grafico(p_barras_divergentes(vars = "docentes$*", estilo = "resumen", regla = list(tipo = "todas")),
                                                 titulo = "E")))
  out <- tempfile(fileext = ".pptx"); on.exit(unlink(out), add = TRUE)
  avisos <- character(0)
  withCallingHandlers(suppressMessages(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                                        path_ppt = out, mensajes_progreso = FALSE)),
                      warning = function(w) { avisos <<- c(avisos, conditionMessage(w)); invokeRestart("muffleWarning") })
  expect_false(any(grepl("base", avisos, ignore.case = TRUE)))
  base <- function(k) xml2::xml_text(xml2::xml_find_all(xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k))),
                                                        "//p:sp[p:nvSpPr/p:cNvPr[@name='Base lamina']]"))
  expect_match(base(1), "^Base: 20 docentes y 12 estudiantes\\.")
  expect_match(base(2), "^Base: 20 docentes\\.")
})
