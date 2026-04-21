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
    prosecnur:::.default_box_cols(cols, labels, n = 2L, side = "top"),
    c("pct_3", "pct_4")
  )

  expect_identical(
    prosecnur:::.default_box_cols(cols, labels, n = 2L, side = "bottom"),
    c("pct_1", "pct_2")
  )

  labels_ns <- c(
    pct_1 = "Nunca",
    pct_2 = "A veces",
    pct_88 = "No sabe / No contesta",
    pct_99 = "SIN INF"
  )

  expect_identical(
    prosecnur:::.default_box_cols(names(labels_ns), labels_ns, n = 2L, side = "top"),
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

  p <- prosecnur::graficar_barras_apiladas(
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

  p <- prosecnur::graficar_barras_apiladas(
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
    umbral_etiqueta_peq = 0.01
  )

  text_layers <- Filter(function(layer) inherits(layer$geom, "GeomText"), p$layers)
  peq_layers <- Filter(function(layer) {
    "lab" %in% names(layer$data) &&
      identical(sort(as.character(layer$data$lab)), c("1%", "2%", "3%"))
  }, text_layers)

  expect_length(peq_layers, 1)

  peq_data <- peq_layers[[1]]$data[order(peq_layers[[1]]$data$x_center), , drop = FALSE]
  x_orig <- peq_data$x_center
  x_adj <- peq_data$x_label

  expect_true(any(abs(x_adj - x_orig) > 1e-6))
  expect_gt(min(diff(x_adj)), min(diff(x_orig)))
  expect_true(all(x_adj >= 0 & x_adj <= 1))
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

  p <- prosecnur::graficar_barras_apiladas(
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
  peq_layers <- Filter(function(layer) {
    "lab" %in% names(layer$data) &&
      identical(sort(as.character(layer$data$lab)), c("1%", "2%", "3%"))
  }, text_layers)

  expect_length(peq_layers, 1)
  expect_equal(peq_layers[[1]]$data$x_label, peq_layers[[1]]$data$x_center)
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

  p <- prosecnur::graficar_barras_apiladas(
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
  labels_por_layer <- lapply(text_layers, function(layer) sort(as.character(layer$data$lab)))
  todas_las_labels <- sort(unlist(labels_por_layer, use.names = FALSE))

  expect_equal(todas_las_labels, c("2.0%", "6.0%", "91.1%"))
  expect_false(any(todas_las_labels == "0.9%"))
  expect_true(any(vapply(labels_por_layer, identical, logical(1), c("2.0%"))))
  expect_true(any(vapply(labels_por_layer, identical, logical(1), c("6.0%", "91.1%"))))
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

  p <- prosecnur::graficar_barras_apiladas(
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

  text_layers <- Filter(function(layer) inherits(layer$geom, "GeomText"), p$layers)
  peq_layers <- Filter(function(layer) {
    "lab" %in% names(layer$data) &&
      identical(sort(as.character(layer$data$lab)), c("1%", "2%", "3%"))
  }, text_layers)

  expect_length(peq_layers, 1)

  peq_data <- peq_layers[[1]]$data[order(peq_layers[[1]]$data$x_center), , drop = FALSE]
  x_orig <- peq_data$x_center
  x_adj <- peq_data$x_label

  expect_true(any(abs(x_adj - x_orig) > 1e-6))
  expect_gt(min(diff(x_adj)), min(diff(x_orig)))
  expect_true(all(x_adj >= 0 & x_adj <= 1))
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

  p <- prosecnur::graficar_barras_apiladas(
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

test_that("graficar_barras_apiladas en modo uniforme empuja hacia adentro en borde izquierdo", {
  df <- data.frame(
    categoria = "Item",
    N = 100,
    pct_1 = 0.01,
    pct_2 = 0.02,
    pct_3 = 0.03,
    pct_4 = 0.94,
    stringsAsFactors = FALSE
  )

  p <- prosecnur::graficar_barras_apiladas(
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
  expect_gte(row_left$x_label, 0)
  expect_lte(row_left$x_label, 1)
  expect_gt(row_left$x_label, row_left$x_center)
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

  p <- prosecnur::graficar_barras_apiladas(
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
  expect_lt(row_right$x_label, row_right$x_center)
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

  p <- prosecnur::graficar_barras_apiladas(
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
    etiquetas_uniformes = TRUE
  )

  text_layers <- Filter(function(layer) inherits(layer$geom, "GeomText"), p$layers)
  layer_data <- text_layers[[1]]$data
  peq_data <- layer_data[layer_data$lab %in% c("1%", "2%", "3%"), , drop = FALSE]
  peq_data <- peq_data[order(peq_data$x_center), , drop = FALSE]

  expect_gt(min(diff(peq_data$x_label)), min(diff(peq_data$x_center)))
  expect_true(all(peq_data$x_label >= 0 & peq_data$x_label <= 1))
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

  p_default <- do.call(prosecnur::graficar_barras_apiladas, mk_args)
  p_legacy  <- do.call(prosecnur::graficar_barras_apiladas, c(mk_args, list(etiquetas_uniformes = FALSE)))

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
  w3 <- prosecnur:::.auto_bar_width_apiladas(3)
  w9 <- prosecnur:::.auto_bar_width_apiladas(9)
  w15 <- prosecnur:::.auto_bar_width_apiladas(15)
  w3_plain <- prosecnur:::.auto_bar_width_apiladas(3, usar_grupos_canvas = FALSE)
  w9_plain <- prosecnur:::.auto_bar_width_apiladas(9, usar_grupos_canvas = FALSE)

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
