# Avance por celda facultad x sexo: logrado / previsto / proyectado / calibracion.

test_that("los cinco estados proyectados dicen si VAS a llegar, no si ya llegaste", {
  e <- .mac_estado_proyectado
  expect_identical(e(0, 5), "sin_cuota")
  # Con 5 % de margen o mas, asegurada; por encima de la cuota pero por debajo
  # del margen, ajustada: la celda llega pero no sobra nada y hay que vigilarla.
  expect_identical(e(100, 120), "asegurada")
  expect_identical(e(100, 105), "asegurada")
  expect_identical(e(100, 104), "ajustada")
  expect_identical(e(100, 100), "ajustada")
  expect_identical(e(100, 99), "deficit_proyectado")
})

test_that("«no subsanable» exige saber que no queda pool; sin saberlo no se declara", {
  e <- .mac_estado_proyectado
  # Con pool agotado la accion de campo ya no existe: queda ponderar. Es el
  # estado que tuvo EE.GG. LETRAS hombres en 2025 (166 de 180, peso 1,1538).
  expect_identical(e(100, 90, 0), "deficit_no_subsanable")
  # Con pool disponible, o sin saber si lo hay, se pide una accion posible en
  # vez de declarar una derrota que quiza no lo sea.
  expect_identical(e(100, 90, 5), "deficit_proyectado")
  expect_identical(e(100, 90, NA), "deficit_proyectado")
})

test_that("la proyeccion mira adelante y por eso NO comparte estado con la celda retrospectiva", {
  # `alcanzada` (ya llegaste) y `asegurada` (vas a llegar) son lecturas
  # distintas y tienen que seguir siendo palabras distintas.
  proy <- unique(.mac_estado_proyectado(c(100, 100, 100), c(120, 100, 50)))
  retro <- unique(.monitoreo_aulas_quota_estado(c(100, 100, 100), c(120, 100, 50)))
  expect_length(intersect(proy, retro), 0L)
})

test_that("la brecha se pide entera y hacia arriba: 0,1 personas es una persona", {
  expect_identical(.mac_brecha(100, 97.4), 3L)
  expect_identical(.mac_brecha(34, 33.9), 1L)
  # Cubierta o de sobra, cero. Nunca negativa: «sobran 3» no es una brecha.
  expect_identical(.mac_brecha(100, 100), 0L)
  expect_identical(.mac_brecha(100, 130), 0L)
})

test_that("la calibracion compara lo logrado con lo que se preveia", {
  # El sesgo de 2025: la composicion lograda se fue +3,4 pp hacia mujeres, con
  # 10 de 14 facultades en la misma direccion. Una celda de hombres que rinde
  # 85 donde se preveian 100 lo canta con un 0,85.
  expect_equal(.mac_calibracion(85, 100), 0.85)
  expect_equal(.mac_calibracion(120, 100), 1.2)
})

test_that("sin previsto la calibracion es NA, no cero", {
  # Una celda cuyas aulas aun no se aplican no esta descalibrada: es que todavia
  # no hay con que comparar. Un 0 la pintaria de rojo el primer dia de campo.
  expect_true(is.na(.mac_calibracion(0, 0)))
  expect_true(is.na(.mac_calibracion(10, NA)))
  expect_true(is.na(.mac_calibracion(NA, 100)))
})

test_that("el umbral de `ajustada` es el 5 % que se decidio, y esta declarado", {
  expect_equal(.MAC_MARGEN_AJUSTADA, 0.05)
  # Justo por debajo y justo por encima del umbral, para que mover el numero
  # rompa el test en vez de cambiar el color en silencio.
  expect_identical(.mac_estado_proyectado(100, 105), "asegurada")
  expect_identical(.mac_estado_proyectado(100, 104.9), "ajustada")
})
