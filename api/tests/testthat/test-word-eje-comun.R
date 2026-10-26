source("setup-load-all.R")

# Gonzalo (2026-10-26): en el Word las apiladas y multiapiladas con el mismo tipo de rótulo (los públicos de un perfil)
# deben arrancar las barras en el mismo punto; las de rótulo largo (las premisas) conservan su columna. Una figura sin
# rótulo de fila no reserva columna y va a todo el ancho («si no tiene etiqueta, no tiene por qué reservar espacio»).

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

test_that("con la columna común, las figuras con rótulo corto arrancan juntas; la sin rótulo va a todo el ancho", {
  tres <- .wec_espec(c("Docentes", "Estudiantes", "Administrativos"))
  dos <- .wec_espec(c("Docentes", "Estudiantes"))
  uno <- .wec_espec("")
  largo <- .wec_espec(c("Los propósitos de la Unidad están definidos con claridad y se difunden entre todos sus miembros", "Otra premisa"))
  comun <- .word_rotulo_comun(list(tres, dos, uno, largo))
  expect_equal(comun, .word_rotulo_in(.word_escala_rotulos_envueltos(c("Docentes", "Estudiantes", "Administrativos"), .WORD_ESCALA_ENVOLTURA),
                                      .WORD_ESCALA_PT$rotulo_fila + .word_desplazo("rotulo")))
  expect_true(is.na(.word_columna_de(uno)))                              # sin rótulo no define la columna común
  withr::local_options(prosecnur.word_rotulo_comun = comun)
  a_tres <- .wec_arranque(.word_g_escala(tres)); a_dos <- .wec_arranque(.word_g_escala(dos)); a_largo <- .wec_arranque(.word_g_escala(largo))
  expect_equal(a_dos, a_tres, tolerance = 0.02)
  expect_lt(.wec_arranque(.word_g_escala(uno)), 0.5)                   # sin rótulo: todo el ancho, aun con columna común
  expect_gt(a_largo, a_tres + 0.3)                                      # la premisa larga conserva su columna, más ancha
})

test_that("sin ancho común, la escala se dibuja como siempre", {
  withr::local_options(prosecnur.word_rotulo_comun = NULL)
  uno <- .wec_espec("")
  expect_lt(.wec_arranque(.word_g_escala(uno)), 0.5)
})

# Gonzalo (2026-10-26): «¿por qué las de barras agrupadas no están alineadas? también lo deberían estar». Las categóricas
# del perfil entran a la misma columna común, por capítulo; el Sí/No de una fila no tiene rótulo y sigue a todo el ancho.
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

test_that("el Sí/No de una fila, sin rótulo, sigue a todo el ancho aunque el capítulo tenga columna común", {
  sino <- .wec_barras(c("Sí", "No"))
  expect_true(isTRUE(.lam_es_dicotomia(sino)))
  withr::local_options(prosecnur.word_rotulo_comun = 1.09)
  expect_lt(.wec_arranque_x0(.word_categorica(sino)), 0.05)
})

test_that("la columna común se calcula por capítulo", {
  sec <- function(t) list(kind = "section", title = t, meta = list(word_heading_level = 1L))
  fig <- function(es) list(kind = "chart", plot_word = structure(list(), pulso_espec = es))
  rm <- list(sec("Perfil"), fig(.wec_barras(c("Departamento Académico", "Facultad"))), sec("Resultados"),
             fig(.wec_espec(c("Docentes", "Estudiantes"))), fig(.wec_espec(c("Docentes", "Administrativos"))))
  cc <- .word_rotulo_comun_por_capitulo(rm)
  expect_length(cc, length(rm))
  expect_gt(cc[[2]], cc[[4]])                                                    # el perfil tiene su propia columna
  expect_identical(cc[[4]], cc[[5]])
})
