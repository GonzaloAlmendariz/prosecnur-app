source("setup-load-all.R")

# La lámina de UNA sola pregunta Sí/No (barra estándar) aprovecha el ancho: ~85 % del lienzo, centrada, dentro de márgenes.
# Las demás formas de la dicotomía (partida, vertical, escala de varias preguntas) conservan su geometría.

.du_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.du_x <- function(doc, nombre) {
  x <- doc$slide$get_slide(length(doc))$get()
  sp <- xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  off <- xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:off"); ext <- xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:ext")
  data.frame(x = as.numeric(xml2::xml_attr(off, "x")) / 914400, w = as.numeric(xml2::xml_attr(ext, "cx")) / 914400)
}
.du_espec <- function(estilo = "barra_estandar") {
  e <- preparar_categorica(c("Sí", "No"), c(.63, .37), c("63%", "37%"))
  e$colores <- c(`Sí` = "#081F5C", No = "#CA5651"); e$estilo_dicotomia <- estilo; e
}
.du_doc_x <- function(pub) {
  d <- .lam_laminas_dicotomia(.du_doc(), .du_espec(), "T", pregunta = "¿P?", publico = pub, base = "Base: 115", folio = 1)$doc
  d$slide$get_slide(length(d))$get()
}

.du_lamina <- function(...) .lam_laminas_dicotomia(.du_doc(), ..., titulo = "Organización", pregunta = "¿Se actualiza el currículo?",
                                                   publico = "115 docentes", base = "Base: 115 docentes", folio = 1)

test_that("una sola pregunta Sí/No: la barra pasa del 57 % anterior al ~85 %, centrada y dentro de márgenes", {
  W <- .std_geom("ancho"); ml <- .std_geom("margen_izq"); mr <- .std_geom("margen_der")
  anterior <- W - mr - .std_geom("likert")$x_barra - 0.3
  b <- .du_x(.du_lamina(espec = .du_espec())$doc, "barra:segmento")
  x0 <- min(b$x); x1 <- max(b$x + b$w); ancho <- x1 - x0
  expect_gt(ancho, anterior + 3)
  expect_gt(ancho / W, 0.80); expect_lt(ancho / W, 0.90)
  expect_lt(abs((x0 + x1) / 2 - W / 2), 0.01)
  expect_gte(x0, ml - 1e-6); expect_lte(x1, W - mr + 1e-6)
  cua <- .du_x(.du_lamina(espec = .du_espec())$doc, "leyenda:cuadro")
  plan <- .lam_leyenda_plan(c("Sí", "No"), 12)
  expect_lt(abs(min(cua$x) + plan$totales[1] / 2 - W / 2), 0.03)
})

test_that("el resto de formas de la dicotomía no cambia de ancho", {
  W <- .std_geom("ancho"); ancho_pleno <- W - .std_geom("margen_izq") - .std_geom("margen_der")
  p <- .du_x(.du_lamina(espec = .du_espec("partida"))$doc, "barra:segmento")
  expect_equal(nrow(p), 0L)   # la partida no usa la barra estándar
  v <- suppressWarnings(.lam_laminas_dicotomia(.du_doc(), .du_espec("partida"), "T", pregunta = "¿P?", vertical = TRUE, folio = 1))
  expect_s3_class(v$doc, "rpptx")
  expect_equal(.lam_dicotomia_unica_ancho(), min(0.85 * W, W - 2 * .std_geom("margen_izq")))
  expect_lt(.lam_dicotomia_unica_ancho(), ancho_pleno + 1e-9)
})

test_that("el n del público («115 docentes») sólo sale con mostrar_respuestas encendido y el bloque se recentra sin él", {
  expect_null(.lam_dicotomia_publico(115, "docentes", "docentes$p1", list(), .du_espec()))
  expect_null(.lam_dicotomia_publico(115, "docentes", "docentes$p1", list(mostrar_respuestas = FALSE), .du_espec()))
  expect_identical(.lam_dicotomia_publico(115, "docentes", "docentes$p1", list(mostrar_respuestas = TRUE), .du_espec()), "115 docentes")
  e <- .du_espec(); e$mostrar_respuestas <- TRUE
  expect_identical(.lam_dicotomia_publico(115, "docentes", "docentes$p1", NULL, e), "115 docentes")
  # sin publico, el enunciado queda más compacto: no hay textos con «docentes»
  txt <- function(pub) paste(xml2::xml_text(xml2::xml_find_all(.du_doc_x(pub), "//a:t")), collapse = "|")
  expect_false(grepl("115 docentes", txt(NULL)))
  expect_true(grepl("115 docentes", txt("115 docentes")))
})
