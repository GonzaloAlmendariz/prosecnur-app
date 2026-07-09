source("setup-load-all.R")

test_that("tokens Pulso PDF exponen la paleta canónica de marca", {
  tok <- pulso_pdf_tokens()
  expect_equal(tok$navy, "#002457")
  expect_equal(tok$ink, "#1f2933")
  expect_equal(tok$soft, "#5f6b7a")
  expect_true(all(c("line", "rule", "tbl_header", "tbl_zebra", "tbl_frame") %in% names(tok)))
})

test_that("geometría de página distingue vertical y apaisado", {
  p <- pulso_pdf_geo("portrait")
  l <- pulso_pdf_geo("landscape")
  expect_equal(c(p$page_w, p$page_h), c(8.27, 11.69))
  expect_equal(c(l$page_w, l$page_h), c(11.69, 8.27))
})

test_that("calibración de ancho llena la columna (char-per-npc)", {
  expect_equal(pulso_pdf_chars(0.436), floor(0.436 * 150))
  expect_gte(pulso_pdf_chars(0.01), 14L)  # piso
})

test_that("cabecera y pie Pulso PDF renderizan en ambas orientaciones", {
  for (o in c("portrait", "landscape")) {
    geo <- pulso_pdf_geo(o)
    path <- tempfile(fileext = ".pdf")
    grDevices::pdf(path, width = geo$page_w, height = geo$page_h, onefile = TRUE)
    grid::grid.newpage()
    expect_silent(pulso_pdf_header("Título", "Subtítulo", geo = geo))
    expect_silent(pulso_pdf_footer(1, "Julio 2026", geo = geo))
    grDevices::dev.off()
    expect_true(file.exists(path))
    expect_gt(file.info(path)$size, 1500)
    unlink(path)
  }
})
