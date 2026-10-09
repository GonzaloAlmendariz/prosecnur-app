# Las hojas de FILAS TIPADAS escriben igual, o dejan de escribir igual sin que
# nadie se entere.
#
# Tres hojas del libro se construyen con el mismo contrato —una lista de
# `{tipo, celdas}` donde el tipo gobierna el estilo del `.xlsx` y el formato de
# Sheets—: «Asignación de aplicadores», «Disponibilidad de aplicadores» y
# «Producción de aplicadores». Un solo constructor por hoja, dos salidas.
#
# El 2026-09-12 las tres tenían COPIADO el mismo `t(as.matrix(f$celdas))` en su
# escritor del `.xlsx`, y `as.matrix` sobre una lista mixta aplasta todo a
# texto. Consecuencia medida en el documento: en la hoja que existe para
# contestar «quién aplica más» no se podía ordenar la columna que lo dice, y en
# las otras dos había 74 y 168 celdas numéricas guardadas como cadena.
#
# Arreglar una no arreglaba las otras porque eran tres copias. Este guard existe
# para la CUARTA: una hoja nueva que nazca con el patrón viejo lo hereda entero
# y nadie lo ve hasta abrir el libro descargado.

.talt_ARCHIVOS <- c("aulas_libro_asignacion.R", "aulas_libro_disponibilidad.R",
                    "aulas_libro_produccion.R")

# El CÓDIGO del archivo, sin comentarios: la primera versión de este guard se
# cazó a sí misma —el único `as.matrix` que quedaba estaba dentro del comentario
# que explica por qué ya no se usa— y un guard que salta por su propia
# documentación se acaba desactivando por molesto.
.talt_fuente <- function(nombre) {
  ruta <- testthat::test_path("..", "..", "R", nombre)
  if (!file.exists(ruta)) return(NA_character_)
  lineas <- readLines(ruta, warn = FALSE)
  lineas <- sub("#.*$", "", lineas)
  paste(lineas, collapse = "\n")
}

test_that("ninguna hoja de filas tipadas escribe el .xlsx con as.matrix", {
  # **Primero se comprueba que el barrido MIRÓ algo.** Un guard que enumera y
  # afirma «no hay culpables» sale verde también cuando no encontró los
  # archivos: es la clase 9 del catálogo, la que apaga la infraestructura sin
  # dejar rastro.
  fuentes <- vapply(.talt_ARCHIVOS, .talt_fuente, character(1))
  expect_false(any(is.na(fuentes)))
  expect_true(all(nchar(fuentes) > 500L))

  culpables <- names(fuentes)[grepl("as.matrix(", fuentes, fixed = TRUE)]
  expect_identical(culpables, character(0))
})

test_that("las tres usan el MISMO escritor y la MISMA regla de tipado", {
  # No basta con que ninguna use `as.matrix`: si cada una se escribe su propia
  # conversión, vuelven a poder divergir. El contrato es que compartan las dos
  # piezas.
  fuentes <- vapply(.talt_ARCHIVOS, .talt_fuente, character(1))
  for (nm in names(fuentes)) {
    expect_true(grepl(".alp_fila_df(", fuentes[[nm]], fixed = TRUE), info = nm)
    expect_true(grepl(".alp_celdas(", fuentes[[nm]], fixed = TRUE), info = nm)
  }
})

test_that("la regla de tipado hace lo que dice: dato numérico sí, rótulo no", {
  # El contrato en una línea, para que el guard de arriba no se apoye sólo en
  # que el nombre de la función aparezca en el archivo.
  dato <- prosecnurapp:::.alp_celdas("dato", c("Ana Prueba", "14", "22.9", "09:30"))
  expect_true(is.character(dato[[1]]))
  expect_true(is.numeric(dato[[2]]))
  expect_true(is.numeric(dato[[3]]))
  # «09:30» no es un número: `as.numeric` da NA y se queda como está. Si algún
  # día lo convirtiera, las horas del libro saldrían como fracciones de día.
  expect_true(is.character(dato[[4]]))
  expect_identical(as.character(dato[[4]]), "09:30")

  # Las filas que no son dato vuelven como VECTOR de caracteres, que es la
  # forma que tenían: convertirlas en lista cambia el tipo de las cabeceras y
  # rompe a quien las compara con un `c("TRAMO", ...)`.
  cab <- prosecnurapp:::.alp_celdas("cabecera", c("TRAMO", "Lunes", "Martes"))
  expect_true(is.character(cab))
  expect_identical(cab, c("TRAMO", "Lunes", "Martes"))
})
