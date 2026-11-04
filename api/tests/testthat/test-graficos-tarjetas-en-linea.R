source("setup-load-all.R")

# Desglose en línea y composición «cifra lateral» (ADR 0129 §9; maqueta «Colegio y resumen ejecutivo», alternativa B
# de la lámina 17). Datos sintéticos.

.el_tarjeta <- function(fila, cruce = "primera_gen", dirs = c("up", "down"), fragil = FALSE, p = c(92, 72)) {
  list(cruce = cruce, fila = fila, total = 84, cifra_total = "84%", fragil = fragil, brecha = 20,
       grupos = data.frame(codigo = c("1", "2"), etiqueta = c("Algún padre o tutor con estudios universitarios", "Ningún padre o tutor con estudios universitarios"),
                           p = p, dir = dirs, fragil = fragil, stringsAsFactors = FALSE))
}
.el_conjunto <- function(tarjetas, modo = "en_linea") {
  list(tarjetas = tarjetas, total = length(tarjetas), tipo = "multiple",
       opcion = .tarjetas_opcion(list(tarjetas_diferencias = list(modo = modo, cortos = list(
         `Algún padre o tutor con estudios universitarios` = "Algún padre univ.", `Ningún padre o tutor con estudios universitarios` = "Ningún padre univ.")))),
       rotulos_cruce = c(primera_gen = "Estudios de padres", area = "Área"))
}
.el_espec <- function() preparar_categorica(c("Mis padres o tutores", "Mi trabajo", "Beca (Beca 18 u otra externa)", "Préstamo"),
                                             c(.84, .13, .13, .02), c("84%", "13%", "13%", "2%"))
.el_formas <- function(doc) {
  f <- tempfile(fileext = ".pptx"); print(doc, target = f)
  d <- tempfile(); utils::unzip(f, exdir = d)
  sl <- xml2::read_xml(file.path(d, "ppt/slides/slide1.xml")); ns <- xml2::xml_ns(sl)
  sp <- xml2::xml_find_all(sl, "//p:sp", ns)
  nm <- xml2::xml_attr(xml2::xml_find_first(sp, "p:nvSpPr/p:cNvPr"), "name")
  v <- function(x, a) as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, paste0(".//a:", x)), a)) / 914400
  fill <- xml2::xml_attr(xml2::xml_find_first(sp, "p:spPr/a:solidFill/a:srgbClr"), "val")
  data.frame(nombre = nm, x = v("off", "x"), y = v("off", "y"), w = v("ext", "cx"), h = v("ext", "cy"), fill = fill,
             texto = xml2::xml_text(sp), stringsAsFactors = FALSE)
}

test_that("la opción declara el modo en línea; por defecto, el panel de siempre", {
  expect_identical(.tarjetas_opcion(list(tarjetas_diferencias = TRUE))$modo, "panel")
  expect_identical(.tarjetas_opcion(list(tarjetas_diferencias = list(modo = "en_linea")))$modo, "en_linea")
  expect_identical(.tarjetas_opcion(list(tarjetas_diferencias = list(modo = "otra")))$modo, "panel")
})

test_that("en línea: una tarjeta por opción (la de mayor prioridad), hasta dos opciones, y avisa las que quedan fuera", {
  avisos <- character(0)
  local_mocked_bindings(.pulso_aviso = function(x) avisos <<- c(avisos, x))
  t <- .el_conjunto(list(.el_tarjeta("Mis padres o tutores"), .el_tarjeta("Mis padres o tutores", cruce = "area"),
                         .el_tarjeta("Beca (Beca 18 u otra externa)", fragil = TRUE), .el_tarjeta("Mi trabajo")))
  enl <- .tarjetas_en_linea(t, "Colegio")
  expect_identical(vapply(enl, `[[`, "", "fila"), c("Mis padres o tutores", "Beca (Beca 18 u otra externa)"))
  expect_identical(enl[[1]]$cruce, "primera_gen")
  expect_match(avisos, "2 diferencias más", fixed = TRUE)
  expect_true(.tarjetas_en_linea_aplica(t, .el_espec()))
  t$tipo <- "bateria"
  expect_false(.tarjetas_en_linea_aplica(t, .el_espec()))
})

test_that("en línea: bajo la opción, el cruce y sus grupos en la misma escala, con su tono; todo dentro de su franja", {
  lz <- .lam_lienzo()
  t <- .el_conjunto(list(.el_tarjeta("Mis padres o tutores")))
  y_fin <- .lam_barras_en_linea(lz, .el_espec(), .tarjetas_en_linea(t), t$rotulos_cruce, t$opcion$cortos, 4, 12.5, 1.5, 6.5)
  doc <- .lam_agrupar(officer::add_slide(officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp")),
                                         layout = "Graficos2", master = "Office Theme"), lz)
  f <- .el_formas(doc)
  expect_identical(sum(f$nombre == "en_linea:barra"), 4L)
  expect_identical(trimws(f$texto[f$nombre == "en_linea:cruce"]), "SEGÚN ESTUDIOS DE PADRES")
  g <- f[f$nombre == "en_linea:grupo", ]
  expect_setequal(trimws(g$texto), c("Algún padre univ.", "Ningún padre univ."))      # nombres cortos
  b <- f[f$nombre == "en_linea:grupo:barra", ]
  expect_identical(toupper(b$fill), toupper(sub("#", "", c(.std_color("azul"), .std_color("naranja_bottom_two_box")))))
  # Misma escala: el grupo de 92% es más largo que el total de 84%.
  expect_gt(max(b$w), f$w[f$nombre == "en_linea:barra"][1])
  expect_lte(y_fin, 6.5 + 1e-6)
  expect_true(all(f$y >= 1.5 - 1e-6))
})

test_that("la lámina de un gráfico en línea va a todo el ancho, sin panel de tarjetas; otra forma va con tarjetas y aviso", {
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  p <- ggplot2::ggplot(); attr(p, "pulso_espec") <- .el_espec()
  attr(p, "pulso_tarjetas") <- .el_conjunto(list(.el_tarjeta("Mis padres o tutores")))
  doc <- .lam_tarjetas_slide_1(doc, p, list(meta = list(), slots = list()), "¿Cómo solventas tus estudios?",
                               list(var = "x", .element_type = "barras_agrupadas"), list(base = list(args = list())),
                               "Graficos2", "Office Theme", NULL, base_auto = function(...) "Base: 400", nota_de = function(...) NULL)
  f <- tempfile(fileext = ".pptx"); print(doc, target = f)
  xml <- paste(readLines(unz(f, "ppt/slides/slide1.xml"), warn = FALSE), collapse = "")
  expect_match(xml, "prosecnur:grafico:en_linea", fixed = TRUE)
  expect_false(grepl("prosecnur:tarjetas_diferencias", xml, fixed = TRUE))
  expect_match(xml, "Mayor que el resto", fixed = TRUE)                        # la leyenda de las marcas
  expect_null(getOption("prosecnur.lam_reserva_derecha"))
})

test_that("cifra lateral: la tarjeta de la cifra con su franja partida, su intervalo y la comparación completa", {
  expect_true(.lam_cifra_lateral_aplica(list(meta = list(composicion = "cifra_lateral"))))
  expect_false(.lam_cifra_lateral_aplica(list(meta = list())))
  k <- list(fila = "Privado", valor = 85, cifra = "85%", texto = "estudió la secundaria en un colegio privado",
            intervalo = list(inferior = 0.81, superior = 0.89), intervalo_texto = "81% a 89%", n = 400, base = NULL,
            comparacion = list(partes = list(list(texto = "Sin diferencias por área, nivel, sexo ni estudios de padres", dir = NULL, fragil = NA)),
                               cola = NULL, estado = "sin_diferencias"))
  lz <- .lam_lienzo()
  .lam_cifra_tarjeta(lz, k, "Colegio de secundaria", "Estatal 15%", TRUE, 0.5, 1.4, 3.7, 4.8)
  doc <- .lam_agrupar(officer::add_slide(officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp")),
                                         layout = "Graficos2", master = "Office Theme"), lz)
  f <- .el_formas(doc)
  fr <- f[f$nombre == "cifra:franja", ]; iv <- f[f$nombre == "cifra:intervalo", ]
  expect_equal(fr$w / (fr$w + f$w[f$nombre == "cifra:franja:resto"]), 0.85, tolerance = 1e-3)
  expect_equal(iv$x - fr$x, (0.81 / 0.85) * fr$w, tolerance = 1e-3)            # el intervalo en la escala de la franja
  expect_true(any(grepl("Estatal 15%", f$texto, fixed = TRUE)))
  comp <- paste(trimws(f$texto[f$nombre == "hallazgo:comparacion"]), collapse = " ")
  expect_identical(comp, "Sin diferencias por área, nivel, sexo ni estudios de padres")   # completa, en dos líneas
  expect_true(all(f$y + f$h <= 1.4 + 4.8 + 1e-6))
})
