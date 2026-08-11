source("setup-load-all.R")

# Las guías de layout (`config.debug_ph` de la UI) llegan al ENTREGABLE, no
# solo al preview.
#
# Antes los tres workers de export las apagaban siempre, con la intención de
# que un mazo no saliera al cliente con marcos magenta. El efecto real era un
# interruptor que se declaraba activo y no tenía efecto observable en ninguna
# superficie donde el analista mirara — ni en el PPT, ni en el Word, ni en el
# ZIP multibase. Quien enciende las guías las quiere para revisar el mazo
# COMPLETO: diagnosticar 67 láminas de a una vista previa no es una
# herramienta.

test_that("el preview inyecta debug_ph cuando está activo", {
  presets <- .enriquecer_presets(list(), list(activo = TRUE, color = "#FF00FF", lwd = 2))
  expect_true(isTRUE(presets$base$debug_ph_bordes))
  expect_identical(presets$base$debug_ph_col, "#FF00FF")
  expect_equal(presets$base$debug_ph_lwd, 2)
})

test_that("con las guías apagadas el flag queda en FALSE", {
  presets <- .enriquecer_presets(list(), list(activo = FALSE))
  expect_false(isTRUE(presets$base$debug_ph_bordes))

  # Y también cuando la UI no manda nada: el default es sin guías.
  expect_false(isTRUE(.enriquecer_presets(list(), NULL)$base$debug_ph_bordes))
})

test_that("ningún worker de export apaga las guías por su cuenta", {
  # Contrato estático: el filtro que las apagaba se retiró a propósito. Si
  # alguien lo reintroduce —en cualquier worker— este test lo delata sin
  # levantar un job callr real.
  src_path <- file.path("..", "..", "R", "graficos_jobs.R")
  skip_if(!file.exists(src_path), "fuente de graficos_jobs.R no disponible")
  cuerpo <- paste(readLines(src_path, warn = FALSE), collapse = "\n")

  expect_true(grepl("graficos_job_worker_ppt", cuerpo, fixed = TRUE))
  expect_false(grepl("export_sin_debug_ph", cuerpo, fixed = TRUE))
  expect_false(grepl("debug_ph_bordes <- FALSE", cuerpo, fixed = TRUE))
})

test_that("el flag activo sobrevive la construcción de presets del worker", {
  # `.build_presets()` es lo último que toca los presets antes del motor.
  presets <- .enriquecer_presets(list(), list(activo = TRUE, color = "#FF00FF", lwd = 2))
  construidos <- .build_presets(presets)
  expect_true(isTRUE(construidos$base$args$debug_ph_bordes %||%
                       construidos$base$debug_ph_bordes))
})
