source("setup-load-all.R")

# CCSS-25 (CCSS Perfil 2026, lámina 12, grilla de seis): un título de lámina de tres líneas montaba su tercera línea sobre los
# encabezados de los paneles. Los paneles bajan (y se comprimen) bajo el bloque de título; con una o dos líneas no se mueven.

.t3_titulo3 <- "Dos de cada tres fueron criados por su madre y su padre, 38 % es primera generación universitaria y 56 % de las madres tiene estudios universitarios"

test_that("con título de una o dos líneas la geometría de la mixta no cambia", {
  for (tipo in c("poblacion_6", "poblacion_5", "paneles_4", "cifras_y_graficos", "graficos_2")) {
    geo <- .lam_mixta_geo(tipo)
    expect_identical(.lam_mixta_geo_bajo_titulo(geo, "Título corto"), geo, info = tipo)
    expect_identical(.lam_mixta_geo_bajo_titulo(geo, "El voluntariado es la agrupación presencial más frecuente y 28 % no participa en ninguna"), geo, info = tipo)
    expect_identical(.lam_mixta_geo_bajo_titulo(geo, "Título corto", sub = "Un subtítulo"), geo, info = tipo)
  }
})

test_that("con título de tres líneas los paneles empiezan bajo el bloque de título y no pasan del fin del contenido", {
  expect_equal(.lam_titulo_lineas(.t3_titulo3), 3L)
  for (tipo in c("poblacion_6", "paneles_4", "cifras_y_graficos")) {
    geo <- suppressMessages(.lam_mixta_geo_bajo_titulo(.lam_mixta_geo(tipo), .t3_titulo3))
    ys <- vapply(geo$paneles, function(p) p$y, 0); fines <- vapply(geo$paneles, function(p) p$y + p$h, 0)
    expect_gte(min(ys), .lam_titulo_fin(.t3_titulo3) + 0.08 - 1e-9)
    expect_lte(max(fines), .std_geom("contenido_y1") + 1e-9)
    for (f in geo$filetes) if (identical(f$tipo, "h")) expect_gt(f$y, min(ys), label = tipo)
  }
})

test_that("en la lámina de seis el encabezado de cada panel queda bajo la tercera línea del título", {
  skip_if_not_installed("officer"); skip_if_not_installed("xml2")
  nativo <- function() preparar_categorica(c("A", "B", "C"), c(.5, .3, .2), c("50%", "30%", "20%"), NULL)
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  doc <- suppressMessages(.lam_laminas_mixta(doc, rep(list(nativo()), 6), "poblacion_6", preguntas = as.list(paste("Pregunta", 1:6)),
                                             publicos = rep(list(NULL), 6), titulo = .t3_titulo3, base = "Base: 397", folio = 12L)$doc)
  out <- tempfile(fileext = ".pptx"); print(doc, target = out)
  xml <- xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc))))
  sp <- xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='panel:pregunta']]")
  y <- as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:off"), "y")) / 914400
  expect_length(y, 6L)
  expect_gte(min(y), .lam_titulo_fin(.t3_titulo3) + 0.08 - 1e-6)
})
