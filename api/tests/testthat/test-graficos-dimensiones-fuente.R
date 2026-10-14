# Las dimensiones de Analítica llegan a Gráficos (H2 del catálogo del recetario, 2026-10-14). Analítica las guardaba en
# `s$rp_dim` y Gráficos leía las bases sin ellas: los gráficos de dimensiones salían «Sin datos» en cualquier estudio.
# Se prueba por la ruta de la app: el catálogo del recetario, las dimensiones construidas como lo hace
# POST /api/analitica/dimensiones/build y la lámina con las bases que usa Gráficos.

.gdf_sesion <- function() {
  path <- file.path(catalogo_recetario_dir(), "recetario_catalogo.pulso")
  stopifnot(file.exists(path))   # versionado: si falta, es un error y no un salto
  sid <- suppressMessages(load_pulso(path))$session_id
  cfg <- list(listas_objetivo = list("acuerdo"), vars_recodificar = as.list(paste0("comp_", 1:6)), excluir_vars = list(),
              orden_por_lista = list(acuerdo = as.list(as.character(1:4))), codigos_missing = list("99"), codigos_no_aplica = list(),
              prefijo = "r100_", subcriterios = list(),
              subindices = list(list(nombre = "tec", etiqueta = "Técnicas", vars = as.list(paste0("r100_comp_", 1:3))),
                                list(nombre = "neg", etiqueta = "Visión", vars = list("r100_comp_5"))),
              indices = list(list(nombre = "comp2", etiqueta = "Índice", subindices = list("tec", "neg"))))
  ctx <- .load_rp_data(sid)
  out <- suppressMessages(.dimensiones_construir(ctx$rp_data, ctx$rp_inst, cfg))
  session_set(sid, "rp_dim", out$data_dim); session_set(sid, "rp_dim_base", estudio_active_base(sid))
  .analitica_status_set(sid, "analitica_dim_ok", TRUE)
  sid
}

test_that("un gráfico de dimensiones construidas en Analítica se dibuja en Gráficos", {
  skip_if_not_installed("officer")
  sid <- .gdf_sesion(); on.exit(session_delete(sid), add = TRUE)
  src <- .graficos_processing_sources(sid)
  expect_true("idx_comp2" %in% names(src$data_sources$estudiantes))
  expect_false(is.null(attr(src$data_sources$estudiantes, "recodificacion_items_meta")))
  msgs <- character()
  withCallingHandlers(
    reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, solo_lista = TRUE, mensajes_progreso = FALSE,
                     plan = list(p_slide_1_grafico(titulo = "x", grafico = p_dim_heatmap(modo = "general", objetivo = "idx_comp2", cruce = "estudiantes$ciclo")))),
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") },
    warning = function(w) { msgs <<- c(msgs, conditionMessage(w)); invokeRestart("muffleWarning") })
  expect_false(any(grepl("no se pudo dibujar|Sin datos", msgs)), info = paste(msgs, collapse = "\n"))
})

test_that("si las filas no coinciden, no se pegan índices a otras personas y se avisa", {
  sid <- .gdf_sesion(); on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid); session_set(sid, "rp_dim", s$rp_dim[1:10, , drop = FALSE])
  expect_message(src <- .graficos_processing_sources(sid), "no se usan en Gráficos")
  expect_false("idx_comp2" %in% names(src$data_sources$estudiantes))
})

test_that("al exportar, la base activa califica las variables pero no el objetivo de dimensiones", {
  plan <- list(slides = list(list(id = "a", tipo = "p_slide_1_grafico", payload = list(
    grafico = list(graficador = "p_dim_heatmap", args = list(modo = "general", objetivo = "idx_comp", cruce = "ciclo"))))))
  args <- .graficos_calificar_refs_plan(plan, "estudiantes")$slides[[1]]$payload$grafico$args
  expect_identical(args$objetivo, "idx_comp")
  expect_identical(args$cruce, "estudiantes$ciclo")
})
