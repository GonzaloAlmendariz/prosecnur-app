# N16 (pendiente) y N15 (Renzo, informe Arte, 2026-10-22), solo geometría de la leyenda y texto del pie:
#  (A) la leyenda compartida de una lámina completa de barras estándar de 100 % (Sí / No) se centra bajo el área de
#      las barras, el mismo eje que ellas, no bajo el bloque entero (premisas + barras);
#  (B) el pie automático de una lámina partida («(cont.)») lista solo las bases de los públicos que esa parte dibuja.

.lc_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.lc_formas <- function(doc, nombre, k = length(doc)) {
  x <- doc$slide$get_slide(k)$get()
  sp <- xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  off <- xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:off"); ext <- xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:ext")
  data.frame(x = as.numeric(xml2::xml_attr(off, "x")) / 914400, y = as.numeric(xml2::xml_attr(off, "y")) / 914400,
             w = as.numeric(xml2::xml_attr(ext, "cx")) / 914400, texto = xml2::xml_text(sp), stringsAsFactors = FALSE)
}

.lc_sino <- function(n = 4) {
  d <- data.frame(item = sprintf("p%d", seq_len(n)), rotulo = sprintf("¿Conoce el mecanismo número %d de la Unidad?", seq_len(n)),
                  N = 115, t1 = c(.21, .79, .54, .54)[seq_len(n)], t2 = c(.79, .21, .46, .46)[seq_len(n)])
  niv <- c(t1 = "Sí", t2 = "No")
  preparar_escala(d, "item", "N", c("t1", "t2"), niv, var_etiqueta_categoria = "rotulo",
                  colores_grupos = as.list(setNames(.std_paleta("dicotomica"), niv)))
}

test_that("A: la leyenda «Sí / No» de la lámina completa queda centrada a toda la lámina (el placeholder), no a las barras", {
  o <- suppressMessages(.lam_laminas_escala(.lc_doc(), .lc_sino(), "Gestión y desarrollo", base = "Base: 115 docentes", folio = 1))
  expect_identical(o$partes, 1L)
  seg <- .lc_formas(o$doc, "segmento")
  centro_barras <- (min(seg$x) + max(seg$x + seg$w)) / 2
  cua <- .lc_formas(o$doc, "leyenda:cuadro"); txt <- .lc_formas(o$doc, "leyenda:texto")
  expect_equal(nrow(cua), 2L)
  plan <- .lam_leyenda_plan(c("Sí", "No"), 12)
  centro_ley <- min(cua$x) + plan$totales[1] / 2
  expect_equal(centro_ley, .std_geom("ancho") / 2, tolerance = 0.02)   # decisión del usuario: centrada a todo el placeholder
})

.lc_actores <- function(con_adm, solo_doc) {
  # `con_adm` premisas con docentes y administrativos; `solo_doc` premisas solo con docentes
  filas <- list()
  for (k in seq_len(con_adm + solo_doc)) for (a in c("Docentes", if (k <= con_adm) "Administrativos"))
    filas[[length(filas) + 1L]] <- data.frame(item = sprintf("p%02d_%s", k, substr(a, 1, 1)), actor = a, grupo = sprintf("P%02d", k),
                                              titulo = sprintf("Premisa %02d sobre gestión y planificación", k),
                                              N = if (a == "Docentes") 115 else 85, t1 = .1, t2 = .1, t3 = .4, t4 = .3, t5 = .1)
  d <- do.call(rbind, filas)
  niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo", t5 = "SIN INF")
  preparar_escala(d, "item", "N", paste0("t", 1:5), niv, var_etiqueta_categoria = "actor", var_grupo_id = "grupo",
                  var_grupo_titulo = "titulo", colores_grupos = as.list(setNames(.std_paleta("likert"), niv)),
                  barra_extra_preset = "top2box", top2box_labels = niv[3:4])
}

test_that("B: el pie de una parte «(cont.)» lista solo los públicos que esa parte dibuja", {
  e <- .lc_actores(con_adm = 3, solo_doc = 7)
  base <- "Base: 115 docentes y 85 administrativos"
  o <- suppressMessages(.lam_laminas_escala(.lc_doc(), e, "Gestión y planificación", base = base, folio = 1))
  expect_gt(o$partes, 1L)
  n0 <- length(o$doc) - o$partes
  pies <- vapply(seq_len(o$partes), function(k) .lc_formas(o$doc, "Base lamina", n0 + k)$texto, "")
  actores <- lapply(seq_len(o$partes), function(k) unique(.lc_formas(o$doc, "actor", n0 + k)$texto))
  con_adm <- vapply(actores, function(a) "Administrativos" %in% a, TRUE)
  expect_true(any(!con_adm))                                    # el fixture sí deja una parte solo con docentes
  expect_true(any(con_adm))
  expect_identical(pies[!con_adm], rep("Base: 115 docentes", sum(!con_adm)))
  expect_identical(pies[con_adm], rep(base, sum(con_adm)))      # la parte con ambos conserva ambos
})

test_that("B: un pie que no es el automático de públicos (texto manual) no se toca", {
  e <- .lc_actores(con_adm = 3, solo_doc = 7)
  manual <- "Base: encuesta 2026, 115 docentes y 85 administrativos de la Unidad"
  o <- suppressMessages(.lam_laminas_escala(.lc_doc(), e, "Gestión y planificación", base = manual, folio = 1))
  n0 <- length(o$doc) - o$partes
  pies <- vapply(seq_len(o$partes), function(k) .lc_formas(o$doc, "Base lamina", n0 + k)$texto, "")
  expect_true(all(pies == manual))
  # y el pie con nota detrás conserva la nota
  o2 <- suppressMessages(.lam_laminas_escala(.lc_doc(), e, "Gestión y planificación", base = "Base: 115 docentes y 85 administrativos. Nota del estudio", folio = 1))
  pies2 <- vapply(seq_len(o2$partes), function(k) .lc_formas(o2$doc, "Base lamina", length(o2$doc) - o2$partes + k)$texto, "")
  expect_true(all(grepl("\\. Nota del estudio$", pies2)))
})

test_that("A: la leyenda compartida de una multilista Sí / No (láminas 5 y 46 de Arte) queda centrada a toda la lámina, no a las barras", {
  skip_if_not_installed("officer"); skip_if_not_installed("cowplot")
  d <- data.frame(s1 = rep(c("Sí", "No"), times = c(90, 30)), s2 = rep(c("Sí", "No"), times = c(60, 60)),
                  s3 = rep(c("Sí", "No"), times = c(100, 20)), s4 = rep(c("Sí", "No"), times = c(30, 90)), stringsAsFactors = FALSE)
  vars <- names(d)
  inst <- list(survey = data.frame(type = "select_one sino", list_name = "sino", name = vars, label = paste("¿Conoce el tema", 1:4, "?"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = "sino", name = c("1", "0"), label = c("Sí", "No"), stringsAsFactors = FALSE),
               label_col_survey = "label", label_col_choices = "label", lang = "es")
  p_reset()
  plan <- list(diapo_001 = p_slide_1_grafico(titulo = "Misión y visión", grafico = p_barras_multiapiladas(
    modo = "multilista", bloques = list(list(modo = "var", vars = vars[1:2], titulo = "Uno"), list(modo = "var", vars = vars[3:4], titulo = "Dos")))))
  path <- tempfile(fileext = ".pptx")
  suppressMessages(reporte_ppt_plan(data = d, instrumento = inst, plan = plan, presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO),
                                    path_ppt = path, mensajes_progreso = FALSE))
  x <- xml2::read_xml(.pptx_leer_parte(path, .pptx_slide_paths(path)[[1]]))
  forma <- function(nombre) {
    sp <- xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
    off <- xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:off"); ext <- xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:ext")
    data.frame(x = as.numeric(xml2::xml_attr(off, "x")) / 914400, w = as.numeric(xml2::xml_attr(ext, "cx")) / 914400)
  }
  seg <- forma("segmento"); cua <- forma("leyenda:cuadro")
  expect_equal(nrow(cua), 2L)                                                   # una sola leyenda compartida
  plan_l <- .lam_leyenda_plan(c("Sí", "No"), 12)
  expect_equal(min(cua$x) + plan_l$totales[1] / 2, .std_geom("ancho") / 2, tolerance = 0.02)   # decisión del usuario
})

test_that("B: el pie de la parte de una multilista partida por bloques lista solo los públicos de ese bloque", {
  b1 <- .lc_actores(con_adm = 3, solo_doc = 0); b2 <- .lc_actores(con_adm = 0, solo_doc = 3)
  ml <- list(bloques = list(list(espec = b1, titulo = "Uno"), list(espec = b2, titulo = "Dos")))
  base <- "Base: 115 docentes y 85 administrativos"
  o <- suppressMessages(.lam_laminas_multilista(.lc_doc(), ml, "Gestión y planificación", base = base, folio = 1))
  expect_gt(o$partes, 1L)
  n0 <- length(o$doc) - o$partes
  pies <- vapply(seq_len(o$partes), function(k) .lc_formas(o$doc, "Base lamina", n0 + k)$texto, "")
  con_adm <- vapply(seq_len(o$partes), function(k) "Administrativos" %in% .lc_formas(o$doc, "actor", n0 + k)$texto, TRUE)
  expect_true(any(!con_adm)); expect_true(any(con_adm))
  expect_identical(pies[!con_adm], rep("Base: 115 docentes", sum(!con_adm)))
  expect_identical(pies[con_adm], rep(base, sum(con_adm)))
})
