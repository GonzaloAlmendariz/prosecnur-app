source("setup-load-all.R")

# B54/W-6: en Word el alto de la imagen ES alto_word_sugerido, asi que el
# piso B46 del graficador (panel de 2.8in para <=2 filas, pensado para llenar
# el slot fisico del SLIDE PPT) hacia que un bloque multiactor de 2 actores
# saliera con barras ~2.5x mas gruesas que su vecino de 4 en la misma pagina.
# .word_preparar_block_multi fija canvas_h_panel_in proporcional al numero de
# actores (0.55in por fila, piso 1.1in) para que el grosor sea comparable.

.wm_inst_si_no <- function() {
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

.wm_data_si_no <- function(n_si, n_no) {
  data.frame(
    p13 = c(rep("1", n_si), rep("2", n_no)),
    stringsAsFactors = FALSE
  )
}

.wm_render_meta_charts <- function() {
  data <- list(
    docentes        = .wm_data_si_no(47, 5),
    estudiantes     = .wm_data_si_no(160, 12),
    egresados       = .wm_data_si_no(172, 6),
    administrativos = .wm_data_si_no(15, 0)
  )
  instrumento <- list(
    docentes = .wm_inst_si_no(), estudiantes = .wm_inst_si_no(),
    egresados = .wm_inst_si_no(), administrativos = .wm_inst_si_no()
  )
  presets <- .apply_word_chart_presets(
    do.call(p_presets, .PRESETS_DEFAULT_PULSO),
    w_presets()
  )
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      titulo = "prueba 2",
      grafico = p_barras_multiapiladas(
        modo = "var_cruce",
        vars = list(
          tema_1 = c(
            "docentes$p13", "estudiantes$p13",
            "egresados$p13", "administrativos$p13"
          ),
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

test_that(".word_preparar_block_multi escala el panel con el numero de actores", {
  block4 <- list(
    modo = "var_cruce",
    vars = list(tema_1 = c("a$v", "b$v", "c$v", "d$v")),
    overrides = list()
  )
  block2 <- list(
    modo = "var_cruce",
    vars = list(tema_2 = c("a$v", "b$v")),
    overrides = list()
  )
  ov4 <- .word_preparar_block_multi(block4)$overrides
  ov2 <- .word_preparar_block_multi(block2)$overrides
  expect_equal(ov4$canvas_h_panel_in, 4 * 0.55)
  expect_equal(ov2$canvas_h_panel_in, max(1.1, 2 * 0.55))
  # Proporcionalidad exacta por actor entre bloques vecinos.
  expect_equal(ov4$canvas_h_panel_in / 4, ov2$canvas_h_panel_in / 2)

  # Un canvas_h_panel_in fijado por el usuario no se pisa.
  block_user <- list(
    modo = "var_cruce",
    vars = list(t = c("a$v", "b$v")),
    overrides = list(canvas_h_panel_in = 3.2)
  )
  expect_equal(.word_preparar_block_multi(block_user)$overrides$canvas_h_panel_in, 3.2)

  # Con `cruce` las filas dependen de la data: no se fija panel.
  block_cruce <- list(modo = "cruce", var = "a$v", cruce = "a$sexo", overrides = list())
  expect_null(.word_preparar_block_multi(block_cruce)$overrides$canvas_h_panel_in)
})

test_that("alto_word_sugerido escala con n_actores y el grosor por fila es comparable", {
  skip_if_not_installed("cowplot")
  skip_if_not_installed("dplyr")

  charts <- .wm_render_meta_charts()
  expect_length(charts, 2L)

  p4 <- charts[[1]]$plot_word
  p2 <- charts[[2]]$plot_word
  alto4 <- attr(p4, "alto_word_sugerido", exact = TRUE)
  alto2 <- attr(p2, "alto_word_sugerido", exact = TRUE)
  expect_true(is.finite(alto4) && is.finite(alto2))

  # El bloque de 4 actores es MAS alto que el de 2 (antes el piso B46
  # invertia la relacion visual: 2 actores salian con panel de 2.8in).
  expect_gt(alto4, alto2)
  # La diferencia es la de un panel proporcional (2 filas de ~0.55in),
  # no la de un piso fijo de slide.
  expect_equal(alto4 - alto2, 2 * 0.55, tolerance = 0.25)

  lay4 <- attr(p4, "pulso_barras_apiladas_layout", exact = TRUE)
  lay2 <- attr(p2, "pulso_barras_apiladas_layout", exact = TRUE)
  expect_identical(lay4$n_categorias, 4L)
  expect_identical(lay2$n_categorias, 2L)

  # Grosor comparable: pulgadas de banda por fila dentro de +-25%.
  por_fila4 <- lay4$h_bars_area_in / lay4$y_axis_max
  por_fila2 <- lay2$h_bars_area_in / lay2$y_axis_max
  expect_lt(abs(por_fila4 - por_fila2) / por_fila4, 0.25)
})
