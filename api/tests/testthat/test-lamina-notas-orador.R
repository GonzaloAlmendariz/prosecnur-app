# Notas del orador (checklist-recetario-desfase-2026-10-26.md, C1): una lámina del plan puede traer `meta$notas`; el PPT
# las escribe en la página de notas de la lámina. Sin notas no se agrega ninguna página de notas (Arte sale idéntico).

.no_mazo <- function(plan) {
  df <- data.frame(p = rep(c("a", "b"), 10))
  inst <- list(survey = data.frame(name = "p", type = "select_one l", list_name = "l", label = "P"),
               choices = data.frame(list_name = "l", name = c("a", "b"), label = c("Sí", "No")), orders_list = NULL)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = df, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  out
}
.no_notas <- function(pptx) {
  nm <- grep("^ppt/notesSlides/notesSlide[0-9]+\\.xml$", utils::unzip(pptx, list = TRUE)$Name, value = TRUE)
  stats::setNames(vapply(nm, function(n) xml2::xml_text(xml2::read_xml(unz(pptx, n))), ""), nm)
}
# Lámina k del mazo → su página de notas, por la relación de la lámina.
.no_notas_de <- function(pptx, k) {
  rels <- xml2::read_xml(unz(pptx, sprintf("ppt/slides/_rels/slide%d.xml.rels", k)))
  t <- xml2::xml_attr(xml2::xml_find_all(rels, "//*[local-name()='Relationship']"), "Target")
  t <- grep("notesSlide", t, value = TRUE)
  if (!length(t)) return(NA_character_)
  xml2::xml_text(xml2::read_xml(unz(pptx, file.path("ppt", sub("^\\.\\./", "", t[[1]])))))
}

test_that("una lámina con meta$notas lleva su página de notas con ese texto; la que no, no", {
  nota <- "Estilo: Texto corrido · Graficador: p_slide_texto · Úsalo cuando: el hallazgo es prosa."
  out <- .no_mazo(list(p_slide_texto("Sin notas", texto = "a"),
                       p_slide_texto("Con notas", texto = "b", meta = list(notas = nota)),
                       p_slide_texto("Otra sin notas", texto = "c")))
  notas <- .no_notas(out)
  expect_length(notas, 1L)
  expect_match(notas[[1]], "Graficador: p_slide_texto", fixed = TRUE)
  expect_match(.no_notas_de(out, 2L), "Estilo: Texto corrido", fixed = TRUE)
  expect_true(is.na(.no_notas_de(out, 1L)))
  expect_true(is.na(.no_notas_de(out, 3L)))
})

test_that("sin meta$notas el mazo no trae páginas de notas, y una nota en blanco no cuenta", {
  out <- .no_mazo(list(p_slide_texto("A", texto = "a"), p_slide_texto("B", texto = "b", meta = list(notas = "   "))))
  expect_length(.no_notas(out), 0L)
})

test_that("varias líneas de notas llegan como párrafos", {
  out <- .no_mazo(list(p_slide_texto("A", texto = "a", meta = list(notas = c("Primera línea", "Segunda línea")))))
  x <- xml2::read_xml(unz(out, names(.no_notas(out))[[1]]))
  par <- xml2::xml_text(xml2::xml_find_all(x, "//*[local-name()='p']"))
  expect_true(all(c("Primera línea", "Segunda línea") %in% par))
})

test_that("meta$notas viaja por el plan JSON: normalize_plan y la meta del editor la conservan", {
  plan <- .normalize_plan(list(slides = list(list(id = "s1", tipo = "p_slide_texto",
                                                  payload = list(titulo = "A", texto = "a", meta = list(notas = list("Uno", "Dos")))))))
  meta <- .graficos_payload_con_meta(plan$slides[[1]]$payload)$meta
  expect_identical(meta$notas, c("Uno", "Dos"))
  expect_true("notas" %in% .SLIDE_META_CLAVES)
})
