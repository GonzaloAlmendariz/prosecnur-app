source("setup-load-all.R")

# L10-8 (bandeja CCSS, 2026-10-24; láminas 38 y 66 del mazo V2): algunos tallos del lollipop salían dobles, dos líneas
# paralelas con un contorno visible. El tallo era un rectángulo de 0.024 in con relleno y un contorno de 0.25 pt del
# mismo color: al rasterizar, el contorno se ajusta al píxel y el relleno no, y según en qué fracción de píxel caía la
# fila se veían dos trazos. Ahora es una línea de ese mismo grosor, sin contorno: un solo trazo en cualquier fila.

.l10bl_xml <- function(doc) { out <- tempfile(fileext = ".pptx"); print(doc, target = out); xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc)))) }
.l10bl_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))

test_that("L10-8: cada tallo del lollipop es una línea de un solo trazo, del eje al punto", {
  skip_if_not_installed("officer")
  d <- data.frame(cat = c("Biblioteca", "Aulas de clase", "Patios", "Jardines", "Café", "Otros"), v = c(61, 50, 26, 16, 10, 3))
  e <- attr(graficar_lollipop(d, "cat", "v", residuales_gris = TRUE), "pulso_espec")
  xml <- .l10bl_xml(.lam_laminas_lollipop(.l10bl_doc(), e, "Espacios", folio = 38)$doc)
  tallos <- xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='lollipop:tallo']]")
  expect_length(tallos, 6L)
  expect_identical(unique(xml2::xml_attr(xml2::xml_find_first(tallos, ".//a:prstGeom"), "prst")), "line")
  # Sin relleno propio: el trazo es la línea (un relleno con contorno es lo que se veía doble).
  expect_length(xml2::xml_find_all(tallos, "./p:spPr/a:solidFill"), 0L)
  grosor <- as.numeric(xml2::xml_attr(xml2::xml_find_first(tallos, ".//a:ln"), "w")) / 12700
  expect_true(all(abs(grosor - (0.024 * 72 + 0.25)) < 0.05))             # el grosor visible de antes: 0.024 in y su contorno
  # Horizontal (alto 0) y de largo proporcional a su cifra (61 contra 50).
  ext <- xml2::xml_find_first(tallos, ".//a:ext")
  expect_true(all(as.numeric(xml2::xml_attr(ext, "cy")) == 0))
  w <- as.numeric(xml2::xml_attr(ext, "cx"))
  expect_equal(w[1] / w[2], 61 / 50, tolerance = 1e-3)
  # Las cifras y los puntos no cambian.
  expect_identical(xml2::xml_text(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='lollipop:cifra']]")),
                   c("61%", "50%", "26%", "16%", "10%", "3%"))
})
