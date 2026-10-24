source("setup-load-all.R")

# CCSS Perfil 2026 (láminas 14, 21, 22 y 54): la dicotomía en estilo «partida» llegaba hasta el borde derecho sin margen y
# arrancaba a la izquierda sin alinear con el texto del título. La barra va ahora de borde de texto a borde de texto
# (`margen_izq` + la sangría de 0.1 in de las cajas), con el MISMO margen a ambos lados, y el bloque se centra en la zona de datos.

.mp_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.mp_espec <- function() {
  e <- preparar_categorica(c("Sí", "No"), c(.15, .85), c("15%", "85%"))
  e$colores <- c(`Sí` = "#081F5C", No = "#9DC3E6"); e$estilo_dicotomia <- "partida"; e
}
.mp_formas <- function(doc, nombre) {
  x <- doc$slide$get_slide(length(doc))$get()
  sp <- xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  off <- xml2::xml_find_all(sp, "p:spPr/a:xfrm/a:off"); ext <- xml2::xml_find_all(sp, "p:spPr/a:xfrm/a:ext")
  data.frame(x = as.numeric(xml2::xml_attr(off, "x")) / 914400, y = as.numeric(xml2::xml_attr(off, "y")) / 914400,
             w = as.numeric(xml2::xml_attr(ext, "cx")) / 914400, h = as.numeric(xml2::xml_attr(ext, "cy")) / 914400)
}
.mp_lamina <- function(pregunta = "Gestión del colegio") {
  .lam_laminas_dicotomia(.mp_doc(), .mp_espec(), "85 % estudió en un colegio de gestión privada", pregunta = pregunta,
                         base = "Base: 397 respuestas", folio = 14)$doc
}

test_that("la partida deja el mismo margen a izquierda y derecha, alineado con el texto del título", {
  W <- .std_geom("ancho"); ml <- .std_geom("margen_izq")
  b <- .mp_formas(.mp_lamina(), "dicotomia:segmento")
  expect_equal(nrow(b), 2L)
  x0 <- min(b$x); x1 <- max(b$x + b$w)
  expect_equal(x0, ml + 0.1, tolerance = 0.01)            # borde del texto del título
  expect_equal(W - x1, x0, tolerance = 0.01)              # margen derecho = margen izquierdo
  expect_gt(W - x1, .std_geom("margen_der") + 0.1)        # ya no pega al borde derecho
})

test_that("la cifra de la izquierda y la de la derecha caen sobre los bordes de la barra", {
  b <- .mp_formas(.mp_lamina(), "dicotomia:segmento"); c <- .mp_formas(.mp_lamina(), "dicotomia:cifra")
  expect_equal(min(c$x) + 0.1, min(b$x), tolerance = 0.01)
  expect_equal(max(c$x + c$w) - 0.1, max(b$x + b$w), tolerance = 0.01)
})

test_that("el bloque queda centrado verticalmente en la zona de datos", {
  yt <- .std_geom("zona_datos_y0"); yf <- .std_geom("contenido_y1")
  b <- .mp_formas(.mp_lamina(), "dicotomia:segmento"); p <- .mp_formas(.mp_lamina(), "panel:pregunta")
  arriba <- min(p$y) - yt; abajo <- yf - max(b$y + b$h)
  expect_lt(abs(arriba - abajo), 0.1)
})
