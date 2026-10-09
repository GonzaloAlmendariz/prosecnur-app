source("setup-load-all.R")

.mr_fixture <- function(dist_labels = c("Chorrillos", "Comas", "El Agustino", "Distrito Inventado"), pct = c(77, 55, 51, 60), n = 100) {
  filas <- lapply(seq_along(pct), function(k) data.frame(dist = as.character(k), sat = c(rep("5", pct[k]), rep("2", n - pct[k]))))
  list(data = do.call(rbind, filas),
       inst = list(survey = data.frame(name = c("sat", "dist"), type = c("select_one s", "select_one d"), list_name = c("s", "d"), label = c("Satisfacción", "Distrito")),
                   choices = data.frame(list_name = c(rep("s", 5), rep("d", length(dist_labels))), name = c(as.character(1:5), as.character(seq_along(dist_labels))),
                                        label = c("Muy insatisfecho", "Insatisfecho", "Ni uno ni otro", "Satisfecho", "Muy satisfecho", dist_labels)),
                   orders_list = NULL))
}

test_that("el indicador por distrito es el porcentaje en el corte y casa con la cartografía por nombre o por UBIGEO", {
  fx <- .mr_fixture()
  f <- .mapa_resultado_calcular(fx$data, fx$inst, "sat", "dist", c("4", "5"))
  expect_equal(f$porcentaje, c(77, 55, 51, 60)); expect_identical(f$n, rep(100L, 4))
  expect_identical(attr(f, "indicador"), c("Satisfecho", "Muy satisfecho"))
  cas <- .mapa_resultado_casar(f, .mapa_resultado_lima())
  expect_identical(cas$ubigeo, c("150108", "150110", "150111", NA))
  por_cod <- .mapa_resultado_casar(data.frame(codigo = "150132", etiqueta = "SJL", porcentaje = 50, n = 3L), .mapa_resultado_lima())
  expect_identical(por_cod$ubigeo, "150132")
})

test_that("la espec pinta por clases, ordena el ranking y nombra lo que no casa o no llega al mínimo", {
  fx <- .mr_fixture()
  f <- .mapa_resultado_casar(.mapa_resultado_calcular(fx$data, fx$inst, "sat", "dist", c("4", "5")), .mapa_resultado_lima())
  f$n[f$etiqueta == "El Agustino"] <- 3L
  e <- .espec_mapa_resultado(f, c(55, 65, 75), min_n = 5L, indicador = c("Satisfecho", "Muy satisfecho"))
  expect_identical(e$forma, "resultado")
  expect_identical(e$ranking$distrito, c("Chorrillos", "Comas"))
  expect_identical(e$ranking$color, c(.std_color("azul"), "#8EA3C6"))
  expect_identical(e$leyenda$rotulos, c("Menos de 55 %", "55 a 64 %", "65 a 74 %", "75 % a más", "Sin encuestas"))
  expect_identical(e$panel$titulo, "Satisfecho o muy satisfecho")
  expect_identical(e$sin_casar, "Distrito Inventado"); expect_identical(e$pocos_casos, "El Agustino")
  lima <- e$capas[[1]]$datos
  expect_identical(unique(lima$fill[lima$ubigeo == "150111"]), .std_color("mapa_fuera"))
})

test_that("la 104 sale nativa en el motor, con su ranking, y avisa por su nombre el distrito que no ubicó", {
  fx <- .mr_fixture()
  out <- tempfile(fileext = ".pptx")
  plan <- list(p_slide_1_grafico(p_mapa_resultado_distrital("sat", cruces = "dist", corte = c("4", "5"), rotulo = "Satisfechos o muy satisfechos"),
                                 titulo = "Satisfacción por distrito"))
  msgs <- testthat::capture_messages(suppressWarnings(reporte_ppt_plan(data = fx$data, instrumento = fx$inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  expect_true(any(grepl("no se ubicaron en la cartografía de Lima: Distrito Inventado", msgs, fixed = TRUE)))
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  nm <- xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name")
  expect_true("prosecnur:grafico:mapa:panel" %in% nm)
  txt <- function(n) xml2::xml_text(xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
  expect_identical(txt("mapa:distrito"), c("Chorrillos", "Comas", "El Agustino"))
  expect_identical(txt("mapa:valor"), c("77%", "55%", "51%"))
  expect_identical(txt("panel:pregunta"), "Satisfechos o muy satisfechos")
})

test_that("el ranking cambia de forma con los distritos y Lima y Callao enteros caben (13, 14, 26, 27 y 50)", {
  lima <- .mapa_resultado_lima()
  f <- data.frame(codigo = lima$ubigeo, etiqueta = lima$distrito, porcentaje = seq(40, 90, length.out = nrow(lima)), n = 50L, ubigeo = lima$ubigeo)
  for (k in c(1L, 13L, 14L, 26L, 27L, nrow(lima))) expect_true(.lam_mapa_resultado_cabe(.espec_mapa_resultado(f[seq_len(k), ])), label = paste(k, "distritos"))
  expect_identical(vapply(c(13L, 14L, 26L, 27L), .lam_mapa_resultado_forma, ""), c("una", "dos", "dos", "lista"))
  expect_identical(nrow(lima), 50L)
  vacio <- .espec_mapa_resultado(f[0, ])
  expect_identical(nrow(vacio$ranking), 0L); expect_true(.lam_mapa_resultado_cabe(vacio))
})

test_that("las guardas de los puntos comparativos: códigos fuera de escala, distritos fuera de opciones, corte trivial o solapado", {
  fx <- .mr_fixture()
  d <- fx$data; d$sat[1] <- "7"
  expect_error(.mapa_resultado_calcular(d, fx$inst, "sat", "dist", c("4", "5")), "fuera de su escala: 7")
  d <- fx$data; d$dist[1] <- "99"
  expect_error(.mapa_resultado_calcular(d, fx$inst, "sat", "dist", c("4", "5")), "fuera de sus opciones: 99")
  expect_error(.mapa_resultado_calcular(fx$data, fx$inst, "sat", "dist", as.character(1:5)), "subconjunto propio")
  expect_error(.mapa_resultado_calcular(fx$data, fx$inst, "sat", "dist", c("4", "5"), excluir_opciones = "5"), "se solapan")
  expect_identical(.mapa_nombre_distrito(c("PACHACAMAC", "BRENA")), c("Pachacámac", "Breña"))
  e <- .espec_mapa_resultado(data.frame(codigo = "150108", etiqueta = "Chorrillos", porcentaje = 60, n = 5L, ubigeo = "150108"), cortes = c(55.5, 70))
  expect_identical(e$leyenda$rotulos[2], "55.5 a menos de 70 %")
})

test_that("la 104 con 30 distritos sale nativa en tres columnas, con todas sus cifras", {
  lima <- .mapa_resultado_lima()[1:30, ]
  fx <- .mr_fixture(dist_labels = lima$distrito, pct = rep(c(40, 60, 80), 10), n = 100)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = fx$data, instrumento = fx$inst, plan = list(p_slide_1_grafico(
    p_mapa_resultado_distrital("sat", cruces = "dist", corte = c("4", "5")), titulo = "Treinta")), path_ppt = out, mensajes_progreso = FALSE)))
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  vals <- xml2::xml_text(xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='mapa:valor']]"))
  expect_length(vals, 30L)
  expect_length(xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='mapa:clase']]"), 30L)
})
