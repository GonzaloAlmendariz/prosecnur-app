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

# Top Two Box y Bottom Two Box juntos: en x = 110/124 los rótulos se encimaban y «Bottom Two Box» se cortaba en el borde
# del eje (F-d, láminas 24 y 42 de acrconta_mazo). Cada columna tiene ahora su ancho, como en la lámina 79 del recetario
# PPT: rótulo en una línea centrado sobre su cifra, la Bottom Two Box a la derecha sin tocar la Top Two Box, y todo
# dentro del eje. Se mide en pulgadas con la misma métrica que fija la geometría, para rótulos de fila cortos y largos.
.we_espec_b2b <- function(actores = c("Docentes", "Estudiantes"), total = FALSE) {
  rot <- c("Muy en desacuerdo", "En desacuerdo", "De acuerdo", "Muy de acuerdo", "SIN INF")
  n <- length(actores)
  d <- data.frame(actor = actores, N = rep(100, n), p1 = .10, p2 = .12, p3 = .40, p4 = .34, p5 = .04)
  preparar_escala(d, "actor", "N", paste0("p", 1:5), setNames(rot, paste0("p", 1:5)), barra_extra_preset = "top2box",
                  top2box_labels = c("De acuerdo", "Muy de acuerdo"), columna_bottom2box = TRUE,
                  bottom2box_labels = c("Muy en desacuerdo", "En desacuerdo"), fila_total = total)
}

.we_extension <- function(g, x, texto, pt) {
  sx <- suppressWarnings(ggplot2::ggplot_build(g))$layout$panel_params[[1]]$x.range
  k <- diff(sx) / (.std_word("pagina", "ancho_util") - 0.3)                    # unidades del eje por pulgada
  w <- .word_texto_in(texto, pt) * k
  c(izq = x - w / 2, der = x + w / 2, xmin = sx[1], xmax = sx[2])
}

test_that("con Top Two Box y Bottom Two Box los dos rótulos caben enteros y no se enciman", {
  pt_rot <- .word_pt(7.5) * ggplot2::.pt; pt_cif <- .word_pt(10) * ggplot2::.pt
  for (actores in list(c("Docentes", "Estudiantes"), c("Personal administrativo de apoyo de la facultad", "Egresados"))) {
    e <- .we_espec_b2b(actores, total = TRUE); g <- .word_g_escala(e)
    col <- attr(g, "columnas_box")
    expect_false(is.na(col$x2))
    b <- suppressWarnings(ggplot2::ggplot_build(g))
    textos <- unlist(lapply(b$data, function(l) if ("label" %in% names(l)) as.character(l$label)))
    expect_true(all(c("Top Two Box", "Bottom Two Box", e$box$cifras, e$box2$cifras) %in% textos))
    t1 <- .we_extension(g, col$x1, "Top Two Box", pt_rot); t2 <- .we_extension(g, col$x2, "Bottom Two Box", pt_rot)
    expect_lt(t1[["der"]], t2[["izq"]])                                         # no se enciman
    expect_gt(t1[["izq"]], 100)                                                 # el rótulo no invade las barras
    expect_lte(t2[["der"]], t2[["xmax"]])                                       # «Bottom Two Box» entero dentro del eje
    for (cf in e$box2$cifras) expect_lte(.we_extension(g, col$x2, cf, pt_cif)[["der"]], t2[["xmax"]])
    # Cifra y rótulo comparten centro (recetario PPT, checklist E1), y el filete de la Total llega hasta la Bottom Two Box.
    capas <- Filter(function(l) "label" %in% names(l) && any(l$label == "Bottom Two Box"), b$data)
    expect_equal(capas[[1]]$x[1], col$x2)
    segs <- Filter(function(l) all(c("x", "xend") %in% names(l)) && !("label" %in% names(l)) && nrow(l) == 1L, b$data)
    expect_true(any(vapply(segs, function(l) l$xend >= t2[["der"]] - 1, logical(1))))
  }
})

test_that("con sólo el Top Two Box la geometría es la del recetario Word (x = 110, eje hasta 121)", {
  g <- .word_g_escala(.we_espec())
  col <- attr(g, "columnas_box")
  expect_equal(col$x1, 110); expect_true(is.na(col$x2)); expect_equal(col$xmax, 121)
})
