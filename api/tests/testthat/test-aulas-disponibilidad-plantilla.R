# **Si la app exige un formato, la app lo da.**
#
# Gonzalo, 2026-09-21: «la app debe ser capaz de dar un formato para que el
# coordinador pueda llenarlo fácilmente, quizás que ya todas las columnas ya
# estén y él solo ponga el nombre del aplicador y la x por día y hora».
#
# La prueba que vale es la IDA Y VUELTA: se genera la plantilla, se llena como
# la llenaría una persona —nombre y equis— y se lee con el mismo lector del
# operativo. Comprobar la forma de la plantilla por separado no serviría: lo que
# importa es que lo que la app entrega sea lo que la app sabe leer.

.adpt_llenar <- function(path, filas) {
  wb <- openxlsx::loadWorkbook(path)
  t <- suppressMessages(openxlsx::read.xlsx(path, sheet = "Disponibilidad", colNames = FALSE))
  dias <- as.character(unlist(t[1, ])); franjas <- as.character(unlist(t[2, ]))
  for (f in filas) {
    openxlsx::writeData(wb, "Disponibilidad", f$nombre, startRow = f$fila, startCol = 1, colNames = FALSE)
    for (m in f$marcas) {
      col <- which(dias == m[[1]] & franjas == m[[2]])[1]
      openxlsx::writeData(wb, "Disponibilidad", m[[3]], startRow = f$fila, startCol = col, colNames = FALSE)
    }
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
}

test_that("la plantilla que la app entrega es la que la app sabe leer", {
  p <- withr::local_tempfile(fileext = ".xlsx")
  aulas_disponibilidad_plantilla(p, desde = 7L, hasta = 22L, filas = 3L)
  .adpt_llenar(p, list(
    # Tres franjas contiguas: el lector las tiene que fusionar en un bloque.
    list(fila = 3, nombre = "ANA QUISPE", marcas = list(
      list("Martes", "10:00-11:00am", "X"), list("Martes", "11:00am-12:00pm", "X"),
      list("Martes", "12:00-1:00pm", "X"))),
    # Dos días distintos, y una marca en minúscula.
    list(fila = 4, nombre = "LUIS ROJAS", marcas = list(
      list("Martes", "3:00-4:00pm", "x"), list("Miércoles", "9:00-10:00am", "X")))
  ))
  leido <- carga_disponibilidad_aplicadores(p)
  expect_identical(length(leido), 2L)
  a <- leido[[1]]; l <- leido[[2]]
  expect_identical(a$nombre, "ANA QUISPE")
  expect_identical(names(a$dias), "martes")
  expect_identical(a$dias$martes[[1]]$inicio, "10:00")
  expect_identical(a$dias$martes[[1]]$fin, "13:00")
  expect_identical(sort(names(l$dias)), c("martes", "miercoles"))
  expect_identical(l$dias$martes[[1]]$inicio, "15:00")
  expect_identical(l$dias$miercoles[[1]]$inicio, "09:00")
})

test_that("llenar la plantilla no produce un solo aviso", {
  # Medido el 2026-09-21: con el aviso por celda vacia, tres personas y seis
  # marcas daban **267 avisos** sobre una lectura perfecta. Un aviso que salta
  # en el caso normal deja de avisar y entierra al que si importa.
  p <- withr::local_tempfile(fileext = ".xlsx")
  aulas_disponibilidad_plantilla(p, desde = 8L, hasta = 12L, filas = 3L)
  .adpt_llenar(p, list(list(fila = 3, nombre = "ANA QUISPE",
                            marcas = list(list("Lunes", "8:00-9:00am", "X")))))
  leido <- carga_disponibilidad_aplicadores(p)
  expect_identical(length(attr(leido, "avisos") %||% character(0)), 0L)
})

test_that("lo ILEGIBLE si se avisa, y se lee en el aviso", {
  # La otra mitad: «no marco» y «escribio algo que no supe leer» se arreglan
  # distinto, asi que no pueden decir lo mismo.
  p <- withr::local_tempfile(fileext = ".xlsx")
  aulas_disponibilidad_plantilla(p, desde = 8L, hasta = 11L, filas = 2L)
  .adpt_llenar(p, list(list(fila = 3, nombre = "ANA QUISPE", marcas = list(
    list("Lunes", "8:00-9:00am", "X"), list("Lunes", "9:00-10:00am", "tal vez")))))
  leido <- carga_disponibilidad_aplicadores(p)
  av <- attr(leido, "avisos") %||% character(0)
  expect_identical(length(av), 1L)
  expect_true(grepl("tal vez", av[[1]], fixed = TRUE))
  expect_true(grepl("ANA QUISPE", av[[1]], fixed = TRUE))
})

test_that("la franja del mediodia lleva el sufijo donde hace falta", {
  # «12:00-1:00pm»: la primera parte SIN am, que es como viene la hoja real y lo
  # que el parser desambigua. Si la plantilla escribiera «12:00am-1:00pm», el
  # lector la mandaria a la medianoche.
  expect_identical(prosecnurapp:::.adp_franja(11L), "11:00am-12:00pm")
  expect_identical(prosecnurapp:::.adp_franja(12L), "12:00-1:00pm")
  expect_identical(prosecnurapp:::.adp_franja(8L), "8:00-9:00am")
  expect_identical(prosecnurapp:::.adp_franja(15L), "3:00-4:00pm")
})

test_that("un rango al reves se niega con su codigo, no escribe medio archivo", {
  p <- withr::local_tempfile(fileext = ".xlsx")
  expect_error(aulas_disponibilidad_plantilla(p, desde = 20L, hasta = 8L),
               "E_DISPONIBILIDAD_PLANTILLA_RANGO|no es válido")
})
