# =============================================================================
# Metas del diseno en la importacion calc-muestra -> Monitoreo (H3, 2025)
# =============================================================================
#
# Defecto medido: `monitoreo_aulas_from_calc()` importaba el sorteo pero NO el
# diseno. (a) Las cuotas de ALUMNOS por facultad x sexo no viajaban —solo las
# aulas por estrato—; (b) `expected_valid` por aula quedaba en el `eligible_n`
# crudo aunque el diseno asumiera una tasa de rendimiento tau (ej. 0,53), asi
# que el tablero media el avance contra el aforo y no contra lo que el aforo
# RINDE.
#
# Contrato congelado (los tests son contra el contrato, no contra el codigo):
#   1. `cfg$design_targets` con schema `monitoreo_aulas_design_targets_v1`,
#      cuotas por facultad (y por sexo) leidas de
#      `estudio$componentes[[i]]$resultado$aulas_por_estrato` + `distribucion_sub`.
#   2. En `cfg$plan`: `expected_valid == round(eligible_n * tau_de_su_facultad)`
#      cuando hay tau; `eligible_n` queda INTACTO. Sin tau: comportamiento
#      actual (`expected_valid == eligible_n`). Una meta declarada en el plan
#      de entrada (`expected_valid`/`meta_aula` != eligible_n) NO se pisa.
#   3. `cfg$quotas` no cambia de forma (siguen siendo las aulas del sorteo).
#   4. `monitoreo_aulas_normalize_config(cfg)` conserva `design_targets`
#      —la lista cerrada del normalizador es EL mutante natural—.
#   5. Sin componente en el estudio pero con `selection$certificacion_facultad`
#      adjunta, `facultades` se deriva de sus filas y tasa_fuente = "certificacion".

# --- Fixtures locales (no tocan fixtures compartidas) ------------------------

.metas_make_estudio <- function(cuotas = c(FAC1 = 100, FAC2 = 60),
                                taus = c(FAC1 = 0.5, FAC2 = 0.5),
                                con_tau = TRUE,
                                cuotas_sexo = list(
                                  FAC1 = list(F = 55, M = 45),
                                  FAC2 = list(F = 35, M = 25)
                                )) {
  aulas_por_estrato <- lapply(names(cuotas), function(fac) {
    fila <- list(
      estrato = fac,
      N = 1000,
      cuota = as.integer(cuotas[[fac]]),
      # Conteos de AULAS deliberadamente distintos de la cuota de ALUMNOS: si
      # la importacion confunde los dos planos, la cifra delata el cruce.
      aulas_base = 4L,
      aulas_reemplazo = 1L,
      aulas_total = 5L,
      margen = 1.2
    )
    if (con_tau) fila$tau <- taus[[fac]]
    fila
  })
  distribucion_sub <- list()
  for (fac in names(cuotas_sexo)) {
    for (sx in names(cuotas_sexo[[fac]])) {
      distribucion_sub[[length(distribucion_sub) + 1L]] <- list(
        estrato = fac, sub = sx, n = cuotas_sexo[[fac]][[sx]]
      )
    }
  }
  list(
    titulo = "Estudio metas 2025",
    componentes = list(list(
      id = "comp_principal",
      resultado = list(
        aulas_por_estrato = aulas_por_estrato,
        distribucion_sub = distribucion_sub
      )
    ))
  )
}

.metas_make_selection <- function(sel_df = NULL, run_id = "sel_metas") {
  if (is.null(sel_df)) {
    sel_df <- data.frame(
      classroom_id = c("A1", "A2", "A3"),
      label = c("Aula 1", "Aula 2", "Aula 3"),
      faculty = c("FAC1", "FAC1", "FAC2"),
      stratum = c("FAC1", "FAC1", "FAC2"),
      eligible_n = c(40, 30, 20),
      sample_role = "titular",
      wave = "M1",
      orden = c(1, 2, 3),
      sex_top_1 = "F",
      sex_top_1_n = c(22, 16, 11),
      sex_top_2 = "M",
      sex_top_2_n = c(18, 14, 9),
      stringsAsFactors = FALSE
    )
  }
  list(
    selection = sel_df,
    selection_run_id = run_id,
    quotas = list(
      list(stratum = "FAC1", n_aulas = 2L),
      list(stratum = "FAC2", n_aulas = 1L)
    )
  )
}

# Busca una facultad del bloque por etiqueta o por clave normalizada.
.metas_facultad <- function(design_targets, etiqueta) {
  facs <- design_targets$facultades
  if (!is.list(facs) || !length(facs)) return(NULL)
  for (f in facs) {
    if (is.list(f) && (identical(f$facultad, etiqueta) ||
                       identical(f$faculty_key, .cm_criterios_fac_key(etiqueta)))) {
      return(f)
    }
  }
  NULL
}

# Columna numerica del plan (records) indexada por classroom_id.
.metas_plan_col <- function(cfg, campo) {
  ids <- vapply(cfg$plan, function(r) as.character(r$classroom_id %||% ""), character(1))
  vals <- vapply(cfg$plan, function(r) {
    suppressWarnings(as.numeric(r[[campo]] %||% NA_real_))
  }, numeric(1))
  stats::setNames(vals, ids)
}

# --- T1 ----------------------------------------------------------------------

test_that("T1: las cuotas de alumnos del diseno viajan al monitoreo como design_targets", {
  estudio <- .metas_make_estudio()
  selection <- .metas_make_selection()
  cfg <- monitoreo_aulas_from_calc(estudio, selection, frame = NULL)

  dt <- cfg$design_targets
  expect_true(is.list(dt))
  expect_identical(dt$schema, "monitoreo_aulas_design_targets_v1")
  expect_identical(dt$source, "calc-muestra")
  expect_identical(dt$tasa_fuente, "tau_disenio")
  expect_equal(dt$tasa_esperada, 0.5)
  expect_equal(dt$total_cuota, 160)
  expect_length(dt$facultades, 2)

  f1 <- .metas_facultad(dt, "FAC1")
  expect_false(is.null(f1))
  # Cuota de ALUMNOS (100): ni las 2 aulas del sorteo ni las 4 base / 5 total
  # del diseno. El defecto era justamente que solo viajaban conteos de aulas.
  expect_equal(f1$cuota, 100)
  expect_equal(f1$cuota_sexo$F, 55)
  expect_equal(f1$cuota_sexo$M, 45)
  expect_equal(f1$tau, 0.5)
  expect_identical(f1$faculty_key, .cm_criterios_fac_key("FAC1"))

  f2 <- .metas_facultad(dt, "FAC2")
  expect_false(is.null(f2))
  expect_equal(f2$cuota, 60)
  expect_equal(f2$cuota_sexo$F, 35)
  expect_equal(f2$cuota_sexo$M, 25)

  # Contrato 3: quotas no cambia de forma — siguen siendo las aulas del sorteo.
  expect_identical(cfg$quotas, selection$quotas)

  # Aditivo (retoque del contrato): el bloque lleva la trazabilidad del import,
  # para poder decir de QUE sorteo salieron estas metas.
  expect_identical(dt$selection_run_id, "sel_metas")
})

# --- T2 ----------------------------------------------------------------------

test_that("T2: expected_valid por aula aplica la tau del diseno y eligible_n queda crudo", {
  cfg <- monitoreo_aulas_from_calc(
    .metas_make_estudio(), .metas_make_selection(), frame = NULL
  )
  eligibles <- .metas_plan_col(cfg, "eligible_n")
  metas <- .metas_plan_col(cfg, "expected_valid")
  # Los elegibles son el aforo CRUDO del aula...
  expect_equal(unname(eligibles[c("A1", "A2", "A3")]), c(40, 30, 20))
  # ...y la meta por aula es lo que ese aforo RINDE con la tau del diseno
  # (0,5). El codigo viejo dejaba expected_valid == eligible_n: 40/30/20.
  expect_equal(unname(metas[c("A1", "A2", "A3")]), c(20, 15, 10))
})

# --- T3 ----------------------------------------------------------------------

test_that("T3: con tau heterogenea cada aula usa la tau de SU facultad", {
  estudio <- .metas_make_estudio(taus = c(FAC1 = 0.5, FAC2 = 0.8))
  cfg <- monitoreo_aulas_from_calc(estudio, .metas_make_selection(), frame = NULL)
  metas <- .metas_plan_col(cfg, "expected_valid")
  # A3 es de FAC2: round(20 * 0.8) = 16 — no 10 (tau de FAC1) ni 20 (crudo).
  expect_equal(unname(metas[c("A1", "A2", "A3")]), c(20, 15, 16))
  # Con taus distintas no existe una tasa global que declarar.
  expect_identical(cfg$design_targets$tasa_esperada, NA_real_)
  expect_identical(cfg$design_targets$tasa_fuente, "tau_disenio")
})

# --- T4 ----------------------------------------------------------------------

test_that("T4: sin tau en el diseno la meta por aula es el elegible crudo", {
  estudio <- .metas_make_estudio(con_tau = FALSE)
  cfg <- monitoreo_aulas_from_calc(estudio, .metas_make_selection(), frame = NULL)
  metas <- .metas_plan_col(cfg, "expected_valid")
  eligibles <- .metas_plan_col(cfg, "eligible_n")
  expect_equal(unname(metas[c("A1", "A2", "A3")]), c(40, 30, 20))
  expect_equal(unname(eligibles[c("A1", "A2", "A3")]), c(40, 30, 20))
  expect_identical(cfg$design_targets$tasa_fuente, "sin_tasa")
  expect_identical(cfg$design_targets$tasa_esperada, NA_real_)
})

# --- T5 ----------------------------------------------------------------------

test_that("T5: monitoreo_aulas_normalize_config conserva design_targets", {
  cfg <- monitoreo_aulas_from_calc(
    .metas_make_estudio(), .metas_make_selection(), frame = NULL
  )
  normalizado <- monitoreo_aulas_normalize_config(cfg)
  dt <- normalizado$design_targets
  # EL mutante natural: la lista cerrada del normalizador no declara el campo
  # y el bloque se traga en la primera vuelta guardar -> cargar.
  expect_true(is.list(dt))
  expect_identical(dt$schema, "monitoreo_aulas_design_targets_v1")
  expect_length(dt$facultades, 2)
  expect_equal(.metas_facultad(dt, "FAC1")$cuota, 100)
  expect_equal(.metas_facultad(dt, "FAC2")$cuota, 60)
  expect_equal(dt$total_cuota, 160)
})

# --- T6 ----------------------------------------------------------------------

test_that("T6: la certificacion por facultad se deriva del estudio cuando no viene adjunta", {
  estudio <- .metas_make_estudio(
    cuotas = c(FAC1 = 100),
    taus = c(FAC1 = 0.5),
    cuotas_sexo = list(FAC1 = list(F = 55, M = 45))
  )
  sel_df <- data.frame(
    classroom_id = c("A1", "A2"),
    faculty = "FAC1",
    stratum = "FAC1",
    eligible_n = c(50, 40),
    sample_role = "titular",
    wave = "M1",
    orden = c(1, 2),
    sex_top_1 = "F",
    sex_top_1_n = c(28, 22),
    sex_top_2 = "M",
    sex_top_2_n = c(22, 18),
    stringsAsFactors = FALSE
  )
  selection <- .metas_make_selection(sel_df = sel_df)
  # Premisa del caso: la seleccion NO trae la certificacion adjunta.
  expect_null(selection$certificacion_facultad)

  cfg <- monitoreo_aulas_from_calc(estudio, selection, frame = NULL)
  cert <- cfg$design_targets$certificacion_facultad
  expect_true(is.list(cert))
  expect_identical(cert$schema, "calc_muestra_aulas_certificacion_facultad_v1")
  fila <- cert$filas[[1]]
  # 90 elegibles x tau 0,5 = 45 esperadas contra una cuota de 100: NO CUBRE.
  expect_equal(fila$cuota, 100)
  expect_equal(fila$elegibles_titulares, 90)
  expect_equal(fila$efectivas_esperadas, 45)
  expect_identical(fila$estado, "no_cubre")
})

# --- T7 ----------------------------------------------------------------------

test_that("T7: una meta declarada en el plan de entrada no se sobreescribe", {
  sel_df <- data.frame(
    classroom_id = c("A1", "A2", "A3"),
    faculty = c("FAC1", "FAC1", "FAC2"),
    stratum = c("FAC1", "FAC1", "FAC2"),
    eligible_n = c(40, 30, 20),
    # A1 trae meta PROPIA (25 != 40). A2/A3 llevan el valor de FALLBACK del
    # normalizador (expected_valid == eligible_n), que es la firma congelada
    # de "no declarado": el discriminador del contrato es literalmente
    # `!= eligible_n`. Un NA en la columna NO sirve para decir "no declaro":
    # el normalizador preexistente lo vuelve 0 (su default), no eligible_n.
    expected_valid = c(25, 30, 20),
    sample_role = "titular",
    wave = "M1",
    orden = c(1, 2, 3),
    sex_top_1 = "F",
    sex_top_1_n = c(22, 16, 11),
    sex_top_2 = "M",
    sex_top_2_n = c(18, 14, 9),
    stringsAsFactors = FALSE
  )
  cfg <- monitoreo_aulas_from_calc(
    .metas_make_estudio(), .metas_make_selection(sel_df = sel_df), frame = NULL
  )
  metas <- .metas_plan_col(cfg, "expected_valid")
  # La meta declarada se respeta: ni 20 (tau) ni 40 (crudo).
  expect_equal(unname(metas["A1"]), 25)
  # Las filas sin meta propia si toman la tau del diseno.
  expect_equal(unname(metas[c("A2", "A3")]), c(15, 10))
  eligibles <- .metas_plan_col(cfg, "eligible_n")
  expect_equal(unname(eligibles[c("A1", "A2", "A3")]), c(40, 30, 20))
})

# --- T8 (contrato 5) ---------------------------------------------------------

test_that("T8: sin componente en el estudio, facultades se deriva de la certificacion adjunta", {
  selection <- .metas_make_selection()
  selection$certificacion_facultad <- list(
    schema = "calc_muestra_aulas_certificacion_facultad_v1",
    tasa_esperada = 0.5,
    tasa_fuente = "tau_disenio",
    filas = list(
      list(
        faculty_key = "fac1", facultad = "FAC1", cuota = 100,
        tasa = 0.5, estado = "certificada",
        sexo = list(
          list(sexo = "F", cuota = 55),
          list(sexo = "M", cuota = 45)
        )
      ),
      list(
        faculty_key = "fac2", facultad = "FAC2", cuota = 60,
        tasa = 0.5, estado = "certificada",
        sexo = list(
          list(sexo = "F", cuota = 35),
          list(sexo = "M", cuota = 25)
        )
      )
    )
  )
  # El estudio no trae componentes: la unica fuente de metas es la certificacion.
  cfg <- monitoreo_aulas_from_calc(list(titulo = "Sin componentes"), selection, frame = NULL)
  dt <- cfg$design_targets
  expect_true(is.list(dt))
  expect_identical(dt$tasa_fuente, "certificacion")
  expect_length(dt$facultades, 2)
  expect_equal(.metas_facultad(dt, "FAC1")$cuota, 100)
  expect_equal(.metas_facultad(dt, "FAC2")$cuota, 60)
  expect_equal(.metas_facultad(dt, "FAC1")$cuota_sexo$F, 55)
  expect_equal(dt$total_cuota, 160)
})

# --- T9 (H4 del revisor metodologico) ----------------------------------------

test_that("T9: un aula de una facultad fuera del diseno conserva su meta cruda", {
  # El diseno solo traza FAC1; TEOLOGIA no aparece en aulas_por_estrato.
  estudio <- .metas_make_estudio(
    cuotas = c(FAC1 = 100),
    taus = c(FAC1 = 0.5),
    cuotas_sexo = list(FAC1 = list(F = 55, M = 45))
  )
  sel_df <- data.frame(
    classroom_id = c("A1", "A2", "A3"),
    faculty = c("FAC1", "FAC1", "TEOLOGIA"),
    stratum = c("FAC1", "FAC1", "TEOLOGIA"),
    eligible_n = c(40, 30, 20),
    sample_role = "titular",
    wave = "M1",
    orden = c(1, 2, 3),
    sex_top_1 = "F",
    sex_top_1_n = c(22, 16, 11),
    sex_top_2 = "M",
    sex_top_2_n = c(18, 14, 9),
    stringsAsFactors = FALSE
  )
  cfg <- monitoreo_aulas_from_calc(
    estudio, .metas_make_selection(sel_df = sel_df), frame = NULL
  )
  metas <- .metas_plan_col(cfg, "expected_valid")
  eligibles <- .metas_plan_col(cfg, "eligible_n")
  # (a) Las aulas con facultad en el diseno toman la meta tau.
  expect_equal(unname(metas[c("A1", "A2")]), c(20, 15))
  # (b) La huerfana conserva el fallback conservador: nadie sabe su tau, y una
  # tau inventada seria peor que la meta cruda.
  expect_equal(unname(metas["A3"]), 20)
  # (c) Sus elegibles quedan intactos, como los de todas.
  expect_equal(unname(eligibles[c("A1", "A2", "A3")]), c(40, 30, 20))
  # (d) El bloque de metas es DEL DISENO: una facultad que el diseno no trazo
  # no gana una fila con cuota inventada por aparecer en el sorteo.
  dt <- cfg$design_targets
  expect_length(dt$facultades, 1)
  expect_false(is.null(.metas_facultad(dt, "FAC1")))
  expect_null(.metas_facultad(dt, "TEOLOGIA"))
})
