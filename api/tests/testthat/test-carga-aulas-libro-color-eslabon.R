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

test_that("el tinte del eslabon NO se confunde con el gris de «lo trae la app»", {
  # Mezclado al 93 %, el tinte quedaba a 3-6 por canal del gris `#F2F4F7`: a la
  # vista, el mismo color. Se vio en el PDF —«NUMERO DE INTENTOS», que llena el
  # agendador, parecia de la app— y es un defecto que introdujo el propio color
  # de eslabon: añadir una pista borro otra.
  gris <- grDevices::col2rgb("#F2F4F7")[, 1]
  for (n in c(3L, 6L, 12L)) {
    for (tono in aulas_libro_colores_eslabon(n)) {
      tinte <- prosecnurapp:::.calf_tinte_distinguible(tono)
      d <- max(abs(grDevices::col2rgb(tinte)[, 1] - gris))
      # 8 es el minimo por debajo del cual las dos pistas se funden.
      expect_gte(d, 8L)
    }
  }
})

test_that("y sigue siendo un tinte, no un color plano", {
  # El control del anterior: la forma barata de separarlo del gris seria
  # oscurecerlo hasta que compita con la cabecera. El tinte tiene que seguir
  # dejando leer el texto negro que se escribe encima.
  for (tono in aulas_libro_colores_eslabon(6L)) {
    tinte <- prosecnurapp:::.calf_tinte_distinguible(tono)
    expect_gt(mean(grDevices::col2rgb(tinte)[, 1]), 200)
  }
})

test_that("en el LIBRO, el tinte de cada eslabon se distingue del gris de la app", {
  # Los dos tests de arriba prueban la funcion; este prueba que el formateador
  # la USA. Sin el, volver a mezclar al 93 % en el generador no rompia nada
  # —comprobado con el mutante—, que es la diferencia entre tener un helper
  # correcto y tener un libro correcto.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.libro_de_prueba(2L), libro)
  campos <- vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo, character(1))
  gris <- grDevices::col2rgb("#F2F4F7")[, 1]
  for (b in 1:3) {
    col <- 1L + (b - 1L) * AULAS_AGENDADAS_ANCHO_BLOQUE + which(campos == "sample_status")
    hex <- relleno_de_celda(libro, "Aulas Agendadas", col, 2)
    expect_true(nzchar(hex))
    rgb <- grDevices::col2rgb(paste0("#", substr(hex, 3, 8)))[, 1]
    expect_gte(max(abs(rgb - gris)), 8L)
  }
})

test_that("la hoja de campo tambien distingue sus eslabones por color", {
  # Salia con los TRES bloques en el mismo navy: la banda decia «TITULAR» y
  # «REEMPLAZO 1», pero el color no distinguia — y el color es lo que se ve al
  # desplazarse veinte columnas, cuando la banda ya no esta en pantalla.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.libro_de_prueba(2L), libro)
  ancho <- 1L + length(prosecnurapp:::.calg_titulos_agenda()) +
    length(prosecnurapp:::.calg_titulos_campo())
  bandas <- vapply(1:3, function(b) {
    relleno_de_celda(libro, "Aulas Aplicadas (Campo)", (b - 1L) * ancho + 3L, 1)
  }, character(1))
  expect_identical(anyDuplicated(bandas), 0L)
  # Y son EXACTAMENTE la escala de tres eslabones, no tres tonos cualesquiera
  # de una escala mas larga: la escala se calculaba sobre el numero de entradas
  # —seis, dos hojas por tres bloques— y salian tonos mas juntos de lo
  # necesario. Con esto, el ultimo eslabon usa el color mas claro disponible.
  esperado <- paste0("FF", toupper(sub("^#", "", aulas_libro_colores_eslabon(3L))))
  expect_identical(bandas, esperado)
})

test_that("el mismo eslabon tiene el mismo color en las DOS hojas", {
  # Si la agenda y la hoja de campo pintaran el reemplazo 1 de colores
  # distintos, el color dejaria de ser una pista y pasaria a ser ruido. Paso:
  # la escala se calculaba sobre el numero de entradas —seis, dos hojas por tres
  # bloques— en vez de sobre la profundidad de la cadena.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.libro_de_prueba(2L), libro)
  ancho_campo <- 1L + length(prosecnurapp:::.calg_titulos_agenda()) +
    length(prosecnurapp:::.calg_titulos_campo())
  for (b in 1:3) {
    agenda <- relleno_de_celda(libro, "Aulas Agendadas",
                               1L + (b - 1L) * AULAS_AGENDADAS_ANCHO_BLOQUE + 2L, 1)
    campo <- relleno_de_celda(libro, "Aulas Aplicadas (Campo)",
                              (b - 1L) * ancho_campo + 3L, 1)
    expect_identical(agenda, campo, info = sprintf("eslabon %d", b))
  }
})

test_that("los cuatro tramos de la Base de control se distinguen", {
  # 43 columnas: el color es lo unico que dice en que parte de la hoja se esta
  # cuando la banda ya quedo arriba. Salian los cuatro con el mismo navy.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.libro_de_prueba(2L), libro)
  g <- aulas_libro_grupos_control()
  bandas <- vapply(g, function(x) relleno_de_celda(libro, "Base de control", x$desde, 1),
                   character(1))
  expect_length(bandas, 4L)
  expect_identical(anyDuplicated(bandas), 0L)
})

test_that("los tramos NO comparten escala con los eslabones de la cadena", {
  # Son dos jerarquias distintas: titular/reemplazos por un lado, areas
  # tematicas por otro. Metidos en la misma escala, añadir el cuarto tramo
  # cambiaba el color del titular y sus reemplazos — un cambio en una hoja
  # repintando otra.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.libro_de_prueba(2L), libro)
  eslabones <- vapply(1:3, function(b) {
    relleno_de_celda(libro, "Aulas Agendadas",
                     1L + (b - 1L) * AULAS_AGENDADAS_ANCHO_BLOQUE + 2L, 1)
  }, character(1))
  # La escala de los eslabones sigue siendo la de TRES, con cuatro tramos en la
  # otra hoja.
  esperado <- paste0("FF", toupper(sub("^#", "", aulas_libro_colores_eslabon(3L))))
  expect_identical(eslabones, esperado)
})
