source("setup-load-all.R")

# B55: config.debug_ph (marcos de depuracion de placeholders) es una
# herramienta de PREVIEW de la UI. Los workers de export final
# (graficos_job_worker_ppt / _ppt_all / _word) lo apagan siempre via
# .graficos_export_sin_debug_ph(): un body real con debug_ph.activo=TRUE
# no puede producir un entregable con marcos magenta.

test_that("el preview sigue inyectando debug_ph cuando esta activo", {
  presets <- .enriquecer_presets(list(), list(activo = TRUE, color = "#FF00FF", lwd = 2))
  expect_true(isTRUE(presets$base$debug_ph_bordes))
  expect_identical(presets$base$debug_ph_col, "#FF00FF")
  expect_equal(presets$base$debug_ph_lwd, 2)
})

test_that("el export apaga debug_ph aunque el body lo traiga activo", {
  # Presets tal como llegan al worker: enriquecidos con debug_ph activo.
  presets <- .enriquecer_presets(list(), list(activo = TRUE, color = "#FF00FF", lwd = 2))
  limpio <- .graficos_export_sin_debug_ph(presets)

  expect_false(isTRUE(limpio$base$debug_ph_bordes))
  # color/grosor quedan inertes sin el flag; no hace falta borrarlos.
  expect_identical(limpio$base$debug_ph_col, "#FF00FF")

  # El resto de claves del preset no se altera.
  limpio$base$debug_ph_bordes <- presets$base$debug_ph_bordes
  expect_identical(limpio, presets)
})

test_that("el flag sembrado por tipo (plano o en args) tambien se apaga", {
  presets <- list(
    base = list(debug_ph_bordes = TRUE),
    barras_apiladas = list(debug_ph_bordes = TRUE, usar_canvas = TRUE),
    pie = list(args = list(debug_ph_bordes = TRUE, size_ejes = 9))
  )
  limpio <- .graficos_export_sin_debug_ph(presets)
  expect_false(limpio$base$debug_ph_bordes)
  expect_false(limpio$barras_apiladas$debug_ph_bordes)
  expect_false(limpio$pie$args$debug_ph_bordes)
  expect_true(limpio$barras_apiladas$usar_canvas)
  expect_equal(limpio$pie$args$size_ejes, 9)
})

test_that("presets sin debug_ph pasan intactos salvo el candado en base", {
  limpio <- .graficos_export_sin_debug_ph(list(barras_apiladas = list(size_ejes = 7)))
  expect_equal(limpio$barras_apiladas$size_ejes, 7)
  expect_false(limpio$base$debug_ph_bordes)
  # Entradas no-lista no revientan.
  expect_identical(.graficos_export_sin_debug_ph(NULL), NULL)
})

test_that("los tres workers de export pasan por el filtro (contrato de codigo)", {
  # Contrato estatico: si alguien reescribe un worker sin el filtro, este
  # test lo delata sin necesidad de levantar un job callr real.
  src_path <- file.path("..", "..", "R", "graficos_jobs.R")
  skip_if(!file.exists(src_path), "fuente de graficos_jobs.R no disponible")
  src <- readLines(src_path, warn = FALSE)
  cuerpo <- paste(src, collapse = "\n")
  expect_true(grepl("graficos_job_worker_ppt", cuerpo, fixed = TRUE))
  # El patron con parentesis de llamada excluye la definicion: quedan las
  # 3 invocaciones (ppt, ppt_all, word).
  n_usos <- sum(grepl(".graficos_export_sin_debug_ph(", src, fixed = TRUE))
  expect_gte(n_usos, 3L)
  expect_true(grepl(".graficos_export_sin_debug_ph <- function", cuerpo, fixed = TRUE))
})
