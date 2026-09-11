# «Quién puede» pasa de días a HORAS.
#
# Gonzalo, 2026-09-11: «los rangos horarios ya siempre son iguales, entonces
# quién puede cada día tiene que sistematizarse por hora, no sólo lunes, no sólo
# martes… y todo tiene que estar muy conciso y muy bien elaborado». «Quién puede
# cada día» era el título de esa tabla: no pidió una tercera, pidió que ÉSA se
# ordenara por hora.
#
# La celda era el rango escrito —«08:00 a 11:00 · 15:00 a 18:00»— y para saber
# quién cubre el miércoles a las 15:30 había que leer treinta y un rangos y
# cruzarlos de cabeza.

bloque <- list(dias = list(
  list(dia = "lunes", franjas = list(
    list(inicio = "08:00", fin = "08:30", disponibles = 2, nombres = list("Ana Prueba", "Berta Ficticia")),
    list(inicio = "08:30", fin = "09:00", disponibles = 1, nombres = list("Ana Prueba")))),
  list(dia = "miercoles", franjas = list(
    list(inicio = "08:00", fin = "08:30", disponibles = 1, nombres = list("Berta Ficticia")))),
  list(dia = "martes", franjas = list(
    list(inicio = "08:00", fin = "08:30", disponibles = 1, nombres = list("Ana Prueba"))))
))

filas <- function() prosecnurapp:::aulas_libro_filas_disponibilidad(bloque)
cabecera_personas <- function() {
  f <- filas()
  i <- which(vapply(f, function(x) identical(x$tipo, "cabecera") &&
                      identical(x$celdas[[1]], "APLICADOR"), logical(1)))[[1]]
  f[[i]]$celdas
}
fila_de <- function(quien) {
  f <- filas()
  for (x in f) if (identical(x$tipo, "dato") && identical(x$celdas[[1]], quien)) return(x$celdas)
  NULL
}

test_that("las columnas son TRAMOS y la celda son los días", {
  cab <- cabecera_personas()
  expect_identical(cab[[1]], "APLICADOR")
  # La cabecera lleva sólo la hora de INICIO: «08:00 a 08:30» en columnas
  # estrechas no se lee, y el tramo se deduce de la siguiente.
  expect_identical(cab[[2]], "08:00")
  expect_identical(cab[[3]], "08:30")
  ana <- fila_de("Ana Prueba")
  # Ana puede lunes y martes a las 08:00, y sólo lunes a las 08:30.
  expect_identical(ana[[2]], "LM")
  expect_identical(ana[[3]], "L")
})

test_that("el miércoles es X y no M: dos días con la misma letra rompen la cuadrícula", {
  expect_identical(prosecnurapp:::.ald_inicial_de_dia("miercoles"), "X")
  expect_identical(prosecnurapp:::.ald_inicial_de_dia("martes"), "M")
  expect_identical(prosecnurapp:::.ald_inicial_de_dia("sabado"), "S")
  # La clave del motor va SIN tilde («miercoles»): es un identificador, no un
  # rótulo. Una fixture con tilde tira ese día entero de la tabla y NADA falla.
  expect_identical(prosecnurapp:::.ald_inicial_de_dia("miércoles"), "X")
  expect_identical(fila_de("Berta Ficticia")[[2]], "LX")
})

test_that("los días salen en el orden de la SEMANA, no en el de aparición", {
  # La fixture declara lunes, miércoles y martes en ese orden; «LXM» obligaría a
  # releer la celda para entenderla.
  expect_identical(fila_de("Berta Ficticia")[[2]], "LX")
  expect_false(grepl("XM", paste(fila_de("Ana Prueba"), collapse = ""), fixed = TRUE))
})

test_that("quien no puede a esa hora deja la celda VACÍA, no un cero", {
  # Un cero se lee como una cifra y aquí no hay ninguna que contar.
  expect_identical(fila_de("Berta Ficticia")[[3]], "")
})

test_that("siguen siendo DOS tablas: la de arriba no se toca", {
  bloques <- vapply(Filter(function(x) identical(x$tipo, "bloque"), filas()),
                    function(x) x$celdas[[1]], character(1))
  expect_identical(bloques, c("CUÁNTOS HAY, HORA POR HORA", "QUIÉN PUEDE, HORA POR HORA"))
})

test_that("las dos tablas quieren columnas ESTRECHAS, que es lo que las deja convivir", {
  # El rango escrito pedía columnas anchas y con treinta y un aplicadores dejaba
  # la hoja en cuatro mil píxeles. Un conteo de dos cifras y unas iniciales
  # caben en lo mismo, así que las dos tablas comparten anchos sin pelearse.
  anchas <- vapply(Filter(function(x) identical(x$tipo, "dato"), filas()),
                   function(x) max(nchar(as.character(x$celdas[-1]))), integer(1))
  expect_lt(max(anchas), 8L)
})

test_that("sin oferta no se inventa una cuadrícula vacía", {
  expect_null(prosecnurapp:::aulas_libro_filas_disponibilidad(list()))
})
