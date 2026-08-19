# EF7a — el gate de llegada de base: las novedades se declaran, no se tragan.
#
# Cada test perturba la base como lo haría la 2026 real (EF7b en miniatura):
# una facultad nueva, un tipo de sesión nuevo, un docente nuevo, un nivel
# nuevo — y el gate debe DETECTAR cada perturbación. Un gate que nunca se vio
# disparar no se sella como si funcionara.

.ll_frame <- function(extra = NULL) {
  base <- data.frame(
    classroom_id = c("A1", "A2"),
    faculty = c("DERECHO", "PSICOLOGÍA"),
    session_type = c("TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)", "TALLER"),
    teacher_type = c("DOCENTE CONTRATADO - CONTRATADO", "DOCENTE ORDINARIO - PRINCIPAL"),
    modality = "PRESENCIAL",
    course_level_num = c(3, 5),
    stringsAsFactors = FALSE
  )
  if (!is.null(extra)) base <- rbind(base, extra)
  base
}

.ll_cfg <- list(
  criterios_seleccion = list(courseLevelRanges = list(
    "DERECHO" = list(list(min = 0, max = 0), list(min = 2, max = 10)),
    "PSICOLOGÍA" = list(list(min = 2, max = 10))
  )),
  teacher_type_orden = list("docente_contratado", "docente_ordinario_principal")
)

test_that("el snapshot fotografia los valores estructurales por facultad", {
  s <- .cm_llegada_snapshot(.ll_frame())
  expect_identical(s$schema, "cm_llegada_snapshot_v1")
  expect_setequal(unlist(s$faculties), c("DERECHO", "PSICOLOGÍA"))
  expect_true("TALLER" %in% unlist(s$session_types))
  expect_equal(unlist(s$niveles_por_facultad$DERECHO), 3)
})

test_that("sin baseline el gate dice NO COMPARADO, jamas un limpio falso", {
  n <- calc_muestra_aulas_novedades(.ll_frame(), NULL, .ll_cfg)
  expect_false(n$comparado)
  expect_true(is.na(n$limpio))
})

test_that("base identica al baseline: comparado y LIMPIO", {
  base <- .cm_llegada_snapshot(.ll_frame())
  n <- calc_muestra_aulas_novedades(.ll_frame(), base, .ll_cfg)
  expect_true(n$comparado)
  expect_true(n$limpio)
  expect_length(n$bloques, 0L)
})

test_that("una facultad nueva fuera de la whitelist se declara EXCLUIDA ENTERA", {
  base <- .cm_llegada_snapshot(.ll_frame())
  nueva <- data.frame(
    classroom_id = "N1", faculty = "FACULTAD DE DATOS",
    session_type = "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)",
    teacher_type = "DOCENTE CONTRATADO - CONTRATADO", modality = "PRESENCIAL",
    course_level_num = 3, stringsAsFactors = FALSE
  )
  n <- calc_muestra_aulas_novedades(.ll_frame(nueva), base, .ll_cfg)
  expect_false(n$limpio)
  b <- Filter(function(x) x$tipo == "facultad_nueva", n$bloques)
  expect_length(b, 1L)
  v <- b[[1]]$valores[[1]]
  expect_identical(v$valor, "FACULTAD DE DATOS")
  expect_false(v$reconocida_por_rangos)
  expect_match(v$consecuencia, "EXCLUIDA ENTERA", fixed = TRUE)
})

test_that("un tipo de sesion nuevo y un docente nuevo se declaran con su gravedad", {
  base <- .cm_llegada_snapshot(.ll_frame())
  raras <- data.frame(
    classroom_id = "R1", faculty = "DERECHO",
    session_type = "METAVERSO SINCRONO",
    teacher_type = "DOCENTE HOLOGRAMA - IA", modality = "PRESENCIAL",
    course_level_num = 3, stringsAsFactors = FALSE
  )
  n <- calc_muestra_aulas_novedades(.ll_frame(raras), base, .ll_cfg)
  tipos <- vapply(n$bloques, function(x) x$tipo, character(1))
  expect_true("session_type_nuevo" %in% tipos)
  expect_true("teacher_type_nuevo" %in% tipos)
  tt <- n$bloques[[which(tipos == "teacher_type_nuevo")]]$valores[[1]]
  expect_false(tt$en_jerarquia)
})

test_that("un nivel nuevo por facultad dice si algun rango declarado lo cubre", {
  base <- .cm_llegada_snapshot(.ll_frame())
  niveles <- data.frame(
    classroom_id = c("V1", "V2"), faculty = c("DERECHO", "PSICOLOGÍA"),
    session_type = "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)",
    teacher_type = "DOCENTE CONTRATADO - CONTRATADO", modality = "PRESENCIAL",
    course_level_num = c(7, 12), stringsAsFactors = FALSE
  )
  n <- calc_muestra_aulas_novedades(.ll_frame(niveles), base, .ll_cfg)
  b <- Filter(function(x) x$tipo == "nivel_nuevo_por_facultad", n$bloques)
  expect_length(b, 1L)
  por_fac <- b[[1]]$valores
  der <- Filter(function(x) x$facultad == "DERECHO", por_fac)[[1]]
  psi <- Filter(function(x) x$facultad == "PSICOLOGÍA", por_fac)[[1]]
  # DERECHO declara 2-10: el 7 nuevo CAE DENTRO. PSICOLOGÍA declara 2-10:
  # el 12 nuevo cae FUERA — quedaria recortado sin que nadie lo diga.
  expect_true(der$niveles[[1]]$dentro_de_rango)
  expect_false(psi$niveles[[1]]$dentro_de_rango)
})

test_that("construir publica el snapshot en el payload del frame", {
  base <- data.frame(
    student_id = paste0("s", 1:40),
    aula_id = rep(c("A1", "A2"), each = 20),
    curso_id = rep(c("C1", "C2"), each = 20),
    curso = rep(c("Curso 1", "Curso 2"), each = 20),
    horario = "L 8", facultad = "FAC1", programa = "P1", sexo = "F",
    edad = 20, condicion = "regular", nivel = "3", modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(filters = list(min_eligible_per_class = 1L)))
  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  expect_identical(frame$llegada_snapshot$schema, "cm_llegada_snapshot_v1")
  expect_true(frame$llegada_snapshot$n_aulas > 0)
})

test_that("la declaracion huerfana se lista: whitelist que apunta a un fantasma no filtra nada", {
  base <- .cm_llegada_snapshot(.ll_frame())
  cfg <- .ll_cfg
  cfg$criterios_seleccion$courseLevelRanges[["FACULTAD EXTINTA"]] <- list(list(min = 2, max = 10))
  cfg$criterios_seleccion$minEligible <- list(byFaculty = list(facultad_extinta = 12))
  n <- calc_muestra_aulas_novedades(.ll_frame(), base, cfg)
  expect_false(n$limpio)
  b <- Filter(function(x) x$tipo == "declaracion_huerfana", n$bloques)
  expect_length(b, 1L)
  criterios <- vapply(b[[1]]$valores, function(v) v$criterio, character(1))
  expect_true("courseLevelRanges" %in% criterios)
  expect_true("minEligible.byFaculty" %in% criterios)
})

test_that("una declaracion por SLUG no es huerfana si la facultad vive con su label", {
  # Estreno real 2026: minEligible.byFaculty['arte_y_diseno'] marcaba huerfana
  # FALSA con "ARTE Y DISEÑO" presente — text_key no coincide con el slug.
  base <- .cm_llegada_snapshot(.ll_frame())
  frame <- .ll_frame(data.frame(
    classroom_id = "AD1", faculty = "ARTE Y DISEÑO",
    session_type = "TALLER", teacher_type = "DOCENTE CONTRATADO - CONTRATADO",
    modality = "PRESENCIAL", course_level_num = 3, stringsAsFactors = FALSE
  ))
  base2 <- .cm_llegada_snapshot(frame)
  cfg <- .ll_cfg
  cfg$criterios_seleccion$minEligible <- list(byFaculty = list(arte_y_diseno = 10))
  n <- calc_muestra_aulas_novedades(frame, base2, cfg)
  huerf <- Filter(function(x) x$tipo == "declaracion_huerfana", n$bloques)
  expect_length(huerf, 0L)
})

test_that("el workspace del estudio conserva techo, docente_unico y faculty_targets (mordida 11)", {
  est <- calc_muestra_normalize_estudio(list(workspace = list(aulas_config = list(
    techo_aulas_visitadas = 200,
    docente_unico = FALSE,
    faculty_targets = list("DERECHO" = 20, "PSICOLOGÍA" = 7)
  ))))
  cfg <- est$workspace$aulas_config
  expect_identical(cfg$techo_aulas_visitadas, 200L)
  expect_false(cfg$docente_unico)
  expect_equal(length(cfg$faculty_targets), 2L)
})
