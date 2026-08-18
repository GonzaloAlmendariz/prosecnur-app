# El cuadre entre el parte de campo y la Base de control.
#
# Medido antes de escribirlo: de los campos que las dos hojas podrian compartir,
# solo tres estan llenos en las dos a la vez —asistentes, % de asistencia y
# aplicador—. `applied_date` esta vacio en las DOS, `application_status` solo en
# el control y `effective_surveys` solo en el parte: cruzar cualquiera de esos
# habria dado 170 hallazgos que no son discrepancias sino ausencias.

.mach_parte <- function(code, asist = 25, asistencia = 0.694, aplicador = "Equipo 2") {
  list(operational_code = code, observed_students = asist,
       attendance_pct = asistencia, applied_by = aplicador)
}
.mach_control <- function(code, asist = 25, asistencia = 0.694, aplicador = "Equipo 2") {
  list(operational_code = code, observed_students = asist,
       attendance_pct = asistencia, applied_by = aplicador)
}

test_that("dos hojas que dicen lo mismo no producen ningun hallazgo", {
  r <- monitoreo_aulas_cruce_hojas(
    list(.mach_parte("CH 1"), .mach_parte("CH 2", asist = 30, asistencia = 0.8)),
    list(.mach_control("CH 1"), .mach_control("CH 2", asist = 30, asistencia = 0.8))
  )
  expect_identical(r$comparables, 2L)
  expect_length(r$hallazgos, 0L)
})

test_that("comparables cuenta las aulas que estan en las dos, no las de una", {
  # El control que distingue «cuadran» de «no se comprobo». Sin el, un cruce que
  # no encontrara NUNCA a su pareja daria cero hallazgos y se leeria como que
  # las dos hojas coinciden. La frase de la vista depende de esta cifra.
  r <- monitoreo_aulas_cruce_hojas(
    list(.mach_parte("CH 1"), .mach_parte("CH 9")),
    list(.mach_control("CH 1"))
  )
  expect_identical(r$comparables, 1L)
  expect_length(r$hallazgos, 0L)

  sin_pareja <- monitoreo_aulas_cruce_hojas(list(.mach_parte("CH 1")), list(.mach_control("CH 9")))
  expect_identical(sin_pareja$comparables, 0L)
})

test_that("cada campo discrepante produce su propio hallazgo", {
  r <- monitoreo_aulas_cruce_hojas(
    list(.mach_parte("CH 164", asist = 25, asistencia = 0.216, aplicador = "Equipo 2")),
    list(.mach_control("CH 164", asist = 22, asistencia = 0.432, aplicador = "Equipo 5"))
  )
  expect_identical(r$comparables, 1L)
  # Tres campos discrepan: tres hallazgos y no uno por aula. Agrupar por aula
  # obligaria a abrir el libro para saber QUE no cuadra.
  expect_length(r$hallazgos, 3L)
  expect_identical(
    sort(vapply(r$hallazgos, function(h) h$campo, character(1))),
    c("applied_by", "attendance_pct", "observed_students")
  )
})

test_that("un campo vacio en una de las dos hojas no es una discrepancia", {
  # Es el caso dominante: 56 de las 170 filas de control llegan sin llenar a
  # mitad de operativo. Contarlas como discrepancia convertiria una hoja a medio
  # llenar en 56 falsos hallazgos por campo.
  r <- monitoreo_aulas_cruce_hojas(
    list(.mach_parte("CH 1")),
    list(list(operational_code = "CH 1", observed_students = NA,
              attendance_pct = NULL, applied_by = ""))
  )
  expect_identical(r$comparables, 1L)
  expect_length(r$hallazgos, 0L)
})

test_that("el redondeo del equipo no se marca como discrepancia y una diferencia real si", {
  # El `% ASISTENCIA` se escribe redondeado a tres decimales. Comparar con `==`
  # marcaria un redondeo como hallazgo; una tolerancia demasiado ancha se
  # tragaria una diferencia de verdad. Los dos casos van juntos porque el
  # segundo es lo que impide que la tolerancia crezca sin que nadie lo note.
  redondeo <- monitoreo_aulas_cruce_hojas(
    list(.mach_parte("CH 1", asistencia = 0.694)),
    list(.mach_control("CH 1", asistencia = 0.6941))
  )
  expect_length(redondeo$hallazgos, 0L)

  real <- monitoreo_aulas_cruce_hojas(
    list(.mach_parte("CH 1", asistencia = 0.694)),
    list(.mach_control("CH 1", asistencia = 0.72))
  )
  expect_length(real$hallazgos, 1L)
})

test_that("el aplicador se compara sin castigar mayusculas ni espacios de mas", {
  igual <- monitoreo_aulas_cruce_hojas(
    list(.mach_parte("CH 1", aplicador = "Equipo  2")),
    list(.mach_control("CH 1", aplicador = "EQUIPO 2"))
  )
  expect_length(igual$hallazgos, 0L)

  # El control: normalizar no puede llegar a borrar la diferencia que importa.
  distinto <- monitoreo_aulas_cruce_hojas(
    list(.mach_parte("CH 1", aplicador = "Equipo 2")),
    list(.mach_control("CH 1", aplicador = "Equipo 5"))
  )
  expect_length(distinto$hallazgos, 1L)
})

test_that("la frase nombra el aula, el campo y los dos valores", {
  r <- monitoreo_aulas_cruce_hojas(
    list(.mach_parte("CH 164", asistencia = 0.216)),
    list(.mach_control("CH 164", asistencia = 0.432))
  )
  texto <- monitoreo_aulas_cruce_texto(r$hallazgos[[1]])
  expect_match(texto, "CH 164")
  expect_match(texto, "el % de asistencia")
  # En porcentaje, no en proporcion: la tabla de al lado ya lo dice asi, y dos
  # superficies del mismo hecho no pueden usar unidades distintas. La frase
  # decia «0.765» mientras la tabla decia «76.5 %».
  expect_match(texto, "21.6 %", fixed = TRUE)
  expect_match(texto, "43.2 %", fixed = TRUE)
  # Sin jerga de columna: el equipo no lee `attendance_pct`.
  expect_false(grepl("attendance_pct", texto, fixed = TRUE))
})

test_that("una asistencia que ya viene en 0-100 no se multiplica en la frase", {
  # El control de la regla anterior. Sin este caso, «detectar la escala» y
  # «multiplicar siempre por 100» pasarian el mismo test, y una hoja escrita en
  # 0-100 saldria con «7650 %».
  r <- monitoreo_aulas_cruce_hojas(
    list(.mach_parte("CH 1", asistencia = 76.5)),
    list(.mach_control("CH 1", asistencia = 70.6))
  )
  texto <- monitoreo_aulas_cruce_texto(r$hallazgos[[1]])
  expect_match(texto, "76.5 %", fixed = TRUE)
  expect_match(texto, "70.6 %", fixed = TRUE)
})

test_that("una asistencia por encima del 100 % no se hunde al 1 %", {
  # Hay aulas con mas presentes que elegibles —oyentes, otra seccion—, asi que
  # 1.08 es un 108 % y no un 1.1 %. El corte de escala va en 1.5 por esto.
  r <- monitoreo_aulas_cruce_hojas(
    list(.mach_parte("CH 1", asistencia = 1.08)),
    list(.mach_control("CH 1", asistencia = 0.9))
  )
  expect_match(monitoreo_aulas_cruce_texto(r$hallazgos[[1]]), "108 %", fixed = TRUE)
})

test_that("el control llega al tablero como decimo control de Validacion", {
  plan <- monitoreo_aulas_normalize_plan(list(
    list(operational_code = "CH 1", classroom_id = "CH 1", label = "Aula 1",
         course_name = "Curso 1", faculty = "Derecho", sample_role = "titular",
         eligible_n = 30, expected_valid = 21, sample_status = "agendada")
  ))
  d <- monitoreo_aulas_dashboard(plan, data.frame(), list(
    enabled = TRUE, plan = plan,
    partes_campo = list(.mach_parte("CH 1", asist = 25, asistencia = 0.833)),
    control = list(.mach_control("CH 1", asist = 25, asistencia = 0.5))
  ))
  fila <- Filter(function(r) identical(as.character(r$check), "book_sheets_cross_check"), d$validation)
  expect_length(fila, 1L)
  expect_identical(as.character(fila[[1]]$status), "review")
  expect_match(as.character(fila[[1]]$detail), "CH 1")
})
