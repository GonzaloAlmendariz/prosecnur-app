# El mensaje de cobertura de facultades habla con quien lee la pantalla.
#
# Medido en el recorrido de un usuario nuevo: tras declarar criterios, una
# facultad se quedo sin cursos-horario elegibles y el aviso decia «El estudio
# declara consorcio_de_universidades y el marco vigente no tiene ningun
# curso-horario elegible ahi». `consorcio_de_universidades` es la clave interna
# con la que el motor indexa la facultad, no su nombre: en pantalla se lee como
# un identificador de base de datos.

test_that("las claves de facultad se leen como nombres, no como identificadores", {
  msg <- .cm_alumnos_ch_mensaje_cobertura(
    faltantes = character(0),
    sobrantes = c("consorcio_de_universidades")
  )

  expect_true(grepl("Consorcio de universidades", msg, fixed = TRUE))
  expect_false(grepl("consorcio_de_universidades", msg, fixed = TRUE))
})

test_that("un nombre que ya viene legible no se altera", {
  msg <- .cm_alumnos_ch_mensaje_cobertura(
    faltantes = c("CIENCIAS E INGENIERIA"),
    sobrantes = character(0)
  )

  expect_true(grepl("CIENCIAS E INGENIERIA", msg, fixed = TRUE))
})

test_that("varias claves se separan y se leen todas", {
  msg <- .cm_alumnos_ch_mensaje_cobertura(
    faltantes = character(0),
    sobrantes = c("escuela_de_posgrado", "artes_escenicas")
  )

  expect_true(grepl("Escuela de posgrado", msg, fixed = TRUE))
  expect_true(grepl("Artes escenicas", msg, fixed = TRUE))
})

test_that("la rama sobrante dice la salida, igual que la faltante", {
  # Medido en el recorrido del usuario nuevo: al declarar criterios, una
  # facultad se quedo sin cursos-horario elegibles y el calculo se bloqueo. El
  # mensaje explicaba el hecho —«no puede recibir cuota»— y ahi terminaba,
  # mientras la rama de facultad FALTANTE si ofrece sus dos salidas. Quedarse
  # sin salida es peor que el error.
  sobra <- .cm_alumnos_ch_mensaje_cobertura(character(0), "consorcio_de_universidades")

  expect_true(grepl("no puede recibir cuota", sobra, fixed = TRUE))
  # La salida que SI se verifico: recuperar aulas para esa facultad. Se probo
  # mandar a «Facultades excluidas» y no desbloquea —la facultad sigue
  # declarada en los estratos del componente—, asi que el mensaje no la ofrece.
  expect_true(grepl("qué criterio dejó sus aulas fuera", sobra, fixed = TRUE))
  expect_false(grepl("Facultades excluidas", sobra, fixed = TRUE))
})
