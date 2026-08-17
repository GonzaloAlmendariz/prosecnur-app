# El radar dibujaba su guia con el color correcto y SIN una sola cota: seis
# cajas —cabecera, panel, tabla nativa, leyenda, pie— marcadas con un rectangulo
# y ninguna medida. Con dos radares en la misma lamina no habia forma de
# comprobar por que salen distintos.

test_that("la nota del radar dice cuantos ejes reparten su tela", {
  expect_equal(.guia_nota_radar(5), "5 ejes")
  expect_equal(.guia_nota_radar(9), "9 ejes")
})


test_that("la nota NO dice el radio, porque no puede medirlo", {
  # El primer intento decia `min(w, h) / 2`, el radio INSCRITO EN LA CAJA. En el
  # render, sobre una caja de 14.48 x 6.04 cm anunciaba «tela 3.02 cm» y el
  # pentagono dibujado medía la mitad: su tamaño sale de `radar_scale` y de la
  # expansion de la escala, en coordenadas que esta funcion no ve. Es el defecto
  # de P24 —una cota que mide el nominal y no lo dibujado— y antes que una cifra
  # falsa, ninguna.
  expect_false(grepl("tela|radio|cm", .guia_nota_radar(5)))
  expect_false(grepl("cm", .guia_nota_radar(5, 24)))
})


test_that("el ancho de envoltura de las etiquetas si viaja", {
  # Es un parametro de diseño real y explica que dos radares se vean distintos.
  expect_equal(.guia_nota_radar(5, 24), "5 ejes  etiqueta 24 car.")
})


test_that("sin datos utilizables la nota queda vacia, no «NA ejes»", {
  expect_equal(.guia_nota_radar(NA), "")
  expect_equal(.guia_nota_radar(0), "")
  expect_equal(.guia_nota_radar(-3), "")
  expect_equal(.guia_nota_radar(5, 0), "5 ejes")
})


test_that("el pie SI declara su radio, y por eso son notas distintas", {
  # En un pie el circulo se inscribe en el lado corto de su caja —comprobado en
  # su render—, asi que ahi la cifra es real.
  expect_match(.guia_nota_pie(3, 3), "radio")
  expect_false(grepl("radio", .guia_nota_radar(5)))
})


test_that("el radar compone su guia con el color de la guia, no uno propio", {
  f <- formals(graficar_radar)
  expect_equal(eval(f$debug_ph_col), .GUIA_COL)
  expect_equal(eval(f$debug_ph_lwd), .GUIA_LWD)
})
