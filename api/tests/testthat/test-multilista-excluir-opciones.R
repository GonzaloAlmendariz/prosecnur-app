# La exclusion de opciones se resuelve una vez en el padre y deja las tres
# fuentes en NULL. El path de bloques (`multilista`) llamaba recursivamente con
# esos presets ya vaciados, asi que cada subbloque perdia la exclusion: «SIN
# INF» volvia al denominador y el Top 2 Box bajaba (93 % en vez de 94 % en la
# bateria p30 de acrconta).
#
# Se mide sobre el PPTX generado y no sobre `out$rendered`: en multilista el
# resultado es un `plot_grid`, no un ggplot, asi que `$data` viene vacio y un
# assert contra el aparece verde sin medir nada.

.mlx_datos <- function() {
  # Sin azar: la proporcion tiene que ser exacta para poder afirmar el %.
  data.frame(
    q1 = rep(c("Muy malo", "Malo", "Bueno", "Muy bueno", "SIN INF"),
             times = c(5, 10, 40, 40, 5)),
    stringsAsFactors = FALSE
  )
}

.mlx_inst <- function() {
  list(
    survey = data.frame(
      type = "select_one escala", name = "q1", label = "Pregunta uno",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = rep("escala", 5),
      name = c("1", "2", "3", "4", "9"),
      label = c("Muy malo", "Malo", "Bueno", "Muy bueno", "SIN INF"),
      stringsAsFactors = FALSE
    ),
    label_col_survey = "label", label_col_choices = "label", lang = "es"
  )
}

.mlx_porcentajes <- function(pptx) {
  con <- unz(pptx, "ppt/slides/slide1.xml", open = "rb")
  on.exit(close(con), add = TRUE)
  raw <- paste(readLines(con, warn = FALSE, encoding = "UTF-8"), collapse = "")
  Encoding(raw) <- "UTF-8"
  txt <- regmatches(raw, gregexpr("(?<=<a:t>)[^<]*(?=</a:t>)", raw, perl = TRUE))[[1]]
  txt[grepl("^[0-9]+%$", txt)]
}

.mlx_generar <- function(preset_extra = list()) {
  p_reset()
  plan <- list(diapo_001 = p_slide_1_grafico(
    grafico = p_barras_multiapiladas(
      modo = "multilista",
      bloques = list(list(modo = "var", vars = "q1"))
    )
  ))
  path <- tempfile(fileext = ".pptx")
  reporte_ppt_plan(
    data = .mlx_datos(), instrumento = .mlx_inst(), plan = plan,
    presets = p_presets(multi_apiladas = utils::modifyList(
      list(usar_canvas = TRUE, mostrar_leyenda = FALSE), preset_extra
    )),
    path_ppt = path, mensajes_progreso = FALSE
  )
  path
}

test_that("sin exclusion, la opcion entra y corre el denominador", {
  skip_if_not_installed("cowplot")
  pct <- .mlx_porcentajes(.mlx_generar())

  # 100 casos: 5/10/40/40/5 -> con SIN INF dentro, «Bueno» es 40 %.
  expect_true("40%" %in% pct)
  # Y la opcion excluible aparece con su propio segmento del 5 %.
  expect_true("5%" %in% pct)
})

test_that("un subbloque de multilista hereda la exclusion del preset", {
  skip_if_not_installed("cowplot")
  pct <- .mlx_porcentajes(.mlx_generar(list(excluir_opciones = "SIN INF")))

  # Sin SIN INF la base baja a 95 y «Bueno» pasa de 40 % a 42 %.
  expect_true("42%" %in% pct)
  expect_false("40%" %in% pct)
})
