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

# Gonzalo (2026-10-26): «¿por qué las de barras agrupadas no están alineadas? también lo deberían estar». Las categóricas
# del perfil y el Sí/No de una sola fila (sin rótulo, a todo el ancho) entran a la misma columna común, por capítulo.
.wec_barras <- function(rotulos) {
  p <- graficar_barras_categoricas(data.frame(cat = rotulos, n = seq_along(rotulos) * 10, pct = seq_along(rotulos) / sum(seq_along(rotulos))),
                                   "cat", var_valor = "pct", var_n = "n", var_pct = "pct", modo_valor = "valor", formato_valor = "porcentaje")
  attr(p, "pulso_espec")
}
.wec_arranque_x0 <- function(g) {   # pulgadas hasta x = 0 (donde nace la barra), sobre el ancho útil
  lim <- ggplot2::ggplot_build(g)$layout$panel_params[[1]]$x.range
  (0 - lim[1]) / (lim[2] - lim[1]) * .std_word("pagina", "ancho_util")
}

test_that("las barras categóricas de rótulo corto arrancan en la columna común; una categoría larga conserva la suya", {
  cortas <- .wec_barras(c("Femenino", "Masculino")); otras <- .wec_barras(c("Estudiante de pregrado", "Egresado"))
  larga <- .wec_barras(c("Docente a tiempo completo con dedicación exclusiva a la Facultad", "Otro"))
  comun <- .word_rotulo_comun(list(cortas, otras, larga))
  withr::local_options(prosecnur.word_rotulo_comun = comun)
  expect_equal(.wec_arranque_x0(.word_categorica(cortas)), .wec_arranque_x0(.word_categorica(otras)), tolerance = 0.03)
  expect_gt(.wec_arranque_x0(.word_categorica(larga)), .wec_arranque_x0(.word_categorica(otras)) + 0.3)
})

test_that("el Sí/No de una fila, sin rótulo, deja de ir a todo el ancho y arranca en la columna común", {
  sino <- .wec_barras(c("Sí", "No"))
  expect_true(isTRUE(.lam_es_dicotomia(sino)))
  withr::local_options(prosecnur.word_rotulo_comun = NULL)
  expect_lt(.wec_arranque_x0(.word_categorica(sino)), 0.05)                    # sin columna común: como siempre
  withr::local_options(prosecnur.word_rotulo_comun = 1.09)
  expect_gt(.wec_arranque_x0(.word_categorica(sino)), 1.0)
})

test_that("la columna común se calcula por capítulo", {
  sec <- function(t) list(kind = "section", title = t, meta = list(word_heading_level = 1L))
  fig <- function(es) list(kind = "chart", plot_word = structure(list(), pulso_espec = es))
  rm <- list(sec("Perfil"), fig(.wec_barras(c("Departamento Académico", "Facultad"))), sec("Resultados"),
             fig(.wec_espec(c("Docentes", "Estudiantes"))), fig(.wec_espec("")))
  cc <- .word_rotulo_comun_por_capitulo(rm)
  expect_length(cc, length(rm))
  expect_gt(cc[[2]], cc[[4]])                                                    # el perfil tiene su propia columna
  expect_identical(cc[[4]], cc[[5]])
})
