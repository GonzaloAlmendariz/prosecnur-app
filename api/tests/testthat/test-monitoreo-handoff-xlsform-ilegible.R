# El traspaso a Procesamiento no pasa sin verificar.
#
# Vivia en `test-carga-aulas-sheets-fallos.R` y ahi NO lo alcanzaba el gate de
# su area: quien toca el handoff filtra por «handoff» y este archivo se llama de
# otra cosa. Es la clase 6 del loop —un gate que no se corre— provocada por
# guardar un test bajo el nombre de otra area.


test_that("un XLSForm ilegible no deja pasar el handoff sin verificar", {
  # Fallar ABIERTO en la puerta que existe para cerrar: si
  # `leer_instrumento_xlsform()` fallaba, el `NULL` se tragaba el motivo y se
  # saltaba el bloque entero —alinear columnas, completarlas, reordenarlas y, lo
  # que importa, `.monitoreo_processing_handoff_xlsform_score()`, que es el
  # `stop_api` que protege el traspaso—. El único camino en el que la
  # verificación importaba era justo el que se la saltaba.
  fuente <- readLines(testthat::test_path("..", "..", "R", "monitoreo_router_handoff.R"),
                      warn = FALSE)
  bloque <- paste(fuente, collapse = "\n")
  # El motivo ya no se tira: se captura y se emite tipado.
  expect_true(grepl("E_MONITOREO_PROCESSING_HANDOFF_XLSFORM_ILEGIBLE", bloque, fixed = TRUE))
  expect_false(grepl("tryCatch(leer_instrumento_xlsform(xlsform_path), error = function(e) NULL)",
                     bloque, fixed = TRUE))
  # Y el caso legítimo —no hay instrumento— se DECLARA en vez de callarse: un
  # handoff sin instrumento no es un handoff verificado.
  expect_true(grepl("sin XLSForm que comprobar", bloque, fixed = TRUE))
})
