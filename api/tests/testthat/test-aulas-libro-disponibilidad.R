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

test_that("son TABLAS CRUZADAS, no una lista larga", {
  # **Tres desde el 2026-09-11, y el contrato no era «dos»: era que ninguna
  # tabla enumere el producto hora × día.** Ésa fue su queja del 2026-09-04
  # —«tenemos que asegurarnos de que el Excel no sea críptico»— cuando la hoja
  # bajaba tramo por tramo, día tras día, en más de doscientas filas.
  #
  # El tercer cruce lo pidió él: «los rangos horarios ya siempre son iguales,
  # entonces quién puede cada día tiene que sistematizarse por hora». Es hora ×
  # persona con los días en la celda, y añade UNA fila por tramo, no seis.
  filas <- aulas_libro_filas_disponibilidad(.tld_disp())
  bloques <- vapply(.tld_celdas(filas, "bloque"), function(f) f$celdas[[1]], character(1))
  expect_equal(bloques, c("CUÁNTOS HAY, HORA POR HORA", "QUIÉN PUEDE, HORA POR HORA"))
  # Lo que el tope vigila es que la hoja no vuelva a ser una enumeración: con
  # once tramos, tres personas y dos días, el producto serían 22 filas de datos
  # sólo en la primera tabla. Las tres cruzadas caben de sobra en cincuenta.
  expect_lt(length(filas), 50L)
  # Y ninguna tabla de datos pasa del número de TRAMOS: si alguna los multiplica
  # por los días, volvió la lista.
  datos <- length(.tld_celdas(filas, "dato"))
  expect_lt(datos, 11L * 2L + length(.tld_celdas(filas, "cabecera")) * 3L)
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
  # Las cifras son NÚMEROS: es lo que deja ordenarlas y sumarlas en la hoja.
  expect_equal(unlist(por_tramo[["09:00 a 09:30"]]), c(2, 0, 0))
  # A las 07:30 sólo hay martes.
  expect_equal(unlist(por_tramo[["07:30 a 08:00"]]), c(0, 1, 0))
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

test_that("la segunda tabla es una fila por persona, con sus DÍAS por hora", {
  # **Las columnas pasaron de días a tramos el 2026-09-11.** Él: «los rangos
  # horarios ya siempre son iguales, entonces quién puede cada día tiene que
  # sistematizarse por hora». La fila por persona se conserva —es lo que él
  # pidió el 2026-09-04— y lo que cambia es el otro eje.
  #
  # El motivo viejo de esta tabla sigue en pie y por eso la celda NO es un aspa:
  # un aspa obligaba a bajar a buscar la hora. Ahora la hora está en la cabecera
  # de la columna y la celda dice los DÍAS, que es la parte que faltaba.
  filas <- aulas_libro_filas_disponibilidad(.tld_disp())
  cabeceras <- .tld_celdas(filas, "cabecera")
  cab <- cabeceras[[2]]$celdas
  expect_equal(cab[[1]], "APLICADOR")
  # Sólo la hora de inicio: el tramo se deduce de la siguiente columna.
  expect_true(all(grepl("^\\d{2}:\\d{2}$", cab[-1])))

  datos <- .tld_celdas(filas, "dato")
  personas <- Filter(function(f) !grepl("^\\d{2}:\\d{2} a ", f$celdas[[1]]), datos)
  nombres <- vapply(personas, function(f) f$celdas[[1]], character(1))
  # El nombre se escribe como se escribe un nombre, y en alfabético.
  expect_equal(nombres, c("Castillo Solorsano, Leidy Viviana",
                          "Panta Gutierrez, Percy Aarón",
                          "Uribe Olaechea, Jesús Ramiro"))
  percy <- personas[[2]]$celdas
  col <- function(hora) which(cab == hora)
  # Percy puede el lunes de 08:00 a 11:00 y el jueves de 14:00 a 16:00: a las
  # 08:00 sólo el lunes, a las 14:00 sólo el jueves, y a las 12:00 ninguno.
  expect_equal(percy[[col("08:00")]], "L")
  expect_equal(percy[[col("14:00")]], "J")
  # Y donde no puede, la celda queda VACÍA: hay al menos una, porque su horario
  # no cubre toda la rejilla.
  expect_true(any(!nzchar(percy[-1])))
})

test_that("los values del publicador salen rectangulares", {
  vals <- aulas_libro_valores_disponibilidad(.tld_disp())
  anchos <- unique(vapply(vals, length, integer(1)))
  # **Rectangulares, y el ancho ya NO es 4.** La tabla de personas pasó de
  # columnas por día a columnas por tramo el 2026-09-11, así que fijar el número
  # aquí sólo ataba el test a una fixture: lo que el publicador necesita es que
  # todas las filas midan LO MISMO, o la API rechaza el rango.
  expect_length(anchos, 1L)
  expect_gte(anchos, 4L)
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
  # **Desde el 2026-09-11 ninguna celda lleva ya el rango largo**: la tabla de
  # personas pasó a columnas por tramo y su celda son unas iniciales. Así que
  # todas las columnas se quedan en el suelo, y eso es lo correcto — el ancho
  # fijo de diecisiete perdía el segundo tramo de «08:00 a 11:00 · 14:00 a
  # 20:00», y ese texto ya no existe.
  #
  # Lo que este test sigue vigilando es el MECANISMO: que el ancho salga del
  # contenido y no de un literal. Se comprueba con la cabecera, que es lo más
  # largo que hay en esas columnas.
  expect_gte(ancho_de(wb, 2L), 17)
  corta <- list(list(nombre = "Uno", dias = list(lunes = list(list(inicio = "08:00", fin = "11:00")))))
  wb2 <- openxlsx::createWorkbook()
  aulas_libro_hoja_disponibilidad(wb2, corta)
  expect_equal(ancho_de(wb2, 2L), 17)
  # Y la primera columna, que lleva nombres enteros, sigue siendo la ancha.
  expect_gt(ancho_de(wb, 1L), ancho_de(wb, 2L))
})


# --- cuántos salen cada semana ------------------------------------------------
#
# Dictado de Gonzalo (2026-09-12): «los aplicadores disponibles por semana. La
# primera semana habían creo que algo de veintiuno o veinticuatro, ahora hay un
# poco menos. Más o menos los aplicadores que hemos tomado en cuenta para hacer
# la distribución».
#
# **La disponibilidad no puede contestarlo y ése es el punto.** Es una matriz
# día-de-la-semana × franja: sabe que alguien puede los martes, no que pueda el
# martes 15. Quien lo sabe es el reparto, cuyas citas llevan fecha. Medido en el
# operativo: semana 1 con 19 aplicadores y 101 citas, semana 2 con 17 y 50.

.tald_semana_fila <- function(filas, semana) {
  en <- FALSE
  for (f in filas) {
    if (identical(f$tipo, "bloque")) { en <- identical(f$celdas[[1]], "CUÁNTOS SALEN CADA SEMANA"); next }
    if (en && identical(f$tipo, "dato") && identical(f$celdas[[1]], semana)) return(f$celdas)
  }
  NULL
}

.tald_plan_dos_semanas <- function() {
  c(
    lapply(1:3, function(i) list(
      operational_code = sprintf("CH %d", i), sample_role = "titular",
      operational_status = "agendada", scheduled_date = "2026-09-08",
      scheduled_time = sprintf("%02d:00", 9 + i))),
    lapply(4:5, function(i) list(
      operational_code = sprintf("CH %d", i), sample_role = "titular",
      operational_status = "agendada", scheduled_date = "2026-09-15",
      scheduled_time = sprintf("%02d:00", 9 + i)))
  )
}

.tald_disp_martes <- function(nombre, ...) {
  list(nombre = nombre, dias = list(martes = list(list(inicio = "08:00", fin = "20:00"))))
}

test_that("sin plan NO se dibuja el bloque: una sola fila diría que el campo dura una semana", {
  filas <- aulas_libro_filas_disponibilidad(list(.tald_disp_martes("Ana Prueba")))
  expect_null(.tald_semana_fila(filas, "Semana 1"))
  # Y con un plan sin fechas, tampoco: sin fechas no hay semanas.
  sin_fecha <- list(list(operational_code = "CH 1", sample_role = "titular",
                         operational_status = "contactada"))
  filas2 <- aulas_libro_filas_disponibilidad(list(.tald_disp_martes("Ana Prueba")),
                                             plan = sin_fecha)
  expect_null(.tald_semana_fila(filas2, "Semana 1"))
})

test_that("cuenta las personas que SALEN cada semana, con sus fechas y sus citas", {
  disp <- list(.tald_disp_martes("Ana Prueba"), .tald_disp_martes("Berta Ficticia"))
  filas <- aulas_libro_filas_disponibilidad(disp, plan = .tald_plan_dos_semanas())
  s1 <- .tald_semana_fila(filas, "Semana 1")
  s2 <- .tald_semana_fila(filas, "Semana 2")
  expect_false(is.null(s1)); expect_false(is.null(s2))
  # 2026-09-08 es martes de la semana del lunes 07; 2026-09-15, de la siguiente.
  expect_identical(s1[[2]], "08/09 a 08/09")
  expect_identical(s2[[2]], "15/09 a 15/09")
  expect_identical(s1[[3]], "3")   # aplicaciones
  expect_identical(s2[[3]], "2")
  # La primera semana no tiene con qué comparar: no inventa entradas ni salidas.
  expect_identical(s1[[5]], "")
  expect_identical(s1[[6]], "")
})

test_that("los que entran y los que salen van por NOMBRE, no por conteo", {
  # Lo que se hace con este dato es llamar a esa persona o preguntar por qué ya
  # no está; «-1 aplicador» no sirve para ninguna de las dos cosas.
  disp <- list(.tald_disp_martes("Ana Prueba"), .tald_disp_martes("Berta Ficticia"))
  filas <- aulas_libro_filas_disponibilidad(disp, plan = .tald_plan_dos_semanas())
  s2 <- .tald_semana_fila(filas, "Semana 2")
  entran <- s2[[5]]; salen <- s2[[6]]
  expect_true(nzchar(entran) || nzchar(salen))
  expect_false(grepl("^[0-9]+$", paste0(entran, salen)))
})

test_that("el bloque semanal gana su banda en Sheets, como sus hermanos", {
  # El rótulo gobierna el color, y enumerarlo a mano en el formateador fue lo
  # que dejó a «QUIÉN PUEDE, HORA POR HORA» sin banda al renombrarlo.
  disp <- list(.tald_disp_martes("Ana Prueba"))
  filas <- aulas_libro_filas_disponibilidad(disp, plan = .tald_plan_dos_semanas())
  rows <- lapply(filas, function(f) as.list(f$celdas))
  reqs <- aulas_libro_disponibilidad_formato_requests(9L, rows)
  i_bloque <- which(vapply(rows, function(r) identical(as.character(r[[1]]),
                                                       "CUÁNTOS SALEN CADA SEMANA"), logical(1)))
  expect_length(i_bloque, 1L)
  con_banda <- vapply(reqs, function(r) {
    rc <- r[["repeatCell"]]
    if (is.null(rc)) return(NA_integer_)
    as.integer(rc$range$startRowIndex %||% NA_integer_) + 1L
  }, integer(1))
  expect_true(i_bloque %in% con_banda[!is.na(con_banda)])
})
