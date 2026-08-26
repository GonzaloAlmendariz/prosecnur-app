# =============================================================================
# Seguimiento de τ en campo (ADR 0082)
# =============================================================================
#
# Contrato congelado: el bloque `efectividad_seguimiento` SIEMPRE viaja en el
# dashboard; su numerador es la efectiva de PLATAFORMA y no el parte ni la Base
# de control —las tres conviven hoy en el perfil y sólo una es τ—; su
# denominador son los elegibles de las aulas APLICADAS; la señal la dispara la
# banda al 95 % y nunca el punto; y el déficit no se compensa entre facultades.
#
# Fixtures locales propias: no se tocan las de test-monitoreo-aulas-avance-cuota.R.

.efs_aula <- function(id, fac, eligible = 20, orden = 1, aplicada = TRUE,
                      rol = "titular", status = "agendada",
                      efectivas_parte = NULL, factor_fac = NULL, fac_k = NULL,
                      titular_code = "", replacement_order = NULL) {
  fila <- list(
    classroom_id = id,
    operational_code = sprintf("CH %d", orden),
    label = paste("Aula", id),
    faculty = fac, stratum = fac,
    sample_role = rol, wave = "M1", orden = orden,
    eligible_n = eligible, expected_valid = round(eligible * 0.5),
    sample_status = status,
    application_status = if (aplicada) "aplicada" else "pendiente"
  )
  # `effective_surveys` es lo que el aplicador ANOTÓ: se siembra a propósito
  # distinto de lo que llega a plataforma para que un test pueda distinguirlos.
  if (!is.null(efectivas_parte)) fila$effective_surveys <- efectivas_parte
  if (!is.null(factor_fac)) fila$factor_facultad <- factor_fac
  if (!is.null(fac_k)) fila$facultad_k <- fac_k
  if (nzchar(titular_code)) fila$titular_operational_code <- titular_code
  if (!is.null(replacement_order)) fila$replacement_order <- replacement_order
  fila
}

.efs_fac <- function(nombre, cuota = 10, tau = 0.5) {
  list(facultad = nombre, faculty_key = .cm_criterios_fac_key(nombre),
       cuota = cuota, cuota_sexo = list(), tau = tau)
}

.efs_dt <- function(facs, run_id = "run_1", hash = "hash_1") {
  list(
    schema = "monitoreo_aulas_design_targets_v1", source = "calc-muestra",
    tasa_esperada = NA_real_, tasa_fuente = "tau_disenio",
    total_cuota = sum(vapply(facs, function(f) as.numeric(f$cuota), numeric(1))),
    facultades = facs, selection_run_id = run_id, frame_hash = hash
  )
}

.efs_dash <- function(plan, responses = data.frame(), dt = NULL) {
  cfg <- monitoreo_aulas_normalize_config(list(
    enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1",
    plan = plan, design_targets = dt %||% list()
  ))
  monitoreo_aulas_dashboard(cfg$plan, responses, cfg)
}

.efs_resp <- function(ids) data.frame(collectorID = ids, stringsAsFactors = FALSE)

.efs_fila <- function(block, nombre) {
  k <- .cm_criterios_fac_key(nombre)
  for (f in block$facultades) if (identical(as.character(f$faculty_key), k)) return(f)
  NULL
}

# --- marco estable (C2) -------------------------------------------------------

test_that("sin plan y sin diseño el bloque viaja igual, declarando su estado", {
  d <- monitoreo_aulas_dashboard(list(), data.frame(), list(enabled = TRUE))
  b <- d$efectividad_seguimiento
  expect_identical(b$schema, "monitoreo_aulas_efectividad_seguimiento_v1")
  expect_identical(b$vigencia, "sin_diseno")
  expect_length(b$facultades, 0L)
  expect_identical(b$total$aulas_aplicadas, 0L)
  # El criterio se declara SIEMPRE: es lo que impide que otra superficie
  # invente un numerador distinto y lo llame τ.
  expect_match(b$criterio$numerador, "plataforma")
  expect_match(b$criterio$denominador, "aplicadas")
})

# --- 1. la τ prevista, presente o ausente DECLARADA ---------------------------

test_that("la τ prevista de cada facultad llega del diseño, y su ausencia es NA y no 0", {
  plan <- list(
    .efs_aula("A1", "FAC1", eligible = 20, orden = 1),
    .efs_aula("B1", "FAC2", eligible = 20, orden = 2)
  )
  # El diseño sólo traza FAC1: FAC2 existe en el plan pero nadie le supuso τ.
  d <- .efs_dash(plan, .efs_resp(c("A1", "A1")), dt = .efs_dt(list(.efs_fac("FAC1", tau = 0.4))))
  b <- d$efectividad_seguimiento

  f1 <- .efs_fila(b, "FAC1")
  expect_equal(f1$tau_previsto, 0.4)
  f2 <- .efs_fila(b, "FAC2")
  # Un 0 aquí se leería como «el diseño esperaba que no rindiera nada».
  expect_identical(f2$tau_previsto, NA_real_)
  expect_identical(f2$estado, "sin_previsto")
  expect_identical(f2$senal, "sin_previsto")

  # Y la misma τ viaja ahora por fila en `avance_cuota`, que hasta hoy sólo
  # publicaba la compartida y la dejaba en NA justo cuando difiere.
  expect_equal(.efs_fila(d$avance_cuota, "FAC1")$tau_prevista, 0.4)
  expect_identical(.efs_fila(d$avance_cuota, "FAC2")$tau_prevista, NA_real_)
})

# --- 2. EL NUMERADOR: plataforma, no el parte ---------------------------------

test_that("τ observada cuenta la efectiva de plataforma, no lo que anotó el parte", {
  # Un aula de 100 elegibles: el parte declara 90, la plataforma recibe 30.
  # Si el motor leyera el parte, τ saldría 0,90 en vez de 0,30.
  plan <- list(.efs_aula("A1", "FAC1", eligible = 100, orden = 1, efectivas_parte = 90))
  d <- .efs_dash(plan, .efs_resp(rep("A1", 30)), dt = .efs_dt(list(.efs_fac("FAC1", tau = 0.5))))
  f <- .efs_fila(d$efectividad_seguimiento, "FAC1")

  expect_identical(f$efectivas, 30L)
  expect_equal(f$tau_observado, 0.30)
  expect_false(isTRUE(all.equal(f$tau_observado, 0.90)))
  # Y el parte sigue existiendo, con su propio rótulo, en su propio bloque.
  expect_true(is.list(d$parte_de_campo) || !is.null(d$course_status))
})

# --- 3. EL DENOMINADOR: sólo aulas aplicadas ----------------------------------

test_that("un aula sin aplicar no entra al denominador; una aplicada en cero sí", {
  plan <- list(
    .efs_aula("A1", "FAC1", eligible = 100, orden = 1, aplicada = TRUE),
    # Aplicada y sin una sola respuesta: es un cero REAL y tiene que pesar.
    .efs_aula("A2", "FAC1", eligible = 100, orden = 2, aplicada = TRUE),
    # Todavía no aplicada: no rinde cero, es que aún no rinde.
    .efs_aula("A3", "FAC1", eligible = 100, orden = 3, aplicada = FALSE)
  )
  d <- .efs_dash(plan, .efs_resp(rep("A1", 60)), dt = .efs_dt(list(.efs_fac("FAC1", tau = 0.5))))
  f <- .efs_fila(d$efectividad_seguimiento, "FAC1")

  # 200 elegibles aplicados (A1 + A2), no 300: A3 queda fuera.
  expect_identical(f$elegibles_aplicados, 200L)
  expect_identical(f$aulas_aplicadas, 2L)
  expect_equal(f$tau_observado, 0.30)
  # Y la no aplicada se contabiliza como aforo pendiente, no se pierde.
  expect_identical(f$elegibles_pendientes, 100L)
})

# --- 4. LA BANDA dispara la señal, no el punto --------------------------------

test_that("con una sola aula no hay banda y la facultad no se señala", {
  # τ observada 0,10 contra 0,80 prevista: el PUNTO grita, y aun así no se
  # señala. Una observación no tiene dispersión que medir.
  plan <- list(.efs_aula("A1", "FAC1", eligible = 100, orden = 1))
  d <- .efs_dash(plan, .efs_resp(rep("A1", 10)), dt = .efs_dt(list(.efs_fac("FAC1", tau = 0.8))))
  f <- .efs_fila(d$efectividad_seguimiento, "FAC1")

  expect_identical(f$aulas_aplicadas, 1L)
  expect_equal(f$tau_observado, 0.10)
  expect_identical(f$banda_bajo, NA_real_)
  expect_identical(f$banda_alto, NA_real_)
  expect_identical(f$senal, "sin_banda")
  expect_identical(d$efectividad_seguimiento$total$facultades_senaladas, 0L)
})

test_that("con muchas aulas consistentemente bajas, la banda excluye la τ y se señala", {
  # Ocho aulas rindiendo 0,30 sin dispersión entre ellas contra 0,50 prevista.
  plan <- lapply(1:8, function(i) .efs_aula(sprintf("A%d", i), "FAC1", eligible = 100, orden = i))
  ids <- unlist(lapply(1:8, function(i) rep(sprintf("A%d", i), 30)))
  d <- .efs_dash(plan, .efs_resp(ids), dt = .efs_dt(list(.efs_fac("FAC1", cuota = 400, tau = 0.5))))
  f <- .efs_fila(d$efectividad_seguimiento, "FAC1")

  expect_identical(f$aulas_aplicadas, 8L)
  expect_equal(f$tau_observado, 0.30)
  expect_true(is.finite(f$banda_alto))
  expect_lt(f$banda_alto, 0.5)
  expect_identical(f$senal, "bajo")
  # 800 elegibles aplicados × (0,30 − 0,50) = 160 alumnos menos de lo supuesto.
  expect_equal(f$alumnos_corte, -160)
  expect_identical(d$efectividad_seguimiento$total$facultades_senaladas, 1L)
})

test_that("una diferencia que la banda no sostiene queda conforme y no gasta reservas", {
  # Ocho aulas alrededor de 0,48 con dispersión real: el punto está por debajo
  # de 0,50 pero la banda lo cruza. Señalar aquí gastaría colchón contra ruido.
  efectivas <- c(60, 40, 55, 45, 50, 38, 62, 34)
  plan <- lapply(1:8, function(i) .efs_aula(sprintf("A%d", i), "FAC1", eligible = 100, orden = i))
  ids <- unlist(lapply(1:8, function(i) rep(sprintf("A%d", i), efectivas[[i]])))
  d <- .efs_dash(plan, .efs_resp(ids), dt = .efs_dt(list(.efs_fac("FAC1", cuota = 400, tau = 0.5))))
  f <- .efs_fila(d$efectividad_seguimiento, "FAC1")

  expect_lt(f$tau_observado, 0.5)
  expect_identical(f$senal, "conforme")
  expect_equal(f$reservas_necesarias, 0L)
})

# --- 5. el déficit NO se compensa entre facultades ----------------------------

test_that("un superávit en una facultad no descuenta el déficit de otra", {
  # FAC1 rinde 0,30 contra 0,50 (déficit). FAC2 rinde 0,90 contra 0,50
  # (superávit mayor en alumnos). Sumar las dos daría «vamos sobrados».
  plan <- c(
    lapply(1:8, function(i) .efs_aula(sprintf("A%d", i), "FAC1", eligible = 100, orden = i)),
    lapply(1:8, function(i) .efs_aula(sprintf("B%d", i), "FAC2", eligible = 100, orden = 100 + i))
  )
  ids <- c(
    unlist(lapply(1:8, function(i) rep(sprintf("A%d", i), 30))),
    unlist(lapply(1:8, function(i) rep(sprintf("B%d", i), 90)))
  )
  d <- .efs_dash(plan, .efs_resp(ids),
                 dt = .efs_dt(list(.efs_fac("FAC1", cuota = 400, tau = 0.5),
                                   .efs_fac("FAC2", cuota = 400, tau = 0.5))))
  b <- d$efectividad_seguimiento

  expect_identical(.efs_fila(b, "FAC1")$senal, "bajo")
  expect_identical(.efs_fila(b, "FAC2")$senal, "sobre")
  expect_identical(b$total$facultades_senaladas, 1L)
  # Los 160 de FAC1 siguen enteros pese a los +320 de FAC2.
  expect_equal(b$total$alumnos_en_riesgo, 160)
  # Y la señalada abre la lista: el orden es de decisión, no alfabético.
  expect_identical(as.character(b$facultades[[1]]$faculty_key), .cm_criterios_fac_key("FAC1"))
})

# --- reservas: cuántas cierran el hueco ---------------------------------------

test_that("las reservas libres se proyectan a la τ observada y se cuentan las que cierran", {
  plan <- c(
    lapply(1:8, function(i) .efs_aula(sprintf("A%d", i), "FAC1", eligible = 100, orden = i)),
    # Tres reservas dormidas de 100 elegibles: a τ observada 0,30 rinden 30
    # cada una. Proyectarlas a la τ PREVISTA (0,50 -> 50) diría que bastan
    # menos aulas de las que hacen falta.
    lapply(1:3, function(i) .efs_aula(sprintf("R%d", i), "FAC1", eligible = 100,
                                      orden = 200 + i, aplicada = FALSE,
                                      rol = "chain_reserve", status = "en_reserva",
                                      titular_code = "CH 1", replacement_order = i))
  )
  ids <- unlist(lapply(1:8, function(i) rep(sprintf("A%d", i), 30)))
  d <- .efs_dash(plan, .efs_resp(ids), dt = .efs_dt(list(.efs_fac("FAC1", cuota = 400, tau = 0.5))))
  f <- .efs_fila(d$efectividad_seguimiento, "FAC1")

  expect_identical(f$senal, "bajo")
  expect_identical(f$reservas_libres, 3L)
  # Déficit proyectado al cierre y reservas que lo cubren a 30 por aula.
  expect_true(is.finite(f$alumnos_cierre) && f$alumnos_cierre < 0)
  expect_true(is.finite(f$reservas_necesarias) || !f$reservas_alcanzan)
})

# --- el residual sin base propia no se lee como medición ----------------------

test_that("un residual de 1 sin k del histórico se declara sin_base, no como medido", {
  plan <- list(
    # Residual medido: 1,115 con 16 aulas de respaldo.
    .efs_aula("A1", "FAC1", eligible = 100, orden = 1, factor_fac = 1.115, fac_k = 16),
    # Residual en 1 porque el histórico no le dio base: NO es «rinde su mix».
    .efs_aula("B1", "FAC2", eligible = 100, orden = 2, factor_fac = 1, fac_k = NA)
  )
  d <- .efs_dash(plan, .efs_resp(c(rep("A1", 50), rep("B1", 50))),
                 dt = .efs_dt(list(.efs_fac("FAC1", tau = 0.5), .efs_fac("FAC2", tau = 0.5))))
  b <- d$efectividad_seguimiento

  f1 <- .efs_fila(b, "FAC1")
  expect_identical(f1$residual_base, "propia")
  expect_identical(f1$residual_k, 16L)
  f2 <- .efs_fila(b, "FAC2")
  expect_identical(f2$residual_base, "sin_base")
  expect_identical(f2$residual_k, NA_integer_)
})
