source("setup-load-all.R")

# P16 (resumen de Arte, lámina 5, «El estatuto PUCP…»): la cifra de «En desacuerdo» (1%) se montaba con el 2% de fuera
# y con el eje. H3 (láminas 4 y 5, 2026-11-09): omitirla dejaba sin cifra segmentos de 10 %, 9 %, 6 % y 4 %. La regla
# es la del resumen original: la cifra interior que no cabe va fuera, a continuación de la del extremo, sin pisarla; se
# omite sólo si no queda sitio (lamina_divergentes_cifras.R).

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

test_that("10% y 4% interiores junto a un 3% de fuera: van fuera, a la izquierda del 3%, sin pisarlo ni pisar el eje", {
  # Como en Arte: un lado del desacuerdo largo (5 % y 43 %) y otro del acuerdo largo (85 %) achican la escala.
  # Rótulos largos, como los del resumen, dejan la escala angosta.
  d <- data.frame(it = c("Los reglamentos de la Unidad se aplican correctamente en todas sus instancias (Doc.)",
                         "El estatuto PUCP y las normas internas de la Facultad se cumplen siempre (Doc.)",
                         "La dotación de recursos para la docencia es suficiente para todas las clases (Doc.)",
                         "Los administrativos participan de actividades de responsabilidad social (Adm.)"),
                  t1 = c(3, 3, 5, 2), t2 = c(10, 4, 43, 10), t3 = c(34, 55, 37, 50), t4 = c(15, 13, 7, 35), t5 = c(38, 25, 8, 3))
  xml <- .ci_render(d)
  fuera <- .ci_cajas(xml, "divergentes:cifra_fuera")
  dentro <- .ci_cajas(xml, "divergentes:cifra")
  centro <- .ci_cajas(xml, "divergentes:centro")
  expect_true(all(c("10%", "4%") %in% fuera$txt))            # ya no se omiten
  expect_false(any(c("10%", "4%") %in% dentro$txt))
  expect_true("43%" %in% dentro$txt)                          # lo que cabe, dentro
  for (v in c("10%", "4%")) {
    f <- fuera[fuera$txt == v, ][1, ]
    tres <- fuera[fuera$txt == "3%" & abs(fuera$y - f$y) < 1e-6, ][1, ]
    expect_false(is.na(tres$x), info = v)
    ti <- .ci_tinta_izq(f); t3 <- .ci_tinta_izq(tres)
    expect_lt(ti[2], t3[1])                                   # a la izquierda del 3 %, sin pisarlo
    expect_lt(ti[2], centro$x[1])                             # lejos del eje
  }
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
