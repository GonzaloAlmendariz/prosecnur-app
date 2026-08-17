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
