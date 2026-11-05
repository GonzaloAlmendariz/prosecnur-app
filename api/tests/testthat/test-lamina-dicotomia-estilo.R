# La dicotómica: cifras en el color de su tramo, rótulos legibles y variante vertical (Gonzalo, 2026-10-14).

.dce_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.dce_formas <- function(doc, nombre) {
  out <- tempfile(fileext = ".pptx"); print(doc, target = out)
  xml <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
}
.dce_espec <- function() list(tipo = "categorica", rotulos = c("Sí", "No"), cifras = c("76%", "24%"), largos = c(0.76, 0.24),
                              valores = c(0.76, 0.24), colores = c(`Sí` = "#081F5C", No = "#CA5651"))

# Revisión del PPT v7.23 de CCSS, ítem 11: la lámina ya no dibuja la franja partida (sale como apilada clásica, test de
# abajo); la pieza `.lam_dicotomia` queda en el recetario y sus reglas de color y rótulo se prueban sobre la pieza.
test_that("la pieza partida: cada cifra va en el color de su tramo y el rótulo a 14 pt en negrita", {
  e <- .dce_espec()
  doc <- officer::add_slide(.dce_doc(), layout = "Graficos2", master = "Office Theme")
  lz <- .lam_lienzo()
  .lam_dicotomia(lz, 1, 2, 10, e$rotulos, e$cifras, e$largos, size = 40, g = 0.7, cols = unname(e$colores), size_rot = 14)
  o <- list(doc = .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:dicotomia"))
  cif <- .dce_formas(o$doc, "dicotomia:cifra")
  cols <- toupper(xml2::xml_attr(xml2::xml_find_first(cif, ".//a:srgbClr"), "val"))
  expect_identical(cols, c("081F5C", "CA5651"))
  rot <- .dce_formas(o$doc, "dicotomia:rotulo")
  expect_true(all(xml2::xml_attr(xml2::xml_find_first(rot, ".//a:rPr"), "sz") == "1400"))
  expect_true(all(xml2::xml_attr(xml2::xml_find_first(rot, ".//a:rPr"), "b") == "1"))
})

test_that("v7.23 ítem 11: la lámina de una Sí/No no dibuja la franja partida", {
  o <- .lam_laminas_dicotomia(.dce_doc(), .dce_espec(), "Dicotómica")
  expect_length(.dce_formas(o$doc, "dicotomia:cifra"), 0L)
  expect_length(.dce_formas(o$doc, "segmento"), 2L)
})

test_that("un tramo muy claro escribe su cifra en un tono más hondo del mismo color", {
  expect_identical(.lam_color_legible("#081F5C"), "#081F5C")
  claro <- .lam_color_legible("#A9CBEA")
  expect_false(identical(toupper(claro), "#A9CBEA"))
})

test_that("la dicotómica vertical se pide con orientacion y dibuja la columna de pie", {
  expect_identical(p_dicotomica("trabaja", orientacion = "vertical")$overrides$orientacion_dicotomica, "vertical")
  expect_error(p_dicotomica("trabaja", orientacion = "diagonal"), "horizontal")
  e <- .dce_espec()
  testthat::local_mocked_bindings(.lam_dicotomia_datos = function(espec) list(rotulos = e$rotulos, cifras = e$cifras, largos = e$largos,
                                                                              n = NULL, colores = unname(e$colores)), .package = "prosecnurapp")
  o <- .lam_laminas_dicotomia(.dce_doc(), e, "Dicotómica", vertical = TRUE)
  seg <- .dce_formas(o$doc, "dicotomia:segmento")
  ext <- xml2::xml_find_all(seg, ".//a:ext")
  w <- as.numeric(xml2::xml_attr(ext, "cx")); h <- as.numeric(xml2::xml_attr(ext, "cy"))
  expect_true(all(h > w * 0.3) && sum(h) > 2 * max(w))                    # de pie: la columna es más alta que ancha
})
