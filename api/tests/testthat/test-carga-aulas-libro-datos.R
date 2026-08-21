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
