source("setup-load-all.R")

# L10-6 y L10-7 (bandeja CCSS, 2026-10-24): el mapa de calor de una pregunta por un cruce y la serie por los niveles de
# un cruce ordinal dentro de una base. Calculan con los helpers del motor y declaran su base.

.l10v_inst <- function() list(
  survey = data.frame(name = c("niv", "car", "p", "t"), type = c("select_one nv", "select_one cr", "select_one lk", "select_one sn"),
                      list_name = c("nv", "cr", "lk", "sn"), label = c("Nivel", "Carrera", "Afirmación", "Trabaja"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = c(rep("nv", 3), rep("cr", 2), rep("lk", 3), rep("sn", 2)),
                       name = c("8", "6", "7", "1", "2", "1", "2", "3", "1", "2"),
                       label = c("VIII", "VI", "VII", "Economía", "Derecho", "Nada", "Algo", "Mucho", "Sí", "No"), stringsAsFactors = FALSE),
  orders_list = list(niv = list(names = c("8", "6", "7"), labels = c("VIII", "VI", "VII"), label = "Nivel"),
                     car = list(names = c("1", "2"), labels = c("Economía", "Derecho"), label = "Carrera"),
                     p = list(names = c("1", "2", "3"), labels = c("Nada", "Algo", "Mucho"), label = "Afirmación"),
                     t = list(names = c("1", "2"), labels = c("Sí", "No"), label = "Trabaja")))
# Nivel 6: 2 de 4 trabajan; nivel 7: 1 de 4; nivel 8: 3 de 4. Carrera 1: p = 1,1,2,3; carrera 2: p = 3,3,3,3 (y 4 más).
.l10v_dat <- function() data.frame(
  niv = rep(c("6", "7", "8"), each = 4), car = rep(c("1", "2", "2"), each = 4),
  p = c("1", "1", "2", "3", "3", "3", "3", "3", "3", "3", "3", "3"), t = c("1", "1", "2", "2", "1", "2", "2", "2", "1", "1", "1", "2"),
  stringsAsFactors = FALSE)

.l10v_ruta <- function(el) {
  plan <- list(a = p_slide_1_grafico(grafico = el, titulo = "L10"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = .l10v_dat(), instrumento = .l10v_inst(), plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
}
.l10v_txt <- function(xml, n) xml2::xml_text(xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))

test_that("L10-6: p_dim_heatmap con una pregunta como objetivo sale como tabla de calor pregunta × cruce, nativa y con base", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  xml <- .l10v_ruta(p_dim_heatmap(modo = "general", objetivo = "p", cruce = "car"))
  expect_identical(.l10v_txt(xml, "calor:fila"), c("Total (12*)", "Economía (4*)", "Derecho (8*)"))   # Total y grupos, en filas
  expect_identical(.l10v_txt(xml, "calor:columna"), c("Nada", "Algo", "Mucho"))                       # opciones en su orden
  expect_identical(.l10v_txt(xml, "calor:cifra"), c("17%", "8%", "75%", "50%", "25%", "25%", "0%", "0%", "100%"))
  expect_identical(.l10v_txt(xml, "calor:escala_rotulo"), "% de cada fila")
  expect_match(paste(xml2::xml_text(xml2::xml_find_all(xml, "//a:t")), collapse = " "), "Base: 12 casos que respondieron")
  expect_false(any(grepl("Sin datos", xml2::xml_text(xml2::xml_find_all(xml, "//a:t")))))
})

test_that("L10-6: un objetivo que no es dimensión ni pregunta se avisa con su motivo", {
  args <- list(data = .l10v_dat(), instrumento = .l10v_inst(), modo = "general", objetivo = "no_existe", cruce = "car", filtros = list())
  expect_message(expect_error(.heatmap_dim_o_pregunta(args, function() stop("sin dimensiones")), "sin dimensiones"),
                 "no es una dimensión de Analítica ni una pregunta")
})

.l10v_sources <- function() {
  list(data_sources = list(b = .l10v_dat()), inst_sources = list(b = .l10v_inst()))
}

test_that("L10-7: la serie por niveles sigue el orden del instrumento y declara los casos de cada nivel", {
  d <- .serie_cruce_datos(list(Trabaja = "b$t"), "1", "b$niv", .l10v_sources())
  expect_identical(levels(d$grupo), c("VIII", "VI", "VII"))                 # orden de la lista del instrumento
  expect_equal(d$valor[match(c("VI", "VII", "VIII"), d$grupo)], c(50, 25, 75))
  expect_equal(d$n_casos, c(4, 4, 4))
  expect_identical(.serie_cruce_nota(d), "Casos que respondieron, por nivel: VIII: 4 · VI: 4 · VII: 4.")
  # `grupos` fija el orden del eje.
  d2 <- .serie_cruce_datos(list(Trabaja = "b$t"), "1", "b$niv", .l10v_sources(), grupos = c("6", "7", "8"))
  expect_identical(levels(d2$grupo), c("VI", "VII", "VIII"))
})

test_that("L10-7: p_serie_temporal con cruce arma su elemento sin exigir varias bases y la ruta real dibuja un punto por nivel", {
  el <- p_serie_temporal(vars = list(Trabaja = "t"), corte = "1", cruce = "niv", grupos = c("6", "7", "8"))
  expect_identical(el$cruce, "niv"); expect_identical(el$grupos, c("6", "7", "8"))
  expect_error(p_serie_temporal(vars = list("t"), corte = "1", cruce = "niv"), "lista nombrada")
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  xml <- .l10v_ruta(el)
  expect_match(paste(xml2::xml_text(xml2::xml_find_all(xml, "//a:t")), collapse = " "), "Casos que respondieron, por nivel: VI: 4")
})
