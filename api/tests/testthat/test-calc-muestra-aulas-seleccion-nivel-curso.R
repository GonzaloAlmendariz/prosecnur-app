# La selección publica el NIVEL DEL CURSO, no solo el ciclo del alumno.
#
# Detectado por Gonzalo a ojo (2026-08-18): el perfil de la muestra pintaba
# «Nivel del curso 1..12» en EE.GG. Letras, que por nivel del CURSO es 449/481
# nivel 0. La causa no era el gráfico: la lista cerrada `public_cols` de
# calc_muestra_aulas_seleccionar (y su gemela del import histórico) publicaba
# `level` —el ciclo del ALUMNO— y omitía `course_level_num`, la columna que el
# catálogo/mapeo escribe tras ea62de2d. El frontend, sin el campo, caía por
# fallback difuso a `level` bajo un rótulo que decía «curso».
#
# El fixture usa el CONTROL decisivo de ea62de2d: curso en nivel 3, alumnos en
# ciclo 7. Si un día ambos vuelven a coincidir por colisión, la igualdad
# level == course_level_num en el payload lo delata.

.snc_base <- function() {
  ids <- c(paste0("s", 1:40), paste0("t", 1:40), paste0("u", 1:40))
  aula <- c(rep("A1", 40), rep("A2", 40), rep("A3", 40))
  data.frame(
    student_id = ids,
    aula_id = aula,
    curso_id = paste0("C", match(aula, c("A1", "A2", "A3"))),
    curso = paste("Curso", aula),
    horario = "L 8",
    facultad = "FAC1",
    programa = "P1",
    sexo = "F",
    edad = 20,
    condicion = "regular",
    # El ciclo del ALUMNO: 7. Deliberadamente distinto del nivel del curso.
    nivel = "7",
    # El nivel del CURSO: 3. Es lo que el marco filtra y el perfil debe pintar.
    nivel_curso = "3",
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
}

.snc_cfg <- function(seed = 77L) {
  calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(
      seed = seed,
      n_aulas = 2L,
      replacement_waves = 0L,
      selector_engine = "sistematico_pps",
      strata_cols = list("faculty"),
      monte_carlo_n = 0L,
      simulation_runs = 0L
    )
  ))
}

test_that("el frame ancla course_level_num del curso y level del alumno como cosas distintas", {
  frame <- calc_muestra_aulas_construir(base_madre = .snc_base(), config = .snc_cfg())
  af <- frame$aula_frame
  expect_true("course_level_num" %in% names(af))
  expect_setequal(as.numeric(af$course_level_num), 3)
  expect_setequal(as.character(af$level), "7")
})

test_that("la seleccion publica course_level_num y no lo confunde con el ciclo del alumno", {
  skip_if_not_installed("sampling")
  frame <- calc_muestra_aulas_construir(base_madre = .snc_base(), config = .snc_cfg())
  sel <- calc_muestra_aulas_seleccionar(frame, .snc_cfg())
  pub <- sel$selection
  # El defecto exacto: course_level_num ausente del payload publicado.
  expect_true("course_level_num" %in% names(pub))
  expect_setequal(as.numeric(pub$course_level_num), 3)
  # Y el ciclo del alumno sigue viajando, como campo PROPIO, no como disfraz.
  expect_true("level" %in% names(pub))
  expect_setequal(as.character(pub$level), "7")
  expect_false(identical(as.character(pub$level), as.character(pub$course_level_num)))
})

test_that("la facultad del curso viaja en la seleccion cuando el frame la trae", {
  skip_if_not_installed("sampling")
  frame <- calc_muestra_aulas_construir(base_madre = .snc_base(), config = .snc_cfg())
  af <- frame$aula_frame
  # Solo aplica si el frame publica la atribucion por curso (R9: faculty_aula).
  skip_if(!("faculty_aula" %in% names(af)), "el frame no trae faculty_aula")
  sel <- calc_muestra_aulas_seleccionar(frame, .snc_cfg())
  expect_true("faculty_aula" %in% names(sel$selection))
})
