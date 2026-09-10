# **Un aviso que señala TODAS las filas no señala ninguna.**
#
# El 2026-09-09, con `reparto_rango` vacío, el ensayo de sincronizar devolvía
# las 93 filas de la hoja marcadas `fecha_ilegible`. Ninguna lo era: la columna
# FECHA lleva «11/09» sin año —así la escribe el motor y así la teclea el
# equipo— y `monitoreo_aulas_filas_dudosas()` pasaba la propia celda como
# `desde` para sacar el año, con lo que no encontraba ninguno y las declaraba
# ilegibles en bloque.
#
# La distinción que se sujeta: «11/09» es una fecha a la que le falta el año, no
# un texto ilegible.

.mafv_cab <- function() as.list(prosecnurapp:::.alpa_CABECERA)

.mafv_fila <- function(cod, fecha) {
  as.list(c("Ana Prueba", "Viernes", fecha, "09:30", "09:45", "10:00 a 10:30",
            cod, "A101", "Ciencias", "Cálculo", "Docente Uno", "POR APLICAR"))
}

.mafv_hoja <- function(...) c(list(.mafv_cab()), list(...))

test_that("sin ventana, una fecha corta bien escrita NO es dudosa", {
  hoja <- .mafv_hoja(.mafv_fila("CH 1", "11/09"), .mafv_fila("CH 2", "12/09"))
  expect_length(monitoreo_aulas_filas_dudosas(hoja), 0L)
})

test_that("sin ventana, lo que NO tiene forma de fecha sigue siendo ilegible", {
  # El aviso no se apaga: se acota a lo que de verdad no se puede leer.
  hoja <- .mafv_hoja(.mafv_fila("CH 1", "11/09"), .mafv_fila("CH 3", "el viernes"))
  out <- monitoreo_aulas_filas_dudosas(hoja)
  expect_length(out, 1L)
  expect_identical(out[[1]]$curso_horario, "CH 3")
  expect_identical(out[[1]]$motivo, "fecha_ilegible")
})

test_that("con ventana, la fecha corta se sitúa y lo de fuera se dice", {
  hoja <- .mafv_hoja(.mafv_fila("CH 1", "11/09"), .mafv_fila("CH 9", "28/09"))
  out <- monitoreo_aulas_filas_dudosas(hoja, desde = "2026-09-07", hasta = "2026-09-12")
  expect_length(out, 1L)
  expect_identical(out[[1]]$curso_horario, "CH 9")
  expect_identical(out[[1]]$motivo, "fuera_de_la_semana")
})

test_that("una fila ISO completa se lee con ventana y sin ella", {
  hoja <- .mafv_hoja(.mafv_fila("CH 1", "2026-09-11"))
  expect_length(monitoreo_aulas_filas_dudosas(hoja), 0L)
  expect_length(monitoreo_aulas_filas_dudosas(hoja, desde = "2026-09-07", hasta = "2026-09-12"), 0L)
})

test_that("una fila con contenido y sin curso-horario se sigue diciendo", {
  hoja <- .mafv_hoja(.mafv_fila("", "11/09"))
  out <- monitoreo_aulas_filas_dudosas(hoja)
  expect_length(out, 1L)
  expect_identical(out[[1]]$motivo, "sin_curso_horario")
})

test_that("una fecha con forma imposible NO se cuela por tener forma", {
  # «45/13» encaja en el patrón dd/mm y no existe: con ventana tiene que caer,
  # porque ahí sí se intenta situar de verdad.
  hoja <- .mafv_hoja(.mafv_fila("CH 4", "45/13"))
  out <- monitoreo_aulas_filas_dudosas(hoja, desde = "2026-09-07", hasta = "2026-09-12")
  expect_length(out, 1L)
  expect_identical(out[[1]]$motivo, "fecha_ilegible")
})

test_that("sin rango declarado, el recibo DICE que entra todo el horizonte", {
  # Medido el 2026-09-09: sin rango, el ensayo proponía añadir 49 aulas de las
  # semanas 2 a 4, que están aplazadas a propósito. No se inventa un rango —qué
  # semana se reparte lo decide el lead— pero proponerlas en silencio es lo que
  # hace que alguien las aplique sin querer.
  texto <- monitoreo_aulas_sincronizacion_texto(list(
    aplicado = FALSE,
    anadidas = replicate(49, list(curso_horario = "CH x"), simplify = FALSE),
    sin_aplicador = list(),
    ventana = list(desde = "", hasta = "")
  ))
  expect_true(grepl("no hay rango de reparto declarado", texto, fixed = TRUE))
  expect_true(grepl("49 aulas de aquí en adelante", texto, fixed = TRUE))
})

test_that("con rango declarado el aviso no aparece", {
  texto <- monitoreo_aulas_sincronizacion_texto(list(
    aplicado = FALSE,
    anadidas = list(list(curso_horario = "CH 1")),
    sin_aplicador = list(),
    ventana = list(desde = "2026-09-07", hasta = "2026-09-12")
  ))
  expect_false(grepl("no hay rango", texto, fixed = TRUE))
})

test_that("sin rango pero sin nada que añadir tampoco avisa: no habría de qué", {
  texto <- monitoreo_aulas_sincronizacion_texto(list(
    aplicado = FALSE, anadidas = list(), sin_aplicador = list(),
    ventana = list(desde = "", hasta = "")))
  expect_false(grepl("no hay rango", texto, fixed = TRUE))
})

test_that("sin rango, el recibo dice que «citas sin agenda» NO PUDO comprobarse", {
  # Sin ventana ninguna fila se sitúa —la fecha de la hoja no lleva año— y el
  # detector las salta todas, devolviendo una lista vacía que se lee como
  # «ninguna cita perdió su aula». Medido sobre la hoja del operativo: sin
  # ventana 0, con la ventana 07→12 encuentra 2. Una búsqueda que no encuentra
  # no puede callar.
  texto <- monitoreo_aulas_sincronizacion_texto(list(
    aplicado = FALSE, anadidas = list(), sin_agenda = list(), sin_aplicador = list(),
    ventana = list(desde = "", hasta = "")))
  expect_true(grepl("sin rango declarado no se puede comprobar", texto, fixed = TRUE))
})

test_that("con rango, el recibo no se disculpa: ahí sí puede contestar", {
  texto <- monitoreo_aulas_sincronizacion_texto(list(
    aplicado = FALSE, anadidas = list(), sin_agenda = list(), sin_aplicador = list(),
    ventana = list(desde = "2026-09-07", hasta = "2026-09-12")))
  expect_false(grepl("sin rango declarado", texto, fixed = TRUE))
})
