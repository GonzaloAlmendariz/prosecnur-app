source("setup-load-all.R")

# B52/W-4: la Base de los bloques Word multiactor usa el MISMO formato
# prorrateado que el slide PPT («Base: 52 docentes y 155 estudiantes»).
# El caption por actor («Docentes (52) y Estudiantes (155)») queda solo
# como fallback cuando la base sellada no puede calcularse.

.word_multiactor_inst <- function() {
  codes <- c("1", "2", "3", "4", "5")
  labels <- c(
    "Totalmente en desacuerdo", "En desacuerdo",
    "Ni de acuerdo ni en desacuerdo", "De acuerdo", "Totalmente de acuerdo"
  )
  list(
    survey = data.frame(
      name = "acuerdo",
      type = "select_one likert5",
      list_name = "likert5",
      label = "Nivel de acuerdo con la gestión",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = "likert5", name = codes, label = labels,
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )
}

.word_multiactor_data <- function(counts) {
  data.frame(
    acuerdo = rep(names(counts), times = unname(counts)),
    stringsAsFactors = FALSE
  )
}

test_that("la Base Word del bloque multiactor sale prorrateada como en PPT", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")
  skip_if_not_installed("cowplot")

  data <- list(
    docentes = .word_multiactor_data(c(`1` = 1, `2` = 5, `3` = 9, `4` = 21, `5` = 16)),
    estudiantes = .word_multiactor_data(c(`1` = 8, `2` = 23, `3` = 31, `4` = 54, `5` = 39))
  )
  instrumento <- list(
    docentes = .word_multiactor_inst(),
    estudiantes = .word_multiactor_inst()
  )
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_barras_multiapiladas(
        modo = "multilista",
        bloques = list(list(
          modo = "var_cruce",
          vars = list(acuerdo = c("docentes$acuerdo", "estudiantes$acuerdo")),
          titulos_grupo = c(acuerdo = "Nivel de acuerdo")
        ))
      )
    )
  )

  meta <- reporte_ppt_plan(
    data = data,
    instrumento = instrumento,
    plan = plan,
    presets = .apply_word_chart_presets(
      do.call(p_presets, .PRESETS_DEFAULT_PULSO),
      w_presets()
    ),
    solo_lista = TRUE,
    build_render_meta = TRUE,
    mensajes_progreso = FALSE
  )$render_meta

  charts <- Filter(function(m) identical(m$kind %||% "chart", "chart"), meta)
  expect_length(charts, 1L)

  base_txt <- charts[[1]]$base
  expect_identical(base_txt, "Base: 52 docentes y 155 estudiantes")
  # El formato actor-caption viejo ya no viaja a Word.
  expect_false(grepl("Docentes (52)", base_txt, fixed = TRUE))
})
