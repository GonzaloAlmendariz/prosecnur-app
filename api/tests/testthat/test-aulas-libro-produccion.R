# La hoja «Producción de aplicadores» (dictado 2026-09-12): quién rindió, no a
# quién le toca.
#
# «Asignación de aplicadores» sale del reparto y existe antes de que nadie pise
# un aula; ésta sale de los partes y sólo existe después. Son dos preguntas y
# por eso son dos hojas: mezclarlas sería el error clásico de este operativo,
# una palabra para dos cosas.

.tlp_fila <- function(codigo, hora = "", fecha = "2026-09-11") {
  list(operational_code = codigo, classroom_id = tolower(gsub(" ", "", codigo)),
       sample_role = "titular", operational_status = "agendada",
       scheduled_date = fecha, scheduled_time = hora, faculty = "DERECHO",
       teacher = "Docente Prueba")
}

.tlp_parte <- function(codigo, quien, efectivas = 10, asistentes = 20, hora = "") {
  p <- list(operational_code = codigo, intento = 1L, estado = "aplicada",
            aplicador = quien, efectivas = efectivas, asistentes = asistentes)
  if (nzchar(hora)) p$hora <- hora
  p
}

.tlp_dato <- function(filas, bloque, quien) {
  en <- FALSE
  for (f in filas) {
    if (identical(f$tipo, "bloque")) { en <- identical(f$celdas[[1]], bloque); next }
    if (en && identical(f$tipo, "dato") && identical(f$celdas[[1]], quien)) return(f$celdas)
  }
  NULL
}

test_that("sin partes la hoja NO se produce: una vacía diría que nadie aplicó", {
  expect_null(aulas_libro_filas_produccion(list(.tlp_fila("CH 1", "10:00")), list()))
  # Y un parte sin aplicador identificado tampoco la inventa: no se puede medir
  # la producción de nadie.
  expect_null(aulas_libro_filas_produccion(
    list(.tlp_fila("CH 1", "10:00")),
    list(list(operational_code = "CH 1", intento = 1L, estado = "aplicada", efectivas = 9))))
})

test_that("ordena de MÁS a MENOS aulas, que es la pregunta literal", {
  plan <- list(.tlp_fila("CH 1", "10:00"), .tlp_fila("CH 2", "11:00"),
               .tlp_fila("CH 3", "12:00"))
  filas <- aulas_libro_filas_produccion(plan, list(
    .tlp_parte("CH 1", "Ana Prueba", efectivas = 18, asistentes = 25),
    .tlp_parte("CH 2", "Ana Prueba", efectivas = 12, asistentes = 20),
    .tlp_parte("CH 3", "Berta Ficticia", efectivas = 9, asistentes = 15)))
  en <- FALSE; orden <- character(0)
  for (f in filas) {
    if (identical(f$tipo, "bloque")) { en <- identical(f$celdas[[1]], "QUIÉN HA APLICADO MÁS"); next }
    if (en && identical(f$tipo, "dato")) orden <- c(orden, f$celdas[[1]])
  }
  expect_identical(orden, c("Ana Prueba", "Berta Ficticia"))
  ana <- .tlp_dato(filas, "QUIÉN HA APLICADO MÁS", "Ana Prueba")
  # **Las cifras van como NÚMEROS**: es la regla de la casa —«para que el Sheets
  # pueda ordenarlas y sumarlas»— y en esta hoja es lo que permite ordenar por
  # «quién aplica más», que es literalmente su título.
  expect_equal(ana[[2]], 2)    # aulas
  expect_equal(ana[[3]], 30)   # efectivas
  expect_equal(ana[[4]], 15)   # por aula: lo que separa carga de rendimiento
  expect_equal(ana[[5]], 45)   # asistentes vistos
  for (k in 2:5) expect_true(is.numeric(ana[[k]]), info = as.character(k))
  # Y el nombre sigue siendo texto: no todo lo de una fila es cifra.
  expect_true(is.character(ana[[1]]))
})

test_that("reparte las aplicaciones entre las tres franjas del dictado", {
  # 08:15 es mañana temprano; 14:00 regular; 19:00 noche. Los cortes son 09:00
  # y 18:00 y el borde cae del lado de abajo: las 09:00 en punto ya es regular.
  plan <- list(.tlp_fila("CH 1", "08:15"), .tlp_fila("CH 2", "09:00"),
               .tlp_fila("CH 3", "17:59"), .tlp_fila("CH 4", "18:00"))
  filas <- aulas_libro_filas_produccion(plan, list(
    .tlp_parte("CH 1", "Ana Prueba"), .tlp_parte("CH 2", "Ana Prueba"),
    .tlp_parte("CH 3", "Ana Prueba"), .tlp_parte("CH 4", "Ana Prueba")))
  ana <- .tlp_dato(filas, "EN QUÉ FRANJA APLICA CADA UNO", "Ana Prueba")
  expect_equal(unlist(ana[2:4]), c(1, 2, 1))
  total <- .tlp_dato(filas, "EN QUÉ FRANJA APLICA CADA UNO", "TOTAL")
  expect_equal(unlist(total[2:4]), c(1, 2, 1))
  # Y las franjas caras se nombran con NOMBRES: lo que se hace con este dato es
  # hablar con esa persona, no leer un número.
  notas <- vapply(Filter(function(f) identical(f$tipo, "nota"), filas),
                  function(f) f$celdas[[1]], character(1))
  expect_true(any(grepl("Mañana temprano.*Ana Prueba", notas)))
  expect_true(any(grepl("Noche.*Ana Prueba", notas)))
})

test_that("manda la hora del PARTE, y la agendada es el respaldo", {
  # Un aula pactada de día que se aplicó de noche cuenta de noche: la franja es
  # del turno que alguien hizo, no del que se planeó.
  plan <- list(.tlp_fila("CH 1", "10:00"))
  filas <- aulas_libro_filas_produccion(
    plan, list(.tlp_parte("CH 1", "Ana Prueba", hora = "19:30")))
  expect_equal(unlist(.tlp_dato(filas, "EN QUÉ FRANJA APLICA CADA UNO", "Ana Prueba")[2:4]),
               c(0, 0, 1))
  # Sin hora en el parte, la agendada sostiene la franja: perderla dejaría la
  # tabla contando de menos justo en las franjas raras.
  filas2 <- aulas_libro_filas_produccion(plan, list(.tlp_parte("CH 1", "Ana Prueba")))
  expect_equal(unlist(.tlp_dato(filas2, "EN QUÉ FRANJA APLICA CADA UNO", "Ana Prueba")[2:4]),
               c(0, 1, 0))
})

test_that("un aula sin ninguna hora cuenta aparte, no se le inventa turno", {
  filas <- aulas_libro_filas_produccion(
    list(.tlp_fila("CH 1")), list(.tlp_parte("CH 1", "Ana Prueba")))
  ana <- .tlp_dato(filas, "EN QUÉ FRANJA APLICA CADA UNO", "Ana Prueba")
  expect_length(ana, 5L)          # la columna SIN HORA sólo aparece si hace falta
  expect_equal(unlist(ana[2:5]), c(0, 0, 0, 1))
})

test_that("sólo cuenta lo APLICADO, con la definición canónica", {
  # Un parte abierto —alguien tecleó el aula y nada más— no es producción.
  # Contarlo inflaría a quien empieza muchas y cierra pocas, que es al revés de
  # lo que esta tabla existe para ver. Y el criterio no se inventa aquí.
  plan <- list(.tlp_fila("CH 1", "10:00"), .tlp_fila("CH 2", "11:00"))
  abierto <- list(operational_code = "CH 2", intento = 1L, aplicador = "Ana Prueba",
                  estado = "por_aplicar")
  filas <- aulas_libro_filas_produccion(
    plan, list(.tlp_parte("CH 1", "Ana Prueba"), abierto))
  expect_equal(.tlp_dato(filas, "QUIÉN HA APLICADO MÁS", "Ana Prueba")[[2]], 1)

  # Si la definición canónica dijera que las dos están aplicadas, esta hoja
  # diría dos: no tiene criterio propio.
  testthat::local_mocked_bindings(
    monitoreo_aulas_aula_aplicada = function(unidades, partes = list(), efectivas = NULL) {
      rep(TRUE, length(unidades))
    }
  )
  filas2 <- aulas_libro_filas_produccion(
    plan, list(.tlp_parte("CH 1", "Ana Prueba"), abierto))
  expect_equal(.tlp_dato(filas2, "QUIÉN HA APLICADO MÁS", "Ana Prueba")[[2]], 2)
})

test_that("una persona tecleada de dos formas es UNA persona, y se dice", {
  # Medido sobre el operativo el 2026-09-12: «Aquino Dulanto, Alejandro» tenía 2
  # aulas y «Aquino Dulanto Alejandro» otras 2 — cuatro personas donde hay dos,
  # y la tabla que existe para decir quién aplica más las ponía a media carga.
  # `aulas_nombre_aplicador()` es PRESENTACIÓN y su propia cabecera lo dice: sin
  # coma no reordena. Agrupar por su salida era usarla como identidad.
  plan <- list(.tlp_fila("CH 1", "10:00"), .tlp_fila("CH 2", "11:00"),
               .tlp_fila("CH 3", "12:00"))
  filas <- aulas_libro_filas_produccion(plan, list(
    .tlp_parte("CH 1", "Aquino Dulanto, Alejandro", efectivas = 10),
    .tlp_parte("CH 2", "AQUINO DULANTO ALEJANDRO", efectivas = 10),
    .tlp_parte("CH 3", "Aquino  Dulanto,  Alejandro", efectivas = 10)))
  fila <- .tlp_dato(filas, "QUIÉN HA APLICADO MÁS", "Aquino Dulanto, Alejandro")
  expect_false(is.null(fila))
  expect_equal(fila[[2]], 3)
  # Se muestra con la coma, que es el estándar de la casa.
  expect_identical(fila[[1]], "Aquino Dulanto, Alejandro")
  # Y la doble grafía se declara: aquí se juntan, pero la celda del libro sigue
  # mal escrita y alguien tiene que ir a arreglarla.
  notas <- vapply(Filter(function(f) identical(f$tipo, "nota"), filas),
                  function(f) f$celdas[[1]], character(1))
  expect_true(any(grepl("más de una forma", notas, fixed = TRUE)))
  expect_true(any(grepl("Aquino Dulanto Alejandro", notas, fixed = TRUE)))
})

test_that("dos personas distintas siguen siendo dos", {
  plan <- list(.tlp_fila("CH 1", "10:00"), .tlp_fila("CH 2", "11:00"))
  filas <- aulas_libro_filas_produccion(plan, list(
    .tlp_parte("CH 1", "Aquino Dulanto, Alejandro"),
    .tlp_parte("CH 2", "Aquino Dulanto, Alejandra")))
  expect_false(is.null(.tlp_dato(filas, "QUIÉN HA APLICADO MÁS", "Aquino Dulanto, Alejandro")))
  expect_false(is.null(.tlp_dato(filas, "QUIÉN HA APLICADO MÁS", "Aquino Dulanto, Alejandra")))
})

# --- la hoja existe en las DOS salidas, no sólo en Sheets --------------------
#
# El constructor de filas es uno solo, pero cada salida tiene su escritor: el
# `.xlsx` le pone estilos por tipo de fila y Sheets recibe los values planos.
# Una hoja que dejara de escribirse en el `.xlsx` no rompería ningún test de
# los de arriba —el constructor seguiría devolviendo sus filas— y nadie lo
# notaría hasta abrir el libro generado.

test_that("el libro .xlsx lleva la hoja de producción cuando hay campo", {
  skip_if_not_installed("openxlsx")
  plan <- lapply(1:3, function(i) list(
    operational_code = sprintf("CH %d", i), classroom_id = sprintf("a%d", i),
    sample_role = "titular", operational_status = "agendada",
    sample_status = "AGENDADA", scheduled_date = "2026-09-11",
    scheduled_time = sprintf("%02d:00", 8 + i), faculty = "DERECHO",
    teacher = "Docente", course_name = "Curso"))
  partes <- list(
    list(operational_code = "CH 1", intento = 1L, estado = "aplicada",
         aplicador = "Ana Prueba", efectivas = 18, asistentes = 25))
  destino <- tempfile(fileext = ".xlsx")
  aulas_libro_generar(plan, destino, partes = partes)
  hojas <- openxlsx::getSheetNames(destino)
  expect_true("Producción de aplicadores" %in% hojas)
  # Y va DESPUÉS de la de asignación cuando las dos están: se lee al cerrar la
  # jornada, no al empezarla.
  d <- openxlsx::read.xlsx(destino, sheet = "Producción de aplicadores", colNames = FALSE)
  expect_identical(as.character(d[1, 1]), "PRODUCCIÓN DE APLICADORES")
  expect_gt(nrow(d), 5L)
})

test_that("sin campo, el .xlsx no lleva una hoja de producción vacía", {
  skip_if_not_installed("openxlsx")
  plan <- list(list(operational_code = "CH 1", classroom_id = "a1",
                    sample_role = "titular", operational_status = "agendada",
                    sample_status = "AGENDADA", scheduled_date = "2026-09-11",
                    scheduled_time = "10:00", faculty = "DERECHO",
                    teacher = "Docente", course_name = "Curso"))
  destino <- tempfile(fileext = ".xlsx")
  aulas_libro_generar(plan, destino, partes = list())
  # Una hoja de producción vacía se leería como «nadie ha aplicado», que es
  # distinto de «todavía no se ha cargado el campo».
  expect_false("Producción de aplicadores" %in% openxlsx::getSheetNames(destino))
})

test_that("en el .xlsx las cifras también son números, no texto", {
  skip_if_not_installed("openxlsx")
  # El constructor ya devuelve números, pero cada salida tiene su escritor y
  # `as.matrix` sobre una lista mixta lo aplasta TODO a texto: el arreglo de
  # Sheets se perdía aquí y la columna «AULAS APLICADAS» tampoco se podía
  # ordenar en el libro descargado.
  #
  # **Y hay que leerlo con el instrumento bueno**: `read.xlsx` sobre la hoja
  # entera devuelve character porque la columna es mixta (títulos arriba,
  # cifras abajo), así que decía «texto» con el archivo bien escrito. Se leen
  # SÓLO las filas de datos, donde la columna es homogénea.
  plan <- lapply(1:2, function(i) list(
    operational_code = sprintf("CH %d", i), classroom_id = sprintf("a%d", i),
    sample_role = "titular", operational_status = "agendada",
    sample_status = "AGENDADA", scheduled_date = "2026-09-11",
    scheduled_time = "10:00", faculty = "DERECHO", teacher = "D", course_name = "C"))
  partes <- list(list(operational_code = "CH 1", intento = 1L, estado = "aplicada",
                      aplicador = "Ana Prueba", efectivas = 18, asistentes = 25))
  destino <- tempfile(fileext = ".xlsx")
  aulas_libro_generar(plan, destino, partes = partes)

  filas <- aulas_libro_filas_produccion(plan, partes)
  i_dato <- which(vapply(filas, function(f) identical(f$tipo, "dato"), logical(1)))[[1]]
  d <- openxlsx::read.xlsx(destino, sheet = "Producción de aplicadores",
                           colNames = FALSE, rows = i_dato, cols = 2:5)
  for (j in seq_along(d)) {
    expect_true(is.numeric(d[[j]]),
                info = sprintf("columna %d llegó como %s", j + 1L, class(d[[j]])[1]))
  }
})
