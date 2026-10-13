# Cuadrícula de población (p_slide_4_graficos_poblacion; láminas 193 y 210 del recetario, ADR 0093, N7): va por la
# disposición `paneles_4` de las mixtas, como la de cuatro gráficos.

.pb_fixture <- function() {
  cargo <- c("Decano(a) o director(a)", "Coordinador(a)", "Jefe(a) de departamento", "Secretario(a) académico(a)")
  anios <- c("Menos de 2 años", "De 2 a 4 años", "Más de 4 años")
  df <- data.frame(cargo = rep(cargo, c(20, 50, 30, 20)), anios = rep(anios, c(40, 60, 20)), sexo = rep(c("Mujer", "Hombre"), c(70, 50)),
                   grado = rep(c("Magíster", "Doctor(a)"), c(50, 70)), edad = rep(18:29, 10), stringsAsFactors = FALSE)
  ch <- rbind(data.frame(list_name = "lc", name = cargo, label = cargo), data.frame(list_name = "la", name = anios, label = anios),
              data.frame(list_name = "ls", name = c("Mujer", "Hombre"), label = c("Mujer", "Hombre")),
              data.frame(list_name = "lg", name = c("Magíster", "Doctor(a)"), label = c("Magíster", "Doctor(a)")))
  inst <- list(survey = data.frame(name = c("cargo", "anios", "sexo", "grado", "edad"), type = c(paste("select_one", c("lc", "la", "ls", "lg")), "integer"),
                                   list_name = c("lc", "la", "ls", "lg", NA), label = c("Cargo", "Años en el cargo", "Sexo", "Máximo grado alcanzado", "Edad"),
                                   stringsAsFactors = FALSE), choices = ch, orders_list = NULL)
  list(df = df, inst = inst)
}
.pb_lams <- function(plan) {
  f <- .pb_fixture(); out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  lapply(seq_len(length(officer::read_pptx(out))), function(k) xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k))))
}

test_that("la cuadrícula de población sale nativa, con la pregunta de cada panel y dos dicotomías abajo (193)", {
  lam <- .pb_lams(list(a = p_slide_4_graficos_poblacion(p_barras_categoricas("cargo"), p_barras_categoricas("anios"),
                                                       p_barras_categoricas("sexo"), p_barras_categoricas("grado"), titulo = "Perfil de las autoridades")))
  x <- lam[[1]]; nm <- xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name")
  expect_true(any(grepl("^prosecnur:grafico", nm)))
  txt <- xml2::xml_text(xml2::xml_find_all(x, "//a:t"))
  expect_true(all(c("Cargo", "Años en el cargo", "Sexo", "Máximo grado alcanzado") %in% txt))
  expect_equal(sum(nm == "dicotomia:cifra"), 4L)                                            # dos dicotomías, dos cifras cada una
})

test_that("una cuadrícula con un panel que no tiene pieza nativa vuelve entera a la ruta anterior", {
  lam <- .pb_lams(list(a = p_slide_4_graficos_poblacion(p_barras_categoricas("cargo"), p_barras_categoricas("anios"),
                                                       p_barras_categoricas("sexo"), p_histograma("edad"), titulo = "Con histograma")))
  nm <- xml2::xml_attr(xml2::xml_find_all(lam[[1]], "//p:cNvPr"), "name")
  expect_false(any(grepl("^prosecnur:grafico", nm)))
})

test_that("un rótulo que cabe en una línea con la tinta medida no manda el panel a la ruta anterior", {
  e <- preparar_categorica(c("Coordinador(a)", "Jefe(a) de departamento", "Decano(a) o director(a)", "Secretario(a) académico(a)"),
                           c(.42, .25, .17, .16), c("42%", "25%", "17%", "16%"))
  P <- .lam_mixta_geo("paneles_4")$paneles[[1]]
  expect_true(.lam_mixta_cabe(e, P, "Cargo", "120 respuestas"))
})

test_that("la lámina de población sólo lleva la base que declaró el analista: cada panel ya nombra su público", {
  els <- function() list(p_barras_categoricas("cargo"), p_barras_categoricas("anios"), p_barras_categoricas("sexo"), p_barras_categoricas("grado"))
  e <- els()
  lam <- .pb_lams(list(a = p_slide_4_graficos_poblacion(e[[1]], e[[2]], e[[3]], e[[4]], titulo = "Sin base"),
                       b = p_slide_4_graficos_poblacion(e[[1]], e[[2]], e[[3]], e[[4]], titulo = "Con base", base = "Base: 120 autoridades"),
                       c = p_slide_4_graficos_poblacion(e[[1]], e[[2]], e[[3]], e[[4]], titulo = "Oculta", base = "Base: 120 autoridades",
                                                        meta = list(suppress_base_placeholder = TRUE))))
  base_de <- function(x) paste(xml2::xml_text(xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='Base lamina']]")), collapse = "")
  # G9 (2026-10-13): los cuatro paneles son del mismo público con el mismo n, así que su «120 respuestas» pasa a la
  # esquina de la lámina en vez de repetirse en cada panel.
  expect_identical(base_de(lam[[1]]), "Base: 120 respuestas")
  expect_identical(base_de(lam[[2]]), "Base: 120 autoridades")
  # Con la base oculta a propósito, la lámina no la escribe y cada panel conserva la suya.
  expect_identical(base_de(lam[[3]]), "")
  expect_gt(length(xml2::xml_find_all(lam[[3]], "//p:sp[p:nvSpPr/p:cNvPr[@name='panel:base']]")), 0L)
})
