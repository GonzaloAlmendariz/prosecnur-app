# Anotaciones /Link por actualizacion incremental sobre el PDF de grDevices.
#
# Es el paso mas fragil del kit: toca la estructura del archivo, no el dibujo.
# Por eso cada prueba comprueba dos cosas distintas — que el enlace quedo, y
# que el PDF sigue siendo legible para un parser que no sea el nuestro (qpdf).

.pdl_make_pdf <- function(path, pages = 1L) {
  grDevices::pdf(path, width = 8.27, height = 11.69, onefile = TRUE)
  on.exit(grDevices::dev.off(), add = TRUE)
  for (i in seq_len(pages)) {
    grid::grid.newpage()
    grid::grid.text(sprintf("pagina %d", i), x = 0.5, y = 0.5)
  }
  path
}

.pdl_bytes <- function(path) readBin(path, "raw", n = file.info(path)$size)

test_that("el enlace queda en la pagina correcta y el PDF sigue siendo legible", {
  dir <- tempfile("pdl-"); dir.create(dir)
  path <- .pdl_make_pdf(file.path(dir, "dos.pdf"), pages = 2L)
  antes <- file.info(path)$size

  n <- pulso_pdf_add_link_annotations(path, list(
    list(page = 2L, x0 = 0.1, y0 = 0.2, x1 = 0.9, y1 = 0.25, url = "https://uno.test/a")
  ))
  expect_identical(n, 1L)

  raw <- .pdl_bytes(path)
  expect_gt(length(raw), antes)
  expect_true(length(grepRaw("/Subtype /Link", raw, fixed = TRUE)) > 0L)
  expect_true(length(grepRaw("/Prev", raw, fixed = TRUE)) > 0L)

  # qpdf es un parser independiente: si el xref incremental estuviera mal, aqui
  # se cae en vez de devolver el numero de paginas.
  expect_identical(qpdf::pdf_length(path), 2L)
  out <- qpdf::pdf_compress(path, file.path(dir, "rw.pdf"))
  expect_true(length(grepRaw("/URI", .pdl_bytes(out), fixed = TRUE)) > 0L)
})

test_that("el rectangulo traduce npc a puntos contra el MediaBox", {
  dir <- tempfile("pdl-rect-"); dir.create(dir)
  path <- .pdl_make_pdf(file.path(dir, "uno.pdf"))
  pulso_pdf_add_link_annotations(path, list(
    list(page = 1L, x0 = 0.25, y0 = 0.50, x1 = 0.75, y1 = 0.60, url = "https://rect.test")
  ))
  raw <- .pdl_bytes(path)
  at <- grepRaw("/Rect", raw, fixed = TRUE)
  txt <- rawToChar(raw[at[[1]]:(at[[1]] + 120L)])
  nums <- as.numeric(regmatches(txt, gregexpr("[0-9.]+", txt))[[1]])[1:4]

  # A4 vertical a 72 pt/pulgada: 8.27 x 11.69 -> 595 x 841 puntos.
  expect_equal(nums[[1]], 0.25 * 595, tolerance = 1)
  expect_equal(nums[[2]], 0.50 * 841, tolerance = 1)
  expect_equal(nums[[3]], 0.75 * 595, tolerance = 1)
  expect_equal(nums[[4]], 0.60 * 841, tolerance = 1)
})

test_that("los parentesis de la URL se escapan y no cierran el string PDF", {
  dir <- tempfile("pdl-esc-"); dir.create(dir)
  path <- .pdl_make_pdf(file.path(dir, "esc.pdf"))
  pulso_pdf_add_link_annotations(path, list(
    list(page = 1L, x0 = 0.1, y0 = 0.1, x1 = 0.9, y1 = 0.2,
         url = "https://x.test/a(b)c")
  ))
  raw <- .pdl_bytes(path)
  expect_true(length(grepRaw("a\\(b\\)c", raw, fixed = TRUE)) > 0L)
  expect_identical(qpdf::pdf_length(path), 1L)
})

test_that("sin enlaces utiles no se toca un solo byte del archivo", {
  dir <- tempfile("pdl-noop-"); dir.create(dir)
  path <- .pdl_make_pdf(file.path(dir, "noop.pdf"))
  antes <- .pdl_bytes(path)

  expect_identical(pulso_pdf_add_link_annotations(path, list()), 0L)
  expect_identical(pulso_pdf_add_link_annotations(path, list(list(page = 1L, url = ""))), 0L)
  expect_identical(.pdl_bytes(path), antes)
})

test_that("una pagina fuera de rango se ignora sin romper el PDF", {
  dir <- tempfile("pdl-range-"); dir.create(dir)
  path <- .pdl_make_pdf(file.path(dir, "range.pdf"))
  expect_identical(pulso_pdf_add_link_annotations(path, list(
    list(page = 9L, x0 = 0.1, y0 = 0.1, x1 = 0.9, y1 = 0.2, url = "https://fuera.test")
  )), 0L)
  expect_identical(qpdf::pdf_length(path), 1L)
})
