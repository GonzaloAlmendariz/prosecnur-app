# La guia arquitectonica vivia en DOS de los ~20 graficadores del paquete. En
# una misma lamina, sus dos graficos de barras salian con el plano turquesa y
# sus cotas, y sus dos pies con un rectangulo morado de 2.8 pt sin una sola
# medida. Lo que las diferenciaba no era el diseño: era quien las dibujaba.

test_that("el pie ya no dibuja su guia con un color propio", {
  # Era `#8A2BE2` con grosor 2.8 contra el turquesa fino de barras.
  f <- formals(graficar_pie)
  expect_equal(eval(f$debug_ph_col), .GUIA_COL)
  expect_equal(eval(f$debug_ph_lwd), .GUIA_LWD)
})


test_that("la nota de un pie dice su radio, que la cota de la caja no dice", {
  # El circulo no ocupa la caja: se inscribe en su lado corto. Sin esto, dos
  # pies con cajas distintas se ven distintos y la guia no dice por que.
  expect_match(.guia_nota_pie(3, 3), "^radio 3\\.81 cm$")
  expect_match(.guia_nota_pie(4, 2.5), "^radio 3\\.17 cm$")
})


test_that("un donut declara ademas su hueco", {
  nota <- .guia_nota_pie(4, 2.5, hueco = 0.55)
  expect_match(nota, "radio 3\\.17 cm")
  expect_match(nota, "hueco 1\\.75 cm")
})


test_that("un pie macizo NO inventa un hueco", {
  expect_false(grepl("hueco", .guia_nota_pie(3, 3, hueco = 0)))
  expect_false(grepl("hueco", .guia_nota_pie(3, 3)))
})


test_that("una caja ilegible da nota vacia en vez de `radio NA`", {
  expect_equal(.guia_nota_pie(NA, 3), "")
  expect_equal(.guia_nota_pie(0, 3), "")
  expect_equal(.guia_nota_pie(3, -1), "")
})


test_that("apagar la cota de ancho quita una cota, no el marco", {
  # Cinco bandas apiladas a todo el ancho repetian el mismo «15.75 cm».
  con <- .guia_ph_grobs(0, 0, 1, 1, 6, 3, etiqueta = "panel")
  sin <- .guia_ph_grobs(0, 0, 1, 1, 6, 3, etiqueta = "panel", cota_ancho = FALSE)
  expect_lt(length(sin), length(con))
  expect_gt(length(sin), 2L)
})


test_that("el rotulo se puede mandar al lado contrario del texto", {
  # En una banda de titulo el texto empieza arriba a la izquierda, justo donde
  # el rotulo: se pisaban.
  izq <- .guia_ph_grobs(0, 0, 1, 1, 6, 3, etiqueta = "cabecera")
  der <- .guia_ph_grobs(0, 0, 1, 1, 6, 3, etiqueta = "cabecera",
                        rotulo_derecha = TRUE)
  .just <- function(gs) {
    for (g in gs) if (inherits(g, "text")) return(as.character(g$just[1]))
    NA_character_
  }
  expect_equal(.just(izq), "left")
  expect_equal(.just(der), "right")
})


test_that("el envoltorio devuelve el bloque cuando no hay cotas que poner", {
  skip_if_not_installed("cowplot")
  g <- ggplot2::ggplot(data.frame(x = 1, y = 1), ggplot2::aes(x, y)) + ggplot2::geom_point()
  out <- .guia_envolver_bloque(g, ancho_in = 6, alto_in = 3, etiqueta = "panel")
  expect_s3_class(out, "ggplot")
})


# --- El recetario por graficador ---------------------------------------------
#
# Inventario medido: de los 17 archivos que definen un `graficar_*`, solo OCHO
# componen canvas con `cowplot`. Los otros nueve devuelven un ggplot suelto y no
# tienen bandas donde poner una cota. De esos ocho, cuatro dibujaban su guia con
# color propio.

test_that("las barras numericas dejan su morado propio", {
  # Era `#8A2BE2` con grosor 2, un tercer estilo distinto del de barras y del
  # del pie.
  f <- formals(graficar_barras_numericas)
  expect_equal(eval(f$debug_color_borde), .GUIA_COL)
  expect_equal(eval(f$debug_lwd), .GUIA_LWD)
})


test_that("el boxplot compone su guia con el color de la guia", {
  f <- formals(graficar_boxplot)
  expect_equal(eval(f$debug_ph_col), .GUIA_COL)
})


test_that("el envoltorio acepta un ggplot corriente, no solo un bloque cowplot", {
  # El boxplot no tiene bandas: se le envuelve el canvas entero.
  skip_if_not_installed("cowplot")
  g <- ggplot2::ggplot(data.frame(x = 1, y = 1), ggplot2::aes(x, y)) + ggplot2::geom_point()
  out <- .guia_envolver_bloque(g, ancho_in = 6, alto_in = 3, etiqueta = "canvas")
  expect_s3_class(out, "ggplot")
})
