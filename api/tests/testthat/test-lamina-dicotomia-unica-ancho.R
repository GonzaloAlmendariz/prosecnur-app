source("setup-load-all.R")

# La lámina de UNA sola pregunta Sí/No (barra estándar) se dibuja como una fila de escala (Gonzalo, 2026-10-29: «Sí, como
# C»): la pregunta en su columna, el público de rótulo y la barra en la columna y al largo de la escala, como Contabilidad
# y la lámina 47 de Arte. Antes iba centrada al 85 % del ancho. Las demás formas de la dicotomía no cambian.

.du_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.du_formas <- function(doc, nombre) {
  x <- doc$slide$get_slide(length(doc))$get()
  sp <- xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  off <- xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:off"); ext <- xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:ext")
  data.frame(x = as.numeric(xml2::xml_attr(off, "x")) / 914400, w = as.numeric(xml2::xml_attr(ext, "cx")) / 914400,
             texto = xml2::xml_text(sp))
}
.du_espec <- function(estilo = "barra_estandar") {
  e <- preparar_categorica(c("Sí", "No"), c(.63, .37), c("63%", "37%"))
  e$colores <- c(`Sí` = "#081F5C", No = "#9DC3E6"); e$estilo_dicotomia <- estilo; e
}
.du_lamina <- function(..., publico = NULL) .lam_laminas_dicotomia(.du_doc(), ..., titulo = "Organización",
  pregunta = "¿Se actualiza el currículo?", publico = publico, actor = "Docentes", base = "Base: 115 docentes", folio = 1)
.du_textos <- function(doc) paste(xml2::xml_text(xml2::xml_find_all(doc$slide$get_slide(length(doc))$get(), "//a:t")), collapse = "|")

test_that("una sola pregunta Sí/No sale como fila de escala: columna y largo de la escala, pregunta y público", {
  o <- .du_lamina(espec = .du_espec())
  expect_identical(o$partes, 1L)
  expect_identical(length(o$doc), 1L)                          # una sola lámina, sin una vacía delante
  L <- .std_geom("likert")
  seg <- .du_formas(o$doc, "segmento")
  expect_equal(min(seg$x), L$x_barra, tolerance = 0.02)
  expect_equal(max(seg$x + seg$w) - min(seg$x), L$ancho_barra, tolerance = 0.02)   # el largo de todas las barras
  txt <- .du_textos(o$doc)
  expect_match(txt, "¿Se actualiza el currículo?", fixed = TRUE)
  expect_match(txt, "Docentes", fixed = TRUE)
  expect_match(txt, "63%", fixed = TRUE); expect_match(txt, "37%", fixed = TRUE)
  expect_equal(nrow(.du_formas(o$doc, "barra:segmento")), 0L)  # ya no el bloque centrado de la barra estándar
})

test_that("el resto de formas de la dicotomía no cambia", {
  p <- .du_formas(.du_lamina(espec = .du_espec("partida"))$doc, "segmento")
  expect_equal(nrow(p), 0L)   # la partida no sale como escala
  v <- suppressWarnings(.lam_laminas_dicotomia(.du_doc(), .du_espec("partida"), "T", pregunta = "¿P?", vertical = TRUE, folio = 1))
  expect_s3_class(v$doc, "rpptx")
})

test_that("el n del público («115 docentes») sólo sale con mostrar_respuestas encendido", {
  expect_null(.lam_dicotomia_publico(115, "docentes", "docentes$p1", list(), .du_espec()))
  expect_null(.lam_dicotomia_publico(115, "docentes", "docentes$p1", list(mostrar_respuestas = FALSE), .du_espec()))
  expect_identical(.lam_dicotomia_publico(115, "docentes", "docentes$p1", list(mostrar_respuestas = TRUE), .du_espec()), "115 docentes")
  e <- .du_espec(); e$mostrar_respuestas <- TRUE
  expect_identical(.lam_dicotomia_publico(115, "docentes", "docentes$p1", NULL, e), "115 docentes")
})
