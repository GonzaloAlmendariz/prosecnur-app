# La guía se dibuja como un plano: línea fina y cada caja con su cota.

test_that("la cota se escribe en centimetros, con dos decimales", {
  # El motor mide en pulgadas —es la unidad de officer y del OOXML— pero quien
  # lee el plano compara contra una regla. Y dos decimales porque con uno, dos
  # huecos que difieren en un milímetro se leen iguales, y ese milímetro es el
  # que suele explicar por qué un texto no cabe.
  expect_identical(.guia_cota(2.164, 0.283), "5.50 × 0.72 cm")
  expect_identical(.guia_cota(1, 1), "2.54 × 2.54 cm")
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
  expect_match(g[[2]]$label, "23\\.70 × 8\\.38 cm")
})

test_that("una caja que no puede contener su cota se queda sin ella", {
  # Los huecos de una lámina son contiguos y varios miden décimas: escribirles
  # la cota igual la superpone con la del vecino y el resultado no se lee.
  # Medido: sin este corte, la esquina superior izquierda salía «02006×0028».
  angosta <- .guia_ph_grobs(0, 0, 0.01, 0.6, ancho_in = 13.33, alto_in = 5.5)
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
  expect_match(g[[2]]$label, "23\\.70")
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

test_that("la nota da el cuerpo en pt y el grosor en cm", {
  # La mezcla es deliberada: el cuerpo se declara en puntos en todas partes, y
  # pasarlo a cm no lo haría más comparable con nada. La geometría sí se compara
  # contra una regla.
  expect_identical(.guia_nota(13, 0.42), "13 pt  barra 1.07 cm")
  expect_identical(.guia_nota(14), "14 pt")
  expect_identical(.guia_nota(NULL, 1), "barra 2.54 cm")
  expect_identical(.guia_nota(), "")
})

test_that("el cuerpo no arrastra precision que nadie eligio", {
  # 3 de ggplot por el factor 2.845 da 8.535: escribirlo entero finge una
  # precisión que no existe.
  expect_identical(.guia_nota(8.535), "8.5 pt")
})

test_that("el marco nunca lleva relleno", {
  # Un relleno, por transparente que sea, altera el color de lo que hay debajo,
  # y el color es una de las cosas que se auditan con la guía puesta.
  g <- .guia_ph_grobs(0, 0, 0.7, 0.6, ancho_in = 13.33, alto_in = 5.5)
  expect_true(is.na(g[[1]]$gp$fill))
})
