source("setup-load-all.R")

# El pie de los canvas de barras se anclaba al borde ABSOLUTO del lienzo:
# `x = hjust_caption`, que con la posicion por defecto ("derecha") vale 1. Toda
# nota de mas de una linea salia tocando o cruzando el borde derecho de la
# imagen. Se reproducia con cualquier `nota_pie`, en agrupadas y en apiladas.

.nota_larga <- paste0(
  "Fuente: encuesta de salida aplicada en agosto de 2026 a personas\n",
  "usuarias de los cuatro centros de atencion del programa."
)

.df_agrupadas <- function() {
  data.frame(
    categoria = c("Muy de acuerdo", "De acuerdo", "En desacuerdo", "Muy en desacuerdo"),
    N = 800,
    pct_1 = c(0.35, 0.225, 0.225, 0.20),
    pct_2 = c(0.15, 0.275, 0.30, 0.275),
    stringsAsFactors = FALSE
  )
}

# La x del caption dentro del canvas. `cowplot::draw_text` guarda el contenido
# en la columna `text` (no `label`, que es la de `geom_text` a secas), y esa `x`
# es la coordenada real con la que se dibuja.
.caption_x <- function(canvas, texto_inicio) {
  capas <- Filter(function(l) inherits(l$geom, "GeomText"), canvas$layers)
  for (l in capas) {
    d <- l$data
    if (!is.data.frame(d) || !all(c("text", "x") %in% names(d))) next
    hit <- grepl(texto_inicio, as.character(d$text), fixed = TRUE)
    if (any(hit)) return(as.numeric(d$x[which(hit)[1]]))
  }
  NA_real_
}

test_that("el area util del pie nunca llega al borde del lienzo", {
  der <- .graficos_caption_x(1, 0, 1)
  expect_lt(der$x, 1)
  expect_gt(der$x, 0.9)

  izq <- .graficos_caption_x(0, 0, 1)
  expect_gt(izq$x, 0)
  expect_lt(izq$x, 0.1)
})

test_that("el pie se alinea con la columna de contenido, no con el lienzo", {
  # Si el contenido termina en 0.9, el pie a la derecha termina cerca de 0.9,
  # no de 1: es lo que hace que se lea alineado con las barras.
  cap <- .graficos_caption_x(1, 0, 0.9)
  expect_lt(cap$x, 0.9)
  expect_gt(cap$x, 0.85)
})

test_that("el centro sigue siendo el centro del area util", {
  cap <- .graficos_caption_x(0.5, 0, 1)
  expect_equal(cap$x, 0.5, tolerance = 1e-9)
})

test_that("un area util degenerada no invierte los limites", {
  # Con una columna de contenido mas angosta que el margen, el margen se acota
  # en vez de producir x0 > x1 y un caption dibujado fuera de su zona.
  cap <- .graficos_caption_x(1, 0.5, 0.51)
  expect_lte(cap$x0, cap$x1)
  expect_gte(cap$x, cap$x0)
  expect_lte(cap$x, cap$x1)
})

test_that("entradas no finitas caen a un area util completa", {
  cap <- .graficos_caption_x(NA, NA, NA)
  expect_true(is.finite(cap$x))
  expect_lt(cap$x, 1)
})

test_that("barras agrupadas: el pie no toca el borde derecho", {
  skip_if_not_installed("ggplot2")
  skip_if_not_installed("cowplot")
  p <- graficar_barras_agrupadas(
    data = .df_agrupadas(), var_categoria = "categoria", var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2"),
    etiquetas_series = c(pct_1 = "Hombres", pct_2 = "Mujeres"),
    nota_pie = .nota_larga,
    usar_canvas = TRUE, exportar = "rplot"
  )
  x <- .caption_x(p, "Fuente: encuesta de salida")
  expect_false(is.na(x))
  expect_lt(x, 1)
})

test_that("barras agrupadas: el pie a la izquierda tampoco toca el borde", {
  skip_if_not_installed("ggplot2")
  skip_if_not_installed("cowplot")
  p <- graficar_barras_agrupadas(
    data = .df_agrupadas(), var_categoria = "categoria", var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2"),
    etiquetas_series = c(pct_1 = "Hombres", pct_2 = "Mujeres"),
    nota_pie = .nota_larga, pos_nota_pie = "izquierda",
    usar_canvas = TRUE, exportar = "rplot"
  )
  x <- .caption_x(p, "Fuente: encuesta de salida")
  expect_false(is.na(x))
  expect_gt(x, 0)
})

test_that("barras apiladas: el pie no toca el borde derecho", {
  skip_if_not_installed("ggplot2")
  skip_if_not_installed("cowplot")
  df <- data.frame(
    item = c("Trato del personal", "Tiempo de espera"),
    n = c(412, 412),
    insat = c(9, 29), ni = c(12, 21), sat = c(79, 50),
    stringsAsFactors = FALSE
  )
  p <- graficar_barras_apiladas(
    data = df, var_categoria = "item", var_n = "n",
    cols_porcentaje = c("insat", "ni", "sat"),
    etiquetas_grupos = c(insat = "Insatisfecho", ni = "Ni una ni otra", sat = "Satisfecho"),
    escala_valor = "proporcion_100",
    nota_pie = .nota_larga,
    usar_canvas = TRUE
  )
  x <- .caption_x(p, "Fuente: encuesta de salida")
  expect_false(is.na(x))
  expect_lt(x, 1)
})
