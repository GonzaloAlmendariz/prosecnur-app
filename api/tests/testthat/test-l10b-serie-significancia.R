source("setup-load-all.R")

# L10-9 (bandeja CCSS, 2026-10-24): la serie por nivel (`p_serie_temporal(cruce =)`) reemplazó a una apilada con letras
# de significancia y las perdía. Con `mostrar_significancia`, cada punto lleva la letra del nivel al que supera (la
# prueba de la casa: z con corrección de Bonferroni, α = 0,05, `comparar_columnas_sig()`) y la nota de la prueba va
# sobre «Base:». Con una sola serie, la leyenda repetía el título y se apaga.

.l10bs_inst <- function() list(
  survey = data.frame(name = c("niv", "t", "e"), type = c("select_one nv", "select_one sn", "select_one sn"),
                      list_name = c("nv", "sn", "sn"), label = c("Nivel", "Trabaja", "Experiencia"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = c("nv", "nv", "nv", "sn", "sn"), name = c("6", "7", "8", "1", "2"),
                       label = c("VI", "VII", "VIII", "Sí", "No"), stringsAsFactors = FALSE),
  orders_list = list(niv = list(names = c("6", "7", "8"), labels = c("VI", "VII", "VIII"), label = "Nivel"),
                     t = list(names = c("1", "2"), labels = c("Sí", "No"), label = "Trabaja"),
                     e = list(names = c("1", "2"), labels = c("Sí", "No"), label = "Experiencia")))
# Nivel VI: 4 de 40 trabajan (10 %); VII: 20 de 40 (50 %); VIII: 36 de 40 (90 %). Las tres diferencias son significativas.
.l10bs_dat <- function() data.frame(
  niv = rep(c("6", "7", "8"), each = 40),
  t = c(rep("1", 4), rep("2", 36), rep("1", 20), rep("2", 20), rep("1", 36), rep("2", 4)),
  e = rep(c("1", "2"), 60), stringsAsFactors = FALSE)
.l10bs_sources <- function() list(data_sources = list(b = .l10bs_dat()), inst_sources = list(b = .l10bs_inst()))
.l10bs_labels <- function(p) {
  capas <- Filter(function(l) inherits(l$geom, "GeomText") && ".lab" %in% names(l$data %||% list()), p$layers)
  unlist(lapply(capas, function(l) as.character(l$data$.lab)))
}

test_that("L10-9: con mostrar_significancia cada punto lleva la letra del nivel al que supera, con la prueba de la casa", {
  el <- p_serie_temporal(vars = list(Trabaja = "b$t"), corte = "1", cruce = "b$niv", mostrar_significancia = TRUE)
  p <- .render_serie_cruce(el, .l10bs_sources())
  # VIII supera a VI (A) y a VII (B); VII supera a VI; VI no supera a nadie.
  expect_setequal(.l10bs_labels(p), c("10%", "50% A", "90% AB"))
  nota <- .lam_nota_sig_de(p)                                              # lo que la lámina escribe sobre «Base:»
  expect_match(nota, "prueba z, corrección de Bonferroni, α = 0.05", fixed = TRUE)
  expect_match(nota, "A = VI | B = VII | C = VIII", fixed = TRUE)
  # Las letras son las de `comparar_columnas_sig()`, la misma función que firma las del XLSX de cruces.
  ref <- comparar_columnas_sig(matrix(c(4, 20, 36), nrow = 1), c(40, 40, 40))$letras
  expect_identical(gsub("\\s+", "", ref[1, ]), c("", "A", "AB"))
})

test_that("L10-9: sin el interruptor no hay letras ni nota, y las cifras no cambian", {
  el <- p_serie_temporal(vars = list(Trabaja = "b$t"), corte = "1", cruce = "b$niv")
  p <- .render_serie_cruce(el, .l10bs_sources())
  expect_setequal(.l10bs_labels(p), c("10%", "50%", "90%"))
  expect_null(attr(p, "pulso_sig_nota"))
})

test_that("L10-9: sin diferencias significativas la nota lo dice en vez de callar", {
  el <- p_serie_temporal(vars = list(Experiencia = "b$e"), corte = "1", cruce = "b$niv", mostrar_significancia = TRUE)
  p <- .render_serie_cruce(el, .l10bs_sources())
  expect_setequal(.l10bs_labels(p), "50%")
  expect_match(attr(p, "pulso_sig_nota"), "Ninguna diferencia entre grupos resultó significativa")
})

test_that("L10-9: con una sola serie no hay leyenda; con dos, sí; y la lámina pedida la conserva", {
  sin <- .render_serie_cruce(p_serie_temporal(vars = list(Trabaja = "b$t"), corte = "1", cruce = "b$niv"), .l10bs_sources())
  expect_identical(sin$theme$legend.position, "none")
  dos <- .render_serie_cruce(p_serie_temporal(vars = list(Trabaja = "b$t", Experiencia = "b$e"), corte = "1", cruce = "b$niv"),
                             .l10bs_sources())
  expect_identical(dos$theme$legend.position, "bottom")
  pedida <- .render_serie_cruce(p_serie_temporal(vars = list(Trabaja = "b$t"), corte = "1", cruce = "b$niv", mostrar_leyenda = TRUE),
                                .l10bs_sources())
  expect_identical(pedida$theme$legend.position, "bottom")
})

test_that("L10-9: en la lámina real la nota de la prueba va sobre «Base:» y los puntos llevan sus letras", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  plan <- list(a = p_slide_1_grafico(grafico = p_serie_temporal(vars = list(Trabaja = "t"), corte = "1", cruce = "niv",
                                                                mostrar_significancia = TRUE), titulo = "L10-9"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = .l10bs_dat(), instrumento = .l10bs_inst(), plan = plan, path_ppt = out,
                                                     mensajes_progreso = FALSE)))
  xml <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  forma <- function(n) xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n))
  nota <- forma("Nota significancia"); base <- forma("Base lamina")
  expect_length(nota, 1L)
  expect_match(xml2::xml_text(nota), "Bonferroni")
  y <- function(s) as.numeric(xml2::xml_attr(xml2::xml_find_first(s, ".//a:off"), "y"))
  expect_lt(y(nota), y(base))                                              # sobre «Base:»
  expect_false(grepl("Bonferroni", xml2::xml_text(base)))                  # y no repetida en la base
  # El gráfico (DrawingML de rvg) trae las cifras con sus letras.
  expect_match(paste(xml2::xml_text(xml2::xml_find_all(xml, "//a:t")), collapse = " "), "90% AB")
})

test_that("L10-9: p_serie_temporal declara el interruptor en el editor", {
  args <- vapply(.GRAFICADORES_META$p_serie_temporal$args, function(a) a$name, "")
  expect_true(all(c("mostrar_significancia", "significancia_alpha") %in% args))
})
