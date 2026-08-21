plan_datos <- list(
  list(operational_code = "CH 1", titular_operational_code = "CH 1", sample_role = "titular",
       faculty = "Derecho", course_name = "CURSO A", teacher = "Docente 1",
       enrolled_total = 60, eligible_n = 40, expected_valid = 16,
       sample_status = "AGENDADA", scheduled_date = "2026-08-11", scheduled_time = "10:00"),
  list(operational_code = "R 1.1", titular_operational_code = "CH 1",
       sample_role = "chain_reserve", replacement_order = 1, faculty = "Derecho",
       course_name = "CURSO B", eligible_n = 30, expected_valid = 12),
  list(operational_code = "E 1", sample_role = "extra_reserve_pool", faculty = "Gestión",
       course_name = "CURSO C", eligible_n = 25, expected_valid = 10)
)

test_that("la hoja de datos es LARGA: una fila por unidad", {
  # Una dinamica necesita datos largos. «Aulas Agendadas» pone al titular y sus
  # once reservas en la MISMA fila, con los veinte titulos repetidos doce veces:
  # sobre eso no se puede pivotar, y Excel ni admite columnas con nombre
  # duplicado.
  d <- aulas_libro_hoja_datos(plan_datos)
  expect_equal(nrow(d), 3L)
  expect_equal(length(unique(names(d))), ncol(d))
})

test_that("el papel de cada fila se dice en palabras, no en jerga interna", {
  # La hoja la abre gente que no sabe que es un `chain_reserve`.
  d <- aulas_libro_hoja_datos(plan_datos)
  expect_equal(d$Papel, c("Titular", "Reserva de cadena", "Banco de extras"))
  # Y una fila sin rol se nombra en vez de quedar vacia.
  sin <- aulas_libro_hoja_datos(list(list(operational_code = "CH 9")))
  expect_equal(sin$Papel, "Sin declarar")
})

test_that("una reserva se puede agrupar con su titular", {
  # Es lo que hace util la dinamica: pivotar por titular y ver su cadena.
  d <- aulas_libro_hoja_datos(plan_datos)
  expect_equal(d$Titular[d$`Curso-horario` == "R 1.1"], "CH 1")
  # Un titular es su propio titular: sin eso, agrupar por esa columna dejaria
  # fuera a las 190 filas que mas importan.
  expect_equal(d$Titular[d$`Curso-horario` == "CH 1"], "CH 1")

  # Y el caso que de verdad separa las dos formas: un titular que NO trae
  # `titular_operational_code` —pasa cuando el plan viene del libro y no de la
  # seleccion—. Con el fixture de arriba las dos coinciden y el aserto no
  # probaria nada.
  suelto <- aulas_libro_hoja_datos(list(
    list(operational_code = "CH 7", sample_role = "titular", faculty = "Letras")
  ))
  expect_equal(suelto$Titular, "CH 7")
})

test_that("la fecha va como fecha y los conteos como numeros", {
  d <- aulas_libro_hoja_datos(plan_datos)
  expect_s3_class(d$`Fecha agendada`, "Date")
  expect_true(is.numeric(d$Elegibles))
  expect_equal(d$Elegibles, c(40, 30, 25))
})

test_that("el libro trae la tabla con nombre, que es lo que pide la dinamica", {
  path <- file.path(tempdir(), "libro_datos.xlsx")
  aulas_libro_generar(plan_datos, path)
  expect_true("Datos" %in% openxlsx::getSheetNames(path))

  destino <- file.path(tempdir(), paste0("tb_", as.integer(runif(1, 1, 1e6))))
  dir.create(destino)
  utils::unzip(path, exdir = destino)
  tablas <- list.files(file.path(destino, "xl", "tables"), full.names = TRUE)
  expect_gt(length(tablas), 0)
  xml <- paste(readLines(tablas[[1]], warn = FALSE), collapse = "")
  # El nombre es el que aparece al crear la dinamica: si cambia, el usuario
  # tiene que buscarla.
  expect_match(xml, 'name="datos_aulas"')
  expect_match(xml, "autoFilter")
})

# --- Los hechos de campo y control en la tabla de dinamicas ------------------

.dat_u <- function() list(operational_code = "CH 1", sample_role = "titular",
                          faculty = "Letras", course_name = "Curso 1",
                          eligible_n = 30, enrolled_total = 34)

test_that("la tabla trae los hechos de campo y de control, no solo el plan", {
  # Con solo el plan, una dinamica puede contar aulas por facultad y nada mas:
  # no puede responder cuantas efectivas hubo ni cuantas pasaron el umbral.
  d <- aulas_libro_hoja_datos(
    list(.dat_u()),
    list(list(operational_code = "CH 1", intento = 1L, observed_students = 22,
              effective_surveys = 20, application_status = "APLICADA")),
    list(list(operational_code = "CH 1", sent_total = 21, threshold_total = 21,
              valid_total = 1, women_n = 9))
  )
  expect_equal(d$Efectivas[[1]], 20)
  expect_identical(d$`Estado de aplicacion (parte)`[[1]], "APLICADA")
  expect_equal(d$Enviadas[[1]], 21)
  expect_equal(d$`Valido total`[[1]], 1)
  expect_equal(d$Mujeres[[1]], 9)
})

test_that("los hechos que registran las DOS hojas no se colapsan en una columna", {
  # El cruce de las dos fuentes ya midio que discrepan: el revisor corrige
  # cuentas del parte. Una columna sola llamada «Asistentes» obligaria a elegir
  # en silencio cual gana. El control: los dos valores son distintos y los dos
  # tienen que estar.
  d <- aulas_libro_hoja_datos(
    list(.dat_u()),
    list(list(operational_code = "CH 1", intento = 1L, observed_students = 22,
              attendance_pct = 0.61, applied_by = "Equipo A")),
    list(list(operational_code = "CH 1", observed_students = 23,
              attendance_pct = 0.64))
  )
  expect_equal(d$`Asistentes (parte)`[[1]], 22)
  expect_equal(d$`Asistentes (control)`[[1]], 23)
  expect_equal(d$`% asistencia (parte)`[[1]], 0.61)
  expect_equal(d$`% asistencia (control)`[[1]], 0.64)
})

test_that("de varios intentos manda el ULTIMO que registro algo", {
  d <- aulas_libro_hoja_datos(
    list(.dat_u()),
    list(list(operational_code = "CH 1", intento = 1L, observed_students = 5,
              application_status = "NO SE APLICO"),
         list(operational_code = "CH 1", intento = 2L, observed_students = 22,
              application_status = "APLICADA"))
  )
  # Con el primero, la tabla diria que en esa aula hubo 5 asistentes y que no
  # se aplico: el historial vive en la hoja de campo, aqui hay una fila por aula.
  expect_equal(d$`Asistentes (parte)`[[1]], 22)
  expect_identical(d$`Estado de aplicacion (parte)`[[1]], "APLICADA")
})

test_that("ninguna columna se repite: una Excel Table no lo admite", {
  # Es la razon de ser de esta hoja —las del libro repiten los veinte titulos
  # doce veces— y ahora que trae campos de tres fuentes, el choque de nombres
  # es facil. `writeDataTable` fallaria; que falle aqui y no al generar.
  d <- aulas_libro_hoja_datos(
    list(.dat_u()),
    list(list(operational_code = "CH 1", intento = 1L, observed_students = 22)),
    list(list(operational_code = "CH 1", observed_students = 23))
  )
  expect_identical(anyDuplicated(names(d)), 0L)
  expect_gt(ncol(d), 30L)
})

test_that("el orden de reemplazo va VACIO en quien no lo tiene", {
  # Medido en el estudio: 243 de 269 filas llevaban un 0 que no significa nada
  # —170 titulares y 73 del banco— contra 26 con orden de verdad. En una
  # dinamica ese 0 es un valor real y contamina cualquier promedio.
  d <- aulas_libro_hoja_datos(list(
    list(operational_code = "CH 1", sample_role = "titular", faculty = "Letras"),
    list(operational_code = "R 1.1", sample_role = "chain_reserve",
         titular_operational_code = "CH 1", replacement_order = 1, faculty = "Letras"),
    list(operational_code = "X 1", sample_role = "extra_reserve_pool", faculty = "Letras")
  ))
  expect_true(is.na(d$Orden[[1]]))
  expect_equal(d$Orden[[2]], 1L)
  expect_true(is.na(d$Orden[[3]]))
  # El control: la reserva SI lo tiene, asi que la columna no es toda vacia.
  expect_equal(sum(!is.na(d$Orden)), 1L)
})
