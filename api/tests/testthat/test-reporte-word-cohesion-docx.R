source("setup-load-all.R")

# B52/W-2: el bloque titulo+imagen+Base del Word viaja cohesionado — los
# parrafos del titulo y de la imagen llevan w:keepNext para que la Base no
# quede huerfana al otro lado de un salto de pagina. Cubre ademas el bug de
# officer 0.7.x: body_add_fpar con `style` reemplaza el pPr del fpar y
# silenciosamente descartaba keepNext y la alineacion del titulo.

.word_cohesion_inst <- function() {
  list(
    survey = data.frame(
      name = "conoce",
      type = "select_one sino",
      list_name = "sino",
      label = "¿Conoce el servicio?",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = "sino", name = c("Si", "No"), label = c("Sí", "No"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )
}

test_that("el docx lleva keepNext en titulo e imagen del bloque grafico", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")
  skip_if_not_installed("cowplot")
  skip_if_not_installed("ggplot2")

  data <- list(
    docentes = data.frame(
      conoce = rep(c("Si", "No"), times = c(40, 12)),
      stringsAsFactors = FALSE
    )
  )
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_barras_apiladas(var = "docentes$conoce")
    )
  )

  path_docx <- tempfile(fileext = ".docx")
  on.exit(unlink(path_docx), add = TRUE)
  expect_no_error(reporte_word_plan(
    data = data,
    instrumento = list(docentes = .word_cohesion_inst()),
    path_docx = path_docx,
    presets_ppt = do.call(p_presets, .PRESETS_DEFAULT_PULSO),
    plan = plan,
    mensajes_progreso = FALSE
  ))
  expect_true(file.exists(path_docx))

  xml <- paste(
    readLines(unz(path_docx, "word/document.xml"), warn = FALSE, encoding = "UTF-8"),
    collapse = "\n"
  )
  paras <- strsplit(xml, "<w:p>|<w:p [^>]*>")[[1]][-1]

  idx_titulo <- which(vapply(paras, function(p) grepl("Gráfico Nº 1", p, fixed = TRUE), logical(1)))
  idx_img <- which(vapply(paras, function(p) grepl("<w:drawing", p, fixed = TRUE), logical(1)))
  idx_base <- which(vapply(paras, function(p) grepl("Base: ", p, fixed = TRUE), logical(1)))

  expect_length(idx_titulo, 1L)
  expect_length(idx_img, 1L)
  expect_length(idx_base, 1L)

  # Titulo e imagen se pegan a lo que sigue; la Base cierra el bloque.
  expect_match(paras[[idx_titulo]], "<w:keepNext", fixed = TRUE)
  expect_match(paras[[idx_img]], "<w:keepNext", fixed = TRUE)
  expect_false(grepl("<w:keepNext", paras[[idx_base]], fixed = TRUE))

  # Orden del bloque: titulo -> imagen -> Base.
  expect_true(idx_titulo < idx_img && idx_img < idx_base)
})
