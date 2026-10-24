# U5 (mazo CCSS Perfil 2026, lámina 8, dona nativa de lámina completa):
#  - «Prefiero no responder» con 1 caso de 397 decía «0%»: una cifra que redondea a cero con casos detrás se escribe «<1%»
#    (o «<0.1%» con un decimal) en toda cifra nativa; sin casos sigue en «0%». El número de la espec no cambia.
#  - En la leyenda, «209 de 397 respuestas» quedaba más cerca de la categoría siguiente que de la suya: va pegado a su rótulo.

.u5_espec <- function(rot, v) {
  attr(suppressWarnings(graficar_pie(data.frame(c = rot, p = v / sum(v), n = v), "c", "p", var_n = "n", tipo_pie = "donut")), "pulso_espec")
}
.u5_genero <- function() .u5_espec(c("Femenino", "Masculino", "Persona de género no binario", "Prefiero no responder"), c(209, 181, 6, 1))
.u5_xml <- function(o) { out <- tempfile(fileext = ".pptx"); print(o$doc, target = out); xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(o$doc)))) }
.u5_sp <- function(x, n) xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n))
.u5_y <- function(sp) as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:off"), "y")) / 914400
.u5_h <- function(sp) as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:ext"), "cy")) / 914400
.u5_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))

test_that("U5: una cifra que redondea a 0 con casos se escribe «<1%»; sin casos, «0%»", {
  expect_identical(.lam_cifras_menor_uno(c("53%", "0%", "0%", "2%"), c(209, 1, 0, 6)), c("53%", "<1%", "0%", "2%"))
  expect_identical(.lam_cifras_menor_uno(c("0.0%", "0,0%", "0.4%"), c(1, 1, 2)), c("<0.1%", "<0,1%", "0.4%"))
  expect_identical(.lam_cifras_menor_uno(c("0% A", "10%"), c(1, 5)), c("<1% A", "10%"))
  expect_identical(.lam_cifras_menor_uno(c("0%", "5%"), NULL), c("0%", "5%"))   # sin casos no se afirma nada
  e <- .u5_genero()
  e2 <- .lam_espec_menor_uno(e)
  expect_identical(e2$cifras[4], "<1%")
  expect_identical(e2$valores, e$valores)                                       # el número no cambia
})

test_that("U5: la dona de lámina completa escribe «<1%» en la leyenda y en la guía", {
  x <- .u5_xml(.lam_laminas_dona(.u5_doc(), .lam_espec_menor_uno(.u5_genero()), "Género", base = "Base: 397", folio = 8))
  ley <- xml2::xml_text(.u5_sp(x, "dona:cifra_leyenda"))
  expect_identical(ley[4], "<1%")
  expect_false("0%" %in% ley)
})

test_that("U5: «n de N» va pegado a su rótulo, no a medio camino de la categoría siguiente", {
  x <- .u5_xml(.lam_laminas_dona(.u5_doc(), .u5_genero(), "Género", base = "Base: 397", folio = 8))
  rot <- .u5_sp(x, "dona:rotulo_leyenda"); cas <- .u5_sp(x, "dona:casos")
  expect_length(cas, 4L)
  y_rot <- .u5_y(rot); y_cas <- .u5_y(cas)
  # La distancia del «n de N» a su rótulo es menor que la que lo separa del rótulo siguiente.
  hueco_propio <- y_cas[1:3] - y_rot[1:3]
  hueco_siguiente <- y_rot[2:4] - y_cas[1:3]
  expect_true(all(hueco_propio < hueco_siguiente))
  # Y empieza a lo más 0.36 in bajo el borde superior de su rótulo de una línea (14 pt).
  expect_true(all(hueco_propio <= 0.36))
})
