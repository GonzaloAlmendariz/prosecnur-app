# Descuento secuencial de estudiantes repetidos entre aulas del mismo estrato
# (asesoría muestral 2026-07-15 §10). Marco sintético controlado:
#   - A1 (s1..s100) y A2 (s21..s120): dos grandes que comparten 80 alumnos.
#   - A3 (t1..t30) y A4 (u1..u30): medianas disjuntas.
# Con flag OFF el PPS puede elegir las dos grandes (120 únicos); con flag ON,
# tras elegir la primera, la segunda "grande" pesa como chica y la selección
# aporta más únicos netos (130).

descuento_base_ramiro <- function() {
  ids <- c(paste0("s", 1:100), paste0("s", 21:120), paste0("t", 1:30), paste0("u", 1:30))
  aula <- c(rep("A1", 100), rep("A2", 100), rep("A3", 30), rep("A4", 30))
  data.frame(
    student_id = ids,
    aula_id = aula,
    curso_id = paste0("C", match(aula, c("A1", "A2", "A3", "A4"))),
    curso = paste("Curso", aula),
    horario = "L 8",
    facultad = "FAC1",
    programa = "P1",
    sexo = "F",
    edad = 20,
    condicion = "regular",
    nivel = "pregrado",
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
}

descuento_cfg <- function(engine, seed = 77L, on = TRUE, n_aulas = 2L, extra = list()) {
  selector <- c(list(
    seed = seed,
    n_aulas = n_aulas,
    replacement_waves = 0L,
    selector_engine = engine,
    strata_cols = list("faculty"),
    monte_carlo_n = 0L,
    simulation_runs = 0L,
    sequential_discount = on
  ), extra)
  calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = selector
  ))
}

descuento_unicos <- function(frame, sel_ids) {
  af <- frame$aula_frame
  ids <- unlist(
    lapply(af$unique_student_ids[af$classroom_id %in% sel_ids], .cm_aulas_student_ids),
    use.names = FALSE
  )
  length(unique(ids))
}

test_that("caso Ramiro: con descuento ON la segunda grande deja de pesar y la seleccion aporta mas unicos netos", {
  skip_if_not_installed("sampling")
  base <- descuento_base_ramiro()
  frame <- calc_muestra_aulas_construir(base_madre = base, config = descuento_cfg("sistematico_pps", on = FALSE))

  off <- calc_muestra_aulas_seleccionar(frame, descuento_cfg("sistematico_pps", on = FALSE))
  on <- calc_muestra_aulas_seleccionar(frame, descuento_cfg("sistematico_pps", on = TRUE))

  # Con seed 77 el sistematico por BRUTO elige las dos grandes solapadas.
  expect_setequal(off$selection$classroom_id, c("A1", "A2"))
  # Con descuento, la segunda "grande" pesa como chica: entra una disjunta.
  unicos_off <- descuento_unicos(frame, off$selection$classroom_id)
  unicos_on <- descuento_unicos(frame, on$selection$classroom_id)
  expect_gt(unicos_on, unicos_off)
  expect_equal(sum(on$selection$aporte_neto), unicos_on)

  # Columnas de auditoria presentes solo con ON y con la identidad
  # bruto - ya_cubiertos = neto en el momento de la seleccion.
  audit_cols <- c("eligible_n_bruto", "eligible_n_neto", "aporte_neto", "ya_cubiertos", "discount_step")
  expect_false(any(audit_cols %in% names(off$selection)))
  expect_true(all(audit_cols %in% names(on$selection)))
  expect_equal(
    on$selection$eligible_n_bruto - on$selection$ya_cubiertos,
    on$selection$eligible_n_neto
  )
  expect_equal(on$selection$aporte_neto, on$selection$eligible_n_neto)

  # Bloque de contrato para el frontend.
  expect_identical(off$sequential_discount$mode, "off")
  expect_false(off$sequential_discount$requested)
  expect_identical(on$sequential_discount$mode, "sequential")
  expect_true(on$sequential_discount$applied)
  expect_identical(on$sequential_discount$warning_code, "")
  por_estrato <- on$sequential_discount$por_estrato
  expect_true(length(por_estrato) >= 1L)
  fila <- por_estrato[[1]]
  expect_equal(fila$eligible_neto_total, sum(on$selection$aporte_neto))
  expect_equal(fila$eligible_bruto_total - fila$ya_cubiertos_total, fila$eligible_neto_total)
  expect_gte(fila$eligible_bruto_total, fila$eligible_neto_total)
})

test_that("determinismo: mismo seed produce la misma seleccion y auditoria con el flag ON", {
  base <- descuento_base_ramiro()
  cfg <- descuento_cfg("sistematico_pps", seed = 123L, on = TRUE)
  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  a <- calc_muestra_aulas_seleccionar(frame, cfg)
  b <- calc_muestra_aulas_seleccionar(frame, cfg)
  expect_identical(a$selection$classroom_id, b$selection$classroom_id)
  expect_identical(a$selection$eligible_n_neto, b$selection$eligible_n_neto)
  expect_identical(a$selection$discount_step, b$selection$discount_step)
})

test_that("fallback honesto: marco sin unique_student_ids degrada a OFF con warning descuento_sin_ids", {
  base <- descuento_base_ramiro()
  cfg_on <- descuento_cfg("sistematico_pps", seed = 42L, on = TRUE)
  cfg_off <- descuento_cfg("sistematico_pps", seed = 42L, on = FALSE)
  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg_on)
  frame$aula_frame$unique_student_ids <- ""

  sel_on <- calc_muestra_aulas_seleccionar(frame, cfg_on)
  sel_off <- calc_muestra_aulas_seleccionar(frame, cfg_off)

  expect_true(sel_on$sequential_discount$requested)
  expect_false(sel_on$sequential_discount$applied)
  expect_identical(sel_on$sequential_discount$mode, "off")
  expect_identical(sel_on$sequential_discount$warning_code, "descuento_sin_ids")
  expect_true(any(grepl("descuento_sin_ids", unlist(sel_on$methodological_warning), fixed = TRUE)))
  # Comportamiento identico a OFF con el mismo seed (no consume RNG distinto).
  expect_identical(sel_on$selection$classroom_id, sel_off$selection$classroom_id)
  expect_false("eligible_n_neto" %in% names(sel_on$selection))
})

test_that("round-trip whitelist: sequential_discount sobrevive el workspace y la config normalizada", {
  # Workspace (PUT -> GET del estudio): whitelist-only.
  ws_on <- .cm_normalize_workspace_aulas_config(list(sequential_discount = TRUE))
  ws_default <- .cm_normalize_workspace_aulas_config(list())
  ws_off <- .cm_normalize_workspace_aulas_config(list(sequential_discount = FALSE))
  expect_true(ws_on$sequential_discount)
  expect_true(ws_default$sequential_discount)
  expect_false(ws_off$sequential_discount)

  # Config del motor: default TRUE, FALSE explícito y alias en español.
  norm_default <- calc_muestra_aulas_normalize_config(list())
  expect_true(norm_default$selector$sequential_discount)
  norm_off <- calc_muestra_aulas_normalize_config(list(selector = list(sequential_discount = FALSE)))
  expect_false(norm_off$selector$sequential_discount)
  norm_on <- calc_muestra_aulas_normalize_config(list(selector = list(sequential_discount = TRUE)))
  expect_true(norm_on$selector$sequential_discount)
  norm_alias_off <- calc_muestra_aulas_normalize_config(list(selector = list(descuento_secuencial = FALSE)))
  expect_false(norm_alias_off$selector$sequential_discount)
  # Re-normalizar la config ya normalizada preserva el flag (round-trip).
  expect_true(calc_muestra_aulas_normalize_config(norm_on)$selector$sequential_discount)
  expect_false(calc_muestra_aulas_normalize_config(norm_off)$selector$sequential_discount)
})

test_that("engine aplica descuento por omisión y respeta FALSE explícito", {
  base <- descuento_base_ramiro()
  cfg_default <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(
      seed = 77L,
      n_aulas = 2L,
      replacement_waves = 0L,
      selector_engine = "sistematico_pps",
      strata_cols = list("faculty"),
      monte_carlo_n = 0L,
      simulation_runs = 0L
    )
  ))
  selector_off <- cfg_default$selector
  selector_off$sequential_discount <- FALSE
  cfg_off <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = selector_off
  ))
  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg_default)

  by_default <- calc_muestra_aulas_seleccionar(frame, cfg_default)
  explicitly_off <- calc_muestra_aulas_seleccionar(frame, cfg_off)

  expect_true(by_default$selector$sequential_discount)
  expect_true(by_default$sequential_discount$requested)
  expect_true(by_default$sequential_discount$applied)
  expect_false(explicitly_off$selector$sequential_discount)
  expect_false(explicitly_off$sequential_discount$requested)
  expect_identical(explicitly_off$sequential_discount$mode, "off")
})

test_that("la firma del comparador registra descuento y objetivo completos", {
  cfg_on <- descuento_cfg("cube_balanceado", on = TRUE)
  cfg_off <- descuento_cfg("cube_balanceado", on = FALSE)
  on <- .cm_aulas_method_comparison_selector_snapshot(
    cfg_on$selector,
    cfg_on$objective
  )
  off <- .cm_aulas_method_comparison_selector_snapshot(
    cfg_off$selector,
    cfg_off$objective
  )

  expect_identical(on$schema, "calc_muestra_aulas_method_comparison_selector_v1")
  expect_true(on$sequential_discount)
  expect_false(off$sequential_discount)
  expect_identical(on$objective, cfg_on$objective)
  expect_identical(
    on$objective$variables$label[on$objective$variables$dimension == "size_group"],
    "Tamaño del curso-horario"
  )
  expect_false(identical(on, off))
})

test_that("discount_mode correcto por engine", {
  expect_identical(.cm_descuento_mode_for_engine("sistematico_pps"), "sequential")
  expect_identical(.cm_descuento_mode_for_engine("estratificado_aleatorio"), "sequential")
  expect_identical(.cm_descuento_mode_for_engine("pool_controlado"), "sequential")
  expect_identical(.cm_descuento_mode_for_engine("cube_balanceado"), "post_hoc")
  expect_identical(.cm_descuento_mode_for_engine("local_pivotal_balanceado"), "post_hoc")
  expect_identical(.cm_descuento_mode_for_engine("manual_auditable"), "post_hoc")
  expect_identical(.cm_descuento_mode_for_engine("pps_balanceado"), "post_hoc") # alias de cube
  expect_identical(.cm_descuento_mode_for_engine("cualquiera", enabled = FALSE), "off")
})

test_that("cube balanceado con flag ON no fuerza secuencialidad pero audita netos post_hoc", {
  base <- descuento_base_ramiro()
  cfg <- descuento_cfg("cube_balanceado", seed = 99L, on = TRUE, extra = list(
    balance_vars = list("faculty", "size_group")
  ))
  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  sel <- calc_muestra_aulas_seleccionar(frame, cfg)

  expect_identical(sel$sequential_discount$mode, "post_hoc")
  expect_true(sel$sequential_discount$applied)
  audit_cols <- c("eligible_n_bruto", "eligible_n_neto", "aporte_neto", "ya_cubiertos")
  expect_true(all(audit_cols %in% names(sel$selection)))
  expect_equal(
    sel$selection$eligible_n_bruto - sel$selection$ya_cubiertos,
    sel$selection$eligible_n_neto
  )
})

test_that("estratificado aleatorio con flag ON saca del bombo a las aulas ya cubiertas", {
  # A1 y A2 identicas (mismos 30 alumnos), A3 disjunta: con descuento la
  # segunda extraccion NUNCA puede ser la gemela ya cubierta (neto 0).
  ids <- c(paste0("s", 1:30), paste0("s", 1:30), paste0("t", 1:30))
  aula <- c(rep("A1", 30), rep("A2", 30), rep("A3", 30))
  base <- data.frame(
    student_id = ids,
    aula_id = aula,
    curso_id = paste0("C", match(aula, c("A1", "A2", "A3"))),
    curso = paste("Curso", aula),
    horario = "L 8",
    facultad = "FAC1",
    programa = "P1",
    sexo = "F",
    edad = 20,
    condicion = "regular",
    nivel = "pregrado",
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  for (seed in c(3L, 11L, 29L)) {
    cfg <- descuento_cfg("estratificado_aleatorio", seed = seed, on = TRUE)
    frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
    sel <- calc_muestra_aulas_seleccionar(frame, cfg)
    picked <- sel$selection$classroom_id
    expect_false(all(c("A1", "A2") %in% picked), info = sprintf("seed %s eligio a las gemelas", seed))
    expect_equal(sum(sel$selection$aporte_neto), 60L)
  }
})

test_that("pool controlado con flag ON descuenta dentro de cada sorteo candidato", {
  base <- descuento_base_ramiro()
  cfg <- descuento_cfg("pool_controlado", seed = 77L, on = TRUE, extra = list(
    candidate_pool_size = 10L
  ))
  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  sel <- calc_muestra_aulas_seleccionar(frame, cfg)

  expect_identical(sel$sequential_discount$mode, "sequential")
  expect_true(sel$sequential_discount$applied)
  expect_true(all(c("eligible_n_bruto", "eligible_n_neto", "ya_cubiertos") %in% names(sel$selection)))
  expect_equal(
    sel$selection$eligible_n_bruto - sel$selection$ya_cubiertos,
    sel$selection$eligible_n_neto
  )
  # El pool optimiza cobertura: con descuento nunca conviene la pareja de
  # grandes solapadas.
  expect_false(all(c("A1", "A2") %in% sel$selection$classroom_id))
})
