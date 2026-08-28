# El día, la hora y el aula que el catálogo ya decía.
#
# Estas pruebas existen porque las tres casillas de la ficha de campo —«Pabellón
# y aula», «Horario del curso»— salían en blanco sobre un marco que SÍ traía el
# dato, dentro de la columna `SESIONES` del catálogo de cursos-horarios.
#
# La gramática está medida, no supuesta: sobre el libro de HSVG2026, las 30.207
# sesiones sueltas casan `DIA HH:MM-HH:MM  <tipo>  [aula]`.

test_that("una sesión se parte en horario y aula", {
  p <- calc_muestra_aulas_sesiones_partes("MIE 17:00-20:00 C  A506")
  expect_equal(p$horario, "MIE 17:00-20:00")
  expect_equal(p$aula, "A506")
})

test_that("la letra de tipo de sesión NO es el aula", {
  # Regresión: la primera versión resolvía esto con una sola expresión regular y
  # devolvía «C  A506». Imprimir «C» bajo el rótulo «Pabellón y aula» es peor que
  # dejar la raya en blanco, porque parece un dato.
  p <- calc_muestra_aulas_sesiones_partes("MIE 07:00-09:00 H  LFIA")
  expect_equal(p$aula, "LFIA")
  expect_false(grepl("^[A-Z] ", p$aula))
})

test_that("un curso sin aula asignada devuelve aula vacía, no el tipo", {
  p <- calc_muestra_aulas_sesiones_partes("MAR 10:00-12:00 C")
  expect_equal(p$horario, "MAR 10:00-12:00")
  expect_equal(p$aula, "")
})

test_that("el 0000 del catálogo es un hueco, no un aula", {
  # Es el placeholder con forma de dato: llega a la ficha impresa como si fuera
  # un aula real y manda al aplicador a un sitio que no existe.
  expect_equal(calc_muestra_aulas_sesiones_partes("LUN 16:00-19:00 C  0000")$aula, "")
})

test_that("varias sesiones se unen sin repetir y en orden", {
  p <- calc_muestra_aulas_sesiones_partes(
    "LUN 16:00-18:00 C  L101<br />MIE 16:00-18:00 C  L220"
  )
  expect_equal(p$horario, "LUN 16:00-18:00 · MIE 16:00-18:00")
  expect_equal(p$aula, "L101 · L220")

  repetida <- calc_muestra_aulas_sesiones_partes(
    "MIE 10:00-12:00 C  L401<br />VIE 10:00-12:00 C  L401"
  )
  expect_equal(repetida$aula, "L401")
})

test_that("lo que no casa la gramática pasa entero como horario y no inventa aula", {
  p <- calc_muestra_aulas_sesiones_partes("A CONVENIR CON EL DOCENTE")
  expect_equal(p$horario, "A CONVENIR CON EL DOCENTE")
  expect_equal(p$aula, "")
})

test_that("vacío y NA no producen dato", {
  for (x in list("", NA, NA_character_, NULL)) {
    p <- calc_muestra_aulas_sesiones_partes(x)
    expect_equal(p$horario, "")
    expect_equal(p$aula, "")
  }
})

test_that("la versión vectorial respeta el largo y el orden", {
  v <- c("MIE 17:00-20:00 C  A506", "", "MAR 10:00-12:00 C")
  expect_equal(calc_muestra_aulas_sesiones_columna(v, "aula"), c("A506", "", ""))
  expect_equal(
    calc_muestra_aulas_sesiones_columna(v, "horario"),
    c("MIE 17:00-20:00", "", "MAR 10:00-12:00")
  )
  expect_equal(calc_muestra_aulas_sesiones_columna(character(0), "aula"), character(0))
})

test_that("las columnas nuevas no las captura el alias de otro rol", {
  # Regresión con síntoma medido: la primera versión las llamó `pabellon_aula` y
  # `horario_sesiones`. `mapping$classroom_label` lleva el alias `aula` y
  # `.cm_aulas_col()` acepta que el nombre de la columna esté CONTENIDO en el
  # candidato, así que `pabellon_aula` fue capturada como etiqueta del aula: las
  # 1.512 fichas pasaron a titularse «A501» y a llamarse `CH 1 - A501.pdf`.
  alias_label <- c("classroom_label", "sesiones_y_aula", "sesiones y aula",
                   "aula", "salon", "ambiente", "local_aula")
  con_nuevas <- data.frame(
    venue = "A501", sesiones_dia_hora = "LUN 10:00-13:00", HORARIO = "0591",
    stringsAsFactors = FALSE
  )
  expect_identical(.cm_aulas_col(con_nuevas, alias_label), "")
  expect_identical(.cm_aulas_col(con_nuevas, c("schedule", "horario")), "HORARIO")
  expect_identical(
    .cm_aulas_col(con_nuevas, c("session_type", "tipo_sesion", "tipo_de_curso")), ""
  )

  # Y la prueba de que el peligro era real, no teórico.
  con_viejas <- data.frame(pabellon_aula = "A501", stringsAsFactors = FALSE)
  expect_identical(.cm_aulas_col(con_viejas, alias_label), "pabellon_aula")
})

test_that("el enriquecido escribe venue y sesiones_dia_hora en la base", {
  raw <- data.frame(
    classroom_id = c("MAT202_0591", "TEL138_0791"),
    stringsAsFactors = FALSE
  )
  catalogo <- data.frame(
    classroom_id = c("MAT202_0591", "TEL138_0791"),
    SESIONES = c("MIE 17:00-20:00 C  A506", "MAR 10:00-12:00 C"),
    stringsAsFactors = FALSE
  )
  key <- c("MAT202_0591", "TEL138_0791")
  out <- calc_muestra_aulas_anotar_sesiones(
    raw, catalogo, key, key, list(classroom_label = "SESIONES")
  )
  expect_equal(out$venue, c("A506", ""))
  expect_equal(out$sesiones_dia_hora, c("MIE 17:00-20:00", "MAR 10:00-12:00"))
})

test_that("el enriquecido no pisa un aula que la base ya traía", {
  # Mismo contrato que el resto de `.cm_aulas_fill_from_lookup()`: rellenar donde
  # falta, nunca sobrescribir lo que el usuario declaró.
  raw <- data.frame(
    classroom_id = "MAT202_0591",
    venue = "AULA REAL",
    stringsAsFactors = FALSE
  )
  catalogo <- data.frame(
    classroom_id = "MAT202_0591",
    SESIONES = "MIE 17:00-20:00 C  A506",
    stringsAsFactors = FALSE
  )
  out <- calc_muestra_aulas_anotar_sesiones(
    raw, catalogo, "MAT202_0591", "MAT202_0591", list(classroom_label = "SESIONES")
  )
  expect_equal(out$venue, "AULA REAL")
})

test_that("sin columna de sesiones la base sale intacta", {
  raw <- data.frame(classroom_id = "X", stringsAsFactors = FALSE)
  catalogo <- data.frame(classroom_id = "X", OTRA = "cosa", stringsAsFactors = FALSE)
  out <- calc_muestra_aulas_anotar_sesiones(
    raw, catalogo, "X", "X", list(classroom_label = "no_existe")
  )
  expect_identical(out, raw)
})
