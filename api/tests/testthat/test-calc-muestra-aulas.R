test_that("calc-muestra aulas construye el mismo marco desde base madre o dos bases", {
  estudiantes <- data.frame(
    student_id = paste0("s", 1:6),
    facultad = c("FAC1", "FAC1", "FAC1", "FAC2", "FAC2", "FAC2"),
    programa = c("P1", "P1", "P2", "P3", "P3", "P3"),
    sexo = c("F", "M", "F", "M", "F", "M"),
    edad = c(18, 19, 20, 18, 21, 22),
    condicion = "regular",
    nivel = "pregrado",
    stringsAsFactors = FALSE
  )
  inscripciones <- data.frame(
    student_id = c("s1", "s2", "s3", "s3", "s4", "s5", "s6"),
    aula_id = c("A1", "A1", "A1", "A2", "A2", "A2", "A2"),
    curso_id = c("C1", "C1", "C1", "C2", "C2", "C2", "C2"),
    curso = c("Curso 1", "Curso 1", "Curso 1", "Curso 2", "Curso 2", "Curso 2", "Curso 2"),
    horario = c("L 8", "L 8", "L 8", "M 10", "M 10", "M 10", "M 10"),
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  base_madre <- merge(inscripciones, estudiantes, by = "student_id", all.x = TRUE, sort = FALSE)
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(n_aulas = 2L, strata_cols = list("facultad"))
  ))

  frame_madre <- calc_muestra_aulas_construir(base_madre = base_madre, config = cfg)
  frame_dos <- calc_muestra_aulas_construir(estudiantes = estudiantes, inscripciones = inscripciones, config = cfg)

  a <- frame_madre$aula_frame[order(frame_madre$aula_frame$classroom_id), c("classroom_id", "eligible_n", "course_id", "faculty")]
  b <- frame_dos$aula_frame[order(frame_dos$aula_frame$classroom_id), c("classroom_id", "eligible_n", "course_id", "faculty")]
  rownames(a) <- NULL
  rownames(b) <- NULL
  expect_equal(a, b)
  expect_equal(frame_madre$audit$value[frame_madre$audit$metric == "population_n"], "6")
  expect_false(frame_madre$relation_audit$used)
  expect_equal(frame_madre$relation_audit$status, "sin_catalogo")
})

test_that("M1 usa min(n_aulas, marco elegible) sin truncar el target configurado", {
  base <- data.frame(
    student_id = paste0("s", 1:6),
    aula_id = rep(paste0("A", 1:3), each = 2),
    curso_id = rep(paste0("C", 1:3), each = 2),
    curso = rep(paste("Curso", 1:3), each = 2),
    horario = rep(c("L 8", "M 10", "J 12"), each = 2),
    facultad = "FAC1",
    programa = "P1",
    sexo = rep(c("F", "M"), 3),
    edad = 20,
    condicion = "regular",
    nivel = "pregrado",
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(
      seed = 42L,
      n_aulas = 5L,
      replacement_waves = 0L,
      selector_engine = "sistematico_pps",
      simulation_runs = 0L,
      monte_carlo_n = 0L,
      strata_cols = list("facultad")
    )
  ))

  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  selection <- calc_muestra_aulas_seleccionar(frame, cfg)

  expect_identical(selection$selector$n_aulas, 5L)
  expect_equal(sum(selection$selection$wave == "M1"), nrow(frame$aula_frame))
  expect_equal(nrow(frame$aula_frame), 3L)
})

test_that("marco resume aulas con pares coherentes de facultad y carrera", {
  pair_faculty <- c(rep("FAC_A", 9), rep("FAC_B", 8))
  pair_program <- c(rep("PROG_X1", 3), rep("PROG_X2", 3), rep("PROG_X3", 3), rep("PROG_Y", 8))
  base <- data.frame(
    student_id = paste0("s", seq_along(pair_faculty)),
    aula_id = "A1",
    curso_id = "C1",
    curso = "Curso 1",
    horario = "H1",
    facultad = pair_faculty,
    programa = pair_program,
    sexo = rep(c("F", "M"), length.out = length(pair_faculty)),
    edad = 20,
    condicion = "regular",
    nivel = "1",
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(filters = list(min_eligible_per_class = 1L)))

  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)

  expect_equal(nrow(frame$aula_frame), 1)
  expect_equal(frame$aula_frame$faculty[[1]], "FAC_A")
  expect_equal(frame$aula_frame$program[[1]], "PROG_X1")
})

test_that("dos bases prioriza facultad y carrera del estudiante sobre las del curso", {
  estudiantes <- data.frame(
    student_id = paste0("s", 1:6),
    Facultad = "CIENCIAS SOCIALES",
    Carrera = "CIENCIA POLITICA Y GOBIERNO",
    Sexo = rep(c("F", "M"), length.out = 6),
    Edad = 20,
    Condicion = "regular",
    `Nivel según créditos` = "5",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  inscripciones <- data.frame(
    student_id = paste0("s", 1:6),
    aula_id = "A1",
    Curso = "ART101",
    Horario = "0501",
    Facultad = "ARTES ESCENICAS",
    Carrera = "DANZA",
    Modalidad = "PRESENCIAL",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(filters = list(min_eligible_per_class = 1L)))

  frame <- calc_muestra_aulas_construir(
    estudiantes = estudiantes,
    inscripciones = inscripciones,
    config = cfg
  )

  expect_true(all(frame$population$faculty == "CIENCIAS SOCIALES"))
  expect_true(all(frame$population$program == "CIENCIA POLITICA Y GOBIERNO"))
  expect_equal(frame$aula_frame$faculty[[1]], "CIENCIAS SOCIALES")
  expect_equal(frame$aula_frame$program[[1]], "CIENCIA POLITICA Y GOBIERNO")

  faculty_program <- frame$population_cross_profiles[
    frame$population_cross_profiles$primary_role == "faculty" &
      frame$population_cross_profiles$secondary_role == "program",
    ,
    drop = FALSE
  ]
  expect_true(any(
    faculty_program$primary_raw == "CIENCIAS SOCIALES" &
      faculty_program$secondary_raw == "CIENCIA POLITICA Y GOBIERNO"
  ))
  expect_false(any(
    faculty_program$primary_raw == "ARTES ESCENICAS" &
      faculty_program$secondary_raw == "CIENCIA POLITICA Y GOBIERNO"
  ))
})

test_that("marco reconoce columnas institucionales tipo PUCP 2025", {
  base <- data.frame(
    `Código PUCP` = paste0("20", 1:20),
    Facultad = rep(c("DERECHO", "PSICOLOGÍA"), each = 10),
    Carrera = rep(c("Derecho", "Psicología"), each = 10),
    `Nivel curricular` = "pregrado",
    Condición = "regular",
    Sexo = rep(c("F", "M"), length.out = 20),
    Edad = 20,
    Curso = rep(c("DER101", "PSI101"), each = 10),
    `Nombre del curso` = rep(c("Derecho Constitucional", "Psicología Social"), each = 10),
    Horario = rep(c("0201", "0301"), each = 10),
    `Sesiones y aula` = rep(c("LUN 08:00-10:00 C D101", "MAR 10:00-12:00 C P202"), each = 10),
    `Modalidad ` = "PRESENCIAL",
    `Tipo Curso` = "TEORICO",
    `Condición del curso` = "",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(filters = list(min_eligible_per_class = 1L)))
  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)

  expect_equal(nrow(frame$population), 20)
  expect_equal(nrow(frame$aula_frame), 2)
  expect_true(all(c("DER101", "PSI101") %in% frame$aula_frame$course_id))
  expect_true(all(c("Derecho Constitucional", "Psicología Social") %in% frame$aula_frame$course_name))
  expect_true(all(grepl(" C ", frame$aula_frame$label, fixed = TRUE)))
})

test_that("marco prioriza nivel curricular cuando existe junto a nivel segun creditos", {
  # Acuerdo metodológico 2026-07-15: "el nivel curricular manda; créditos es
  # apoyo". Este test fijaba antes la prioridad inversa (créditos primero); la
  # reunión con el asesor muestral la revirtió deliberadamente.
  base <- data.frame(
    `Código PUCP` = paste0("20", 1:8),
    Facultad = "ESTUDIOS GENERALES LETRAS",
    Carrera = "LETRAS",
    `Nivel curricular` = "1",
    `Nivel según créditos` = rep(c("1", "2", "3", "4"), each = 2),
    Condición = "regular",
    Sexo = rep(c("F", "M"), length.out = 8),
    Edad = 20,
    Curso = rep(c("LET101", "LET102"), each = 4),
    Horario = rep(c("0201", "0301"), each = 4),
    Modalidad = "PRESENCIAL",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(filters = list(min_eligible_per_class = 1L)))

  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)

  # Todos los estudiantes reportan el nivel CURRICULAR ("1"), no el rango 1-4
  # de créditos.
  expect_equal(unique(frame$population$level), "1")
  level_profile <- frame$category_profiles[frame$category_profiles$role == "level", c("raw", "count")]
  expect_equal(level_profile$count[level_profile$raw == "1"], 8L)
})

test_that("marco complementa docentes desde catalogo curso-horario", {
  base <- data.frame(
    `Código PUCP` = paste0("20", 1:8),
    `Correo Pucp` = paste0("est", 1:8, "@example.test"),
    Facultad = rep(c("DERECHO", "PSICOLOGÍA"), each = 4),
    Carrera = rep(c("Derecho", "Psicología"), each = 4),
    `Nivel curricular` = "pregrado",
    Condición = "regular",
    Sexo = rep(c("F", "M"), length.out = 8),
    Edad = 20,
    Curso = rep(c("DER101", "PSI101"), each = 4),
    `Nombre del curso` = rep(c("Derecho Constitucional", "Psicología Social"), each = 4),
    Horario = rep(c("0201", "0301"), each = 4),
    Modalidad = "PRESENCIAL",
    `Tipo Curso` = "TEORICO",
    `Condición del curso` = "",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  catalogo <- data.frame(
    `Curso-Horario` = c("DER101-0201", "PSI101-0301"),
    Curso = c("DER101", "PSI101"),
    `Nombre del curso` = c("Derecho Constitucional", "Psicología Social"),
    Horario = c("0201", "0301"),
    Facultad = c("DERECHO", "PSICOLOGÍA"),
    Carrera = c("Derecho", "Psicología"),
    Modalidad = "PRESENCIAL",
    Matriculados = c(40, 35),
    Docente = c("0001", "0002"),
    `Nombre de docente` = c("Docente A", "Docente B"),
    `Correo PUCP` = c("docente.a@example.test", "docente.b@example.test"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(filters = list(min_eligible_per_class = 1L)))

  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    catalogo_curso_horario = catalogo,
    config = cfg
  )

  expect_equal(sort(frame$aula_frame$teacher), c("Docente A", "Docente B"))
  expect_equal(sort(frame$aula_frame$teacher_email), c("docente.a@example.test", "docente.b@example.test"))
  expect_false(any(grepl("^est[0-9]+@", frame$aula_frame$teacher_email)))
  expect_equal(frame$catalog_audit$matched_classrooms, 2L)
  expect_equal(frame$relation_audit$status, "ok")
  expect_equal(frame$relation_audit$matched_classrooms, 2L)
  expect_equal(frame$relation_audit$unmatched_base_classrooms, 0L)
  expect_equal(frame$relation_audit$match_rate_classrooms, 1)
})

test_that("marco advierte cuando base y catalogo no empatan completamente", {
  base <- data.frame(
    `Código PUCP` = paste0("20", 1:8),
    Facultad = rep(c("DERECHO", "PSICOLOGÍA"), each = 4),
    Carrera = rep(c("Derecho", "Psicología"), each = 4),
    `Nivel curricular` = "pregrado",
    Condición = "regular",
    Sexo = rep(c("F", "M"), length.out = 8),
    Edad = 20,
    Curso = rep(c("DER101", "PSI101"), each = 4),
    Horario = rep(c("0201", "0301"), each = 4),
    Modalidad = "PRESENCIAL",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  catalogo <- data.frame(
    Curso = c("DER101", "ARQ999"),
    Horario = c("0201", "9999"),
    `Nombre de docente` = c("Docente A", "Docente fuera de base"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(filters = list(min_eligible_per_class = 1L)))

  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    catalogo_curso_horario = catalogo,
    config = cfg
  )

  expect_equal(frame$relation_audit$status, "critico")
  expect_equal(frame$relation_audit$matched_classrooms, 1L)
  expect_equal(frame$relation_audit$unmatched_base_classrooms, 1L)
  expect_equal(frame$relation_audit$catalog_only_classrooms, 1L)
  expect_true(any(grepl("problemas criticos", unlist(frame$warnings), fixed = TRUE)))
})

test_that("marco marca revisar cuando el catalogo deja una brecha no critica", {
  base <- data.frame(
    `Código PUCP` = paste0("20", 1:10),
    Facultad = "CIENCIAS",
    Carrera = "ESTADISTICA",
    `Nivel curricular` = "pregrado",
    Condición = "regular",
    Sexo = rep(c("F", "M"), 5),
    Edad = 20,
    Curso = rep(paste0("EST", 1:5), each = 2),
    Horario = rep(paste0("H", 1:5), each = 2),
    Modalidad = "PRESENCIAL",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  catalogo <- data.frame(
    Curso = paste0("EST", 1:4),
    Horario = paste0("H", 1:4),
    `Nombre de docente` = paste("Docente", 1:4),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(filters = list(min_eligible_per_class = 1L)))

  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    catalogo_curso_horario = catalogo,
    config = cfg
  )

  expect_true(frame$relation_audit$used)
  expect_equal(frame$relation_audit$status, "revisar")
  expect_equal(frame$relation_audit$match_rate_classrooms, 0.8)
  expect_true("aulas_base_sin_catalogo" %in% frame$relation_audit$issues$code)
})

test_that("lector de Excel permite elegir hoja especifica", {
  skip_if_not_installed("openxlsx")
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Resumen")
  openxlsx::writeData(wb, "Resumen", data.frame(no = 1))
  openxlsx::addWorksheet(wb, "MATRICULADO")
  openxlsx::writeData(wb, "MATRICULADO", data.frame(`Código PUCP` = "2001", Curso = "DER101", check.names = FALSE))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)

  out <- .cm_aulas_read_table(path, sheet = "MATRICULADO")
  expect_equal(names(out), c("Código PUCP", "Curso"))
  expect_equal(out$Curso[[1]], "DER101")
})

test_that("selector de aulas no selecciona por filas alumno-curso y penaliza repetidos", {
  base <- data.frame(
    student_id = c(paste0("s", 1:8), paste0("s", 5:12), paste0("s", 13:17)),
    aula_id = c(rep("A1", 8), rep("A2", 8), rep("A3", 5)),
    curso_id = c(rep("C1", 8), rep("C2", 8), rep("C3", 5)),
    curso = c(rep("Curso 1", 8), rep("Curso 2", 8), rep("Curso 3", 5)),
    horario = c(rep("L 8", 8), rep("M 10", 8), rep("J 12", 5)),
    facultad = "FAC1",
    programa = "P1",
    sexo = "F",
    edad = 20,
    condicion = "regular",
    nivel = "pregrado",
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(
      seed = 42L,
      n_aulas = 2L,
      replacement_waves = 0L,
      selector_engine = "pool_controlado",
      candidate_pool_size = 40L,
      simulation_runs = 40L,
      monte_carlo_n = 40L,
      strata_cols = list("facultad"),
      duplicate_penalty = 3
    )
  ))
  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  selection <- calc_muestra_aulas_seleccionar(frame, cfg)
  selected_ids <- selection$selection$classroom_id

  expect_length(unique(selected_ids), 2)
  expect_true("A3" %in% selected_ids)
  expect_lte(sum(selection$selection$duplicate_overlap, na.rm = TRUE), 1)
  expect_true(all(selection$selection$pi_base > 0 & selection$selection$pi_base <= 1))
  expect_true(all(selection$selection$probability_source == "monte_carlo_after_optimization"))
  expect_equal(selection$selection$pi_final, selection$selection$pi_mc)
})

test_that("seleccion de aulas produce auditoria metodologica, pesos y workbook defendible", {
  skip_if_not_installed("openxlsx")
  base <- data.frame(
    student_id = paste0("s", rep(1:48, each = 1)),
    aula_id = rep(paste0("A", 1:8), each = 6),
    curso_id = rep(paste0("C", 1:8), each = 6),
    curso = rep(paste("Curso", 1:8), each = 6),
    horario = rep(c("L 8", "M 10", "J 12", "V 16"), each = 6, length.out = 48),
    facultad = rep(c("FAC1", "FAC2"), each = 24),
    programa = rep(c("P1", "P2", "P3", "P4"), each = 12),
    sexo = rep(c("F", "M"), length.out = 48),
    edad = 20,
    condicion = "regular",
    nivel = "pregrado",
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(
      seed = 111L,
      n_aulas = 4L,
      replacement_waves = 1L,
      selector_engine = "cube_balanceado",
      strata_cols = list("facultad"),
      balance_vars = list("faculty", "program", "sex_top_1"),
      monte_carlo_n = 10L
    )
  ))
  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  selection <- calc_muestra_aulas_seleccionar(frame, cfg)

  expect_true("classroom_cluster" %in% selection$methodological_sources$decision_id)
  expect_true("cube_balanced" %in% selection$methodological_sources$decision_id)
  expect_true(all(c("pi_base", "pi_design", "pi_final", "weight_classroom", "pi_student", "weight_student") %in% names(selection$selection)))
  expect_false("student_id" %in% names(selection$selection))
  expect_equal(selection$selection$weight_classroom, round(1 / selection$selection$pi_final, 6), tolerance = 1e-8)
  expect_true(is.list(selection$representativity))
  expect_true(is.numeric(selection$representativity_score))
  expect_true(nrow(selection$diagnostics$representativity_metrics) > 0)
  expect_true(nrow(selection$diagnostics$profile_distributions) > 0)
  expect_true(nrow(selection$diagnostics$balance) > 0)
  expect_true(nrow(selection$diagnostics$systematic_comparison) > 0)

  path <- tempfile(fileext = ".xlsx")
  calc_muestra_aulas_exportar_workbook(frame, selection, path)
  sheets <- openxlsx::getSheetNames(path)
  expect_true(all(c(
    "Aulas titulares",
    "Reemplazos por titular",
    "Reserva extra",
    "Sustento metodológico",
    "Perfil del marco",
    "Perfil seleccionado",
    "Score de representatividad",
    "Cobertura y solape",
    "Reservas por ola",
    "Probabilidades y pesos",
    "Diagnóstico de balance",
    "Olas coordinadas",
    "No respuesta",
    "Comparación con sistemático"
  ) %in% sheets))
})

test_that("seleccion de aulas arma cadenas de reemplazo por titular y reserva extra", {
  base <- data.frame(
    student_id = paste0("s", 1:70),
    aula_id = rep(paste0("A", 1:14), each = 5),
    curso_id = rep(paste0("C", 1:14), each = 5),
    curso = rep(paste("Curso", 1:14), each = 5),
    horario = rep(c("mañana", "tarde", "noche"), length.out = 70),
    facultad = rep(rep(c("FAC1", "FAC2"), each = 35), length.out = 70),
    programa = rep(c("P1", "P2", "P3", "P4"), length.out = 70),
    sexo = rep(c("F", "M"), length.out = 70),
    edad = 20,
    condicion = "regular",
    nivel = rep(c("1", "2"), length.out = 70),
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(
      seed = 515L,
      n_aulas = 4L,
      replacement_waves = 2L,
      selector_engine = "sistematico_pps",
      strata_cols = list("faculty"),
      balance_vars = list("faculty", "program", "level"),
      monte_carlo_n = 10L
    )
  ))
  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  selection <- calc_muestra_aulas_seleccionar(frame, cfg)
  rows <- .cm_aulas_as_df(selection$selection)

  titulars <- rows[rows$sample_role == "titular", , drop = FALSE]
  reserves <- rows[rows$sample_role == "chain_reserve", , drop = FALSE]
  extra <- rows[rows$sample_role == "extra_reserve_pool", , drop = FALSE]

  expect_equal(nrow(titulars), 4)
  expect_true(all(nzchar(titulars$selection_slot_id)))
  expect_true("operational_code" %in% names(rows))
  expect_equal(length(unique(rows$operational_code[nzchar(rows$operational_code)])), sum(nzchar(rows$operational_code)))
  expect_true(all(grepl("^CH [0-9]+$", titulars$operational_code)))
  expect_true(all(reserves$replacement_for %in% titulars$classroom_id))
  expect_true(all(reserves$selection_slot_id %in% titulars$selection_slot_id))
  expect_true(all(grepl("^R [0-9]+\\.[0-9]+$", reserves$operational_code)))
  expect_true(all(reserves$titular_operational_code %in% titulars$operational_code))
  expect_equal(length(unique(reserves$classroom_id)), nrow(reserves))
  expect_true(all(table(reserves$replacement_for) <= 2L))
  expect_gt(nrow(extra), 0)
  expect_true(all(extra$probability_source == "extra_pool_not_selected"))
  expect_true(all(is.na(extra$weight_classroom)))
  expect_true(nrow(selection$diagnostics$replacement_chains) >= nrow(titulars))
  expect_true(nrow(selection$diagnostics$extra_reserve_pool) == nrow(extra))
})

test_that("local pivotal registra fallback cuando BalancedSampling no esta disponible", {
  base <- data.frame(
    student_id = paste0("s", 1:24),
    aula_id = rep(paste0("A", 1:6), each = 4),
    curso_id = rep(paste0("C", 1:6), each = 4),
    curso = rep(paste("Curso", 1:6), each = 4),
    horario = rep(c("L 8", "M 10", "J 12"), each = 4, length.out = 24),
    facultad = rep(c("FAC1", "FAC2"), each = 12),
    programa = rep(c("P1", "P2"), each = 12),
    sexo = rep(c("F", "M"), length.out = 24),
    edad = 20,
    condicion = "regular",
    nivel = "pregrado",
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(
      seed = 7L,
      n_aulas = 3L,
      replacement_waves = 0L,
      selector_engine = "local_pivotal_balanceado",
      strata_cols = list("facultad"),
      monte_carlo_n = 0L
    )
  ))
  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  selection <- calc_muestra_aulas_seleccionar(frame, cfg)

  expect_equal(selection$selector_engine, "local_pivotal_balanceado")
  if (!requireNamespace("BalancedSampling", quietly = TRUE)) {
    expect_true(any(grepl("fallback|no disponible|fallo", unlist(selection$methodological_warning), ignore.case = TRUE)))
  }
  expect_true(all(is.finite(selection$selection$weight_classroom)))
})

test_that("normalizador acepta configuracion plana de UI", {
  cfg <- calc_muestra_aulas_normalize_config(list(
    selector = "pool_controlado",
    selector_engine = "pool_controlado",
    min_elegibles_aula = 12L,
    bolsas_reemplazo = 5L,
    estratos_selector = list("faculty", "program"),
    balance_vars = list("faculty", "program", "level"),
    spread_vars = list("schedule"),
    candidate_pool_size = 33L,
    simulation_runs = 44L,
    semilla = 123L,
    penalizacion_repetidos = 2.5
  ))

  expect_equal(cfg$filters$min_eligible_per_class, 12L)
  expect_equal(cfg$selector$selector_engine, "pool_controlado")
  expect_equal(cfg$selector$replacement_waves, 5L)
  expect_equal(unlist(cfg$selector$strata_cols), c("faculty", "program"))
  expect_equal(unlist(cfg$selector$balance_vars), c("faculty", "program", "level"))
  expect_equal(unlist(cfg$selector$spread_vars), "schedule")
  expect_equal(cfg$selector$candidate_pool_size, 33L)
  expect_equal(cfg$selector$simulation_runs, 44L)
  expect_equal(cfg$selector$seed, 123L)
  expect_equal(cfg$selector$duplicate_penalty, 2.5)
})

test_that("laboratorio compara cuatro motores con métricas y riesgos", {
  base <- data.frame(
    student_id = c(paste0("s", 1:60), paste0("s", 1:10)),
    aula_id = c(rep(paste0("A", 1:10), each = 6), rep(c("A1", "A2"), each = 5)),
    curso_id = c(rep(paste0("C", 1:10), each = 6), rep(c("C1", "C2"), each = 5)),
    curso = c(rep(paste("Curso", 1:10), each = 6), rep(c("Curso 1", "Curso 2"), each = 5)),
    horario = rep(c("mañana", "tarde", "noche"), length.out = 70),
    facultad = rep(c("FAC1", "FAC2"), length.out = 70),
    programa = rep(c("P1", "P2", "P3", "P4"), length.out = 70),
    sexo = rep(c("F", "M"), length.out = 70),
    edad = 20,
    condicion = "regular",
    nivel = rep(c("1", "2", "3"), length.out = 70),
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(
      seed = 101L,
      n_aulas = 4L,
      replacement_waves = 1L,
      strata_cols = list("faculty"),
      balance_vars = list("faculty", "program", "level", "schedule"),
      candidate_pool_size = 20L,
      simulation_runs = 100L,
      monte_carlo_n = 100L
    )
  ))
  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  comparison <- calc_muestra_aulas_comparar_metodos(frame, cfg, simulation_runs = 100L)

  expect_identical(comparison$selector$n_aulas, 4L)
  expect_identical(
    comparison$selector$schema,
    "calc_muestra_aulas_method_comparison_selector_v1"
  )
  expect_true(comparison$selector$sequential_discount)
  expect_identical(comparison$selector$objective, comparison$objective_config)
  method_ids <- vapply(comparison$methods, function(row) row$method_id, character(1))
  expect_true(all(c("sistematico_pps", "cube_balanceado", "local_pivotal_balanceado", "pool_controlado") %in% method_ids))
  expect_true(all(vapply(comparison$methods, function(row) all(c(
    "balance_score", "repeated_students", "coverage_unique_pct", "overall_score", "representativity_score",
    "representativity_distance", "probability_source"
  ) %in% names(row)), logical(1))))
  pool <- comparison$methods[[which(method_ids == "pool_controlado")]]
  expect_equal(pool$probability_source, "monte_carlo_after_optimization")
  expect_true(is.list(comparison$objective_config))
  expect_true(nrow(comparison$representativity_metrics) > 0)
  expect_true(nrow(comparison$frame_profiles) > 0)
  expect_true(length(comparison$simulation_summary) >= 4)
  expect_true(nrow(comparison$risk_flags) > 0)
  expect_true(nzchar(comparison$recommendation$method_id))
})

test_that("simulador de reemplazos sugiere reservas equivalentes e impacto", {
  base <- data.frame(
    student_id = paste0("s", 1:72),
    aula_id = rep(paste0("A", 1:12), each = 6),
    curso_id = rep(paste0("C", 1:12), each = 6),
    curso = rep(paste("Curso", 1:12), each = 6),
    horario = rep(c("mañana", "tarde", "noche"), length.out = 72),
    facultad = rep(c("FAC1", "FAC2"), each = 36),
    programa = rep(c("P1", "P2", "P3"), each = 24),
    sexo = rep(c("F", "M"), length.out = 72),
    edad = 20,
    condicion = "regular",
    nivel = rep(c("1", "2"), length.out = 72),
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(
      seed = 202L,
      n_aulas = 4L,
      replacement_waves = 2L,
      selector_engine = "cube_balanceado",
      strata_cols = list("faculty"),
      balance_vars = list("faculty", "program", "level"),
      monte_carlo_n = 20L
    )
  ))
  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  selection <- calc_muestra_aulas_seleccionar(frame, cfg)
  replacement <- calc_muestra_aulas_simular_reemplazos(frame, selection, cfg)

  expect_true(nrow(replacement$suggestions) > 0)
  expect_true(all(c(
    "titular_classroom_id", "reserve_classroom_id", "rank", "match_level", "score",
    "before_score", "after_score", "score_delta"
  ) %in% names(replacement$suggestions)))
  expect_true(nrow(replacement$impact) > 0)
  expect_true(all(c("before_score", "after_score", "score_delta") %in% names(replacement$impact)))
  expect_true(any(replacement$suggestions$match_level %in% c("misma_celda", "celda_equivalente")))
})

test_that("workbook del laboratorio contiene comparador, riesgos y reemplazos", {
  skip_if_not_installed("openxlsx")
  base <- data.frame(
    student_id = paste0("s", 1:48),
    aula_id = rep(paste0("A", 1:8), each = 6),
    curso_id = rep(paste0("C", 1:8), each = 6),
    curso = rep(paste("Curso", 1:8), each = 6),
    horario = rep(c("mañana", "tarde"), length.out = 48),
    facultad = rep(c("FAC1", "FAC2"), each = 24),
    programa = rep(c("P1", "P2"), each = 24),
    sexo = rep(c("F", "M"), length.out = 48),
    edad = 20,
    condicion = "regular",
    nivel = "pregrado",
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(seed = 303L, n_aulas = 3L, replacement_waves = 1L, strata_cols = list("faculty"), monte_carlo_n = 10L)
  ))
  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  selection <- calc_muestra_aulas_seleccionar(frame, cfg)
  comparison <- calc_muestra_aulas_comparar_metodos(frame, cfg, simulation_runs = 20L)
  replacement <- calc_muestra_aulas_simular_reemplazos(frame, selection, cfg)
  path <- tempfile(fileext = ".xlsx")
  calc_muestra_aulas_exportar_workbook(frame, selection, path, comparison = comparison, replacement_simulation = replacement)
  sheets <- openxlsx::getSheetNames(path)
  expect_true(all(c(
    "Aulas titulares",
    "Reemplazos por titular",
    "Reserva extra",
    "Comparador de métodos",
    "Perfil del marco",
    "Perfil seleccionado",
    "Score de representatividad",
    "Simulaciones",
    "Cobertura y solape",
    "Reservas por ola",
    "Probabilidades y pesos",
    "Sustento metodológico",
    "Riesgos metodológicos",
    "Reemplazos sugeridos",
    "Impacto de reemplazos"
  ) %in% sheets))
})

test_that("demo universitaria 2025 carga marco, seleccion y reemplazos sin PII", {
  demo <- calc_muestra_aulas_demo_hsvg_2025()
  frame <- .cm_aulas_as_df(demo$frame$aula_frame)
  selection <- .cm_aulas_as_df(demo$selection$selection)
  suggestions <- .cm_aulas_as_df(demo$replacement_simulation$suggestions)

  expect_equal(nrow(frame), 1097)
  expect_equal(demo$frame$population_n, 22037)
  expect_equal(sum(selection$wave == "M1"), 170)
  expect_equal(sum(selection$wave != "M1"), 927)
  expect_equal(sum(selection$operation_status == "aplicada"), 192)
  expect_equal(sum(selection$used_as_replacement %in% TRUE), 49)
  expect_equal(nrow(.cm_aulas_as_df(demo$method_comparison$methods)), 4)
  expect_identical(demo$method_comparison$selector$n_aulas, 170L)
  expect_identical(
    demo$method_comparison$selector$schema,
    "calc_muestra_aulas_method_comparison_selector_v1"
  )
  expect_identical(
    demo$method_comparison$selector$objective,
    demo$method_comparison$objective_config
  )
  expect_equal(demo$method_comparison$recommendation$method_id, "cube_balanceado")
  expect_true(nrow(suggestions) >= 170)
  expect_true(all(!nzchar(frame$teacher)))
  expect_true(all(!nzchar(frame$teacher_email)))
  expect_false("student_id" %in% names(selection))
  expect_true(all(grepl("^demo2025_", frame$unique_student_ids)))
  expect_true(all(is.finite(selection$weight_classroom[selection$wave == "M1"])))
})

# --- Blindaje de caracterizacion ("golden") --------------------------------
# Congela la salida del motor de seleccion producida por el codigo pre-refactor
# (ver api/tools/gen_golden_aulas.R). Cualquier cambio de aula elegida, orden o
# score tras el refactor de performance O(n^2) rompe estos tests. Fixtures y
# captura viven en helper-golden-aulas.R (compartidos con el generador).
# Requieren el paquete `sampling` (Suggests): sin el, el motor cae al fallback
# sample(prob = ) y la seleccion entera cambia con la misma semilla.

test_that("golden: seleccion de cadenas es identica al snapshot (seed 515)", {
  skip_if_not_installed("sampling")
  gp <- golden_path("cadenas")
  skip_if_not(file.exists(gp), "Falta golden cadenas.rds; corre api/tools/gen_golden_aulas.R")
  f <- golden_fixture_cadenas()
  frame <- calc_muestra_aulas_construir(base_madre = f$base, config = f$cfg)
  selection <- calc_muestra_aulas_seleccionar(frame, f$cfg)
  expect_identical(golden_capture_selection(selection), readRDS(gp))
})

test_that("golden: simulacion de reemplazos es identica al snapshot (seed 202)", {
  skip_if_not_installed("sampling")
  gp <- golden_path("simulacion")
  skip_if_not(file.exists(gp), "Falta golden simulacion.rds; corre api/tools/gen_golden_aulas.R")
  f <- golden_fixture_simulacion()
  frame <- calc_muestra_aulas_construir(base_madre = f$base, config = f$cfg)
  selection <- calc_muestra_aulas_seleccionar(frame, f$cfg)
  replacement <- calc_muestra_aulas_simular_reemplazos(frame, selection, f$cfg)
  expect_identical(golden_capture_sim(replacement), readRDS(gp))
})

test_that("golden: seleccion a escala con empates es identica al snapshot (150 aulas)", {
  skip_if_not_installed("sampling")
  gp <- golden_path("escala")
  skip_if_not(file.exists(gp), "Falta golden escala.rds; corre api/tools/gen_golden_aulas.R")
  f <- golden_fixture_escala()
  frame <- calc_muestra_aulas_construir(base_madre = f$base, config = f$cfg)
  selection <- calc_muestra_aulas_seleccionar(frame, f$cfg)
  expect_identical(golden_capture_selection(selection), readRDS(gp))
})
