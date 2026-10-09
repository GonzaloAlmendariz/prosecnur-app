source("setup-load-all.R")

.cr_fixture <- function() {
  df <- data.frame(sexo = c(rep("1", 6), rep("2", 4)),
                   a = c("5", "4", "3", "5", "5", "2", "4", "4", "5", "1"),
                   b = c("5", "5", "5", "5", "4", "4", "3", "2", "1", NA), stringsAsFactors = FALSE)
  attr(df$a, "label") <- "Ítem A"; attr(df$b, "label") <- "Ítem B"
  inst <- list(survey = data.frame(name = c("sexo", "a", "b"), type = c("select_one sx", "select_one lk", "select_one lk"), list_name = c("sx", "lk", "lk"),
                                   label = c("Sexo", "Ítem A", "Ítem B")),
               choices = data.frame(list_name = c("sx", "sx", rep("lk", 5)), name = c("1", "2", as.character(1:5)),
                                    label = c("Masculino", "Femenino", "Nada", "Poco", "Regular", "Bastante", "Mucho")), orders_list = NULL)
  d1 <- suppressMessages(suppressWarnings(reporte_dimensiones(data = df, instrumento = inst, vars = c("a", "b"), prefijo = "r100_", reemplazar = FALSE,
                                                                orden_por_lista = list(lk = as.character(1:5)))))
  d1 <- suppressMessages(suppressWarnings(reporte_dimensiones_indices(data = d1, subindices = list(subindice("s1", "S1", c("r100_a", "r100_b"))),
                                                                        indices = list(indice("idx", "Indice", "s1")))))
  list(data = d1, inst = inst, cfg = list(list(titulo = "Dimensión uno", vars = c("r100_a", "r100_b"), labels = c(r100_a = "Ítem A", r100_b = "Ítem B"))))
}

test_that("la 93 calcula el Top Two Box por criterio y público desde los puntajes de la recodificación", {
  fx <- .cr_fixture()
  calc <- .criterios_calcular(fx$data, fx$inst, fx$cfg, cruce = "sexo", metrica = "top_two_box")
  expect_identical(calc$metrica, "top_two_box")
  expect_identical(calc$columnas$rotulo, c("Total", "Masculino", "Femenino"))
  # a: 4/5 en 7 de 10; Masculino 4 de 6; Femenino 3 de 4.   b: el NA sale del denominador; 6 de 9; 6 de 6; 0 de 3.
  expect_equal(unname(calc$valores[1, ]), c(70, 400 / 6, 75))
  expect_equal(unname(calc$valores[2, ]), c(600 / 9, 100, 0))
  expect_identical(calc$filas, c("Ítem A", "Ítem B")); expect_identical(calc$grupos, rep("Dimensión uno", 2))
  lin <- .criterios_calcular(fx$data, fx$inst, fx$cfg, cruce = "sexo", metrica = "lineal")
  expect_identical(lin$metrica, "lineal")
  expect_equal(unname(lin$valores[1, 1]), mean(c(100, 75, 50, 100, 100, 25, 75, 75, 100, 0)))
})

test_that("un criterio que no es de escala obliga a la métrica lineal y la espec lo declara", {
  fx <- .cr_fixture()
  fx$data$num <- c(10, 20, 30, 40, 50, 60, 70, 80, 90, 100)
  calc <- .criterios_calcular(fx$data, fx$inst, list(list(titulo = "D", vars = c("r100_a", "num"))), cruce = NULL, metrica = "top_two_box")
  expect_identical(calc$metrica, "lineal")
  e <- preparar_heatmap_criterios(calc)
  expect_identical(e$sufijo, ""); expect_identical(e$rotulo_escala, "Índice")
})

test_that("la 93 sale nativa con sus columnas por público, su dimensión y sus cifras", {
  fx <- .cr_fixture()
  out <- tempfile(fileext = ".pptx")
  el <- p_dim_heatmap_criterios(fx$cfg, cruce = "sexo")
  expect_identical(el$metrica, "top_two_box")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = fx$data, instrumento = fx$inst, plan = list(p_slide_1_grafico(el, titulo = "Criterios")),
                                                     path_ppt = out, mensajes_progreso = FALSE)))
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  txt <- function(n) xml2::xml_text(xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
  expect_identical(txt("calor:columna"), c("Total (10)", "Masculino (6)", "Femenino (4)"))
  expect_identical(txt("calor:dimension"), "Dimensión uno")
  expect_identical(txt("calor:fila"), c("Ítem A", "Ítem B"))
  expect_identical(txt("calor:cifra"), c("70%", "67%", "75%", "67%", "100%", "0%"))
  expect_identical(txt("calor:escala_rotulo"), "Top Two Box")
})
