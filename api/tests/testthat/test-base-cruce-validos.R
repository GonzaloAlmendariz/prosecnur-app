source("setup-load-all.R")

# CCSS Perfil 2026 (CCSS-16, revisión metodológica): en los cruces los % se calculan sobre los casos válidos en la variable Y
# en el cruce (cada grupo con su n), pero el pie «Base:» contaba sólo los válidos de la variable: con 21 NA en el cruce decía
# 397 donde las barras suman 376. El pie cuenta ahora los casos con la variable válida y el cruce con valor (reporte_plan_base_cruce.R).

.bc_render <- function(el) {
  set.seed(5); n <- 200
  g <- sample(c("A", "B"), n, TRUE); g[1:15] <- NA
  dat <- data.frame(id = seq_len(n), p1 = sample(c("Sí", "No"), n, TRUE), g = g, stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(type = c("integer", "select_one sn", "select_one gr"), name = c("id", "p1", "g"),
                                   label = c("id", "¿Tiene beca?", "Grupo"), list_name = c(NA, "sn", "gr"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = c("sn", "sn", "gr", "gr"), name = c("Sí", "No", "A", "B"),
                                    label = c("Sí", "No", "A", "B"), stringsAsFactors = FALSE))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, path_ppt = out, mensajes_progreso = FALSE,
                                                     plan = list(s = p_slide_1_grafico(grafico = el, titulo = "T")))))
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  t <- vapply(xml2::xml_find_all(x, "//p:sp"), function(s) paste(xml2::xml_text(xml2::xml_find_all(s, ".//a:t")), collapse = ""), "")
  t[grepl("^Base", t)]
}

test_that("el pie de un cruce cuenta los válidos en la variable y en el cruce", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  for (el in list(p_barras_agrupadas("p1", cruces = "g"), p_barras_apiladas("p1", cruces = "g"))) {
    b <- .bc_render(el)
    expect_true(any(grepl("185", b)), info = paste(b, collapse = " | "))
    expect_false(any(grepl("200", b)), info = paste(b, collapse = " | "))
  }
})

test_that("sin cruce el pie sigue contando sólo la variable", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  expect_true(any(grepl("200", .bc_render(p_barras_agrupadas("p1")))))
})
