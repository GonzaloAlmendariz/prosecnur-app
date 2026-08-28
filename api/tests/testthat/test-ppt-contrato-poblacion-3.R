# El contrato de `poblacion_3` mapea cada slot a un índice de placeholder de la
# plantilla. Ese mapeo se dio por supuesto —por analogía con `poblacion_4`— y
# estaba rotado una posición: lo declarado «superior_izquierda» salía en el
# panel alto de la derecha. Este test fija el mapeo contra la geometría real.

contrato_pic <- function(nombre) {
  slots <- .PPT_CONTRACT[[nombre]]$slots
  vapply(slots[c("up_left", "bottom_left", "right")],
         function(s) as.integer(s$type_idx), integer(1))
}

test_that("cada panel de poblacion_3 apunta al placeholder que su nombre promete", {
  idx <- contrato_pic("poblacion_3")

  # Geometría medida con officer::layout_properties() sobre la plantilla:
  # pic 1 = derecha (alto doble), pic 2 = izquierda arriba, pic 3 = izquierda abajo.
  expect_equal(unname(idx[["right"]]), 1L)
  expect_equal(unname(idx[["up_left"]]), 2L)
  expect_equal(unname(idx[["bottom_left"]]), 3L)

  # Los tres son distintos: dos slots sobre el mismo placeholder pierden un panel.
  expect_equal(length(unique(idx)), 3L)
})

test_that("poblacion_4 conserva su mapeo, que sí sigue el orden de lectura", {
  slots <- .PPT_CONTRACT$poblacion_4$slots
  idx <- vapply(slots[c("up_left", "up_right", "bottom_left", "bottom_right")],
                function(s) as.integer(s$type_idx), integer(1))
  # Medido en la misma plantilla: aquí el orden del layout sí es el de lectura,
  # y es de donde salió el supuesto que rompía poblacion_3.
  expect_equal(unname(idx), 1:4)
})

test_that("los huecos de poblacion_4 caben en la lámina y cuadran con el alto que ve el motor", {
  slots <- .PPT_CONTRACT$poblacion_4$slots
  huecos <- slots[c("up_left", "up_right", "bottom_left", "bottom_right")]

  altos <- vapply(huecos, function(s) as.numeric(s$loc$height), numeric(1))
  tops  <- vapply(huecos, function(s) as.numeric(s$loc$top), numeric(1))

  # El graficador calcula el panel sobre este alto: si diverge del contrato,
  # razona sobre un cajón que no existe.
  expect_true(all(altos == .POBLACION_4_ALTO_SLOT_IN))

  # Las dos filas tienen que caber entre el título (termina en 1.10) y la banda
  # de la base (empieza en 6.91), sin pisarse entre sí.
  expect_gte(min(tops), 1.10)
  fila1 <- max(tops[c("up_left", "up_right")]) + .POBLACION_4_ALTO_SLOT_IN
  fila2_top <- min(tops[c("bottom_left", "bottom_right")])
  expect_lt(fila1, fila2_top)
  expect_lte(fila2_top + .POBLACION_4_ALTO_SLOT_IN, 6.91)
})
