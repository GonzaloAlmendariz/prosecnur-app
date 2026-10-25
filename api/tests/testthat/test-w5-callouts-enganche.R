# CCSS-14 y CCSS-22, enganche en las láminas nativas (lamina_escala.R, lamina_divergentes.R) y U5 en la leyenda no
# compacta del panel circular (lamina_panel_circular.R). Reproduce la fila «WhatsApp» del mazo CCSS (lámina 40 de la
# copia, 39 del vigente): «1% 1%» de dos segmentos vecinos, la primera clavada y la segunda corrida 0.46 in a la
# derecha con codos encimados. Datos sintéticos con los mismos porcentajes; nunca datos del cliente.

.ce_formas <- function(doc) {
  x <- doc$slide$get_slide(doc$cursor)$get()
  sp <- xml2::xml_find_all(x, "//p:sp")
  nm <- xml2::xml_attr(xml2::xml_find_first(sp, "p:nvSpPr/p:cNvPr"), "name")
  g <- function(a) as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, paste0("p:spPr/a:xfrm/", if (a %in% c("x", "y")) "a:off" else "a:ext")),
                                             switch(a, x = "x", y = "y", w = "cx", h = "cy"))) / 914400
  data.frame(nombre = nm, x = g("x"), y = g("y"), w = g("w"), h = g("h"), texto = xml2::xml_text(sp), stringsAsFactors = FALSE)
}
.ce_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.ce_sin_cruce <- function(a0, a1) { o <- order(a0); all(a0[o][-1] >= a1[o][-length(o)] - 1e-6) }

# Acotado (Arte idéntico): un par sin codos cruzados («1% ⌐1%», el «2% ⌐6%» aprobado en Arte) conserva la colocación de
# siempre; el reparto nuevo entra sólo cuando la anterior cruza codos (cadenas como «5% 3% 5%», fila Instagram).

test_that("CCSS-14 escala: una cadena de tres cifras chicas («2% 1% 2%») ya no cruza codos y sus tintas no se tocan", {
  niv <- c(t1 = "No la uso", t2 = "Algunas veces", t3 = "Uno o dos días", t4 = "Tres o más", t5 = "Puntuales", t6 = "Todo el día")
  d <- data.frame(item = "ig", N = 397, t1 = .02, t2 = .01, t3 = .02, t4 = .15, t5 = .40, t6 = .40, rotulo = "Instagram")
  e <- preparar_escala(d, "item", "N", paste0("t", 1:6), niv, var_etiqueta_categoria = "rotulo")
  f <- .ce_formas(suppressMessages(.lam_laminas_escala(.ce_doc(), e, "Uso de redes", folio = 1))$doc)
  seg <- f[f$nombre == "segmento", ]; seg <- seg[order(seg$x), ]
  cf <- f[f$nombre == "cifra_fuera", ]; cf <- cf[order(cf$x), ]
  m <- nrow(cf); expect_gte(m, 3L)                                  # ninguna cifra se omite
  cs <- seg$x[seq_len(m)] + seg$w[seq_len(m)] / 2; centros <- cf$x + cf$w / 2
  tinta <- .lam_ancho_tinta(cf$texto, .std_pt("cifra_fuera"), TRUE)
  # La colocación de siempre (paso fijo de 0.46 in a la derecha) sí cruzaba codos en esta fila: el rojo del defecto.
  viejo <- cs; for (k in seq_along(viejo)[-1]) viejo[k] <- max(viejo[k], viejo[k - 1] + 0.46)
  expect_true(.lam_callouts_chocan(cs, viejo, tinta))
  # Reparto nuevo: tintas a 0.12 in o más y guías rectas (segmentos y cifras en el mismo orden: no se cruzan); ningún
  # codo horizontal, que en una cadena corrida a un lado se montaban en la misma altura.
  expect_true(all(diff(centros) - (tinta[-1] + tinta[-m]) / 2 >= 0.12 - 1e-6))
  expect_true(all(order(centros) == order(cs)))
  g <- f[f$nombre == "guia", ]
  expect_equal(sum(g$h < 0.02 & g$w > 0.05), 0L)
  expect_equal(nrow(g), m)
})

test_that("CCSS-14 escala: un par sin cruce («1% ⌐1%») conserva la colocación aprobada", {
  niv <- c(t1 = "No la uso", t2 = "Algunas veces al mes", t3 = "Puntuales", t4 = "Todo el día")
  d <- data.frame(item = "wa", N = 397, t1 = 0.01, t2 = 0.01, t3 = 0.19, t4 = 0.79, rotulo = "WhatsApp")
  e <- preparar_escala(d, "item", "N", paste0("t", 1:4), niv, var_etiqueta_categoria = "rotulo")
  f <- .ce_formas(suppressMessages(.lam_laminas_escala(.ce_doc(), e, "Uso de redes", folio = 1))$doc)
  seg <- f[f$nombre == "segmento", ]; seg <- seg[order(seg$x), ]
  cf <- f[f$nombre == "cifra_fuera", ]; cf <- cf[order(cf$x), ]
  cs <- seg$x[1:2] + seg$w[1:2] / 2
  expect_equal(cf$x + cf$w / 2, c(cs[1], cs[1] + 0.46), tolerance = 0.01)
})

test_that("CCSS-14 divergentes: tres cifras chicas del lado del acuerdo sin cruzar codos ni la línea del centro", {
  niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Muy de acuerdo", t5 = "Totalmente de acuerdo")
  d <- data.frame(it = "Uno", t1 = .47, t2 = .47, t3 = .02, t4 = .02, t5 = .02)
  e <- attr(graficar_barras_divergentes(d, "it", names(niv), niv, escala_valor = "proporcion_1", n_negativas = 2, incluir_neutro = FALSE), "pulso_espec")
  f <- .ce_formas(.lam_laminas_divergentes(.ce_doc(), e, "Divergentes", folio = 1)$doc)
  cen <- f[f$nombre == "divergentes:centro", ]; xc <- cen$x + cen$w / 2
  segs <- f[f$nombre == "divergentes:segmento", ]; segs <- segs[order(segs$x), ]
  cf <- f[f$nombre == "divergentes:cifra" & f$y < min(segs$y), ]; cf <- cf[order(cf$x), ]
  expect_equal(nrow(cf), 3L)
  centros <- cf$x + cf$w / 2; tinta <- .lam_ancho_tinta(cf$texto, 10.5, TRUE)
  cs <- segs$x[3:5] + segs$w[3:5] / 2
  # La colocación secuencial de siempre (lamina_divergentes.R antes de CCSS-14) cruzaba los codos en esta fila.
  viejo <- numeric(3); fin <- -Inf
  for (i in 1:3) { cl <- max(cs[i], fin + 0.06 + tinta[i] / 2); if (abs(cl - xc) < tinta[i] / 2 + 0.05) cl <- xc + 0.05 + tinta[i] / 2
                   viejo[i] <- cl; fin <- cl + tinta[i] / 2 }
  expect_true(.lam_callouts_chocan(cs, viejo, tinta))
  expect_true(all(diff(centros) - (tinta[-1] + tinta[-3]) / 2 >= 0.12 - 1e-6))
  expect_true(all(order(centros) == order(cs)))
  g <- f[f$nombre == "divergentes:guia", ]
  expect_equal(sum(g$h < 0.02 & g$w > 0.05), 0L)
  expect_true(all(centros - tinta / 2 >= xc + 0.05 - 1e-6))       # del lado del acuerdo, sin tocar la línea del centro
})

test_that("U5 panel circular: la leyenda no compacta escribe «<1%» con casos", {
  e <- attr(suppressWarnings(graficar_pie(data.frame(c = c("Femenino", "Masculino", "No binario", "Prefiero no responder"),
                                                     p = c(209, 181, 6, 1) / 397, n = c(209, 181, 6, 1)), "c", "p", var_n = "n",
                                          tipo_pie = "donut")), "pulso_espec")
  geo <- .lam_panel_circular_geo(e, 0.5, 1.65, 6.01, 2.4, 0)
  expect_false(isTRUE(geo$compacto))
  lz <- .lam_lienzo(); .lam_panel_circular(lz, e, geo)
  doc <- .lam_agrupar(officer::add_slide(.ce_doc(), layout = "Graficos2", master = "Office Theme"), lz, nombre = "t")
  f <- .ce_formas(doc)
  cif <- f$texto[f$nombre == "circular:cifra"]
  expect_true("<1%" %in% cif); expect_false("0%" %in% cif)
})
