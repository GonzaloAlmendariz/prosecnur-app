source("setup-load-all.R")

# L10-12 (bandeja CCSS, 2026-10-24; lámina 48 del mazo V2): la lámina de cifras y gráficos juntaba en el pie la base de
# cada pieza, «Base: 136. Base: 397 respuestas», aunque cada cifra ya trae la suya. Regla de las grillas
# (`.lam_grilla_base`, lamina_grilla_nativa.R): las cifras llevan su base debajo y no entran al pie; entre los gráficos,
# con bases iguales va una sola «Base:» y con bases distintas cada panel lleva la suya y el pie no afirma ninguna.

# 60 casos: 20 trabajan; la jornada sólo la responden ellos (20); la experiencia la responden todos.
.l10bc_dat <- function() data.frame(
  t = rep(c("1", "2"), c(20, 40)), j = c(rep(c("1", "2"), 10), rep(NA, 40)), e = rep(c("1", "2", "2"), 20), stringsAsFactors = FALSE)
.l10bc_inst <- function() list(
  survey = data.frame(name = c("t", "j", "e"), type = c("select_one sn", "select_one jo", "select_one sn"), list_name = c("sn", "jo", "sn"),
                      label = c("Trabaja", "Jornada", "Experiencia"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = c("sn", "sn", "jo", "jo"), name = c("1", "2", "1", "2"), label = c("Sí", "No", "Completa", "Medio tiempo"),
                       stringsAsFactors = FALSE),
  orders_list = list(t = list(names = c("1", "2"), labels = c("Sí", "No"), label = "Trabaja"),
                     j = list(names = c("1", "2"), labels = c("Completa", "Medio tiempo"), label = "Jornada"),
                     e = list(names = c("1", "2"), labels = c("Sí", "No"), label = "Experiencia")))
.l10bc_lamina <- function(gi, gd) {
  s <- p_slide_cifras_y_graficos(
    cifra_izquierda = p_cifra("t", "porcentaje", categoria = "1", rotulo = "trabaja"),
    cifra_centro = p_cifra("j", "porcentaje", categoria = "2", rotulo = "de quienes trabajan lo hace a medio tiempo"),
    cifra_derecha = p_cifra("e", "porcentaje", categoria = "1", rotulo = "tiene experiencia"),
    grafico_izquierda = gi, grafico_derecha = gd, titulo = "Trabajo")
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = .l10bc_dat(), instrumento = .l10bc_inst(), plan = p_plan(slides = list(s)),
                                                     path_ppt = out, mensajes_progreso = FALSE)))
  xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
}
.l10bc_txt <- function(xml, n) xml2::xml_text(xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))

test_that("L10-12: con los dos gráficos sobre la misma base el pie dice una sola «Base:», sin la de las cifras", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  xml <- .l10bc_lamina(p_donut("t", titulo = "Trabaja"), p_donut("e", titulo = "Experiencia"))
  base <- .l10bc_txt(xml, "Base lamina")
  expect_length(base, 1L)
  expect_identical(lengths(regmatches(base, gregexpr("Base:", base, fixed = TRUE))), 1L)   # una sola «Base:»
  expect_match(base, "^Base: 60\\b")
  expect_false(grepl("\\b20\\b", base))                                                   # la de la jornada no
  # La cifra de la jornada conserva la suya debajo («10 de 20»).
  expect_identical(.l10bc_txt(xml, "cifra:detalle"), c("20 de 60", "10 de 20", "20 de 60"))
})

test_that("L10-12: con gráficos de bases distintas cada panel lleva la suya y el pie no afirma ninguna", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  xml <- .l10bc_lamina(p_donut("t", titulo = "Trabaja"), p_donut("j", titulo = "Jornada"))
  base <- .l10bc_txt(xml, "Base lamina")
  expect_false(any(grepl("Base:", base, fixed = TRUE)))
  todo <- paste(xml2::xml_text(xml2::xml_find_all(xml, "//a:t")), collapse = " | ")
  expect_match(todo, "60 respuestas"); expect_match(todo, "20 respuestas")              # cada panel, la suya
})
