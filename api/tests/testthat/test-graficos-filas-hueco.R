source("setup-load-all.R")

# P15 (resumen de Arte, 2026-11-09, láminas 4 y 6): las filas de dos o tres líneas abrían huecos mientras las de una quedaban apretadas.

.ea_niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo", t5 = "Sin información")
.ea_largos <- c("Los reglamentos y normas relacionados a la Unidad se encuentran difundidos entre los(as) docentes de la Facultad.",
                "Servicio de salud",
                "El Departamento promueve el desarrollo de actividades de investigación para los(as) docentes a través de espacios, bonificaciones, reconocimientos y descarga lectiva.",
                "La biblioteca atiende", "Los procesos de selección y contratación de los(as) docentes son justos y transparentes en todas sus etapas.",
                "La tutoría orienta")
.ea_espec <- function(filas = .ea_largos) {
  n <- length(filas)
  d <- data.frame(it = filas, t1 = 3, t2 = seq(10, 30, length.out = n), t3 = 40, t4 = 10, t5 = seq(37, 17, length.out = n))
  attr(graficar_barras_divergentes(d, "it", names(.ea_niv), .ea_niv, n_negativas = 2, incluir_neutro = FALSE, estilo = "resumen", orden = "declarado"),
       "pulso_espec")
}
.ea_xml <- function(doc) { out <- tempfile(fileext = ".pptx"); print(doc, target = out); xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc)))) }
.ea_cajas <- function(xml, nombre) {
  sp <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  num <- function(p, a) as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, p), a)) / 914400
  data.frame(x = num(".//a:xfrm/a:off", "x"), y = num(".//a:xfrm/a:off", "y"), w = num(".//a:xfrm/a:ext", "cx"), h = num(".//a:xfrm/a:ext", "cy"))
}

test_that("P15: filas de alto distinto quedan con el mismo hueco entre ellas, en la escala y en el contraste", {
  ge <- .lam_div_resumen_geom(.ea_espec(), titulo = "Escala")
  huecos <- .lam_filas_huecos(ge$alturas, ge$texto_h)
  expect_gt(length(unique(round(ge$texto_h, 3))), 1L)        # la premisa: hay rótulos de una y de varias líneas
  expect_lt(stats::var(huecos), 1e-10)
  d <- data.frame(eje = rep(.ea_largos, 2), grupo = factor(rep(c("A", "B"), each = 6), levels = c("A", "B")),
                  valor = c(60, 70, 50, 80, 65, 55, 40, 75, 52, 60, 70, 45))
  gc <- .lam_contraste_geom(attr(graficar_dumbbell(d, estilo = "resumen"), "pulso_espec"))
  expect_true(gc$cabe)
  expect_lt(stats::var(.lam_filas_huecos(gc$alturas, gc$contenido)), 1e-10)
})
