source("setup-load-all.R")

# B54/W-7: el titulo de la lamina (payload$titulo -> el$title_slide) no
# viajaba al split Word de multiapiladas var_cruce: dos grupos con el mismo
# titulos_grupo salian identicos («Grafico N 3. Servicio de salud» /
# «N 4. Servicio de salud»). El patron editorial es
# «<titulo de lamina> — <titulo de grupo>», con dedupe si coinciden.

.wt_inst_si_no <- function() {
  list(
    survey = data.frame(
      name = "p13", type = "select_one si_no", list_name = "si_no",
      label = "¿Conoce el servicio de salud?",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = "si_no", name = c("1", "2"), label = c("Sí", "No"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )
}

.wt_data_si_no <- function(n_si, n_no) {
  data.frame(p13 = c(rep("1", n_si), rep("2", n_no)), stringsAsFactors = FALSE)
}

.wt_charts <- function(titulo_lamina) {
  data <- list(
    docentes    = .wt_data_si_no(47, 5),
    estudiantes = .wt_data_si_no(160, 12)
  )
  instrumento <- list(docentes = .wt_inst_si_no(), estudiantes = .wt_inst_si_no())
  presets <- .apply_word_chart_presets(
    do.call(p_presets, .PRESETS_DEFAULT_PULSO),
    w_presets()
  )
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      titulo = titulo_lamina,
      grafico = p_barras_multiapiladas(
        modo = "var_cruce",
        vars = list(
          tema_1 = c("docentes$p13", "estudiantes$p13"),
          tema_2 = c("docentes$p13", "estudiantes$p13")
        ),
        titulos_grupo = c(
          tema_1 = "Servicio de salud",
          tema_2 = "Servicio de salud"
        )
      )
    )
  )
  meta <- reporte_ppt_plan(
    data = data, instrumento = instrumento, plan = plan, presets = presets,
    solo_lista = TRUE, build_render_meta = TRUE, mensajes_progreso = FALSE
  )$render_meta
  Filter(function(m) identical(m$kind %||% "chart", "chart"), meta)
}

test_that(".word_titulo_bloque_multi compone lamina y grupo con dedupe", {
  expect_identical(
    .word_titulo_bloque_multi("prueba 2", "Servicio de salud"),
    "prueba 2 — Servicio de salud"
  )
  expect_identical(.word_titulo_bloque_multi(NULL, "Servicio de salud"), "Servicio de salud")
  expect_identical(.word_titulo_bloque_multi("", "Servicio de salud"), "Servicio de salud")
  expect_identical(.word_titulo_bloque_multi("prueba 2", ""), "prueba 2")
  # Si lamina y grupo dicen lo mismo, no se duplica.
  expect_identical(
    .word_titulo_bloque_multi("Servicio de salud", "servicio de salud"),
    "servicio de salud"
  )
})

test_that("el titulo de lamina viaja al titulo Word de cada bloque del split", {
  skip_if_not_installed("cowplot")
  skip_if_not_installed("dplyr")

  charts <- .wt_charts("prueba 2")
  expect_length(charts, 2L)
  titles <- vapply(charts, function(ch) as.character(ch$title), character(1))
  expect_true(all(grepl("prueba 2", titles, fixed = TRUE)))
  expect_true(all(grepl("Servicio de salud", titles, fixed = TRUE)))
  expect_identical(titles[[1]], "prueba 2 — Servicio de salud")
})

test_that("sin titulo de lamina el split conserva solo el titulo de grupo", {
  skip_if_not_installed("cowplot")
  skip_if_not_installed("dplyr")

  charts <- .wt_charts(NULL)
  expect_length(charts, 2L)
  titles <- vapply(charts, function(ch) as.character(ch$title), character(1))
  expect_identical(unique(titles), "Servicio de salud")
})
