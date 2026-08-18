# La radiografía del nivel del curso debe RECONSTRUIR el mismo flag que el
# constructor. El evaluador de rangos decide la exención por la facultad DEL
# AULA (tercer argumento `faculty_keys`); el constructor y el preview lo pasan,
# pero la radiografía lo omitía y recalculaba un flag distinto en cada aula de
# facultad exenta. La reconstrucción fallaba y el gate `course_level` se
# publicaba `invalido` — la UI mostraba «El engine publicó una fila o metadato
# inválido» en las 15 fichas de nivel (medido en HSVG2026 con 3 facultades
# exentas). Tercer consumidor del mismo defecto; el comentario del cascada ya
# avisaba «SIN COBERTURA: quitar este argumento no mata ningún test».

.cr_nivel_exencion_frame <- function() {
  # FAC A: cursos en nivel 1 — el rango [2,10] los cortaría, pero la facultad
  # está EXENTA, así que sus aulas quedan dentro por la facultad del aula.
  # FAC B: cursos en nivel 3 — pasan el rango declarado.
  ch <- rep(paste0("CH-", 1:4), each = 2L)
  base <- data.frame(
    estudiante = paste0("EST-", 1:8),
    curso_horario = ch,
    formacion = rep("PREGRADO", 8L),
    condicion_alumno = rep("REGULAR", 8L),
    edad = rep(c(18, 22), 4L),
    facultad_alumno = rep(c("FAC A", "FAC B"), each = 4L),
    nivel_alumno = rep("3", 8L),
    modalidad = rep("PRESENCIAL", 8L),
    tipo_sesion = rep("TEORICO", 8L),
    nivel_curso = rep(c("1", "1", "3", "3"), each = 2L),
    matriculados = rep(20, 8L),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  calc_muestra_aulas_construir(
    base_madre = base,
    config = list(
      mapping = list(
        student_id = "estudiante", classroom_id = "curso_horario",
        formation = "formacion", condition = "condicion_alumno", age = "edad",
        faculty = "facultad_alumno", level = "nivel_alumno",
        modality = "modalidad", session_type = "tipo_sesion",
        course_level = "nivel_curso", enrolled_total = "matriculados"
      ),
      filters = list(
        require_adult = FALSE, require_undergraduate = FALSE,
        require_in_person = FALSE, accepted_conditions = list(),
        exclude_session_patterns = list(), min_eligible_per_class = 1L
      ),
      criterios_seleccion = list(
        minEligible = list(threshold = 1),
        courseLevelRanges = list(
          "FAC A" = list(list(exenta = TRUE)),
          "FAC B" = list(list(min = 2, max = 10))
        )
      )
    )
  )
}

.cr_nivel_entry <- function(frame, id) {
  for (entry in frame$criterios_radiografia$criterios) {
    if (identical(entry$id, id)) return(entry)
  }
  NULL
}

test_that("la exención por facultad no invalida la radiografía del nivel", {
  frame <- .cr_nivel_exencion_frame()

  # Sanidad del fixture: la exención de FAC A tiene que estar decidiendo algo.
  # Sus aulas quedan DENTRO pese a estar en nivel 1 (el rango las cortaría).
  aulas <- frame$aula_frame
  fac_a <- grepl("FAC A", aulas$faculty, fixed = TRUE)
  expect_true(any(fac_a))
  expect_true(all(aulas$included[fac_a]))

  entry <- .cr_nivel_entry(frame, "course_level")
  expect_false(is.null(entry))
  # Con el defecto, la reconstrucción divergía en las aulas exentas y el gate
  # salía "invalido"; reconstruido con la facultad del aula sale "disponible".
  expect_identical(entry$status, "disponible")
  expect_gt(length(entry$rows), 0L)
})

test_that("sin rangos declarados el gate del nivel sigue sano", {
  # Control: el camino inactivo (sin courseLevelRanges) nunca tuvo el defecto;
  # si este test cae, el fixture o el constructor cambiaron, no la exención.
  frame <- .cr_nivel_exencion_frame()
  expect_identical(.cr_nivel_entry(frame, "minEligible")$status, "disponible")
})
