source("setup-load-all.R")

# P16 (resumen de Arte, lámina 5, «El estatuto PUCP…»): la cifra de «En desacuerdo» (1%) se montaba con el 2% de fuera
# y con el eje. Un segmento interior que no deja caber su cifra no la escribe (regla de la casa, `.lam_tiene_peq`).

.ci_niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo", t5 = "Sin información")
.ci_xml <- function(doc) { out <- tempfile(fileext = ".pptx"); print(doc, target = out); xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc)))) }

test_that("con 1% junto a un 2% de fuera, el 1% interior no se escribe y nada se monta", {
  d <- data.frame(it = c("El estatuto PUCP y las normas internas se cumplen", "La biblioteca atiende"),
                  t1 = c(2, 5), t2 = c(1, 20), t3 = c(55, 40), t4 = c(16, 20), t5 = c(26, 15))
  e <- attr(graficar_barras_divergentes(d, "it", names(.ci_niv), .ci_niv, n_negativas = 2, incluir_neutro = FALSE, estilo = "resumen",
                                        orden = "declarado"), "pulso_espec")
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  xml <- .ci_xml(.lam_laminas_divergentes(doc, e, "Escala", folio = 1)$doc)
  textos <- function(n) xml2::xml_text(xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
  expect_true("2%" %in% textos("divergentes:cifra_fuera"))       # el extremo sale fuera
  expect_false("1%" %in% c(textos("divergentes:cifra"), textos("divergentes:cifra_chica"), textos("divergentes:cifra_fuera")))
  expect_length(textos("divergentes:cifra_chica"), 0L)
  expect_true("20%" %in% textos("divergentes:cifra"))            # lo que cabe, dentro
})
