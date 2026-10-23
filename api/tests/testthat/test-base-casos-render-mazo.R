source("setup-load-all.R")

# Contrato base-sin-ponderar F6, §4 («sin ponderación: cero cambio visible») sobre el render real: el mismo plan
# (escala con Top Two Box y base chica, agrupada, torta) sale byte a byte igual con y sin los argumentos de casos
# (`var_n_casos` / `cols_n_casos`, `.plan_args_casos`) cuando la base no tiene peso. Con peso, lo que se cuenta va en
# casos («13 de 20» bajo un Top Two Box ponderado) y la ruta sin casos (el mutante) escribiría la suma de pesos.

.bcm_inst <- function() {
  ch <- data.frame(list_name = "acuerdo", name = c("1", "2", "3", "4"),
                   label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo"),
                   stringsAsFactors = FALSE)
  ch2 <- data.frame(list_name = "sexo", name = c("1", "2"), label = c("Masculino", "Femenino"), stringsAsFactors = FALSE)
  list(survey = data.frame(name = c("p1", "p2", "sexo"), type = c("select_one acuerdo", "select_one acuerdo", "select_one sexo"),
                           list_name = c("acuerdo", "acuerdo", "sexo"), stringsAsFactors = FALSE),
       choices = rbind(ch, ch2), orders_list = NULL)
}
.bcm_data <- function(peso = NULL) {
  set.seed(3)
  d <- data.frame(p1 = sample(c("1", "2", "3", "4"), 20, TRUE), p2 = sample(c("1", "2", "3", "4"), 20, TRUE),
                  sexo = sample(c("1", "2"), 20, TRUE), stringsAsFactors = FALSE)
  if (!is.null(peso)) d$peso <- peso
  d
}
.bcm_plan <- function() {
  p_plan(slides = list(
    p_slide_1_grafico(titulo = "Escala", grafico = p_barras_multiapiladas(
      modo = "var", vars = c("p1", "p2"),
      mostrar_respuestas = TRUE,   # «x de y» y «N respuestas» salen solo con el interruptor (default apagado desde N3b/N3c)
      overrides = list(barra_extra_preset = "top2box", top2box_labels = c("De acuerdo", "Totalmente de acuerdo")))),
    p_slide_1_grafico(titulo = "Sexo", grafico = p_barras_agrupadas("sexo")),
    p_slide_1_grafico(titulo = "Torta", grafico = p_pie("sexo"))
  ))
}
.bcm_ppt <- function(d) {
  out <- withr::local_tempfile(fileext = ".pptx")
  suppressWarnings(suppressMessages(
    reporte_ppt_plan(data = d, instrumento = .bcm_inst(), plan = .bcm_plan(), path_ppt = out, mensajes_progreso = FALSE)))
  partes <- grep("^ppt/slides/slide[0-9]+\\.xml$", utils::unzip(out, list = TRUE)$Name, value = TRUE)
  stats::setNames(lapply(partes, function(p) .leer_parte_zip(out, p)), partes)
}
.bcm_textos <- function(xml) regmatches(xml, gregexpr("(?<=<a:t>)[^<]*(?=</a:t>)", xml, perl = TRUE))[[1]]

test_that("sin pesos el PPT es byte a byte el de la ruta sin casos (escala, agrupada, torta)", {
  skip_if_not_installed("officer")
  con_casos <- .bcm_ppt(.bcm_data())
  local_mocked_bindings(.plan_args_casos = function(base_args) base_args)
  sin_casos <- .bcm_ppt(.bcm_data())
  expect_length(con_casos, 3L)
  expect_identical(con_casos, sin_casos)
})

test_that("con pesos «x de y», «(n)» y «n de N respuestas» van en casos; el % ponderado", {
  skip_if_not_installed("officer")
  peso <- c(rep(2.25, 10), rep(0.5, 10))   # 20 casos que suman 27.5
  xml <- .bcm_ppt(.bcm_data(peso))
  escala <- .bcm_textos(xml[["ppt/slides/slide1.xml"]])
  # Base chica (20 < 30): todas las filas dicen «x de 20», en casos.
  de <- grep("^[0-9]+ de [0-9]+$", escala, value = TRUE)
  expect_length(de, 2L)
  expect_true(all(grepl(" de 20$", de)))
  expect_true("Base: 20" %in% escala)
  torta <- .bcm_textos(xml[["ppt/slides/slide3.xml"]])
  expect_true(all(grepl(" de 20 respuestas$", grep(" de [0-9]+ respuestas$", torta, value = TRUE))))
  # El mutante (sin los argumentos de casos) escribe la suma de pesos (27.5 -> «de 28»).
  local_mocked_bindings(.plan_args_casos = function(base_args) base_args)
  mut <- .bcm_ppt(.bcm_data(peso))
  expect_true(any(grepl(" de 28$", .bcm_textos(mut[["ppt/slides/slide1.xml"]]))))
})

test_that("sin pesos el Word (document.xml y PNG de las figuras) es byte a byte el de la ruta sin casos", {
  skip_if_not_installed("officer"); skip_if_not_installed("flextable")
  word <- function() {
    out <- withr::local_tempfile(fileext = ".docx", .local_envir = parent.frame())
    suppressWarnings(suppressMessages(
      reporte_word_plan(data = .bcm_data(), instrumento = .bcm_inst(), plan = .bcm_plan(), path_docx = out,
                        mensajes_progreso = FALSE)))
    partes <- utils::unzip(out, list = TRUE)$Name
    media <- sort(grep("^word/media/.*\\.png$", partes, value = TRUE))
    dir <- withr::local_tempdir(.local_envir = parent.frame())
    utils::unzip(out, files = media, exdir = dir)
    list(doc = .leer_parte_zip(out, "word/document.xml"),
         png = unname(tools::md5sum(file.path(dir, media))))
  }
  con_casos <- word()
  local_mocked_bindings(.plan_args_casos = function(base_args) base_args)
  sin_casos <- word()
  expect_gt(length(con_casos$png), 0L)
  expect_identical(con_casos$doc, sin_casos$doc)
  expect_identical(con_casos$png, sin_casos$png)
})
