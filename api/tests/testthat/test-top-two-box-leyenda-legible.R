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

test_that("la banda de leyenda no reserva el doble de lo que dibuja", {
  # Medido con las guías sobre «Conta 10-08»: la banda reservaba 38 px para
  # dibujar 16. El plano de holgura sumaba dos veces lo mismo — `alto_fila` ya
  # trae su interlineado del 35 % y encima se le añadía un margen fijo.
  etq <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo",
           "Totalmente de acuerdo", "SIN INF")

  for (size in c(9, 10.5, 12, 13.5, 16)) {
    banda <- .barras_leyenda_alto_in(etq, size, 13.33)
    filas <- .barras_leyenda_filas(etq, size, 13.33)
    texto <- filas * size / 72 * 1.35
    # Nunca por debajo del texto que va a dibujar…
    expect_gt(banda, texto)
    # …ni más del 60 % por encima. Antes, a 10,5 pt, era el 62 %.
    expect_lt(banda, texto * 1.60)
  }
})

test_that("el mazo de acreditación no se mueve: a 16 pt la banda es la de antes", {
  etq <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo",
           "Totalmente de acuerdo", "SIN INF")
  # 0.38" era el valor con el plano viejo (2 filas x 0.24 + 0.08 -> 0.56;
  # una fila -> 0.32). Con el nuevo reparto, una fila a 16 pt da 0.39.
  expect_equal(.barras_leyenda_alto_in(etq, 16, 13.33), 0.39, tolerance = 0.02)
})

test_that("cuando la leyenda pasa a dos filas, las reparte parejo", {
  # Bajando los ítems por fila de uno en uno, cinco categorías daban 4+1 y la
  # última —«SIN INF» en el mazo de acreditación— quedaba sola en su renglón.
  # El reparto se decide ahora desde el número de FILAS y sale equilibrado.
  e5 <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo",
          "Totalmente de acuerdo", "SIN INF")
  reparto <- function(etq, size, ancho, ...) {
    f <- .barras_leyenda_filas(etq, size, ancho, ...)
    as.integer(table(.barras_leyenda_reparto(length(etq), f)))
  }

  # Ancho real del canvas del mazo (medido: 10"): cinco no entran en una fila.
  expect_equal(reparto(e5, 16, 10, gap_npc = 0.012), c(3L, 2L))
  # Con canvas ancho sí entran, y una fila es mejor que dos.
  expect_equal(.barras_leyenda_filas(e5, 16, 13.33, gap_npc = 0.012), 1L)

  e6 <- c(e5[1:4], "Ni una ni otra", "SIN INF")
  expect_equal(reparto(e6, 16, 10, gap_npc = 0.012), c(3L, 3L))
})

test_that("el reparto reparte parejo para cualquier n y cualquier número de filas", {
  # La regla: los renglones difieren como mucho en un ítem. Un 3+3+1 —que es lo
  # que daba el reparto uniforme con 7 en 3 filas— deja el último solo.
  for (n in 2:12) {
    for (f in seq_len(n)) {
      cuenta <- as.integer(table(.barras_leyenda_reparto(n, f)))
      expect_equal(sum(cuenta), n)
      expect_equal(length(cuenta), f)
      expect_lte(max(cuenta) - min(cuenta), 1L)
    }
  }
  expect_equal(as.integer(table(.barras_leyenda_reparto(7, 3))), c(3L, 2L, 2L))
  expect_equal(as.integer(table(.barras_leyenda_reparto(5, 2))), c(3L, 2L))
})
