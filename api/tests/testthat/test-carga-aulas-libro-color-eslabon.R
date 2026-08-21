# Un color por eslabon, y una linea donde acaba cada bloque.
#
# Gonzalo: «las columnas de titular deberian ser de un color, y las columnas de
# reemplazo uno, reemplazo dos, reemplazo tres y subsiguientes deberian ser de
# otros colores para distinguirlos, quizas con una linea de borde para saber
# cuando acaba una y cuando empieza otra».
#
# Antes: la banda usaba dos tonos EN CICLO —el reemplazo 3 repetia el color del
# 1— y solo teñia la cabecera, asi que veinte columnas dentro las celdas eran
# todas blancas y no habia forma de saber en que eslabon se escribe.

test_that("cada eslabon tiene SU color, sin repetir", {
  # Con doce bloques, dos tonos alternando dan seis pares iguales.
  for (n in c(3L, 12L)) {
    tonos <- aulas_libro_colores_eslabon(n)
    expect_length(tonos, n)
    expect_identical(anyDuplicated(tonos), 0L)
  }
  # El titular conserva el navy del resto del libro.
  expect_identical(aulas_libro_colores_eslabon(5L)[[1]], "#002457")
})

test_that("los reemplazos se aclaran segun se alejan de la cadena", {
  # La jerarquia es real: el primero entra antes que el ultimo.
  tonos <- aulas_libro_colores_eslabon(6L)
  luminancia <- vapply(tonos[-1], function(h) sum(grDevices::col2rgb(h)), numeric(1))
  expect_true(all(diff(luminancia) > 0))
})

test_that("el color baja a las filas de datos y distingue los eslabones", {
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.libro_de_prueba(2L), libro)
  campos <- vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo, character(1))
  col_persona <- function(b) {
    1L + (b - 1L) * AULAS_AGENDADAS_ANCHO_BLOQUE + which(campos == "sample_status")
  }
  tintes <- vapply(1:3, function(b) relleno_de_celda(libro, "Aulas Agendadas",
                                                     col_persona(b), 2), character(1))
  # Los tres tienen fondo —antes eran blancos— y los tres son distintos.
  expect_true(all(nzchar(tintes)))
  expect_identical(anyDuplicated(tintes), 0L)
})

test_that("el gris de «lo que trae la app» GANA al tinte del eslabon", {
  # Las dos pistas se necesitan: una dice de que eslabon es la columna, la otra
  # si se escribe en ella. Aplicado despues, el tinte pisaba el gris y se perdia
  # la unica señal de que columnas no hay que tocar.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.libro_de_prueba(2L), libro)
  campos <- vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo, character(1))
  grises <- vapply(1:3, function(b) {
    col <- 1L + (b - 1L) * AULAS_AGENDADAS_ANCHO_BLOQUE + which(campos == "course_name")
    relleno_de_celda(libro, "Aulas Agendadas", col, 2)
  }, character(1))
  # El mismo gris en los tres bloques: la pista no depende del eslabon.
  expect_identical(unique(grises), "FFF2F4F7")
})

test_that("cada bloque empieza con una linea que lo separa del anterior", {
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.libro_de_prueba(2L), libro)
  ns <- c(a = "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
  d <- withr::local_tempdir()
  utils::unzip(libro, exdir = d)
  st <- xml2::read_xml(file.path(d, "xl", "styles.xml"))
  izq <- Filter(function(b) {
    l <- xml2::xml_find_first(b, "a:left", ns)
    !inherits(l, "xml_missing") && !is.na(xml2::xml_attr(l, "style"))
  }, xml2::xml_find_all(st, ".//a:borders/a:border", ns))
  # Uno por eslabon, y del color de su eslabon: si fueran todos del mismo color
  # la linea separaria pero no diria de quien es el bloque que empieza.
  colores <- vapply(izq, function(b) {
    xml2::xml_attr(xml2::xml_find_first(b, "a:left/a:color", ns), "rgb")
  }, character(1))
  colores <- unique(colores[!is.na(colores)])
  expect_gte(length(colores), 3L)
})
