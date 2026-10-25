# L10-11 (mazo CCSS V2 aprobado, láminas 40, 45, 60 y 62): la divergente a lámina completa usaba sólo la mitad superior
# de la zona de datos (fila acotada en 0.74 in y bloque pegado arriba) y escribía las afirmaciones a 10.5 pt, que en
# pantalla se leen como 8. Ahora las filas crecen hasta un tope, el bloque se centra en el alto y las afirmaciones van a
# 11 pt o más cuando caben (la columna crece antes de achicar). Cifras, orden y base no cambian.

.dv_formas <- function(doc) {
  x <- doc$slide$get_slide(doc$cursor)$get()
  sp <- xml2::xml_find_all(x, "//p:sp")
  nm <- xml2::xml_attr(xml2::xml_find_first(sp, "p:nvSpPr/p:cNvPr"), "name")
  g <- function(a) as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, paste0("p:spPr/a:xfrm/", if (a %in% c("x", "y")) "a:off" else "a:ext")),
                                             switch(a, x = "x", y = "y", w = "cx", h = "cy"))) / 914400
  sz <- as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, ".//a:rPr"), "sz")) / 100
  data.frame(nombre = nm, x = g("x"), y = g("y"), w = g("w"), h = g("h"), sz = sz, stringsAsFactors = FALSE)
}
.dv_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.dv_espec <- function(n) {
  niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "Ni de acuerdo ni en desacuerdo", t4 = "De acuerdo", t5 = "Totalmente de acuerdo")
  af <- c("Los/as docentes usan ejemplos o referencias culturales que todos/as podemos entender",
          "Los/as docentes valoran por igual a todos las/los estudiantes",
          "Los/as docentes valoran de manera diferenciada a las/los estudiantes de acuerdo con su forma de hablar y escribir.",
          "Me siento cómodo/a haciendo preguntas durante la clase.", "Evito hacer preguntas por inseguridad frente a el/la docente.")[seq_len(n)]
  d <- data.frame(it = af, t1 = .02, t2 = .05, t3 = .25, t4 = .50, t5 = .18)
  attr(graficar_barras_divergentes(d, "it", names(niv), niv, escala_valor = "proporcion_1", n_negativas = 2, incluir_neutro = TRUE), "pulso_espec")
}

test_that("L10-11: con tres afirmaciones el bloque ocupa el alto de la zona de datos, no su mitad de arriba", {
  f <- .dv_formas(.lam_laminas_divergentes(.dv_doc(), .dv_espec(3), "Divergentes", folio = 1)$doc)
  seg <- f[f$nombre == "divergentes:segmento", ]
  ys <- sort(unique(round(seg$y, 3)))
  expect_length(ys, 3L)
  yt <- .std_geom("zona_datos_y0"); yf <- .std_geom("contenido_y1")
  ley <- f[f$nombre %in% c("leyenda:texto", "leyenda:cuadro"), ]
  # El bloque (de la primera barra al pie de la leyenda) cubre al menos el 70 % del alto y queda centrado.
  alto_bloque <- max(ley$y + ley$h) - min(ys)
  expect_gte(alto_bloque, 0.70 * (yf - yt))
  expect_gte(diff(ys)[1], 0.95)                                  # filas que crecen (antes 0.74 in)
})

test_that("L10-11: las afirmaciones van a 11 pt o más cuando caben; con ocho filas el tamaño de siempre no se rompe", {
  f <- .dv_formas(.lam_laminas_divergentes(.dv_doc(), .dv_espec(3), "Divergentes", folio = 1)$doc)
  af <- f[f$nombre == "divergentes:afirmacion", ]
  expect_true(all(af$sz >= 11))
  e5 <- .dv_espec(5)
  f5 <- .dv_formas(.lam_laminas_divergentes(.dv_doc(), e5, "Divergentes", folio = 1)$doc)
  af5 <- f5[f5$nombre == "divergentes:afirmacion", ]
  expect_true(all(af5$sz >= 10.5))
  # Las afirmaciones no se montan entre sí.
  o <- order(af5$y); expect_true(all(af5$y[o][-1] >= (af5$y + af5$h)[o][-nrow(af5)] - 0.02))
})
