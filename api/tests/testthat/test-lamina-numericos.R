# Gráficos de números del recetario con formas nativas (ADR 0093, N4; recetario_graficos2.R y recetario_m3b.R).

.nm_xml <- function(out, k) xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k)))
.nm_txt <- function(xml, n) xml2::xml_text(xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
.nm_ext <- function(xml, n) {
  sp <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]/p:spPr/a:xfrm", n))
  data.frame(x = as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "./a:off"), "x")) / 914400,
             y = as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "./a:off"), "y")) / 914400,
             w = as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "./a:ext"), "cx")) / 914400,
             h = as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "./a:ext"), "cy")) / 914400)
}
.nm_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.nm_print <- function(doc) { out <- tempfile(fileext = ".pptx"); print(doc, target = out); out }

test_that("preparar_boxplot calcula cuartiles, bigotes a 1.5 RIC acotados y atípicos, en el orden de los niveles", {
  g <- factor(rep(c("B", "A"), c(9, 5)), levels = c("A", "B"))
  x <- c(20, 21, 21, 22, 22, 23, 23, 24, 40, 19, 20, 20, 21, 30)
  e <- preparar_boxplot(g, x)
  expect_identical(e$tipo, "boxplot"); expect_identical(e$grupos$rotulo, c("A", "B"))
  expect_equal(e$grupos$n, c(5L, 9L))
  qb <- stats::quantile(x[1:9], c(.25, .5, .75), names = FALSE)
  expect_equal(unname(unlist(e$grupos[2, c("q1", "mediana", "q3")])), qb)
  expect_equal(e$grupos$bigote_sup[2], min(40, qb[3] + 1.5 * (qb[3] - qb[1])))
  expect_identical(e$atipicos[[2]], 40)
  expect_identical(e$atipicos[[1]], 30)
  expect_equal(e$rango, c(19, 40))
})

test_that("el histograma nativo pone una barra por valor y el triángulo de la mediana bajo su valor (lámina 79)", {
  x <- c(rep(19, 9), rep(20, 30), rep(21, 35), rep(22, 32), rep(23, 25))
  e <- attr(.histograma_recetario(x, modo = "conteo"), "pulso_espec")
  expect_identical(e$cifras, c("9", "30", "35", "32", "25")); expect_equal(e$x_mediana, 2)   # mediana 21: tercera columna
  o <- .lam_laminas_histograma(.nm_doc(), e, "Edad", folio = 79)
  xml <- .nm_xml(.nm_print(o$doc), length(o$doc))
  b <- .nm_ext(xml, "histograma:barra"); tri <- .nm_ext(xml, "histograma:mediana")
  expect_equal(nrow(b), 5L)
  expect_equal(max(b$h), .std_geom("contenido_y1") - .std_geom("zona_datos_y0") - 1.25, tolerance = 1e-3)
  expect_equal(tri$x + tri$w / 2, b$x[3] + b$w[3] / 2, tolerance = 1e-3)
  expect_identical(.nm_txt(xml, "histograma:texto_mediana"), "Mediana: 21 años")
})

test_that("el indicador numérico va en columnas desde cero con cifra de punto decimal y los casos del grupo (lámina 80)", {
  e <- list(tipo = "numerico", etiqueta = "Media", rotulos = c("Quinto", "Sexto"), valores = c(20.5, 22.46), cifras = c("20.5", "22.5"), n = c(22, 19))
  o <- .lam_laminas_numerico(.nm_doc(), e, "Edad promedio", folio = 80, unidad_n = "estudiantes", encabezado = "Edad promedio, en años")
  xml <- .nm_xml(.nm_print(o$doc), length(o$doc))
  expect_identical(.nm_txt(xml, "numerico:cifra"), c("20.5", "22.5"))
  expect_identical(.nm_txt(xml, "numerico:casos"), c("22 estudiantes", "19 estudiantes"))
  col <- .nm_ext(xml, "numerico:columna")
  expect_equal(col$h[2] / col$h[1], 22.46 / 20.5, tolerance = 1e-3)            # desde cero: la altura es proporcional
  expect_equal(col$y + col$h, rep(6.05, 2), tolerance = 1e-3)
})

test_that(".numerico_sellar escribe la cifra con punto decimal y en el orden de los grupos", {
  p <- ggplot2::ggplot()
  dw <- tibble::tibble(categoria = factor(c("b", "a"), levels = c("a", "b")), N = c(10, 20), v = c(22.46, 20.55))
  e <- attr(.numerico_sellar(p, "mean", "Media", dw, "v", list(decimales = 1)), "pulso_espec")
  expect_identical(e$rotulos, c("a", "b")); expect_identical(e$cifras, c("20.6", "22.5")); expect_equal(e$n, c(20, 10))
})

test_that("el diagrama de caja nativo escribe la mediana con su unidad y dibuja atípicos (lámina 81)", {
  g <- factor(rep(c("A", "B"), c(5, 6)), levels = c("A", "B")); x <- c(19, 20, 20, 21, 30, 20, 21, 21, 22, 22, 23)
  e <- preparar_boxplot(g, x)
  o <- .lam_laminas_boxplot(.nm_doc(), e, "Edad por ciclo", folio = 81, encabezado = "Edad, en años", unidad = "años")
  xml <- .nm_xml(.nm_print(o$doc), length(o$doc))
  expect_identical(.nm_txt(xml, "boxplot:cifra"), c("20 años", "21.5 años"))
  expect_equal(nrow(.nm_ext(xml, "boxplot:atipico")), 1L)
  expect_identical(xml2::xml_attr(xml2::xml_find_first(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='boxplot:caja']]//a:ln/a:solidFill/a:srgbClr"), "val"),
                   .lam_hex(.std_color("azul")))
})

test_that("media y rango nativo: punto en la media, barra del rango con sus extremos y leyenda del tipo de rango (lámina 82)", {
  d <- data.frame(categoria = factor(rep(c("Docentes", "Estudiantes"), c(4, 5)), levels = c("Docentes", "Estudiantes")),
                  valor = c(27, 40, 50, 71, 19, 20, 22, 25, 40))
  e <- attr(suppressWarnings(graficar_media_rango(d, "categoria", "valor", tipo_rango = "minmax")), "pulso_espec")
  expect_identical(e$rotulos, c("Docentes", "Estudiantes")); expect_equal(e$inf, c(27, 19)); expect_equal(e$sup, c(71, 40))
  o <- .lam_laminas_media_rango(.nm_doc(), e, "Edad por público", folio = 82)
  xml <- .nm_xml(.nm_print(o$doc), length(o$doc))
  expect_identical(.nm_txt(xml, "media_rango:cifra"), paste("Media", e$cifras))
  expect_identical(.nm_txt(xml, "media_rango:minimo"), c("27", "19"))
  expect_true("Rango (mínimo a máximo)" %in% .nm_txt(xml, "leyenda:texto"))
  pt <- .nm_ext(xml, "media_rango:media"); rg <- .nm_ext(xml, "media_rango:rango")
  expect_true(all(pt$x + pt$w / 2 > rg$x & pt$x + pt$w / 2 < rg$x + rg$w))
})

test_that("en la ruta real p_histograma, p_numerico, p_boxplot y p_media_rango salen nativos con rótulos del instrumento", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  set.seed(5); N <- 120
  dat <- data.frame(edad = sample(19:30, N, TRUE), ciclo = sample(c("2", "1", "3"), N, TRUE), stringsAsFactors = FALSE)
  # Una fila sin nombre ANTES de la variable de cruce (grupo, nota): con ella el cruce perdía rótulos y orden (H42).
  inst <- list(survey = data.frame(name = c(NA, "edad", "ciclo"), type = c("begin_group", "integer", "select_one cic"),
                                   list_name = c(NA, NA, "cic"), label = c("Grupo", "Edad", "Ciclo"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = "cic", name = c("1", "2", "3"), label = c("Quinto ciclo", "Sexto ciclo", "Séptimo ciclo"),
                                    stringsAsFactors = FALSE), orders_list = NULL)
  plan <- list(a = p_slide_1_grafico(grafico = p_histograma("edad"), titulo = "Edad"),
               b = p_slide_1_grafico(grafico = p_numerico("edad", metrica = "mean", cruce = "ciclo"), titulo = "Edad promedio por ciclo"),
               c = p_slide_1_grafico(grafico = p_boxplot("edad", cruce = "ciclo"), titulo = "Distribución"),
               d = p_slide_1_grafico(grafico = p_media_rango("edad", cruce = "ciclo"), titulo = "Media y rango"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  grupo <- function(k) xml2::xml_attr(xml2::xml_find_all(.nm_xml(out, k), "//p:grpSp/p:nvGrpSpPr/p:cNvPr"), "name")
  expect_true("prosecnur:grafico:histograma" %in% grupo(1))
  expect_true("prosecnur:grafico:numerico" %in% grupo(2))
  expect_true("prosecnur:grafico:boxplot" %in% grupo(3))
  expect_true("prosecnur:grafico:media_rango" %in% grupo(4))
  expect_identical(.nm_txt(.nm_xml(out, 2), "numerico:rotulo"), c("Quinto ciclo", "Sexto ciclo", "Séptimo ciclo"))
  expect_identical(.nm_txt(.nm_xml(out, 3), "boxplot:rotulo"), c("Quinto ciclo", "Sexto ciclo", "Séptimo ciclo"))
  for (k in 1:4) expect_identical(.nm_txt(.nm_xml(out, k), "Folio lamina"), as.character(k))
})
