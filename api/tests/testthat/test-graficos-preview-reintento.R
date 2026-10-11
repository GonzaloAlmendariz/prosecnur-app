source("setup-load-all.R")

# Vista previa con LibreOffice lento (fix/graficos-preview-timeout, 2026-10-11). Con la máquina cargada una conversión
# pptx→pdf tardaba 16 s o más; el plazo de 12 s la cortaba y la lámina salía «sin imagen», que la UI leía como «este
# equipo no tiene LibreOffice». Aquí: un reintento con plazo mayor antes de rendirse, y un motivo tipado cuando no hay
# imagen. Sin red y sin soffice real: el conversor y el rasterizador se simulan.

.pr_png <- function(page = 1L) list(png_base64 = "data:image/png;base64,AA", width = 1L, height = 1L, renderer = "soffice+pdftools")

# Conversor que tarda `segundos`: si el plazo no alcanza, se corta como lo haría system2(timeout =).
.pr_conversor_lento <- function(segundos, registro = new.env()) {
  registro$plazos <- integer()
  function(pptx_path, out_dir, timeout = 30) {
    registro$plazos <- c(registro$plazos, as.integer(timeout))
    if (timeout < segundos) return(list(pdf = NULL, motivo = "renderer_timeout", segundos = timeout))
    list(pdf = "x.pdf", motivo = NA_character_, segundos = segundos)
  }
}

test_that("un renderer que excede el primer plazo no deja la lámina sin imagen si el reintento lo logra", {
  reg <- new.env()
  local_mocked_bindings(
    .artifact_renderer_configured = function() FALSE,
    .pptx_to_pdf_soffice_info = .pr_conversor_lento(25, reg),
    .pdf_page_to_png = function(pdf_path, out_dir, renderer, page = 1L, ...) .pr_png(page)
  )
  r <- .render_pptx_preview_partes("x.pptx", 1L, preview_quality = "quick")
  expect_length(r, 1L)
  expect_match(r[[1]]$png_base64, "^data:image/png")
  expect_true(is.na(attr(r, "motivo") %||% NA_character_))
  expect_length(reg$plazos, 2L)                          # un solo reintento
  expect_gt(reg$plazos[[2]], reg$plazos[[1]])            # con plazo mayor
})

test_that("los 16 s medidos en acrconta_mazo caben en el primer plazo de «quick»", {
  reg <- new.env()
  local_mocked_bindings(
    .artifact_renderer_configured = function() FALSE,
    .pptx_to_pdf_soffice_info = .pr_conversor_lento(16, reg),
    .pdf_page_to_png = function(pdf_path, out_dir, renderer, page = 1L, ...) .pr_png(page)
  )
  r <- .render_pptx_preview_partes("x.pptx", 1L, preview_quality = "quick")
  expect_length(r, 1L)
  expect_length(reg$plazos, 1L)
})

test_that("si el reintento también se agota, se rinde (no infinito) y dice renderer_timeout", {
  reg <- new.env()
  local_mocked_bindings(
    .artifact_renderer_configured = function() FALSE,
    .pptx_to_pdf_soffice_info = .pr_conversor_lento(10000, reg),
    .pdf_page_to_png = function(...) stop("no debía rasterizar")
  )
  r <- .render_pptx_preview_partes("x.pptx", 1L)
  expect_length(r, 0L)
  expect_identical(attr(r, "motivo"), "renderer_timeout")
  expect_length(reg$plazos, 2L)
})

test_that("sin LibreOffice el motivo es renderer_ausente y no se reintenta", {
  n <- 0L
  local_mocked_bindings(
    .artifact_renderer_configured = function() FALSE,
    .pptx_to_pdf_soffice_info = function(...) { n <<- n + 1L; list(pdf = NULL, motivo = "renderer_ausente", segundos = 0) }
  )
  r <- .render_pptx_preview_partes("x.pptx", 1L)
  expect_identical(attr(r, "motivo"), "renderer_ausente")
  expect_identical(n, 1L)
})

test_that("PDF listo pero sin PNG: raster_fallido", {
  local_mocked_bindings(
    .artifact_renderer_configured = function() FALSE,
    .pptx_to_pdf_soffice_info = function(...) list(pdf = "x.pdf", motivo = NA_character_, segundos = 1),
    .pdf_page_to_png = function(...) NULL
  )
  r <- .render_pptx_preview_partes("x.pptx", 1L)
  expect_identical(attr(r, "motivo"), "raster_fallido")
})

test_that("la conversión clasifica el corte por plazo (status 124 de system2) como renderer_timeout", {
  local_mocked_bindings(.soffice_cmd = function() "soffice-falso",
                        .preview_perfil_tomar = function(out_dir, ...) list(dir = file.path(out_dir, "p"), compartido = FALSE, liberar = function() invisible(NULL)))
  local_mocked_bindings(system2 = function(...) structure(character(), status = 124L), .package = "base")
  f <- tempfile(fileext = ".pptx"); file.create(f)
  r <- .pptx_to_pdf_soffice_info(f, tempfile("pv"), timeout = 5)
  expect_null(r$pdf)
  expect_identical(r$motivo, "renderer_timeout")
  local_mocked_bindings(.soffice_cmd = function() "")
  expect_identical(.pptx_to_pdf_soffice_info(f, tempfile("pv"), timeout = 5)$motivo, "renderer_ausente")
})

test_that("un raster ausente no se cachea y su motivo llega al resolver", {
  raiz <- tempfile("raiz"); hash <- "h1"; e <- .mini_entrada(raiz, hash); dir.create(e$dir, recursive = TRUE)
  meta <- list(partes = list(n = 1L))
  local_mocked_bindings(.render_pptx_preview_partes = function(...) structure(list(), truncado = FALSE, motivo = "renderer_timeout"))
  r <- .mini_asegurar_raster(raiz, hash, meta, renderer_id = "soffice_pdftools")
  expect_identical(r$motivo, "renderer_timeout")
  expect_length(list.files(e$dir, pattern = "^raster_"), 0L)
  sin <- .mini_asegurar_raster(raiz, hash, meta, renderer_id = NA_character_)
  expect_identical(sin$motivo, "renderer_ausente")
})

test_that("el item del lote y su versión pública llevan motivo_sin_imagen", {
  ctx <- list(slide_id = "s1", hash = "h1", tipo = .slide_names()[[1]], folio = 1L)
  local_mocked_bindings(
    .mini_resolver = function(...) list(hash = "h1", pptx = "x.pptx", meta = list(graficos_pedidos = 1L, graficos_vacios = 0L),
                                        slide_previews = structure(list(), truncado = FALSE), motivo_sin_imagen = "renderer_timeout",
                                        cache = list(pptx = "hit", raster = "miss")),
    .mini_miniatura_png = function(...) NA_character_
  )
  item <- .mini_lote_item(ctx, tempfile("raiz"), list(render_slide_preview = TRUE, preview_quality = "quick"))
  expect_identical(item$estado, "sin_imagen")
  expect_identical(item$motivo_sin_imagen, "renderer_timeout")
  local_mocked_bindings(.mini_entrada_leer = function(...) NULL)
  pub <- .mini_item_publico("sid", tempfile("raiz"), c(item, list(orden = 1L)))
  expect_identical(pub$motivo_sin_imagen, "renderer_timeout")
})

test_that("la respuesta de la vista previa expone motivo_sin_imagen (y NA cuando hay imagen)", {
  local_mocked_bindings(
    .mini_registrar = function(...) list(file_id = "f1", size = 1L),
    .export_filename = function(...) "x.pptx",
    .preview_con_formas = function(respuesta, ...) respuesta
  )
  r <- list(hash = "h1", pptx = "x.pptx", meta = list(partes = list(n = 1L, partes = list())),
            slide_previews = structure(list(), truncado = FALSE), motivo_sin_imagen = "renderer_timeout", cache = list())
  out <- .graficos_preview_respuesta("sid", r, list(), "p_slide_1_grafico", 1L)
  expect_identical(out$motivo_sin_imagen, "renderer_timeout")
  r$slide_previews <- structure(list(c(.pr_png(), list(indice = 1L))), truncado = FALSE); r$motivo_sin_imagen <- NULL
  expect_true(is.na(.graficos_preview_respuesta("sid", r, list(), "p_slide_1_grafico", 1L)$motivo_sin_imagen))
})
