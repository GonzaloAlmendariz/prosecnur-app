# «(cont.)» exactamente una vez (contrato del lead, 2026-10-10), sin importar cuántas particiones haya.
#
# Visto por el verificador: «BIENESTAR UNIVERSITARIO (cont.) (cont.)». El plan parte una escala larga en piezas
# (reporte_plan_particion.R, la segunda ya titulada «… (cont.)») y el compositor nativo vuelve a partir esa pieza
# (lamina_compositor.R): la segunda parte de la segunda pieza sumaba otro «(cont.)».

.lcu_bateria <- function(n_filas = 11, base = 51) {
  niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo", t5 = "SIN INF")
  set.seed(n_filas)
  d <- do.call(rbind, lapply(seq_len(n_filas), function(k) {
    c3 <- sample(10:25, 1); c4 <- base - c3 - sample(0:2, 1); resto <- base - c3 - c4
    data.frame(item = sprintf("p%02d", k), rotulo = sprintf("Competencia %d", k), N = base, t1 = 0, t2 = resto, t3 = c3, t4 = c4, t5 = 0)
  }))
  d[paste0("t", 1:5)] <- d[paste0("t", 1:5)] / d$N
  preparar_escala(d, "item", "N", paste0("t", 1:5), niv, var_etiqueta_categoria = "rotulo",
                  colores_grupos = as.list(setNames(.std_paleta("likert"), niv)), barra_extra_preset = "top2box", top2box_labels = niv[3:4])
}
.lcu_titulos <- function(doc) {
  vapply(seq_len(length(doc)), function(i) {
    x <- doc$slide$get_slide(i)$get()
    xml2::xml_text(xml2::xml_find_first(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='Titulo lamina']]"))
  }, "")
}

test_that("una pieza ya titulada «(cont.)» que el compositor vuelve a partir no repite «(cont.)»", {
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  o <- .lam_laminas_escala(doc, .lcu_bateria(11), "BIENESTAR UNIVERSITARIO (cont.)", base = "Base: 51")
  expect_identical(o$partes, 2L)
  expect_identical(.lcu_titulos(o$doc), rep("BIENESTAR UNIVERSITARIO (cont.)", 2L))
})

test_that("la primera pieza partida lleva «(cont.)» sólo desde la segunda parte", {
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  o <- .lam_laminas_escala(doc, .lcu_bateria(11), "BIENESTAR UNIVERSITARIO", base = "Base: 51")
  expect_identical(.lcu_titulos(o$doc), c("BIENESTAR UNIVERSITARIO", "BIENESTAR UNIVERSITARIO (cont.)"))
})

test_that("una multilista ya titulada «(cont.)» que se vuelve a partir no repite «(cont.)»", {
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  ml <- list(bloques = list(list(espec = .lcu_bateria(11), titulo = "Tutoría"), list(espec = .lcu_bateria(12), titulo = "Biblioteca")))
  o <- .lam_laminas_multilista(doc, ml, "SERVICIOS (cont.)", base = "Base: 51")
  t <- .lcu_titulos(o$doc)
  expect_gt(length(t), 1L)
  expect_identical(unique(t), "SERVICIOS (cont.)")
})
