# =============================================================================
# Avance contra la cuota del diseño (dictamen metodológico 2026-08-18)
# =============================================================================
#
# Contrato congelado: el bloque `avance_cuota` SIEMPRE viaja en el dashboard;
# el denominador es la cuota de `design_targets` mientras su sello
# (selection_run_id + frame_hash, comparados POR SEPARADO) siga vigente, y la
# meta del plan —declarada como degradación— cuando no lo esté. El numerador
# suma respuestas atribuidas por el AULA del plan (titulares caídos, reservas y
# banco incluidos), con dedupe por identificador, sin huérfanas y con el fuera
# de universo (aula_no_existe / virtual_no_presencial) publicado aparte. Las
# celdas de sexo salen del diseño (`design_cuota_sexo`) cuando está vigente y
# el merge target<->observado va por claves normalizadas.
#
# Fixtures locales propias: NO se tocan las de test-monitoreo-aulas-metas-diseno.R.

.avc_aula <- function(id, fac, expected = 10, eligible = 20, orden = 1,
                      code = NULL, rol = "titular", wave = "M1",
                      status = "agendada", replacement_for = "",
                      titular_code = "", replacement_order = NULL,
                      replacement_reason = "",
                      sex1 = "", sex1_n = 0, sex2 = "", sex2_n = 0) {
  fila <- list(
    classroom_id = id,
    operational_code = code %||% sprintf("CH %d", orden),
    label = paste("Aula", id),
    faculty = fac, stratum = fac,
    sample_role = rol, wave = wave, orden = orden,
    eligible_n = eligible, expected_valid = expected,
    sample_status = status
  )
  if (nzchar(replacement_for)) fila$replacement_for <- replacement_for
  if (nzchar(titular_code)) fila$titular_operational_code <- titular_code
  if (!is.null(replacement_order)) fila$replacement_order <- replacement_order
  if (nzchar(replacement_reason)) fila$replacement_reason <- replacement_reason
  if (nzchar(sex1)) { fila$sex_top_1 <- sex1; fila$sex_top_1_n <- sex1_n }
  if (nzchar(sex2)) { fila$sex_top_2 <- sex2; fila$sex_top_2_n <- sex2_n }
  fila
}

.avc_fac <- function(nombre, cuota, F = NULL, M = NULL) {
  cs <- list()
  if (!is.null(F)) cs$F <- F
  if (!is.null(M)) cs$M <- M
  list(facultad = nombre, faculty_key = .cm_criterios_fac_key(nombre),
       cuota = cuota, cuota_sexo = cs, tau = 0.5)
}

.avc_dt <- function(facs, total = NULL, run_id = "run_1", hash = "hash_1") {
  cuotas <- vapply(facs, function(f) suppressWarnings(as.numeric(f$cuota %||% NA)), numeric(1))
  list(
    schema = "monitoreo_aulas_design_targets_v1",
    source = "calc-muestra",
    tasa_esperada = 0.5,
    tasa_fuente = "tau_disenio",
    total_cuota = total %||% (if (any(is.finite(cuotas))) round(sum(cuotas[is.finite(cuotas)])) else NA_real_),
    facultades = facs,
    selection_run_id = run_id,
    frame_hash = hash
  )
}

.avc_cfg <- function(plan, dt = NULL, run_id = "run_1", hash = "hash_1") {
  monitoreo_aulas_normalize_config(list(
    enabled = TRUE, selection_run_id = run_id, frame_hash = hash,
    plan = plan, design_targets = dt %||% list()
  ))
}

.avc_dash <- function(plan, responses = data.frame(), dt = NULL,
                      run_id = "run_1", hash = "hash_1") {
  cfg <- .avc_cfg(plan, dt, run_id, hash)
  monitoreo_aulas_dashboard(cfg$plan, responses, cfg)
}

.avc_resp <- function(ids, sexo = NULL, facultad = NULL) {
  df <- data.frame(collectorID = ids, stringsAsFactors = FALSE)
  if (!is.null(sexo)) df$sexo <- sexo
  if (!is.null(facultad)) df$facultad <- facultad
  df
}

.avc_fila <- function(block, nombre) {
  k <- .cm_criterios_fac_key(nombre)
  for (f in block$facultades) {
    if (identical(as.character(f$faculty_key), k)) return(f)
  }
  NULL
}

# Las claves internas del merge NO viajan en el record (H1): la celda se
# localiza normalizando la etiqueta publicada.
.avc_celda <- function(d, sex_key) {
  for (q in d$quotas_sex_faculty) {
    if (identical(.maac_sexo_key(as.character(q$sex %||% "")), sex_key)) return(q)
  }
  NULL
}

# --- marco estable ------------------------------------------------------------

test_that("con plan vacio el bloque viaja igual, con sus ceros y sus huerfanas", {
  d <- monitoreo_aulas_dashboard(list(), .avc_resp(c("X1", "X2")), list(enabled = TRUE))
  b <- d$avance_cuota
  expect_identical(b$schema, "monitoreo_aulas_avance_cuota_v1")
  expect_identical(b$fuente, "plan_expected")
  expect_identical(b$vigencia, "sin_diseno")
  # El aviso dice la causa, no solo el hecho: el chip degradado necesita el
  # porque tambien en degradacion sin diseno. Solo `vigente` viaja con "".
  expect_match(b$motivo, "no publica metas del diseño")
  expect_match(b$motivo, "meta del plan")
  expect_equal(b$total$cuota, 0)
  expect_identical(b$total$respuestas_validas, 0L)
  # Las dos respuestas ya llegaron y ningun aula del plan las reclama: se
  # declaran, no se pierden.
  expect_identical(b$total$huerfanas, 2L)
  expect_length(b$facultades, 0L)
})

test_that("sin design_targets la conducta actual queda intacta: meta del plan declarada", {
  plan <- list(
    .avc_aula("A1", "FAC1", expected = 10, orden = 1),
    .avc_aula("A2", "FAC1", expected = 11, orden = 2),
    .avc_aula("A3", "FAC2", expected = 5, orden = 3)
  )
  d <- .avc_dash(plan, .avc_resp(c("A1", "A1", "A2")))
  b <- d$avance_cuota
  expect_identical(b$fuente, "plan_expected")
  expect_identical(b$vigencia, "sin_diseno")
  expect_true(nzchar(b$motivo))
  expect_identical(b$tasa_esperada, NA_real_)
  expect_identical(b$tasa_fuente, "")
  f1 <- .avc_fila(b, "FAC1")
  expect_equal(f1$cuota, 21)
  expect_identical(f1$respuestas_validas, 3L)
  expect_identical(f1$fuente_fila, "plan")
  expect_identical(f1$estado, "ok")
  f2 <- .avc_fila(b, "FAC2")
  expect_equal(f2$cuota, 5)
  expect_identical(f2$respuestas_validas, 0L)
  expect_equal(b$total$cuota, 26)
  expect_identical(b$total$respuestas_validas, 3L)
  # La meta del ritmo es el denominador global del bloque: aqui, la del plan.
  expect_identical(d$ritmo_diario$meta, 26)
})

# --- la tabla de vigencia -----------------------------------------------------

test_that("sellos iguales y completos: cuotas del diseno, vigencia vigente", {
  plan <- list(.avc_aula("A1", "FAC1", expected = 10))
  d <- .avc_dash(plan, .avc_resp("A1"), dt = .avc_dt(list(.avc_fac("FAC1", 8))))
  b <- d$avance_cuota
  expect_identical(b$fuente, "design_targets")
  expect_identical(b$vigencia, "vigente")
  expect_identical(b$motivo, "")
  expect_equal(b$tasa_esperada, 0.5)
  expect_identical(b$tasa_fuente, "tau_disenio")
  f1 <- .avc_fila(b, "FAC1")
  expect_equal(f1$cuota, 8)
  expect_identical(f1$fuente_fila, "diseno")
  expect_equal(b$total$cuota, 8)
})

test_that("run_id distinto degrada a la meta del plan y el motivo trae los dos sellos", {
  plan <- list(.avc_aula("A1", "FAC1", expected = 10))
  dt <- .avc_dt(list(.avc_fac("FAC1", 8)), run_id = "run_viejo")
  d <- .avc_dash(plan, dt = dt, run_id = "run_nuevo")
  b <- d$avance_cuota
  expect_identical(b$fuente, "plan_expected")
  expect_identical(b$vigencia, "obsoleta")
  expect_match(b$motivo, "run_viejo")
  expect_match(b$motivo, "run_nuevo")
  expect_match(b$motivo, "hash_1")
  f1 <- .avc_fila(b, "FAC1")
  expect_equal(f1$cuota, 10)
  expect_identical(f1$fuente_fila, "plan")
  expect_equal(b$total$cuota, 10)
})

test_that("frame_hash distinto tambien degrada, por si solo", {
  plan <- list(.avc_aula("A1", "FAC1", expected = 10))
  dt <- .avc_dt(list(.avc_fac("FAC1", 8)), hash = "hash_viejo")
  d <- .avc_dash(plan, dt = dt, hash = "hash_nuevo")
  b <- d$avance_cuota
  expect_identical(b$vigencia, "obsoleta")
  expect_identical(b$fuente, "plan_expected")
  expect_match(b$motivo, "hash_viejo")
  expect_match(b$motivo, "hash_nuevo")
  expect_equal(b$total$cuota, 10)
})

test_that("sellos vacios: cuotas del diseno pero vigencia no_verificable, dicha", {
  plan <- list(.avc_aula("A1", "FAC1", expected = 10))
  dt <- .avc_dt(list(.avc_fac("FAC1", 8)))
  dt$selection_run_id <- ""
  dt$frame_hash <- ""
  d <- .avc_dash(plan, dt = dt)
  b <- d$avance_cuota
  expect_identical(b$fuente, "design_targets")
  expect_identical(b$vigencia, "no_verificable")
  expect_true(nzchar(b$motivo))
  expect_equal(.avc_fila(b, "FAC1")$cuota, 8)
})

# --- filas por facultad -------------------------------------------------------

test_that("una facultad del plan sin cuota en el diseno queda en NA y fuera del % global", {
  plan <- list(
    .avc_aula("A1", "FAC1", expected = 10, orden = 1),
    .avc_aula("A2", "TEOLOGIA", expected = 7, orden = 2)
  )
  d <- .avc_dash(plan, .avc_resp(c("A1", "A1", "A1", "A2", "A2")),
                 dt = .avc_dt(list(.avc_fac("FAC1", 10))))
  b <- d$avance_cuota
  teo <- .avc_fila(b, "TEOLOGIA")
  expect_identical(teo$fuente_fila, "sin_cuota")
  expect_identical(teo$estado, "sin_cuota")
  expect_identical(teo$cuota, NA_real_)
  expect_identical(teo$brecha, NA_real_)
  expect_identical(teo$avance_pct, NA_real_)
  # Sus respuestas se publican en su fila...
  expect_identical(teo$respuestas_validas, 2L)
  # ...pero NO entran al numerador global: 3 de 10, no 5 de 10.
  expect_equal(b$total$cuota, 10)
  expect_identical(b$total$respuestas_validas, 3L)
  expect_equal(b$total$avance_pct, 30)
  expect_identical(b$total$huerfanas, 0L)
})

test_that("una facultad del diseno sin aulas en el plan sale con 0 sobre su cuota", {
  plan <- list(.avc_aula("A1", "FAC1", expected = 10))
  d <- .avc_dash(plan, .avc_resp("A1"),
                 dt = .avc_dt(list(.avc_fac("FAC1", 10), .avc_fac("FAC2", 6))))
  b <- d$avance_cuota
  f2 <- .avc_fila(b, "FAC2")
  expect_identical(f2$estado, "sin_aulas_en_plan")
  expect_identical(f2$fuente_fila, "diseno")
  expect_equal(f2$cuota, 6)
  expect_identical(f2$respuestas_validas, 0L)
  expect_equal(f2$brecha, 6)
  expect_equal(b$total$cuota, 16)
})

test_that("cuota cero da avance NA, no Inf; y el avance sobre 100 va sin cap", {
  plan <- list(.avc_aula("A1", "FAC1", expected = 10))
  d0 <- .avc_dash(plan, .avc_resp(c("A1", "A1")),
                  dt = .avc_dt(list(.avc_fac("FAC1", 0))))
  f0 <- .avc_fila(d0$avance_cuota, "FAC1")
  expect_identical(f0$avance_pct, NA_real_)
  expect_equal(f0$brecha, 0)
  expect_identical(d0$avance_cuota$total$avance_pct, NA_real_)

  d150 <- .avc_dash(plan, .avc_resp(rep("A1", 6)),
                    dt = .avc_dt(list(.avc_fac("FAC1", 4))))
  f150 <- .avc_fila(d150$avance_cuota, "FAC1")
  expect_equal(f150$avance_pct, 150)
  expect_equal(f150$brecha, 0)
  expect_equal(d150$avance_cuota$total$avance_pct, 150)
})

# --- numerador: huerfanas, dedupe, fuera de universo, reservas ----------------

test_that("las huerfanas nunca entran y el invariante total_validas - atribuidas se cumple", {
  plan <- list(.avc_aula("A1", "FAC1", expected = 10))
  d <- .avc_dash(plan, .avc_resp(c("A1", "ZZZ", "ZZZ")),
                 dt = .avc_dt(list(.avc_fac("FAC1", 10))))
  b <- d$avance_cuota
  expect_identical(.avc_fila(b, "FAC1")$respuestas_validas, 1L)
  expect_identical(b$total$respuestas_validas, 1L)
  expect_identical(b$total$huerfanas, 2L)
  # El invariante literal del dictamen.
  atribuidas <- sum(vapply(b$facultades, function(f) {
    as.numeric(f$respuestas_validas) + as.numeric(f$fuera_universo)
  }, numeric(1)))
  expect_equal(3 - atribuidas, as.numeric(b$total$huerfanas))
})

test_that("dos filas del plan con el mismo identificador no cuentan la respuesta dos veces", {
  plan <- list(
    .avc_aula("A1", "FAC1", expected = 10, orden = 1, code = "CH 1"),
    .avc_aula("A1", "FAC1", expected = 10, orden = 2, code = "CH 2")
  )
  d <- .avc_dash(plan, .avc_resp(c("A1", "A1", "A1")),
                 dt = .avc_dt(list(.avc_fac("FAC1", 10))))
  b <- d$avance_cuota
  expect_identical(.avc_fila(b, "FAC1")$respuestas_validas, 3L)
  expect_identical(b$total$respuestas_validas, 3L)
})

test_that("aula_no_existe y virtual no suman al cumplimiento pero se publican; baja_asistencia si suma", {
  plan <- list(
    .avc_aula("A1", "FAC1", expected = 10, orden = 1),
    .avc_aula("A2", "FAC1", expected = 10, orden = 2, replacement_reason = "aula_no_existe"),
    .avc_aula("A3", "FAC1", expected = 10, orden = 3, replacement_reason = "virtual_no_presencial"),
    .avc_aula("A4", "FAC1", expected = 10, orden = 4, replacement_reason = "baja_asistencia")
  )
  d <- .avc_dash(plan, .avc_resp(c("A1", "A1", "A2", "A3", "A4")),
                 dt = .avc_dt(list(.avc_fac("FAC1", 10))))
  b <- d$avance_cuota
  f1 <- .avc_fila(b, "FAC1")
  # A1 (2) + A4 (1): el motivo operativo cuenta, el fuera de universo no.
  expect_identical(f1$respuestas_validas, 3L)
  expect_identical(f1$fuera_universo, 2L)
  expect_identical(b$total$fuera_universo, 2L)
  expect_identical(b$total$respuestas_validas, 3L)
  expect_identical(b$total$huerfanas, 0L)
})

test_that("una reserva activada suma al numerador y el denominador no crece", {
  plan <- list(
    .avc_aula("A1", "FAC1", expected = 10, orden = 1, code = "CH 1",
              status = "reemplazada"),
    .avc_aula("A2", "FAC1", expected = 10, orden = 2, code = "R 1.1",
              rol = "chain_reserve", wave = "M2", status = "agendada",
              replacement_for = "A1", titular_code = "CH 1", replacement_order = 1)
  )
  d <- .avc_dash(plan, .avc_resp(c("A1", "A1", "A2", "A2", "A2")),
                 dt = .avc_dt(list(.avc_fac("FAC1", 10))))
  b <- d$avance_cuota
  f1 <- .avc_fila(b, "FAC1")
  # Lo del titular caido Y lo de su reserva: las personas ya respondieron.
  expect_identical(f1$respuestas_validas, 5L)
  # El denominador es la cuota trazada: activar una reserva no la infla.
  expect_equal(f1$cuota, 10)
  expect_equal(b$total$cuota, 10)
})

# --- celdas de sexo -----------------------------------------------------------

test_that("con diseno vigente los targets de sexo salen de cuota_sexo y el vocabulario libre casa", {
  plan <- list(.avc_aula("A1", "FAC1", expected = 10,
                         sex1 = "Mujer", sex1_n = 12, sex2 = "Hombre", sex2_n = 8))
  d <- .avc_dash(plan, .avc_resp(rep("A1", 3), sexo = c("Femenino", "Femenino", "MASCULINO")),
                 dt = .avc_dt(list(.avc_fac("FAC1", 10, F = 6, M = 4))))
  celda_f <- .avc_celda(d, "F")
  celda_m <- .avc_celda(d, "M")
  expect_identical(as.character(celda_f$source), "design_cuota_sexo")
  expect_identical(as.character(celda_m$source), "design_cuota_sexo")
  expect_identical(as.integer(celda_f$target), 6L)
  expect_identical(as.integer(celda_m$target), 4L)
  # El merge va por clave normalizada: "Femenino"/"MASCULINO" -> F/M.
  expect_identical(as.integer(celda_f$observed), 2L)
  expect_identical(as.integer(celda_m$observed), 1L)
  # La etiqueta de display es la del PLAN (las respuestas solo rellenan): asi
  # las filas del diseno y las degradadas comparten vocabulario.
  expect_identical(as.character(celda_f$sex), "Mujer")
  expect_identical(as.character(celda_m$sex), "Hombre")
  # H1: las claves internas del merge no son columnas del contrato, el warning
  # vacio no viaja, y el orden de columnas es el del payload de siempre — el
  # DataTable de la UI pinta las primeras que llegan.
  expect_false("fac_key" %in% names(celda_f))
  expect_false("sex_key" %in% names(celda_f))
  expect_false("warning" %in% names(celda_f))
  expect_identical(
    names(celda_f)[1:8],
    c("faculty", "sex", "target", "observed", "missing", "progress_pct", "status", "source")
  )
})

test_that("con cobertura mixta diseno/fallback el mismo sexo no se parte en dos etiquetas", {
  plan <- list(
    .avc_aula("A1", "FAC1", expected = 10, orden = 1,
              sex1 = "Mujer", sex1_n = 12, sex2 = "Hombre", sex2_n = 8),
    .avc_aula("A2", "FAC2", expected = 10, orden = 2,
              sex1 = "Mujer", sex1_n = 9, sex2 = "Hombre", sex2_n = 11)
  )
  # FAC1 con cuota_sexo sana (diseno); FAC2 corrupta (9+9 contra 10) degrada al
  # fallback del plan. Las respuestas traen OTRO vocabulario.
  d <- .avc_dash(plan, .avc_resp(c("A1", "A2"), sexo = c("Femenino", "MASCULINO")),
                 dt = .avc_dt(list(.avc_fac("FAC1", 10, F = 6, M = 4),
                                   .avc_fac("FAC2", 10, F = 9, M = 9))))
  celdas <- d$quotas_sex_faculty
  fuentes <- vapply(celdas, function(q) as.character(q$source), character(1))
  expect_true("design_cuota_sexo" %in% fuentes)
  expect_true(any(fuentes != "design_cuota_sexo"))
  # Un sexo, UNA etiqueta en toda la tabla: manda el vocabulario del plan.
  etiquetas <- vapply(celdas, function(q) as.character(q$sex), character(1))
  claves <- .maac_sexo_key(etiquetas)
  expect_identical(unique(etiquetas[claves == "F"]), "Mujer")
  expect_identical(unique(etiquetas[claves == "M"]), "Hombre")
})

test_that("un desvio de 1 por redondeo no descalifica el desglose del diseno", {
  plan <- list(.avc_aula("A1", "FAC1", expected = 10,
                         sex1 = "Mujer", sex1_n = 12, sex2 = "Hombre", sex2_n = 8))
  # F+M = 10 contra cuota 9: |10 - 9| = 1, dentro de la tolerancia.
  d <- .avc_dash(plan, dt = .avc_dt(list(.avc_fac("FAC1", 9, F = 6, M = 4))))
  fuentes <- vapply(d$quotas_sex_faculty, function(q) as.character(q$source), character(1))
  expect_true(all(fuentes == "design_cuota_sexo"))
})

test_that("un cuota_sexo que no cuadra degrada esa facultad al fallback con warning declarado", {
  plan <- list(.avc_aula("A1", "FAC1", expected = 10,
                         sex1 = "Mujer", sex1_n = 12, sex2 = "Hombre", sex2_n = 8))
  # F+M = 12 contra cuota 10: bloque corrupto, no se publica como certificado.
  d <- .avc_dash(plan, dt = .avc_dt(list(.avc_fac("FAC1", 10, F = 6, M = 6))))
  celdas <- d$quotas_sex_faculty
  expect_gt(length(celdas), 0L)
  fuentes <- vapply(celdas, function(q) as.character(q$source), character(1))
  expect_true(all(fuentes != "design_cuota_sexo"))
  expect_true(all(vapply(celdas, function(q) nzchar(as.character(q$warning %||% "")), logical(1))))
  # El fallback es el de siempre: la proyeccion del plan (12/8 sobre 10).
  expect_identical(as.integer(.avc_celda(d, "F")$target), 6L)
  expect_identical(as.integer(.avc_celda(d, "M")$target), 4L)
})

test_that("sin diseno el fallback de siempre queda declarado con su source", {
  plan <- list(.avc_aula("A1", "FAC1", expected = 10,
                         sex1 = "Mujer", sex1_n = 12, sex2 = "Hombre", sex2_n = 8))
  d <- .avc_dash(plan, .avc_resp(rep("A1", 2), sexo = c("Femenino", "MASCULINO")))
  fuentes <- vapply(d$quotas_sex_faculty, function(q) as.character(q$source), character(1))
  expect_true(all(fuentes == "plan_sex_top"))
  # La clave normalizada tambien casa contra el vocabulario del plan.
  expect_identical(as.integer(.avc_celda(d, "F")$observed), 1L)
  expect_identical(as.integer(.avc_celda(d, "M")$observed), 1L)
})

test_that("una respuesta sin sexo cuenta al total pero a ninguna celda: celdas + residual = total", {
  plan <- list(.avc_aula("A1", "FAC1", expected = 10,
                         sex1 = "Mujer", sex1_n = 12, sex2 = "Hombre", sex2_n = 8))
  d <- .avc_dash(plan, .avc_resp(rep("A1", 3), sexo = c("Femenino", "", "MASCULINO")),
                 dt = .avc_dt(list(.avc_fac("FAC1", 10, F = 6, M = 4))))
  fila <- .avc_fila(d$avance_cuota, "FAC1")
  expect_identical(fila$respuestas_validas, 3L)
  expect_identical(fila$respuestas_sin_sexo, 1L)
  celdas <- sum(vapply(d$quotas_sex_faculty, function(q) as.integer(q$observed), integer(1)))
  expect_identical(celdas + fila$respuestas_sin_sexo, fila$respuestas_validas)
})

test_that("una respuesta fuera de universo tampoco cubre celdas de sexo", {
  plan <- list(
    .avc_aula("A1", "FAC1", expected = 10, orden = 1,
              sex1 = "Mujer", sex1_n = 12, sex2 = "Hombre", sex2_n = 8),
    .avc_aula("A2", "FAC1", expected = 10, orden = 2, replacement_reason = "aula_no_existe")
  )
  d <- .avc_dash(plan, .avc_resp(c("A1", "A2"), sexo = c("Femenino", "Femenino")),
                 dt = .avc_dt(list(.avc_fac("FAC1", 10, F = 6, M = 4))))
  expect_identical(as.integer(.avc_celda(d, "F")$observed), 1L)
  fila <- .avc_fila(d$avance_cuota, "FAC1")
  expect_identical(fila$respuestas_validas, 1L)
  expect_identical(fila$fuera_universo, 1L)
})

test_that("la facultad de una respuesta la decide el plan; su columna solo rellena sin match", {
  plan <- data.frame(
    classroom_id = "A1", collection_unit_id = "unit-1", faculty = "FAC1",
    stringsAsFactors = FALSE
  )
  respuestas <- data.frame(facultad = c("OTRA", "OTRA"), stringsAsFactors = FALSE)
  expect_identical(
    .monitoreo_aulas_response_faculty_values(respuestas, plan, c("A1", "ZZZ")),
    c("FAC1", "OTRA")
  )
})

# --- wiring del tablero -------------------------------------------------------

test_that("el ritmo hereda la cuota vigente y el bloque es la unica fuente del avance", {
  plan <- list(.avc_aula("A1", "FAC1", expected = 10))
  d <- .avc_dash(plan, .avc_resp(c("A1", "A1")),
                 dt = .avc_dt(list(.avc_fac("FAC1", 10), .avc_fac("FAC2", 6))))
  expect_identical(d$ritmo_diario$meta, 16)
  expect_equal(d$avance_cuota$total$avance_pct, 12.5)
  # Capacidad sin consumidor no se publica: el chip de la UI lee el bloque, no
  # un eco en los KPIs.
  expect_false("cuota_diseno_total" %in% names(d$kpis))
  expect_false("avance_cuota_pct" %in% names(d$kpis))
})
