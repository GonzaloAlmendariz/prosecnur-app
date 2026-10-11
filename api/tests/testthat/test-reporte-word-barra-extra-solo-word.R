source("setup-load-all.R")

# F-d (Meta A): `overrides.word_mostrar_barra_extra` decide la columna extra de un gráfico SÓLO en el Word. Los overrides
# del gráfico mandan igual en la lámina y en el Word salvo las claves `word_*`, que únicamente lee el camino del Word
# (`.word_ajustar_el` / `.word_preparar_block_multi` vía `.word_barra_extra_solo_word`). FALSE apaga sólo en el Word,
# TRUE enciende sólo en el Word, ausente hereda; la lámina no la lee.

.wsw_inst <- function() {
  list(
    survey = data.frame(name = "p12", type = "select_one likert5", list_name = "likert5",
                        label = "La gestión del decanato es adecuada", stringsAsFactors = FALSE),
    choices = data.frame(list_name = "likert5", name = as.character(1:5),
                         label = c("Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo",
                                   "De acuerdo", "Totalmente de acuerdo"), stringsAsFactors = FALSE),
    orders_list = NULL
  )
}

.wsw_data <- function() list(docentes = data.frame(p12 = c("1", "2", rep("4", 17), rep("5", 31)), stringsAsFactors = FALSE))
.wsw_t2b <- c("De acuerdo", "Totalmente de acuerdo")
.wsw_plan <- function(overrides) {
  list(diapo_001 = p_slide_1_grafico(grafico = p_barras_apiladas(var = "docentes$p12", overrides = overrides)))
}
.wsw_textos <- function(p) {
  b <- suppressWarnings(ggplot2::ggplot_build(p))
  unlist(lapply(b$data, function(l) if ("label" %in% names(l)) as.character(l$label)))
}

# El gráfico del Word (render_meta$plot_word, por el camino de reporte_word_plan) y el de la lámina (rendered, por el
# camino del PPT, con los presets PPT sin la capa Word).
.wsw_word <- function(overrides, presets_ppt = do.call(p_presets, .PRESETS_DEFAULT_PULSO)) {
  meta <- reporte_ppt_plan(data = .wsw_data(), instrumento = list(docentes = .wsw_inst()), plan = .wsw_plan(overrides),
                           presets = .apply_word_chart_presets(presets_ppt, w_presets()),
                           solo_lista = TRUE, build_render_meta = TRUE, mensajes_progreso = FALSE)$render_meta
  charts <- Filter(function(m) identical(m$kind %||% "chart", "chart"), meta)
  expect_length(charts, 1L)
  .wsw_textos(.word_grafico(charts[[1]]$plot_word))
}
.wsw_lamina <- function(overrides, presets_ppt = do.call(p_presets, .PRESETS_DEFAULT_PULSO)) {
  res <- reporte_ppt_plan(data = .wsw_data(), instrumento = list(docentes = .wsw_inst()), plan = .wsw_plan(overrides),
                          presets = presets_ppt, solo_lista = TRUE, mensajes_progreso = FALSE)
  plots <- Filter(function(p) inherits(p, "ggplot"), res$rendered)
  expect_gte(length(plots), 1L)
  unlist(lapply(plots, .wsw_textos))
}

test_that(".word_barra_extra_solo_word resuelve la columna del Word y consume la clave", {
  off <- .word_barra_extra_solo_word(list(word_mostrar_barra_extra = FALSE, mostrar_barra_extra = TRUE,
                                          barra_extra_preset = "top2box"))
  expect_false(off$mostrar_barra_extra)
  expect_null(off$word_mostrar_barra_extra)
  # Con el FALSE resultante, el pedido de la lámina ya no reserva ancho en el Word.
  expect_null(.word_conservar_barra_extra_pedida(off)$canvas_w_extra)

  on <- .word_barra_extra_solo_word(list(word_mostrar_barra_extra = TRUE))
  expect_true(on$mostrar_barra_extra)
  expect_identical(on$barra_extra_preset, "top2box")
  expect_null(on$word_mostrar_barra_extra)
  expect_gt(.word_conservar_barra_extra_pedida(on)$canvas_w_extra, 0)
  expect_identical(.word_barra_extra_solo_word(list(word_mostrar_barra_extra = TRUE, barra_extra_preset = "ninguno"))$barra_extra_preset,
                   "top2box")
  # Un preset de columna que el gráfico ya declara se conserva.
  expect_identical(.word_barra_extra_solo_word(list(word_mostrar_barra_extra = TRUE, barra_extra_preset = "totales"))$barra_extra_preset,
                   "totales")

  # Ausente o no lógica: hereda (los overrides quedan como estaban, menos la clave inválida).
  expect_identical(.word_barra_extra_solo_word(list(size_ejes = 7)), list(size_ejes = 7))
  expect_identical(.word_barra_extra_solo_word(list(size_ejes = 7, word_mostrar_barra_extra = NA)), list(size_ejes = 7))
  expect_identical(.word_barra_extra_solo_word(list(size_ejes = 7, word_mostrar_barra_extra = "no")), list(size_ejes = 7))
})

test_that("FALSE apaga el Top Two Box sólo en el Word; la lámina lo sigue llevando", {
  skip_if_not_installed("ggplot2")
  ov <- list(top2box_labels = .wsw_t2b, word_mostrar_barra_extra = FALSE)
  expect_false("Top Two Box" %in% .wsw_word(ov))
  expect_true("Top Two Box" %in% .wsw_lamina(ov))
  # También contra una lámina que lo pide en sus propios overrides.
  ov_pedido <- c(ov, list(mostrar_barra_extra = TRUE, barra_extra_preset = "top2box"))
  expect_false("Top Two Box" %in% .wsw_word(ov_pedido))
  expect_true("Top Two Box" %in% .wsw_lamina(ov_pedido))
})

test_that("TRUE enciende el Top Two Box sólo en el Word cuando el informe lo apagó", {
  skip_if_not_installed("ggplot2")
  ppt <- do.call(p_presets, .PRESETS_DEFAULT_PULSO)
  ppt$barras_apiladas$args$barra_extra_preset <- "ninguno"
  ov <- list(top2box_labels = .wsw_t2b, word_mostrar_barra_extra = TRUE)
  textos_word <- .wsw_word(ov, presets_ppt = ppt)
  expect_true(all(c("Top Two Box", "96%") %in% textos_word))   # 17 + 31 de 50
  expect_false("Top Two Box" %in% .wsw_lamina(ov, presets_ppt = ppt))
})

test_that("sin la clave, el Word hereda lo de la lámina y el default Word", {
  skip_if_not_installed("ggplot2")
  ov <- list(top2box_labels = .wsw_t2b)
  expect_true("Top Two Box" %in% .wsw_word(ov))
  ppt <- do.call(p_presets, .PRESETS_DEFAULT_PULSO)
  ppt$barras_apiladas$args$barra_extra_preset <- "ninguno"
  expect_false("Top Two Box" %in% .wsw_word(ov, presets_ppt = ppt))
})

test_that("el PPT no cambia byte a byte por la presencia de word_mostrar_barra_extra", {
  skip_if_not_installed("ggplot2")
  skip_if_not_installed("officer")
  dir <- withr::local_tempdir()
  render <- function(overrides, nombre) {
    path <- file.path(dir, nombre)
    suppressMessages(reporte_ppt_plan(data = .wsw_data(), instrumento = list(docentes = .wsw_inst()),
                                      plan = .wsw_plan(overrides), path_ppt = path,
                                      presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO), mensajes_progreso = FALSE))
    ex <- file.path(dir, paste0(nombre, "_x"))
    utils::unzip(path, exdir = ex)
    fs <- sort(list.files(ex, recursive = TRUE))
    # docProps/core.xml lleva la hora de guardado: es lo único que cambia entre dos renders idénticos.
    fs <- setdiff(fs, "docProps/core.xml")
    stats::setNames(vapply(fs, function(f) unname(tools::md5sum(file.path(ex, f))), ""), fs)
  }
  base <- list(top2box_labels = .wsw_t2b)
  sin <- render(base, "sin.pptx")
  expect_gt(length(sin), 5L)
  expect_identical(render(c(base, list(word_mostrar_barra_extra = FALSE)), "off.pptx"), sin)
  expect_identical(render(c(base, list(word_mostrar_barra_extra = TRUE)), "on.pptx"), sin)
})

test_that("el bloque multiapiladas del Word también lee word_mostrar_barra_extra", {
  block <- list(vars = list("docentes$p1", "docentes$p2"),
                overrides = list(mostrar_barra_extra = TRUE, barra_extra_preset = "top2box",
                                 word_mostrar_barra_extra = FALSE))
  ov_off <- .word_preparar_block_multi(block)$overrides
  expect_false(ov_off$mostrar_barra_extra)
  expect_null(ov_off$word_mostrar_barra_extra)

  block$overrides <- list(word_mostrar_barra_extra = TRUE)
  ov_on <- .word_preparar_block_multi(block)$overrides
  expect_true(ov_on$mostrar_barra_extra)
  expect_identical(ov_on$barra_extra_preset, "top2box")
  expect_gt(ov_on$canvas_w_extra, 0)

  block$overrides <- list()
  expect_null(.word_preparar_block_multi(block)$overrides$mostrar_barra_extra)
})
