source("setup-load-all.R")

# Gonzalo (2026-10-26): en el Word las apiladas y multiapiladas con el mismo tipo de rótulo (los públicos de un perfil)
# deben arrancar las barras en el mismo punto. La figura de un solo público, sin rótulo de fila, arrancaba en el borde
# izquierdo y la de «Docentes · Estudiantes · Administrativos» más a la derecha: la página se veía desordenada. Las de
# rótulo largo (las premisas) conservan su columna.

.wec_espec <- function(actores, N = rep(100, length(actores))) {
  rot <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF")
  d <- data.frame(actor = actores, N = N, p1 = .03, p2 = .08, p3 = .55, p4 = .29, p5 = .05)
  preparar_escala(d, "actor", "N", paste0("p", 1:5), setNames(rot, paste0("p", 1:5)), barra_extra_preset = "top2box",
                  top2box_labels = c("De acuerdo", "Totalmente de acuerdo"))
}
# Pulgadas desde el borde izquierdo de la figura hasta donde empieza la barra (x = 0), con la relación de `.word_xmin()`.
.wec_arranque <- function(g) {
  lim <- ggplot2::ggplot_build(g)$layout$panel_params[[1]]$x.range
  (0 - lim[1]) / (lim[2] - lim[1]) * (.std_word("pagina", "ancho_util") - 0.3)
}

test_that("con el ancho común del documento, la figura de un público sin rótulo arranca donde la de tres públicos", {
  tres <- .wec_espec(c("Docentes", "Estudiantes", "Administrativos"))
  uno <- .wec_espec("")
  largo <- .wec_espec(c("Los propósitos de la Unidad están definidos con claridad y se difunden entre todos sus miembros", "Otra premisa"))
  comun <- .word_rotulo_comun(list(tres, uno, largo))
  expect_equal(comun, .word_rotulo_in(.word_escala_rotulos_envueltos(c("Docentes", "Estudiantes", "Administrativos"), .WORD_ESCALA_ENVOLTURA),
                                      .WORD_ESCALA_PT$rotulo_fila + .word_desplazo("rotulo")))
  withr::local_options(prosecnur.word_rotulo_comun = comun)
  a_tres <- .wec_arranque(.word_g_escala(tres)); a_uno <- .wec_arranque(.word_g_escala(uno)); a_largo <- .wec_arranque(.word_g_escala(largo))
  expect_equal(a_uno, a_tres, tolerance = 0.02)
  expect_gt(a_largo, a_tres + 0.3)                     # la premisa larga conserva su columna, más ancha
})

test_that("sin ancho común, la escala se dibuja como siempre", {
  withr::local_options(prosecnur.word_rotulo_comun = NULL)
  uno <- .wec_espec("")
  expect_lt(.wec_arranque(.word_g_escala(uno)), 0.5)
})
