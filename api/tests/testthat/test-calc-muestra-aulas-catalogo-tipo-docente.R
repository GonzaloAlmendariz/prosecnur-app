# G44 · El tipo de docente del catálogo no puede llegar al marco como NOMBRES.
#
# Gonzalo, mirando el explorador: «¿y qué hay de tipo de docente? tengo
# entendido que es un select múltiple». Lo que se veía eran 2.576 categorías con
# forma de «FERNANDEZ SANTA MARIA, XAVIER»: el marco había puesto los nombres de
# los docentes en `teacher_type` y había dejado `teacher` vacío.
#
# Medido en su proyecto (BD estudiantes y curso-horario 2025-2): la columna
# «Tipo de docente» del archivo tiene 5 categorías —CONTRATADO, JEFE DE
# PRÁCTICA, PRINCIPAL, ASOCIADO, AUXILIAR— y el marco publicaba 2.576 valores,
# con `catalog_audit$teacher_type_values = 0`. El criterio de tipo de docente
# estuvo filtrando por nombres propios: en CIENCIAS E INGENIERÍA recortaba de
# 587 a 554 cursos-horario eligiendo docentes concretos.
#
# La condición que lo dispara es el mapeo del proyecto: `teacher` apuntando a la
# columna de CÓDIGOS («Docente») y `teacher_type` sin mapear. El enriquecimiento
# del catálogo escribe el nombre del docente en la columna sintética `teacher`,
# y el resolver de `teacher_type` la reclamaba por parecido —«teacher» es
# subcadena de «teacher_type»— dándose por satisfecho: como creía tener señal en
# la base, ya no bajaba a buscar la columna buena en el catálogo.

.tipo_docente_base <- function() {
  data.frame(
    `Código PUCP` = c("A1", "A2", "A3", "A4"),
    Facultad = "CIENCIAS",
    Carrera = "ING",
    Sexo = c("M", "F", "M", "F"),
    Edad = 20,
    `Nivel curricular` = "3",
    `Formación` = "PREGRADO",
    `Condición` = "REGULAR",
    Curso = c("C1", "C1", "C2", "C2"),
    `Nombre del curso` = c("Cálculo", "Cálculo", "Física", "Física"),
    Horario = c("H1", "H1", "H2", "H2"),
    Modalidad = "PRESENCIAL",
    `Tipo Curso` = "TEORICO",
    `Condición del curso` = "OBLIGATORIO",
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

.tipo_docente_catalogo <- function() {
  data.frame(
    `Curso-Horario` = c("C1|H1", "C2|H2"),
    Curso = c("C1", "C2"),
    `Nombre del curso` = c("Cálculo", "Física"),
    Horario = c("H1", "H2"),
    Facultad = "CIENCIAS",
    Modalidad = "PRESENCIAL",
    `Tipo de curso` = "TEORICO",
    `Condición` = "OBLIGATORIO",
    Matriculados = c(2, 2),
    # Las tres columnas de docente del archivo real: código, nombre y tipo.
    Docente = c("20144094", "00004913"),
    `Nombre de docente` = c("ROJAS HANCCO, JHONNY", "AÑI MONTOYA, ADRIANA"),
    `Tipo de docente` = c("DOCENTE ORDINARIO - PRINCIPAL", "DOCENTE CONTRATADO - CONTRATADO"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

.tipo_docente_config <- function(mapping_extra = list()) {
  list(
    mapping = c(
      list(
        student_id = "Código PUCP", faculty = "Facultad", program = "Carrera",
        sex = "Sexo", age = "Edad", level = "Nivel curricular",
        formation = "Formación", condition = "Condición",
        course_id = "Curso", course_name = "Nombre del curso", schedule = "Horario",
        modality = "Modalidad", session_type = "Tipo Curso",
        condicion_curso = "Condición del curso"
      ),
      mapping_extra
    ),
    filters = list(
      require_adult = FALSE, require_undergraduate = FALSE, require_in_person = FALSE,
      accepted_conditions = list(), exclude_session_patterns = list(),
      min_eligible_per_class = 1L
    )
  )
}

.tipo_docente_frame <- function(mapping_extra = list()) {
  calc_muestra_aulas_construir(
    base_madre = .tipo_docente_base(),
    catalogo_curso_horario = .tipo_docente_catalogo(),
    config = .tipo_docente_config(mapping_extra)
  )
}

test_that("el tipo de docente sale del catalogo aunque `teacher` apunte a los codigos", {
  # El mapeo del proyecto real: nombre del docente NO mapeado y `teacher`
  # apuntando a la columna de códigos, que ni siquiera vive en la base madre.
  frame <- .tipo_docente_frame(list(teacher = "Docente"))
  tipos <- unique(frame$aula_frame$teacher_type)
  tipos <- tipos[nzchar(tipos)]

  expect_setequal(
    tipos,
    c("DOCENTE ORDINARIO - PRINCIPAL", "DOCENTE CONTRATADO - CONTRATADO")
  )
  # Ningún valor con forma de nombre propio: son categorías, no personas.
  expect_false(any(grepl(",", tipos, fixed = TRUE)))
  # Y el catálogo declara que aportó la señal, en vez de contar cero.
  expect_gt(frame$catalog_audit$teacher_type_values, 0L)
})

test_that("el nombre del docente no se pierde cuando su rol apunta a otra columna", {
  frame <- .tipo_docente_frame(list(teacher = "Docente"))
  docentes <- unique(frame$aula_frame$teacher)
  docentes <- docentes[nzchar(docentes)]
  # El catálogo trae el nombre y el marco lo publica: quedaba vacío mientras sus
  # valores viajaban, cambiados de sitio, dentro de `teacher_type`.
  expect_setequal(docentes, c("ROJAS HANCCO, JHONNY", "AÑI MONTOYA, ADRIANA"))
})

test_that("con el mapeo limpio el marco sigue resolviendo igual", {
  # Contraparte de no-regresión: sin `teacher` mapeado a los códigos, el
  # comportamiento histórico se conserva.
  frame <- .tipo_docente_frame()
  expect_setequal(
    unique(frame$aula_frame$teacher_type)[nzchar(unique(frame$aula_frame$teacher_type))],
    c("DOCENTE ORDINARIO - PRINCIPAL", "DOCENTE CONTRATADO - CONTRATADO")
  )
  expect_setequal(
    unique(frame$aula_frame$teacher)[nzchar(unique(frame$aula_frame$teacher))],
    c("ROJAS HANCCO, JHONNY", "AÑI MONTOYA, ADRIANA")
  )
})
