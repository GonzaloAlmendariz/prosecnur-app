# Subcadena DIRECTA del tercer nivel de `.cm_aulas_col()`: el candidato
# contenido en el nombre de una columna que es de OTRO rol.
#
# Medido el 2026-09-24 con la base de UNSA (plana, sin `condicion` del
# estudiante y con `condicion_curso`): sin mapeo manual, el rol `condition`
# resolvía a `condicion_curso` —el candidato «condicion» está contenido en esa
# clave—, el filtro de condición regular leía OBLIGATORIO/ELECTIVO y las
# 142.375 filas quedaban excluidas con motivo `condition`: `population_n = 0`.
#
# Mismo mecanismo con el docente: con `n_docentes`, `cod_docente` y
# `nombre_docente`, `teacher` tomaba `n_docentes` (la primera que contiene
# «docente»): un conteo publicado como nombre de docente.

.subdir_base <- function(extra = list()) {
  base <- data.frame(
    codigo_alumno = sprintf("A%02d", 1:6),
    facultad = "CIENCIAS",
    sexo = rep(c("F", "M"), 3),
    codigo_curso = rep(c("C1", "C2", "C3"), 2),
    nombre_curso = rep(c("Mecanica", "Termo", "Optica"), 2),
    curso_horario = rep(c("C1-H1", "C2-H1", "C3-H1"), 2),
    condicion_curso = rep(c("OBLIGATORIO", "ELECTIVO"), 3),
    stringsAsFactors = FALSE
  )
  for (nm in names(extra)) base[[nm]] <- extra[[nm]]
  base
}

test_that("condition no toma una columna que es de condicion_curso", {
  raw <- .subdir_base()
  mp <- prosecnurapp:::.cm_aulas_config_mapping(list())

  expect_identical(prosecnurapp:::.cm_aulas_col(raw, mp$condition), "")
  # condicion_curso sigue resolviendo su propia columna.
  expect_identical(prosecnurapp:::.cm_aulas_col(raw, mp$condicion_curso), "condicion_curso")

  # Con la condición del estudiante presente, cada rol a su columna.
  raw$condicion <- "REGULAR"
  expect_identical(prosecnurapp:::.cm_aulas_col(raw, mp$condition), "condicion")
})

test_that("sin condición del estudiante la población no queda en cero", {
  r <- calc_muestra_aulas_construir(
    base_madre = .subdir_base(),
    config = list(filters = list(min_eligible_per_class = 1L))
  )
  expect_false(identical(r$mapeo_resuelto$base$condition, "condicion_curso"))
  population_n <- suppressWarnings(as.numeric(r$audit$value[r$audit$metric == "population_n"]))
  expect_gt(population_n, 0)
})

test_that("teacher no toma un conteo de docentes", {
  mp <- prosecnurapp:::.cm_aulas_config_mapping(list())

  raw <- .subdir_base(list(
    n_docentes = 1, cod_docente = "D1",
    nombre_docente = rep(c("Ana", "Beto", "Cira"), 2)
  ))
  expect_identical(prosecnurapp:::.cm_aulas_col(raw, mp$teacher), "nombre_docente")

  # Sin columna de nombre, el conteo sigue sin prestarse al rol.
  raw <- .subdir_base(list(n_docentes = 1, cod_docente = "D1"))
  expect_false(identical(prosecnurapp:::.cm_aulas_col(raw, mp$teacher), "n_docentes"))
})

test_that("la guarda del conteo no le quita su columna a enrolled_total", {
  mp <- prosecnurapp:::.cm_aulas_config_mapping(list())
  raw <- .subdir_base(list(n_matriculados = 40))
  expect_identical(prosecnurapp:::.cm_aulas_col(raw, mp$enrolled_total), "n_matriculados")
})

test_that("nro_/numero_ son identificadores, no conteos: siguen resolviendo", {
  mp <- prosecnurapp:::.cm_aulas_config_mapping(list())
  raw <- .subdir_base(list(nro_seccion = "01", nro_aula = "A501"))
  expect_identical(prosecnurapp:::.cm_aulas_col(raw, mp$section), "nro_seccion")
  expect_identical(prosecnurapp:::.cm_aulas_col(raw, mp$classroom_label), "nro_aula")
  raw <- .subdir_base(list(numero_de_seccion = "01"))
  expect_identical(prosecnurapp:::.cm_aulas_col(raw, mp$section), "numero_de_seccion")
})
