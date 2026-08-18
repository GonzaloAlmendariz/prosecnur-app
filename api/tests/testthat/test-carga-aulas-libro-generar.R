# Generacion del libro operativo, y el contrato que de verdad importa: lo que la
# app ESCRIBE lo tiene que poder VOLVER A LEER.
#
# Sin ese round-trip el generador y los lectores derivan en silencio y el equipo
# se entera cuando el libro de un estudio en curso deja de importar.

# `titular_operational_code` acompaña SIEMPRE a `replacement_for`, porque asi
# llega del normalizador: son dos campos con dos idiomas. `replacement_for`
# lleva el `classroom_id` del titular —lo escriben asi `calc_muestra_aulas.R` y
# `monitoreo_aulas_apply_replacement()`— y `titular_operational_code` el codigo
# operativo. El fixture ponia solo el primero con un `CH n` dentro, y esa
# mentira tapaba que agrupar la cadena por `replacement_for` no funciona: sobre
# HSVG2026, 0 de 202 valores coincidian con un titular.
.calg_unidad <- function(code, role = "titular", rf = "", orden = NULL) list(
  operational_code = code, sample_role = role, replacement_for = rf,
  titular_operational_code = rf,
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

test_that("la cadena se agrupa aunque replacement_for traiga el classroom_id", {
  # El fixture REALISTA, tomado de HSVG2026: `replacement_for` no lleva «CH 1»
  # sino «arc232_0905», el `classroom_id` del titular. Es lo que escriben sus
  # dos escritores y por tanto lo que llega de verdad.
  #
  # Con el generador agrupando por ese campo, el titular quedaba en un grupo y
  # sus dos reservas en otro, bajo una clave que no existe como fila: tres
  # filas de Excel para una sola cadena. Este aserto es el que lo caza — si se
  # vuelve a agrupar por `replacement_for`, `nrow` sube de 2 a 3.
  unidades <- list(
    list(operational_code = "CH 1", sample_role = "titular",
         titular_operational_code = "CH 1", replacement_for = ""),
    list(operational_code = "R 1.1", sample_role = "chain_reserve",
         titular_operational_code = "CH 1", replacement_for = "arc232_0905",
         replacement_order = 1),
    list(operational_code = "R 1.2", sample_role = "chain_reserve",
         titular_operational_code = "CH 1", replacement_for = "arc232_0905",
         replacement_order = 2)
  )
  hoja <- aulas_libro_hoja_agendadas(unidades)

  # Cabecera + UNA fila: la cadena entera vive en su titular.
  expect_identical(nrow(hoja), 2L)
  # Y los tres eslabones salen en orden dentro de esa fila.
  fila <- as.character(hoja[2, ])
  expect_true(all(c("CH 1", "R 1.1", "R 1.2") %in% fila))
  expect_lt(which(fila == "R 1.1"), which(fila == "R 1.2"))
  expect_lt(which(fila == "CH 1"), which(fila == "R 1.1"))
})
