# K15 — «Cifras en columna lateral» (tipo 21) en nativo calza con lo dibujado en la p169 de recetario-moderna.pptx.
#
# Medido con python-pptx (pulgadas): columna de cifras de 3.0 desde 0.495, filete vertical en 3.715; columna del medio
# de 4.312 desde 3.945 (preguntas en 1.65 y 3.75, filete horizontal en 3.6); filete vertical en 8.487 y columna derecha
# de 4.312 desde 8.707 (pregunta en 1.65). El motor las ponía en 3.895 y 8.682 (4.337 de ancho), preguntas en 1.6 y 4.0.

.P169 <- list(pregunta = rbind(c(3.945, 1.65, 4.312), c(8.707, 1.65, 4.312), c(3.945, 3.75, 4.312)),
              filete_v = c(3.715, 8.487), filete_h_medio = c(x = 3.945, y = 3.6, w = 4.312))

test_that("la lámina 21 nativa pone sus columnas, preguntas y filetes donde la p169 (0.05 in)", {
  set.seed(2); n <- 80
  df <- data.frame(sexo = sample(c("1", "2"), n, TRUE), edad = sample(19:30, n, TRUE), rango = sample(c("1", "2", "3"), n, TRUE),
                   ciclo = sample(c("5", "6", "7"), n, TRUE))
  inst <- list(survey = data.frame(name = c("sexo", "edad", "rango", "ciclo"), type = c("select_one sx", "integer", "select_one rg", "select_one cc"),
                                   list_name = c("sx", NA, "rg", "cc"), label = c("Sexo", "Edad", "Rango de edades", "Nivel curricular")),
               choices = data.frame(list_name = c("sx", "sx", "rg", "rg", "rg", "cc", "cc", "cc"), name = c("1", "2", "1", "2", "3", "5", "6", "7"),
                                    label = c("Masculino", "Femenino", "De 19 a 22", "De 23 a 26", "De 27 a 30", "Quinto", "Sexto", "Séptimo")),
               orders_list = NULL)
  s <- p_slide_3_graficos_poblacion_cifras(superior_izquierda = p_barras_categoricas("sexo"), derecha = p_barras_categoricas("ciclo"),
    cifra_superior = p_cifra("sexo", "n", rotulo = "estudiantes"), inferior_izquierda = p_barras_categoricas("rango"),
    cifra_inferior = p_cifra("edad", "mediana", unidad = "años", rotulo = "edad mediana"), titulo = "Perfil del estudiante en cifras")
  out <- tempfile(fileext = ".pptx")
  suppressMessages(reporte_ppt_plan(data = df, instrumento = inst, plan = p_plan(slides = list(s)), path_ppt = out, mensajes_progreso = FALSE))
  expect_identical(.preview_partes(out)$partes[[1]]$estado, "nativa")
  xml <- xml2::read_xml(.pptx_leer_parte(out, .pptx_slide_paths(out)[1]))
  caja <- function(nombre) {
    sp <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
    off <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:off"); ext <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:ext")
    data.frame(x = as.numeric(xml2::xml_attr(off, "x")) / 914400, y = as.numeric(xml2::xml_attr(off, "y")) / 914400,
               w = as.numeric(xml2::xml_attr(ext, "cx")) / 914400, h = as.numeric(xml2::xml_attr(ext, "cy")) / 914400)
  }
  # 0.02 in: con 0.05 sobrevivía la geometría vieja (columna en 3.895, `wl <- 2.95`; verificador de K15).
  cerca <- function(a, e, lab) expect_lte(max(abs(a - e)), 0.02, label = lab)
  q <- caja("panel:pregunta"); q <- q[order(q$y, q$x), ]
  e <- .P169$pregunta[order(.P169$pregunta[, 2], .P169$pregunta[, 1]), ]
  cerca(q$x, e[, 1], "x de las preguntas"); cerca(q$y, e[, 2], "y de las preguntas"); cerca(q$w, e[, 3], "ancho de las preguntas")
  s_ <- caja("separador"); v <- s_[s_$w < 0.05, ]; h <- s_[s_$h < 0.05, ]
  cerca(sort(v$x), .P169$filete_v, "filetes verticales")
  # Las cifras son la pieza `cifra()` del recetario (recetario_piezas.R:51): caja de 3.0 desde 0.495 (no 0.395 de 3.1),
  # valor de 0.62 en 1.8 y 3.5, rótulo debajo en 2.42 y 4.12, y el filete de la columna en 3.2.
  v_ <- caja("cifra:valor"); r_ <- caja("cifra:rotulo")
  cerca(v_$x, c(0.495, 0.495), "x de las cifras"); cerca(v_$w, c(3.0, 3.0), "ancho de las cifras")
  cerca(sort(v_$y), c(1.8, 3.5), "y de las cifras"); cerca(v_$h, c(0.62, 0.62), "alto del valor")
  cerca(sort(r_$y), c(2.42, 4.12), "y de los rótulos"); cerca(r_$x, c(0.495, 0.495), "x de los rótulos")
  hc <- h[h$x < 1, ]
  cerca(c(hc$x, hc$y, hc$w), c(0.495, 3.2, 3.0), "filete de la columna de cifras")
  hm <- h[h$x > 3, ]
  expect_equal(nrow(hm), 1L)
  cerca(c(hm$x, hm$y, hm$w), unname(.P169$filete_h_medio), "filete horizontal del medio")
})
