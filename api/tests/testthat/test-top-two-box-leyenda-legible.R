# La lamina `top_two_box` es la UNICA declaracion de la escala en un mazo que
# apaga la leyenda por lamina. Si sus rotulos se pisan, se pisa la leyenda del
# mazo entero.

.leyenda_x <- function(svg) {
  as.numeric(regmatches(svg, regexpr("(?<=<rect x=\")[0-9.]+", svg, perl = TRUE)))
}
.leyenda_size <- function(svg) {
  m <- regmatches(svg, gregexpr("(?<=font-size=\")[0-9.]+", svg, perl = TRUE))[[1]]
  if (!length(m)) return(NA_real_)
  as.numeric(m[[1]])
}
.leyenda_textos <- function(svg) {
  unlist(regmatches(svg, gregexpr("(?<=>)[^<>]+(?=</text>)", svg, perl = TRUE)))
}

test_that("con etiquetas largas el cuerpo baja para que entren en su gap", {
  largas <- c("Totalmente en Desacuerdo", "En desacuerdo",
              "De acuerdo", "Totalmente de Acuerdo")
  cortas <- c("1", "2", "3", "4")
  cols <- rep("#F4B183", 4)

  svg_largas <- .top_two_legend_svg(largas, cols, 160, 650, 20, "#002060", identity)
  svg_cortas <- .top_two_legend_svg(cortas, cols, 160, 650, 20, "#002060", identity)

  size_largas <- .leyenda_size(svg_largas[[1]])
  size_cortas <- .leyenda_size(svg_cortas[[1]])

  expect_lt(size_largas, size_cortas)
  expect_gte(size_largas, 9)
})

test_that("ninguna linea excede el ancho de su gap", {
  largas <- c("Totalmente en Desacuerdo", "En desacuerdo",
              "De acuerdo", "Totalmente de Acuerdo")
  svgs <- .top_two_legend_svg(largas, rep("#F4B183", 4), 160, 650, 20, "#002060", identity)

  xs <- vapply(svgs, .leyenda_x, numeric(1))
  gap <- min(diff(sort(xs)))

  for (s in svgs) {
    size <- .leyenda_size(s)
    for (txt in .leyenda_textos(s)) {
      # Misma estimacion que usa el helper para decidir el corte.
      ancho <- nchar(txt) * size * 0.55
      expect_lt(ancho, gap, label = paste0("'", txt, "' (", round(ancho), "px) en gap de ", round(gap), "px"))
    }
  }
})

test_that("una etiqueta que no cabe se trunca con puntos suspensivos", {
  svgs <- .top_two_legend_svg(
    c("Totalmente en Desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de Acuerdo"),
    rep("#F4B183", 4), 160, 650, 20, "#002060", identity
  )
  todos <- unlist(lapply(svgs, .leyenda_textos))
  expect_true(any(grepl("…", todos, fixed = TRUE)))
})

test_that("etiquetas cortas no se truncan ni pierden cuerpo", {
  svgs <- .top_two_legend_svg(c("1", "2", "3", "4"), rep("#F4B183", 4),
                              160, 650, 20, "#002060", identity)
  todos <- unlist(lapply(svgs, .leyenda_textos))
  expect_equal(sort(todos), c("1", "2", "3", "4"))
  expect_equal(.leyenda_size(svgs[[1]]), 20)
})
