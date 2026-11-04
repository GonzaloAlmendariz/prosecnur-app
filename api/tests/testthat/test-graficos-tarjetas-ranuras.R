source("setup-load-all.R")

# Tarjetas de diferencias por gráfico en una lámina de dos gráficos (ADR 0129 §6; maqueta «Composición y línea por
# nivel», 07_combinada_transporte_y_tiempo): un mapa por ranura en la meta de la lámina, hasta 2 tarjetas por gráfico,
# debajo de su gráfico y dentro de su mitad. Datos sintéticos.

.tr_tarjeta <- function(fila = "Taxi o aplicativo", cruce = "area") {
  list(cruce = cruce, fila = fila, total = 13, cifra_total = "13%", fragil = FALSE, brecha = 13,
       grupos = data.frame(codigo = c("1", "2"), etiqueta = c("Ciencias políticas y sociales", "Economía y Finanzas"),
                           p = c(20, 7), dir = c("up", "down"), fragil = FALSE, stringsAsFactors = FALSE))
}
.tr_conjunto <- function(n) list(tarjetas = rep(list(.tr_tarjeta()), n), tipo = "multiple", total = n,
                                 opcion = list(cortos = c(`Ciencias políticas y sociales` = "CC. Pol. y Soc.",
                                                          `Economía y Finanzas` = "Econ. y Finanzas")),
                                 rotulos_cruce = c(area = "Área"), pedidas = TRUE)

test_that("el mapa por ranura se lee con el tope de 2 y no cuenta como opción de una lámina de un gráfico", {
  meta <- list(tarjetas_diferencias = list(izquierda = list(publico = "estudiantes", max = 4), derecha = TRUE))
  m <- .tarjetas_mapa(meta)
  expect_identical(names(m), c("izquierda", "derecha"))
  expect_identical(m$izquierda$max, 2L)
  expect_identical(m$izquierda$publico, "estudiantes")
  expect_identical(m$derecha$max, 2L)
  expect_null(.tarjetas_opcion(meta))                                   # no es una lámina de un gráfico
  expect_null(.tarjetas_mapa(list(tarjetas_diferencias = TRUE)))         # ni un mapa
  m2 <- .tarjetas_mapa(list(tarjetas_diferencias = list(derecha = TRUE)))
  expect_null(m2$izquierda)
  expect_null(.tarjetas_mapa(list(tarjetas_diferencias = list(izquierda = FALSE))))
})

test_that("la reserva inferior acorta los dos paneles de graficos_2 y, sin tarjetas, la geometría no cambia", {
  g0 <- .lam_mixta_geo("graficos_2")
  g1 <- withr::with_options(list(prosecnur.lam_reserva_inferior = 1.7), .lam_mixta_geo("graficos_2"))
  expect_equal(g0$paneles[[1]]$h - g1$paneles[[1]]$h, 1.7)
  expect_equal(g0$paneles[[2]]$h - g1$paneles[[2]]$h, 1.7)
  expect_equal(g1$filetes, g0$filetes)                                   # el filete vertical sigue entero
  expect_equal(.lam_mixta_geo("graficos_3_1mas2"), withr::with_options(list(prosecnur.lam_reserva_inferior = 1.7), .lam_mixta_geo("graficos_3_1mas2")))
})

test_that("bajo un gráfico la tarjeta es compacta: el nombre corto a la izquierda, y mide menos que la de una lámina", {
  t <- .tr_tarjeta(); cortos <- .tr_conjunto(1)$opcion$cortos
  alto_lamina <- .lam_tarjeta_alto(t, 2.9, cortos = cortos)
  withr::with_options(list(prosecnur.lam_tarjeta_compacta = TRUE), {
    expect_false(.lam_tarjeta_medidas(2.9)$apilada)
    expect_identical(.tarjetas_rotulo_grupo("Economía y Finanzas", c(`Economía y Finanzas` = "Econ. y Finanzas")), "Econ. y Finanzas")
    expect_lt(.lam_tarjeta_alto(t, 2.9, cortos = cortos), alto_lamina)
  })
  expect_true(.lam_tarjeta_medidas(2.9)$apilada)                         # fuera de la franja, como siempre
})

test_that("PPT: hasta dos tarjetas por gráfico, dentro de su mitad y bajo su gráfico; la mitad sin diferencias no lleva nada", {
  doc <- officer::add_slide(officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp")),
                            layout = "Graficos2", master = "Office Theme")
  ts <- list(.tr_conjunto(2), list(tarjetas = list(), opcion = list(), pedidas = TRUE))
  doc <- .lam_tarjetas_ranuras_dibujar(doc, ts)
  f <- tempfile(fileext = ".pptx"); print(doc, target = f)
  d <- tempfile(); utils::unzip(f, "ppt/slides/slide1.xml", exdir = d)
  sl <- xml2::read_xml(file.path(d, "ppt/slides/slide1.xml")); ns <- xml2::xml_ns(sl)
  caja <- function(nombre) {
    sp <- xml2::xml_find_all(sl, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre), ns)
    v <- function(x, a) as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, paste0(".//a:", x)), a)) / 914400
    data.frame(x = v("off", "x"), y = v("off", "y"), w = v("ext", "cx"), h = v("ext", "cy"))
  }
  geo <- .lam_mixta_geo("graficos_2"); P <- geo$paneles
  tj <- caja("tarjeta:99")
  expect_identical(nrow(tj), 2L)
  expect_true(all(tj$x >= P[[1]]$x - 1e-6 & tj$x + tj$w <= P[[1]]$x + P[[1]]$w + 1e-6))   # en la mitad izquierda
  expect_true(all(tj$y + tj$h <= .std_geom("contenido_y1") + 0.02))
  expect_gt(min(tj$y), P[[1]]$y + 2)                                                       # debajo del gráfico
  xml <- paste(readLines(file.path(d, "ppt/slides/slide1.xml"), warn = FALSE), collapse = "")
  expect_match(xml, "CC. Pol. y Soc.", fixed = TRUE)
  # Ítem 18 de la v7 RV: ni la nota de «sin diferencias» ni el filete en la mitad sin tarjetas.
  expect_false(grepl("Sin diferencias", xml, fixed = TRUE))
  sep <- caja("separador")
  expect_identical(nrow(sep), 1L)
  expect_lt(sep$x + sep$w, P[[2]]$x)
})

test_that("si los gráficos no caben sobre la franja, la lámina va sin tarjetas y un aviso dice qué acortar", {
  avisos <- character(0)
  local_mocked_bindings(.pulso_aviso = function(x) avisos <<- c(avisos, x), .lam_slide_2_caben_con_tarjetas = function(...) FALSE)
  base <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  compone <- function(d) officer::add_slide(d, layout = "Graficos2", master = "Office Theme")
  doc <- .lam_slide_2_con_tarjetas(base, list(.tr_conjunto(1), NULL), compone, ps = list(1, 2), els = list(), titulo = "Transporte")
  f <- tempfile(fileext = ".pptx"); print(doc, target = f)
  xml <- paste(readLines(unz(f, "ppt/slides/slide1.xml"), warn = FALSE), collapse = "")
  expect_false(grepl("prosecnur:tarjetas_diferencias", xml, fixed = TRUE))
  expect_match(avisos, "no caben sobre las tarjetas", fixed = TRUE)
  expect_null(getOption("prosecnur.lam_reserva_inferior"))
})

test_that("Word: cada figura de una lámina de dos gráficos lleva las tarjetas de su ranura, con el tope de 2", {
  el_izq <- structure(list(var = "B1", .element_type = "barras_agrupadas"), class = "ppt_element")
  el_der <- structure(list(var = "B2", .element_type = "barras_agrupadas"), class = "ppt_element")
  motor <- new.env()
  motor$stype <- "slide_2"
  motor$slide <- list(meta = list(tarjetas_diferencias = list(derecha = TRUE)), slots = list(left = el_izq, right = el_der))
  motor$.resolve_ref <- function(...) NULL
  vistas <- character(0)
  local_mocked_bindings(.tarjetas_de_lamina = function(p, slide, resolver) {
    vistas <<- c(vistas, slide$slots$plot$var)
    .tr_conjunto(3)
  })
  marco <- new.env(parent = motor)   # el marco de `.push_render_meta_for_element`, hijo del motor
  p <- ggplot2::ggplot()
  expect_null(attr(.tarjetas_word_ranura(p, el_izq, marco), "pulso_tarjetas"))   # la izquierda no las pidió
  q <- .tarjetas_word_ranura(p, el_der, marco)
  expect_identical(vistas, "B2")
  expect_length(attr(q, "pulso_tarjetas")$tarjetas, 2L)
  motor$stype <- "slide_1"
  expect_null(attr(.tarjetas_word_ranura(p, el_der, marco), "pulso_tarjetas"))
})

test_that("sin ninguna diferencia en la lámina no hay franja: los paneles conservan su alto y no se dibuja nada", {
  vistos <- NULL
  base <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  compone <- function(d) { vistos <<- getOption("prosecnur.lam_reserva_inferior"); officer::add_slide(d, layout = "Graficos2", master = "Office Theme") }
  vacia <- list(tarjetas = list(), opcion = list(), pedidas = TRUE)
  doc <- .lam_slide_2_con_tarjetas(base, list(vacia, vacia), compone, ps = list(1, 2), els = list(), titulo = "Tiempo")
  expect_null(vistos)
  f <- tempfile(fileext = ".pptx"); print(doc, target = f)
  xml <- paste(readLines(unz(f, "ppt/slides/slide1.xml"), warn = FALSE), collapse = "")
  expect_false(grepl("Sin diferencias", xml, fixed = TRUE))
  expect_false(grepl("prosecnur:tarjetas_diferencias", xml, fixed = TRUE))
})

test_that("la mitad sin tarjetas usa todo su alto: la franja solo acorta el panel que las lleva", {
  # Ítem 11 de la v7.11 RV: «que uno tenga tarjetas no significa que el otro no pueda usar todo su alto».
  g0 <- .lam_mixta_geo("graficos_2")
  r <- .lam_reservas_por_mitad(list(.tr_conjunto(2), list(tarjetas = list())), 1.7)
  expect_identical(r, c(1.7, 0))
  g1 <- withr::with_options(list(prosecnur.lam_reserva_inferior = r), .lam_mixta_geo("graficos_2"))
  expect_equal(g0$paneles[[1]]$h - g1$paneles[[1]]$h, 1.7)
  expect_equal(g1$paneles[[2]]$h, g0$paneles[[2]]$h)
  vistas <- NULL
  local_mocked_bindings(.lam_slide_2_caben_con_tarjetas = function(ps, els, reserva, titulo_de_var = NULL) { vistas <<- reserva; TRUE })
  compone <- function(d) { vistas <<- c(vistas, getOption("prosecnur.lam_reserva_inferior")); officer::add_slide(d, layout = "Graficos2", master = "Office Theme") }
  base <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  .lam_slide_2_con_tarjetas(base, list(NULL, .tr_conjunto(1)), compone, ps = list(1, 2), els = list(), titulo = "T")
  expect_equal(vistas[1], 0)                     # izquierda sin tarjetas: sin franja
  expect_gt(vistas[2], 0)
  expect_equal(tail(vistas, 2), vistas[1:2])     # lo que se probó es lo que se compone
})

test_that("una franja dicotómica con tarjetas llena su mitad: más grande, centrada y con sus tarjetas pegadas debajo", {
  # Ítem 14 de la v7.11 RV: B19 (Sí/No) dejaba la mitad vacía y su tarjeta al pie.
  e <- preparar_categorica(c("Sí", "No"), c(.28, .72), c("28%", "72%"))
  geo <- .lam_mixta_geo("graficos_2"); col2 <- geo$paneles[[1]]$w
  expect_true(.lam_ranura_es_dicotomia(e, col2))
  expect_false(.lam_ranura_es_dicotomia(preparar_categorica(c("A", "B", "C"), c(.5, .3, .2), c("50%", "30%", "20%")), col2))
  r <- .lam_receta_dicotomia_con_tarjetas(4.6, 1.2)
  expect_true(r$conserva_estilo)                                   # el título del panel como el de la otra mitad
  expect_gt(r$dicotomia$dy, 0.65)                                  # bajada para centrar el bloque
  expect_equal(r$dicotomia$size, .TARJETAS_DICO_CIFRA)
  expect_equal(.lam_receta_dicotomia_con_tarjetas(1, 5)$dicotomia$dy, 0.65)   # sin alto libre, en su lugar de siempre
  vistas <- list()
  local_mocked_bindings(.lam_slide_2_caben_con_tarjetas = function(...) TRUE, .lam_espec_de = function(p) p,
                        .lam_tarjetas_ranuras_dibujar = function(doc, ts, debajo = c(FALSE, FALSE)) { vistas$debajo <<- debajo; doc })
  compone <- function(d) {
    vistas$reserva <<- getOption("prosecnur.lam_reserva_inferior"); vistas$recetas <<- getOption("prosecnur.lam_recetas_ranura")
    d
  }
  barras <- preparar_categorica(c("A", "B", "C"), c(.5, .3, .2), c("50%", "30%", "20%"))
  .lam_slide_2_con_tarjetas(NULL, list(.tr_conjunto(1), .tr_conjunto(1)), compone, ps = list(barras, e), els = list(), titulo = "T")
  expect_identical(vistas$debajo, c(FALSE, TRUE))
  expect_gt(vistas$reserva[1], 0); expect_equal(vistas$reserva[2], 0)    # la franja no reserva alto
  expect_null(vistas$recetas[[1]]); expect_true(vistas$recetas[[2]]$conserva_estilo)
  expect_null(getOption("prosecnur.lam_recetas_ranura"))                 # no queda pegada
})
