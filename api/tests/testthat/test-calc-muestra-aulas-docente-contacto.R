# A quién se llama para agendar un aula con varios docentes.
#
# Regla del operativo (Gonzalo, 2026-08-25): «un CH puede tener más de un
# docente, pero basta con que tenga un docente que no sea jefe de práctica para
# que sea válido, y nos vamos a comunicar con ese docente, no con el JP».
#
# El aula elegía su contacto con `.cm_aulas_mode()`, que se queda con el valor
# más frecuente. Como el catálogo repite cada curso-horario una vez por
# especialidad, ganaba quien apareciera en más filas. Medido sobre el estudio de
# 193 titulares: de 180 unidades con docente ordinario Y jefe de práctica, el
# contacto era el jefe de práctica en 88 — entre ellas 6 titulares.

test_that("con dos docentes, el contacto es el que dicta el curso", {
  expect_equal(
    calc_muestra_aulas_docente_contacto(
      c("Jefa de práctica", "Docente titular"),
      c("PRE-DOCENTE - JEFE DE PRÁCTICA", "DOCENTE ORDINARIO - PRINCIPAL")
    ),
    "Docente titular"
  )
})

test_that("gana el docente aunque el jefe de práctica salga en más filas", {
  # Es el caso real: el catálogo repite una fila por especialidad, así que la
  # frecuencia no dice quién dicta el curso.
  expect_equal(
    calc_muestra_aulas_docente_contacto(
      c("Jefa de práctica", "Jefa de práctica", "Jefa de práctica", "Docente titular"),
      c(rep("PRE-DOCENTE - JEFE DE PRÁCTICA", 3), "DOCENTE CONTRATADO - CONTRATADO")
    ),
    "Docente titular"
  )
})

test_that("el correo sale de la misma persona que el nombre", {
  nombres <- c("Jefa de práctica", "Docente titular")
  correos <- c("jp@pucp.edu.pe", "titular@pucp.edu.pe")
  tipos <- c("PRE-DOCENTE - JEFE DE PRÁCTICA", "DOCENTE ORDINARIO - ASOCIADO")
  expect_equal(calc_muestra_aulas_docente_contacto(nombres, tipos), "Docente titular")
  expect_equal(calc_muestra_aulas_docente_contacto(correos, tipos), "titular@pucp.edu.pe")
})

test_that("si TODOS son jefe de práctica, el aula igual muestra un contacto", {
  # Son las 46 del estudio cuyo único docente es jefe de práctica. No entran al
  # marco por el criterio de tipo de docente, pero quien las mire debe ver un
  # nombre y no un hueco.
  expect_equal(
    calc_muestra_aulas_docente_contacto(
      c("Jefa A", "Jefa A", "Jefe B"),
      rep("PRE-DOCENTE - JEFE DE PRÁCTICA", 3)
    ),
    "Jefa A"
  )
})

test_that("un tipo vacío cuenta como docente a cargo", {
  # No se puede afirmar que alguien NO es el docente porque falte el dato, y
  # descartarlo dejaría el aula sin contacto.
  expect_true(calc_muestra_aulas_es_docente_a_cargo(""))
  expect_equal(
    calc_muestra_aulas_docente_contacto(c("Sin tipo", "Jefa"), c("", "PRE-DOCENTE - JEFE DE PRÁCTICA")),
    "Sin tipo"
  )
})

test_that("el instructor tampoco es el docente a cargo", {
  expect_false(calc_muestra_aulas_es_docente_a_cargo("PRE-DOCENTE - INSTRUCTOR"))
  expect_true(calc_muestra_aulas_es_docente_a_cargo("DOCENTE EXTRAORDINARIO - VISITANTE"))
})

test_that("entre varios docentes a cargo manda el más frecuente, y desempata el orden", {
  # Es el comportamiento anterior y no hay razón para cambiarlo: dos corridas
  # sobre el mismo catálogo tienen que dar el mismo contacto.
  expect_equal(
    calc_muestra_aulas_docente_contacto(
      c("Docente B", "Docente A", "Docente A"),
      rep("DOCENTE ORDINARIO - PRINCIPAL", 3)
    ),
    "Docente A"
  )
  expect_equal(
    calc_muestra_aulas_docente_contacto(c("Docente B", "Docente A"), rep("DOCENTE CONTRATADO", 2)),
    "Docente B"
  )
})

test_that("sin datos devuelve el default y no falla", {
  expect_equal(calc_muestra_aulas_docente_contacto(character(0), character(0)), "")
  expect_equal(calc_muestra_aulas_docente_contacto(NULL, NULL, "—"), "—")
  expect_equal(calc_muestra_aulas_docente_contacto(c("", ""), c("A", "B")), "")
})
