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
