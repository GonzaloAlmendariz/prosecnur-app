# N10 (Renzo, 2026-10-22): «¿no es mejor darle un poco más de ancho a las etiquetas y que todo calce en una sola diapo,
# incluso con el grosor?». `ancho_enunciado_extra_in` (por informe, `presets$base$args`) ensancha la columna del
# ENUNCIADO a costa del área de barras; sin declarar, la geometría es la de siempre. Solo geometría: ninguna cifra cambia.

.niv_ae <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo", t5 = "SIN INF")
.espec_ae <- function(n = 5L) {   # n temas de un solo público, con enunciado largo (3 líneas en el ancho actual)
  d <- data.frame(item = sprintf("p%02d", seq_len(n)), rotulo = "Docentes", N = 100, t1 = .05, t2 = .1, t3 = .5, t4 = .3, t5 = .05)
  e <- preparar_escala(d, "item", "N", paste0("t", 1:5), .niv_ae, var_etiqueta_categoria = "rotulo",
                       colores_grupos = as.list(setNames(.std_paleta("likert"), .niv_ae)),
                       barra_extra_preset = "top2box", top2box_labels = .niv_ae[3:4])
  e$filas$grupo_id <- sprintf("P%d", seq_len(n))
  e$filas$grupo_titulo <- sprintf("Me encuentro satisfecho con la atencion recibida del personal administrativo (%d)", seq_len(n))
  e
}
.doc_ae <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.lamina_ae <- function(e) suppressMessages(.lam_laminas_escala(.doc_ae(), e, "Gestores", folio = 1))
.nom_ae <- function(doc, nombre) {
  x <- doc$slide$get_slide(doc$cursor)$get()
  sp <- xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  list(x = as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:off"), "x")) / 914400,
       w = as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:ext"), "cx")) / 914400,
       cy = as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:ext"), "cy")) / 914400 * 2.54)
}
PISO_AE <- 1.12

test_that("con piso, 5 temas de enunciado largo se parten en 2; con más ancho de enunciado caben en 1 y la barra no baja del piso", {
  # M1 (2026-10-22): con piso el aire cede y estos 5 temas ya caben en 1 sin ancho extra (test-lamina-escala-m1-sin-cont.R);
  # el default del ANCHO sigue intacto y se comprueba con `evitar_cont = FALSE` (el comportamiento de N1).
  op <- options(prosecnur.grosor_piso_cm = PISO_AE, prosecnur.ancho_enunciado_extra_in = NULL, prosecnur.evitar_cont = FALSE); on.exit(options(op))
  expect_identical(.lamina_ae(.espec_ae())$partes, 2L)           # hoy: default intacto
  options(prosecnur.ancho_enunciado_extra_in = 1.2)
  o <- .lamina_ae(.espec_ae())
  expect_identical(o$partes, 1L)
  expect_gte(min(.nom_ae(o$doc, "segmento")$cy), PISO_AE - 0.005)
})

test_that("el ancho extra sale del área de barras: la barra arranca más a la derecha y la Top Two Box no se mueve", {
  op <- options(prosecnur.grosor_piso_cm = PISO_AE, prosecnur.ancho_enunciado_extra_in = NULL); on.exit(options(op))
  e <- .espec_ae(3L)
  base <- .lamina_ae(e)$doc
  options(prosecnur.ancho_enunciado_extra_in = 0.9)
  ext <- .lamina_ae(e)$doc
  expect_equal(.nom_ae(ext, "premisa")$w[1] - .nom_ae(base, "premisa")$w[1], 0.9, tolerance = 1e-3)
  expect_equal(min(.nom_ae(ext, "segmento")$x) - min(.nom_ae(base, "segmento")$x), 0.9, tolerance = 1e-3)
  expect_equal(.nom_ae(ext, "box:cifra")$x, .nom_ae(base, "box:cifra")$x)
})

test_that("sin declarar o con 0 la geometría es la de siempre", {
  e <- .espec_ae(3L)
  expect_null(getOption("prosecnur.ancho_enunciado_extra_in"))
  base <- .lamina_ae(e)$doc
  op <- options(prosecnur.ancho_enunciado_extra_in = 0); on.exit(options(op))
  expect_identical(.nom_ae(.lamina_ae(e)$doc, "premisa"), .nom_ae(base, "premisa"))
  expect_equal(.std_enunciado_extra_in(), 0)
})

test_that("el informe lo declara en presets$base$args; un valor inválido se ignora con aviso y el tope protege las barras", {
  op <- .casos_junto_fijar(list(base = list(args = list(ancho_enunciado_extra_in = 0.9))))
  expect_equal(getOption("prosecnur.ancho_enunciado_extra_in"), 0.9)
  expect_equal(.std_enunciado_extra_in(), 0.9)
  options(op)
  expect_null(getOption("prosecnur.ancho_enunciado_extra_in"))
  expect_warning(.casos_junto_fijar(list(base = list(args = list(ancho_enunciado_extra_in = "x")))), "ancho_enunciado_extra_in")
  expect_warning(.casos_junto_fijar(list(base = list(args = list(ancho_enunciado_extra_in = -1)))), "ancho_enunciado_extra_in")
  options(prosecnur.ancho_enunciado_extra_in = 5)       # un ancho absurdo no se come las barras: tope
  on.exit(options(prosecnur.ancho_enunciado_extra_in = NULL), add = TRUE)
  expect_lte(.std_enunciado_extra_in(), 1.5)
})
