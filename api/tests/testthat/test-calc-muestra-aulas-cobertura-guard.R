# Guard F12 de cobertura (inspección calc-muestra 2026-07-14): si la columna
# de student_id existe pero llega vacía (o un round-trip pierde
# unique_student_ids del aula_frame), la cadena unique_covered==0 →
# coverage_efficiency==0 reportaba COBERTURA 0/100 en los 4 métodos como si la
# selección fuera pésima. La cobertura no medible debe viajar NA con warning
# estructurado, nunca 0.

test_that("cobertura NA (no 0) cuando el marco no trae ids parseables", {
  af <- data.frame(
    classroom_id = c("A1", "A2", "A3"),
    eligible_n = c(10, 12, 8),
    unique_student_ids = "",
    stringsAsFactors = FALSE
  )
  sel <- data.frame(
    classroom_id = c("A1", "A2"),
    wave = "M1",
    eligible_n = c(10, 12),
    unique_student_ids = "",
    stringsAsFactors = FALSE
  )
  cov <- .cm_aulas_coverage_overlap(af, sel)
  expect_true(is.na(cov$value[cov$metric == "coverage_efficiency"]))
  expect_true(is.na(cov$value[cov$metric == "duplicate_loss"]))
  expect_true(is.na(cov$value[cov$metric == "coverage_population_pct"]))
  expect_true(is.na(cov$score[cov$metric == "coverage_efficiency"]))
  expect_true(is.na(cov$score[cov$metric == "duplicate_loss"]))
  guard <- attr(cov, "coverage_guard")
  expect_true(is.list(guard))
  expect_identical(guard$code, "cobertura_ids_no_parseables")
  expect_identical(guard$aulas_con_elegibles, 3L)
  expect_identical(guard$aulas_sin_ids, 3L)
  expect_equal(guard$share_sin_ids, 1)
})

test_that("con ids sanos la cobertura se calcula igual que siempre (sin guard)", {
  af <- data.frame(
    classroom_id = c("A1", "A2"),
    eligible_n = c(2, 2),
    unique_student_ids = c("s1|s2", "s3|s4"),
    stringsAsFactors = FALSE
  )
  sel <- af
  sel$wave <- "M1"
  cov <- .cm_aulas_coverage_overlap(af, sel)
  expect_equal(cov$value[cov$metric == "coverage_efficiency"], 1)
  expect_equal(cov$value[cov$metric == "coverage_population_pct"], 1)
  expect_null(attr(cov, "coverage_guard"))
})

test_that("una minoría de aulas sin ids (<80%) no dispara el guard", {
  af <- data.frame(
    classroom_id = c("A1", "A2", "A3"),
    eligible_n = c(2, 2, 2),
    unique_student_ids = c("s1|s2", "s3|s4", ""),
    stringsAsFactors = FALSE
  )
  sel <- af[1:2, , drop = FALSE]
  sel$wave <- "M1"
  cov <- .cm_aulas_coverage_overlap(af, sel)
  expect_null(attr(cov, "coverage_guard"))
  expect_equal(cov$value[cov$metric == "coverage_efficiency"], 1)
})

test_that("la representatividad propaga el guard como warning estructurado", {
  base <- data.frame(
    student_id = sprintf("s%02d", 1:12),
    aula_id = rep(c("A1", "A2", "A3"), each = 4),
    curso = rep(c("C1", "C2", "C3"), each = 4),
    horario = "H1",
    facultad = "FAC1",
    programa = "P1",
    sexo = rep(c("F", "M"), 6),
    edad = 20,
    condicion = "regular",
    nivel = "1",
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = list(filters = list(min_eligible_per_class = 1L))
  )
  # Round-trip dañado: el aula_frame pierde los ids (repro del F12).
  frame$aula_frame$unique_student_ids <- ""
  sel <- frame$aula_frame
  sel$wave <- "M1"
  rep <- calc_muestra_aulas_representativity_objective(frame, sel)
  expect_true(is.list(rep$coverage_guard))
  expect_identical(rep$coverage_guard$code, "cobertura_ids_no_parseables")
  expect_true(any(grepl("ids", unlist(rep$warnings), fixed = TRUE)))
  cov <- rep$coverage_overlap
  expect_true(is.na(cov$value[cov$metric == "coverage_efficiency"]))
})

test_that("construir avisa cuando la columna de estudiante no trae valores", {
  base <- data.frame(
    student_id = c("", ""),
    aula_id = "A1",
    curso = "C1",
    horario = "H1",
    facultad = "FAC1",
    sexo = c("F", "M"),
    edad = 20,
    condicion = "regular",
    nivel = "1",
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = list(filters = list(min_eligible_per_class = 1L))
  )
  expect_true(any(grepl("ids parseables", unlist(frame$warnings), fixed = TRUE)))
})
