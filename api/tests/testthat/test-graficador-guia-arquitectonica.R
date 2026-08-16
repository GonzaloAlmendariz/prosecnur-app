# La guía se dibuja como un plano: línea fina y cada caja con su cota.

test_that("la cota lleva dos decimales", {
  # Con uno, dos huecos que difieren en 0.04 in se leen iguales, y esa
  # diferencia es la que suele explicar por qué un texto no cabe.
  expect_identical(.guia_cota(2.164, 0.283), "2.16 × 0.28")
  expect_identical(.guia_cota(13.33, 1.18), "13.33 × 1.18")
})

test_that("una cota sin medidas no se inventa", {
  expect_identical(.guia_cota(NA_real_, 1), "")
  expect_identical(.guia_cota(1, NA_real_), "")
})

test_that("una caja grande lleva marco y cota", {
  g <- .guia_ph_grobs(0, 0, 0.7, 0.6, ancho_in = 13.33, alto_in = 5.5)
  expect_length(g, 2L)
  expect_true(inherits(g[[1]], "rect"))
  expect_true(inherits(g[[2]], "text"))
  expect_match(g[[2]]$label, "9\\.33 × 3\\.30")
})

test_that("una caja que no puede contener su cota se queda sin ella", {
  # Los huecos de una lámina son contiguos y varios miden décimas: escribirles
  # la cota igual la superpone con la del vecino y el resultado no se lee.
  # Medido: sin este corte, la esquina superior izquierda salía «02006×0028».
  angosta <- .guia_ph_grobs(0, 0, 0.02, 0.6, ancho_in = 13.33, alto_in = 5.5)
  expect_length(angosta, 1L)

  baja <- .guia_ph_grobs(0, 0, 0.7, 0.01, ancho_in = 13.33, alto_in = 5.5)
  expect_length(baja, 1L)
})

test_that("sin dimensiones del canvas se dibuja solo el marco", {
  g <- .guia_ph_grobs(0, 0, 0.7, 0.6)
  expect_length(g, 1L)
})

test_that("la etiqueta del hueco precede a la cota", {
  g <- .guia_ph_grobs(0, 0, 0.7, 0.6, ancho_in = 13.33, alto_in = 5.5,
                      etiqueta = "canal_grupo")
  expect_match(g[[2]]$label, "^canal_grupo\\s")
  expect_match(g[[2]]$label, "9\\.33")
})

test_that("el estilo es de plano y no de subrayador", {
  # El magenta de 0.6 pintaba una banda sobre lo que se auditaba: 978 bordes en
  # 48 láminas escondieron el hallazgo de los tamaños de letra.
  expect_lte(.GUIA_LWD, 0.3)
  expect_false(toupper(.GUIA_COL) %in% c("#FF00FF", "#F0F", "MAGENTA"))
  # Y el default del graficador es el del plano, no uno suyo.
  fmls <- formals(graficar_barras_apiladas)
  expect_identical(eval(fmls$debug_ph_col), .GUIA_COL)
  expect_identical(eval(fmls$debug_ph_lwd), .GUIA_LWD)
})

test_that("el marco nunca lleva relleno", {
  # Un relleno, por transparente que sea, altera el color de lo que hay debajo,
  # y el color es una de las cosas que se auditan con la guía puesta.
  g <- .guia_ph_grobs(0, 0, 0.7, 0.6, ancho_in = 13.33, alto_in = 5.5)
  expect_true(is.na(g[[1]]$gp$fill))
})
