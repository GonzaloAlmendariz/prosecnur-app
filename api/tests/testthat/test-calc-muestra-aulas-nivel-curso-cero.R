# El nivel del curso es el del CURSO, no el ciclo del alumno.
#
# Gonzalo: «¿por que una caracteristica migra? Si EE.GG. Letras tenia ciclo 0 en
# la base deberia quedarse como 0. No editamos la data real». Tenia razon: nada
# migraba, lo leiamos mal.
#
# Medido en HSVG2026: el aula `PSI125-0201` (NEUROCIENCIAS, EE.GG. LETRAS) tiene
# «Nivel del curso» = **0** en el catalogo del propio proyecto y salia como **1**
# en el frame, con `level_reference` declarando «curso». Y no era un caso suelto:
# `course_level_num` era IDENTICO a `level` —el ciclo del ALUMNO— en **5.251 de
# las 5.263 aulas**.
#
# LA CAUSA, en dos pasos encadenados:
#   1. `.cm_aulas_col` resuelve `course_level` contra la columna «curso» —el
#      NOMBRE del curso, que calza con el candidato «nivel_curso» por substring—;
#   2. la guarda anti-colision detecta que esa columna pertenece a `course_name`
#      y devuelve "" SIN mirar la sintetica que el catalogo acababa de rellenar.
# Resultado: el nivel del curso se quedaba sin columna y el frame caia al ciclo
# del alumno. El criterio de nivel operaba sobre el alumno creyendo que era el
# curso — y es el criterio que motivo la exencion de los Estudios Generales.

.nc0_base <- function(ciclo_alumno = 1) do.call(rbind, lapply(1:20, function(j) data.frame(
  student_id = paste0("e", j), aula_id = "A01", curso_id = "C1",
  curso = "Argumentacion", horario = "L 8", facultad = "ESTUDIOS GENERALES LETRAS",
  programa = "P1", sexo = "F", edad = 20, condicion = "regular", nivel = "pregrado",
  ciclo_alumno = ciclo_alumno, modalidad = "presencial", tipo_sesion = "TEORICO",
  stringsAsFactors = FALSE)))

.nc0_catalogo <- function(nivel_curso = 0) data.frame(
  aula_id = "A01", curso_id = "C1", curso = "Argumentacion", horario = "L 8",
  facultad = "ESTUDIOS GENERALES LETRAS", modalidad = "presencial",
  tipo_sesion = "TEORICO", nivel_curso = nivel_curso, matriculados = 20,
  stringsAsFactors = FALSE)

.nc0_frame <- function(nivel_curso = 0, ciclo_alumno = 1) calc_muestra_aulas_construir(
  base_madre = .nc0_base(ciclo_alumno), catalogo_curso_horario = .nc0_catalogo(nivel_curso),
  config = list(
    mapping = list(session_type = "tipo_sesion", course_level = "nivel_curso", level = "ciclo_alumno"),
    filters = list(min_eligible_per_class = 5L)
  ))$aula_frame

test_that("el nivel 0 del catalogo llega al frame", {
  # Un 0 es un nivel, no una ausencia: en esta universidad marca los cursos de
  # Estudios Generales, que no pertenecen a la malla de una especialidad.
  af <- .nc0_frame(nivel_curso = 0, ciclo_alumno = 1)
  expect_equal(af$course_level_num, 0)
})

test_that("CONTROL: el nivel del curso NO es el ciclo del alumno", {
  # Con el curso en 3 y el alumno en 7, el frame tiene que decir 3. Sin este
  # control el test de arriba pasaria por casualidad si ambos coincidieran.
  af <- .nc0_frame(nivel_curso = 3, ciclo_alumno = 7)
  expect_equal(af$course_level_num, 3)
  expect_false(identical(af$course_level_num, 7))
})

test_that("sin nivel en el catalogo SI se cae al ciclo del alumno", {
  # La degradacion es deliberada y esta documentada; lo que no vale es caer
  # teniendo el dato.
  af <- calc_muestra_aulas_construir(
    base_madre = .nc0_base(5),
    catalogo_curso_horario = .nc0_catalogo(NA),
    config = list(mapping = list(session_type = "tipo_sesion", level = "ciclo_alumno"),
                  filters = list(min_eligible_per_class = 5L)))$aula_frame
  expect_equal(af$course_level_num, 5)
})

test_that("la columna del NOMBRE del curso nunca se toma como nivel", {
  # Es la colision que empezo todo: «curso» calza con «nivel_curso» por
  # substring, y de ahi no sale ningun numero.
  raw <- data.frame(student_id = "e1", aula_id = "A01", curso_id = "C1",
                    curso = "Argumentacion", course_level = "0", stringsAsFactors = FALSE)
  m <- .cm_aulas_config_mapping(names(raw))
  expect_equal(.cm_criterios_col_course_level(raw, m), "course_level")
})
