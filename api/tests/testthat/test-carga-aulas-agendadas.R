# Lector de la hoja ancha «Aulas Agendadas».
#
# La fixture es SINTETICA a proposito: el libro real trae nombre, telefono y
# correo de cada docente, asi que no entra al repositorio ni como golden. Lo que
# se fija aqui es la anatomia —1 columna de id + bloques de 20— medida sobre el
# estudio de 2025 y documentada en `docs/qa/anatomia-excels-aulas-2026-08-16.md`.

.caa_titulos_bloque <- function() c(
  "MUESTRA", "CURSO-HORARIO", "NOMBRE DE\nDOCENTE", "TELÉFONO DE DOCENTE",
  "CORREO PUCP DOCENTE", "NOMBRE DEL\nCURSO", "FACULTAD", "NIVEL DEL\nCURSO",
  "SESIONES\nY AULA", "MATRICULADOS\nTOTAL DTI", "MATRICULADOS POBLACIÓN",
  "MEDIO DE\nCONTACTO", "FECHA DE\nLLAMADA", "NÚMERO DE INTENTOS",
  "STATUS\nMUESTRA", "FECHA DE APLICACIÓN", "DÍA", "HORA",
  "ENLACE DE\nLA FICHA", "OBSERVACIONES"
)

.caa_bloque <- function(code, status = "AGENDADA", intentos = 1, muestra = "Muestra 01") {
  c(muestra, code, "DOCENTE DEMO", "999000111", "demo@pucp.edu.pe",
    "CURSO DEMO", "CIENCIAS SOCIALES", "3", "LUN 08:00-10:00 A101",
    "40", "35", "Llamada", "2025-09-02", as.character(intentos), status,
    "2025-09-10", "Miércoles", "08:00", "https://x.test/ficha", "sin novedad")
}

.caa_vacio <- function() c("-", "-", "-", "-", "-", "-", "-", "-", "-", "-",
                           "-", "-", "-", "-", "-", "-", "-", "-", "-", "-")

.caa_hoja <- function(bloques_por_fila) {
  titulos <- c("ID MATCH", rep(.caa_titulos_bloque(), max(lengths(bloques_por_fila))))
  filas <- lapply(seq_along(bloques_por_fila), function(i) {
    bl <- bloques_por_fila[[i]]
    faltan <- max(lengths(bloques_por_fila)) - length(bl)
    c(as.character(i), unlist(bl), rep(.caa_vacio(), faltan))
  })
  df <- as.data.frame(do.call(rbind, filas), stringsAsFactors = FALSE)
  list(df = df, titulos = titulos)
}

test_that("el ancho de bloque se deduce de la hoja, no se asume", {
  # El estudio de 2025 trae 241 columnas: 1 + 12 x 20.
  expect_identical(aulas_agendadas_n_bloques(241L), 12L)
  expect_identical(aulas_agendadas_n_bloques(41L), 2L)
  expect_identical(aulas_agendadas_n_bloques(1L), 0L)
  expect_identical(aulas_agendadas_n_bloques(NA), 0L)
})

test_that("una fila ancha se convierte en titular mas su cadena", {
  h <- .caa_hoja(list(list(
    .caa_bloque("MAT146-0205"),
    .caa_bloque("MAT146-0204", status = "EN RESERVA 1", intentos = 2)
  )))
  filas <- aulas_agendadas_a_plan(h$df, h$titulos)

  expect_length(filas, 2L)
  expect_identical(filas[[1]]$sample_role, "titular")
  expect_identical(filas[[1]]$operational_code, "MAT146-0205")
  expect_identical(filas[[1]]$replacement_for, "")
  # El control: sin la traduccion de ancho a largo, la cadena quedaria dentro
  # de la misma fila y el segundo eslabon no existiria como unidad.
  expect_identical(filas[[2]]$sample_role, "chain_reserve")
  expect_identical(filas[[2]]$operational_code, "MAT146-0204")
  expect_identical(filas[[2]]$replacement_for, "MAT146-0205")
  expect_identical(filas[[2]]$replacement_order, 1L)
})

test_that("el ciclo de contacto llega al modelo", {
  h <- .caa_hoja(list(list(.caa_bloque("ABC-01", status = "REAGENDADA", intentos = 6))))
  f <- aulas_agendadas_a_plan(h$df, h$titulos)[[1]]

  # Sin esto no se puede decir POR QUE un aula sigue sin agendar.
  expect_identical(f$contact_medium, "Llamada")
  expect_identical(f$contact_date, "2025-09-02")
  expect_equal(f$contact_attempts, 6)
})

test_that("el estado de muestra no se mezcla con el de aplicacion", {
  h <- .caa_hoja(list(list(.caa_bloque("ABC-01", status = "REEMPLAZADA"))))
  f <- aulas_agendadas_a_plan(h$df, h$titulos)[[1]]

  # `sample_status` es su propio eje: AGENDADA / REAGENDADA / EN RESERVA n /
  # REEMPLAZADA. El de la aplicacion llega de otra hoja y no se solapa.
  expect_identical(f$sample_status, "REEMPLAZADA")
  expect_null(f$operational_status)
})

test_that("un guion es ausencia, no un valor", {
  # Medido: 1810 de 2040 celdas de STATUS MUESTRA del estudio real traen "-".
  h <- .caa_hoja(list(list(
    .caa_bloque("ABC-01"),
    .caa_vacio()
  )))
  filas <- aulas_agendadas_a_plan(h$df, h$titulos)

  # El control: sin normalizar el guion salian 2 filas y una categoria fantasma
  # llamada "-" en los conteos de estado.
  expect_length(filas, 1L)
  expect_identical(filas[[1]]$operational_code, "ABC-01")
})

test_that("los campos se resuelven por titulo y no por posicion", {
  # Un libro con una columna extra al principio del bloque no debe descuadrar
  # todo lo que viene detras.
  h <- .caa_hoja(list(list(.caa_bloque("ABC-01"))))
  revueltos <- h$titulos
  # Se intercambian dos titulos dentro del bloque; el lector debe seguirlos.
  i <- which(revueltos == "FACULTAD")[1]
  j <- which(revueltos == "NOMBRE DEL\nCURSO")[1]
  revueltos[c(i, j)] <- revueltos[c(j, i)]
  df <- h$df
  df[1, c(i, j)] <- df[1, c(j, i)]

  f <- aulas_agendadas_a_plan(df, revueltos)[[1]]
  expect_identical(f$faculty, "CIENCIAS SOCIALES")
  expect_identical(f$course_name, "CURSO DEMO")
})
