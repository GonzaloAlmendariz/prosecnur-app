# La barra de escala dentro de un panel (media lámina) nunca baja de 0,66 cm, el mínimo de Contabilidad (láms. 18, 19 y
# 21). El piso de la escala a lámina entera (1,12 cm) no cabe en media lámina (Gonzalo, 2026-10-29: «0,66 cm, como Conta»).

.pp_espec <- function(n) {
  niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo")
  d <- data.frame(item = paste0("p", seq_len(n)), rotulo = paste("Público", seq_len(n)), N = 40,
                  t1 = 0.1, t2 = 0.2, t3 = 0.4, t4 = 0.3)
  preparar_escala(d, "item", "N", paste0("t", 1:4), niv, var_etiqueta_categoria = "rotulo",
                  colores_grupos = as.list(stats::setNames(.std_paleta("likert")[1:4], niv)))
}
.pp_altos <- function(doc) {
  x <- doc$slide$get_slide(length(doc))$get()
  sp <- xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='segmento']]")
  as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:ext"), "cy")) / 914400
}

test_that("el piso de panel es el del estándar: 0,66 cm", {
  expect_equal(.std_valor("ppt", "grosor", "piso_panel_cm"), 0.66)
  expect_equal(.std_piso_panel_in(), 0.66 / 2.54)
})

test_that("con muchos públicos la barra del panel se queda en el piso de 0,66 cm, no en 0,61", {
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  o <- .lam_laminas_paneles(doc, list(.pp_espec(10), .pp_espec(10)), list("P1", "P2"), titulo = "T", base = "Base: 40", folio = 1)
  h <- .pp_altos(if (inherits(o, "rpptx")) o else o$doc)
  expect_gt(length(h), 0)
  expect_gte(min(h), 0.66 / 2.54 - 1e-3)
})

test_that("la lámina de dos paneles es nativa hasta 6 públicos (el tope de un estudio); con 7 va por la ruta anterior", {
  gg <- function(n) structure(list(), class = "ggplot", pulso_espec = .pp_espec(n))
  expect_true(.lam_compositor_aplica_paneles(list(gg(6), gg(6))))
  expect_false(.lam_compositor_aplica_paneles(list(gg(7), gg(6))))
})
