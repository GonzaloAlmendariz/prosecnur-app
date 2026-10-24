# L4 (CCSS Perfil 2026, lámina 8 «Las mujeres son el 53 %…»): la dona de lámina completa (`p_slide_1_grafico` con
# `p_donut`) de más de dos porciones salía como imagen ggplot: título rojo repetido bajo el de la lámina, paleta fuera de
# marca, leyenda chica y un hueco blanco junto a la porción de 0 %. Ahora se compone nativa, como la dona de los paneles en
# grande: azul de la marca, la cifra de la primera porción al centro, la leyenda con el % grande y la guía radial con arco
# en las porciones chicas. Cifras, orden de categorías y base no cambian.

.dl_espec <- function(rot, v) {
  attr(suppressWarnings(graficar_pie(data.frame(c = rot, p = v / sum(v), n = v), "c", "p", var_n = "n", tipo_pie = "donut")), "pulso_espec")
}
.dl_genero <- function() .dl_espec(c("Femenino", "Masculino", "Persona de género no binario", "Prefiero no responder"), c(212, 182, 9, 0))
.dl_carrera <- function() .dl_espec(c("Economía", "Relaciones Internacionales", "Ciencia Política y Gobierno", "Finanzas", "Antropología", "Sociología"),
                                    c(184, 92, 68, 44, 12, 8))
.dl_xml <- function(o) { out <- tempfile(fileext = ".pptx"); print(o$doc, target = out); xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(o$doc)))) }
.dl_txt <- function(x, n) xml2::xml_text(xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
.dl_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))

test_that("la dona de lámina completa de cuatro y de seis porciones cabe en nativo", {
  expect_true(.lam_circular_cabe(.dl_genero()))
  expect_true(.lam_circular_cabe(.dl_carrera()))
})

test_that("la dona grande: arcos de la marca, la cifra al centro, la leyenda entera en su orden y la guía en la porción chica", {
  e <- .dl_genero()
  x <- .dl_xml(.lam_laminas_dona(.dl_doc(), e, "Las mujeres son el 53 %", base = "Base: 403 respuestas", folio = 8))
  arc <- xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='dona:porcion']]")
  expect_length(arc, 3L)                                                   # la de 0 % no tiene arco
  fills <- toupper(xml2::xml_attr(xml2::xml_find_first(arc, "p:spPr/a:solidFill/a:srgbClr"), "val"))
  expect_identical(fills, toupper(sub("#", "", .lam_colores_pie(4L, e)[1:3])))
  expect_identical(.dl_txt(x, "dona:cifra"), e$cifras[1])
  expect_identical(.dl_txt(x, "dona:cifra_leyenda"), e$cifras)              # todas, también el 0 %, en el orden de la espec
  expect_identical(.dl_txt(x, "dona:rotulo_leyenda"), e$rotulos)
  expect_true(e$cifras[3] %in% .dl_txt(x, "dona:cifra_fuera"))              # el 2 % sale con su guía
  expect_gte(length(xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='dona:guia']]")), 1L)   # al menos el tramo radial
  expect_identical(.dl_txt(x, "dona:cifra_aro"), e$cifras[1:2])            # las grandes, en su aro
  expect_identical(paste(.dl_txt(x, "Base lamina"), collapse = ""), "Base: 403 respuestas")
})

test_that("con seis porciones la leyenda no se encima y no sale de la lámina", {
  x <- .dl_xml(.lam_laminas_dona(.dl_doc(), .dl_carrera(), "Carrera", folio = 1))
  sp <- xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='dona:rotulo_leyenda']]")
  off <- xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:off"); ext <- xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:ext")
  y <- as.numeric(xml2::xml_attr(off, "y")) / 914400; h <- as.numeric(xml2::xml_attr(ext, "cy")) / 914400
  xr <- (as.numeric(xml2::xml_attr(off, "x")) + as.numeric(xml2::xml_attr(ext, "cx"))) / 914400
  expect_length(sp, 6L)
  expect_true(all(y[-1] >= (y + h)[-6] - 1e-6))
  expect_true(all(xr <= .std_geom("ancho") - .std_geom("margen_der") + 1e-6))
  expect_true(all(y + h <= .std_geom("base_y") + 1e-6))
})
