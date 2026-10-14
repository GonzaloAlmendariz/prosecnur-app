# Ranking con puntos de una pregunta de opción múltiple (recetario p72: «% de encuestados que marcó cada opción»;
# catálogo del recetario, H4). Antes salía «Sin datos»: exigía respuesta única. El porcentaje es sobre las personas que
# respondieron, no sobre la suma de marcas.

test_that("el ranking con puntos de opción múltiple se dibuja con el porcentaje de personas que marcó cada opción", {
  skip_if_not_installed("officer")
  path <- file.path(catalogo_recetario_dir(), "recetario_catalogo.pulso"); stopifnot(file.exists(path))
  sid <- suppressMessages(load_pulso(path))$session_id; on.exit(session_delete(sid), add = TRUE)
  src <- .graficos_processing_sources(sid); msgs <- character()
  r <- withCallingHandlers(
    reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, solo_lista = TRUE, mensajes_progreso = FALSE,
                     plan = list(p_slide_1_grafico(titulo = "x", grafico = p_lollipop("egresados$mejoras")))),
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") },
    warning = function(w) { msgs <<- c(msgs, conditionMessage(w)); invokeRestart("muffleWarning") })
  expect_false(any(grepl("no se pudo dibujar|Sin datos", msgs)), info = paste(msgs, collapse = "\n"))
  d <- r$rendered[[1]]$data
  eg <- src$data_sources$egresados
  marcaron <- suppressWarnings(as.numeric(eg[["mejoras.1"]]))
  # En el catálogo todos los egresados responden la pregunta: la base son todas sus filas.
  esperado <- 100 * sum(marcaron == 1, na.rm = TRUE) / nrow(eg)
  fila <- d[grepl("^Herramientas digitales", d[[1]]), , drop = FALSE]
  expect_equal(as.numeric(fila[[2]]), esperado, tolerance = 0.01)
  # Opción múltiple: las opciones pueden sumar más de 100.
  expect_gt(sum(as.numeric(d[[2]])), 100)
})
