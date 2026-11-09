source("setup-load-all.R")

# P13 (Gonzalo, 2026-11-09, sobre «Escala de docentes sin regla»): «La leyenda debería estar centrada y no lo está,
# y aún no usa el alto disponible».

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

test_that("P13: la leyenda de la escala va centrada en la lámina y el bloque arranca bajo el título con el aire de la casa", {
  e <- .ea_espec()
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  xml <- .ea_xml(.lam_laminas_divergentes(doc, e, "Escala de docentes", folio = 1)$doc)
  cuadros <- .ea_cajas(xml, "leyenda:cuadro"); textos <- .ea_cajas(xml, "leyenda:texto")
  # La fila de la escala (sin la clave de «Sin información», que va sobre su columna): de su primer cuadro al final de
  # la tinta de su último rótulo.
  fila <- order(cuadros$x)[seq_len(4)]
  izq <- min(cuadros$x[fila]); t4 <- textos[order(textos$x)[4], ]
  der <- t4$x + 0.1 + .lam_ancho_tinta("Totalmente de acuerdo", 11, FALSE)
  expect_equal((izq + der) / 2, .std_geom("ancho") / 2, tolerance = 0.05)
  # El aire entre el fondo del título y la leyenda no pasa del aire de la casa.
  aire <- min(textos$y) - .lam_titulo_fin("Escala de docentes")
  expect_lte(aire, .LAM_AIRE_BAJO_TITULO_IN + 0.12 + 1e-6)   # la clave de dos líneas de «Sin información» sube 0.1 in
  expect_gte(aire, 0)
})
