# Numerar los grupos dejó de saber de qué estudio se trata.
#
# El control era «Numerar OE» y anteponía literalmente `OE 1:`. Un estudio de
# acreditación en ingeniería numera así sus objetivos educacionales; el producto
# no tiene por qué saberlo, y uno que hable de dimensiones o ejes no tenía forma
# de pedir lo mismo.

test_that("el prefijo lo pone el analista, sea cual sea la palabra", {
  labels <- c("Diseño", "Docencia", "Gestión")

  expect_equal(
    .prefijo_grupos_aplicar(labels, "OE"),
    c("OE 1: Diseño", "OE 2: Docencia", "OE 3: Gestión")
  )
  # El control que da sentido al resto: la palabra no está escrita en el motor.
  expect_equal(
    .prefijo_grupos_aplicar(labels, "Dimensión"),
    c("Dimensión 1: Diseño", "Dimensión 2: Docencia", "Dimensión 3: Gestión")
  )
  # Vacío es apagado, y es el texto el que hace de interruptor.
  expect_equal(.prefijo_grupos_aplicar(labels, ""), labels)
  expect_equal(.prefijo_grupos_aplicar(labels, NULL), labels)
})

test_that("una etiqueta que ya trae su número se normaliza, no se duplica", {
  expect_equal(
    .prefijo_grupos_aplicar(c("OE 2: Diseño", "Docencia"), "OE"),
    c("OE 2: Diseño", "OE 2: Docencia")
  )
  # Ojo al segundo: sin refs, el número es la posición. Lo que este test fija
  # es que la primera NO sale como «OE 1: OE 2: Diseño».
  expect_false(grepl("OE 1: OE", .prefijo_grupos_aplicar(c("OE 2: Diseño"), "OE")[1]))
})

test_that("el token se deduce de las etiquetas cuando ya vienen numeradas", {
  expect_equal(.prefijo_grupos_detectado(c("OE 1: Diseño", "Docencia")), "OE")
  expect_equal(.prefijo_grupos_detectado(c("Eje 3: Docencia")), "Eje")

  # Sin numeración previa no se inventa nada.
  expect_null(.prefijo_grupos_detectado(c("Diseño", "Docencia")))
  expect_null(.prefijo_grupos_detectado(character(0)))

  # Dos vocabularios mezclados no son una numeración a completar: son dos
  # cosas distintas, y unificarlas sería inventar un criterio.
  expect_null(.prefijo_grupos_detectado(c("OE 1: Diseño", "Eje 2: Docencia")))
})

test_that("el control viejo sigue significando lo mismo", {
  expect_equal(.prefijo_grupos_declarado(list(numerar_oe = TRUE)), "OE")
  expect_equal(.prefijo_grupos_declarado(list(numerar_oe = FALSE)), "")
  # Lo declarado gana sobre el alias.
  expect_equal(
    .prefijo_grupos_declarado(list(numerar_oe = TRUE, prefijo_grupos = "Eje")),
    "Eje"
  )
  # Sin decir nada, no hay declaración: le toca deducir a quien llama.
  expect_null(.prefijo_grupos_declarado(list()))
})

test_that("apagarlo explícitamente gana sobre la detección", {
  el <- list(prefijo_grupos = "")
  labels <- c("OE 1: Diseño", "OE 2: Docencia")
  # El control: con el mismo juego de etiquetas y sin declarar nada, SÍ numera.
  expect_equal(.prefijo_grupos_efectivo(list(), labels = labels), "OE")
  expect_equal(.prefijo_grupos_efectivo(el, labels = labels), "")
})

test_that("un estudio que no menciona objetivos no recibe numeración sola", {
  el <- list(title_slide = "Satisfacción con el servicio")
  expect_equal(.prefijo_grupos_efectivo(el, labels = c("Diseño", "Docencia")), "")
})

test_that("la detección heredada sigue viva, pero avisa", {
  el <- list(title_slide = "Logro de los objetivos educacionales")
  expect_message(
    prefijo <- .prefijo_grupos_efectivo(el, labels = c("Diseño", "Docencia")),
    "PULSO-AVISO"
  )
  expect_equal(prefijo, "OE")
})
