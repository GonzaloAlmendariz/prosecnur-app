# P46. El subbloque de una lámina `multilista` es un `ppt_element` propio que se
# renderiza SIN pasar por `.render_element()`, así que el `ancho`/`alto` del
# cajón que ésta inyecta en el elemento padre nunca llegaba a los hijos.
#
# Medido: 20 llamadas de la pasada de PPT llegaban con `ancho = 10` —el default
# de la firma de `graficar_barras_apiladas()`— mientras la lámina se dibuja a
# 12.511 in. Con la herencia puesta, el enunciado de la lámina 41 pasa de una
# caja de 1.492 in a una de 1.794, un 20 % más — el mismo orden que el 22 % que
# se estaba perdiendo.

test_that("el hijo hereda el cajón que el padre sí conoce", {
  hijo <- .multilista_heredar_cajon(list(), list(ancho = 12.5, alto = 5.5))
  expect_equal(hijo$ancho, 12.5)
  expect_equal(hijo$alto, 5.5)
})


test_that("un subbloque que declara el suyo manda", {
  # Es la regla de siempre de los `overrides`: lo declarado gana.
  hijo <- .multilista_heredar_cajon(list(ancho = 6.1), list(ancho = 12.5))
  expect_equal(hijo$ancho, 6.1)
})


test_that("no inventa nada cuando el padre tampoco lo sabe", {
  hijo <- .multilista_heredar_cajon(list(titulo = "x"), list())
  expect_null(hijo$ancho)
  expect_null(hijo$alto)
  expect_equal(hijo$titulo, "x")
})


test_that("no pierde lo que el subbloque ya traía", {
  # El bucle de subbloques va cargando `bases_publico`, `row_step_forzado` y
  # compañía; heredar el cajón no puede llevárselos por delante.
  hijo <- .multilista_heredar_cajon(
    list(bases_publico = c(a = 10), row_step_forzado = 0.4),
    list(ancho = 12.5)
  )
  expect_equal(hijo$bases_publico, c(a = 10))
  expect_equal(hijo$row_step_forzado, 0.4)
  expect_equal(hijo$ancho, 12.5)
})


test_that("aguanta un padre o un hijo nulos", {
  expect_equal(.multilista_heredar_cajon(NULL, NULL), list())
  expect_equal(.multilista_heredar_cajon(NULL, list(ancho = 9))$ancho, 9)
  expect_null(.multilista_heredar_cajon(list(ancho = 9), NULL)$alto)
})


test_that("el bucle de subbloques de multilista lo llama de verdad", {
  # Una prueba sobre el helper solo pasa aunque nadie lo consuma, y ese es
  # exactamente el defecto que esto cubre: la capacidad existía —P42 puso
  # `ancho_slot`— y la lámina no la alcanzaba.
  ruta <- testthat::test_path("..", "..", "R", "reporte_plan_ppt.R")
  skip_if_not(file.exists(ruta))
  lineas <- readLines(ruta, warn = FALSE)

  ini <- grep("for (idx_block in seq_along(bloques))", lineas, fixed = TRUE)
  expect_gte(length(ini), 1L)
  bloque <- lineas[seq(ini[1], min(ini[1] + 45L, length(lineas)))]

  # Se busca la ASIGNACIÓN, no la mención. La primera versión de esta prueba
  # buscaba `.multilista_heredar_cajon(` a secas y pasaba con el arreglo
  # quitado: el comentario que hay dos líneas más arriba nombra la función, y
  # eso bastaba para darla por llamada. Un test que no rojea al revertir el
  # arreglo no es un test — lo era, y se comprobó quitándolo.
  tramo <- paste(bloque, collapse = "\n")
  expect_true(grepl(
    "block_render$overrides <- .multilista_heredar_cajon(",
    tramo, fixed = TRUE
  ))
  # Y con el padre como segundo argumento: heredar del propio hijo no heredaría
  # nada.
  expect_true(grepl(
    "block_render$overrides, el$overrides %||% list()",
    tramo, fixed = TRUE
  ))
})
