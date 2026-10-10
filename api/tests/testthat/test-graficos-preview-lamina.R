source("setup-load-all.R")

# F6.0b: la vista previa dice cuántas partes salió la lámina y si cada una es nativa (inventario F6, parte C).

.pl_mini_pptx <- function() {
  doc <- officer::read_pptx()
  # 1: nativa — el motor deja su gráfico como `prosecnur:grafico:<tipo>`
  doc <- officer::add_slide(doc, layout = "Blank", master = "Office Theme")
  doc <- officer::ph_with(doc, "Utilidad de los objetivos educacionales",
                          location = officer::ph_location(left = 0.5, top = 0.4, width = 8, height = 0.8, newlabel = "prosecnur:titulo"))
  doc <- officer::ph_with(doc, "97 %", location = officer::ph_location(left = 0.5, top = 1.5, width = 8, height = 4, newlabel = "prosecnur:grafico:escala"))
  # 2: continuación por la ruta anterior — el gráfico pegado como imagen
  png <- tempfile(fileext = ".png"); grDevices::png(png, 400, 240); graphics::par(mar = c(0, 0, 0, 0)); graphics::plot.new(); grDevices::dev.off()
  doc <- officer::add_slide(doc, layout = "Blank", master = "Office Theme")
  doc <- officer::ph_with(doc, "Utilidad de los objetivos educacionales (cont.)", location = officer::ph_location(left = 0.5, top = 0.4, width = 8, height = 0.8))
  doc <- officer::ph_with(doc, officer::external_img(png, 4, 2.4), location = officer::ph_location(left = 1, top = 1.5, width = 4, height = 2.4))
  # 3: sólo texto
  doc <- officer::add_slide(doc, layout = "Blank", master = "Office Theme")
  doc <- officer::ph_with(doc, "Conclusiones", location = officer::ph_location(left = 0.5, top = 0.4, width = 8, height = 0.8))
  # 4: estructura del motor sin gráfico (objetivo): su título vive en `objetivo:titulo` y el cuerpo es más largo
  doc <- officer::add_slide(doc, layout = "Blank", master = "Office Theme")
  doc <- officer::ph_with(doc, "OBJETIVO", location = officer::ph_location(left = 0.5, top = 0.4, width = 3, height = 0.8, newlabel = "objetivo:titulo"))
  doc <- officer::ph_with(doc, "Conocer la percepción de los estudiantes sobre el servicio educativo de la carrera",
                          location = officer::ph_location(left = 0.5, top = 1.5, width = 8, height = 2, newlabel = "prosecnur:objetivo"))
  f <- tempfile(fileext = ".pptx"); print(doc, target = f); f
}

test_that("las partes salen en orden, con su título, su continuación y si son nativas", {
  f <- .pl_mini_pptx()
  p <- .preview_partes(f)
  expect_equal(p$n, 4L)
  expect_equal(vapply(p$partes, `[[`, "", "estado"), c("nativa", "ruta_anterior", "sin_grafico", "estructura"))
  expect_equal(vapply(p$partes, `[[`, logical(1), "continuacion"), c(FALSE, TRUE, FALSE, FALSE))
  expect_equal(p$partes[[1]]$titulo, "Utilidad de los objetivos educacionales")
  expect_equal(p$partes[[4]]$titulo, "OBJETIVO")                    # no el cuerpo, que es más largo (verificador de 55ff0d1bf)
  expect_equal(vapply(p$partes, `[[`, integer(1), "indice"), 1:4)
})

test_that("un archivo que no se puede leer da cero partes, no un error", {
  expect_equal(.preview_partes(tempfile(fileext = ".pptx"))$n, 0L)
})

test_that("el orden es el de la presentación aunque los archivos de lámina estén numerados distinto", {
  f <- .pl_mini_pptx()
  d <- tempfile(); utils::unzip(f, exdir = d)
  pres <- file.path(d, "ppt/presentation.xml")
  x <- paste(readLines(pres, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  ids <- regmatches(x, gregexpr("<p:sldId [^>]*/>", x))[[1]]
  expect_length(ids, 4L)
  for (i in seq_along(ids)) x <- sub(ids[[i]], sprintf("@@%d@@", i), x, fixed = TRUE)   # la presentación invierte el orden
  for (i in seq_along(ids)) x <- sub(sprintf("@@%d@@", i), rev(ids)[[i]], x, fixed = TRUE)
  writeLines(x, pres, useBytes = TRUE)
  g <- tempfile(fileext = ".pptx")
  old <- setwd(d); on.exit(setwd(old), add = TRUE)
  utils::zip(g, list.files(".", recursive = TRUE, all.files = TRUE), flags = "-q -X")
  setwd(old)
  expect_equal(vapply(.preview_partes(g)$partes, `[[`, "", "estado"), c("estructura", "sin_grafico", "ruta_anterior", "nativa"))
})

test_that("se rasterizan todas las partes, no sólo la primera", {
  skip_if_not(isTRUE(.preview_renderer_status()$available), "sin renderer de vista previa")
  skip_if_not(nzchar(Sys.which("pdftoppm")) || requireNamespace("magick", quietly = TRUE) || .artifact_renderer_configured(),
              "sin rasterizador de PDF")
  f <- .pl_mini_pptx()
  r <- .render_pptx_preview_partes(f, 4L)
  expect_length(r, 4L)
  expect_true(all(vapply(r, function(x) grepl("^data:image/png;base64,", x$png_base64), logical(1))))
  expect_equal(vapply(r, `[[`, integer(1), "indice"), 1:4)
  expect_false(attr(r, "truncado"))
  r2 <- .render_pptx_preview_partes(f, 4L, max_partes = 2L)
  expect_length(r2, 2L)
  expect_true(attr(r2, "truncado"))
})

test_that("una parte que falla deja su hueco: la k-ésima imagen sigue siendo la parte k", {
  local_mocked_bindings(
    .artifact_renderer_configured = function() FALSE,
    .pptx_to_pdf_soffice = function(...) "x.pdf",
    .pdf_page_to_png = function(pdf_path, out_dir, renderer, page = 1L, ...) if (page == 2L) NULL else list(png_base64 = "data:image/png;base64,AA", width = 1L, height = 1L, renderer = "soffice")
  )
  r <- .render_pptx_preview_partes("x.pptx", 3L, max_partes = 3L)
  expect_length(r, 3L)
  expect_null(r[[2]])
  expect_equal(r[[3]]$indice, 3L)
})
