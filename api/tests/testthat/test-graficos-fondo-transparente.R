source("setup-load-all.R")

# P10 (Gonzalo, 2026-11-09): «no creo que en los gráficos haga falta tener barras blancas y otras transparentes, todo
# debería ser transparente». El contraste, las aperturas por grupo y el panorama ya no pintan un panel blanco ni bandas
# alternas detrás de sus filas, ni a página entera, ni en una ranura, ni en la imagen de respaldo. Las tablas nativas
# (lamina_tabla_familia.R) son tablas y conservan su cebra.

.ft_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.ft_xml <- function(doc) { out <- tempfile(fileext = ".pptx"); print(doc, target = out); xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc)))) }
# Formas con relleno blanco o con los nombres del panel y las bandas de antes.
.ft_fondos <- function(xml) {
  blancas <- xml2::xml_find_all(xml, "//p:sp[p:spPr/a:solidFill/a:srgbClr[@val='FFFFFF']]")
  nombres <- xml2::xml_attr(xml2::xml_find_all(xml, "//p:sp/p:nvSpPr/p:cNvPr"), "name")
  list(blancas = length(blancas), panel_banda = sum(nombres %in% c("puntos:panel", "puntos:banda")))
}
.ft_contraste <- function(k = 2L) {
  ejes <- c("Reglamentos se aplican", "Docentes actualizados", "Servicio de salud", "Autoridades accesibles")
  g <- c("Estudiantes", "Docentes", "Administrativos", "Egresados")[seq_len(k)]
  d <- do.call(rbind, lapply(seq_along(g), function(j) data.frame(eje = ejes, grupo = g[j], valor = c(76, 92, 83, 80) - 7 * j, n_casos = 100)))
  d$grupo <- factor(d$grupo, levels = g); d
}
.ft_panorama <- function() data.frame(publico = factor(rep(c("Estudiantes", "Docentes"), c(5, 4)), levels = c("Estudiantes", "Docentes")),
                                      item = paste0("p", 1:9), valor = c(84, 90, 58, 77, 95, 73, 40, 59.6, 80))

test_that("el contraste (dos y tres grupos) y el panorama a página entera no pintan fondo blanco ni bandas", {
  for (k in 2:3) {
    e <- attr(graficar_dumbbell(.ft_contraste(k), estilo = "resumen"), "pulso_espec")
    f <- .ft_fondos(.ft_xml(.lam_laminas_contraste(.ft_doc(), e, "Contraste", folio = 1)$doc))
    expect_identical(f, list(blancas = 0L, panel_banda = 0L), label = k)
  }
  e <- attr(graficar_panorama(.ft_panorama()), "pulso_espec")
  expect_identical(.ft_fondos(.ft_xml(.lam_laminas_panorama(.ft_doc(), e, "Panorama", folio = 1)$doc)), list(blancas = 0L, panel_banda = 0L))
})

test_that("en una ranura tampoco, y las guías del eje siguen", {
  for (e in list(attr(graficar_dumbbell(.ft_contraste(2), estilo = "resumen"), "pulso_espec"), attr(graficar_panorama(.ft_panorama()), "pulso_espec"))) {
    geo <- .lam_rr_geo(e, 0.5, 1.5, 6, 5)
    expect_true(geo$cabe)
    lz <- .lam_lienzo(); .lam_rr_dibujar(lz, e, geo)
    doc <- .lam_agrupar(officer::add_slide(.ft_doc(), layout = "Graficos2", master = "Office Theme"), lz, nombre = "prueba")
    xml <- .ft_xml(doc)
    expect_identical(.ft_fondos(xml), list(blancas = 0L, panel_banda = 0L), label = e$tipo)
    expect_gt(length(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='puntos:guia']]")), 2L)
  }
})

test_that("la imagen de respaldo del contraste y del panorama no lleva bandas (ni rectángulos detrás de las filas)", {
  sin_rect <- function(p) !any(vapply(p$layers, function(l) inherits(l$geom, "GeomRect"), TRUE))
  expect_true(sin_rect(.graficar_contraste_gg(attr(graficar_dumbbell(.ft_contraste(2), estilo = "resumen"), "pulso_espec"))))
  expect_true(sin_rect(graficar_panorama(.ft_panorama())))
  expect_true(is.na(graficar_panorama(.ft_panorama())$theme$plot.background$fill))
})
