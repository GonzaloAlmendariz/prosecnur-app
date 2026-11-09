source("setup-load-all.R")

# P2 (2026-11-09): el dumbbell clásico (recetario) aceptaba `separar_tras` y no lo dibujaba. Ahora lleva la misma línea
# punteada tenue del contraste nativo (lamina_contraste.R), en la imagen ggplot y en la lámina nativa de pesas.

.dsep_datos <- function() {
  temas <- c("Uno", "Dos", "Tres", "Cuatro")
  data.frame(eje = rep(temas, 2), grupo = factor(rep(c("Docentes", "Estudiantes"), each = 4), levels = c("Docentes", "Estudiantes")),
             valor = c(80, 50, 70, 40, 60, 55, 30, 45), stringsAsFactors = FALSE)
}
.dsep_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.dsep_xml <- function(doc) { out <- tempfile(fileext = ".pptx"); print(doc, target = out); xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc)))) }

test_that("el clásico dibuja el separador: línea punteada tenue y orden declarado", {
  p <- graficar_dumbbell(.dsep_datos(), separar_tras = 2)
  e <- attr(p, "pulso_espec")
  expect_identical(e$separadores, 2L)
  expect_identical(e$rotulos, c("Uno", "Dos", "Tres", "Cuatro"))   # el separador fija el orden declarado
  capa <- Filter(function(l) inherits(l$geom, "GeomSegment") && identical(l$aes_params$linetype, "dashed"), p$layers)
  expect_length(capa, 1L)
  expect_identical(capa[[1]]$aes_params$colour, .std_color("texto_tenue"))
  expect_equal(capa[[1]]$data$y, 4 - 2 + 0.5)   # entre la fila 2 y la 3 contando desde arriba
  # Sin separador, ni línea ni orden forzado; uno fuera de rango (tras la última fila) se ignora.
  for (sep in list(NULL, 0, 4)) {
    q <- graficar_dumbbell(.dsep_datos(), separar_tras = sep)
    expect_length(attr(q, "pulso_espec")$separadores, 0L)
    expect_false(any(vapply(q$layers, function(l) identical(l$aes_params$linetype, "dashed"), TRUE)))
  }
  expect_no_error(ggplot2::ggplot_build(p))
})

test_that("la lámina nativa de pesas dibuja el separador punteado entre las filas declaradas", {
  e <- attr(graficar_dumbbell(.dsep_datos(), separar_tras = 2), "pulso_espec")
  xml <- .dsep_xml(.lam_laminas_pesas(.dsep_doc(), e, "Brecha", folio = 1)$doc)
  sep <- xml2::xml_find_all(xml, "//p:cxnSp[p:nvCxnSpPr/p:cNvPr[@name='pesas:separador']] | //p:sp[p:nvSpPr/p:cNvPr[@name='pesas:separador']]")
  expect_length(sep, 1L)
  expect_true(grepl('prstDash val="dash"', as.character(sep[[1]]), fixed = TRUE))
  # Las filas 2 y 3: el separador cae entre sus rótulos.
  y_de <- function(nm) {
    n <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]/p:spPr/a:xfrm/a:off", nm))
    as.numeric(xml2::xml_attr(n, "y"))
  }
  ys <- as.numeric(xml2::xml_attr(xml2::xml_find_first(sep[[1]], ".//a:xfrm/a:off"), "y"))
  rot <- y_de("pesas:rotulo")
  expect_gt(ys, rot[2]); expect_lt(ys, rot[3])
  e0 <- attr(graficar_dumbbell(.dsep_datos()), "pulso_espec")
  xml0 <- .dsep_xml(.lam_laminas_pesas(.dsep_doc(), e0, "Brecha", folio = 1)$doc)
  expect_length(xml2::xml_find_all(xml0, "//*[@name='pesas:separador']"), 0L)
})
