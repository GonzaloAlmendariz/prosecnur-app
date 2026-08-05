source("setup-load-all.R")

.actor_base_inst <- function(var, list_name, codes, labels) {
  list(
    survey = data.frame(
      name = var,
      type = paste("select_one", list_name),
      list_name = list_name,
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = list_name,
      name = codes,
      label = labels,
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )
}

.actor_base_data <- function(var, n, codes) {
  out <- data.frame(
    value = rep(codes, length.out = n),
    stringsAsFactors = FALSE
  )
  names(out) <- var
  out
}

.actor_base_plot_text <- function(plot) {
  unlist(lapply(plot$layers, function(layer) {
    layer_data <- layer$data
    if (is.data.frame(layer_data) && "text" %in% names(layer_data)) {
      as.character(layer_data$text)
    } else {
      character(0)
    }
  }), use.names = FALSE)
}

test_that("caption por actor conserva los N efectivos de cuatro fuentes", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  sat_codes <- c("1", "2", "3", "4")
  sat_labels <- c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho")
  yes_codes <- c("Si", "No")

  data <- list(
    administrativos = .actor_base_data("sat", 12, sat_codes),
    docentes = .actor_base_data("sat", 24, sat_codes),
    egresados = .actor_base_data("conoce", 165, yes_codes),
    estudiantes = .actor_base_data("conoce", 178, yes_codes)
  )
  instrumento <- list(
    administrativos = .actor_base_inst("sat", "sat4", sat_codes, sat_labels),
    docentes = .actor_base_inst("sat", "sat4", sat_codes, sat_labels),
    egresados = .actor_base_inst("conoce", "sino", yes_codes, c("Si", "No")),
    estudiantes = .actor_base_inst("conoce", "sino", yes_codes, c("Si", "No"))
  )
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_barras_multiapiladas(
        modo = "multilista",
        bloques = list(
          list(
            modo = "var_cruce",
            vars = list(satisfaccion = c("administrativos$sat", "docentes$sat")),
            titulos_grupo = c(satisfaccion = "Satisfaccion")
          ),
          list(
            modo = "var_cruce",
            vars = list(conocimiento = c("egresados$conoce", "estudiantes$conoce")),
            titulos_grupo = c(conocimiento = "Conocimiento")
          )
        )
      )
    )
  )

  path <- tempfile(fileext = ".pptx")
  expect_no_error(reporte_ppt_plan(
    data = data,
    instrumento = instrumento,
    plan = plan,
    path_ppt = path,
    mensajes_progreso = FALSE
  ))
  slide_xml <- paste(
    readLines(unz(path, "ppt/slides/slide1.xml"), warn = FALSE, encoding = "UTF-8"),
    collapse = "\n"
  )

  # Doctrina B36/G-17: los captions por bloque estan apagados por defecto —
  # la Base vive en el placeholder del SLIDE (prorrateada global).
  expect_false(grepl("Base: Administrativos (12) y Docentes (24)", slide_xml, fixed = TRUE))
  expect_false(grepl("Base: Egresados (165) y Estudiantes (178)", slide_xml, fixed = TRUE))
  expect_match(slide_xml, "Base: ", fixed = TRUE)
  expect_false(grepl("12-24 egresados", slide_xml, fixed = TRUE))
  expect_false(grepl("165-178 egresados", slide_xml, fixed = TRUE))

  word_meta <- reporte_ppt_plan(
    data = data,
    instrumento = instrumento,
    plan = plan,
    solo_lista = TRUE,
    build_render_meta = TRUE,
    mensajes_progreso = FALSE
  )$render_meta
  # B52/W-4: Word usa la MISMA base prorrateada que el slide PPT; el caption
  # por actor («Administrativos (12) y …») es solo fallback.
  expect_equal(
    vapply(word_meta, `[[`, character(1), "base"),
    c(
      "Base: 12 administrativos y 24 docentes",
      "Base: 165 egresados y 178 estudiantes"
    )
  )
})

test_that("caption por actor usa rango por variable sin sumar", {
  expect_equal(
    .format_actor_base_caption(
      c("administrativos", "administrativos", "docentes"),
      c(12, 24, 18)
    ),
    "Base: Administrativos (12-24 según variable) y Docentes (18)"
  )
})

test_that("modo var cualificado conserva actor y rango efectivo", {
  administrativos <- data.frame(
    q1 = c(rep(c("Si", "No"), 6), rep(NA_character_, 12)),
    q2 = rep(c("Si", "No"), 12),
    stringsAsFactors = FALSE
  )
  docentes <- data.frame(
    q1 = c(rep(c("Si", "No"), 9), rep(NA_character_, 6)),
    stringsAsFactors = FALSE
  )
  inst_adm <- .actor_base_inst("q1", "sino", c("Si", "No"), c("Si", "No"))
  inst_adm$survey <- rbind(
    inst_adm$survey,
    data.frame(
      name = "q2",
      type = "select_one sino",
      list_name = "sino",
      stringsAsFactors = FALSE
    )
  )
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_barras_multiapiladas(
        modo = "var",
        vars = c("administrativos$q1", "administrativos$q2", "docentes$q1")
      )
    )
  )

  out <- reporte_ppt_plan(
    data = list(administrativos = administrativos, docentes = docentes),
    instrumento = list(
      administrativos = inst_adm,
      docentes = .actor_base_inst("q1", "sino", c("Si", "No"), c("Si", "No"))
    ),
    plan = plan,
    solo_lista = TRUE,
    build_render_meta = TRUE,
    mensajes_progreso = FALSE
  )

  expected <- "Base: Administrativos (12-24 según variable) y Docentes (18)"
  # Doctrina B36/G-17: el caption ya no viaja dentro del grafico.
  expect_false(expected %in% .actor_base_plot_text(out$rendered[[1]]))
  # B52/W-4: cada bloque Word rotula su base con el formato prorrateado por
  # fuente del PPT (reporte multifuente => «N fuente»), no el actor-caption.
  # B56/W-8: q1 tiene no-respuesta (12 y 18 validas de 24), asi que su base
  # reducida declara el criterio; q2 responde completo y queda sin marca.
  expect_equal(
    vapply(out$render_meta, `[[`, character(1), "base"),
    c(
      "Base: 12 administrativos (respuestas válidas)",
      "Base: 24 administrativos",
      "Base: 18 docentes (respuestas válidas)"
    )
  )
})

test_that("refs no cualificadas usan un fallback neutral", {
  data <- data.frame(
    q1 = c(rep(c("Si", "No"), 6), rep(NA_character_, 4)),
    q2 = rep(c("Si", "No"), 8),
    stringsAsFactors = FALSE
  )
  instrumento <- .actor_base_inst("q1", "sino", c("Si", "No"), c("Si", "No"))
  instrumento$survey <- rbind(
    instrumento$survey,
    data.frame(
      name = "q2",
      type = "select_one sino",
      list_name = "sino",
      stringsAsFactors = FALSE
    )
  )
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_barras_multiapiladas(modo = "var", vars = c("q1", "q2"))
    )
  )

  out <- reporte_ppt_plan(
    data = data,
    instrumento = instrumento,
    plan = plan,
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )
  labels <- .actor_base_plot_text(out$rendered[[1]])

  # Doctrina B36/G-17: la base prorrateada vive en el slide, no en el plot.
  expect_false("Base: 12-16 respuestas" %in% labels)
  expect_null(attr(out$rendered[[1]], "pulso_actor_base_caption", exact = TRUE))
})
