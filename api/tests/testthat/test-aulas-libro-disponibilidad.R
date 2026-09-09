# **La hoja de disponibilidad no puede ser críptica.**
#
# Dictado 2026-09-04: «tenemos que asegurarnos de que el Excel no sea críptico…
# creo que es mejor separarlo por "el aplicador tal y ésta es su disponibilidad
# el lunes, el martes, el miércoles", o en todo caso y mejor por día "el lunes
# estas son las personas disponibles"; hay que ver que visualmente sea
# entendible, porque son varias aristas: rangos horarios, días disponibles y
# personas como tal».
#
# Tres ejes no caben en una columna. La primera versión bajaba tramo por tramo y
# día tras día: más de doscientas filas sobre el operativo. Ahora son DOS tablas
# cruzadas, una por pregunta.

.tld_disp <- function() list(
  list(nombre = "PANTA GUTIERREZ, PERCY AARÓN",
       dias = list(lunes = list(list(inicio = "08:00", fin = "11:00")),
                   jueves = list(list(inicio = "14:00", fin = "16:00")))),
  list(nombre = "Castillo SOLORSANO , LEIDY VIVIANA",
       dias = list(lunes = list(list(inicio = "09:00", fin = "11:00")))),
  list(nombre = "Uribe Olaechea , Jesús Ramiro",
       dias = list(martes = list(list(inicio = "07:30", fin = "09:00"))))
)

.tld_celdas <- function(filas, tipo) {
  Filter(function(f) identical(f$tipo, tipo), filas)
}

test_that("sin oferta cargada no hay hoja: una vacía diría «nadie tiene horario»", {
  expect_null(aulas_libro_filas_disponibilidad(list()))
  expect_null(aulas_libro_valores_disponibilidad(list()))
})

test_that("son DOS tablas, no una lista larga", {
  filas <- aulas_libro_filas_disponibilidad(.tld_disp())
  bloques <- vapply(.tld_celdas(filas, "bloque"), function(f) f$celdas[[1]], character(1))
  expect_equal(bloques, c("CUÁNTOS HAY, HORA POR HORA", "QUIÉN PUEDE CADA DÍA"))
  # Once tramos y tres personas caben en menos de treinta filas; la versión de
  # una sola lista gastaba más de cincuenta para lo mismo.
  expect_lt(length(filas), 30L)
})

test_that("la primera tabla cruza HORA por DÍA, con el conteo en la celda", {
  filas <- aulas_libro_filas_disponibilidad(.tld_disp())
  cabeceras <- .tld_celdas(filas, "cabecera")
  # Sólo los días CON cobertura ganan columna: miércoles y viernes no están.
  expect_equal(cabeceras[[1]]$celdas, c("TRAMO", "Lunes", "Martes", "Jueves"))

  datos <- .tld_celdas(filas, "dato")
  por_tramo <- stats::setNames(lapply(datos, function(f) f$celdas[-1L]),
                               vapply(datos, function(f) f$celdas[[1]], character(1)))
  # A las 09:00 el lunes están las dos; el martes y el jueves, nadie.
  expect_equal(por_tramo[["09:00 a 09:30"]], c("2", "0", "0"))
  # A las 07:30 sólo hay martes.
  expect_equal(por_tramo[["07:30 a 08:00"]], c("0", "1", "0"))
})

test_that("el eje horario es la unión de lo cubierto, no un 07:00–22:00 con huecos", {
  filas <- aulas_libro_filas_disponibilidad(.tld_disp())
  tramos <- vapply(.tld_celdas(filas, "dato"), function(f) f$celdas[[1]], character(1))
  tramos <- tramos[grepl("^\\d{2}:\\d{2} a ", tramos)]
  expect_equal(tramos[[1]], "07:30 a 08:00")
  expect_equal(tramos[[length(tramos)]], "15:30 a 16:00")
  # Nada entre las 11:00 y las 14:00: esas horas no las cubre nadie y no se
  # escriben. Quince filas vacías arriba y abajo son lo que vuelve críptica una
  # hoja.
  expect_false(any(grepl("^1[123]:", tramos)))
})

test_that("la segunda tabla es una fila por persona, con su RANGO por día", {
  filas <- aulas_libro_filas_disponibilidad(.tld_disp())
  cabeceras <- .tld_celdas(filas, "cabecera")
  expect_equal(cabeceras[[2]]$celdas, c("APLICADOR", "Lunes", "Martes", "Jueves"))

  datos <- .tld_celdas(filas, "dato")
  personas <- Filter(function(f) !grepl("^\\d{2}:\\d{2} a ", f$celdas[[1]]), datos)
  nombres <- vapply(personas, function(f) f$celdas[[1]], character(1))
  # El nombre se escribe como se escribe un nombre, y en alfabético.
  expect_equal(nombres, c("Castillo Solorsano, Leidy Viviana",
                          "Panta Gutierrez, Percy Aarón",
                          "Uribe Olaechea, Jesús Ramiro"))
  # La celda dice CUÁNDO, no un aspa: un aspa obliga a bajar a buscar la hora.
  percy <- personas[[2]]$celdas
  expect_equal(percy[[2]], "08:00 a 11:00")   # lunes
  expect_equal(percy[[3]], "")                # martes: no puede
  expect_equal(percy[[4]], "14:00 a 16:00")   # jueves
})

test_that("los values del publicador salen rectangulares", {
  vals <- aulas_libro_valores_disponibilidad(.tld_disp())
  anchos <- unique(vapply(vals, length, integer(1)))
  expect_length(anchos, 1L)
  expect_equal(anchos, 4L)  # TRAMO + tres días
})

test_that("el formato marca las celdas flacas, y sólo en la tabla de conteos", {
  vals <- aulas_libro_valores_disponibilidad(.tld_disp())
  reqs <- aulas_libro_disponibilidad_formato_requests(7L, vals)
  # Todo request es de formato o de geometría: jamás values ni validaciones.
  for (r in reqs) {
    if (!is.null(r$repeatCell)) {
      expect_true(startsWith(r$repeatCell$fields, "userEnteredFormat("))
    } else {
      expect_identical(r$updateDimensionProperties$fields, "pixelSize")
    }
  }
  # Las celdas marcadas son de UNA columna de ancho: el aviso es el número, no
  # la fila. Teñir la fila diría que el día entero está flaco.
  de_una_celda <- Filter(function(r) {
    !is.null(r$repeatCell) && !is.null(r$repeatCell$range$startColumnIndex) &&
      r$repeatCell$range$startColumnIndex > 0L &&
      identical(r$repeatCell$range$endColumnIndex - r$repeatCell$range$startColumnIndex, 1L)
  }, reqs)
  expect_gt(length(de_una_celda), 0L)
  # Y ningún AVISO DE HUECO cae en la tabla de personas, donde las celdas son
  # rangos horarios y un «08:00 a 11:00» no se compara con uno. Se distinguen
  # por su color: el aviso va en el gris del vacío o en el rojo suave del uno;
  # la tabla de personas se pinta en verde, que dice lo contrario (sí puede).
  fila_personas <- which(vapply(vals, function(r)
    identical(trimws(as.character(r[[1]])), "APLICADOR"), logical(1)))
  expect_length(fila_personas, 1L)
  # Se comparan contra el color REAL, no contra un número tecleado: un tono
  # copiado a mano en el test deja de vigilar el día que el motor cambia el suyo.
  verde_puede <- prosecnurapp:::.monitoreo_sheets_rgb("#E3F3E8")
  es_verde <- function(r) {
    isTRUE(all.equal(r$repeatCell$cell$userEnteredFormat$backgroundColor, verde_puede))
  }
  avisos <- Filter(function(r) !es_verde(r), de_una_celda)
  ultimas <- vapply(avisos, function(r) r$repeatCell$range$startRowIndex + 1L, integer(1))
  expect_true(all(ultimas < fila_personas))
})

# --- la semana de cada persona, leída como forma ------------------------------
#
# Dictado de Gonzalo (2026-09-08): «disponibilidad de aplicadores debe tener el
# estilo dicotómico que manejamos». La tabla de personas es dicotómica por
# naturaleza —o puede ese día o no puede— y salía sin un solo color.

test_that("los tramos llenos de una fila se agrupan: un rectángulo, no una celda por día", {
  tramos <- prosecnurapp:::.ald_tramos_llenos
  # Tres días seguidos son UN tramo: alguien que puede de lunes a miércoles es
  # un rectángulo, y celda a celda serían ochenta y cuatro requests donde caben
  # veinte.
  expect_identical(tramos(c("Ana", "a", "b", "c", "", "")), list(c(2L, 4L)))
  # Partido, dos.
  expect_identical(tramos(c("Ana", "a", "", "c", "")), list(c(2L, 2L), c(4L, 4L)))
  # El último día también cierra tramo: sin ese caso se quedaba sin pintar.
  expect_identical(tramos(c("Ana", "", "", "c")), list(c(4L, 4L)))
  # La columna del nombre NUNCA entra, y una fila sin días no pinta nada.
  expect_identical(tramos(c("Ana", "", "")), list())
  expect_identical(tramos("Ana"), list())
})

test_that("la tabla de personas se pinta donde SÍ puede, no donde no", {
  vals <- aulas_libro_valores_disponibilidad(.tld_disp())
  reqs <- aulas_libro_disponibilidad_formato_requests(7L, vals)
  fila_personas <- which(vapply(vals, function(r)
    identical(trimws(as.character(r[[1]])), "APLICADOR"), logical(1)))
  verde_puede <- prosecnurapp:::.monitoreo_sheets_rgb("#E3F3E8")
  verde <- Filter(function(r) {
    !is.null(r$repeatCell) &&
      isTRUE(all.equal(r$repeatCell$cell$userEnteredFormat$backgroundColor, verde_puede)) &&
      !is.null(r$repeatCell$range$startColumnIndex) && r$repeatCell$range$startColumnIndex > 0L
  }, reqs)
  expect_gt(length(verde), 0L)
  # Todas después de la cabecera de la tabla de personas.
  filas <- vapply(verde, function(r) r$repeatCell$range$startRowIndex + 1L, integer(1))
  expect_true(all(filas > fila_personas))
  # Y ninguna cae sobre una celda vacía: se pinta lo que SÍ, porque teñir el
  # hueco haría de la ausencia el elemento fuerte de la tabla.
  for (r in verde) {
    fila <- vals[[r$repeatCell$range$startRowIndex + 1L]]
    for (j in seq(r$repeatCell$range$startColumnIndex + 1L, r$repeatCell$range$endColumnIndex)) {
      expect_true(nzchar(trimws(as.character(fila[[j]]))))
    }
  }
})

# --- la hoja del xlsx ---------------------------------------------------------

test_that("en el xlsx la tabla de personas también se pinta donde SÍ puede", {
  # Dos renderers, la misma decisión: el Sheets ya lo hacía y el xlsx salía sin
  # un solo color en esa tabla.
  skip_if_not_installed("openxlsx")
  wb <- openxlsx::createWorkbook()
  expect_true(aulas_libro_hoja_disponibilidad(wb, .tld_disp()))
  # El relleno vive en `style$fill` como «FFE3F3E8» (openxlsx antepone el alfa).
  verdes <- Filter(function(e) {
    any(grepl("E3F3E8", unlist(e$style$fill), fixed = TRUE))
  }, wb$styleObjects)
  expect_gt(length(verdes), 0L)
  # Nunca sobre la columna del nombre: no es un día.
  for (v in verdes) expect_false(1L %in% v$cols)
})

test_that("las columnas de día se ensanchan con su contenido: el horario no se corta", {
  # «08:00 a 11:00 · 14:00 a 20:00» son veintinueve caracteres y con un ancho
  # fijo de diecisiete el segundo tramo se perdía. Se vio abriendo el libro.
  skip_if_not_installed("openxlsx")
  disp <- list(list(nombre = "Con dos bloques",
                    dias = list(lunes = list(list(inicio = "08:00", fin = "11:00"),
                                             list(inicio = "14:00", fin = "20:00")))))
  wb <- openxlsx::createWorkbook()
  aulas_libro_hoja_disponibilidad(wb, disp)
  ancho_de <- function(w, col) {
    a <- w$colWidths[[1L]]
    suppressWarnings(as.numeric(a[names(a) == as.character(col)]))
  }
  # La columna 2 es el único día con cobertura y lleva el rango largo.
  expect_gt(ancho_de(wb, 2L), 17)
  # Y con un rango corto se queda en el suelo, sin estrecharse.
  corta <- list(list(nombre = "Uno", dias = list(lunes = list(list(inicio = "08:00", fin = "11:00")))))
  wb2 <- openxlsx::createWorkbook()
  aulas_libro_hoja_disponibilidad(wb2, corta)
  expect_equal(ancho_de(wb2, 2L), 17)
})

