test_that("con el panel mas alto, la fraccion baja", {
  # El grosor se calibra contra una fila nominal de 0.42 in. Si el panel reparte
  # 0.84 —el doble—, la misma fraccion daria una barra del doble de gruesa: hay
  # que partirla por dos para que la barra mida lo mismo.
  expect_equal(.grosor_anclado_al_nominal(0.70, 0.42, 0.84), 0.35)
})


test_that("con el panel mas bajo, la fraccion sube", {
  expect_equal(.grosor_anclado_al_nominal(0.35, 0.42, 0.21), 0.70)
})


test_that("el grosor FISICO se conserva, que es de lo que se trata", {
  # La prueba de que el ancla hace lo que dice: dos laminas con distinto alto de
  # fila terminan con la misma barra en pulgadas.
  nominal <- 0.42
  frac0 <- 0.70
  objetivo <- frac0 * nominal

  # Desde el nominal hacia arriba se conserva exacto. Hacia abajo hay un limite:
  # con la fila en 0.30 la regla de tres pediria 0.98 de fraccion, el tope la
  # deja en 0.92 y la barra sale en 0.276 en vez de 0.294. Ese caso lo cubre el
  # test del tope; aqui se comprueba el tramo en que el ancla manda.
  for (real in c(0.42, 0.55, 0.70, 1.06)) {
    frac <- .grosor_anclado_al_nominal(frac0, nominal, real)
    expect_equal(.grosor_en_pulgadas(frac, real), objetivo, tolerance = 1e-9)
  }
})


test_that("cuando el tope muerde, la barra se queda corta y no se pega", {
  # Es la unica situacion en que dos gemelas NO igualan: preferir barras
  # pegadas para cuadrar el milimetro seria arreglar la vara rompiendo la
  # lamina.
  frac <- .grosor_anclado_al_nominal(0.70, 0.42, 0.30)
  expect_equal(frac, .GROSOR_TOPE_FRACCION)
  expect_lt(.grosor_en_pulgadas(frac, 0.30), 0.70 * 0.42)
})


test_that("sin panel impuesto no se toca nada", {
  # `alto_real == alto_nominal` es el caso de la lamina que reparte lo que se
  # calibro: la regla de tres es la identidad.
  expect_equal(.grosor_anclado_al_nominal(0.70, 0.42, 0.42), 0.70)
})


test_that("el ancla respeta el tope de fraccion", {
  # Con una fila muy corta la regla de tres pediria una fraccion mayor que uno,
  # y ahi las barras se tocarian. Una lamina apretada es peor que una barra que
  # no cuadra al milimetro con su gemela.
  expect_equal(.grosor_anclado_al_nominal(0.70, 0.42, 0.10), .GROSOR_TOPE_FRACCION)
  expect_lte(.grosor_anclado_al_nominal(0.90, 0.42, 0.05), .GROSOR_TOPE_FRACCION)
})


test_that("un dato ausente devuelve el grosor tal cual", {
  # Degradar a lo de antes es correcto; inventarse un alto no lo es.
  expect_equal(.grosor_anclado_al_nominal(0.70, NULL, 0.42), 0.70)
  expect_equal(.grosor_anclado_al_nominal(0.70, 0.42, NA_real_), 0.70)
  expect_equal(.grosor_anclado_al_nominal(0.70, 0, 0.42), 0.70)
  expect_equal(.grosor_anclado_al_nominal(0.70, 0.42, -1), 0.70)
})


test_that("un grosor ilegible se devuelve sin tocar", {
  expect_equal(.grosor_anclado_al_nominal(NA_real_, 0.42, 0.84), NA_real_)
  expect_equal(.grosor_anclado_al_nominal(0, 0.42, 0.84), 0)
})
