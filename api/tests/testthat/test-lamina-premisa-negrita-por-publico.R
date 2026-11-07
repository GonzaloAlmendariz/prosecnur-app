# La lámina por público (subtítulo DOCENTES, ESTUDIANTES…) lleva las preguntas sin negrita y el subtítulo a 18 pt azul,
# como el mazo de Contabilidad (láms. 26, 27, 33 y 42); la lámina sin subtítulo conserva la negrita.
# checklist-arte-vs-conta-2026-10-29, ítems 15 y 16.

.niv_pn <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo", t5 = "SIN INF")
.espec_pn <- function(n = 3L) {
  d <- data.frame(item = sprintf("p%02d", seq_len(n)), rotulo = "", N = 100, t1 = .05, t2 = .1, t3 = .5, t4 = .3, t5 = .05)
  e <- preparar_escala(d, "item", "N", paste0("t", 1:5), .niv_pn, var_etiqueta_categoria = "rotulo",
                       colores_grupos = as.list(setNames(.std_paleta("likert"), .niv_pn)))
  e$filas$grupo_id <- sprintf("P%d", seq_len(n)); e$filas$grupo_titulo <- sprintf("Los procesos de selección del personal docente %d", seq_len(n))
  e
}
.pie_pn <- function(sub) {
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  doc <- suppressMessages(.lam_laminas_escala(doc, .espec_pn(), "GESTIÓN DEL CUERPO ACADÉMICO", sub = sub, folio = 1)$doc)
  xml2::read_xml(as.character(doc$slide$get_slide(1)$get()))
}
.runs_pn <- function(x, nombre) {
  sp <- xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  xml2::xml_find_all(sp, ".//a:rPr")
}

test_that("con subtítulo de público las preguntas van sin negrita; sin subtítulo, con negrita", {
  con <- .runs_pn(.pie_pn("DOCENTES"), "premisa"); sin <- .runs_pn(.pie_pn(NULL), "premisa")
  expect_gt(length(con), 0L); expect_gt(length(sin), 0L)
  expect_false(any(xml2::xml_attr(con, "b") %in% "1"))
  expect_true(all(xml2::xml_attr(sin, "b") %in% "1"))
})

test_that("el subtítulo de público sale a 18 pt azul", {
  r <- .runs_pn(.pie_pn("DOCENTES"), "Subtitulo lamina")
  expect_gt(length(r), 0L)
  expect_true(all(xml2::xml_attr(r, "sz") == "1800"))
  col <- xml2::xml_attr(xml2::xml_find_all(r, ".//a:srgbClr"), "val")
  expect_true(all(toupper(col) == toupper(sub("#", "", .std_color("azul")))))
})
