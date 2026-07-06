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

test_that("p_slide_indice renderiza contenido editable en PPT", {
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
        diapo_001 = p_slide_indice(
          titulo = "Índice",
          secciones = c("Objetivo del estudio", "Metodología y ficha técnica"),
          subindices = list(
            "Metodología y ficha técnica" = c("Perfil del egresado", "Satisfacción con la carrera")
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
  expect_match(slide_xml, "ÍNDICE", fixed = TRUE)
  expect_match(slide_xml, "Objetivo del estudio", fixed = TRUE)
  expect_match(slide_xml, "Perfil del egresado", fixed = TRUE)
  expect_match(slide_xml, "2.1", fixed = TRUE)
  expect_match(slide_xml, "2.2", fixed = TRUE)
  expect_match(slide_xml, 'sz="1600"', fixed = TRUE)
})

test_that("p_slide_indice expone controles amigables para focos editables", {
  slide <- p_slide_indice(
    titulo = "Índice",
    iconos_focos = c("target-arrow", "clipboard-list", "circle-user-round", "chart-column", "artificial-intelligence"),
    iconos_focos_objeto_unico = TRUE,
    iconos_focos_diametro_cm = 2.18,
    iconos_focos_icon_scale = 0.74,
    iconos_focos_left_cm = "0.1, 0.2, 0.3, 0.4, 0.5",
    iconos_focos_top_cm = "0.1, 0.2, 0.3, 0.4, 0.5",
    subtopic_badge_fill = "#CA5651",
    subtopic_badge_width = 0.36,
    subtopic_badge_gap = 0.08
  )

  expect_true(isTRUE(slide$style$iconos_focos_objeto_unico))
  expect_equal(slide$style$iconos_focos_cover_width, rep(2.18 / 2.54, 5))
  expect_equal(slide$style$iconos_focos_cover_height, rep(2.18 / 2.54, 5))
  expect_equal(slide$style$iconos_focos_icon_scale, rep(0.74, 5))
  expect_null(slide$style$iconos_focos_cover_left)
  expect_null(slide$style$iconos_focos_cover_top)
  expect_equal(slide$style$subtopic_badge_fill, "#CA5651")
  expect_equal(slide$style$subtopic_badge_width, 0.36)
  expect_equal(slide$style$subtopic_badge_gap, 0.08)
})

test_that("reporte_ppt_plan aplica controles de focos desde slots del editor", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")
  skip_if_not_installed("flextable")
  skip_if_not_installed("rsvg")
  skip_if_not_installed("xml2")

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

  slide <- structure(
    list(
      .slide_type = "indice",
      title = "Índice",
      slots = list(
        title = "Índice",
        secciones = c("Objetivo", "Metodología"),
        iconos_focos = c("target-arrow", "clipboard-list", "circle-user-round", "chart-column", "artificial-intelligence"),
        iconos_focos_objeto_unico = TRUE,
        iconos_focos_icon_scale = 0.72,
        iconos_focos_left_cm = "0.1, 0.2, 0.3, 0.4, 0.5",
        iconos_focos_top_cm = "0.1, 0.2, 0.3, 0.4, 0.5"
      )
    ),
    class = "ppt_slide"
  )

  out_ppt <- tempfile(fileext = ".pptx")
  expect_no_error(
    reporte_ppt_plan(
      data = dat,
      instrumento = inst,
      plan = list(
        diapo_001 = slide,
        diapo_002 = p_slide_indice(
          titulo = "Índice",
          secciones = c("Objetivo", "Metodología")
        )
      ),
      presets = p_presets(),
      path_ppt = out_ppt,
      mensajes_progreso = FALSE
    )
  )

  slide_xml <- paste(readLines(unz(out_ppt, "ppt/slides/slide1.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  xml <- xml2::read_xml(slide_xml)
  ns <- xml2::xml_ns(xml)
  pics <- xml2::xml_find_all(xml, ".//p:pic", ns = ns)
  names <- xml2::xml_attr(xml2::xml_find_first(pics, ".//p:cNvPr", ns = ns), "name")
  icon_idx <- grep("^Indice bulb icon", names)
  expect_length(icon_idx, 5)
  ext <- xml2::xml_find_first(pics[icon_idx], ".//a:ext", ns = ns)
  off <- xml2::xml_find_first(pics[icon_idx], ".//a:off", ns = ns)
  left_cm <- as.numeric(xml2::xml_attr(off, "x")) / 914400 * 2.54
  top_cm <- as.numeric(xml2::xml_attr(off, "y")) / 914400 * 2.54
  widths_cm <- as.numeric(xml2::xml_attr(ext, "cx")) / 914400 * 2.54
  heights_cm <- as.numeric(xml2::xml_attr(ext, "cy")) / 914400 * 2.54
  expect_equal(round(left_cm, 2), c(1.85, 6.28, 11.63, 4.32, 8.67))
  expect_equal(round(top_cm, 2), c(6.68, 6.68, 7.52, 11.07, 11.56))
  expect_equal(round(widths_cm, 2), rep(2.18, 5))
  expect_equal(round(heights_cm, 2), rep(2.18, 5))

  slide2_xml <- paste(readLines(unz(out_ppt, "ppt/slides/slide2.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  xml2_slide <- xml2::read_xml(slide2_xml)
  ns2 <- xml2::xml_ns(xml2_slide)
  pics2 <- xml2::xml_find_all(xml2_slide, ".//p:pic", ns = ns2)
  names2 <- xml2::xml_attr(xml2::xml_find_first(pics2, ".//p:cNvPr", ns = ns2), "name")
  icon_idx2 <- grep("^Indice bulb icon", names2)
  expect_length(icon_idx2, 5)
  off2 <- xml2::xml_find_first(pics2[icon_idx2], ".//a:off", ns = ns2)
  ext2 <- xml2::xml_find_first(pics2[icon_idx2], ".//a:ext", ns = ns2)
  left_cm2 <- as.numeric(xml2::xml_attr(off2, "x")) / 914400 * 2.54
  top_cm2 <- as.numeric(xml2::xml_attr(off2, "y")) / 914400 * 2.54
  width_cm2 <- as.numeric(xml2::xml_attr(ext2, "cx")) / 914400 * 2.54
  height_cm2 <- as.numeric(xml2::xml_attr(ext2, "cy")) / 914400 * 2.54
  expect_equal(round(left_cm2, 2), c(1.85, 6.28, 11.63, 4.32, 8.67))
  expect_equal(round(top_cm2, 2), c(6.68, 6.68, 7.52, 11.07, 11.56))
  expect_equal(round(width_cm2, 2), rep(2.18, 5))
  expect_equal(round(height_cm2, 2), rep(2.18, 5))
})

test_that("p_slide_indice soporta variantes de 3 a 6 apartados con subindices", {
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

  make_slide <- function(n_sections, sub_section) {
    secciones <- paste("Seccion", seq_len(n_sections))
    p_slide_indice(
      titulo = paste("Indice", n_sections),
      secciones = secciones,
      subindices = stats::setNames(
        list(c("Subtema alfa", "Subtema beta")),
        sub_section
      ),
      estilo = list(
        subindices_inline = TRUE,
        redibujar_focos = TRUE,
        mostrar_iconos_focos = TRUE
      )
    )
  }

  plan <- list(
    diapo_001 = make_slide(3, "Seccion 3"),
    diapo_002 = make_slide(4, "Seccion 4"),
    diapo_003 = make_slide(5, "Seccion 4"),
    diapo_004 = make_slide(6, "Seccion 6")
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

  expected <- list(
    list(slide = 1L, title = "INDICE 3", section = "Seccion 3", numbers = c("3.1", "3.2")),
    list(slide = 2L, title = "INDICE 4", section = "Seccion 4", numbers = c("4.1", "4.2")),
    list(slide = 3L, title = "INDICE 5", section = "Seccion 4", numbers = c("4.1", "4.2")),
    list(slide = 4L, title = "INDICE 6", section = "Seccion 6", numbers = c("6.1", "6.2"))
  )

  for (item in expected) {
    slide_xml <- readLines(
      unz(out_ppt, sprintf("ppt/slides/slide%s.xml", item$slide)),
      warn = FALSE,
      encoding = "UTF-8"
    )
    slide_xml <- paste(slide_xml, collapse = "\n")
    expect_match(slide_xml, item$title, fixed = TRUE)
    expect_match(slide_xml, item$section, fixed = TRUE)
    expect_match(slide_xml, "Subtema alfa", fixed = TRUE)
    expect_match(slide_xml, "Subtema beta", fixed = TRUE)
    expect_match(slide_xml, item$numbers[[1]], fixed = TRUE)
    expect_match(slide_xml, item$numbers[[2]], fixed = TRUE)
  }
})

test_that("p_slide_top_two_box renderiza lamina explicativa en PPT", {
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

  out_ppt <- tempfile(fileext = ".pptx")
  top_two_slide <- p_slide_top_two_box(
    accent_color = "#CA5651",
    colores = c("#CA5651", "#FFD965", "#ADD493", "#70AD47"),
    grosor_barra = 84,
    size_texto_porcentajes = 18,
    size_texto_porcentajes_peq = 14,
    color_texto_porcentajes = "#FFFFFF",
    margen_llave = 6,
    grosor_flecha = 3.8
  )
  expect_equal(top_two_slide$style$colores, c("#CA5651", "#FFD965", "#ADD493", "#70AD47"))
  expect_equal(top_two_slide$style$grosor_barra, 84)
  expect_equal(top_two_slide$style$size_texto_porcentajes, 18)
  expect_equal(top_two_slide$style$size_texto_porcentajes_peq, 14)
  expect_equal(top_two_slide$style$color_texto_porcentajes, "#FFFFFF")
  expect_equal(top_two_slide$style$margen_llave, 6)
  expect_equal(top_two_slide$style$grosor_flecha, 3.8)

  expect_no_error(
    reporte_ppt_plan(
      data = dat,
      instrumento = inst,
      plan = list(
        diapo_001 = top_two_slide
      ),
      presets = p_presets(),
      path_ppt = out_ppt,
      mensajes_progreso = FALSE
    )
  )

  slide_xml <- readLines(unz(out_ppt, "ppt/slides/slide1.xml"), warn = FALSE, encoding = "UTF-8")
  slide_xml <- paste(slide_xml, collapse = "\n")
  expect_match(slide_xml, "TOP TWO BOX", fixed = TRUE)
  expect_match(slide_xml, "lectura de datos", fixed = TRUE)

  ppt_files <- utils::unzip(out_ppt, list = TRUE)$Name
  svg_files <- ppt_files[grepl("^ppt/media/.*\\.svg$", ppt_files)]
  expect_length(svg_files, 1)
  svg_txt <- paste(readLines(unz(out_ppt, svg_files[[1]]), warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_match(svg_txt, "#CA5651", fixed = TRUE)
  expect_match(svg_txt, "#ADD493", fixed = TRUE)
  expect_match(svg_txt, 'height="84.00"', fixed = TRUE)
  expect_match(svg_txt, 'font-size="18.0"', fixed = TRUE)
  expect_match(svg_txt, 'font-size="14.0"', fixed = TRUE)
  expect_match(svg_txt, 'fill="#FFFFFF">35%</text>', fixed = TRUE)
  expect_match(svg_txt, 'stroke-width="3.80"', fixed = TRUE)
  expect_false(grepl("#F4B183", svg_txt, fixed = TRUE))
  expect_false(grepl("marker-", svg_txt, fixed = TRUE))
  expect_true(any(grepl("^ppt/media/.*\\.svg$", ppt_files)))
  svg_file <- ppt_files[grepl("^ppt/media/.*\\.svg$", ppt_files)][[1]]
  svg_xml <- paste(readLines(unz(out_ppt, svg_file), warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_match(svg_xml, "#CA5651", fixed = TRUE)

  out_ppt_slots <- tempfile(fileext = ".pptx")
  top_two_slots <- structure(
    list(
      .slide_type = "top_two_box",
      title = "TOP TWO BOX",
      slots = list(
        title = "TOP TWO BOX",
        text = "Referencia de cálculo de Top Two Box.",
        valores = c(4, 6, 35, 55),
        etiquetas = c("1", "2", "3", "4"),
        top_two_indices = c(3, 4),
        extremo_izquierda = "Totalmente\nen desacuerdo",
        extremo_derecha = "Totalmente\nde acuerdo",
        accent_color = "#CA5651",
        colores = c("#CA5651", "#FFD965", "#ADD493", "#70AD47"),
        grosor_barra = 92,
        size_texto_porcentajes = 20,
        size_texto_porcentajes_peq = 13,
        color_texto_porcentajes = "#FFFFFF",
        margen_llave = 5,
        grosor_flecha = 4
      ),
      style = list()
    ),
    class = "ppt_slide"
  )
  expect_no_error(
    reporte_ppt_plan(
      data = dat,
      instrumento = inst,
      plan = list(diapo_001 = top_two_slots),
      presets = p_presets(),
      path_ppt = out_ppt_slots,
      mensajes_progreso = FALSE
    )
  )
  ppt_files_slots <- utils::unzip(out_ppt_slots, list = TRUE)$Name
  svg_slots <- ppt_files_slots[grepl("^ppt/media/.*\\.svg$", ppt_files_slots)][[1]]
  svg_slots_txt <- paste(readLines(unz(out_ppt_slots, svg_slots), warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_match(svg_slots_txt, 'height="92.00"', fixed = TRUE)
  expect_match(svg_slots_txt, 'font-size="20.0"', fixed = TRUE)
  expect_match(svg_slots_txt, 'font-size="13.0"', fixed = TRUE)
  expect_match(svg_slots_txt, 'fill="#FFFFFF">35%</text>', fixed = TRUE)
  expect_match(svg_slots_txt, 'stroke-width="4.00"', fixed = TRUE)
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
