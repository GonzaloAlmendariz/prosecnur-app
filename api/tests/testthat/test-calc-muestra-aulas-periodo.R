# De qué semestre es el marco.
#
# El caso real que lo motiva: `HSVG2026.pulso` tenía cargada la base de 2025
# —`2025.00507905 BD estudiantes y curso-horario`— y calculaba sin protestar.
# Contra la base correcta (2026-2), ARTE Y DISEÑO pasa de 63 cursos-horario
# elegibles a 228, y la ESCUELA DE POSGRADO de 2 a 0. Nada en pantalla decía de
# qué semestre eran los datos.

test_that("reconoce el periodo en la cabecera del DTI y en el nombre del archivo", {
  # La cabecera real de la hoja «Data» de la base de cursos-horario.
  expect_equal(calc_muestra_aulas_periodo_de_texto("Reporte de Cursos Horarios 2026-2"), "2026-2")
  expect_equal(calc_muestra_aulas_periodo_de_texto("207915-Cursos-Horarios 2026-2.xlsx"), "2026-2")
  expect_equal(calc_muestra_aulas_periodo_de_texto("Reporte 2026-II"), "2026-2")
  expect_equal(calc_muestra_aulas_periodo_de_texto("Cursos 2026 1"), "2026-1")
})

test_that("un identificador con punto NO se lee como ciclo", {
  # `2025.00507905` es el número de pedido al DTI. Leerlo como «2025-0» daría un
  # ciclo que no existe, y un periodo inventado es peor que ninguno: quien vea
  # «2025-0» en la ficha deja de creerse el campo.
  expect_equal(calc_muestra_aulas_periodo_de_texto("2025.00507905 BD estudiantes y curso-horario"), "2025")
})

test_that("lo que no se reconoce devuelve vacío, no un año inventado", {
  expect_equal(calc_muestra_aulas_periodo_de_texto("sin fecha alguna"), "")
  expect_equal(calc_muestra_aulas_periodo_de_texto(""), "")
  expect_equal(calc_muestra_aulas_periodo_de_texto(NULL), "")
})

test_that("la base de cursos-horario manda sobre las demás", {
  # Es la que define el catálogo del marco. Con dos bases de periodos distintos
  # cargadas, el periodo del marco es el de los cursos-horario.
  fr <- calc_muestra_aulas_declarar_periodo(list(frame_hash = "x"), list(
    list(original_name = "Instrumento2026.xlsx"),
    list(original_name = "207915-Alumnos matriculados 2026-2.xlsx"),
    list(original_name = "207915-Cursos-Horarios 2026-2.xlsx")
  ))
  expect_equal(fr$periodo, "2026-2")
  # Y deja dicho de dónde salió: un periodo sin procedencia no se puede discutir.
  expect_true(grepl("Cursos-Horarios", fr$periodo_origen))
})

test_that("el caso real: la base de 2025 en un proyecto de 2026", {
  fr <- calc_muestra_aulas_declarar_periodo(list(frame_hash = "x"), list(
    list(original_name = "2025.00507905 BD estudiantes y curso-horario"),
    list(original_name = "HSVBG2025_referencia_para_motor.xlsx"),
    list(original_name = "Instrumento2026.xlsx")
  ))
  expect_equal(fr$periodo, "2025")
  expect_false(calc_muestra_aulas_periodo_cuadra(fr$periodo, "HSVG2026"))
})

test_that("sin archivos o sin periodo detectable, el marco se queda como estaba", {
  # Hacer visible un dato que faltaba, no añadir una puerta nueva por la que un
  # estudio pueda quedarse fuera.
  base <- list(frame_hash = "x", aula_frame = "algo")
  expect_identical(calc_muestra_aulas_declarar_periodo(base, list()), base)
  sin <- calc_muestra_aulas_declarar_periodo(base, list(list(original_name = "base.xlsx")))
  expect_null(sin$periodo)
  expect_identical(sin$aula_frame, "algo")
})

test_that("no se afirma que cuadra lo que no se pudo comparar", {
  expect_true(is.na(calc_muestra_aulas_periodo_cuadra("", "HSVG2026")))
  expect_true(is.na(calc_muestra_aulas_periodo_cuadra("2026-2", "estudio sin año")))
  # El ciclo no invalida: puede no estar en el nombre del estudio y saltar por
  # eso convertiría el aviso en ruido.
  expect_true(calc_muestra_aulas_periodo_cuadra("2026-1", "HSVG2026"))
})
