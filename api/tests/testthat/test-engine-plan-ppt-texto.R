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

  slide_xml <- readLines(unz(out_ppt, "ppt/slides/slide2.xml"), warn = FALSE, encoding = "UTF-8")
  slide_xml <- paste(slide_xml, collapse = "\n")
  expect_match(slide_xml, "Diseño metodológico", fixed = TRUE)
  expect_false(grepl("DISEÑO METODOLÓGICO", slide_xml, fixed = TRUE))
  expect_match(slide_xml, 'sz="2400"', fixed = TRUE)
  expect_match(slide_xml, 'sz="1400"', fixed = TRUE)
})

test_that("technical_table respeta mayusculas y minusculas del titulo", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")
  skip_if_not_installed("flextable")

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

  out_ppt <- tempfile(fileext = ".pptx")
  expect_no_error(
    reporte_ppt_plan(
      data = dat,
      instrumento = inst,
      plan = list(
        diapo_001 = p_slide_tabla_tecnica(
          titulo = "Tabla técnica mixta",
          filas = data.frame(
            criterio = "Diseño",
            detalle = "Texto de prueba",
            stringsAsFactors = FALSE
          )
        )
      ),
      presets = p_presets(),
      path_ppt = out_ppt,
      mensajes_progreso = FALSE
    )
  )

  slide_xml <- readLines(unz(out_ppt, "ppt/slides/slide1.xml"), warn = FALSE, encoding = "UTF-8")
  slide_xml <- paste(slide_xml, collapse = "\n")
  expect_match(slide_xml, "Tabla técnica mixta", fixed = TRUE)
  expect_false(grepl("TABLA TÉCNICA MIXTA", slide_xml, fixed = TRUE))
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

test_that("barras agrupadas Word conservan opciones sin casos", {
  skip_if_not_installed("ggplot2")

  dat <- data.frame(
    p2 = c("1", "2", "2", "1"),
    stringsAsFactors = FALSE
  )
  inst <- list(
    survey = data.frame(
      name = "p2",
      type = "select_one lst_test",
      list_name = "lst_test",
      label = "Pregunta de prueba",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = "lst_test",
      name = c("1", "2", "3"),
      label = c("Uno", "Dos", "Tres sin casos"),
      stringsAsFactors = FALSE
    ),
    orders_list = list(
      p2 = list(
        names = c("1", "2", "3"),
        labels = c("Uno", "Dos", "Tres sin casos"),
        label = "Pregunta de prueba"
      )
    )
  )

  tab <- freq_table_spss(
    dat,
    "p2",
    survey = inst$survey,
    orders_list = inst$orders_list,
    mostrar_todo = TRUE
  )
  expect_equal(tab$n[tab$Opciones == "Tres sin casos"], 0)

  out <- reporte_ppt_plan(
    data = dat,
    instrumento = inst,
    plan = list(
      diapo_001 = p_slide_1_grafico(
        grafico = p_barras_agrupadas("p2")
      )
    ),
    presets = p_presets(),
    solo_lista = TRUE,
    build_render_meta = TRUE,
    mensajes_progreso = FALSE
  )

  labels_word <- unlist(lapply(
    ggplot2::ggplot_build(out$render_meta[[1]]$plot_word)$data,
    function(d) if ("label" %in% names(d)) as.character(d$label) else character(0)
  ), use.names = FALSE)
  expect_true("Tres sin casos" %in% labels_word)

  p_direct <- graficar_barras_agrupadas(
    data = data.frame(
      categoria = c("Uno", "Dos", "Tres sin casos"),
      N = 4,
      pct = c(0.5, 0.5, 0),
      stringsAsFactors = FALSE
    ),
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = "pct",
    etiquetas_series = c(pct = "Porcentaje"),
    mostrar_ceros = TRUE,
    umbral_barra = 0,
    mostrar_barra_extra = FALSE,
    usar_canvas = FALSE,
    exportar = "rplot"
  )
  labels_direct <- unlist(lapply(
    ggplot2::ggplot_build(p_direct)$data,
    function(d) if ("label" %in% names(d)) as.character(d$label) else character(0)
  ), use.names = FALSE)
  expect_true("0%" %in% labels_direct)
})

test_that("barras agrupadas Word no expanden ceros en catalogos de empresa", {
  skip_if_not_installed("ggplot2")

  codes <- as.character(seq_len(45))
  labels <- c("Empresa A", "Empresa B", paste("Empresa sin casos", 3:45))
  dat <- data.frame(
    empresa = c("1", "2", "1", "2"),
    stringsAsFactors = FALSE
  )
  inst <- list(
    survey = data.frame(
      name = "empresa",
      type = "select_one lst_empresas",
      list_name = "lst_empresas",
      label = "Por favor, seleccione de la siguiente lista el nombre de la empresa para la cual usted trabaja.",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = "lst_empresas",
      name = codes,
      label = labels,
      stringsAsFactors = FALSE
    ),
    orders_list = list(
      empresa = list(
        names = codes,
        labels = labels,
        label = "Por favor, seleccione de la siguiente lista el nombre de la empresa para la cual usted trabaja."
      )
    )
  )

  out <- reporte_ppt_plan(
    data = dat,
    instrumento = inst,
    plan = list(
      diapo_001 = p_slide_1_grafico(
        grafico = p_barras_agrupadas("empresa")
      )
    ),
    presets = p_presets(),
    solo_lista = TRUE,
    build_render_meta = TRUE,
    mensajes_progreso = FALSE
  )

  labels_word <- unlist(lapply(
    ggplot2::ggplot_build(out$render_meta[[1]]$plot_word)$data,
    function(d) if ("label" %in% names(d)) as.character(d$label) else character(0)
  ), use.names = FALSE)
  expect_true("Empresa A" %in% labels_word)
  expect_false(any(grepl("Empresa sin casos", labels_word, fixed = TRUE)))
  expect_false("0%" %in% labels_word)
})
