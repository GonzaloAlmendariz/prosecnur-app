# K15 — «Cifras en banda superior» (tipo 22) en nativo calza con lo dibujado en la p171 de recetario-moderna.pptx.
#
# La banda de las láminas de composición es la pieza `cifra()` del recetario (recetario_piezas.R:51; recetario_m2c.R:166-
# 172): caja de la columna (3.908, calles de 0.4) desde su borde, valor de 0.62 a 32 pt en 1.6, rótulo en 2.22 y
# detalle en 2.5; separadores en 4.603 y 8.910 de 1.65 a 2.8; filete en 3.05 y los gráficos en 3.25, sin filete entre
# ellos. Las láminas de cifras solas (p174/p175) miden otra cosa (caja corrida 0.1, calle de 0.45) y no cambian.

test_that("la lámina 22 nativa pone banda, filete y gráficos donde la p171 (0.02 in)", {
  set.seed(1); n <- 60
  df <- data.frame(titulo = sample(c("1", "2"), n, TRUE), edad = sample(20:30, n, TRUE), sector = sample(c("1", "2", "3"), n, TRUE))
  inst <- list(survey = data.frame(name = c("titulo", "edad", "sector"), type = c("select_one si_no", "integer", "select_one sec"),
                                   list_name = c("si_no", NA, "sec"), label = c("¿Tiene título?", "Edad", "Sector")),
               choices = data.frame(list_name = c("si_no", "si_no", "sec", "sec", "sec"), name = c("1", "2", "1", "2", "3"),
                                    label = c("Sí", "No", "Privado", "Público", "Independiente")), orders_list = NULL)
  s <- p_slide_cifras_y_graficos(
    cifra_izquierda = p_cifra("titulo", "n", rotulo = "egresados encuestados"),
    cifra_centro = p_cifra("edad", "mediana", unidad = "años", rotulo = "edad mediana"),
    cifra_derecha = p_cifra("titulo", "porcentaje", categoria = "1", rotulo = "tiene el título"),
    grafico_izquierda = p_barras_categoricas("titulo"), grafico_derecha = p_barras_categoricas("sector"), titulo = "El estudio en cifras")
  out <- tempfile(fileext = ".pptx")
  suppressMessages(reporte_ppt_plan(data = df, instrumento = inst, plan = p_plan(slides = list(s)), path_ppt = out, mensajes_progreso = FALSE))
  expect_identical(.preview_partes(out)$partes[[1]]$estado, "nativa")
  txt <- .pptx_leer_parte(out, .pptx_slide_paths(out)[1]); xml <- xml2::read_xml(txt)
  caja <- function(nombre) {
    sp <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
    off <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:off"); ext <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:ext")
    d <- data.frame(x = as.numeric(xml2::xml_attr(off, "x")) / 914400, y = as.numeric(xml2::xml_attr(off, "y")) / 914400,
                    w = as.numeric(xml2::xml_attr(ext, "cx")) / 914400, h = as.numeric(xml2::xml_attr(ext, "cy")) / 914400)
    d[order(d$x, d$y), , drop = FALSE]
  }
  cerca <- function(a, e, lab) expect_lte(max(abs(a - e)), 0.02, label = lab)
  v <- caja("cifra:valor"); r <- caja("cifra:rotulo")
  cerca(v$x, c(0.495, 4.803, 9.110), "x de los valores"); cerca(v$w, rep(3.908, 3), "ancho de los valores")
  cerca(v$y, rep(1.6, 3), "y de los valores"); cerca(v$h, rep(0.62, 3), "alto de los valores")
  cerca(r$x, c(0.495, 4.803, 9.110), "x de los rótulos"); cerca(r$y, rep(2.22, 3), "y de los rótulos"); cerca(r$h, rep(0.3, 3), "alto de los rótulos")
  expect_match(txt, 'sz="3200"', fixed = TRUE)                                   # recetario_m2c.R:170, size = 32
  sep <- caja("cifra:separador")
  cerca(sep$x, c(4.603, 8.910), "separadores de la banda"); cerca(sep$y, c(1.65, 1.65), "inicio de los separadores")
  cerca(sep$y + sep$h, c(2.8, 2.8), "fin de los separadores")
  f <- caja("separador")
  expect_equal(nrow(f), 1L)                                                      # la p171 no separa los dos gráficos
  cerca(c(f$x, f$y, f$w), c(0.495, 3.05, 12.523), "filete bajo la banda")
  q <- caja("panel:pregunta")
  cerca(q$x, c(0.495, 7.007), "x de las preguntas"); cerca(q$y, c(3.25, 3.25), "y de las preguntas"); cerca(q$w, c(6.012, 6.012), "ancho de las preguntas")
})

test_that("la lámina de cifras sola sigue con su banda (p174/p175): caja corrida 0.1 y calle de 0.45", {
  e <- pulso_cifras(list(list(valor = "88 %", rotulo = "de los docentes conoce la misión", detalle = "", icono = ""),
                         list(valor = "81 %", rotulo = "de los estudiantes", detalle = "", icono = ""),
                         list(valor = "74 %", rotulo = "valora las competencias", detalle = "", icono = "")))
  lz <- .lam_lienzo()
  b <- .lam_cifras_banda(lz, e, 0.495, 1.85, 12.523)
  # Primera forma: el valor de la primera cifra, en 0.395 con 3.974 de ancho, como la p174 (calle de 0.45).
  valor <- lz$cajas[[which(grepl('name="cifra:valor"', unlist(lz$formas), fixed = TRUE))[1]]]
  expect_equal(unname(valor[1]), 0.395, tolerance = 0.005)
  expect_equal(unname(valor[3] - valor[1]), 3.974, tolerance = 0.005)
  expect_gt(b$alto, 1.3)
})
