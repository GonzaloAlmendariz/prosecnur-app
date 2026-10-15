source("setup-load-all.R")

# K12a (dirección F6 §4.3c): una etiqueta corta por pregunta o premisa es contenido de la lámina y el instrumento no
# cambia. El motor sólo la oía en las multi-apiladas por variable (`overrides$etiquetas_vars`, alias `titulos_grupo`);
# `labels_override` de la analítica no llegaba (`.title_of_var` lo fijaba en NULL). Aquí se prueba el mismo canal
# —`overrides$etiquetas_vars` del gráfico, {variable: etiqueta}— en las láminas nativas y en el Word.

.ec_niv <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo")
.ec_largo <- "La institución cuenta con mecanismos efectivos para recoger y atender las opiniones de sus estudiantes"

.ec_fixture <- function() {
  set.seed(9); n <- 120
  df <- data.frame(p1 = sample(.ec_niv, n, TRUE), p2 = sample(.ec_niv, n, TRUE),
                   sexo = sample(c("Mujer", "Hombre"), n, TRUE), grado = sample(c("Magíster", "Doctor(a)"), n, TRUE),
                   dep = sample(c("Lima", "Cusco", "Puno"), n, TRUE), anios = sample(c("Menos de 2", "Más de 2"), n, TRUE),
                   stringsAsFactors = FALSE)
  vars <- names(df)
  ln <- c(p1 = "esc", p2 = "esc", sexo = "sx", grado = "gr", dep = "dp", anios = "an")
  inst <- list(
    survey = data.frame(name = vars, type = paste("select_one", ln[vars]), list_name = unname(ln[vars]),
                        label = c(.ec_largo, "Los docentes publican sus horarios de atención", "Sexo del encuestado",
                                  "Máximo grado académico alcanzado por el docente", "Departamento", "Años"), stringsAsFactors = FALSE),
    choices = data.frame(list_name = c(rep("esc", 4), "sx", "sx", "gr", "gr", "dp", "dp", "dp", "an", "an"),
                         name = c(.ec_niv, "Mujer", "Hombre", "Magíster", "Doctor(a)", "Lima", "Cusco", "Puno", "Menos de 2", "Más de 2"),
                         label = c(.ec_niv, "Mujer", "Hombre", "Magíster", "Doctor(a)", "Lima", "Cusco", "Puno", "Menos de 2", "Más de 2"),
                         stringsAsFactors = FALSE),
    orders_list = NULL, label_col_survey = "label", label_col_choices = "label", lang = "es")
  list(df = df, inst = inst)
}

.ec_plan <- function(cortas = TRUE) {
  ov <- function(x) if (cortas) list(etiquetas_vars = x) else list()
  list(
    a = p_slide_1_grafico(grafico = p_barras_apiladas("p1", overrides = ov(list(p1 = "Escucha a sus estudiantes"))), titulo = "Una escala"),
    b = p_slide_4_graficos_poblacion(p_barras_categoricas("dep"), p_barras_categoricas("anios"),
                                     p_barras_categoricas("sexo", overrides = ov(list(sexo = "Sexo"))),
                                     p_barras_categoricas("grado", overrides = ov(list(grado = "Grado"))), titulo = "Perfil"),
    c = p_slide_1_grafico(titulo = "Multilista", grafico = p_barras_multiapiladas(
      modo = "multilista", top2box = TRUE, top2box_labels = .ec_niv[3:4],
      bloques = list(list(modo = "var", vars = c("p1", "p2"), titulo = "Bloque",
                          titulos_grupo = if (cortas) list(p2 = "Horarios publicados") else NULL)),
      overrides = ov(list(p1 = "Escucha a sus estudiantes"))))
  )
}

.ec_textos_ppt <- function(path) {
  vapply(.pptx_slide_paths(path), function(s) {
    paste(xml2::xml_text(xml2::xml_find_all(xml2::read_xml(.pptx_leer_parte(path, s)), "//a:t")), collapse = " | ")
  }, "", USE.NAMES = FALSE)
}

test_that("la etiqueta corta de overrides$etiquetas_vars llega a la escala, a la población y a la multilista nativas", {
  f <- .ec_fixture()
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, plan = .ec_plan(), path_ppt = out,
    presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO), mensajes_progreso = FALSE)))
  estados <- vapply(.pptx_slide_paths(out), function(s) .pptx_lamina_estado(.pptx_leer_parte(out, s)), "", USE.NAMES = FALSE)
  expect_true(all(estados == "nativa"))
  txt <- .ec_textos_ppt(out)
  expect_match(txt[1], "Escucha a sus estudiantes", fixed = TRUE)
  expect_false(grepl("mecanismos efectivos", txt[1], fixed = TRUE))
  expect_match(txt[2], "| Sexo |", fixed = TRUE)
  expect_match(txt[2], "| Grado |", fixed = TRUE)
  expect_match(txt[2], "Departamento", fixed = TRUE)                                  # sin etiqueta corta, la del instrumento
  expect_false(grepl("Máximo grado académico", txt[2], fixed = TRUE))
  expect_match(txt[3], "Escucha a sus estudiantes", fixed = TRUE)
  expect_match(txt[3], "Horarios publicados", fixed = TRUE)                            # titulos_grupo del bloque sigue mandando
  expect_identical(getOption("prosecnur.plan_etiquetas_cortas"), NULL)                # no queda puesta tras el mazo
})

test_that("sin etiquetas cortas el mazo sale como antes: el rótulo es el del instrumento", {
  f <- .ec_fixture()
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, plan = .ec_plan(cortas = FALSE), path_ppt = out,
    presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO), mensajes_progreso = FALSE)))
  txt <- .ec_textos_ppt(out)
  expect_match(gsub("\\s+", " ", txt[1]), "mecanismos efectivos", fixed = TRUE)
  expect_match(txt[2], "Máximo grado académico", fixed = TRUE)
})

test_that("la etiqueta corta llega también al Word: el rótulo de cada panel de la población", {
  f <- .ec_fixture()
  word_txt <- function(plan) {
    out <- tempfile(fileext = ".docx")
    suppressMessages(suppressWarnings(reporte_word_plan(data = f$df, instrumento = f$inst, plan = plan, path_docx = out,
      presets_ppt = do.call(p_presets, .PRESETS_DEFAULT_PULSO), mensajes_progreso = FALSE)))
    d <- tempfile(); utils::unzip(out, exdir = d)
    x <- xml2::read_xml(file.path(d, "word/document.xml"))
    xml2::xml_text(xml2::xml_find_all(x, "//w:t"))
  }
  con <- word_txt(.ec_plan()["b"])
  sin <- word_txt(.ec_plan(cortas = FALSE)["b"])
  expect_true(any(grepl("Máximo grado académico", sin, fixed = TRUE)))             # el Word sí escribe el rótulo del panel
  expect_false(any(grepl("Máximo grado académico", con, fixed = TRUE)))
  expect_true("Grado" %in% trimws(con))
  expect_true(any(grepl("Departamento", con, fixed = TRUE)))
})

# Verificador de K12a: en una lámina SIN título, el PPT tomaba el título del instrumento y el Word el de la etiqueta
# corta. El título que el motor deriva de la variable usa la etiqueta corta en los dos formatos.
test_that("una lámina sin título toma la etiqueta corta como título en el PPT y en el Word", {
  f <- .ec_fixture()
  plan <- list(a = p_slide_1_grafico(grafico = p_barras_apiladas("p1", overrides = list(etiquetas_vars = list(p1 = "Escucha a sus estudiantes")))),
               b = p_slide_1_grafico(grafico = p_barras_categoricas("grado", overrides = list(etiquetas_vars = list(grado = "Grado")))))
  pres <- do.call(p_presets, .PRESETS_DEFAULT_PULSO)
  ppt <- tempfile(fileext = ".pptx"); docx <- tempfile(fileext = ".docx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, plan = plan, presets = pres, path_ppt = ppt, mensajes_progreso = FALSE)))
  suppressMessages(suppressWarnings(reporte_word_plan(data = f$df, instrumento = f$inst, plan = plan["a"], presets_ppt = pres, path_docx = docx, mensajes_progreso = FALSE)))
  titulos <- vapply(.pptx_slide_paths(ppt), function(s) .pptx_lamina_titulo(.pptx_leer_parte(ppt, s)), "", USE.NAMES = FALSE)
  expect_identical(toupper(titulos[1]), toupper("Escucha a sus estudiantes"))
  expect_identical(toupper(titulos[2]), toupper("Grado"))
  d <- tempfile(); utils::unzip(docx, exdir = d)
  ps <- xml2::xml_text(xml2::xml_find_all(xml2::read_xml(file.path(d, "word/document.xml")), "//w:p"))
  expect_true(any(grepl("Escucha a sus estudiantes", ps, fixed = TRUE)))
  expect_false(any(grepl("mecanismos efectivos", ps, fixed = TRUE)))
})

# Verificador de K12a (mutante M12a4): una clave calificada vale sólo para su base.
test_that("la etiqueta corta calificada «docentes$p5» no se aplica a «estudiantes$p5»; la simple vale para ambas y la calificada gana", {
  withr::local_options(prosecnur.plan_etiquetas_cortas = list(`docentes$p5` = "Corta docentes"))
  expect_identical(.plan_etiquetas_cortas_vigentes("docentes"), list(p5 = "Corta docentes"))
  expect_null(.plan_etiquetas_cortas_vigentes("estudiantes"))
  expect_null(.plan_etiquetas_cortas_vigentes(NA))
  withr::local_options(prosecnur.plan_etiquetas_cortas = list(p5 = "Simple", `docentes$p5` = "Corta docentes"))
  expect_identical(.plan_etiquetas_cortas_vigentes("docentes")$p5, "Corta docentes")
  expect_identical(.plan_etiquetas_cortas_vigentes("estudiantes")$p5, "Simple")
})

test_that("en un mazo de dos bases, la etiqueta calificada sólo cambia la lámina de su base", {
  niv <- .ec_niv; set.seed(4)
  df <- function(n) data.frame(p5 = sample(niv, n, TRUE), stringsAsFactors = FALSE)
  ins <- function() list(survey = data.frame(name = "p5", type = "select_one esc", list_name = "esc", label = .ec_largo, stringsAsFactors = FALSE),
                         choices = data.frame(list_name = "esc", name = niv, label = niv, stringsAsFactors = FALSE),
                         orders_list = NULL, label_col_survey = "label", label_col_choices = "label", lang = "es")
  ov <- list(etiquetas_vars = list(`docentes$p5` = "Corta docentes"))
  plan <- list(a = p_slide_1_grafico(grafico = p_barras_apiladas("docentes$p5", overrides = ov), titulo = "Docentes"),
               b = p_slide_1_grafico(grafico = p_barras_apiladas("estudiantes$p5", overrides = ov), titulo = "Estudiantes"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = list(docentes = df(60), estudiantes = df(150)), instrumento = list(docentes = ins(), estudiantes = ins()),
    plan = plan, path_ppt = out, presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO), mensajes_progreso = FALSE)))
  txt <- .ec_textos_ppt(out)
  expect_match(txt[1], "Corta docentes", fixed = TRUE)
  expect_false(grepl("Corta docentes", txt[2], fixed = TRUE))
  expect_match(gsub("\\s+", " ", txt[2]), "mecanismos efectivos", fixed = TRUE)
})

# Verificador de K12a (mutante M6): las ramas «dos gráficos con texto» (text_r2, text_l2) también derivan el título
# del primer gráfico con su etiqueta corta.
test_that("una lámina de dos gráficos con texto, sin título, toma la etiqueta corta del primer gráfico", {
  f <- .ec_fixture(); ov <- list(etiquetas_vars = list(sexo = "Sexo corto"))
  for (fn in list(p_slide_2_graficos_texto_derecha, p_slide_2_graficos_texto_izquierda)) {
    plan <- list(b = fn(p_barras_categoricas("sexo", overrides = ov), p_barras_categoricas("grado"), texto = "Un texto"))
    ppt <- tempfile(fileext = ".pptx")
    suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, plan = plan, presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO),
                                                       path_ppt = ppt, mensajes_progreso = FALSE)))
    expect_identical(toupper(.pptx_lamina_titulo(.pptx_leer_parte(ppt, .pptx_slide_paths(ppt)[[1]]))), "SEXO CORTO")
  }
})

# Sin preset que pida versales, el título de una lámina va como se escribió: el mazo mezclaba «Histograma (p81)» con
# «HISTOGRAMA POR GRUPOS (P81)» según el gráfico saliera nativo o no (catálogo del recetario, 2026-10-14).
test_that("sin preset de versales, el título de la lámina conserva mayúsculas y minúsculas", {
  f <- .ec_fixture()
  plan <- list(b = p_slide_2_graficos_texto_derecha(p_barras_categoricas("sexo"), p_barras_categoricas("grado"),
                                                    texto = "Un texto", titulo = "Sexo y grado"))
  ppt <- tempfile(fileext = ".pptx")
  presets <- .PRESETS_DEFAULT_PULSO
  presets$base$mayusculas_titulo_slide <- NULL
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, plan = plan, presets = do.call(p_presets, presets),
                                                     path_ppt = ppt, mensajes_progreso = FALSE)))
  expect_identical(.pptx_lamina_titulo(.pptx_leer_parte(ppt, .pptx_slide_paths(ppt)[[1]])), "Sexo y grado")
})
