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

test_that("mencionar «objetivos educacionales» ya no numera nada", {
  # La detección por vocabulario está retirada: un estudio que hable de
  # objetivos educacionales y no lo declare no recibe la numeración.
  el <- list(title_slide = "Logro de los objetivos educacionales")
  expect_silent(prefijo <- .prefijo_grupos_efectivo(el, labels = c("Diseño", "Docencia")))
  expect_equal(prefijo, "")

  # El control: el mismo estudio, declarándolo, sí la recibe. Sin este par el
  # aserto de arriba pasaría igual con la numeración rota del todo.
  el$prefijo_grupos <- "OE"
  expect_equal(.prefijo_grupos_efectivo(el, labels = c("Diseño", "Docencia")), "OE")

  # Y la detección POR LOS DATOS sigue: si las etiquetas ya vienen numeradas,
  # se completa con su token. Eso no es vocabulario, es lo que hay en la lámina.
  expect_equal(.prefijo_grupos_efectivo(list(), labels = c("OE 1: Diseño", "Docencia")), "OE")
})

test_that("el aviso de la detección heredada ya no puede emitirse", {
  # Contrato estático: la rama de vocabulario está retirada, no silenciada.
  # Silenciarla habría dejado la numeración encendiéndose sola sin decirlo, que
  # es peor que como estaba.
  src <- paste(readLines(file.path("..", "..", "R", "reporte_plan_prefijo_grupos.R"),
                         warn = FALSE), collapse = "\n")
  cuerpo <- sub("^.*\\.prefijo_grupos_legado <- ", "", src)
  cuerpo <- substr(cuerpo, 1, 200)
  expect_false(grepl("objetiv", cuerpo, ignore.case = TRUE))
  expect_false(grepl("PULSO-AVISO", cuerpo, fixed = TRUE))
})
