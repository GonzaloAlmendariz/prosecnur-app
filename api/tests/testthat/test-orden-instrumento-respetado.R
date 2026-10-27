# D4 (CCSS Perfil 2026): «Nivel curricular» (códigos 6, 7, 8, 9 = VI, VII, VIII, IX) salía por frecuencia (VII, VI,
# VIII, IX) en `p_barras_categoricas` y en `p_donut`, aunque «instrumento» es el default y además se pasaba explícito.
# Invariante: un `orden_barras` / `ordenar_categorias` / `orden_categorias` EXPLÍCITO «instrumento» manda siempre; nada
# reordena después. Esta prueba mira la lámina terminada (el orden en que se LEE), no la traducción intermedia.

.oir_etq <- c("VI", "VII", "VIII", "IX")
.oir_cod <- c("6", "7", "8", "9")

.oir_render <- function(el) {
  # VII es la más frecuente: por frecuencia saldría VII, VI, VIII, IX.
  dat <- data.frame(nivel_curricular = as.integer(rep(.oir_cod, c(119, 122, 97, 59))))
  inst <- list(survey = data.frame(type = "select_one niv", name = "nivel_curricular", label = "Nivel curricular",
                                   list_name = "niv", stringsAsFactors = FALSE),
               choices = data.frame(list_name = "niv", name = .oir_cod, label = .oir_etq, stringsAsFactors = FALSE),
               orders_list = list(nivel_curricular = list(names = .oir_cod, labels = .oir_etq)))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, path_ppt = out, mensajes_progreso = FALSE,
                                                     plan = list(s = p_slide_1_grafico(grafico = el, titulo = "T")))))
  x <- xml2::read_xml(.pptx_leer_parte(out, .pptx_slide_paths(out)[1]))
  s <- xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='rotulo' or @name='dona:rotulo_leyenda']]")
  num <- function(a) as.numeric(xml2::xml_attr(xml2::xml_find_first(s, ".//a:off"), a))
  xml2::xml_text(s)[order(num("y"), num("x"))]
}

test_that("barras categóricas: VI, VII, VIII, IX por defecto, con orden_barras y con orden_categorias «instrumento»", {
  skip_if_not_installed("officer")
  expect_identical(.oir_render(p_barras_categoricas("nivel_curricular")), .oir_etq)
  expect_identical(.oir_render(p_barras_categoricas("nivel_curricular", overrides = list(orden_barras = "instrumento"))), .oir_etq)
  el <- p_barras_categoricas("nivel_curricular"); el$orden_categorias <- list(modo = "instrumento")
  expect_identical(.oir_render(el), .oir_etq)
})

test_that("dona: VI, VII, VIII, IX por defecto y con ordenar_categorias «instrumento» explícito", {
  skip_if_not_installed("officer")
  expect_identical(.oir_render(p_donut("nivel_curricular")), .oir_etq)
  expect_identical(.oir_render(p_donut("nivel_curricular", overrides = list(ordenar_categorias = "instrumento"))), .oir_etq)
})

test_that("el orden del instrumento manda aunque la lista no tenga pista ordinal (nominal, explícito)", {
  skip_if_not_installed("officer")
  # Con rótulos nominales el recetario ordenaría por frecuencia; el «instrumento» explícito no.
  etq <- c("Lima", "Arequipa", "Cusco", "Piura")
  dat <- data.frame(nivel_curricular = as.integer(rep(.oir_cod, c(119, 122, 97, 59))))
  inst <- list(survey = data.frame(type = "select_one niv", name = "nivel_curricular", label = "Ciudad", list_name = "niv",
                                   stringsAsFactors = FALSE),
               choices = data.frame(list_name = "niv", name = .oir_cod, label = etq, stringsAsFactors = FALSE),
               orders_list = list(nivel_curricular = list(names = .oir_cod, labels = etq)))
  for (el in list(p_barras_categoricas("nivel_curricular", overrides = list(orden_barras = "instrumento")),
                  p_donut("nivel_curricular", overrides = list(ordenar_categorias = "instrumento")))) {
    out <- tempfile(fileext = ".pptx")
    suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, path_ppt = out, mensajes_progreso = FALSE,
                                                       plan = list(s = p_slide_1_grafico(grafico = el, titulo = "T")))))
    x <- xml2::read_xml(.pptx_leer_parte(out, .pptx_slide_paths(out)[1]))
    s <- xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='rotulo' or @name='dona:rotulo_leyenda']]")
    num <- function(a) as.numeric(xml2::xml_attr(xml2::xml_find_first(s, ".//a:off"), a))
    expect_identical(xml2::xml_text(s)[order(num("y"), num("x"))], etq, info = el$.element_type)
  }
})
