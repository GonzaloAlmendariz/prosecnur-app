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
  e <- attr(.histograma_recetario(x, modo = "conteo", unidad = "años"), "pulso_espec")
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
  expect_identical(.nm_txt(xml, "boxplot:cifra"), c("20 años", "21 años"))   # edades enteras: 21.5 se trunca como recetario_m3b.R:41 (Gonzalo, 2026-10-09)
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

test_that("las pesas siguen la regla del recetario: diferencia primero menos segundo y orden por la diferencia con signo (86)", {
  comp <- c("A", "B", "C")
  d <- data.frame(eje = rep(comp, 2), grupo = factor(rep(c("Docentes", "Estudiantes"), each = 3), levels = c("Docentes", "Estudiantes")),
                  valor = c(92, 96, 98, 94, 91, 96), n = rep(c(51, 109), each = 3))
  e <- attr(graficar_dumbbell(d), "pulso_espec")
  expect_identical(e$rotulos, c("B", "C", "A"))                                  # +5, +2, -2
  expect_identical(e$textos_diferencia, c("+5 pts", "+2 pts", "-2 pts"))
  expect_identical(e$leyenda, c("Docentes (51)", "Estudiantes (109)"))          # base constante por grupo: en la leyenda
  expect_true(all(is.na(e$n_fila)))
  o <- .lam_laminas_pesas(.nm_doc(), e, "Brecha", folio = 86)
  xml <- .nm_xml(.nm_print(o$doc), length(o$doc))
  expect_identical(.nm_txt(xml, "pesas:diferencia"), e$textos_diferencia)
  ca <- .nm_ext(xml, "pesas:cifra_a"); pa <- .nm_ext(xml, "pesas:punto_a"); pb <- .nm_ext(xml, "pesas:punto_b")
  expect_true(all(ifelse(e$a >= e$b, ca$x > pa$x, ca$x + ca$w < pa$x + pa$w)))   # la cifra al costado exterior de su punto
})

test_that("en la brecha entre públicos la leyenda sube al antetítulo con el color de cada público (G4)", {
  d <- data.frame(eje = rep(c("A", "B"), 2), grupo = factor(rep(c("Docentes", "Estudiantes"), each = 2), levels = c("Docentes", "Estudiantes")),
                  valor = c(92, 96, 94, 91), n = rep(c(51, 109), each = 2))
  e <- attr(graficar_dumbbell(d), "pulso_espec")
  xml <- .nm_xml(.nm_print(.lam_laminas_pesas(.nm_doc(), e, "Brecha", ante = "Comparaciones", folio = 86)$doc), 1L)
  expect_length(.nm_txt(xml, "leyenda:texto"), 0L)
  ante <- xml2::xml_find_first(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='Antetitulo lamina']]")
  expect_match(xml2::xml_text(ante), "COMPARACIONES.*DOCENTES \\(51\\).*ESTUDIANTES \\(109\\)")
  expect_true(all(toupper(sub("^#", "", e$colores)) %in% toupper(xml2::xml_attr(xml2::xml_find_all(ante, ".//a:srgbClr"), "val"))))
})

test_that("una lámina con meta$leyenda_antetitulo = FALSE apaga la leyenda arriba mientras se compone (G4)", {
  visto <- NULL
  slide <- list(meta = list(leyenda_antetitulo = FALSE), slots = list())
  p <- structure(list(), pulso_espec = list(tipo = "radar"))
  testthat::with_mocked_bindings(
    .lam_laminas_radar = function(doc, ...) { visto <<- getOption("prosecnur.lam_leyenda_antetitulo", TRUE); list(doc = doc) },
    .lam_slide_1_nativa(doc = list(), p = p, slide = slide, titulo = "T", subtitulo = NULL, el_plot = list(.element_type = "radar"),
                        presets = list(base = list(args = list())), layout = "L", master = "M", antetitulo = NULL,
                        base_auto = function(...) NULL, nota_de = function(...) NULL, sin_base = TRUE, sin_pie = TRUE),
    .package = "prosecnurapp")
  expect_false(visto)
  expect_true(getOption("prosecnur.lam_leyenda_antetitulo", TRUE))       # se restaura al salir
})

test_that("en las pesas de públicos (85) los casos van por fila y la leyenda nombra los indicadores sin base", {
  d <- data.frame(eje = rep(c("Docentes", "Estudiantes"), each = 2), grupo = factor(rep(c("Conoce", "Sabe"), 2), levels = c("Conoce", "Sabe")),
                  valor = c(98, 92, 77, 80), n = rep(c(52, 172), each = 2))
  e <- attr(graficar_dumbbell(d, orden = "declarado", mostrar_brecha = FALSE), "pulso_espec")
  expect_identical(e$leyenda, c("Conoce", "Sabe")); expect_equal(e$n_fila, c(52, 172))
  o <- .lam_laminas_pesas(.nm_doc(), e, "Misión", folio = 85)
  xml <- .nm_xml(.nm_print(o$doc), length(o$doc))
  expect_identical(.nm_txt(xml, "pesas:casos"), c("52 respuestas", "172 respuestas"))
  expect_length(.nm_txt(xml, "pesas:diferencia"), 0L)
})

test_that("la serie de dos mediciones es nativa sólo con dos períodos y escribe la diferencia en puntos (87)", {
  d <- data.frame(eje = rep(c("Docentes", "Estudiantes"), each = 2), grupo = rep(c("2021", "2026"), 2), valor = c(98, 83, 84, 53))
  e <- attr(graficar_serie_temporal(d), "pulso_espec")
  expect_identical(e$textos_diferencia, c("-15 pts", "-31 pts")); expect_equal(unname(e$eje), c(40, 100, 20))
  d3 <- rbind(d, data.frame(eje = c("Docentes", "Estudiantes"), grupo = "2016", valor = c(90, 80)))
  expect_identical(attr(graficar_serie_temporal(d3), "pulso_espec")$tipo, "ggplot_marco")   # tres períodos: ggplot en su lámina (88)
  o <- .lam_laminas_serie2(.nm_doc(), e, "Tutoría", folio = 87)
  xml <- .nm_xml(.nm_print(o$doc), length(o$doc))
  expect_identical(.nm_txt(xml, "serie2:cifra_final"), c("Docentes 83%", "Estudiantes 53%"))
  ln <- xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='serie2:pendiente']]")
  expect_length(ln, 2L)
  expect_true(all(is.na(xml2::xml_attr(xml2::xml_find_first(ln, "./p:spPr/a:xfrm"), "flipV"))))   # bajan: sin volteo
})

test_that("el compositor despacha pesas y serie de dos a su lámina nativa", {
  d <- data.frame(eje = rep(c("A", "B"), 2), grupo = factor(rep(c("X", "Y"), each = 2), levels = c("X", "Y")), valor = c(90, 80, 85, 82))
  p <- graficar_dumbbell(d)
  expect_true(.lam_compositor_aplica(p, list()))
  expect_false(.lam_compositor_aplica(p, list(meta = list(motor_nativo = FALSE))))
  doc <- .lam_slide_1_nativa(.nm_doc(), p, list(), "Brecha", NULL, list(var = NULL, .element_type = "dumbbell"), list(),
                             "Graficos2", "Office Theme", NULL, function(...) NULL, function(...) NULL)
  xml <- .nm_xml(.nm_print(doc), length(doc))
  expect_true("prosecnur:grafico:pesas" %in% xml2::xml_attr(xml2::xml_find_all(xml, "//p:grpSp/p:nvGrpSpPr/p:cNvPr"), "name"))
})

# ---- Hallazgos del verificador de N4 (ruta real con datos de borde) ----------

test_that("el numérico escribe pct en 0-100 con los decimales y el formato del gráfico", {
  dw <- tibble::tibble(categoria = factor(c("a", "b"), levels = c("a", "b")), N = c(63, 58), v = c(34.24, 31.52))
  e <- attr(.numerico_sellar(ggplot2::ggplot(), "pct", "Porcentaje", dw, "v", list(decimales = 1, formato_etiqueta = "%s%%")), "pulso_espec")
  expect_identical(e$cifras, c("34.2%", "31.5%"))                                     # hallazgo 1: antes «3424%»
  e2 <- attr(.numerico_sellar(ggplot2::ggplot(), "mean", "Media", dw, "v", list(decimales = 1, formato_etiqueta = "S/ %s")), "pulso_espec")
  expect_identical(e2$cifras, c("S/ 34.2", "S/ 31.5"))                                # hallazgo 5: el formato declarado
  dw3 <- tibble::tibble(categoria = "a", N = 1, v = 4305.8)
  expect_identical(attr(.numerico_sellar(ggplot2::ggplot(), "mean", "Media", dw3, "v", list(decimales = 1, formato_etiqueta = "S/ %s")), "pulso_espec")$cifras,
                   "S/ 4,305.8")
  dwn <- tibble::tibble(categoria = "a", N = 20, v = 20)
  expect_identical(attr(.numerico_sellar(ggplot2::ggplot(), "N", "Casos", dwn, "v", list(decimales = 0)), "pulso_espec")$cifras, "20")
})

test_that("las compuertas miden lo que se dibuja: lo que no cabe sigue por la ruta anterior", {
  largo <- function(i) sprintf("Grupo %02d con un nombre deliberadamente largo para probar la compuerta de la lámina", i)
  num <- list(tipo = "numerico", rotulos = largo(1:12), valores = 1:12, cifras = as.character(1:12), n = rep(10, 12))
  expect_false(.lam_numericos_cabe(num))                                              # hallazgo 2: rótulos que se pisan
  expect_true(.lam_numericos_cabe(modifyList(num, list(rotulos = paste("G", 1:12)))))
  bx <- preparar_boxplot(factor(rep(largo(1:6), each = 3)), rnorm(18))
  expect_false(.lam_numericos_cabe(bx))
  bx2 <- preparar_boxplot(factor(rep(c("A", "B"), each = 3)), c(1, 2, 3, 2, 3, 4)); expect_true(.lam_numericos_cabe(bx2))
  bx2$cortes_chip <- c(2, 3); expect_false(.lam_numericos_cabe(bx2))                  # chips declarados: ruta anterior
  s4 <- list(tipo = "serie2", series = c("A", "B", "C", "D"), periodos = c("2021", "2026"), v1 = 40:43, v2 = 50:53,
             cifras2 = paste0(50:53, "%"), eje = c(lo = 30, hi = 60, paso = 10))
  expect_false(.lam_numericos_cabe(s4))                                               # series encimadas
  expect_false(.lam_numericos_cabe(list(tipo = "histograma", valores = 5, cifras = "5", rotulos = "3")))   # un solo valor
})

test_that("ejes y extremos de números grandes se escriben sin notación científica y alineados al paso", {
  expect_identical(.lam_num(c(1e5, 2e5, 58465.83, -0.94, 7)), c("100,000", "200,000", "58,465.8", "-0.9", "7"))
  bx <- preparar_boxplot(factor(rep(c("A", "B"), each = 4)), c(59, 1e5, 2e5, 249000, 1113, 5e4, 1.5e5, 2.4e5))
  o <- .lam_laminas_boxplot(.nm_doc(), bx, "Ingreso", folio = 1)
  ej <- .nm_txt(.nm_xml(.nm_print(o$doc), length(o$doc)), "boxplot:eje")
  expect_false(any(grepl("e\\+", ej)))
  v <- as.numeric(gsub(",", "", ej)); expect_true(all(v %% (v[2] - v[1]) == 0))       # hallazgo 3: guías en múltiplos del paso
})

test_that("las pesas restan las cifras que se leen y la cifra junto a un 0 no entra en los rótulos", {
  d <- data.frame(eje = rep(c("A", "Cero"), 2), grupo = factor(rep(c("X", "Y"), each = 2), levels = c("X", "Y")),
                  valor = c(20.4, 0, 17.6, 12))
  e <- attr(graficar_dumbbell(d, orden = "declarado", limite_x = c(0, 30)), "pulso_espec")
  expect_identical(e$cifras_a[1], "20%"); expect_identical(e$cifras_b[1], "18%")
  expect_identical(e$textos_diferencia[1], "+2 pts")                                  # hallazgo 4: antes «+3 pts»
  o <- .lam_laminas_pesas(.nm_doc(), e, "Pesas", folio = 1)
  ca <- .nm_ext(.nm_xml(.nm_print(o$doc), length(o$doc)), "pesas:cifra_a")
  cb <- .nm_ext(.nm_xml(.nm_print(o$doc), length(o$doc)), "pesas:cifra_b")
  # Hallazgo 8 y pendiente de la ronda 2: la cifra del 0 no entra en los rótulos ni tapa el punto del otro grupo:
  # queda fuera de la columna de rótulos o sube sobre su fila.
  fuera <- ca$x >= .std_geom("margen_izq") + 2.8 + 0.05 - 1e-6; sube <- ca$y < cb$y - 0.2
  expect_true(all(fuera | sube)); expect_true(sube[2])
})

test_that("la unidad sale de la etiqueta de la variable: «años» sólo si habla de edad", {
  expect_identical(.unidad_de_etiqueta("¿Cuántos años tiene en la actualidad?"), "años")
  expect_identical(.unidad_de_etiqueta("Edad"), "años")
  expect_identical(.unidad_de_etiqueta("Ingreso mensual"), "")
  d <- data.frame(x = c(-2, -1, 0, 1, 2)); attr(d$x, "label") <- "Puntaje"
  p <- graficar_histograma(d, var = "x", exportar = "rplot")
  expect_identical(attr(p, "pulso_espec")$texto_mediana, "Mediana: 0")                # hallazgo 7: antes «Mediana: 0 años»
})

test_that("la unidad y el encabezado del eje salen de la etiqueta del instrumento por la ruta real", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  set.seed(9); dat <- data.frame(p3 = sample(19:30, 90, TRUE), ciclo = sample(c("1", "2"), 90, TRUE), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("p3", "ciclo"), type = c("integer", "select_one cic"), list_name = c(NA, "cic"),
                                   label = c("¿Cuál es tu edad?", "Ciclo"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = "cic", name = c("1", "2"), label = c("Quinto", "Sexto"), stringsAsFactors = FALSE), orders_list = NULL)
  plan <- list(a = p_slide_1_grafico(grafico = p_histograma("p3"), titulo = "Edad"),
               b = p_slide_1_grafico(grafico = p_boxplot("p3", cruce = "ciclo"), titulo = "Caja"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  expect_match(.nm_txt(.nm_xml(out, 1), "histograma:texto_mediana"), "años$")      # misma fuente que la caja (pendiente 1)
  x2 <- .nm_xml(out, 2)
  expect_true(all(grepl("años$", .nm_txt(x2, "boxplot:cifra"))))
  expect_identical(.nm_txt(x2, "boxplot:encabezado"), "Edad, en años")              # pendiente 2
})

test_that("la mediana no entera de datos enteros se trunca en el texto como el recetario y el triángulo sigue en su valor (Gonzalo, 2026-10-09)", {
  e <- attr(.histograma_recetario(c(20, 21, 22, 23), modo = "conteo", unidad = "años"), "pulso_espec")
  expect_identical(e$texto_mediana, "Mediana: 21 años")
  expect_equal(e$mediana, 21.5); expect_equal(e$x_mediana, 1.5)
  expect_identical(attr(.histograma_recetario(c(20, 21, 22), modo = "conteo"), "pulso_espec")$texto_mediana, "Mediana: 21")
  expect_identical(.cifra_mediana(-1.5, TRUE), "-1")                       # hacia cero, no «-2»
  expect_identical(.cifra_mediana(14.35, FALSE), "14.4")                   # datos decimales: no se trunca
  b <- preparar_boxplot(rep("A", 4), c(20, 21, 24, 25))
  expect_true(b$enteros); expect_equal(b$grupos$mediana, 22.5)
  o <- .lam_laminas_boxplot(.nm_doc(), b, "Edad", folio = 81, unidad = "años")
  expect_identical(.nm_txt(.nm_xml(.nm_print(o$doc), length(o$doc)), "boxplot:cifra"), "22 años")
  expect_false(preparar_boxplot(rep("A", 3), c(14.2, 14.35, 15))$enteros)
})
