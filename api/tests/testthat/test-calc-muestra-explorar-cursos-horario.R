# El universo de cursos-horario sale de la BASE CARGADA, no del marco.
#
# Antes solo existia despues de construir el marco, asi que una base recien
# subida no podia decir de cuantos cursos-horario habla y la cabecera seguia
# enseñando el universo del marco ANTERIOR.

test_that("cuenta cursos-horario unicos componiendo la identidad, no una columna", {
  # `HORARIO` a solas no identifica un aula: dos cursos distintos comparten el
  # horario 0201. Medido sobre la base real de 2026, contar esa columna daba 847
  # donde los cursos-horario son 5.269.
  datos <- data.frame(
    `Código PUCP` = c("a1", "a2", "a3", "a4"),
    Curso = c("DER101", "DER101", "MAT200", "MAT200"),
    Horario = c("0201", "0202", "0201", "0201"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  perfil <- calc_muestra_explorar_base(datos = datos, sheet = "Data")
  # DER101|0201, DER101|0202, MAT200|0201 -> tres, no dos (que son los horarios)
  expect_identical(perfil$cursos_horario, 3L)
  expect_identical(perfil$estudiantes, 4L)
})

test_that("un mismo curso-horario repetido en varias filas cuenta UNA vez", {
  # Es el caso real: la base repite el curso-horario una vez por alumno
  # matriculado, y el catalogo lo repite por docente y por carrera.
  datos <- data.frame(
    `Código PUCP` = c("a1", "a2", "a3"),
    Curso = c("DER101", "DER101", "DER101"),
    Horario = c("0201", "0201", "0201"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  perfil <- calc_muestra_explorar_base(datos = datos, sheet = "Data")
  expect_identical(perfil$cursos_horario, 1L)
  expect_identical(perfil$estudiantes, 3L)
})

test_that("sin columnas de identidad de aula NO inventa un universo", {
  # Devuelve NULL y no 0: «no se puede saber» y «no hay ninguno» son cosas
  # distintas, y un 0 en la cabecera se leeria como un dato.
  datos <- data.frame(
    `Código PUCP` = c("a1", "a2"),
    Sexo = c("F", "M"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  perfil <- calc_muestra_explorar_base(datos = datos, sheet = "Data")
  expect_null(perfil$cursos_horario)
})
