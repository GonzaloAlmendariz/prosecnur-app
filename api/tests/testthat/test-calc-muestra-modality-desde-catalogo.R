# La modalidad se rellena desde el catálogo, como el docente.
#
# El mapeo del estudio apunta a `MODALIDADCURSO`, que sólo existe en el catálogo
# de cursos-horario; el marco la leía de la base del alumno, donde esa columna no
# está. Medido el 2026-08-25 sobre HSVG 2026: `modality` vacía en las 5.269 aulas
# y la tarjeta de salud avisando «está declarado pero su columna llega vacía: el
# criterio no puede filtrar a nadie y no es que deje pasar a todos».
#
# El marco seguía saliendo bien —las 2.446 incluidas eran 100 % presenciales,
# porque el path legacy por patrones excluye virtual/distancia leyendo la base—,
# así que esto no cambia a quién se filtra. Arregla que la señal EXISTA: sin ella
# el criterio por categorías no se evalúa, la salud miente en rojo, y `modality`
# —una de las `replacement_equivalence_vars`— no sirve para decidir equivalencias
# de reemplazo.

.mod_raw <- function() data.frame(
  student_id = c("a1", "a2", "a3"),
  clavecurso = c("LIT105", "MAT101", "LIT105"),
  horario = c("0204", "0301", "0204"),
  stringsAsFactors = FALSE
)
.mod_catalogo <- function() data.frame(
  clavecurso = c("LIT105", "MAT101"),
  horario = c("0204", "0301"),
  modalidadcurso = c("Presencial", "VIRTUAL"),
  stringsAsFactors = FALSE
)
.mod_mapping <- function() list(
  student_id = "student_id", course_id = "clavecurso", schedule = "horario",
  modality = "modalidadcurso"
)

test_that("la modalidad del catalogo llega a la columna del rol", {
  out <- .cm_aulas_enrich_with_catalog(.mod_raw(), .mod_catalogo(), .mod_mapping())
  d <- out$data %||% out
  expect_true("modality" %in% names(d))
  vals <- .cm_aulas_values(d, "modality", "")
  expect_equal(sum(nzchar(vals)), 3L)
  expect_equal(vals[[2]], "VIRTUAL")
})

test_that("si la base YA trae la senal, el catalogo no la pisa", {
  # Misma regla que los otros roles: el catálogo rellena huecos, no sustituye.
  raw <- .mod_raw()
  raw$modalidadcurso <- c("Semipresencial", "Semipresencial", "Semipresencial")
  out <- .cm_aulas_enrich_with_catalog(raw, .mod_catalogo(), .mod_mapping())
  d <- out$data %||% out
  expect_true(all(.cm_aulas_values(d, "modalidadcurso", "") == "Semipresencial"))
})

test_that("sin catalogo el marco sale intacto", {
  raw <- .mod_raw()
  out <- .cm_aulas_enrich_with_catalog(raw, NULL, .mod_mapping())
  d <- out$data %||% out
  expect_equal(nrow(d), nrow(raw))
})
