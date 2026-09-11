# El tercer cruce: quién puede a cada hora.
#
# La hoja tenía dos de los tres cruces posibles de sus tres ejes —hora × día da
# el conteo, persona × día da el rango— y para saber QUIÉN puede el miércoles a
# las 15:30 había que leer treinta y un rangos de texto y cruzarlos de cabeza.
# Gonzalo, 2026-09-11: «los rangos horarios ya siempre son iguales, entonces
# quién puede cada día tiene que sistematizarse por hora».

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
tabla3 <- function() {
  f <- filas()
  i <- which(vapply(f, function(x) identical(x$tipo, "bloque") &&
                      grepl("A CADA HORA", x$celdas[[1]]), logical(1)))
  f[i:length(f)]
}

test_that("la celda son los DÍAS en que esa persona puede a esa hora", {
  t3 <- tabla3()
  cab <- t3[[which(vapply(t3, function(x) identical(x$tipo, "cabecera"), logical(1)))[[1]]]]$celdas
  datos <- Filter(function(x) identical(x$tipo, "dato"), t3)
  fila0830 <- Filter(function(x) identical(x$celdas[[1]], "08:00 a 08:30"), datos)[[1]]
  col <- function(nombre) which(cab == nombre)
  # Ana puede el lunes y el martes a esa hora; Berta el lunes y el miércoles.
  expect_identical(fila0830$celdas[[col("Ana Prueba")]], "LM")
  expect_identical(fila0830$celdas[[col("Berta Ficticia")]], "LX")
})

test_that("el miércoles es X y no M: dos días con la misma letra rompen la cuadrícula", {
  # La clave del motor va SIN tilde («miercoles»): es un identificador, no un
  # rótulo, y una fixture con tilde hace que ese día se caiga entero de la
  # tabla sin que nada falle. Se aceptan las dos por si alguna llega rotulada.
  expect_identical(prosecnurapp:::.ald_inicial_de_dia("miércoles"), "X")
  expect_identical(prosecnurapp:::.ald_inicial_de_dia("miercoles"), "X")
  expect_identical(prosecnurapp:::.ald_inicial_de_dia("martes"), "M")
  expect_identical(prosecnurapp:::.ald_inicial_de_dia("sábado"), "S")
})

test_that("los días salen en el orden de la SEMANA, no en el de aparición", {
  # La fixture declara lunes, miércoles y martes en ese orden. «LXM» obligaría a
  # releer la celda para entenderla.
  t3 <- tabla3()
  datos <- Filter(function(x) identical(x$tipo, "dato"), t3)
  fila <- Filter(function(x) identical(x$celdas[[1]], "08:00 a 08:30"), datos)[[1]]
  expect_false(any(vapply(fila$celdas[-1], function(c) grepl("XM", c, fixed = TRUE), logical(1))))
})

test_that("quien no puede a esa hora deja la celda VACÍA, no un cero", {
  # Un cero se lee como una cifra y aquí no hay ninguna que contar.
  t3 <- tabla3()
  cab <- t3[[which(vapply(t3, function(x) identical(x$tipo, "cabecera"), logical(1)))[[1]]]]$celdas
  datos <- Filter(function(x) identical(x$tipo, "dato"), t3)
  fila0900 <- Filter(function(x) identical(x$celdas[[1]], "08:30 a 09:00"), datos)[[1]]
  expect_identical(fila0900$celdas[[which(cab == "Berta Ficticia")]], "")
})

test_that("las otras dos tablas siguen ahí: se AÑADE un cruce, no se sustituye", {
  bloques <- vapply(Filter(function(x) identical(x$tipo, "bloque"), filas()),
                    function(x) x$celdas[[1]], character(1))
  expect_true("CUÁNTOS HAY, HORA POR HORA" %in% bloques)
  expect_true("QUIÉN PUEDE CADA DÍA" %in% bloques)
  expect_true("QUIÉN PUEDE A CADA HORA" %in% bloques)
})

test_that("sin oferta no se inventa una cuadrícula vacía", {
  expect_null(prosecnurapp:::aulas_libro_filas_disponibilidad(list()))
})
