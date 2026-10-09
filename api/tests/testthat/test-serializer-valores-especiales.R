# El serializador de la API mandaba `NA_real_`, `NaN` e `Inf` como las CADENAS
# "NA", "NaN" e "Inf". Un campo numerico que llega como texto atraviesa intacto
# todos los guards de la UI: `AulasEfectividadSeguimiento.tsx:116` y `:248`
# comprueban `f.banda_bajo == null` para tapar «no hay banda» y nunca
# disparaban, asi que el panel calculaba `("NA" - "NA") / 2` y publicaba el
# resultado. Medido sobre HSVG26ULT2 el 2026-09-09.
#
# El contrato se ejercita contra `.api_serializer()`, que es la MISMA funcion que
# `build_plumber_app()` monta. Replicar los flags con un `toJSON(...)` a mano
# seria un espejo, y un espejo no falla cuando el original cambia — que es
# justo como este defecto sobrevivio: `test-monitoreo-aulas-config-exacto.R:62`
# ya escribia `na = "null"` creyendo que replicaba al serializador.

.sva_cuerpo <- function(val) {
  res <- local({
    self <- new.env(parent = emptyenv())
    self$setHeader <- function(...) invisible(NULL)
    self$toResponse <- function() list(body = self$body)
    self
  })
  out <- prosecnurapp:::.api_serializer()(val, list(), res, function(req, res, err) stop(err))
  if (is.raw(out$body)) rawToChar(out$body) else as.character(out$body)
}

test_that("los valores especiales numericos viajan como null, no como texto", {
  cuerpo <- .sva_cuerpo(list(
    banda_bajo = NA_real_, banda_alto = 0.42,
    sin_dividendo = NaN, sin_tope = Inf, bajo_cero = -Inf
  ))

  # La forma exacta, para que se lea el contrato de un vistazo.
  expect_equal(
    cuerpo,
    '{"banda_bajo":null,"banda_alto":0.42,"sin_dividendo":null,"sin_tope":null,"bajo_cero":null}'
  )

  # Y explicito: ninguna de las tres cadenas puede aparecer en el cable.
  for (cadena in c('"NA"', '"NaN"', '"Inf"', '"-Inf"')) {
    expect_false(grepl(cadena, cuerpo, fixed = TRUE), info = cadena)
  }
})

test_that("`NA_character_` sigue saliendo null y los datos que DICEN \"NA\" no se tocan", {
  # `NA_character_` ya salia null antes del arreglo; se fija para que nadie lo
  # «arregle» en la direccion contraria. Y el texto "NA" que viene de una
  # lectura de Excel es un dato, no un vacio: `Layout.tsx:323`, `BasesPanel` y
  # `HojasRutaPage` lo comparan como cadena y tienen que seguir recibiendolo.
  cuerpo <- .sva_cuerpo(list(sin_nombre = NA_character_, leido_del_excel = "NA"))
  expect_equal(cuerpo, '{"sin_nombre":null,"leido_del_excel":"NA"}')
})

test_that("el auto_unbox se mantiene: un escalar no viaja como arreglo", {
  # `na = "null"` se anade a `serializer_unboxed_json()`, no lo sustituye. Si
  # alguien lo cambiara por `serializer_json(na = "null")`, cada escalar de la
  # API pasaria a ser `[x]` y el frontend entero se romperia en silencio.
  expect_equal(.sva_cuerpo(list(n = 3L, txt = "x")), '{"n":3,"txt":"x"}')
})

test_that("la app monta ESTE serializador y no uno propio", {
  # Sin esto, el contrato de arriba pasaria aunque `build_plumber_app()`
  # volviera a construir su serializador inline.
  fuente <- paste(deparse(body(build_plumber_app)), collapse = " ")
  expect_true(grepl(".api_serializer()", fuente, fixed = TRUE))
  expect_false(grepl("serializer_unboxed_json", fuente, fixed = TRUE))
})
