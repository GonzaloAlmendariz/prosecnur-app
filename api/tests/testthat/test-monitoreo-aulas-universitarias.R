test_that("Monitoreo acepta aulas_universitarias como familia activa", {
  profile <- monitoreo_normalize_profile(list(family = "aulas_universitarias", status = "active", route_selected = TRUE))
  expect_equal(profile$family, "aulas_universitarias")
  expect_equal(profile$status, "active")
  expect_true(profile$route_selected)
})

test_that("Monitoreo importa seleccion de calc-muestra y agrega respuestas anonimas por aula", {
  selection <- list(
    selection_run_id = "sel_test",
    frame_hash = "hash_test",
    selection = data.frame(
      selection_run_id = "sel_test",
      operational_code = c("AULA 1", "AULA 2", "R1.1"),
      titular_operational_code = c("AULA 1", "AULA 2", "AULA 1"),
      replacement_chain_code = c("", "", "R1.1"),
      wave = c("M1", "M1", "M2"),
      orden = c(1, 2, 1),
      classroom_id = c("A1", "A2", "A3"),
      label = c("Aula 1", "Aula 2", "Aula 3"),
      course_id = c("C1", "C2", "C3"),
      course_name = c("Curso 1", "Curso 2", "Curso 3"),
      schedule = c("L 8", "M 10", "J 12"),
      teacher = c("Doc 1", "Doc 2", "Doc 3"),
      faculty = c("FAC1", "FAC1", "FAC2"),
      program = c("P1", "P1", "P2"),
      level = "pregrado",
      stratum = c("FAC1", "FAC1", "FAC2"),
      eligible_n = c(30, 25, 20),
      expected_valid = c(10, 10, 8),
      sex_top_1 = c("F", "M", "F"),
      sex_top_1_n = c(18, 14, 12),
      sex_top_2 = c("M", "F", "M"),
      sex_top_2_n = c(12, 11, 8),
      representativity_score = c(92, 91, 88),
      representativity_distance = c(0.08, 0.09, 0.12),
      stringsAsFactors = FALSE
    ),
    representativity = list(overall_score = 90, weighted_distance = 0.1),
    methodology = list(selector = "test")
  )
  frame <- list(
    frame_hash = "hash_test",
    population_cross_profiles = data.frame(
      primary_role = "faculty",
      primary_label = "Facultad",
      primary_raw = c("FAC1", "FAC1", "FAC2", "FAC2"),
      secondary_role = "sex",
      secondary_label = "Sexo",
      secondary_raw = c("F", "M", "F", "M"),
      source_role = "base_madre",
      count = c(60, 40, 30, 20),
      unit_label = "estudiantes",
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  cfg <- monitoreo_aulas_from_calc(list(titulo = "Encuesta estudiantes"), selection, frame)
  expect_true(cfg$enabled)
  expect_equal(cfg$selection_run_id, "sel_test")
  expect_length(cfg$plan, 3)
  expect_equal(cfg$plan[[1]]$operational_code, "AULA 1")
  expect_true(is.list(cfg$quotas$sex_by_faculty))

  responses <- data.frame(
    classroom_id = c("A1", "A1", "A2", "A9"),
    response_status = c("completed", "valid", "rejected", "completed"),
    faculty = c("FAC1", "FAC1", "FAC1", "FAC2"),
    sex = c("F", "M", "M", "F"),
    stringsAsFactors = FALSE
  )
  cfg$source_mapping$classroom_id_var <- "classroom_id"
  cfg$source_mapping$status_var <- "response_status"
  dashboard <- monitoreo_aulas_dashboard(cfg$plan, responses, cfg)

  expect_equal(dashboard$kpis$total_aulas, 3)
  expect_equal(dashboard$kpis$respuestas_validas, 3)
  expect_true(is.list(dashboard$representativity))
  expect_true(is.finite(dashboard$kpis$representativity_effective_score))
  expect_true(length(dashboard$quotas_sex_faculty) >= 4)
  expect_true(dashboard$kpis$quota_cells_pending > 0)
  expect_true(length(dashboard$course_status) >= 3)
  expect_true(any(vapply(dashboard$validation, function(row) identical(row$check, "student_id_required") && identical(row$status, "ok"), logical(1))))
})

test_that("Agenda de aulas cambia estados y aplica reemplazos", {
  plan <- monitoreo_aulas_normalize_plan(data.frame(
    selection_run_id = "sel_test",
    operational_code = c("AULA 1", "R1.1"),
    titular_operational_code = c("AULA 1", "AULA 1"),
    replacement_chain_code = c("", "R1.1"),
    wave = c("M1", "M2"),
    orden = c(1, 1),
    classroom_id = c("A1", "A2"),
    course_name = c("Curso 1", "Curso 2"),
    stratum = "FAC1",
    eligible_n = c(30, 25),
    operational_status = "planificada",
    stringsAsFactors = FALSE
  ))

  updated <- monitoreo_aulas_update_agenda(plan, data.frame(
    operational_code = "AULA 1",
    operational_status = "agendada",
    responsible = "Campo 1",
    link = "https://example.test/a1",
    word_link = "https://drive.test/ficha-a1.docx",
    pdf_link = "https://drive.test/ficha-a1.pdf",
    package_label = "M1",
    package_status = "listo_para_pdf",
    stringsAsFactors = FALSE
  ))
  updated_df <- .monitoreo_aulas_df(updated)
  expect_equal(updated_df$operational_status[updated_df$classroom_id == "A1"], "agendada")
  expect_equal(updated_df$responsible[updated_df$classroom_id == "A1"], "Campo 1")
  expect_equal(updated_df$word_link[updated_df$classroom_id == "A1"], "https://drive.test/ficha-a1.docx")
  expect_equal(updated_df$pdf_link[updated_df$classroom_id == "A1"], "https://drive.test/ficha-a1.pdf")
  expect_equal(updated_df$package_label[updated_df$classroom_id == "A1"], "M1")

  replaced <- monitoreo_aulas_apply_replacement(updated, "AULA 1", "R1.1", "baja_asistencia", "Se activo reserva")
  replaced_df <- .monitoreo_aulas_df(replaced)
  expect_equal(replaced_df$operational_status[replaced_df$classroom_id == "A1"], "reemplazada")
  expect_equal(replaced_df$replacement_for[replaced_df$classroom_id == "A2"], "A1")
  expect_equal(replaced_df$replacement_reason[replaced_df$classroom_id == "A2"], "baja_asistencia")
})
