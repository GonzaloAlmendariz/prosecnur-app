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
  expect_gt(attr(g, "alto"), attr(g, "alto_fijo"))                               # N25: el alto sale del eje y y del grosor común, ya no de la fórmula lineal
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

# N7 (Renzo, informe Arte, 2026-10-22): con enunciados largos la columna de etiquetas era angosta (22 caracteres), cada
# enunciado salía en 7-8 líneas y la figura «absurdamente alta». Antes: 6,50 in para cinco enunciados de ~110 caracteres.
test_that("los enunciados largos se envuelven ancho, con tope de líneas, y la figura no sale absurdamente alta", {
  enun <- c("La unidad cuenta con gestores universitarios que conocen con claridad los procedimientos administrativos vigentes en la universidad",
            "Los gestores universitarios responden de manera oportuna a las solicitudes que presentan docentes y estudiantes de la unidad académica",
            "La dotación de personal administrativo es suficiente para atender las necesidades de funcionamiento de la unidad",
            "Existen mecanismos claros para evaluar el desempeño del personal administrativo y de los gestores de la unidad",
            "Las capacitaciones dirigidas al personal administrativo responden a las necesidades de la gestión de la unidad")
  rot <- c("Muy en desacuerdo", "En desacuerdo", "De acuerdo", "Muy de acuerdo", "SIN INF")
  d <- data.frame(actor = enun, N = 100, p1 = .10, p2 = .12, p3 = .40, p4 = .34, p5 = .04)
  e <- preparar_escala(d, "actor", "N", paste0("p", 1:5), setNames(rot, paste0("p", 1:5)), barra_extra_preset = "top2box",
                       top2box_labels = c("De acuerdo", "Muy de acuerdo"))
  g <- .word_g_escala(e)
  b <- suppressWarnings(ggplot2::ggplot_build(g))
  lb <- unlist(lapply(b$data, function(l) if ("label" %in% names(l)) as.character(l$label)))
  fila <- lb[grepl("gestores|personal", lb)]
  expect_lte(max(vapply(strsplit(fila, "\n"), length, 1L)), 4L)                 # tope de líneas
  expect_lte(attr(g, "alto"), 4.6)                                              # antes 6,50 in (N25: 4,4 con la fórmula lineal; con grosor común de 0,70 cm, 4,41)
  expect_gte(.WORD_ESCALA_ENVOLTURA, 40L)
})

# N5b (Renzo, Arte, 2026-10-22): dos o tres segmentos chicos seguidos salían con las cifras pegadas («1 %3 %»). Las cifras
# chicas se separan en pulgadas (ancho del texto + respiro), a la derecha, y cada una conserva su guía hasta el segmento.
.we_espec_chicas_seguidas <- function() {
  rot <- c("Muy en desacuerdo", "En desacuerdo", "De acuerdo", "Muy de acuerdo", "SIN INF")
  d <- data.frame(actor = c("Se siente respaldado por la dirección de la institución educativa", "Considera que la comunicación con los padres de familia es fluida"),
                  N = c(52, 172), p1 = c(.01, .01), p2 = c(.03, .02), p3 = c(.45, .05), p4 = c(.51, .42), p5 = c(0, .50))
  preparar_escala(d, "actor", "N", paste0("p", 1:5), setNames(rot, paste0("p", 1:5)), barra_extra_preset = "top2box",
                  top2box_labels = c("De acuerdo", "Muy de acuerdo"))
}

test_that("las cifras chicas de segmentos seguidos no se solapan (ancho del texto + 0,03 in) y cada una conserva su guía", {
  g <- .word_g_escala(.we_espec_chicas_seguidas())
  b <- suppressWarnings(ggplot2::ggplot_build(g))
  k <- diff(b$layout$panel_params[[1]]$x.range) / (.std_word("pagina", "ancho_util") - 0.3)   # unidades del eje por pulgada
  pt <- .word_escala_pt_efectivo("cifra_chica")
  tx <- Filter(function(l) "label" %in% names(l) && any(as.character(l$label) %in% c("1%", "3%", "2%", "5%")), b$data)
  tx <- do.call(rbind, lapply(tx, function(l) l[as.character(l$label) %in% c("1%", "2%", "3%", "5%"), c("x", "y", "label")]))
  expect_equal(nrow(tx), 5L)
  segs <- do.call(rbind, lapply(Filter(function(l) all(c("xend", "yend") %in% names(l)), b$data), function(l) l[, c("x", "xend", "y", "yend")]))
  for (y in unique(tx$y)) {
    f <- tx[tx$y == y, ]; f <- f[order(f$x), ]
    w <- vapply(as.character(f$label), function(s) .word_texto_in(s, pt), 0)
    if (nrow(f) > 1) for (j in 2:nrow(f)) {
      sep_in <- (f$x[j] - f$x[j - 1]) / k - (w[j] + w[j - 1]) / 2
      expect_gte(sep_in, 0.03 - 1e-9)
    }
    # cada cifra tiene una guía horizontal que llega hasta su centro
    for (xi in f$x) expect_true(any(abs(segs$xend - xi) < 1e-6 & segs$y == segs$yend))
  }
})

# N25 (Renzo, Arte, 2026-10-22): el grosor de la barra era distinto en cada figura (escala de 1 barra 0,92 cm, de 5 enunciados
# largos 0,62, categóricas 0,55-0,6, apilada 1,2). El alto de la figura se fija desde su eje y: grosor = (alto - parte fija) / (rango y) * fracción.
.grosor_cm <- function(g, h) (attr(g, "alto") - attr(g, "alto_fijo")) / diff(suppressWarnings(ggplot2::ggplot_build(g))$layout$panel_params[[1]]$y.range) * h * 2.54

test_that("N25: la barra mide lo mismo (grosor objetivo) en escala de 1 y de 5 filas, barras de 3 y de 6 y apilada Sí/No", {
  h_esc <- .std_word("figura", "alto_apilada")$grosor_fraccion %||% 0.58
  rot <- c("Muy en desacuerdo", "En desacuerdo", "De acuerdo", "Muy de acuerdo", "SIN INF")
  enun <- c("Existen mecanismos claros para evaluar el desempeño del personal administrativo y de los gestores de la unidad",
            "Las capacitaciones dirigidas al personal administrativo responden a las necesidades de la gestión de la unidad",
            "Corto", "Otro enunciado de longitud media para la prueba", "Último")
  esc <- function(n) preparar_escala(data.frame(actor = enun[seq_len(n)], N = 100, p1 = .10, p2 = .12, p3 = .40, p4 = .34, p5 = .04), "actor", "N",
                                     paste0("p", 1:5), setNames(rot, paste0("p", 1:5)))
  esc_ttb <- preparar_escala(data.frame(actor = enun[1], N = 100, p1 = .10, p2 = .12, p3 = .40, p4 = .34, p5 = .04), "actor", "N", paste0("p", 1:5),
                             setNames(rot, paste0("p", 1:5)), barra_extra_preset = "top2box", top2box_labels = c("De acuerdo", "Muy de acuerdo"))
  bar <- function(n) preparar_categorica(paste("Opción", LETTERS[seq_len(n)], "con un rótulo algo largo para la prueba"), seq(.5, .05, length.out = n), paste0(seq_len(n), "%"))
  sn <- function(p) preparar_categorica(c("Sí", "No"), c(p, 1 - p), c(sprintf("%d%%", round(p * 100)), sprintf("%d%%", round((1 - p) * 100))))
  g <- list(esc1 = .word_g_escala(esc(1)), esc5 = .word_g_escala(esc(5)), esc_ttb = .word_g_escala(esc_ttb),
            bar3 = .word_g_barras(bar(3)), bar6 = .word_g_barras(bar(6)), sino = .word_g_sino(sn(.55)), sino_ch = .word_g_sino(sn(.04)))
  h <- c(esc1 = h_esc, esc5 = h_esc, esc_ttb = h_esc, bar3 = 0.64, bar6 = 0.64, sino = 1, sino_ch = 1)
  gr <- mapply(function(x, hh) .grosor_cm(x, hh), g, h)
  expect_equal(unname(gr), rep(.WORD_GROSOR_BARRA_CM, length(gr)), tolerance = 0.01)
  expect_lte(max(vapply(g, function(x) attr(x, "alto"), 0)), 8.5)
})
