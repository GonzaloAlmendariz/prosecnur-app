# Exportador de la solicitud de datos a la DTI
# (calc_muestra_solicitud_dti.R): workbook con las 3 hojas de estructura +
# hoja de criterios con los bullets fijos, agrupación por el campo `hoja`
# del payload y validación de input con error API limpio.

.dti_payload <- function() {
  list(
    variables = list(
      list(rol = "classroom_id", label = "Curso-Horario", hoja = "cursos_horario",
           requerida = TRUE, descripcion = "Identificador único del curso-horario"),
      list(rol = "session_type", label = "Tipo de curso", hoja = "Cursos-horario",
           requerida = TRUE, descripcion = "Desagregado, sin agrupar"),
      list(rol = "student_id", label = "Código de estudiante", hoja = "estudiantes",
           requerida = TRUE, descripcion = "Para deduplicar matrículas"),
      list(rol = "teacher_type", label = "Tipo de docente", hoja = "docentes",
           requerida = FALSE, descripcion = "Contratado / ordinario / pre-docente")
    ),
    notas = list("Entregar en Excel, una fila por registro")
  )
}

test_that("el workbook DTI trae las 4 hojas y agrupa por el campo hoja", {
  skip_if_not_installed("openxlsx")
  path <- tempfile("solicitud_dti_", fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)

  calc_muestra_solicitud_dti_workbook(.dti_payload(), path)
  expect_true(file.exists(path))
  expect_gt(file.info(path)$size, 0)

  hojas <- openxlsx::getSheetNames(path)
  expect_equal(hojas, c("Cursos-horario", "Estudiantes", "Docentes", "Criterios (bullets)"))

  # Estructura: header en fila 3, columnas Campo | Qué se espera | Requerida.
  ch <- openxlsx::read.xlsx(path, sheet = "Cursos-horario", startRow = 3)
  expect_equal(names(ch), c("Campo", "Qué.se.espera", "Requerida"))
  expect_setequal(ch$Campo, c("Curso-Horario", "Tipo de curso"))
  expect_true(all(ch$Requerida == "Sí"))

  est <- openxlsx::read.xlsx(path, sheet = "Estudiantes", startRow = 3)
  expect_equal(est$Campo, "Código de estudiante")

  doc <- openxlsx::read.xlsx(path, sheet = "Docentes", startRow = 3)
  expect_equal(doc$Campo, "Tipo de docente")
  expect_equal(doc$Requerida, "Opcional")
})

test_that("la hoja de criterios incluye SIEMPRE los bullets fijos + notas del payload", {
  skip_if_not_installed("openxlsx")
  path <- tempfile("solicitud_dti_", fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)

  calc_muestra_solicitud_dti_workbook(.dti_payload(), path)
  bullets <- openxlsx::read.xlsx(path, sheet = "Criterios (bullets)", startRow = 3)$Criterio

  fijos <- c(
    "Entregar el TIPO DE CURSO desagregado (teórico-teórico, teórico-práctico, teórico-laboratorio, taller, laboratorio, seminario) — NO agrupar",
    "Condición del curso (obligatorio/electivo/especialidad) por curso-horario",
    "Nivel curricular Y nivel por créditos como columnas separadas",
    "Código de estudiante (para deduplicar)"
  )
  # Los fijos van primero y en orden; la nota del payload va después.
  expect_equal(bullets[seq_along(fijos)], fijos)
  expect_true("Entregar en Excel, una fila por registro" %in% bullets)
  expect_length(bullets, length(fijos) + 1L)

  # Sin notas: solo los fijos.
  path2 <- tempfile("solicitud_dti_", fileext = ".xlsx")
  on.exit(unlink(path2), add = TRUE)
  calc_muestra_solicitud_dti_workbook(list(variables = .dti_payload()$variables), path2)
  bullets2 <- openxlsx::read.xlsx(path2, sheet = "Criterios (bullets)", startRow = 3)$Criterio
  expect_equal(bullets2, fijos)
})

test_that("hoja no reconocida cae a Cursos-horario y hojas vacías llevan nota", {
  skip_if_not_installed("openxlsx")
  path <- tempfile("solicitud_dti_", fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)

  calc_muestra_solicitud_dti_workbook(list(variables = list(
    list(label = "Campo suelto", hoja = "otra_cosa", requerida = TRUE, descripcion = "d"),
    # Sin label: cae al rol como nombre de campo.
    list(rol = "modality", hoja = "Docente titular", requerida = FALSE, descripcion = "")
  )), path)

  ch <- openxlsx::read.xlsx(path, sheet = "Cursos-horario", startRow = 3)
  expect_equal(ch$Campo, "Campo suelto")
  doc <- openxlsx::read.xlsx(path, sheet = "Docentes", startRow = 3)
  expect_equal(doc$Campo, "modality")
  # Estudiantes quedó sin campos: existe igual, con la nota explícita.
  est_raw <- openxlsx::read.xlsx(path, sheet = "Estudiantes", startRow = 3, colNames = FALSE)
  expect_true(any(grepl("Sin campos solicitados", unlist(est_raw))))
})

test_that("payload inválido produce error API limpio (E_CALC_MUESTRA_DTI_INPUT)", {
  path <- tempfile("solicitud_dti_", fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)

  esperado <- function(payload) {
    err <- tryCatch(
      calc_muestra_solicitud_dti_workbook(payload, path),
      api_error = function(e) e
    )
    expect_s3_class(err, "api_error")
    expect_equal(err$status, 400L)
    expect_equal(err$code, "E_CALC_MUESTRA_DTI_INPUT")
    expect_false(file.exists(path))
  }

  esperado(list())                                    # sin variables
  esperado(list(variables = list()))                  # lista vacía
  esperado(list(variables = "no-es-lista"))           # tipo inválido
  esperado(list(variables = list(list(hoja = "x"))))  # sin label ni rol
})
