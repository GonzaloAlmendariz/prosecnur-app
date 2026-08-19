# EF3 fase 1 — efectividad esperada ex ante (calibración 2025, referencial).
#
# La medición que la respalda (checklist 2026-08-18): rendimiento monotónico
# por tamaño (0.80 → 0.44), P(aplicada) por tipo de docente (87% vs 73%).
# Fase 1 NO toca π ni el sorteo, y el frame_hash se sella ANTES de anotar.

test_that("p_aplicada usa la calibracion 2025 y cae a base sin señal", {
  p <- .cm_efectividad_p_aplicada(c(
    "DOCENTE CONTRATADO - CONTRATADO",
    "DOCENTE ORDINARIO - PRINCIPAL",
    "DOCENTE ORDINARIO - ASOCIADO",
    "PRE-DOCENTE - JEFE DE PRACTICA",
    ""
  ))
  expect_equal(p, c(0.87, 0.73, 0.84, 0.84, 0.84))
})

test_that("el rendimiento es monotonico por tamaño con los bins medidos", {
  r <- .cm_efectividad_rendimiento(c(10, 15, 16, 25, 26, 35, 36, 50, 51, 200))
  expect_equal(r, c(0.80, 0.80, 0.69, 0.69, 0.56, 0.56, 0.55, 0.55, 0.44, 0.44))
})

test_that("el anotador escribe las tres columnas y la identidad se cumple", {
  af <- data.frame(
    classroom_id = c("A", "B"),
    eligible_n = c(12, 60),
    teacher_type = c("DOCENTE CONTRATADO - CONTRATADO", "DOCENTE ORDINARIO - PRINCIPAL"),
    stringsAsFactors = FALSE
  )
  out <- .cm_aulas_efectividad_anotar(af)
  expect_true(all(c("p_aplicada_ref", "rendimiento_ref", "efectivas_esperadas") %in% names(out)))
  # A: 12 x 0.87 x 0.80 = 8.352 -> 8.4 ; B: 60 x 0.73 x 0.44 = 19.272 -> 19.3
  expect_equal(out$efectivas_esperadas, c(8.4, 19.3))
  # La tension medida: la chica rinde MAS en tasa, la grande aporta MAS absoluto.
  expect_gt(out$rendimiento_ref[[1]], out$rendimiento_ref[[2]])
  expect_gt(out$efectivas_esperadas[[2]], out$efectivas_esperadas[[1]])
})

test_that("frame sin eligible_n o vacio queda intacto (nunca inventa)", {
  vacio <- data.frame()
  expect_identical(.cm_aulas_efectividad_anotar(vacio), vacio)
  sin <- data.frame(classroom_id = "A", stringsAsFactors = FALSE)
  expect_false("efectivas_esperadas" %in% names(.cm_aulas_efectividad_anotar(sin)))
})

test_that("construir anota el frame SIN mover el frame_hash (firma estable)", {
  base <- data.frame(
    student_id = paste0("s", 1:40),
    aula_id = rep(c("A1", "A2"), each = 20),
    curso_id = rep(c("C1", "C2"), each = 20),
    curso = rep(c("Curso 1", "Curso 2"), each = 20),
    horario = "L 8",
    facultad = "FAC1", programa = "P1", sexo = "F", edad = 20,
    condicion = "regular", nivel = "3", modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(filters = list(min_eligible_per_class = 1L)))
  frame_real <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  expect_true(all(c("p_aplicada_ref", "rendimiento_ref", "efectivas_esperadas") %in% names(frame_real$aula_frame)))
  # El mismo build con el anotador anulado: si la anotacion participara del
  # hash, estas dos firmas divergirian y todo artefacto acreditado moriria en
  # vano. (Comparar por RE-COMPUTO externo no sirve: digest serializa bytes
  # que identical() ignora — row.names compactos/encoding — y da falso rojo.)
  testthat::local_mocked_bindings(
    .cm_aulas_efectividad_anotar = function(aula_frame) aula_frame
  )
  frame_sin <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  expect_false("efectivas_esperadas" %in% names(frame_sin$aula_frame))
  expect_identical(frame_real$frame_hash, frame_sin$frame_hash)
})

test_that("la seleccion publica las columnas de efectividad (listas cerradas vigiladas)", {
  skip_if_not_installed("sampling")
  base <- data.frame(
    student_id = paste0("s", 1:80),
    aula_id = rep(paste0("A", 1:4), each = 20),
    curso_id = rep(paste0("C", 1:4), each = 20),
    curso = rep(paste("Curso", 1:4), each = 20),
    horario = "L 8", facultad = "FAC1", programa = "P1", sexo = "F",
    edad = 20, condicion = "regular", nivel = "3", modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(seed = 77L, n_aulas = 2L, replacement_waves = 0L,
                    selector_engine = "sistematico_pps", strata_cols = list("facultad"),
                    monte_carlo_n = 0L, simulation_runs = 0L)
  ))
  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  sel <- calc_muestra_aulas_seleccionar(frame, cfg)
  expect_true(all(c("p_aplicada_ref", "rendimiento_ref", "efectivas_esperadas") %in% names(sel$selection)))
  expect_true(all(is.finite(sel$selection$efectivas_esperadas)))
})
