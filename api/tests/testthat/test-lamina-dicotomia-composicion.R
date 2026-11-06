source("setup-load-all.R")

# Defecto 3 de la v3 (Renzo, informe Arte): una lámina con UNA sola pregunta Sí/No en barra estándar dibujaba la barra de borde
# a borde y pegada arriba. Composición: la barra no es más ancha que la de una lámina de 4 preguntas Sí/No, el bloque
# (enunciado + barra + leyenda) se centra en el área de datos y la leyenda va centrada a toda la lámina.

.dc_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.dc_formas <- function(doc, nombre, k = length(doc)) {
  x <- doc$slide$get_slide(k)$get()
  sp <- xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  off <- xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:off"); ext <- xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:ext")
  data.frame(x = as.numeric(xml2::xml_attr(off, "x")) / 914400, y = as.numeric(xml2::xml_attr(off, "y")) / 914400,
             w = as.numeric(xml2::xml_attr(ext, "cx")) / 914400, h = as.numeric(xml2::xml_attr(ext, "cy")) / 914400)
}
.dc_espec <- function() {
  e <- preparar_categorica(c("Sí", "No"), c(.63, .37), c("63%", "37%"))
  e$colores <- c(`Sí` = "#081F5C", No = "#CA5651"); e$estilo_dicotomia <- "barra_estandar"; e
}
.dc_cuatro <- function() {
  d <- data.frame(item = sprintf("p%d", 1:4), rotulo = sprintf("¿Conoce el mecanismo número %d?", 1:4), N = 115,
                  t1 = c(.21, .79, .54, .54), t2 = c(.79, .21, .46, .46))
  niv <- c(t1 = "Sí", t2 = "No")
  preparar_escala(d, "item", "N", c("t1", "t2"), niv, var_etiqueta_categoria = "rotulo", colores_grupos = as.list(setNames(.std_paleta("dicotomica"), niv)))
}

test_that("una pregunta Sí/No en barra estándar: la barra de la escala de 4 preguntas, en su columna, con la leyenda a la lámina", {
  o4 <- suppressMessages(.lam_laminas_escala(.dc_doc(), .dc_cuatro(), "Mecanismos", base = "Base: 115 docentes", folio = 1))
  seg4 <- .dc_formas(o4$doc, "segmento"); ancho4 <- max(seg4$x + seg4$w) - min(seg4$x)

  o1 <- .lam_laminas_dicotomia(.dc_doc(), .dc_espec(), "Perfil de egreso", pregunta = "¿Conoce los objetivos formativos de Formación General?",
                               publico = "279 estudiantes", base = "Base: 279 estudiantes", folio = 1)
  seg1 <- .dc_formas(o1$doc, "segmento")
  ancho1 <- max(seg1$x + seg1$w) - min(seg1$x)
  # Gonzalo (2026-10-29, «Sí, como C»): la Sí/No sola es una fila de escala, del mismo largo y en la misma columna que
  # las barras de la escala (G17: todas las barras miden lo mismo), como Contabilidad y la lámina 47 de Arte.
  expect_equal(ancho1, ancho4, tolerance = 0.02)
  expect_equal(min(seg1$x), min(seg4$x), tolerance = 0.02)
  # leyenda centrada a toda la lámina
  cua <- .dc_formas(o1$doc, "leyenda:cuadro"); expect_equal(nrow(cua), 2L)
  plan <- .lam_leyenda_plan(c("Sí", "No"), 12)
  expect_lt(abs(min(cua$x) + plan$totales[1] / 2 - .std_geom("ancho") / 2), 0.03)
})
