test_that("una cota lleva linea, topes, halo y cifra", {
  # Una cota no es una etiqueta: sin los topes no se ve donde empieza y donde
  # acaba. Y sin el halo, la cifra que cruza una barra de color no se lee.
  g <- .guia_cota_grobs(0.02, 0.98, 0.05, 0.05, "17.43 cm")
  expect_length(g, 4L)
  expect_equal(vapply(g, function(x) class(x)[1], ""),
               c("lines", "segments", "roundrect", "text"))
})


test_that("el halo va DETRAS de la cifra, no delante", {
  # Si se dibujara despues, taparia el numero que viene a hacer legible.
  g <- .guia_cota_grobs(0.02, 0.98, 0.05, 0.05, "17.43 cm")
  clases <- vapply(g, function(x) class(x)[1], "")
  expect_lt(which(clases == "roundrect"), which(clases == "text"))
})


test_that("la cifra va en el punto medio de la cota", {
  g <- .guia_cota_grobs(0.10, 0.90, 0.05, 0.05, "10 cm")
  txt <- g[[4]]
  expect_equal(as.numeric(txt$x), 0.50)
  expect_equal(as.numeric(txt$y), 0.05)
})


test_that("la cota vertical se rota y la horizontal no", {
  h <- .guia_cota_grobs(0.02, 0.98, 0.05, 0.05, "ancho")
  v <- .guia_cota_grobs(0.03, 0.03, 0.02, 0.98, "alto")
  expect_equal(h[[4]]$rot, 0)
  expect_equal(v[[4]]$rot, 90)
})


test_that("los topes son perpendiculares a la cota", {
  # Horizontal: los topes son verticales, asi que x0 == x1 en cada extremo.
  h <- .guia_cota_grobs(0.10, 0.90, 0.05, 0.05, "ancho")
  expect_equal(as.numeric(h[[2]]$x0), as.numeric(h[[2]]$x1))
  # Vertical: los topes son horizontales, asi que y0 == y1.
  v <- .guia_cota_grobs(0.03, 0.03, 0.10, 0.90, "alto")
  expect_equal(as.numeric(v[[2]]$y0), as.numeric(v[[2]]$y1))
})


test_that("los topes caen en los dos extremos, no en el centro", {
  h <- .guia_cota_grobs(0.10, 0.90, 0.05, 0.05, "ancho")
  expect_equal(sort(as.numeric(h[[2]]$x0)), c(0.10, 0.90))
})


test_that("una cota con coordenadas invalidas no dibuja nada", {
  # Devolver grobs a medias ensuciaria la lamina sin decir nada.
  expect_length(.guia_cota_grobs(NA, 1, 0, 1, "x"), 0L)
  expect_length(.guia_cota_grobs(0, NULL, 0, 1, "x"), 0L)
})


test_that("la caja del plano incluye marco, rotulo y sus dos cotas", {
  g <- .guia_ph_grobs(0, 0, 1, 1, ancho_in = 12.5, alto_in = 6,
                      etiqueta = "barras", nota = "14 pt")
  # marco + rotulo + 4 grobs por cota x 2 cotas
  expect_length(g, 10L)
  expect_equal(class(g[[1]])[1], "rect")
})


test_that("una caja SIN nombre no se acota", {
  # Una lamina tiene ocho o mas cajas anidadas —buffers incluidos— y acotarlas
  # todas amontonaba dieciseis cotas: los halos tapaban el texto que la guia
  # venia a dejar medir.
  g <- .guia_ph_grobs(0, 0, 1, 1, ancho_in = 12.5, alto_in = 6)
  expect_length(g, 2L)
  expect_equal(class(g[[1]])[1], "rect")
})


test_that("una caja demasiado pequena se queda solo con el marco", {
  # Por debajo del minimo no se acota: las cifras se montarian con las del
  # hueco vecino y ninguna se leeria.
  g <- .guia_ph_grobs(0, 0, 0.05, 0.02, ancho_in = 12.5, alto_in = 6)
  expect_length(g, 1L)
})
