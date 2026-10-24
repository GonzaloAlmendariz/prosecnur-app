source("setup-load-all.R")

# L10-1 y L10-5 (bandeja CCSS, 2026-10-24): el dumbbell con rótulos largos y el lollipop de once opciones caían a la
# imagen ggplot con caja blanca y letra diminuta. Ahora salen nativos; si no caben, el respaldo va sin caja.

.l10n_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.l10n_xml <- function(doc) { out <- tempfile(fileext = ".pptx"); print(doc, target = out); xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc)))) }

.l10n_pesas <- function() {
  d <- data.frame(eje = rep(c("Evito preguntar porque siento que «ya debería saber eso»",
                              "Evito preguntar por inseguridad frente al resto de la clase"), each = 2),
                  grupo = factor(rep(c("Mujer", "Hombre"), 2), levels = c("Mujer", "Hombre")),
                  valor = c(54.9, 43.3, 51.7, 40.5), n = rep(c(216.88, 183.12), 2), n_casos = rep(c(215, 182), 2))
  attr(graficar_dumbbell(d), "pulso_espec")
}

test_that("L10-1: el dumbbell con rótulos largos cabe en su lámina nativa ensanchando la columna de rótulos", {
  e <- .l10n_pesas()
  expect_false(all(vapply(e$rotulos, function(x) .lam_lineas(x, 2.8, 13, TRUE) <= 2L, TRUE)))   # no cabía en 2.8 in
  expect_true(.lam_numericos_cabe(e))
  w <- .lam_pesas_ancho_rotulo(e$rotulos, TRUE)
  expect_gt(w, 2.8); expect_lte(w, 4.4)
  xml <- .l10n_xml(.lam_laminas_pesas(.l10n_doc(), e, "Participación", folio = 1)$doc)
  rot <- xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='pesas:rotulo']]/p:spPr/a:xfrm/a:ext")
  expect_equal(as.numeric(xml2::xml_attr(rot, "cx"))[1] / 914400, w, tolerance = 1e-3)
  # Rótulos cortos: la columna del recetario, sin cambios.
  expect_identical(.lam_pesas_ancho_rotulo(c("ChatGPT", "Gemini"), TRUE), 2.8)
})

test_that("L10-1: en la ruta de respaldo el dumbbell y el lollipop no llevan caja blanca", {
  e <- .l10n_pesas()
  d <- data.frame(eje = "A", grupo = factor(c("x", "y")), valor = c(40, 30))
  for (p in list(graficar_dumbbell(d), graficar_lollipop(data.frame(c = c("a", "b"), v = c(3, 2)), "c", "v"))) {
    expect_true(is.na(p$theme$plot.background$fill))
  }
})

.l10n_b3 <- c("Voluntariado", "Académica (grupos de lectura, seminarios temáticos, grupos de estudio, entre otros)", "Ninguna",
              "Deportiva", "Política universitaria", "Artística (música, teatro, artes plásticas y/o danza)", "Profesional",
              "Religiosa", "Política nacional", "Entretenimiento (videojuegos, juegos de mesa, entre otros)", "Otros")

test_that("L10-5: el lollipop de once opciones con un rótulo de dos líneas cabe bajando su letra, nunca bajo 9 pt", {
  e <- attr(graficar_lollipop(data.frame(c = .l10n_b3, v = c(44, 29, 28, 14, 14, 9, 7, 4, 4, 3, 1)), "c", "v", residuales_gris = TRUE), "pulso_espec")
  pt <- .lam_lollipop_pt(e$rotulos)
  expect_true(is.finite(pt)); expect_lt(pt, 11); expect_gte(pt, 9)
  expect_true(.lam_lollipop_cabe(e))
  expect_identical(tail(e$rotulos, 2), c("Ninguna", "Otros"))
  xml <- .l10n_xml(.lam_laminas_lollipop(.l10n_doc(), e, "Agrupaciones", folio = 5)$doc)
  sz <- xml2::xml_attr(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='lollipop:rotulo']]//a:rPr"), "sz")
  expect_true(all(as.numeric(sz) == pt * 100))
  # Rótulos cortos: 11 pt del recetario.
  expect_identical(.lam_lollipop_pt(c("A", "B", "C")), 11)
})

test_that("L10-5: en la ruta real el lollipop de once opciones sale nativo", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  n <- c(44, 29, 28, 14, 14, 9, 7, 4, 4, 3, 1)
  dat <- data.frame(m = rep(as.character(seq_along(n)), n), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = "m", type = "select_one op", list_name = "op", label = "Agrupaciones", stringsAsFactors = FALSE),
               choices = data.frame(list_name = "op", name = as.character(seq_along(n)), label = .l10n_b3, stringsAsFactors = FALSE),
               orders_list = NULL)
  plan <- list(a = p_slide_1_grafico(grafico = p_lollipop("m", residuales_gris = TRUE), titulo = "Ranking"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  g <- xml2::xml_attr(xml2::xml_find_all(xml2::read_xml(unz(out, "ppt/slides/slide1.xml")), "//p:grpSp/p:nvGrpSpPr/p:cNvPr"), "name")
  expect_true("prosecnur:grafico:lollipop" %in% g)
})
