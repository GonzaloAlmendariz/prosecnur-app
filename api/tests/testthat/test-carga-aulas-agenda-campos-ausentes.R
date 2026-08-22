# La hoja de «Base de control» ya reportaba sus columnas sin nombre. La de agenda
# no reportaba nada: si el equipo renombra una columna en el Sheets, el campo se
# lee vacio y nadie se entera.
#
# Medido antes de escribir esto: la hoja que genera la app trae los 20 campos del
# bloque, asi que una ausencia es senal de verdad y no ruido de un libro a medias.

.titulos_de_agenda <- function() {
  hoja <- aulas_libro_hoja_agendadas(list(list(
    operational_code = "CH 1", sample_role = "titular",
    titular_operational_code = "CH 1", teacher = "D1", teacher_phone = "999",
    course_name = "C1", faculty = "SOC", eligible_n = 40,
    scheduled_date = "2026-08-11"
  )))
  as.character(unlist(hoja[1, ]))
}

test_that("la hoja que genera la app no tiene ningun campo ausente", {
  # Si esto falla, el generador y el lector dejaron de hablar el mismo idioma, y
  # entonces el aviso de abajo se volveria ruido permanente.
  expect_identical(aulas_agendadas_campos_ausentes(.titulos_de_agenda()), character(0))
})

test_that("una columna renombrada se declara, no se lee vacia en silencio", {
  titulos <- .titulos_de_agenda()
  clave <- prosecnurapp:::.caa_key("TELEFONO DE DOCENTE")
  titulos[prosecnurapp:::.caa_key(titulos) == clave] <- "CELULAR"

  expect_identical(aulas_agendadas_campos_ausentes(titulos), "teacher_phone")
})

test_that("el plan lleva los campos ausentes como atributo", {
  titulos <- .titulos_de_agenda()
  clave <- prosecnurapp:::.caa_key("NOMBRE DE DOCENTE")
  titulos[prosecnurapp:::.caa_key(titulos) == clave] <- "PROFE"
  cuerpo <- as.data.frame(
    matrix(c("1", "Muestra 01", "CH 7", rep("", length(titulos) - 3L)), nrow = 1L),
    stringsAsFactors = FALSE
  )

  plan <- aulas_agendadas_a_plan(cuerpo, titulos)
  expect_identical(attr(plan, "campos_ausentes"), "teacher")
  # Y el plan sigue siendo la misma lista de filas: el atributo no cambia la
  # forma del retorno para quien ya lo consumia.
  expect_length(plan, 1L)
})

test_that("sin titulos reconocibles no inventa ausencias", {
  # Con nombres genericos no hay bloques que mapear; declarar los 20 campos como
  # ausentes seria un aviso falso en cada libro raro.
  expect_identical(aulas_agendadas_campos_ausentes(c("V1", "V2")), character(0))
  expect_identical(aulas_agendadas_campos_ausentes(NULL), character(0))
})
