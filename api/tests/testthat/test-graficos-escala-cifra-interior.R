source("setup-load-all.R")

# P16 (resumen de Arte, lámina 5, «El estatuto PUCP…»): la cifra de «En desacuerdo» (1%) se montaba con el 2% de fuera
# y con el eje. H3 (láminas 4 y 5, 2026-11-09): omitirla dejaba sin cifra segmentos de 10 %, 9 %, 6 % y 4 %. S3: como
# en el resumen original, la cifra interior que no cabe con su letra va dentro con letra chica; sólo si ni así cabe va
# fuera, a continuación de la del extremo, sin pisarla; se omite sólo si no queda sitio (lamina_divergentes_cifras.R).

.ci_niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo", t5 = "Sin información")
.ci_xml <- function(doc) { out <- tempfile(fileext = ".pptx"); print(doc, target = out); xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc)))) }
.ci_cajas <- function(xml, nombre) {
  sps <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  num <- function(sp, a) as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, sprintf(".//a:%s", if (a %in% c("x", "y")) "off" else "ext")), a)) / 914400
  data.frame(txt = xml2::xml_text(sps), x = vapply(sps, num, 0, "x"), y = vapply(sps, num, 0, "y"), w = vapply(sps, num, 0, "cx"),
             stringsAsFactors = FALSE)
}
.ci_render <- function(d) {
  e <- attr(graficar_barras_divergentes(d, "it", names(.ci_niv), .ci_niv, n_negativas = 2, incluir_neutro = FALSE, estilo = "resumen",
                                        orden = "declarado"), "pulso_espec")
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  .ci_xml(.lam_laminas_divergentes(doc, e, "Escala", folio = 1)$doc)
}
# Tinta de una cifra de fuera alineada a la derecha (caja con 0.1 in de margen): [der - tinta, der].
.ci_tinta_izq <- function(fila) { der <- fila$x + fila$w - 0.1; c(der - .lam_ancho_tinta(fila$txt, 11, TRUE), der) }

test_that("S3: el 10% interior va dentro de su segmento con letra chica y el 3% del extremo, fuera y pegado a la barra", {
  # Como en el resumen original de Arte (láminas 4 y 5): «En desacuerdo» se escribe dentro, más chico, y sólo el extremo
  # sale de la barra. Sacar las dos dejaba «10% 3%», que se leía como si el extremo fuera la cifra mayor.
  d <- data.frame(it = c("Los reglamentos de la Unidad se aplican correctamente en todas sus instancias (Doc.)",
                         "El estatuto PUCP y las normas internas de la Facultad se cumplen siempre (Doc.)",
                         "La dotación de recursos para la docencia es suficiente para todas las clases (Doc.)",
                         "Los administrativos participan de actividades de responsabilidad social (Adm.)"),
                  t1 = c(3, 3, 5, 2), t2 = c(10, 4, 43, 10), t3 = c(34, 55, 37, 50), t4 = c(15, 13, 7, 35), t5 = c(38, 25, 8, 3))
  xml <- .ci_render(d)
  fuera <- .ci_cajas(xml, "divergentes:cifra_fuera")
  dentro <- .ci_cajas(xml, "divergentes:cifra")
  segs <- .ci_cajas(xml, "divergentes:segmento")
  expect_true("10%" %in% dentro$txt)
  expect_false("10%" %in% fuera$txt)
  sz <- function(txt) {
    sp <- xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='divergentes:cifra']]")
    as.numeric(xml2::xml_attr(xml2::xml_find_first(sp[xml2::xml_text(sp) == txt][1], ".//a:rPr"), "sz")) / 100
  }
  expect_lt(sz("10%"), sz("43%"))                              # la chica, más chica que la de la escala
  tres <- fuera[fuera$txt == "3%", ]
  expect_gte(nrow(tres), 1L)
  # El 3% queda junto a su barra: entre el fin de su tinta y el inicio del segmento del extremo no cabe otra cifra.
  for (r in seq_len(nrow(tres))) {
    der <- .ci_tinta_izq(tres[r, ])[2]
    x_seg <- min(segs$x[abs(segs$y - tres$y[r]) < 0.2])
    expect_lt(x_seg - der, 0.15)
  }
  # El 4% interior: dentro con letra chica si cabe; si no, fuera a la izquierda del 3%, sin pisarlo.
  if ("4%" %in% fuera$txt) {
    f <- fuera[fuera$txt == "4%", ][1, ]; t3 <- fuera[fuera$txt == "3%" & abs(fuera$y - f$y) < 1e-6, ][1, ]
    expect_lt(.ci_tinta_izq(f)[2], .ci_tinta_izq(t3)[1])
  } else expect_true("4%" %in% dentro$txt)
})

test_that("S3: una cifra interior que no cabe con su letra va dentro con la chica; el extremo nunca", {
  segs <- list(list(k = 2L, x = 3.0, w = 0.3, lado = "neg"), list(k = 1L, x = 2.95, w = 0.05, lado = "neg"))
  p <- .lam_div_cifras_fila(segs, c(1, 1), c("3%", "10%"), 11, lim_izq = 1)
  expect_identical(p$modo[p$k == 2L], "dentro_chica")
  expect_identical(p$modo[p$k == 1L], "fuera_izq")
  expect_true(p$extremo[p$k == 1L])
})

test_that("con 1% junto a un 2% de fuera, el 1% va fuera a la izquierda del 2% y nada se monta", {
  d <- data.frame(it = c("El estatuto PUCP y las normas internas se cumplen", "La biblioteca atiende"),
                  t1 = c(2, 5), t2 = c(1, 20), t3 = c(55, 40), t4 = c(16, 20), t5 = c(26, 15))
  fuera <- .ci_cajas(.ci_render(d), "divergentes:cifra_fuera")
  uno <- fuera[fuera$txt == "1%", ]; dos <- fuera[fuera$txt == "2%", ]
  expect_equal(nrow(uno), 1L); expect_equal(nrow(dos), 1L)
  expect_lt(.ci_tinta_izq(uno)[2], .ci_tinta_izq(dos)[1])
})

test_that("una cifra interior se omite sólo si no queda sitio antes del límite", {
  segs <- list(list(k = 2L, x = 3.0, w = 0.05, lado = "neg"), list(k = 1L, x = 2.95, w = 0.05, lado = "neg"))
  u <- c(1, 1); x <- c("3%", "10%")
  con_sitio <- .lam_div_cifras_fila(segs, u, x, 11, lim_izq = 1)
  expect_identical(con_sitio$modo[con_sitio$k == 1L], "fuera_izq")
  expect_identical(con_sitio$modo[con_sitio$k == 2L], "fuera_izq")
  expect_true(con_sitio$extremo[con_sitio$k == 1L])
  sin_sitio <- .lam_div_cifras_fila(segs, u, x, 11, lim_izq = 2.7)
  expect_identical(sin_sitio$modo[sin_sitio$k == 2L], "omitida")   # la interior no cabe tras el extremo
  expect_identical(sin_sitio$modo[sin_sitio$k == 1L], "fuera_izq")  # el extremo sale siempre, como antes
})
