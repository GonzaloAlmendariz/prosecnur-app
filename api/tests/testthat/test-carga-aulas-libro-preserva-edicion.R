# Regenerar el libro NO borra lo que el equipo editó a mano.
#
# El caso real, dicho por Gonzalo el 2026-08-28: «el Excel da información sobre
# la agendación y el registro de campo; la aplicación lee los primeros dos y
# genera el tercero SIN REESCRIBIR LAS PRIMERAS DOS, que son las que
# constantemente están editándose».
#
# Medido antes de este test: generar el libro, editar a mano la fecha de
# agendamiento y los intentos de contacto, y regenerar SIN importar devolvía la
# hoja al estado del plan —fecha vacía, intentos de 77 a 2— sin error, sin
# comparar con el disco y sin aviso.
#
# **Por qué `test-carga-aulas-libro-roundtrip.R` no lo cazaba.** Sus veinte
# tests hacen `generar → importar`: prueban que la app relee lo que ELLA MISMA
# escribió. Varios se llaman «el agendamiento ya registrado NO se borra al
# regenerar» y ninguno introduce una edición externa entre medias, que es el
# caso real. Cobertura que parece cubrir y mide otra cosa.

.pe_plan <- function() list(
  list(classroom_id = "A-01", operational_code = "CH 1", label = "Aula 101",
       course_name = "Curso 1", teacher = "Docente 1", faculty = "Ciencias",
       sample_role = "titular", wave = "M1", orden = 1, eligible_n = 30,
       enrolled_total = 34, expected_valid = 20, sample_status = "agendada",
       contact_medium = "Correo", contact_attempts = 2,
       scheduled_date = "2026-08-20"),
  list(classroom_id = "A-04", operational_code = "CH 4", label = "Aula 104",
       course_name = "Curso 4", teacher = "Docente 4", faculty = "Letras",
       sample_role = "titular", wave = "M1", orden = 4, eligible_n = 25,
       enrolled_total = 28, expected_valid = 18, sample_status = "agendada",
       contact_attempts = 1)
)

# Escribe en una celda de una hoja como lo haría una persona en Excel: abre el
# archivo que ya existe, cambia el valor y guarda.
# «Aulas Aplicadas (Campo)» lleva su cabecera en la fila 2: la 1 es el título
# combinado del bloque de intento. Por eso `cabecera` es un parámetro.
.pe_editar <- function(path, hoja, patron_columna, valor, fila_dato = 1L,
                       cabecera = 1L) {
  wb <- openxlsx::loadWorkbook(path)
  d <- openxlsx::read.xlsx(path, sheet = hoja, startRow = cabecera)
  col <- grep(patron_columna, toupper(names(d)))[1]
  if (is.na(col)) stop("columna no encontrada en la hoja: ", patron_columna)
  openxlsx::writeData(wb, hoja, valor, startCol = col,
                      startRow = cabecera + fila_dato, colNames = FALSE)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  col
}

# `detectDates` no es un detalle del test: el generador escribe las fechas como
# FECHAS de Excel con su estilo, así que sin esto una fecha vuelve como el
# serial 46280 en vez de «2026-09-15» y el test acusa una pérdida que no hubo.
.pe_leer <- function(path, hoja, col, fila_dato = 1L, cabecera = 1L) {
  d <- openxlsx::read.xlsx(path, sheet = hoja, startRow = cabecera, detectDates = TRUE)
  as.character(d[[col]][fila_dato])
}

test_that("regenerar conserva la fecha del ciclo de contacto editada a mano", {
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.pe_plan(), libro)
  # La primera columna que casa con FECHA es «FECHA DE LLAMADA» (`contact_date`).
  col <- .pe_editar(libro, "Aulas Agendadas", "FECHA", "2026-09-15")
  expect_identical(.pe_leer(libro, "Aulas Agendadas", col), "2026-09-15")

  # Regenerar con el MISMO plan de sesión, sin importar antes. Es lo que hace
  # el endpoint `/api/monitoreo/aulas/generar-libro`.
  aulas_libro_generar(.pe_plan(), libro)
  expect_identical(.pe_leer(libro, "Aulas Agendadas", col), "2026-09-15")
})

test_that("regenerar conserva los intentos de contacto editados a mano", {
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.pe_plan(), libro)
  col <- .pe_editar(libro, "Aulas Agendadas", "INTENTO", 77)
  aulas_libro_generar(.pe_plan(), libro)
  expect_identical(.pe_leer(libro, "Aulas Agendadas", col), "77")
})

test_that("regenerar conserva el parte de campo escrito a mano", {
  # La segunda hoja que el equipo edita, «a veces» según el dueño.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.pe_plan(), libro)
  col <- .pe_editar(libro, "Aulas Aplicadas (Campo)", "ASISTENTES", 23, cabecera = 2L)
  aulas_libro_generar(.pe_plan(), libro)
  expect_identical(.pe_leer(libro, "Aulas Aplicadas (Campo)", col, cabecera = 2L), "23")
})

test_that("un libro NUEVO sigue saliendo entero", {
  # El arreglo no puede depender de que el archivo exista: la primera
  # generación es la que da la cadena, los enlaces y la estructura.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  expect_false(file.exists(libro))
  aulas_libro_generar(.pe_plan(), libro)
  expect_true(file.exists(libro))
  # CINCO hojas, no tres: además de las tres operativas están «Cómo va el
  # campo» (indicadores) y «Listas» (el origen de los desplegables). Son las
  # «hojas adicionales» que el dueño describe, y ya existen.
  expect_setequal(readxl::excel_sheets(libro),
                  c("Aulas Agendadas", "Aulas Aplicadas (Campo)", "Base de control",
                    "Cómo va el campo", "Listas"))
  v <- aulas_libro_importar(libro)
  expect_length(v$plan, 2L)
})

test_that("un aula NUEVA del plan entra aunque el libro en disco no la tenga", {
  # El otro lado del contrato: preservar lo editado no puede congelar el plan.
  # Si el sorteo añade un aula, tiene que aparecer.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.pe_plan(), libro)
  .pe_editar(libro, "Aulas Agendadas", "INTENTO", 77)

  mas <- c(.pe_plan(), list(
    list(classroom_id = "A-09", operational_code = "CH 9", label = "Aula 109",
         course_name = "Curso 9", teacher = "Docente 9", faculty = "Ciencias",
         sample_role = "titular", wave = "M1", orden = 9, eligible_n = 40,
         enrolled_total = 44, expected_valid = 26, sample_status = "agendada")
  ))
  aulas_libro_generar(mas, libro)
  v <- aulas_libro_importar(libro)
  codigos <- vapply(v$plan, function(r) as.character(r$operational_code %||% ""), character(1))
  expect_true("CH 9" %in% codigos)
  expect_length(v$plan, 3L)
})

test_that("el dato del PLAN sigue llegando a un aula que nadie editó", {
  # Preservar el disco no puede volver la hoja de solo-lectura: lo que el plan
  # sabe y el equipo no tocó tiene que actualizarse.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.pe_plan(), libro)
  cambiado <- lapply(.pe_plan(), function(u) {
    if (identical(u$operational_code, "CH 4")) u$teacher <- "Docente CAMBIADO"
    u
  })
  aulas_libro_generar(cambiado, libro)
  v <- aulas_libro_importar(libro)
  docentes <- setNames(
    vapply(v$plan, function(r) as.character(r$teacher %||% ""), character(1)),
    vapply(v$plan, function(r) as.character(r$operational_code %||% ""), character(1))
  )
  expect_identical(unname(docentes[["CH 4"]]), "Docente CAMBIADO")
})
