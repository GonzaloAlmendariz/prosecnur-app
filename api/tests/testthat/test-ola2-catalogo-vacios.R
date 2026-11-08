# Ola 2, catálogo del recetario sintético (catalogo_recetario_build()):
#   (a) la cobertura sin bases declaradas listaba `estudiantes_2018` y `estudiantes_2021` —las ediciones anteriores de
#       `estudiantes`, bases de una serie— como públicos sin barra;
#   (b) el resumen de diferencias sin filas salía con la cabecera y el cuerpo vacío, sin decir por qué (C5): avisaba en el
#       job pero la lámina callaba.

test_that("catálogo (a): la cobertura no cuenta como públicos las ediciones de una serie", {
  expect_identical(.cobertura_bases_publico(c("docentes", "estudiantes", "estudiantes_2018", "estudiantes_2021", "egresados")),
                   c("docentes", "estudiantes", "egresados"))
  # Un nombre con año que no es edición de otra base se queda.
  expect_identical(.cobertura_bases_publico(c("encuesta_2024", "docentes")), c("encuesta_2024", "docentes"))
})

test_that("catálogo (b): el resumen de diferencias sin filas dice por qué está vacío", {
  skip_if_not_installed("officer")
  espec <- list(tipo = "resumen_diferencias", capitulos = list(), rotulos_cruce = list(a = "Área"),
                columnas = data.frame(cruce = c("a", "a"), codigo = c("1", "2"), corto = c("Econ.", "CC. Pol."), stringsAsFactors = FALSE))
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  n0 <- length(doc)
  o <- suppressMessages(.lam_laminas_resumen_diferencias(doc, espec, "¿En qué se diferencian?", base = "Base: 400 casos.", folio = 3L))
  out <- tempfile(fileext = ".pptx"); print(o$doc, target = out)
  tx <- xml2::xml_text(xml2::xml_find_all(xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", n0 + 1L))), "//a:t"))
  expect_true(.LAM_RESUMEN_VACIO %in% tx)
})
