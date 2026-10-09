source("setup-load-all.R")

.we_espec <- function(total = FALSE) {
  rot <- c("Muy en desacuerdo", "En desacuerdo", "De acuerdo", "Muy de acuerdo", "SIN INF")
  d <- data.frame(actor = c("Docentes", "Estudiantes"), N = c(52, 172), p1 = c(.02, .03), p2 = c(.06, .11), p3 = c(.44, .51),
                  p4 = c(.46, .33), p5 = c(.02, .02))
  preparar_escala(d, "actor", "N", paste0("p", 1:5), setNames(rot, paste0("p", 1:5)), barra_extra_preset = "top2box",
                  top2box_labels = c("De acuerdo", "Muy de acuerdo"), fila_total = total)
}

test_that("la escala Word lee la espec: cifras dentro desde 7 %, las chicas arriba con guía y el Top Two Box en su columna", {
  e <- .we_espec(); g <- .word_g_escala(e)
  b <- suppressWarnings(ggplot2::ggplot_build(g))
  textos <- unlist(lapply(b$data, function(l) if ("label" %in% names(l)) as.character(l$label)))
  expect_true(all(c("44%", "46%", "51%", "33%", "11%") %in% textos))         # dentro
  expect_true(all(c("2%", "6%", "3%") %in% textos))                            # chicas, arriba
  expect_true(all(c(e$box$cifras, "Top Two Box") %in% textos))                 # columna y su rótulo, sin caerse del eje
  segs <- Filter(function(l) all(c("xend", "yend") %in% names(l)), b$data)
  expect_gte(sum(vapply(segs, nrow, 0L)), 6L)                                  # codo de cada cifra chica (vertical + horizontal)
  expect_equal(attr(g, "alto"), .word_alto_figura("escala", attr(g, "filas")))
  expect_equal(attr(g, "filas"), 2 * 1.3)                                      # con chicas, cada fila mide 1.3
})

test_that("con fila Total un filete la separa de los públicos", {
  g <- .word_g_escala(.we_espec(total = TRUE))
  b <- suppressWarnings(ggplot2::ggplot_build(g))
  segs <- Filter(function(l) all(c("x", "xend") %in% names(l)) && any(l$xend == 116), b$data)
  expect_length(segs, 1L)
})
