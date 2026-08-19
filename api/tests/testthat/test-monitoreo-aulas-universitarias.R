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
  expect_identical(
    vapply(cfg$plan, `[[`, character(1), "operational_code"),
    c("CH 1", "CH 2", "R 1.1")
  )
  expect_identical(cfg$plan[[3]]$titular_operational_code, "CH 1")
  expect_identical(cfg$plan[[3]]$replacement_chain_code, "R 1.1")
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
  expect_identical(updated_df$operational_code, c("CH 1", "R 1.1"))
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

test_that("carga de Monitoreo canoniza históricos de forma idempotente", {
  historical <- data.frame(
    selection_run_id = "sel_legacy",
    operational_code = c("AULA 5", "R5.1", "R 5.2"),
    titular_operational_code = c("AULA 5", "AULA 5", "CH 5"),
    replacement_chain_code = c("", "R5.1", "R 5.2"),
    selection_slot_id = "slot_005",
    sample_role = c("titular", "chain_reserve", "chain_reserve"),
    wave = c("M1", "M2", "M3"),
    replacement_order = c(0, 1, 2),
    orden = c(5, 1, 2),
    classroom_id = c("A5", "A6", "A7"),
    stringsAsFactors = FALSE
  )

  loaded <- monitoreo_aulas_normalize_config(list(plan = historical))$plan
  loaded_df <- .monitoreo_aulas_df(loaded)
  loaded_twice_df <- .monitoreo_aulas_df(monitoreo_aulas_normalize_plan(loaded))

  expect_identical(loaded_df$operational_code, c("CH 5", "R 5.1", "R 5.2"))
  expect_identical(loaded_df$titular_operational_code, rep("CH 5", 3))
  expect_identical(loaded_df$replacement_chain_code, c("", "R 5.1", "R 5.2"))
  expect_identical(
    loaded_twice_df[, c(
      "operational_code", "titular_operational_code",
      "replacement_chain_code"
    )],
    loaded_df[, c(
      "operational_code", "titular_operational_code",
      "replacement_chain_code"
    )]
  )
})

test_that("el cumplimiento en respuestas se calcula sobre el conjunto en juego y entero", {
  # La vista lo sumaba sobre `course_status`, que viaja recortado a 500 filas:
  # sobre un plan de 2 615 el panel habria enseñado la meta de un subconjunto
  # arbitrario presentada como el total del estudio.
  plan <- list(
    # Titular en juego, con meta y a medias.
    list(operational_code = "CH 1", classroom_id = "c1", sample_role = "titular",
         sample_status = "agendada", expected_valid = 30, respuestas_validas = 10,
         faculty = "Derecho", stratum = "Derecho"),
    # Su reserva DORMIDA: no pide respuestas hasta que entra.
    list(operational_code = "R 1.1", classroom_id = "r11", sample_role = "chain_reserve",
         titular_operational_code = "CH 1", sample_status = "en_reserva",
         expected_valid = 30, respuestas_validas = 0,
         faculty = "Derecho", stratum = "Derecho"),
    # Aula que SOBRECUMPLE: el excedente no cubre la falta de la otra.
    list(operational_code = "CH 2", classroom_id = "c2", sample_role = "titular",
         sample_status = "agendada", expected_valid = 20, respuestas_validas = 26,
         faculty = "Letras", stratum = "Letras"),
    # Sin meta declarada: fuera del denominador, contada aparte.
    list(operational_code = "CH 3", classroom_id = "c3", sample_role = "titular",
         sample_status = "agendada", expected_valid = 0, respuestas_validas = 4,
         faculty = "Letras", stratum = "Letras"),
    # Banco: respaldo del estrato, no pide respuestas.
    list(operational_code = "EXTRA 1", classroom_id = "x1", sample_role = "extra_reserve_pool",
         sample_status = "en_reserva", expected_valid = 25, respuestas_validas = 0,
         faculty = "Derecho", stratum = "Derecho")
  )
  # Las validas las cuenta el MOTOR desde las respuestas, no se siembran en el
  # plan: 10 para CH 1 y 26 para CH 2, que es la que sobrecumple.
  responses <- data.frame(
    classroom_id = c(rep("c1", 10), rep("c2", 26), rep("c3", 4)),
    response_status = "completed",
    stringsAsFactors = FALSE
  )
  cfg <- list(source_mapping = list(classroom_id_var = "classroom_id", status_var = "response_status"))
  tablero <- monitoreo_aulas_dashboard(plan, responses, cfg)
  cr <- tablero$cumplimiento_respuestas
  # 30 + 20: ni la reserva dormida (30) ni el banco (25) ni la que no declara meta.
  expect_identical(as.numeric(cr$meta), 50)
  # 10 + 20: el aula que recogio 26 aporta 20, su propia meta.
  expect_identical(as.numeric(cr$cubierto), 30)
  expect_identical(as.numeric(cr$excedente), 6)
  expect_identical(as.numeric(cr$falta), 20)
  expect_identical(as.integer(cr$aulas_con_brecha), 1L)
  expect_identical(as.integer(cr$sin_meta), 1L)
})

test_that("los repartos de estado y cobertura se calculan ANTES del recorte", {
  # `course_status` viaja recortado a 500 filas y el recorte NO es una muestra al
  # azar: el orden pone `en_aplicacion` primero. Sumar los repartos sobre el
  # payload recortado daria graficos sesgados hacia lo avanzado.
  n <- MONITOREO_AULAS_COURSE_STATUS_TOPE + 40L
  plan <- lapply(seq_len(n), function(i) list(
    operational_code = sprintf("CH %d", i),
    classroom_id = sprintf("c%d", i),
    sample_role = "titular",
    sample_status = "agendada",
    # Las ultimas 40 —las que el recorte deja fuera— sin meta: si el reparto se
    # calculara sobre las 500 primeras, `sin_meta` daria 0.
    expected_valid = if (i > MONITOREO_AULAS_COURSE_STATUS_TOPE) 0 else 20,
    faculty = "Derecho", stratum = "Derecho"
  ))
  tablero <- monitoreo_aulas_dashboard(plan, responses = data.frame(), config = list())
  expect_identical(tablero$course_status_total, n)
  expect_length(tablero$course_status, MONITOREO_AULAS_COURSE_STATUS_TOPE)
  # El reparto cubre las n filas, no las 500 que viajan.
  aulas_en_estados <- sum(vapply(tablero$course_status_estados, function(e) e$aulas, integer(1)))
  expect_identical(aulas_en_estados, n)
  # Y las 40 sin meta se ven, que es justo lo que el recorte escondia.
  expect_identical(tablero$course_status_sin_meta, 40L)
})
