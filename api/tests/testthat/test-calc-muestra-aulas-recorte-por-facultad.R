# Cuanto recorta cada criterio del marco, facultad por facultad.
#
# Es lo unico en lo que el diseño de Kamila es mejor que el nuestro: mide dentro
# de cada facultad, publica la tabla, y cambia la regla solo donde hay algo que
# cambiar. Nosotros ya teniamos la matriz con el contrafactual y no la
# publicabamos con esa forma.
#
# La regla que va con la tabla: **un criterio se declara solo donde recorta**.
# El filtro de docente se lleva el 43,8 % de PSICOLOGIA y el 0,0 % de CONTABLES
# y EDUCACION; el de nivel de curso de 2025 no recorta nada en 8 de 15.

.crf_matriz <- function() list(
  columns = list(
    list(criterion_id = "teacher_type", label = "Tipo de docente"),
    list(criterion_id = "course_level", label = "Nivel del curso")
  ),
  rows = list(
    # PSICOLOGIA: el docente le quita 39 de 89; el nivel, nada.
    list(faculty_key = "psicologia", faculty_label = "PSICOLOGIA", row_kind = "facultad",
         n_ch_elegibles = 50, cells = list(
           list(criterion_id = "teacher_type", delta_ch = 39),
           list(criterion_id = "course_level", delta_ch = 0))),
    # CONTABLES: el docente no le quita nada.
    list(faculty_key = "contables", faculty_label = "CIENCIAS CONTABLES", row_kind = "facultad",
         n_ch_elegibles = 28, cells = list(
           list(criterion_id = "teacher_type", delta_ch = 0),
           list(criterion_id = "course_level", delta_ch = 0))),
    # La fila Total es el mismo dato en otro grano y no cuenta como facultad.
    list(faculty_key = "__total__", faculty_label = "Total", row_kind = "total",
         n_ch_elegibles = 78, cells = list(
           list(criterion_id = "teacher_type", delta_ch = 39),
           list(criterion_id = "course_level", delta_ch = 0)))
  )
)

.crf <- function() {
  r <- calc_muestra_aulas_recorte_por_facultad(.crf_matriz())
  stats::setNames(r, vapply(r, function(x) x$criterion_id, character(1)))
}

test_that("las tres cifras salen del contrafactual que la matriz ya traia", {
  f <- .crf()[["teacher_type"]]$filas[[1]]
  expect_identical(f$faculty_label, "PSICOLOGIA")
  expect_identical(f$despues, 50L)   # las que tiene hoy
  expect_identical(f$recortadas, 39L)
  expect_identical(f$antes, 89L)     # las que tendria sin el criterio
  expect_equal(f$pct_recortado, 43.8)
})

test_that("`aplica` distingue «no quita nada aqui» de «no se midio»", {
  # Es la regla hecha dato: la superficie no tiene que deducirla de un cero, y
  # un cero no es lo mismo que un NA.
  cont <- .crf()[["teacher_type"]]$filas[[2]]
  expect_false(cont$aplica)
  expect_true(cont$medible)
  expect_identical(cont$recortadas, 0L)

  sin_dato <- calc_muestra_aulas_recorte_por_facultad(list(
    columns = list(list(criterion_id = "x", label = "X")),
    rows = list(list(faculty_key = "a", faculty_label = "A", row_kind = "facultad",
                     n_ch_elegibles = 10, cells = list(list(criterion_id = "x", delta_ch = NA))))
  ))[[1]]$filas[[1]]
  expect_false(sin_dato$aplica)
  expect_false(sin_dato$medible)
  expect_true(is.na(sin_dato$recortadas))
})

test_that("la fila Total NO cuenta como una facultad", {
  # Mezclarla haria que «en cuantas facultades recorta» contara una de mas.
  t <- .crf()[["teacher_type"]]
  expect_equal(length(t$filas), 2L)
  expect_equal(t$facultades_donde_recorta, 1L)
  expect_equal(t$facultades_evaluadas, 2L)
})

test_that("un criterio que no recorta en ninguna parte lo dice", {
  n <- .crf()[["course_level"]]
  expect_equal(n$facultades_donde_recorta, 0L)
  expect_identical(n$etiqueta, "No quita ninguna aula en ninguna facultad")
})

test_that("el titular hace visible que el efecto NO es parejo", {
  # Sin esta frase hay que leer quince filas para ver que un criterio muerde en
  # una facultad y en las demas no hace nada.
  expect_identical(.crf()[["teacher_type"]]$etiqueta, "Quita aulas en 1 de 2 facultades")
})

test_that("cada fila lleva su denominador y ninguna usa jerga", {
  # «Recorta el 43,8 %» no dice de que; «39 de 89» si.
  f <- .crf()[["teacher_type"]]$filas
  expect_match(f[[1]]$etiqueta, "39 de 50 aulas|39 de 89 aulas")
  expect_identical(f[[2]]$etiqueta, "No quita ninguna aula aqui")
  frases <- c(vapply(f, function(x) x$etiqueta, character(1)),
              .crf()[["teacher_type"]]$etiqueta)
  expect_false(any(grepl(MONITOREO_AULAS_JERGA_PROHIBIDA, frases, ignore.case = TRUE)))
})

test_that("sin matriz no inventa una tabla", {
  expect_equal(length(calc_muestra_aulas_recorte_por_facultad(NULL)), 0L)
  expect_equal(length(calc_muestra_aulas_recorte_por_facultad(list())), 0L)
  expect_equal(length(calc_muestra_aulas_recorte_por_facultad(list(rows = list()))), 0L)
})
