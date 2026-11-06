# B5 (CCSS Perfil 2026, revisión v3, lámina 22): la leyenda de una apilada incluía «Otros» sin ningún segmento.

test_that("la leyenda deja fuera las categorías que no se dibujan en ninguna fila", {
  dib <- matrix(c(TRUE, TRUE, TRUE, TRUE, FALSE, FALSE), nrow = 2)
  expect_identical(.espec_leyenda_con_casos(1:3, dib), 1:2)
  expect_identical(.espec_leyenda_con_casos(3:1, dib), 2:1)   # conserva el orden (invertir_leyenda)
  expect_identical(.espec_leyenda_con_casos(1:3, matrix(FALSE, 2, 3)), 1:3)
  expect_identical(.espec_leyenda_con_casos(1:3, matrix(c(TRUE, FALSE, FALSE, FALSE, FALSE, TRUE), 2)), c(1L, 3L))
})

test_that("una apilada por grupos sin casos en «Otros» no lo pone en la leyenda de la lámina", {
  skip_if_not_installed("officer")
  d <- data.frame(g = rep(c("A", "B"), each = 60), y = c(rep(c("1", "2"), c(20, 40)), rep(c("1", "2"), c(10, 50))), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("g", "y"), type = c("select_one lg", "select_one ly"), list_name = c("lg", "ly"),
                                   label = c("Grupo", "Gestión"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = c("lg", "lg", "ly", "ly", "ly"), name = c("A", "B", "1", "2", "3"),
                                    label = c("A", "B", "Estatal", "Privado", "Otros"), stringsAsFactors = FALSE), orders_list = NULL)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = d, instrumento = inst, path_ppt = out, mensajes_progreso = FALSE,
    plan = p_plan(slides = list(p_slide_1_grafico(titulo = "Gestión", grafico = p_barras_apiladas(var = "y", cruces = "g")))))))
  txt <- xml2::xml_text(xml2::xml_find_all(xml2::read_xml(unz(out, "ppt/slides/slide1.xml")), "//a:t"))
  expect_true(all(c("Estatal", "Privado") %in% txt), info = paste(txt, collapse = " | "))
  expect_false("Otros" %in% txt)
})
