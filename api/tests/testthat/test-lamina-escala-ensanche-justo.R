# El enunciado se ensancha sólo en la lámina que lo necesita (lamina_escala_ensanche_justo.R) y la premisa se mide con su
# tinta (lamina_escala_premisa_alto.R). Gonzalo, 2026-10-28: «no debería estar ese ensanche y aun así no aumentar el número
# de láminas».

.niv_ej <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo", t5 = "SIN INF")
.TXT_EJ <- "Estoy satisfecho(a) con los programas de actualización, perfeccionamiento y capacitaciones de la Unidad %d"
.espec_ej <- function(n, txt = .TXT_EJ) {
  d <- data.frame(item = sprintf("p%02d", seq_len(n)), rotulo = "Docentes", N = 100, t1 = .05, t2 = .1, t3 = .5, t4 = .3, t5 = .05)
  e <- preparar_escala(d, "item", "N", paste0("t", 1:5), .niv_ej, var_etiqueta_categoria = "rotulo",
                       colores_grupos = as.list(setNames(.std_paleta("likert"), .niv_ej)),
                       barra_extra_preset = "top2box", top2box_labels = .niv_ej[3:4])
  e$filas$grupo_id <- sprintf("P%d", seq_len(n)); e$filas$grupo_titulo <- sprintf(txt, seq_len(n))
  e
}
.doc_ej <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.x_segmentos_ej <- function(doc) {
  x <- doc$slide$get_slide(doc$cursor)$get()
  sp <- xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='segmento']]")
  min(as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:off"), "x"))) / 914400
}

test_that("con piso, la escala que se partiría cabe en una lámina con el ensanche mínimo, no con el tope", {
  withr::local_options(prosecnur.grosor_piso_cm = 1.12, prosecnur.ancho_enunciado_extra_in = NULL, prosecnur.evitar_cont = NULL)
  # Enunciado largo: con un solo público la pregunta ya toma el aire hasta su rótulo (como Conta), y la corta cabe sola.
  e <- .espec_ej(5L, paste(.TXT_EJ, "y de los cursos de la especialidad")); p <- .lam_escala_premisas(e)
  expect_identical(.lam_escala_partes_con(p, e, 0), 2L)          # sin ensanche se parte
  ex <- .lam_escala_ensanche_justo(p, e)
  expect_gt(ex, 0); expect_lt(ex, .LAM_ENSANCHE_JUSTO_TOPE_IN)  # lo justo, no el 1,2 in de N10
  expect_identical(.lam_escala_partes_con(p, e, ex), 1L)
  expect_identical(.lam_escala_partes_con(p, e, ex - .LAM_ENSANCHE_JUSTO_PASO_IN), 2L)   # y es el mínimo
  o <- suppressMessages(.lam_laminas_escala(.doc_ej(), e, "Gestores", folio = 1))
  expect_identical(o$partes, 1L)
  expect_null(getOption("prosecnur.ancho_enunciado_extra_in"))   # la lámina no deja el ensanche puesto
})

test_that("la lámina que ya cabe conserva el ancho del estándar, y el ensanche del informe manda cuando existe", {
  withr::local_options(prosecnur.grosor_piso_cm = 1.12, prosecnur.ancho_enunciado_extra_in = NULL, prosecnur.evitar_cont = NULL)
  e <- .espec_ej(3L); p <- .lam_escala_premisas(e)
  expect_equal(.lam_escala_ensanche_justo(p, e), 0)
  base <- .x_segmentos_ej(suppressMessages(.lam_laminas_escala(.doc_ej(), e, "Gestores", folio = 1))$doc)
  withr::local_options(prosecnur.ancho_enunciado_extra_in = 0.9)
  expect_equal(.lam_escala_ensanche_justo(.lam_escala_premisas(.espec_ej(5L)), .espec_ej(5L)), 0)
  expect_equal(.x_segmentos_ej(suppressMessages(.lam_laminas_escala(.doc_ej(), e, "Gestores", folio = 1))$doc) - base, 0.9, tolerance = 1e-3)
})

test_that("sin piso de grosor no hay ensanche justo: la partición es la de siempre", {
  withr::local_options(prosecnur.grosor_piso_cm = 0, prosecnur.ancho_enunciado_extra_in = NULL, prosecnur.evitar_cont = NULL)
  e <- .espec_ej(5L)
  expect_equal(.lam_escala_ensanche_justo(.lam_escala_premisas(e), e), 0)
})

test_that("el alto de la premisa sale de la tinta: no cuenta más líneas que las que se componen", {
  skip_if_not_installed("systemfonts")
  txt <- sprintf(.TXT_EJ, 1L); w <- 3.3; s <- .std_pt("pregunta")
  expect_identical(.lam_alto_premisa_txt(txt, w), unname(.lam_alto_tinta(txt, w, s, TRUE)[[1]]))
  expect_lte(.lam_alto_premisa_txt(txt, w), .lam_alto_txt(txt, w, s, TRUE))
})
