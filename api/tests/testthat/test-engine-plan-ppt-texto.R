test_that("p_slide_texto valida y normaliza contenido", {
  slide <- p_slide_texto(
    titulo = "Hallazgos",
    bullets = c("Primera idea", "Segunda idea"),
    base = "Base: encuesta 2026"
  )

  expect_s3_class(slide, "ppt_slide")
  expect_identical(slide$.slide_type, "text_slide")
  expect_match(slide$slots$text, "• Primera idea")
  expect_match(slide$slots$text, "• Segunda idea")
  expect_match(slide$slots$text, "Base: encuesta 2026")

  expect_error(
    p_slide_texto(titulo = "X", texto = NULL, bullets = NULL),
    "debe contener al menos una linea"
  )
})

test_that("reporte_ppt_plan renderiza text_slide en PPT", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  dat <- data.frame(x = 1)
  inst <- list(
    survey = data.frame(
      name = "x",
      type = "integer",
      list_name = NA_character_,
      stringsAsFactors = FALSE
    ),
    choices = NULL,
    orders_list = NULL
  )

  plan <- list(
    diapo_001 = p_slide_portada("Titulo prueba"),
    diapo_002 = p_slide_texto(
      titulo = "Diseño metodológico",
      bullets = c(
        "Estudio de línea base con enfoque cuantitativo",
        "Evaluación documental complementaria"
      ),
      base = "Base: instrumento GIZ"
    )
  )

  out_ppt <- tempfile(fileext = ".pptx")
  expect_no_error(
    reporte_ppt_plan(
      data = dat,
      instrumento = inst,
      plan = plan,
      presets = p_presets(),
      path_ppt = out_ppt,
      mensajes_progreso = FALSE
    )
  )
  expect_true(file.exists(out_ppt))
})

test_that("reporte_word_plan excluye text_slide del flujo Word", {
  skip_if_not_installed("ggplot2")

  dat <- data.frame(x = 1)
  inst <- list(
    survey = data.frame(
      name = "x",
      type = "integer",
      list_name = NA_character_,
      stringsAsFactors = FALSE
    ),
    choices = NULL,
    orders_list = NULL
  )

  graf <- p_ggplot_raw(
    ggplot2::ggplot(data.frame(cat = c("A", "B"), val = c(1, 2)), ggplot2::aes(cat, val)) +
      ggplot2::geom_col(fill = "#39588B") +
      ggplot2::theme_minimal()
  )

  plan <- list(
    diapo_001 = p_slide_portada("Titulo prueba"),
    diapo_002 = p_slide_texto(
      titulo = "Lectura analítica",
      bullets = c("Mensaje uno", "Mensaje dos")
    ),
    diapo_003 = p_slide_1_grafico(
      grafico = graf,
      titulo = "Distribución por distrito",
      subtitulo = "Gráfico 1. Distribución de la muestra según distrito"
    )
  )

  ppt_meta <- reporte_ppt_plan(
    data = dat,
    instrumento = inst,
    plan = plan,
    presets = p_presets(),
    solo_lista = TRUE,
    build_render_meta = TRUE,
    mensajes_progreso = FALSE
  )

  expect_equal(vapply(ppt_meta$render_meta, `[[`, character(1), "kind"), c("title_doc", "chart"))

  word_out <- reporte_word_plan(
    data = dat,
    instrumento = inst,
    plan = plan,
    presets_ppt = p_presets(),
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  expect_true(all(word_out$log$block_type %in% c("title_doc", "chart")))
  expect_false(any(word_out$log$block_type == "text_slide"))
})

test_that("reporte_word_plan usa etiqueta de variable como titulo por defecto", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")
  skip_if_not_installed("ggplot2")

  label_p2 <- "¿Cuántos años cumplidos tiene usted?"
  dat <- data.frame(
    p2 = c("1", "2", "2", "3", "2"),
    stringsAsFactors = FALSE
  )
  inst <- list(
    survey = data.frame(
      name = "p2",
      type = "select_one lst_edad",
      list_name = "lst_edad",
      label = label_p2,
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = "lst_edad",
      name = c("1", "2", "3"),
      label = c("18 a 29 años", "30 a 59 años", "60 a más"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_barras_agrupadas("p2")
    )
  )

  out_docx <- tempfile(fileext = ".docx")
  expect_no_error(
    reporte_word_plan(
      data = dat,
      instrumento = inst,
      plan = plan,
      presets_ppt = p_presets(),
      path_docx = out_docx,
      mensajes_progreso = FALSE
    )
  )

  doc_text <- officer::docx_summary(officer::read_docx(out_docx))$text
  expect_true(any(grepl(paste0("Gráfico Nº 1. ", label_p2), doc_text, fixed = TRUE)))
  expect_false(any(trimws(doc_text) == "Gráfico Nº 1."))
})

test_that("render_meta Word limpia titulo inferido desde variables recodificadas", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")
  skip_if_not_installed("ggplot2")

  label_p2 <- "¿Cuántos años cumplidos tiene usted?"
  dat <- data.frame(
    p2 = c("1", "96", "2", "96"),
    p2_recod = c("1", "3", "2", "3"),
    stringsAsFactors = FALSE
  )
  inst <- list(
    survey = data.frame(
      name = c("p2", "p2_recod"),
      type = c("select_one lst_edad", "select_one lst_edad_recod"),
      list_name = c("lst_edad", "lst_edad_recod"),
      label = c(label_p2, label_p2),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c(rep("lst_edad", 3), rep("lst_edad_recod", 3)),
      name = c("1", "2", "96", "1", "2", "3"),
      label = c("18 a 29 años", "30 a 59 años", "Otro", "18 a 29 años", "30 a 59 años", "Otra edad recodificada"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_barras_agrupadas("p2")
    )
  )

  meta <- reporte_ppt_plan(
    data = dat,
    instrumento = inst,
    plan = plan,
    presets = p_presets(),
    solo_lista = TRUE,
    build_render_meta = TRUE,
    mensajes_progreso = FALSE
  )

  expect_equal(meta$render_meta[[1]]$title, label_p2)
  expect_false(grepl("Recodificada", meta$render_meta[[1]]$title, fixed = TRUE))
})
