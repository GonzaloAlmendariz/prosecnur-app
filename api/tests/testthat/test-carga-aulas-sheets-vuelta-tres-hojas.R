# La vuelta completa por la via de Google Sheets, para las TRES hojas.
#
# `test-carga-aulas-desde-sheets.R` probaba solo «Aulas Agendadas». Las otras dos
# llevan DOS filas de cabecera en vez de una y se leen con funciones distintas,
# asi que el camino que el equipo usa de verdad —el libro vive en Drive y llega
# por `spreadsheets.values.get`— estaba sin cubrir para dos tercios del libro.
#
# Los nombres de los campos del parte son los que produce el LECTOR
# (`carga_aulas_aplicadas.R`), que es de donde vienen en un estudio real.

.vtres_unidades <- function() list(
  list(operational_code = "CH 1", sample_role = "titular",
       titular_operational_code = "CH 1", teacher = "Docente Uno",
       course_name = "Curso Uno", faculty = "SOCIALES", eligible_n = 40,
       enrolled_total = 45, scheduled_date = "2026-08-11"),
  list(operational_code = "R 1.1", sample_role = "chain_reserve",
       titular_operational_code = "CH 1", replacement_order = 1,
       teacher = "Docente Dos", course_name = "Curso Dos",
       faculty = "SOCIALES", eligible_n = 30, enrolled_total = 33)
)

.vtres_partes <- function() list(
  list(operational_code = "CH 1", intento = 1L, observed_students = 30,
       refusals = 2, duplicates = 0, effective_surveys = 28,
       applied_by = "Ana", actual_room = "L321", applied_date = "2026-08-12")
)

# Las filas tal como las devuelve la API de Sheets.
.vtres_values <- function(hoja) {
  lapply(seq_len(nrow(hoja)), function(i) as.list(as.character(hoja[i, ])))
}

test_that("la hoja de partes vuelve con sus cifras por la via de Sheets", {
  hoja <- aulas_libro_hoja_aplicadas(.vtres_unidades(), partes = .vtres_partes())
  partes <- aulas_libro_desde_valores(.vtres_values(hoja), "aplicadas")

  expect_gte(length(partes), 1L)
  codigos <- vapply(partes, function(p) as.character(p$operational_code %||% ""), character(1))
  expect_true("CH 1" %in% codigos)

  ch1 <- partes[[which(codigos == "CH 1")[[1]]]]
  expect_equal(as.numeric(ch1$effective_surveys), 28)
  expect_equal(as.numeric(ch1$observed_students), 30)
  # El salon real es lo que cruza con el agendado; si se pierde en la vuelta, el
  # panel de cambio de aula se queda sin la mitad del cruce.
  expect_identical(as.character(ch1$actual_room), "L321")
})

test_that("la hoja de control vuelve con sus filas por la via de Sheets", {
  hoja <- aulas_libro_hoja_control(.vtres_unidades())
  res <- aulas_libro_desde_valores(.vtres_values(hoja), "control")

  # Esta hoja devuelve `filas` + `sin_nombre`, no una lista pelada.
  expect_true(is.list(res) && !is.null(res$filas))
  expect_gte(length(res$filas), 1L)
  codigos <- vapply(res$filas, function(f) as.character(f$classroom_id %||% ""), character(1))
  expect_true("CH 1" %in% codigos)
})

test_that("las filas recortadas de Sheets no rompen las hojas de dos cabeceras", {
  # La API RECORTA las celdas vacias del final de cada fila, asi que el cuerpo
  # llega mas corto que la cabecera. En «Agendadas» ya estaba cubierto; estas dos
  # no lo estaban, y llevan una fila de cabecera mas.
  hoja <- aulas_libro_hoja_aplicadas(.vtres_unidades(), partes = .vtres_partes())
  vals <- .vtres_values(hoja)
  recortadas <- lapply(seq_along(vals), function(i) {
    if (i <= 2L) return(vals[[i]])          # las dos cabeceras enteras
    vals[[i]][seq_len(min(12L, length(vals[[i]])))]
  })

  # Lo que se pide es que NO reviente y que no invente filas con datos corridos.
  partes <- expect_no_error(aulas_libro_desde_valores(recortadas, "aplicadas"))
  for (p in partes) {
    expect_true(nzchar(as.character(p$operational_code %||% "")))
  }
})

test_that("una hoja de partes sin ningun parte registrado no inventa partes", {
  # El libro recien generado: la agenda esta, el parte todavia no. Devolver
  # filas aqui llenaria Monitoreo de partes fantasma con cero encuestas.
  hoja <- aulas_libro_hoja_aplicadas(.vtres_unidades())
  expect_length(aulas_libro_desde_valores(.vtres_values(hoja), "aplicadas"), 0L)
})
