source("setup-load-all.R")

# P12 (Gonzalo, 2026-11-09, sobre el «3%» a la izquierda de «Totalmente en desacuerdo»: «además está demasiado alejado de
# la barra»). La cifra que sale de su segmento va pegada al extremo, con la calle de la casa, a página entera y en una
# ranura. El cuadro de texto lleva 0.1 in de margen interior: la tinta empieza (o termina) 0.1 in dentro del cuadro.

.cf_niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo", t5 = "Sin información")
.cf_espec <- function() attr(graficar_barras_divergentes(
  data.frame(it = c("Reglamentos (Doc.)", "Investigación (Doc.)", "Estatuto (Doc.)"), t1 = c(3, 3, 2), t2 = c(10, 38, 4),
             t3 = c(34, 23, 55), t4 = c(15, 1, 13), t5 = c(38, 30, 26)),
  "it", names(.cf_niv), .cf_niv, n_negativas = 2, incluir_neutro = FALSE, estilo = "resumen"), "pulso_espec")
.cf_xml <- function(doc) { out <- tempfile(fileext = ".pptx"); print(doc, target = out); xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc)))) }
.cf_cajas <- function(xml, nombre) {
  sp <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  num <- function(p, a) as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, p), a)) / 914400
  data.frame(x = num(".//a:xfrm/a:off", "x"), y = num(".//a:xfrm/a:off", "y"), w = num(".//a:xfrm/a:ext", "cx"), h = num(".//a:xfrm/a:ext", "cy"),
             algn = vapply(sp, function(s) xml2::xml_attr(xml2::xml_find_first(s, ".//a:pPr"), "algn") %||% "l", ""), stringsAsFactors = FALSE)
}
# Distancia entre la tinta de cada cifra de fuera y el extremo del segmento de su fila.
.cf_calles <- function(xml) {
  cf <- .cf_cajas(xml, "divergentes:cifra_fuera"); sg <- .cf_cajas(xml, "divergentes:segmento")
  vapply(seq_len(nrow(cf)), function(i) {
    fila <- sg[abs((sg$y + sg$h / 2) - (cf$y[i] + cf$h[i] / 2)) < 0.12, ]
    if (identical(cf$algn[i], "r")) min(fila$x) - (cf$x[i] + cf$w[i] - 0.1) else (cf$x[i] + 0.1) - max(fila$x + fila$w)
  }, 0)
}

test_that("a página entera la cifra de fuera queda a la calle de la casa del extremo de su segmento", {
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  xml <- .cf_xml(.lam_laminas_divergentes(doc, .cf_espec(), "Escala", folio = 1)$doc)
  d <- .cf_calles(xml)
  expect_gte(length(d), 2L)          # el 3 % de la izquierda y el 1 % de la derecha
  expect_true(all(d > 0 & d <= 0.08), info = paste(round(d, 3), collapse = ", "))
})

test_that("en una ranura también", {
  e <- .cf_espec()
  geo <- .lam_rr_geo(e, 0.5, 1.5, 6, 4.5)
  expect_true(geo$cabe)
  lz <- .lam_lienzo(); .lam_rr_dibujar(lz, e, geo)
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  xml <- .cf_xml(.lam_agrupar(officer::add_slide(doc, layout = "Graficos2", master = "Office Theme"), lz, nombre = "prueba"))
  # S3: la cifra de un segmento interior que ni con letra chica cabe va fuera, a continuación de la del extremo; la que
  # queda junto a la barra en cada lado de cada fila es la del extremo, a la calle de la casa.
  cf <- .cf_cajas(xml, "divergentes:cifra_fuera"); d <- .cf_calles(xml)
  junto <- tapply(d, paste(round(cf$y, 2), cf$algn), min)
  expect_gte(length(junto), 1L)
  expect_true(all(junto > 0 & junto <= 0.08), info = paste(round(d, 3), collapse = ", "))
})
