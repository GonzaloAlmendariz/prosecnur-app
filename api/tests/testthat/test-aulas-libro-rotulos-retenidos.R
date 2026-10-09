# **Una hoja del equipo `respetada` puede estar a la que le falta una columna.**
#
# Respetar la hoja es correcto y no se discute: hay gente tecleando ahí. Lo que
# no puede pasar es que el recibo lo calle. Medido el 2026-09-18 sobre CCSS
# Perfil 2026-II, con el campo a cuatro días: el libro del motor ganó CARRERA y
# «Aulas Agendadas» pasó de 76 a 79 columnas —el bloque se repite en titular, R1
# y R2—. Es hoja del equipo: republicar devuelve «respetada» y la columna con la
# que se distingue una carrera de otra no llega nunca, sin una sola señal.

test_that("los rótulos retenidos son los que el motor produce y la hoja no tiene", {
  producidas <- list(
    list("ID MATCH", "CURSO-HORARIO", "FACULTAD", "CARRERA", "STATUS DE LLAMADA"),
    list("CH 1", "Antropología I", "CIENCIAS SOCIALES", "ANTROPOLOGÍA", "")
  )
  # La hoja viva del equipo: la de ayer, sin CARRERA, y con lo que escribieron.
  remotas <- list(
    list("ID MATCH", "CURSO-HORARIO", "FACULTAD", "STATUS DE LLAMADA"),
    list("CH 1", "Antropología I", "CIENCIAS SOCIALES", "Contactado")
  )
  expect_identical(
    monitoreo_aulas_libro_rotulos_retenidos(producidas, remotas, 1L),
    "CARRERA"
  )
})

test_that("con la hoja al día no retiene nada, que es el caso normal", {
  filas <- list(list("ID MATCH", "CURSO-HORARIO", "CARRERA"), list("CH 1", "x", "ANTROPOLOGÍA"))
  # Las dos fuentes NO son el mismo objeto: si lo fueran, el test no distinguiría
  # de cuál lee la función.
  remotas <- list(list("ID MATCH", "CURSO-HORARIO", "CARRERA"), list("CH 9", "otra", "SOCIOLOGÍA"))
  expect_identical(monitoreo_aulas_libro_rotulos_retenidos(filas, remotas, 1L), character(0))
})

test_that("el recorte de vacíos del final de la API no fabrica una alarma", {
  # La API devuelve las filas sin sus celdas vacías finales, así que el ancho
  # remoto es MENOR sin que falte ningún rótulo. Comparar anchos daría un falso
  # positivo justo aquí; comparar nombres, no.
  producidas <- list(list("ID MATCH", "CURSO-HORARIO", "", "", ""))
  remotas <- list(list("ID MATCH", "CURSO-HORARIO"))
  expect_identical(monitoreo_aulas_libro_rotulos_retenidos(producidas, remotas, 1L), character(0))
})

test_that("un rótulo retecleado con otras tildes o mayúsculas sigue siendo el mismo", {
  producidas <- list(list("TELÉFONO DE DOCENTE", "SESIONES Y AULA"))
  remotas <- list(list("telefono de docente", "Sesiones y Aula"))
  expect_identical(monitoreo_aulas_libro_rotulos_retenidos(producidas, remotas, 1L), character(0))
})

test_that("mira las DOS filas de cabecera donde la hoja las tiene", {
  # «Aulas Aplicadas (Campo)» corona con dos: la de bloques (TITULAR, REEMPLAZO 1)
  # y la de columnas. Mirar sólo la primera dejaría fuera todos los rótulos de
  # datos, que es donde vive CARRERA.
  producidas <- list(list("TITULAR", "", ""), list("ID MATCH", "FACULTAD", "CARRERA"))
  remotas <- list(list("TITULAR", ""), list("ID MATCH", "FACULTAD"))
  expect_identical(monitoreo_aulas_libro_rotulos_retenidos(producidas, remotas, 2L), "CARRERA")
  # Y con una sola fila mirada, CARRERA no se ve: es lo que prueba que el
  # parámetro hace algo.
  expect_identical(monitoreo_aulas_libro_rotulos_retenidos(producidas, remotas, 1L), character(0))
})

test_that("sin nada producido no se afirma nada", {
  expect_identical(monitoreo_aulas_libro_rotulos_retenidos(list(), list(list("X")), 1L), character(0))
  expect_identical(monitoreo_aulas_libro_rotulos_retenidos(NULL, NULL, 1L), character(0))
})
