# El reporte de brechas salia con las ~40 columnas del plan, asi que con 196
# aulas pesaba 337 KB de un payload de 1220 —tanto como el plan entero, que ya
# viaja dos veces— para una tabla que muestra ocho y una publicacion que toma
# diez. Este test fija el contrato en las dos direcciones: que no vuelva a
# engordar, y que no adelgace por debajo de lo que sus consumidores piden.

test_that("brechas viaja solo con las columnas que alguien consume", {
  plan <- lapply(1:3, function(i) list(
    operational_code = sprintf("CH %d", i),
    classroom_id = sprintf("A-%d", i),
    label = sprintf("Curso %d", i),
    faculty = "Derecho", program = "Derecho", level = "3",
    stratum = "Derecho", wave = "M1",
    operational_status = "agendada",
    sample_role = "titular",
    eligible_n = 30, expected_valid = 30,
    # Ruido que el plan lleva y ningun consumidor de brechas mira.
    teacher = "Docente", teacher_email = "d@x.pe", teacher_phone = "999",
    sex_top_1 = "F", sex_top_1_n = 18, sex_top_2 = "M", sex_top_2_n = 12,
    link = "https://ejemplo/x", selection_run_id = "run-1"
  ))
  d <- monitoreo_aulas_dashboard(plan, data.frame(), list(enabled = TRUE))

  expect_gt(length(d$brechas), 0)
  cols <- names(d$brechas[[1]])
  expect_setequal(cols, intersect(BRECHAS_COLUMNAS_PUBLICADAS, cols))
  # Lo que la tabla de Consultas pide.
  for (campo in c("operational_code", "label", "respuestas_validas",
                  "expected_valid", "brecha", "operational_status")) {
    expect_true(campo %in% cols, info = campo)
  }
  # Lo que la publicacion a Sheets toma.
  for (campo in c("classroom_id", "faculty", "program", "level", "stratum", "wave")) {
    expect_true(campo %in% cols, info = campo)
  }
  # Y lo que NO tiene por que viajar. El correo y el telefono del docente son
  # datos personales: que salgan en un reporte que se publica a Sheets no es
  # solo peso, es exposicion.
  for (campo in c("teacher_email", "teacher_phone", "sex_top_1", "link", "selection_run_id")) {
    expect_false(campo %in% cols, info = campo)
  }
})

test_that("el recorte no toca la agenda, que si es el plan entero", {
  plan <- list(list(
    operational_code = "CH 1", classroom_id = "A-1", label = "Curso",
    faculty = "Derecho", eligible_n = 30, expected_valid = 30,
    teacher_phone = "999", sex_top_1 = "F", sample_role = "titular"
  ))
  d <- monitoreo_aulas_dashboard(plan, data.frame(), list(enabled = TRUE))
  # La agenda es de donde el registro de campo y la cadena leen el plan: si se
  # recortara con las columnas de brechas, el telefono del docente y la
  # composicion muestral desaparecerian de la app.
  expect_true("teacher_phone" %in% names(d$agenda[[1]]))
  expect_true("sex_top_1" %in% names(d$agenda[[1]]))
})

test_that("la lista de brechas abre por la mayor", {
  # El panel se llama «Cursos-horario con brecha» y su razon de ser es a quien ir
  # primero. El filtro no ordenaba y heredaba el orden del plan: medido sobre el
  # operativo, abria con 15, 15, 16, 17 y la mayor —31— estaba en la fila 24.
  plan <- list(
    list(classroom_id = "CH 1", operational_code = "CH 1", eligible_n = 30, expected_valid = 20),
    list(classroom_id = "CH 2", operational_code = "CH 2", eligible_n = 30, expected_valid = 5),
    list(classroom_id = "CH 3", operational_code = "CH 3", eligible_n = 30, expected_valid = 12)
  )
  d <- monitoreo_aulas_dashboard(plan, data.frame(), list())
  brechas <- vapply(d$brechas, function(r) as.numeric(r$brecha), numeric(1))

  expect_identical(brechas, c(20, 12, 5))
  # El aserto que distingue «ordenada» de «coincidencia»: con el orden del plan
  # saldria 20, 5, 12, que tambien empieza por la mayor.
  expect_false(is.unsorted(rev(brechas)))
})

test_that("a igual brecha, el codigo desempata y el orden es estable", {
  # Sin desempate, dos aulas con la misma brecha salen en el orden que traiga el
  # plan y la lista cambia sola entre corridas.
  plan <- lapply(c("CH 9", "CH 2", "CH 5"), function(cod) list(
    classroom_id = cod, operational_code = cod, eligible_n = 30, expected_valid = 10))
  d <- monitoreo_aulas_dashboard(plan, data.frame(), list())
  codigos <- vapply(d$brechas, function(r) as.character(r$operational_code), character(1))

  expect_identical(codigos, c("CH 2", "CH 5", "CH 9"))
})
