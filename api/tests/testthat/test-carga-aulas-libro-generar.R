# Generacion del libro operativo, y el contrato que de verdad importa: lo que la
# app ESCRIBE lo tiene que poder VOLVER A LEER.
#
# Sin ese round-trip el generador y los lectores derivan en silencio y el equipo
# se entera cuando el libro de un estudio en curso deja de importar.

.calg_unidad <- function(code, role = "titular", rf = "", orden = NULL) list(
  operational_code = code, sample_role = role, replacement_for = rf,
  replacement_order = orden, wave = "Muestra 01", teacher = "Docente Demo",
  teacher_phone = "999", teacher_email = "d@x.test", course_name = "Curso Demo",
  faculty = "SOCIALES", level = "3", label = "LUN A101", schedule = "LUN 08:00",
  enrolled_total = 40, eligible_n = 35, link = paste0("https://x.test/", code)
)

test_that("lo que se genera se vuelve a leer sin perder la cadena", {
  unidades <- list(
    .calg_unidad("ABC-01"),
    .calg_unidad("ABC-02", "chain_reserve", "ABC-01", 1),
    .calg_unidad("XYZ-09")
  )
  path <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(unidades, path)
  out <- aulas_libro_importar(path)

  expect_identical(out$resumen$unidades, 3L)
  expect_identical(out$resumen$titulares, 2L)
  reserva <- Filter(function(u) identical(u$sample_role, "chain_reserve"), out$plan)[[1]]
  expect_identical(reserva$operational_code, "ABC-02")
  expect_identical(reserva$replacement_for, "ABC-01")
})

test_that("la app llena lo que sabe y deja vacio lo que le toca a la persona", {
  path <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(list(.calg_unidad("ABC-01")), path)
  f <- aulas_libro_importar(path)$plan[[1]]

  # Lo que la app sabe.
  expect_identical(f$operational_code, "ABC-01")
  expect_identical(f$teacher, "Docente Demo")
  expect_identical(f$link, "https://x.test/ABC-01")
  expect_equal(f$eligible_n, 35)
  # Lo que llena quien agenda: en blanco. Rellenarlo seria inventar campo.
  expect_identical(f$contact_medium, "")
  expect_identical(f$contact_date, "")
  expect_identical(f$sample_status, "")
  expect_identical(f$scheduled_date, "")
})

test_that("la profundidad de la cadena sale del plan, no de una constante", {
  # Un estudio con cadenas de dos no debe llevar doce bloques vacios.
  cortas <- list(.calg_unidad("A-1"), .calg_unidad("A-2", "chain_reserve", "A-1", 1))
  path <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(cortas, path)
  hojas <- readxl::read_excel(path, sheet = "Aulas Agendadas", col_names = FALSE, .name_repair = "minimal")

  # 1 columna de id + 2 bloques de 20.
  expect_identical(ncol(hojas), 41L)
})

test_that("el parte de campo generado trae la identidad y espera el resto", {
  path <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(list(.calg_unidad("ABC-01")), path)
  out <- aulas_libro_importar(path)

  # Nadie lo lleno todavia: cero partes es lo correcto, no un fallo de lectura.
  expect_identical(out$resumen$partes_de_campo, 0L)
  # Y la hoja de control si trae su fila de identidad.
  expect_identical(out$resumen$filas_de_control, 1L)
})

test_that("generar sin plan se rechaza con su codigo", {
  err <- tryCatch(aulas_libro_generar(list(), tempfile(fileext = ".xlsx")), error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_AULAS_LIBRO_SIN_PLAN")
})
