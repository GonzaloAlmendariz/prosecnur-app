make_plan_ppt_fixture <- function() {
  df <- data.frame(
    p1 = c("Alto", "Medio", "Alto", "Bajo", "Medio", "Alto"),
    p2 = c("Alto", NA, NA, NA, NA, NA),
    p3 = c(NA, NA, NA, NA, NA, NA),
    region = c("Docentes", "Docentes", "Estudiantes", "Estudiantes", "Administrativos", "Administrativos"),
    stringsAsFactors = FALSE
  )

  attr(df$p1, "label") <- "Pregunta 1"
  attr(df$p2, "label") <- "Pregunta 2"
  attr(df$p3, "label") <- "Pregunta 3"
  attr(df$region, "label") <- "Region"

  survey <- data.frame(
    name = c("p1", "p2", "p3", "region"),
    type = c(
      "select_one lst_likert",
      "select_one lst_likert",
      "select_one lst_likert",
      "select_one lst_region"
    ),
    list_name = c("lst_likert", "lst_likert", "lst_likert", "lst_region"),
    stringsAsFactors = FALSE
  )

  choices <- data.frame(
    list_name = c(rep("lst_likert", 3), rep("lst_region", 3)),
    name = c("Bajo", "Medio", "Alto", "Docentes", "Estudiantes", "Administrativos"),
    label = c("Bajo", "Medio", "Alto", "Docentes", "Estudiantes", "Administrativos"),
    stringsAsFactors = FALSE
  )

  list(
    data = df,
    instrumento = list(survey = survey, choices = choices, orders_list = NULL),
    presets = p_presets(
      multi_apiladas = list(
        usar_canvas = TRUE,
        mostrar_leyenda = FALSE
      )
    )
  )
}

make_plan_ppt_fixture_multisource <- function() {
  est <- data.frame(
    p1 = c("Alto", "Medio", "Alto", "Bajo"),
    score = c(4, 3, 5, 2),
    stringsAsFactors = FALSE
  )
  doc <- data.frame(
    p1 = c("Medio", "Bajo", "Alto", "Medio"),
    score = c(3, 2, 4, 3),
    stringsAsFactors = FALSE
  )

  attr(est$p1, "label") <- "Pregunta comun"
  attr(doc$p1, "label") <- "Pregunta comun"
  attr(est$score, "label") <- "Puntaje"
  attr(doc$score, "label") <- "Puntaje"

  survey <- data.frame(
    name = c("p1", "score"),
    type = c("select_one lst_likert", "integer"),
    list_name = c("lst_likert", NA_character_),
    stringsAsFactors = FALSE
  )

  choices <- data.frame(
    list_name = rep("lst_likert", 3),
    name = c("Bajo", "Medio", "Alto"),
    label = c("Bajo", "Medio", "Alto"),
    stringsAsFactors = FALSE
  )

  inst <- list(survey = survey, choices = choices, orders_list = NULL)

  list(
    data = list(estudiantes = est, docentes = doc),
    instrumento = list(estudiantes = inst, docentes = inst),
    presets = p_presets(
      multi_apiladas = list(
        usar_canvas = TRUE,
        mostrar_leyenda = FALSE
      )
    )
  )
}

make_plan_ppt_fixture_var_cruce_multisource <- function() {
  est <- data.frame(
    p1 = c("Si", "No", "Si", "Si"),
    p2 = c("No", "No", "Si", "No"),
    stringsAsFactors = FALSE
  )
  doc <- data.frame(
    p1 = c("Si", "Si", "Si", "No"),
    p2 = c("Si", "Si", "No", "No"),
    stringsAsFactors = FALSE
  )
  adm <- data.frame(
    q1 = c("Si", "Si", "No", "Si"),
    q2 = c("No", "Si", "No", "Si"),
    stringsAsFactors = FALSE
  )

  attr(est$p1, "label") <- "Pregunta comun 1"
  attr(est$p2, "label") <- "Pregunta comun 2"
  attr(doc$p1, "label") <- "Pregunta comun 1"
  attr(doc$p2, "label") <- "Pregunta comun 2"
  attr(adm$q1, "label") <- "Pregunta comun 1"
  attr(adm$q2, "label") <- "Pregunta comun 2"

  survey_ed <- data.frame(
    name = c("p1", "p2"),
    type = c("select_one lst_si_no", "select_one lst_si_no"),
    list_name = c("lst_si_no", "lst_si_no"),
    stringsAsFactors = FALSE
  )

  survey_adm <- data.frame(
    name = c("q1", "q2"),
    type = c("select_one lst_si_no", "select_one lst_si_no"),
    list_name = c("lst_si_no", "lst_si_no"),
    stringsAsFactors = FALSE
  )

  choices <- data.frame(
    list_name = rep("lst_si_no", 2),
    name = c("Si", "No"),
    label = c("Si", "No"),
    stringsAsFactors = FALSE
  )

  list(
    data = list(estudiantes = est, docentes = doc, administrativos = adm),
    instrumento = list(
      estudiantes = list(survey = survey_ed, choices = choices, orders_list = NULL),
      docentes = list(survey = survey_ed, choices = choices, orders_list = NULL),
      administrativos = list(survey = survey_adm, choices = choices, orders_list = NULL)
    ),
    presets = p_presets(
      multi_apiladas = list(
        usar_canvas = TRUE,
        mostrar_leyenda = FALSE
      )
    )
  )
}

make_plan_ppt_fixture_var_cruce_equivalent_lists <- function() {
  est <- data.frame(
    p1 = c("1", "2", "3", "4"),
    stringsAsFactors = FALSE
  )
  adm <- data.frame(
    q1 = c("1", "2", "3", "4"),
    stringsAsFactors = FALSE
  )

  attr(est$p1, "label") <- "Pregunta comun"
  attr(adm$q1, "label") <- "Pregunta comun"

  survey_est <- data.frame(
    name = "p1",
    type = "select_one lst_p8",
    list_name = "lst_p8",
    stringsAsFactors = FALSE
  )

  survey_adm <- data.frame(
    name = "q1",
    type = "select_one lst_p6",
    list_name = "lst_p6",
    stringsAsFactors = FALSE
  )

  choices_est <- data.frame(
    list_name = rep("lst_p8", 5),
    name = c("1", "2", "3", "4", "99"),
    label = c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho", "SIN INF"),
    stringsAsFactors = FALSE
  )

  choices_adm <- data.frame(
    list_name = rep("lst_p6", 5),
    name = c("1", "2", "3", "4", "99"),
    label = c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho", "SIN INF"),
    stringsAsFactors = FALSE
  )

  list(
    data = list(estudiantes = est, administrativos = adm),
    instrumento = list(
      estudiantes = list(survey = survey_est, choices = choices_est, orders_list = NULL),
      administrativos = list(survey = survey_adm, choices = choices_adm, orders_list = NULL)
    ),
    presets = p_presets(
      multi_apiladas = list(
        usar_canvas = TRUE,
        mostrar_leyenda = FALSE
      )
    )
  )
}

make_plan_ppt_fixture_radar_multisource <- function() {
  est <- data.frame(
    q1 = c("3", "4", "4", "3", "4"),
    q2 = c("3", "3", "4", "4", "99"),
    q3 = c("4", "4", "3", "4", "3"),
    stringsAsFactors = FALSE
  )
  doc <- data.frame(
    p1 = c("4", "4", "3", "4", "4"),
    p2 = c("4", "3", "4", "4", "3"),
    p3 = c("3", "4", "4", "3", "4"),
    stringsAsFactors = FALSE
  )

  attr(est$q1, "label") <- "Aprendizaje autonomo"
  attr(est$q2, "label") <- "Pensamiento critico"
  attr(est$q3, "label") <- "Comunicacion eficaz"
  attr(doc$p1, "label") <- "Aprendizaje autonomo"
  attr(doc$p2, "label") <- "Pensamiento critico"
  attr(doc$p3, "label") <- "Comunicacion eficaz"

  survey_est <- data.frame(
    name = c("q1", "q2", "q3"),
    type = c("select_one lst_acuerdo_4", "select_one lst_acuerdo_4", "select_one lst_acuerdo_4"),
    list_name = c("lst_acuerdo_4", "lst_acuerdo_4", "lst_acuerdo_4"),
    stringsAsFactors = FALSE
  )

  survey_doc <- data.frame(
    name = c("p1", "p2", "p3"),
    type = c("select_one lst_acuerdo_4", "select_one lst_acuerdo_4", "select_one lst_acuerdo_4"),
    list_name = c("lst_acuerdo_4", "lst_acuerdo_4", "lst_acuerdo_4"),
    stringsAsFactors = FALSE
  )

  choices <- data.frame(
    list_name = rep("lst_acuerdo_4", 5),
    name = c("1", "2", "3", "4", "99"),
    label = c(
      "Totalmente en desacuerdo",
      "En desacuerdo",
      "De acuerdo",
      "Totalmente de acuerdo",
      "SIN INF"
    ),
    stringsAsFactors = FALSE
  )

  list(
    data = list(estudiantes = est, docentes = doc),
    instrumento = list(
      estudiantes = list(survey = survey_est, choices = choices, orders_list = NULL),
      docentes = list(survey = survey_doc, choices = choices, orders_list = NULL)
    ),
    presets = p_presets(
      radar_tabla = list(
        usar_canvas = TRUE,
        mostrar_tabla_derecha = TRUE
      )
    )
  )
}

render_var_cruce_plot <- function(vars, titulos_grupo = NULL) {
  fx <- make_plan_ppt_fixture()
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_barras_multiapiladas(
        modo = "var_cruce",
        vars = vars,
        cruces = "region",
        titulos_grupo = titulos_grupo
      )
    )
  )

  reporte_ppt_plan(
    data = fx$data,
    instrumento = fx$instrumento,
    plan = plan,
    presets = fx$presets,
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )$rendered[[1]]
}

render_var_cruce_multisource_plot <- function(vars, titulos_grupo = NULL, cruces = NULL) {
  fx <- make_plan_ppt_fixture_var_cruce_multisource()
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_barras_multiapiladas(
        modo = "var_cruce",
        vars = vars,
        cruces = cruces,
        titulos_grupo = titulos_grupo
      )
    )
  )

  reporte_ppt_plan(
    data = fx$data,
    instrumento = fx$instrumento,
    plan = plan,
    presets = fx$presets,
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )$rendered[[1]]
}

.ppt_plan_text_labels <- function(p) {
  gb <- ggplot2::ggplot_build(p)
  unique(unlist(lapply(gb$data, function(x) {
    hits <- character(0)
    for (nm in c("label", "lab", "text", "palabra")) {
      if (nm %in% names(x)) hits <- c(hits, as.character(x[[nm]]))
    }
    hits
  })))
}

test_that("p_barras_categoricas se renderiza desde el plan PPT", {
  fx <- make_plan_ppt_fixture()
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_barras_categoricas(
        "p1",
        mostrar_ceros = TRUE,
        overrides = list(
          mostrar_promedio = TRUE,
          formato_valor = "porcentaje_n"
        )
      )
    )
  )

  p <- reporte_ppt_plan(
    data = fx$data,
    instrumento = fx$instrumento,
    plan = plan,
    presets = p_presets(
      barras_categoricas = list(
        max_categorias = 10,
        colores_categorias = c(
          Bajo = "#CA5651",
          Medio = "#EFD25E",
          Alto = "#70AD47"
        )
      )
    ),
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )$rendered[[1]]

  datos <- attr(p, "pulso_barras_categoricas_data")
  expect_equal(nrow(datos), 3)
  expect_equal(sum(datos$n), 6)
  expect_equal(attr(p, "pulso_barras_categoricas_max_categorias"), 10)
  expect_true(all(c("Bajo", "Medio", "Alto") %in% datos$categoria))
})

test_that("p_barras_multiapiladas valida modo var_cruce", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  expect_error(
    p_barras_multiapiladas(modo = "var_cruce", cruces = "region"),
    "vars"
  )
  expect_error(
    p_barras_multiapiladas(modo = "var_cruce", vars = "p1"),
    "cruces"
  )
  expect_error(
    p_barras_multiapiladas(
      modo = "var_cruce",
      vars = "p1",
      cruces = "region",
      titulos_grupo = c("Titulo sin nombre")
    ),
    "nombrado"
  )

  el <- p_barras_multiapiladas(
    modo = "var_cruce",
    vars = c("p1", "p2"),
    cruces = "region",
    titulos_grupo = c(p1 = "Grupo 1", p2 = "Grupo 2")
  )

  expect_identical(el$modo, "var_cruce")
  expect_identical(el$cruce, "region")
  expect_identical(unname(el$titulos_grupo[c("p1", "p2")]), c("Grupo 1", "Grupo 2"))

  expect_error(
    p_barras_multiapiladas(
      modo = "var_cruce",
      vars = list(c("docentes$p1", "estudiantes$p1"))
    ),
    "lista nombrada"
  )

  expect_no_error(
    p_barras_multiapiladas(
      modo = "var_cruce",
      vars = list(
        mision = c("docentes$p1", "estudiantes$p1", "administrativos$q1")
      )
    )
  )
})

test_that("reporte_ppt_plan renderiza var_cruce y omite variables sin datos", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  p <- render_var_cruce_plot(
    vars = c("p1", "p2", "p3"),
    titulos_grupo = c(p1 = "Grupo 1", p2 = "Grupo 2", p3 = "Grupo 3")
  )

  gb <- ggplot2::ggplot_build(p)
  labels <- unique(unlist(lapply(gb$data, function(x) {
    if ("label" %in% names(x)) as.character(x$label) else character(0)
  })))

  expect_s3_class(p, "ggplot")
  expect_true(all(c("Grupo 1", "Grupo 2", "Docentes", "Estudiantes", "Administrativos") %in% labels))
  expect_false("Grupo 3" %in% labels)
})

test_that("var_cruce se ve bien cuando una variable solo tiene un nivel de cruce", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  p <- render_var_cruce_plot(
    vars = c("p2"),
    titulos_grupo = c(p2 = "Grupo 2")
  )

  gb <- ggplot2::ggplot_build(p)
  labels <- unique(unlist(lapply(gb$data, function(x) {
    if ("label" %in% names(x)) as.character(x$label) else character(0)
  })))

  expect_true(all(c("Grupo 2", "Docentes") %in% labels))
  expect_false(any(c("Estudiantes", "Administrativos") %in% labels))
})

test_that("reporte_ppt_plan devuelve blank canvas cuando todo queda vacio", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  p <- render_var_cruce_plot(vars = c("p3"))
  gb <- ggplot2::ggplot_build(p)

  expect_s3_class(p, "ggplot")
  expect_length(gb$data, 1L)
  expect_equal(nrow(gb$data[[1]]), 1L)
  expect_false(any(vapply(gb$data, function(x) "label" %in% names(x), logical(1))))
})

test_that("modos existentes siguen renderizando sin error", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  fx <- make_plan_ppt_fixture()

  plan_cruce <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_barras_multiapiladas(
        modo = "cruce",
        var = "p1",
        cruces = "region"
      )
    )
  )

  expect_no_error(
    reporte_ppt_plan(
      data = fx$data,
      instrumento = fx$instrumento,
      plan = plan_cruce,
      presets = fx$presets,
      solo_lista = TRUE,
      mensajes_progreso = FALSE
    )
  )
})

test_that("reporte_ppt_plan renderiza histograma apilado por grupo usando variable numerica cruda", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  dat <- data.frame(
    edad = c(25, 25, 26, 26, 27, 28, 28, 29),
    edad_recod = rep(c("25 a 26", "27 a 29"), each = 4),
    sexo = c("1", "2", "1", "2", "1", "1", "2", "2"),
    stringsAsFactors = FALSE
  )
  attr(dat$edad, "label") <- "Edad"
  attr(dat$sexo, "label") <- "Sexo"

  survey <- data.frame(
    name = c("edad", "edad_recod", "sexo"),
    type = c("integer", "select_one lst_edad", "select_one lst_sexo"),
    list_name = c(NA_character_, "lst_edad", "lst_sexo"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c(rep("lst_edad", 2), rep("lst_sexo", 2)),
    name = c("25 a 26", "27 a 29", "1", "2"),
    label = c("25 a 26", "27 a 29", "Hombres", "Mujeres"),
    stringsAsFactors = FALSE
  )

  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_histograma(
        "edad",
        grupo = "sexo",
        modo = "porcentaje_bin",
        ancho_bin = 2,
        overrides = list(
          mostrar_valores = TRUE,
          posicion_etiquetas = "cima",
          etiqueta_cima_modo = "porcentaje_grupo_conteos_grupo",
          etiqueta_cima_formato = "dos_lineas",
          abreviaturas_grupos = c("Hombres" = "H", "Mujeres" = "M"),
          mostrar_resumen_grupos_subtitulo = TRUE,
          prefijo_resumen_grupos_subtitulo = "Sexo: ",
          umbral_etiqueta = 0,
          usar_canvas = FALSE
        )
      )
    )
  )

  out <- reporte_ppt_plan(
    data = dat,
    instrumento = list(survey = survey, choices = choices, orders_list = NULL),
    plan = plan,
    presets = p_presets(histograma = list(modo = "porcentaje_bin", ancho_bin = 2)),
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  expect_length(out$rendered, 1L)
  expect_s3_class(out$rendered[[1]], "ggplot")
  hist_data <- attr(out$rendered[[1]], "pulso_histograma_data")
  expect_true(is.data.frame(hist_data))
  expect_true(any(grepl("^25", hist_data$.bin_label)))
  expect_setequal(as.character(hist_data$.grupo_label), c("Hombres", "Mujeres"))
  bin_sums <- stats::aggregate(.valor ~ .bin_label, hist_data[hist_data$n_bin > 0, , drop = FALSE], sum)
  expect_equal(bin_sums$.valor, rep(1, nrow(bin_sums)), tolerance = 1e-8)
  top_labels <- attr(out$rendered[[1]], "pulso_histograma_top_labels")
  expect_true(any(grepl("H 2\\(50%\\).*M 2\\(50%\\)", top_labels)))
  expect_equal(
    attr(out$rendered[[1]], "pulso_histograma_resumen_grupos"),
    "Sexo: Hombres 50% · Mujeres 50%"
  )
})

test_that("barras agrupadas oculta opciones 0 por defecto y permite mostrarlas", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  dat <- data.frame(
    q1 = c("A", "A", "B"),
    stringsAsFactors = FALSE
  )
  attr(dat$q1, "label") <- "Pregunta agrupada"

  inst <- list(
    survey = data.frame(
      name = "q1",
      type = "select_one lst_q",
      list_name = "lst_q",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = rep("lst_q", 3),
      name = c("A", "B", "C"),
      label = c("A", "B", "C"),
      stringsAsFactors = FALSE
    ),
    orders_list = list(
      q1 = list(
        names = c("A", "B", "C"),
        labels = c("A", "B", "C"),
        label = "Pregunta agrupada"
      )
    )
  )

  render_labels <- function(mostrar_ceros = NULL) {
    plan <- list(
      diapo_001 = p_slide_1_grafico(
        grafico = p_barras_agrupadas("q1", mostrar_ceros = mostrar_ceros)
      )
    )
    p <- reporte_ppt_plan(
      data = dat,
      instrumento = inst,
      plan = plan,
      presets = p_presets(
        barras_agrupadas = list(
          usar_canvas = TRUE,
          mostrar_leyenda = FALSE
        )
      ),
      solo_lista = TRUE,
      mensajes_progreso = FALSE
    )$rendered[[1]]

    unique(unlist(lapply(p$layers, function(layer) {
      if (is.data.frame(layer$data) && "text" %in% names(layer$data)) {
        as.character(layer$data$text)
      } else {
        character(0)
      }
    })))
  }

  labels_default <- render_labels()
  labels_with_zero <- render_labels(TRUE)

  expect_true(all(c("A", "B") %in% labels_default))
  expect_false("C" %in% labels_default)
  expect_true("C" %in% labels_with_zero)
})

test_that("objetivos educacionales se numeran como OE por orden visible", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  dat <- data.frame(
    oe1 = c("1", "2", "2", "1"),
    oe2 = c("2", "2", "1", "2"),
    region = c("Lima", "Lima", "Callao", "Callao"),
    stringsAsFactors = FALSE
  )
  attr(dat$oe1, "label") <- "Formula soluciones de ingenieria civil"
  attr(dat$oe2, "label") <- "Gestiona proyectos con enfoque sostenible"

  inst <- list(
    survey = data.frame(
      name = c("oe1", "oe2", "region"),
      type = c("select_one lst_oe", "select_one lst_oe", "select_one lst_region"),
      list_name = c("lst_oe", "lst_oe", "lst_region"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c(rep("lst_oe", 2), rep("lst_region", 2)),
      name = c("1", "2", "Lima", "Callao"),
      label = c("En desacuerdo", "De acuerdo", "Lima", "Callao"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )

  out_ppt <- tempfile(fileext = ".pptx")
  reporte_ppt_plan(
    data = dat,
    instrumento = inst,
    plan = list(
      diapo_001 = p_slide_1_grafico(
        titulo = "Objetivos Educacionales",
        grafico = p_barras_multiapiladas(
          modo = "var_cruce",
          vars = c("oe1", "oe2"),
          cruces = "region"
        )
      )
    ),
    presets = p_presets(multi_apiladas = list(usar_canvas = TRUE, mostrar_leyenda = FALSE)),
    path_ppt = out_ppt,
    mensajes_progreso = FALSE
  )

  slide_xml <- paste(readLines(unz(out_ppt, "ppt/slides/slide1.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_match(slide_xml, "OE 1: Formula soluciones de ingenieria", fixed = TRUE)
  expect_match(slide_xml, "OE 2: Gestiona proyectos con enfoque", fixed = TRUE)

  rendered <- reporte_ppt_plan(
    data = dat,
    instrumento = inst,
    plan = list(
      diapo_001 = p_slide_1_grafico(
        titulo = "Objetivos Educacionales",
        grafico = p_barras_multiapiladas(
          modo = "var_cruce",
          vars = c("oe1", "oe2"),
          cruces = "region"
        )
      )
    ),
    presets = p_presets(multi_apiladas = list(usar_canvas = TRUE, mostrar_leyenda = FALSE)),
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )
  labels <- gsub("\\s+", " ", .ppt_plan_text_labels(rendered$rendered[[1]]))
  expect_true("OE 1: Formula soluciones de ingenieria civil" %in% labels)
  expect_true("OE 2: Gestiona proyectos con enfoque sostenible" %in% labels)
})

test_that("objetivos educacionales continuan numeracion desde sufijo de variable", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  dat <- data.frame(
    p13_4 = c("3", "4", "4", "3"),
    p13_5 = c("4", "4", "3", "4"),
    stringsAsFactors = FALSE
  )
  attr(dat$p13_4, "label") <- "Contribuye a la creacion de empresas"
  attr(dat$p13_5, "label") <- "Reconoce responsabilidades eticas y profesionales"

  inst <- list(
    survey = data.frame(
      name = c("p13_4", "p13_5"),
      type = c("select_one lst_p13", "select_one lst_p13"),
      list_name = c("lst_p13", "lst_p13"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = rep("lst_p13", 2),
      name = c("3", "4"),
      label = c("3", "Totalmente util 4"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )

  out_ppt <- tempfile(fileext = ".pptx")
  reporte_ppt_plan(
    data = dat,
    instrumento = inst,
    plan = list(
      diapo_001 = p_slide_1_grafico(
        titulo = "Objetivos Educacionales",
        grafico = p_barras_multiapiladas(
          modo = "var",
          vars = c("p13_4", "p13_5"),
          titulo = "Objetivos educacionales de la carrera"
        )
      )
    ),
    presets = p_presets(multi_apiladas = list(usar_canvas = TRUE, mostrar_leyenda = FALSE)),
    path_ppt = out_ppt,
    mensajes_progreso = FALSE
  )

  slide_xml <- paste(readLines(unz(out_ppt, "ppt/slides/slide1.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_match(slide_xml, "OE 4: Contribuye a la creacion de empresas", fixed = TRUE)
  expect_match(slide_xml, "OE 5: Reconoce responsabilidades eticas", fixed = TRUE)
  expect_false(grepl("OE 1: Contribuye a la creacion de empresas", slide_xml, fixed = TRUE))
})

test_that("barras agrupadas excluyen egresados sin grado y recalculan porcentajes", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  dat <- data.frame(
    grado = c("bach", "bach", "sin"),
    stringsAsFactors = FALSE
  )
  attr(dat$grado, "label") <- "Grado alcanzado"

  inst <- list(
    survey = data.frame(
      name = "grado",
      type = "select_one lst_grado",
      list_name = "lst_grado",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = "lst_grado",
      name = c("bach", "sin"),
      label = c("Bachiller", "Egresado/a (Sin grado aún)"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )

  out <- reporte_ppt_plan(
    data = dat,
    instrumento = inst,
    plan = list(
      diapo_001 = p_slide_1_grafico(
        grafico = p_barras_agrupadas("grado")
      )
    ),
    presets = p_presets(
      barras_agrupadas = list(
        usar_canvas = TRUE,
        mostrar_leyenda = FALSE,
        excluir_opciones = c(
          "Egresados sin grado",
          "Egresado sin grado",
          "Egresada sin grado",
          "Egresado/a (Sin grado aún)",
          "Egresado/a (Sin grado aun)"
        )
      )
    ),
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  labels <- .ppt_plan_text_labels(out$rendered[[1]])
  expect_true("bach" %in% labels)
  expect_false("sin" %in% labels)
  expect_true("Base: 2 egresados" %in% labels)
})

test_that("reporte_ppt_plan inserta slide Otros como lista de respuestas abiertas", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  dat <- data.frame(
    p12 = c("1", "99", "99", "2", "1"),
    p12_other = c("", "PUENTES VERDES", "laboratorio vial", "", "texto fuera"),
    stringsAsFactors = FALSE
  )
  attr(dat$p12, "label") <- "Actividad preferida"

  inst <- list(
    survey = data.frame(
      name = c("p12", "p12_other"),
      type = c("select_one lst_p12", "text"),
      list_name = c("lst_p12", NA_character_),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = "lst_p12",
      name = c("1", "2", "99"),
      label = c("Talleres", "Visitas", "Otros"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )

  out <- reporte_ppt_plan(
    data = dat,
    instrumento = inst,
    plan = list(diapo_001 = p_slide_1_grafico(grafico = p_barras_agrupadas("p12"))),
    presets = p_presets(barras_agrupadas = list(usar_canvas = TRUE, mostrar_leyenda = FALSE)),
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  expect_length(out$plan, 2L)
  expect_identical(out$plan[[2]]$title, "Otros: Actividad preferida")
  expect_identical(out$plan[[2]]$.slide_type, "text_slide")

  txt <- out$plan[[2]]$slots$text
  expect_true(grepl("\u2022 Puentes verdes", txt, fixed = TRUE))
  expect_true(grepl("\u2022 Laboratorio vial", txt, fixed = TRUE))
  expect_false(grepl("texto fuera", txt, fixed = TRUE))
  expect_true(grepl("Base: 2 respuestas en Otros", txt, fixed = TRUE))

  out_off <- reporte_ppt_plan(
    data = dat,
    instrumento = inst,
    plan = list(diapo_001 = p_slide_1_grafico(grafico = p_barras_agrupadas("p12"))),
    presets = p_presets(barras_agrupadas = list(usar_canvas = TRUE, mostrar_leyenda = FALSE)),
    solo_lista = TRUE,
    auto_otros_slides = FALSE,
    mensajes_progreso = FALSE
  )
  expect_length(out_off$plan, 1L)
})

test_that("slide Otros paginada mantiene titulo sin contador entre parentesis", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  dat <- data.frame(
    p12 = rep("99", 45),
    p12_other = paste("respuesta abierta", seq_len(45)),
    stringsAsFactors = FALSE
  )
  attr(dat$p12, "label") <- "Actividad preferida"

  inst <- list(
    survey = data.frame(
      name = c("p12", "p12_other"),
      type = c("select_one lst_p12", "text"),
      list_name = c("lst_p12", NA_character_),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = "lst_p12",
      name = "99",
      label = "Otros",
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )

  out <- reporte_ppt_plan(
    data = dat,
    instrumento = inst,
    plan = list(diapo_001 = p_slide_1_grafico(grafico = p_barras_agrupadas("p12"))),
    presets = p_presets(barras_agrupadas = list(usar_canvas = TRUE, mostrar_leyenda = FALSE)),
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  expect_length(out$plan, 3L)
  expect_identical(out$plan[[2]]$title, "Otros: Actividad preferida")
  expect_identical(out$plan[[3]]$title, "Otros: Actividad preferida")
  expect_false(grepl("\\([0-9]+/[0-9]+\\)", out$plan[[2]]$title))
  expect_false(grepl("\\([0-9]+/[0-9]+\\)", out$plan[[3]]$title))
  expect_true(grepl("Base: 45 respuestas en Otros", out$plan[[2]]$slots$text, fixed = TRUE))
  expect_true(grepl("Base: 45 respuestas en Otros", out$plan[[3]]$slots$text, fixed = TRUE))
})

test_that("reporte_ppt_plan explica Otros agrupado por maximo de categorias", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  vals <- paste0("c", 1:12)
  ns <- c(30, 25, 20, 15, 8, 7, 6, 5, 4, 3, 2, 1)
  dat <- data.frame(
    puesto = rep(vals, ns),
    stringsAsFactors = FALSE
  )
  attr(dat$puesto, "label") <- "Puesto actual"

  inst <- list(
    survey = data.frame(
      name = "puesto",
      type = "select_one lst_puesto",
      list_name = "lst_puesto",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = "lst_puesto",
      name = vals,
      label = paste("Cargo", seq_along(vals)),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )

  out <- reporte_ppt_plan(
    data = dat,
    instrumento = inst,
    plan = list(diapo_001 = p_slide_1_grafico(grafico = p_barras_agrupadas("puesto"))),
    presets = p_presets(barras_agrupadas = list(
      usar_canvas = TRUE,
      mostrar_leyenda = FALSE,
      max_categorias = 5,
      agrupar_resto_en_otros = TRUE
    )),
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  expect_length(out$plan, 2L)
  expect_identical(out$plan[[2]]$title, "Otros: Puesto actual")
  expect_identical(out$plan[[2]]$meta$kind, "grouped_otros")

  txt <- out$plan[[2]]$slots$text
  expect_true(grepl("\u2022 Cargo 5 (8)", txt, fixed = TRUE))
  expect_true(grepl("\u2022 Cargo 12 (1)", txt, fixed = TRUE))
  expect_false(grepl("Cargo 1 (30)", txt, fixed = TRUE))
  expect_true(grepl("Base: 36 respuestas agrupadas en Otros", txt, fixed = TRUE))
})

test_that("slide Otros lista solo respuestas aun no categorizadas", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  dat <- data.frame(
    p12 = c("99", "99", "99", "1"),
    p12_recod = c("1", "99", "", ""),
    p12_other = c("ya categorizado", "queda otro", "sin recod", "texto fuera"),
    stringsAsFactors = FALSE
  )
  attr(dat$p12, "label") <- "Actividad preferida"

  inst <- list(
    survey = data.frame(
      name = c("p12", "p12_recod", "p12_other"),
      type = c("select_one lst_p12", "select_one lst_p12_recod", "text"),
      list_name = c("lst_p12", "lst_p12_recod", NA_character_),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c(rep("lst_p12", 2), rep("lst_p12_recod", 2)),
      name = c("1", "99", "1", "99"),
      label = c("Talleres", "Otros", "Talleres", "Otros"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )

  out <- reporte_ppt_plan(
    data = dat,
    instrumento = inst,
    plan = list(diapo_001 = p_slide_1_grafico(grafico = p_barras_agrupadas("p12"))),
    presets = p_presets(barras_agrupadas = list(usar_canvas = TRUE, mostrar_leyenda = FALSE)),
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  expect_length(out$plan, 2L)
  txt <- out$plan[[2]]$slots$text
  expect_false(grepl("ya categorizado", txt, fixed = TRUE))
  expect_true(grepl("\u2022 Queda otro", txt, fixed = TRUE))
  expect_true(grepl("\u2022 Sin recod", txt, fixed = TRUE))
  expect_false(grepl("texto fuera", txt, fixed = TRUE))
  expect_true(grepl("Base: 2 respuestas en Otros", txt, fixed = TRUE))
})

test_that("slide Otros (select_multiple) incluye a quien marco una opcion nombrada y Otros a la vez", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  # select_multiple recodificada, normalizada a columnas dummy
  # p12_recod.<code>. En una select_multiple marcar una opcion NOMBRADA (.1) y
  # "Otros" (.99) a la vez es valido (dos selecciones distintas). El detalle de
  # texto libre NO debe excluir a esa persona solo porque tambien marco una
  # nombrada: la exclusion depende de si "Otros" en si sigue marcado.
  dat <- data.frame(
    `p12_recod.1`  = c(1, 0, 1, 0),
    `p12_recod.99` = c(1, 1, 0, 0),
    p12_recod_other = c("combina ambos", "solo otros", "ya categorizado", "texto fuera"),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  attr(dat$`p12_recod.1`, "label") <- "Talleres"
  attr(dat$`p12_recod.99`, "label") <- "Otros"

  inst <- list(
    survey = data.frame(
      name = c("p12_recod", "p12_recod_other"),
      type = c("select_multiple lst_p12_recod", "text"),
      list_name = c("lst_p12_recod", NA_character_),
      label = c("Actividad preferida", NA_character_),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_p12_recod", "lst_p12_recod"),
      name = c("1", "99"),
      label = c("Talleres", "Otros"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )

  out <- reporte_ppt_plan(
    data = dat,
    instrumento = inst,
    plan = list(diapo_001 = p_slide_1_grafico(grafico = p_barras_agrupadas("p12_recod"))),
    presets = p_presets(barras_agrupadas = list(usar_canvas = TRUE, mostrar_leyenda = FALSE)),
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  expect_length(out$plan, 2L)
  txt <- out$plan[[2]]$slots$text
  # Persona 1: nombrada + Otros -> aparece (comportamiento corregido).
  expect_true(grepl("\u2022 Combina ambos", txt, fixed = TRUE))
  # Persona 2: solo Otros -> aparece.
  expect_true(grepl("\u2022 Solo otros", txt, fixed = TRUE))
  # Persona 3: solo la nombrada, sin Otros -> excluida.
  expect_false(grepl("ya categorizado", txt, fixed = TRUE))
  # Persona 4: no marco Otros -> excluida.
  expect_false(grepl("texto fuera", txt, fixed = TRUE))
  expect_true(grepl("Base: 2 respuestas en Otros", txt, fixed = TRUE))
})

test_that("slide Otros usa variable madre cuando la recodificada queda en Otros", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  dat <- data.frame(
    puesto = c("growth manager", "site reliability", "analista", "coordinador"),
    puesto_recod = c("99", "99", "1", "2"),
    stringsAsFactors = FALSE
  )
  attr(dat$puesto_recod, "label") <- "Puesto actual"

  inst <- list(
    survey = data.frame(
      name = c("puesto", "puesto_recod"),
      type = c("text", "select_one lst_puesto"),
      list_name = c(NA_character_, "lst_puesto"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = "lst_puesto",
      name = c("1", "2", "99"),
      label = c("Analista", "Coordinador", "Otros"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )

  out <- reporte_ppt_plan(
    data = dat,
    instrumento = inst,
    plan = list(diapo_001 = p_slide_1_grafico(
      grafico = p_barras_agrupadas("puesto_recod", titulo = "¿Cuál es su puesto actual?")
    )),
    presets = p_presets(barras_agrupadas = list(usar_canvas = TRUE, mostrar_leyenda = FALSE)),
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  expect_length(out$plan, 2L)
  expect_identical(out$plan[[2]]$title, "Otros: ¿Cuál es su puesto actual?")
  txt <- out$plan[[2]]$slots$text
  expect_true(grepl("\u2022 Growth manager", txt, fixed = TRUE))
  expect_true(grepl("\u2022 Site reliability", txt, fixed = TRUE))
  expect_false(grepl("analista", txt, fixed = TRUE))
  expect_false(grepl("coordinador", txt, fixed = TRUE))
  expect_true(grepl("Base: 2 respuestas en Otros", txt, fixed = TRUE))
})

test_that("slide Otros no se genera si el campo abierto esta vacio", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  dat <- data.frame(
    p12 = c("1", "99", "99"),
    p12_other = c("", " ", NA),
    stringsAsFactors = FALSE
  )
  attr(dat$p12, "label") <- "Actividad preferida"

  inst <- list(
    survey = data.frame(
      name = c("p12", "p12_other"),
      type = c("select_one lst_p12", "text"),
      list_name = c("lst_p12", NA_character_),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = "lst_p12",
      name = c("1", "99"),
      label = c("Talleres", "Otros"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )

  out <- reporte_ppt_plan(
    data = dat,
    instrumento = inst,
    plan = list(diapo_001 = p_slide_1_grafico(grafico = p_barras_agrupadas("p12"))),
    presets = p_presets(barras_agrupadas = list(usar_canvas = TRUE, mostrar_leyenda = FALSE)),
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  expect_length(out$plan, 1L)
})

test_that("slide Otros no se genera si el campo abierto queda vacio tras limpieza", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  dat <- data.frame(
    p12 = c("99", "99", "99"),
    p12_other = c("...", "https://example.com", "+51 999 999 999"),
    stringsAsFactors = FALSE
  )
  attr(dat$p12, "label") <- "Actividad preferida"

  inst <- list(
    survey = data.frame(
      name = c("p12", "p12_other"),
      type = c("select_one lst_p12", "text"),
      list_name = c("lst_p12", NA_character_),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = "lst_p12",
      name = "99",
      label = "Otros",
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )

  out <- reporte_ppt_plan(
    data = dat,
    instrumento = inst,
    plan = list(diapo_001 = p_slide_1_grafico(grafico = p_barras_agrupadas("p12"))),
    presets = p_presets(barras_agrupadas = list(usar_canvas = TRUE, mostrar_leyenda = FALSE)),
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  expect_length(out$plan, 1L)
})

test_that("slide Otros respeta fuente y filtros del grafico original", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  docentes <- data.frame(
    p12 = c("99", "99", "1"),
    p12_other = c("puentes costa", "laboratorio andino", ""),
    region = c("Lima", "Cusco", "Lima"),
    stringsAsFactors = FALSE
  )
  estudiantes <- data.frame(
    p12 = c("99", "1"),
    p12_other = c("texto estudiante", ""),
    region = c("Lima", "Lima"),
    stringsAsFactors = FALSE
  )
  attr(docentes$p12, "label") <- "Actividad preferida"
  attr(estudiantes$p12, "label") <- "Actividad preferida"

  survey <- data.frame(
    name = c("p12", "p12_other", "region"),
    type = c("select_one lst_p12", "text", "select_one lst_region"),
    list_name = c("lst_p12", NA_character_, "lst_region"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c(rep("lst_p12", 2), rep("lst_region", 2)),
    name = c("1", "99", "Lima", "Cusco"),
    label = c("Talleres", "Otros", "Lima", "Cusco"),
    stringsAsFactors = FALSE
  )
  inst <- list(survey = survey, choices = choices, orders_list = NULL)

  out <- reporte_ppt_plan(
    data = list(docentes = docentes, estudiantes = estudiantes),
    instrumento = list(docentes = inst, estudiantes = inst),
    plan = list(
      diapo_001 = p_slide_1_grafico(
        grafico = p_barras_agrupadas("docentes$p12", filtros = list(region = "Lima"))
      )
    ),
    presets = p_presets(barras_agrupadas = list(usar_canvas = TRUE, mostrar_leyenda = FALSE)),
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  expect_length(out$plan, 2L)
  expect_equal(out$plan[[2]]$meta$source, "docentes")
  txt <- out$plan[[2]]$slots$text
  expect_true(grepl("\u2022 Puentes costa", txt, fixed = TRUE))
  expect_false(grepl("laboratorio andino", txt, fixed = TRUE))
  expect_false(grepl("texto estudiante", txt, fixed = TRUE))
})

test_that("reporte_ppt_plan acepta referencias fuente$var en graficos simples", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  fx <- make_plan_ppt_fixture_multisource()

  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_barras_apiladas("estudiantes$p1")
    )
  )

  out <- reporte_ppt_plan(
    data = fx$data,
    instrumento = fx$instrumento,
    plan = plan,
    presets = fx$presets,
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  expect_length(out$rendered, 1L)
  expect_s3_class(out$rendered[[1]], "ggplot")
})

test_that("reporte_ppt_plan permite dos graficos de fuentes distintas en una slide", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  fx <- make_plan_ppt_fixture_multisource()

  plan <- list(
    diapo_001 = p_slide_2_graficos(
      izquierda = p_barras_apiladas("estudiantes$p1"),
      derecha = p_barras_apiladas("docentes$p1")
    )
  )

  out <- reporte_ppt_plan(
    data = fx$data,
    instrumento = fx$instrumento,
    plan = plan,
    presets = fx$presets,
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  expect_length(out$rendered, 2L)
  expect_true(all(vapply(out$rendered, inherits, logical(1), what = "ggplot")))
})

test_that("multiapiladas modo var compara fuentes usando etiquetas de fuente cuando el titulo se repite", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  fx <- make_plan_ppt_fixture_multisource()

  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_barras_multiapiladas(
        modo = "var",
        vars = c("estudiantes$p1", "docentes$p1")
      )
    )
  )

  p <- reporte_ppt_plan(
    data = fx$data,
    instrumento = fx$instrumento,
    plan = plan,
    presets = fx$presets,
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )$rendered[[1]]

  gb <- ggplot2::ggplot_build(p)
  labels <- unique(unlist(lapply(gb$data, function(x) {
    if ("label" %in% names(x)) as.character(x$label) else character(0)
  })))

  expect_true(all(c("Estudiantes", "Docentes") %in% labels))
})

test_that("reporte_ppt_plan exige fuente explicita cuando hay varias bases y la referencia es ambigua", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  fx <- make_plan_ppt_fixture_multisource()

  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_barras_apiladas("p1")
    )
  )

  expect_error(
    reporte_ppt_plan(
      data = fx$data,
      instrumento = fx$instrumento,
      plan = plan,
      presets = fx$presets,
      solo_lista = TRUE,
      mensajes_progreso = FALSE
    ),
    "prefijo `fuente\\$`"
  )
})

test_that("var_cruce permite varias fuentes cuando vars se define por bloques nombrados", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  p <- render_var_cruce_multisource_plot(
    vars = list(
      mision = c("docentes$p1", "estudiantes$p1", "administrativos$q1"),
      consulta = c("docentes$p2", "estudiantes$p2", "administrativos$q2")
    ),
    titulos_grupo = c(
      mision = "Conoce la mision",
      consulta = "Sabe donde consultar"
    )
  )

  gb <- ggplot2::ggplot_build(p)
  labels <- unique(unlist(lapply(gb$data, function(x) {
    if ("label" %in% names(x)) as.character(x$label) else character(0)
  })))

  expect_s3_class(p, "ggplot")
  expect_true(all(c(
    "Conoce la mision", "Sabe donde consultar",
    "Docentes", "Estudiantes", "Administrativos"
  ) %in% labels))
})

test_that("var_cruce multi-fuente hace fallback si falta un titulo de bloque", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  expect_no_error({
    p <- render_var_cruce_multisource_plot(
      vars = list(
        mision = c("docentes$p1", "estudiantes$p1", "administrativos$q1"),
        consulta = c("docentes$p2", "estudiantes$p2", "administrativos$q2")
      ),
      titulos_grupo = c(mision = "Conoce la mision")
    )
    expect_s3_class(p, "ggplot")
  })
})

test_that("var_cruce multi-fuente no acepta cruces explicito", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  expect_error(
    render_var_cruce_multisource_plot(
      vars = list(
        mision = c("docentes$p1", "estudiantes$p1", "administrativos$q1")
      ),
      cruces = "region"
    ),
    "`cruces` debe ser NULL"
  )
})

test_that("var_cruce acepta listas equivalentes aunque el list_name difiera", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  fx <- make_plan_ppt_fixture_var_cruce_equivalent_lists()

  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_barras_multiapiladas(
        modo = "var_cruce",
        vars = list(
          sat = c("estudiantes$p1", "administrativos$q1")
        ),
        titulos_grupo = c(sat = "Satisfaccion")
      )
    )
  )

  expect_no_error({
    out <- reporte_ppt_plan(
      data = fx$data,
      instrumento = fx$instrumento,
      plan = plan,
      presets = fx$presets,
      solo_lista = TRUE,
      mensajes_progreso = FALSE
    )
    expect_true(inherits(out$rendered[[1]], "ggplot"))
  })
})

test_that("var_cruce multi-fuente convive con title y section en el log del plan", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  fx <- make_plan_ppt_fixture_var_cruce_multisource()

  plan <- list(
    diapo_001 = p_slide_portada(
      titulo = "Titulo",
      subtitulo = "Subtitulo",
      fecha = "Marzo 2026"
    ),
    diapo_002 = p_slide_seccion(
      titulo = "Seccion"
    ),
    diapo_003 = p_slide_1_grafico(
      grafico = p_barras_multiapiladas(
        modo = "var_cruce",
        vars = list(
          mision = c("docentes$p1", "estudiantes$p1", "administrativos$q1"),
          consulta = c("docentes$p2", "estudiantes$p2", "administrativos$q2")
        ),
        titulos_grupo = c(
          mision = "Conoce la mision",
          consulta = "Sabe donde consultar"
        )
      )
    )
  )

  expect_no_error({
    out <- reporte_ppt_plan(
      data = fx$data,
      instrumento = fx$instrumento,
      plan = plan,
      presets = fx$presets,
      solo_lista = TRUE,
      mensajes_progreso = FALSE
    )
    expect_equal(nrow(out$log), 3L)
    expect_true(inherits(out$rendered[[1]], "ggplot"))
  })
})

test_that("top2box y bottom2box excluyen categorias especiales por defecto", {
  cols <- c("pct_1", "pct_2", "pct_3", "pct_4", "pct_99")
  labels <- c(
    pct_1 = "Totalmente en desacuerdo",
    pct_2 = "En desacuerdo",
    pct_3 = "De acuerdo",
    pct_4 = "Totalmente de acuerdo",
    pct_99 = "SIN INF"
  )

  expect_identical(
    prosecnurapp:::.default_box_cols(cols, labels, n = 2L, side = "top"),
    c("pct_3", "pct_4")
  )

  expect_identical(
    prosecnurapp:::.default_box_cols(cols, labels, n = 2L, side = "bottom"),
    c("pct_1", "pct_2")
  )

  labels_ns <- c(
    pct_1 = "Nunca",
    pct_2 = "A veces",
    pct_88 = "No sabe / No contesta",
    pct_99 = "SIN INF"
  )

  expect_identical(
    prosecnurapp:::.default_box_cols(names(labels_ns), labels_ns, n = 2L, side = "top"),
    c("pct_1", "pct_2")
  )
})

test_that("graficar_barras_apiladas acepta 'valores' como alias de 'porcentajes' en negrita", {
  df <- data.frame(
    categoria = "Item",
    N = 100,
    pct_1 = 0.6,
    pct_2 = 0.4,
    stringsAsFactors = FALSE
  )

  p <- prosecnurapp::graficar_barras_apiladas(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2"),
    etiquetas_grupos = c(pct_1 = "Si", pct_2 = "No"),
    mostrar_valores = TRUE,
    textos_negrita = c("valores")
  )

  text_layers <- Filter(function(layer) inherits(layer$geom, "GeomText"), p$layers)
  expect_true(length(text_layers) >= 1)
  expect_true(all(vapply(text_layers, function(layer) identical(layer$aes_params$fontface, "bold"), logical(1))))
})

.min_span_gap_apiladas <- function(layer_data) {
  widths <- .estimate_label_fit_width_apiladas(layer_data$lab, layer_data$.size_label)
  span_left <- layer_data$x_label - layer_data$.hjust_label * widths
  span_right <- layer_data$x_label + (1 - layer_data$.hjust_label) * widths
  ord <- order(span_left)
  min(span_left[ord][-1] - span_right[ord][-length(ord)])
}

.min_visual_span_gap_apiladas <- function(layer_data, width_factor = 1.35) {
  widths <- .estimate_label_width_apiladas(layer_data$lab, layer_data$.size_label) * width_factor
  span_left <- layer_data$x_label - layer_data$.hjust_label * widths
  span_right <- layer_data$x_label + (1 - layer_data$.hjust_label) * widths
  ord <- order(span_left)
  min(span_left[ord][-1] - span_right[ord][-length(ord)])
}

test_that("graficar_barras_apiladas separa horizontalmente etiquetas pequenas", {
  df <- data.frame(
    categoria = "Item",
    N = 100,
    pct_1 = 0.01,
    pct_2 = 0.02,
    pct_3 = 0.03,
    pct_4 = 0.94,
    stringsAsFactors = FALSE
  )

  p <- prosecnurapp::graficar_barras_apiladas(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2", "pct_3", "pct_4"),
    etiquetas_grupos = c(
      pct_1 = "1",
      pct_2 = "2",
      pct_3 = "3",
      pct_4 = "94"
    ),
    mostrar_valores = TRUE,
    decimales = 0,
    umbral_etiqueta = 0.50,
    umbral_etiqueta_peq = 0.01,
    size_texto_barras = 6.4,
    size_texto_barras_peq = 6.4
  )

  text_layers <- Filter(function(layer) inherits(layer$geom, "GeomText"), p$layers)
  expect_length(text_layers, 1)

  layer_data <- text_layers[[1]]$data
  expect_setequal(as.character(layer_data$lab), c("1%", "2%", "3%", "94%"))
  expect_false(any(layer_data$.label_fuera))

  row_1 <- layer_data[layer_data$lab == "1%", , drop = FALSE]
  expect_false(row_1$.label_fuera)
  expect_gte(row_1$x_label, 0)
  expect_lte(row_1$x_label, 1)
  expect_equal(row_1$.col_label, "white")

  row_2 <- layer_data[layer_data$lab == "2%", , drop = FALSE]
  row_3 <- layer_data[layer_data$lab == "3%", , drop = FALSE]
  expect_false(row_2$.label_fuera)
  expect_false(row_3$.label_fuera)
  expect_equal(row_2$.col_label, "white")
  expect_equal(row_3$.col_label, "white")
  expect_gte(row_2$x_label, 0)
  expect_lte(row_2$x_label, 1)
  expect_gte(row_3$x_label, 0)
  expect_lte(row_3$x_label, 1)
  expect_gt(.min_span_gap_apiladas(layer_data), 0.006)
  expect_true(all(layer_data$x_label >= -0.20 & layer_data$x_label <= 1))
})

test_that("apiladas sube solo etiquetas que no caben y mantiene dentro las que entran", {
  df_lab <- data.frame(
    categoria = rep("Item", 4),
    lab = c("1%", "2%", "16%", "81%"),
    .lab_arriba = c("1% (2)", "2% (4)", "16% (29)", "81% (147)"),
    .label_fuera = c(TRUE, FALSE, FALSE, FALSE),
    .size_label = rep(6.4, 4),
    x_left = c(0, 0.01, 0.03, 0.19),
    x_right = c(0.01, 0.03, 0.19, 1),
    x_center = c(0.005, 0.02, 0.11, 0.595),
    x_label = c(0.005, 0.02, 0.11, 0.595),
    .hjust_label = rep(0.5, 4),
    .y_plot = rep(1, 4),
    .grupo = c("1 Nada", "2", "3", "4 Totalmente"),
    .col_label = rep("white", 4),
    stringsAsFactors = FALSE
  )

  colores <- c(
    "1 Nada" = "#CA5651",
    "2" = "#EFD25E",
    "3" = "#ADD198",
    "4 Totalmente" = "#70AD47"
  )

  out <- prosecnurapp:::.posicionar_labels_arriba_si_no_caben_apiladas(
    df_lab,
    var_categoria = "categoria",
    usar_y_numerico = TRUE,
    grosor_eff = 0.70,
    fit_padding = 0.003,
    etiquetas_peq_padding = 0.012,
    color_texto_barras_fuera = "#081F5C",
    colores_grupos = colores,
    offset_y = 0.13
  )

  expect_identical(out$.label_arriba, c(TRUE, FALSE, FALSE, FALSE))
  expect_identical(out$.label_fuera, c(TRUE, FALSE, FALSE, FALSE))
  expect_equal(out$lab, c("1% (2)", "2%", "16%", "81%"))
  expect_gt(out$y_label[1], out$.y_plot[1])
  expect_equal(out$y_label[-1], out$.y_plot[-1])
  expect_equal(out$.col_label, c("#081F5C", "white", "white", "white"))
  expect_equal(out$.col_conector[1], unname(colores[out$.grupo[1]]))
  expect_equal(out$x_conector_label[1], out$x_label[1])
  expect_true(all(is.finite(out$x_conector_label[1])))
  expect_true(all(is.finite(out$x_conector_barra[1])))
  expect_true(out$y_conector_label[1] > out$y_conector_barra[1])
  expect_true(all(is.na(out$x_conector_label[-1])))
  expect_true(all(is.na(out$x_conector_barra[-1])))

  out_azul <- prosecnurapp:::.posicionar_labels_arriba_si_no_caben_apiladas(
    df_lab,
    var_categoria = "categoria",
    usar_y_numerico = TRUE,
    grosor_eff = 0.70,
    fit_padding = 0.003,
    etiquetas_peq_padding = 0.012,
    color_texto_barras_fuera = "#081F5C",
    colores_grupos = colores,
    color_conectores_etiquetas = "azul_pulso",
    offset_y = 0.13
  )

  expect_equal(out_azul$.col_conector[1], "#081F5C")
  expect_equal(out_azul$.col_conector[-1], rep("#081F5C", 3))

  out_izq <- prosecnurapp:::.posicionar_labels_arriba_si_no_caben_apiladas(
    df_lab,
    var_categoria = "categoria",
    usar_y_numerico = TRUE,
    grosor_eff = 0.70,
    fit_padding = 0.003,
    etiquetas_peq_padding = 0.012,
    color_texto_barras_fuera = "#081F5C",
    colores_grupos = colores,
    posicion_conector_etiquetas = "izquierda",
    offset_y = 0.13
  )

  expect_lt(out_izq$x_conector_label[1], out_izq$x_label[1])
  expect_equal(out_izq$x_conector_barra[1], out_izq$x_center[1])
})

test_that("apiladas expone color y grosor de conectores como argumentos publicos", {
  fml <- formals(prosecnurapp::graficar_barras_apiladas)
  expect_equal(eval(fml$color_conectores_etiquetas), c("segmento", "azul_pulso"))
  expect_equal(eval(fml$posicion_conector_etiquetas), c("centro", "izquierda", "derecha"))
  expect_equal(eval(fml$linewidth_conectores_etiquetas), 0.32)

  body_txt <- paste(deparse(body(prosecnurapp::graficar_barras_apiladas)), collapse = "\n")
  expect_true(grepl("linewidth = linewidth_conectores_etiquetas", body_txt, fixed = TRUE))
  expect_true(grepl("color_conectores_etiquetas = color_conectores_etiquetas", body_txt, fixed = TRUE))
  expect_true(grepl("posicion_conector_etiquetas = posicion_conector_etiquetas", body_txt, fixed = TRUE))
})

test_that("apiladas mide la etiqueta completa con frecuencia antes de dejarla dentro", {
  width_10 <- prosecnurapp:::.estimate_label_fit_width_apiladas("10% (13)", 5.6)
  width_16 <- prosecnurapp:::.estimate_label_fit_width_apiladas("16% (21)", 5.6)
  width_pct <- prosecnurapp:::.estimate_label_fit_width_apiladas("10%", 5.6)

  expect_gt(width_10, 0.13)
  expect_lt(width_16, 0.16)
  expect_lt(width_pct, 0.10)
  expect_gt(width_10, width_pct)
})

test_that("graficar_barras_apiladas permite desactivar repulsion de etiquetas pequenas", {
  df <- data.frame(
    categoria = "Item",
    N = 100,
    pct_1 = 0.01,
    pct_2 = 0.02,
    pct_3 = 0.03,
    pct_4 = 0.94,
    stringsAsFactors = FALSE
  )

  p <- prosecnurapp::graficar_barras_apiladas(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2", "pct_3", "pct_4"),
    etiquetas_grupos = c(
      pct_1 = "1",
      pct_2 = "2",
      pct_3 = "3",
      pct_4 = "94"
    ),
    mostrar_valores = TRUE,
    decimales = 0,
    umbral_etiqueta = 0.50,
    umbral_etiqueta_peq = 0.01,
    repeler_etiquetas_peq = FALSE
  )

  text_layers <- Filter(function(layer) inherits(layer$geom, "GeomText"), p$layers)
  expect_length(text_layers, 1)
  layer_data <- text_layers[[1]]$data
  peq_data <- layer_data[layer_data$lab %in% c("1%", "2%", "3%"), , drop = FALSE]

  row_1 <- peq_data[peq_data$lab == "1%", , drop = FALSE]
  expect_equal(nrow(row_1), 1)
  expect_false(row_1$.label_fuera)
  expect_gte(row_1$x_label, 0)
  expect_lte(row_1$x_label, 1)
  expect_equal(row_1$.col_label, "white")

  row_2 <- peq_data[peq_data$lab == "2%", , drop = FALSE]
  row_3 <- peq_data[peq_data$lab == "3%", , drop = FALSE]
  expect_false(row_2$.label_fuera)
  expect_equal(row_2$.col_label, "white")
  expect_gte(row_2$x_label, 0)
  expect_lte(row_2$x_label, 1)
  expect_false(row_3$.label_fuera)
  expect_equal(row_3$.col_label, "white")
})

test_that("graficar_barras_apiladas admite umbrales explicitos de mostrar y tamano normal", {
  df <- data.frame(
    categoria = "Item",
    N = 100,
    pct_1 = 0.009,
    pct_2 = 0.02,
    pct_3 = 0.06,
    pct_4 = 0.911,
    stringsAsFactors = FALSE
  )

  p <- prosecnurapp::graficar_barras_apiladas(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2", "pct_3", "pct_4"),
    etiquetas_grupos = c(
      pct_1 = "0.9",
      pct_2 = "2.0",
      pct_3 = "6.0",
      pct_4 = "91.1"
    ),
    mostrar_valores = TRUE,
    decimales = 1,
    umbral_mostrar_etiqueta = 0.01,
    umbral_etiqueta_normal = 0.05
  )

  text_layers <- Filter(function(layer) inherits(layer$geom, "GeomText"), p$layers)
  layer_data <- dplyr::bind_rows(lapply(text_layers, function(layer) layer$data))
  todas_las_labels <- sort(as.character(layer_data$lab))

  expect_equal(todas_las_labels, c("0.9%", "2.0%", "6.0%", "91.1%"))
  expect_true(all(layer_data[layer_data$lab %in% c("0.9%", "2.0%"), ".tamano_etq"] == "peq"))
  expect_true(all(layer_data[layer_data$lab %in% c("6.0%", "91.1%"), ".tamano_etq"] == "grande"))

  row_09 <- layer_data[layer_data$lab == "0.9%", , drop = FALSE]
  expect_equal(nrow(row_09), 1)
  expect_false(row_09$.label_fuera)
  expect_gte(row_09$x_label, 0)
  expect_lte(row_09$x_label, 1)
  expect_equal(row_09$.col_label, "white")
})

test_that("graficar_barras_apiladas repela etiquetas pequenas con umbrales explicitos", {
  df <- data.frame(
    categoria = "Item",
    N = 100,
    pct_1 = 0.01,
    pct_2 = 0.02,
    pct_3 = 0.03,
    pct_4 = 0.94,
    stringsAsFactors = FALSE
  )

  p <- prosecnurapp::graficar_barras_apiladas(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2", "pct_3", "pct_4"),
    etiquetas_grupos = c(
      pct_1 = "1",
      pct_2 = "2",
      pct_3 = "3",
      pct_4 = "94"
    ),
    mostrar_valores = TRUE,
    decimales = 0,
    umbral_mostrar_etiqueta = 0.01,
    umbral_etiqueta_normal = 0.05,
    size_texto_barras = 6.4,
    size_texto_barras_peq = 6.4
  )

  text_layers <- Filter(function(layer) inherits(layer$geom, "GeomText"), p$layers)
  expect_length(text_layers, 1)

  layer_data <- text_layers[[1]]$data
  expect_setequal(as.character(layer_data$lab), c("1%", "2%", "3%", "94%"))
  expect_false(any(layer_data$.label_fuera))

  row_1 <- layer_data[layer_data$lab == "1%", , drop = FALSE]
  expect_false(row_1$.label_fuera)
  expect_gte(row_1$x_label, 0)
  expect_lte(row_1$x_label, 1)
  expect_equal(row_1$.col_label, "white")

  row_2 <- layer_data[layer_data$lab == "2%", , drop = FALSE]
  row_3 <- layer_data[layer_data$lab == "3%", , drop = FALSE]
  expect_false(row_2$.label_fuera)
  expect_false(row_3$.label_fuera)
  expect_equal(row_2$.col_label, "white")
  expect_equal(row_3$.col_label, "white")
  expect_gt(.min_span_gap_apiladas(layer_data), 0.006)
  expect_true(all(layer_data$x_label >= -0.20 & layer_data$x_label <= 1))
})

test_that("graficar_barras_apiladas activa modo uniforme con una sola capa de etiquetas", {
  df <- data.frame(
    categoria = "Item",
    N = 100,
    pct_1 = 0.01,
    pct_2 = 0.02,
    pct_3 = 0.03,
    pct_4 = 0.94,
    stringsAsFactors = FALSE
  )

  p <- prosecnurapp::graficar_barras_apiladas(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2", "pct_3", "pct_4"),
    etiquetas_grupos = c(
      pct_1 = "1",
      pct_2 = "2",
      pct_3 = "3",
      pct_4 = "94"
    ),
    mostrar_valores = TRUE,
    decimales = 0,
    umbral_mostrar_etiqueta = 0.01,
    umbral_etiqueta_normal = 0.05,
    size_texto_barras = 4,
    etiquetas_uniformes = TRUE
  )

  text_layers <- Filter(function(layer) inherits(layer$geom, "GeomText"), p$layers)
  expect_length(text_layers, 1)
  layer_data <- text_layers[[1]]$data

  expect_setequal(as.character(layer_data$lab), c("1%", "2%", "3%", "94%"))
  expect_true(all(layer_data$.size_label == 4))
  expect_false(".tamano_etq" %in% names(layer_data))
})

test_that("graficar_barras_apiladas en modo uniforme mantiene dentro el borde izquierdo si cabe", {
  df <- data.frame(
    categoria = "Item",
    N = 100,
    pct_1 = 0.01,
    pct_2 = 0.02,
    pct_3 = 0.03,
    pct_4 = 0.94,
    stringsAsFactors = FALSE
  )

  p <- prosecnurapp::graficar_barras_apiladas(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2", "pct_3", "pct_4"),
    etiquetas_grupos = c(
      pct_1 = "1",
      pct_2 = "2",
      pct_3 = "3",
      pct_4 = "94"
    ),
    mostrar_valores = TRUE,
    decimales = 0,
    umbral_mostrar_etiqueta = 0.01,
    umbral_etiqueta_normal = 0.05,
    etiquetas_uniformes = TRUE,
    etiquetas_peq_confinadas = TRUE
  )

  text_layers <- Filter(function(layer) inherits(layer$geom, "GeomText"), p$layers)
  layer_data <- text_layers[[1]]$data
  row_left <- layer_data[layer_data$lab == "1%", , drop = FALSE]

  expect_equal(nrow(row_left), 1)
  expect_false(row_left$.label_fuera)
  expect_gte(row_left$x_label, 0)
  expect_lte(row_left$x_label, 1)
  expect_equal(row_left$.col_label, "white")
})

test_that("graficar_barras_apiladas en modo uniforme empuja hacia adentro en borde derecho", {
  df <- data.frame(
    categoria = "Item",
    N = 100,
    pct_1 = 0.94,
    pct_2 = 0.03,
    pct_3 = 0.02,
    pct_4 = 0.01,
    stringsAsFactors = FALSE
  )

  p <- prosecnurapp::graficar_barras_apiladas(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2", "pct_3", "pct_4"),
    etiquetas_grupos = c(
      pct_1 = "94",
      pct_2 = "3",
      pct_3 = "2",
      pct_4 = "1"
    ),
    mostrar_valores = TRUE,
    decimales = 0,
    umbral_mostrar_etiqueta = 0.01,
    umbral_etiqueta_normal = 0.05,
    etiquetas_uniformes = TRUE,
    etiquetas_peq_confinadas = TRUE
  )

  text_layers <- Filter(function(layer) inherits(layer$geom, "GeomText"), p$layers)
  layer_data <- text_layers[[1]]$data
  row_right <- layer_data[layer_data$lab == "1%", , drop = FALSE]

  expect_equal(nrow(row_right), 1)
  expect_gte(row_right$x_label, 0)
  expect_lte(row_right$x_label, 1)
  expect_false(row_right$.label_fuera)
  expect_equal(row_right$.col_label, "white")
  width_right <- .estimate_label_fit_width_apiladas(row_right$lab, row_right$.size_label)
  expect_lte(row_right$x_label + (1 - row_right$.hjust_label) * width_right, 1)
})

test_that("graficar_barras_apiladas en modo uniforme aumenta separacion minima entre etiquetas", {
  df <- data.frame(
    categoria = "Item",
    N = 100,
    pct_1 = 0.01,
    pct_2 = 0.02,
    pct_3 = 0.03,
    pct_4 = 0.94,
    stringsAsFactors = FALSE
  )

  p <- prosecnurapp::graficar_barras_apiladas(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2", "pct_3", "pct_4"),
    etiquetas_grupos = c(
      pct_1 = "1",
      pct_2 = "2",
      pct_3 = "3",
      pct_4 = "94"
    ),
    mostrar_valores = TRUE,
    decimales = 0,
    umbral_mostrar_etiqueta = 0.01,
    umbral_etiqueta_normal = 0.05,
    etiquetas_uniformes = TRUE,
    size_texto_barras = 6.4
  )

  text_layers <- Filter(function(layer) inherits(layer$geom, "GeomText"), p$layers)
  layer_data <- text_layers[[1]]$data
  row_1 <- layer_data[layer_data$lab == "1%", , drop = FALSE]
  expect_false(row_1$.label_fuera)
  expect_gte(row_1$x_label, 0)
  expect_lte(row_1$x_label, 1)
  expect_equal(row_1$.col_label, "white")
  expect_gt(.min_span_gap_apiladas(layer_data), 0.006)
  expect_true(all(layer_data$x_label >= -0.20 & layer_data$x_label <= 1))
})

test_that("graficar_barras_apiladas en modo uniforme saca solo etiquetas que no entran", {
  df <- data.frame(
    categoria = "Item",
    N = 100,
    pct_1 = 0.01,
    pct_2 = 0.02,
    pct_3 = 0.16,
    pct_4 = 0.81,
    stringsAsFactors = FALSE
  )

  p <- prosecnurapp::graficar_barras_apiladas(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2", "pct_3", "pct_4"),
    etiquetas_grupos = c(
      pct_1 = "1",
      pct_2 = "2",
      pct_3 = "16",
      pct_4 = "81"
    ),
    mostrar_valores = TRUE,
    decimales = 0,
    umbral_mostrar_etiqueta = 0,
    umbral_etiqueta_normal = 0.05,
    etiquetas_uniformes = TRUE,
    color_texto_barras = "white",
    color_texto_barras_fuera = "#081F5C",
    size_texto_barras = 6.4
  )

  text_layers <- Filter(function(layer) inherits(layer$geom, "GeomText"), p$layers)
  layer_data <- text_layers[[1]]$data
  expect_setequal(as.character(layer_data$lab), c("1%", "2%", "16%", "81%"))
  expect_false(any(layer_data$.label_fuera))

  row_1 <- layer_data[layer_data$lab == "1%", , drop = FALSE]
  expect_false(row_1$.label_fuera)
  expect_gte(row_1$x_label, 0)
  expect_lte(row_1$x_label, 1)
  expect_equal(row_1$.col_label, "white")

  row_2 <- layer_data[layer_data$lab == "2%", , drop = FALSE]
  expect_false(row_2$.label_fuera)
  expect_gte(row_2$x_label, 0)
  expect_lte(row_2$x_label, 1)
  expect_equal(row_2$.col_label, "white")

  rows_inside <- layer_data[layer_data$lab %in% c("16%", "81%"), , drop = FALSE]
  expect_false(any(rows_inside$.label_fuera))
  expect_true(all(rows_inside$.col_label == "white"))
  expect_gt(.min_span_gap_apiladas(layer_data), 0.006)
  expect_gt(.min_visual_span_gap_apiladas(layer_data), 0.006)
})

test_that("graficar_barras_apiladas evita superposicion cerca de segmentos pequenos consecutivos", {
  mk_layer <- function(vals) {
    df <- data.frame(categoria = "Item", N = 100, stringsAsFactors = FALSE)
    for (i in seq_along(vals)) df[[paste0("pct_", i)]] <- vals[i]

    p <- prosecnurapp::graficar_barras_apiladas(
      data = df,
      var_categoria = "categoria",
      var_n = "N",
      cols_porcentaje = paste0("pct_", seq_along(vals)),
      etiquetas_grupos = stats::setNames(
        as.character(round(vals * 100)),
        paste0("pct_", seq_along(vals))
      ),
      mostrar_valores = TRUE,
      decimales = 0,
      umbral_mostrar_etiqueta = 0,
      umbral_etiqueta_normal = 0.05,
      etiquetas_uniformes = TRUE,
      color_texto_barras = "white",
      color_texto_barras_fuera = "#081F5C",
      size_texto_barras = 6.4
    )

    Filter(function(layer) inherits(layer$geom, "GeomText"), p$layers)[[1]]$data
  }

  layer_16 <- mk_layer(c(0.01, 0.02, 0.16, 0.81))
  row_16 <- layer_16[layer_16$lab == "16%", , drop = FALSE]
  expect_false(row_16$.label_fuera)
  expect_gte(row_16$x_label, 0)
  expect_lte(row_16$x_label, 1)
  expect_equal(row_16$.col_label, "white")
  expect_gt(.min_visual_span_gap_apiladas(layer_16), 0.006)

  layer_21 <- mk_layer(c(0.01, 0.03, 0.21, 0.75))
  row_21 <- layer_21[layer_21$lab == "21%", , drop = FALSE]
  expect_false(row_21$.label_fuera)
  expect_gte(row_21$x_label, 0)
  expect_lte(row_21$x_label, 1)
  expect_equal(row_21$.col_label, "white")
  expect_gt(.min_visual_span_gap_apiladas(layer_21), 0.006)
})

test_that("graficar_barras_apiladas mantiene dentro porcentajes pequenos que caben", {
  mk_plot <- function(vals, labs) {
    df <- data.frame(categoria = "Item", N = 100, stringsAsFactors = FALSE)
    for (i in seq_along(vals)) df[[paste0("pct_", i)]] <- vals[i]

    prosecnurapp::graficar_barras_apiladas(
      data = df,
      var_categoria = "categoria",
      var_n = "N",
      cols_porcentaje = paste0("pct_", seq_along(vals)),
      etiquetas_grupos = stats::setNames(as.character(labs), paste0("pct_", seq_along(vals))),
      mostrar_valores = TRUE,
      decimales = 0,
      umbral_mostrar_etiqueta = 0.12,
      umbral_etiqueta_normal = 0.085,
      etiquetas_uniformes = TRUE,
      size_texto_barras = 6.4,
      color_texto_barras = "white",
      color_texto_barras_fuera = "#081F5C",
      etiquetas_peq_factor_ancho = 2.5,
      etiquetas_peq_padding = 0.012
    )
  }

  p_oe_1 <- mk_plot(c(0.05, 0.20, 0.75), c(1, 2, 3))
  layer_oe_1 <- Filter(function(layer) inherits(layer$geom, "GeomText"), p_oe_1$layers)[[1]]$data
  row_5 <- layer_oe_1[layer_oe_1$lab == "5%", , drop = FALSE]
  expect_false(row_5$.label_fuera)
  expect_equal(row_5$.col_label, "white")
  expect_gte(row_5$x_label, row_5$x_left)
  expect_lte(row_5$x_label, row_5$x_right)

  p_oe_2 <- mk_plot(c(0.09, 0.27, 0.64), c(1, 2, 3))
  layer_oe_2 <- Filter(function(layer) inherits(layer$geom, "GeomText"), p_oe_2$layers)[[1]]$data
  row_9 <- layer_oe_2[layer_oe_2$lab == "9%", , drop = FALSE]
  expect_false(row_9$.label_fuera)
  expect_equal(row_9$.col_label, "white")
  expect_gte(row_9$x_label, row_9$x_left)
  expect_lte(row_9$x_label, row_9$x_right)
})

test_that("graficar_barras_apiladas modera layout canvas con una sola barra", {
  p <- prosecnurapp::graficar_barras_apiladas(
    data = data.frame(
      categoria = "Item",
      N = 100,
      pct_1 = 0.04,
      pct_2 = 0.57,
      pct_3 = 0.39,
      stringsAsFactors = FALSE
    ),
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2", "pct_3"),
    etiquetas_grupos = c(pct_1 = "1", pct_2 = "2", pct_3 = "3"),
    usar_canvas = TRUE,
    mostrar_valores = TRUE,
    etiquetas_uniformes = TRUE,
    color_texto_barras = "white",
    color_texto_barras_fuera = "#081F5C",
    size_texto_barras = 6.4,
    size_barra_extra = 16,
    grosor_modo = "manual",
    grosor_barras = 0.70,
    mostrar_leyenda = FALSE
  )

  layout <- attr(p, "pulso_barras_apiladas_layout")
  expect_equal(layout$n_categorias, 1)
  expect_equal(layout$y_axis_max, 2)
  expect_equal(layout$grosor_eff, 0.70)
})

test_that("graficar_barras_apiladas compacta la leyenda manual al centro", {
  p <- prosecnurapp::graficar_barras_apiladas(
    data = data.frame(
      categoria = "Item",
      N = 100,
      pct_1 = 0.05,
      pct_2 = 0.20,
      pct_3 = 0.25,
      pct_4 = 0.50,
      stringsAsFactors = FALSE
    ),
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2", "pct_3", "pct_4"),
    etiquetas_grupos = c(
      pct_1 = "1 Nada competente",
      pct_2 = "2",
      pct_3 = "3",
      pct_4 = "4 Totalmente competente"
    ),
    colores_grupos = c(
      "1 Nada competente" = "#CA5651",
      "2" = "#EFD25E",
      "3" = "#ADD198",
      "4 Totalmente competente" = "#70AD47"
    ),
    usar_canvas = TRUE,
    mostrar_valores = FALSE,
    mostrar_leyenda = TRUE,
    legend_n_por_fila = 4,
    legend_gap_npc = 0.012,
    legend_key_cm = 0.40,
    size_leyenda = 16
  )

  legend <- attr(p, "pulso_barras_apiladas_layout")$legend_manual
  expect_s3_class(legend, "data.frame")
  expect_equal(nrow(legend), 4)

  row_w <- max(legend$x_item_right) - min(legend$x_left)
  expect_gt(row_w, 0.52)
  expect_lt(row_w, 0.78)
  expect_gt(min(legend$x_left), 0.10)
  expect_lt(max(legend$x_item_right), 0.90)
  expect_gt(min(legend$key_height), 0.02)
  expect_gt(min(legend$key_width), 0.02)
  expect_equal(legend$key_marker, rep("point_square", 4))
  expect_true(all(is.finite(legend$key_size_mm)))
  expect_gte(min(legend$key_size_mm), 2.4)
  expect_equal(
    legend$key_width_physical_in,
    legend$key_height_physical_in,
    tolerance = 1e-8
  )

  p_compuesto <- prosecnurapp::graficar_barras_apiladas(
    data = data.frame(
      categoria = "Item",
      N = 100,
      pct_1 = 0.05,
      pct_2 = 0.20,
      pct_3 = 0.25,
      pct_4 = 0.50,
      stringsAsFactors = FALSE
    ),
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2", "pct_3", "pct_4"),
    etiquetas_grupos = c(
      pct_1 = "1 Nada competente",
      pct_2 = "2",
      pct_3 = "3",
      pct_4 = "4 Totalmente competente"
    ),
    colores_grupos = c(
      "1 Nada competente" = "#CA5651",
      "2" = "#EFD25E",
      "3" = "#ADD198",
      "4 Totalmente competente" = "#70AD47"
    ),
    usar_canvas = TRUE,
    mostrar_valores = FALSE,
    mostrar_leyenda = TRUE,
    legend_n_por_fila = 4,
    legend_gap_npc = 0.012,
    legend_key_cm = 0.40,
    legend_key_aspect_yx = 0.30,
    size_leyenda = 16
  )

  legend_compuesto <- attr(p_compuesto, "pulso_barras_apiladas_layout")$legend_manual
  expect_equal(legend_compuesto$key_marker, rep("point_square", 4))
  expect_equal(legend_compuesto$key_aspect_yx, rep(0.30, 4), tolerance = 1e-8)
  expect_equal(
    legend_compuesto$key_square_width_unit,
    legend_compuesto$key_square_height_unit,
    tolerance = 1e-8
  )
})

test_that("graficar_barras_apiladas mantiene comportamiento legacy con etiquetas_uniformes = FALSE", {
  df <- data.frame(
    categoria = "Item",
    N = 100,
    pct_1 = 0.01,
    pct_2 = 0.02,
    pct_3 = 0.03,
    pct_4 = 0.94,
    stringsAsFactors = FALSE
  )

  mk_args <- list(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2", "pct_3", "pct_4"),
    etiquetas_grupos = c(
      pct_1 = "1",
      pct_2 = "2",
      pct_3 = "3",
      pct_4 = "94"
    ),
    mostrar_valores = TRUE,
    decimales = 0,
    umbral_mostrar_etiqueta = 0.01,
    umbral_etiqueta_normal = 0.05
  )

  p_default <- do.call(prosecnurapp::graficar_barras_apiladas, mk_args)
  p_legacy  <- do.call(prosecnurapp::graficar_barras_apiladas, c(mk_args, list(etiquetas_uniformes = FALSE)))

  extract_labels <- function(p) {
    text_layers <- Filter(function(layer) inherits(layer$geom, "GeomText"), p$layers)
    out <- do.call(rbind, lapply(text_layers, function(layer) {
      layer$data[, c("lab", "x_center", "x_label"), drop = FALSE]
    }))
    out[order(out$lab, out$x_center), , drop = FALSE]
  }

  expect_equal(extract_labels(p_default), extract_labels(p_legacy))
})

test_that("slide_1 agrega subtitulo y base automatica multi-fuente en orden de data", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  est <- data.frame(p1 = c("Si", "No", "Si"), stringsAsFactors = FALSE)
  doc <- data.frame(p1 = c("Si", "Si"), stringsAsFactors = FALSE)
  adm <- data.frame(q1 = c("No", "Si", "No", "Si"), stringsAsFactors = FALSE)

  attr(est$p1, "label") <- "Pregunta"
  attr(doc$p1, "label") <- "Pregunta"
  attr(adm$q1, "label") <- "Pregunta"

  survey_ed <- data.frame(
    name = "p1",
    type = "select_one lst_si_no",
    list_name = "lst_si_no",
    stringsAsFactors = FALSE
  )
  survey_ad <- data.frame(
    name = "q1",
    type = "select_one lst_si_no",
    list_name = "lst_si_no",
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = rep("lst_si_no", 2),
    name = c("Si", "No"),
    label = c("Si", "No"),
    stringsAsFactors = FALSE
  )

  plan <- list(
    diapo_001 = p_slide_1_grafico(
      titulo = "Titulo",
      subtitulo = "Subtitulo demo",
      grafico = p_barras_multiapiladas(
        modo = "var_cruce",
        vars = list(
          grupo = c("docentes$p1", "estudiantes$p1", "administrativos$q1")
        ),
        titulos_grupo = c(grupo = "Grupo")
      )
    )
  )

  path_ppt <- tempfile(fileext = ".pptx")
  expect_no_error(
    reporte_ppt_plan(
      data = list(
        docentes = doc,
        estudiantes = est,
        administrativos = adm
      ),
      instrumento = list(
        docentes = list(survey = survey_ed, choices = choices, orders_list = NULL),
        estudiantes = list(survey = survey_ed, choices = choices, orders_list = NULL),
        administrativos = list(survey = survey_ad, choices = choices, orders_list = NULL)
      ),
      plan = plan,
      path_ppt = path_ppt,
      solo_lista = FALSE,
      mensajes_progreso = FALSE
    )
  )

  sum_ppt <- officer::pptx_summary(officer::read_pptx(path_ppt))
  texts <- sum_ppt$text

  expect_true("Subtitulo demo" %in% texts)
  expect_true("Base: 2 docentes, 3 estudiantes y 4 administrativos" %in% texts)
})

test_that("auto_bar_width_apiladas modera pocas categorias y sostiene muchas", {
  w3 <- prosecnurapp:::.auto_bar_width_apiladas(3)
  w9 <- prosecnurapp:::.auto_bar_width_apiladas(9)
  w15 <- prosecnurapp:::.auto_bar_width_apiladas(15)
  w3_plain <- prosecnurapp:::.auto_bar_width_apiladas(3, usar_grupos_canvas = FALSE)
  w9_plain <- prosecnurapp:::.auto_bar_width_apiladas(9, usar_grupos_canvas = FALSE)

  expect_true(w3 < w9)
  expect_true(w9 < w15)
  expect_true(w3 >= 0.68 && w3 <= 0.72)
  expect_true(w9 >= 0.70 && w9 <= 0.74)
  expect_true(w3_plain < w3)
  expect_true(w9_plain < w9)
})

test_that("graficar_barras_apiladas invierte tambien las etiquetas del eje Y", {
  df <- data.frame(
    categoria = c("a", "b", "c"),
    N = c(10, 10, 10),
    pct_1 = c(0.5, 0.5, 0.5),
    pct_2 = c(0.5, 0.5, 0.5),
    stringsAsFactors = FALSE
  )

  axis_text_order <- function(invertir_barras) {
    p <- graficar_barras_apiladas(
      data = df,
      var_categoria = "categoria",
      var_n = "N",
      cols_porcentaje = c("pct_1", "pct_2"),
      etiquetas_grupos = c(pct_1 = "Si", pct_2 = "No"),
      usar_canvas = TRUE,
      exportar = "rplot",
      mostrar_barra_extra = FALSE,
      debug_ph_bordes = FALSE,
      font_family = "sans",
      invertir_barras = invertir_barras
    )

    txt_layers <- Filter(function(layer) {
      inherits(layer$geom, "GeomText") &&
        is.data.frame(layer$data) &&
        "text" %in% names(layer$data) &&
        "y" %in% names(layer$data)
    }, p$layers)

    txt_df <- dplyr::bind_rows(lapply(txt_layers, function(layer) layer$data))
    txt_df <- txt_df[txt_df$text %in% df$categoria, c("text", "y"), drop = FALSE]
    txt_df <- txt_df[order(txt_df$y, decreasing = TRUE), , drop = FALSE]
    txt_df$text
  }

  expect_equal(axis_text_order(FALSE), c("a", "b", "c"))
  expect_equal(axis_text_order(TRUE), c("c", "b", "a"))
})

test_that("p_barras_multiapiladas acepta modo multilista", {
  el <- p_barras_multiapiladas(
    modo = "multilista",
    bloques = list(
      list(
        modo = "var",
        vars = c("q1", "q2")
      ),
      list(
        modo = "var",
        vars = c("q3")
      )
    )
  )

  expect_s3_class(el, "ppt_element")
  expect_identical(el$modo, "multilista")
  expect_length(el$bloques, 2L)
  expect_null(el$bloques[[1]]$title_slide)
  expect_identical(el$bloques[[1]]$overrides$titulo, "")
  expect_identical(el$bloques[[1]]$overrides$subtitulo, "")
})

test_that("reporte_ppt_plan renderiza multilista con escalas distintas", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  dat <- data.frame(
    q1 = c("1", "3", "4", "3", "4", "3"),
    q2 = c("2", "3", "4", "4", "3", "99"),
    q3 = c("Si", "No", "Si", "Si", "No", "No"),
    stringsAsFactors = FALSE
  )
  attr(dat$q1, "label") <- "Pregunta acuerdo 1"
  attr(dat$q2, "label") <- "Pregunta acuerdo 2"
  attr(dat$q3, "label") <- "Pregunta si/no"

  survey <- data.frame(
    name = c("q1", "q2", "q3"),
    type = c(
      "select_one lst_acuerdo_4",
      "select_one lst_acuerdo_4",
      "select_one lst_si_no"
    ),
    list_name = c("lst_acuerdo_4", "lst_acuerdo_4", "lst_si_no"),
    stringsAsFactors = FALSE
  )

  choices <- data.frame(
    list_name = c(
      rep("lst_acuerdo_4", 5),
      rep("lst_si_no", 2)
    ),
    name = c("1", "2", "3", "4", "99", "Si", "No"),
    label = c(
      "Totalmente en desacuerdo",
      "En desacuerdo",
      "De acuerdo",
      "Totalmente de acuerdo",
      "SIN INF",
      "Si",
      "No"
    ),
    stringsAsFactors = FALSE
  )

  plan <- list(
    diapo_001 = p_slide_1_grafico(
      titulo = "Titulo",
      grafico = p_barras_multiapiladas(
        modo = "multilista",
        bloques = list(
          list(
            modo = "var",
            vars = c("q1", "q2"),
            overrides = list(
              barra_extra_preset = "top2box",
              mostrar_barra_extra = TRUE
            )
          ),
          list(
            modo = "var",
            vars = c("q3")
          )
        )
      )
    )
  )

  expect_no_error(
    reporte_ppt_plan(
      data = dat,
      instrumento = list(survey = survey, choices = choices, orders_list = NULL),
      plan = plan,
      solo_lista = TRUE,
      mensajes_progreso = FALSE
    )
  )
})

test_that("p_radar_tabla modo box acepta vars como lista multi-fuente", {
  fx <- make_plan_ppt_fixture_radar_multisource()

  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_radar_tabla(
        modo = "box",
        vars = list(
          "Aprendizaje autónomo y adaptabilidad" = c("docentes$p1", "estudiantes$q1"),
          "Pensamiento crítico y creativo" = c("docentes$p2", "estudiantes$q2"),
          "Comunicación eficaz" = c("docentes$p3", "estudiantes$q3")
        ),
        box_labels = c("De acuerdo", "Totalmente de acuerdo"),
        titulo_tabla = "Top Two Box",
        colores_series = c(
          "Docentes" = "#062A63",
          "Estudiantes" = "#E67E22"
        )
      )
    )
  )

  expect_no_error(
    reporte_ppt_plan(
      data = fx$data,
      instrumento = fx$instrumento,
      presets = fx$presets,
      plan = plan,
      solo_lista = TRUE,
      mensajes_progreso = FALSE
    )
  )
})

test_that("reporte_ppt_plan usa frecuencias solo en barras agrupadas", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  dat <- data.frame(
    p1 = c("1", "1", "2", "2", "2"),
    stringsAsFactors = FALSE
  )
  attr(dat$p1, "label") <- "Pregunta"

  inst <- list(
    survey = data.frame(
      name = "p1",
      type = "select_one likert",
      list_name = "likert",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = rep("likert", 2),
      name = c("1", "2"),
      label = c("Nada util", "Totalmente util"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )

  plan <- list(
    diapo_001 = p_slide_1_grafico(grafico = p_barras_apiladas("p1")),
    diapo_002 = p_slide_1_grafico(grafico = p_barras_agrupadas("p1"))
  )

  out_ppt <- tempfile(fileext = ".pptx")
  reporte_ppt_plan(
    data = dat,
    instrumento = inst,
    plan = plan,
    presets = p_presets(
      barras_apiladas = list(
        usar_canvas = FALSE,
        mostrar_barra_extra = FALSE,
        etiquetas_uniformes = TRUE
      ),
      barras_agrupadas = list(
        usar_canvas = FALSE,
        mostrar_barra_extra = FALSE
      )
    ),
    path_ppt = out_ppt,
    mensajes_progreso = FALSE
  )

  slide_dir <- tempfile("ppt_slides_")
  dir.create(slide_dir)
  unzip(out_ppt, files = c("ppt/slides/slide1.xml", "ppt/slides/slide2.xml"), exdir = slide_dir)
  slide1_xml <- paste(readLines(file.path(slide_dir, "ppt/slides/slide1.xml"), warn = FALSE), collapse = " ")
  slide2_xml <- paste(readLines(file.path(slide_dir, "ppt/slides/slide2.xml"), warn = FALSE), collapse = " ")

  expect_true(grepl("40%", slide1_xml, fixed = TRUE))
  expect_true(grepl("60%", slide1_xml, fixed = TRUE))
  expect_false(grepl("40% (2)", slide1_xml, fixed = TRUE))
  expect_false(grepl("60% (3)", slide1_xml, fixed = TRUE))

  expect_true(grepl("40% (2)", slide2_xml, fixed = TRUE))
  expect_true(grepl("60% (3)", slide2_xml, fixed = TRUE))
})
