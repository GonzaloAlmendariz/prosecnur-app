# R12-3 (R11-11, causa 1): el job de miniaturas registra derivados (vista previa y miniatura de lámina) en el file
# store, y `entregable_registrar` -> session_set("files") marcaba el proyecto como modificado al solo abrirlo y mirar
# Gráficos. Un derivado que se recalcula de lo guardado no marca `project_dirty`; un entregable real sí.

.msd_png <- function() {
  p <- tempfile(fileext = ".png")
  grDevices::png(p, width = 200, height = 150); graphics::par(mar = c(0, 0, 0, 0)); graphics::plot.new(); grDevices::dev.off()
  p
}
.msd_abrir <- function() {
  sid0 <- session_create(); on.exit(session_delete(sid0), add = TRUE)
  dest <- tempfile(fileext = ".pulso"); on.exit(unlink(dest), add = TRUE)
  suppressMessages(build_pulso(sid0, dest, allow_empty_overwrite = TRUE))
  suppressMessages(load_pulso(dest))$session_id
}

test_that("abrir un .pulso y cosechar el lote de miniaturas no marca el proyecto como modificado", {
  sid <- .msd_abrir(); on.exit(session_delete(sid), add = TRUE)
  expect_false(isTRUE(session_get(sid)$project_dirty))
  png <- .msd_png(); imagen <- .msd_png(); pptx <- tempfile(fileext = ".pptx"); writeLines("x", pptx)
  on.exit(unlink(c(png, imagen, pptx)), add = TRUE)
  # Lo que publica el lote por lámina (`.mini_item_publico`): la miniatura y la imagen grande, registradas.
  item <- list(slide_id = "s1", hash = "h1", estado = "ok", png = png, imagen = imagen, folio = 1L)
  pub <- .mini_item_publico(sid, tempdir(), item)
  expect_true(is.character(pub$miniatura$file_id))
  expect_true(is.character(pub$imagen$file_id))
  # La vista previa de una lámina (`.mini_registrar` con el PPTX, kind graficos_preview).
  pv <- .mini_registrar(sid, "h1", pptx, "graficos_preview", original_name = "vista.pptx")
  s <- session_get(sid)
  expect_true(all(c(pub$miniatura$file_id, pub$imagen$file_id, pv$file_id) %in% names(s$files)))
  expect_false(isTRUE(s$project_dirty))
  expect_false(any(grepl("files", unlist(s$project_dirty_reasons %||% character(0)))))
})

test_that("un entregable real sí marca el proyecto como modificado", {
  sid <- .msd_abrir(); on.exit(session_delete(sid), add = TRUE)
  f <- tempfile(fileext = ".pptx"); writeLines("x", f); on.exit(unlink(f), add = TRUE)
  meta <- withr::with_envvar(c(PULSO_PUBLIC_MODE = ""), entregable_registrar(sid, f, "graficos_share", original_name = "plan.json"))
  s <- session_get(sid)
  expect_true(meta$file_id %in% names(s$files))
  expect_true(isTRUE(s$project_dirty))
})
