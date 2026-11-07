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

# Revisión del PPT v7.23 de CCSS, ítem 11 (Gonzalo: «pensé que el gráfico dicotómico ya había desaparecido; aquí debe haber
# un gráfico apilado clásico»): la lámina ya no dibuja la franja partida, ni cuando el plan la pide. Antes estos tests
# medían sus márgenes sobre la lámina; la regla de márgenes queda en su geometría (`.lam_dicotomia_partida_geo`), que es
# lo único que sigue en pie de la pieza.

test_that("v7.23 ítem 11: la lámina con estilo «partida» sale como apilada clásica, sin la franja", {
  doc <- .mp_lamina()
  expect_equal(nrow(.mp_formas(doc, "dicotomia:segmento")), 0L)
  expect_equal(nrow(.mp_formas(doc, "dicotomia:cifra")), 0L)
  expect_equal(nrow(.mp_formas(doc, "segmento")), 2L)
})

test_that("la geometría de la partida deja el mismo margen a izquierda y derecha, alineado con el texto del título", {
  W <- .std_geom("ancho"); ml <- .std_geom("margen_izq")
  g <- .lam_dicotomia_partida_geo(TRUE)
  expect_equal(g$x, ml + 0.1, tolerance = 0.01)            # borde del texto del título
  expect_equal(W - (g$x + g$w), g$x, tolerance = 0.01)      # margen derecho = margen izquierdo
  expect_gt(W - (g$x + g$w), .std_geom("margen_der") + 0.1)
})
