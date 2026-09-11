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
                      titular_code = "", replacement_order = NULL,
                      # Sin esto toda fila no aplicada nacía «agendada» en los dos
                      # ejes y no había forma de sembrar una SIN agendar, que es
                      # justo lo que separa las dos proyecciones.
                      op_status = NULL, fecha = NULL) {
  fila <- list(
    classroom_id = id,
    operational_code = sprintf("CH %d", orden),
    label = paste("Aula", id),
    faculty = fac, stratum = fac,
    sample_role = rol, wave = "M1", orden = orden,
    eligible_n = eligible, expected_valid = round(eligible * 0.5),
    sample_status = status,
    # El eje de aplicacion es `operational_status`, que es el que cuenta el KPI
    # del tablero. `application_status` se deja DIVERGENTE a proposito —siempre
    # sin llenar, como llega de un estudio real— para que un motor que lea la
    # columna equivocada de rojo aqui en vez de en pantalla.
    operational_status = if (aplicada) "aplicada" else (op_status %||% "agendada"),
    application_status = ""
  )
  # `effective_surveys` es lo que el aplicador ANOTÓ: se siembra a propósito
  # distinto de lo que llega a plataforma para que un test pueda distinguirlos.
  if (!is.null(fecha)) fila$scheduled_date <- fecha
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
  expect_match(b$criterio$denominador, "aplicados")
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
  expect_identical(d$efectividad_seguimiento$total$facultades_bajo_su_tau, 0L)
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
  expect_identical(d$efectividad_seguimiento$total$facultades_bajo_su_tau, 1L)
})

test_that("una diferencia que la banda no sostiene queda conforme y no gasta reservas", {
  # Ocho aulas alrededor de 0,48 con dispersión real: el punto está por debajo
  # de 0,50 pero la banda lo cruza. Señalar aquí gastaría colchón contra ruido.
  efectivas <- c(60, 40, 55, 45, 50, 38, 62, 34)   # 384 en total
  plan <- lapply(1:8, function(i) .efs_aula(sprintf("A%d", i), "FAC1", eligible = 100, orden = i))
  ids <- unlist(lapply(1:8, function(i) rep(sprintf("A%d", i), efectivas[[i]])))
  # Cuota 200: la facultad va sobrada, así que lo único que se está probando
  # aquí es el veredicto de la BANDA. Con cuota 400 estaría corta de 16 alumnos
  # de verdad y el test mediría el margen sin quererlo.
  d <- .efs_dash(plan, .efs_resp(ids), dt = .efs_dt(list(.efs_fac("FAC1", cuota = 200, tau = 0.5))))
  f <- .efs_fila(d$efectividad_seguimiento, "FAC1")

  expect_lt(f$tau_observado, 0.5)
  expect_identical(f$senal, "conforme")
  # Y no gasta reservas: el disparador es el margen, y con la cuota cubierta
  # no hay hueco que cerrar por mucho que el punto esté bajo la τ prevista.
  expect_identical(f$riesgo, "holgado")
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
  expect_identical(b$total$facultades_bajo_su_tau, 1L)
  # FAC1 rinde bajo su τ Y no cierra su cuota (400 contra 240 conseguidas), así
  # que los dos conteos coinciden aquí. El déficit del margen de FAC1 sigue
  # entero pese al superávit de FAC2: no se compensa entre facultades.
  expect_identical(b$total$facultades_en_riesgo, 1L)
  expect_gt(b$total$alumnos_en_riesgo, 0)
  expect_identical(.efs_fila(b, "FAC2")$riesgo, "holgado")
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

# --- EL DISPARADOR: el margen, no la banda (opcion «d», 2026-08-26) ----------

test_that("una facultad puede rendir bajo su tau y NO estar en riesgo, porque compro colchon", {
  # Ocho aulas de 100 elegibles rindiendo 0,30 contra 0,50 previsto: la banda la
  # senala `bajo`. Pero su cuota es 100 y ya lleva 240: el margen sobra.
  # Medido en la seleccion 2026, el margen mediano es +49,2 % de la cuota, asi
  # que este caso es el NORMAL, no el raro.
  plan <- lapply(1:8, function(i) .efs_aula(sprintf("A%d", i), "FAC1", eligible = 100, orden = i))
  ids <- unlist(lapply(1:8, function(i) rep(sprintf("A%d", i), 30)))
  d <- .efs_dash(plan, .efs_resp(ids), dt = .efs_dt(list(.efs_fac("FAC1", cuota = 100, tau = 0.5))))
  f <- .efs_fila(d$efectividad_seguimiento, "FAC1")

  expect_identical(f$senal, "bajo")        # la banda dice que rinde por debajo
  expect_identical(f$riesgo, "holgado")    # y aun asi la cuota esta cubierta
  expect_equal(f$conseguido, 240)
  expect_gt(f$margen_restante, 0)
  # Y NO gasta reservas por rendir bajo: el hueco que cierran es el del margen.
  expect_equal(f$reservas_necesarias, 0L)
  expect_identical(d$efectividad_seguimiento$total$facultades_en_riesgo, 0L)
  expect_identical(d$efectividad_seguimiento$total$facultades_bajo_su_tau, 1L)
})

test_that("el riesgo es FIRME solo cuando ni el extremo optimista de la banda cierra", {
  # Cuatro aulas aplicadas de 100 y cuatro pendientes de 100. Rinde 0,30 con
  # dispersion; la cuota de 600 no la alcanza ni proyectando al mejor extremo.
  aplicadas <- lapply(1:4, function(i) .efs_aula(sprintf("A%d", i), "FAC1", eligible = 100, orden = i))
  pendientes <- lapply(5:8, function(i) .efs_aula(sprintf("A%d", i), "FAC1", eligible = 100,
                                                  orden = i, aplicada = FALSE))
  ids <- unlist(lapply(1:4, function(i) rep(sprintf("A%d", i), c(34, 26, 32, 28)[i])))
  d <- .efs_dash(c(aplicadas, pendientes), .efs_resp(ids),
                 dt = .efs_dt(list(.efs_fac("FAC1", cuota = 600, tau = 0.5))))
  f <- .efs_fila(d$efectividad_seguimiento, "FAC1")

  expect_identical(f$riesgo, "riesgo_firme")
  expect_lt(f$proyectado_optimista, 600)
  expect_lt(f$margen_restante, 0)
  expect_identical(d$efectividad_seguimiento$total$facultades_en_riesgo, 1L)
})

test_that("el aforo pendiente se proyecta a la tau OBSERVADA, no a la prevista", {
  # 2 aplicadas de 100 rindiendo 0,30 y 2 pendientes de 100. A la observada la
  # proyeccion es 60 + 60 = 120; a la prevista (0,50) seria 60 + 100 = 160.
  # Con cuota 150, la eleccion decide si esta en riesgo o no.
  aplicadas <- lapply(1:2, function(i) .efs_aula(sprintf("A%d", i), "FAC1", eligible = 100, orden = i))
  pendientes <- lapply(3:4, function(i) .efs_aula(sprintf("A%d", i), "FAC1", eligible = 100,
                                                  orden = i, aplicada = FALSE))
  ids <- unlist(lapply(1:2, function(i) rep(sprintf("A%d", i), 30)))
  d <- .efs_dash(c(aplicadas, pendientes), .efs_resp(ids),
                 dt = .efs_dt(list(.efs_fac("FAC1", cuota = 150, tau = 0.5))))
  f <- .efs_fila(d$efectividad_seguimiento, "FAC1")

  expect_equal(f$conseguido, 60)
  expect_identical(f$elegibles_pendientes, 200L)
  expect_equal(f$proyectado, 120)          # 60 + 200 x 0,30
  expect_false(isTRUE(all.equal(f$proyectado, 160)))  # NO 60 + 200 x 0,50
  expect_true(f$riesgo %in% c("riesgo", "riesgo_firme"))
})

test_that("sin campo el margen no se proyecta con la tau prevista: se declara", {
  # Publicar el supuesto como si fuera medicion es lo que el ADR 0082 existe
  # para impedir.
  plan <- list(.efs_aula("A1", "FAC1", eligible = 100, orden = 1, aplicada = FALSE))
  d <- .efs_dash(plan, data.frame(), dt = .efs_dt(list(.efs_fac("FAC1", cuota = 50, tau = 0.5))))
  f <- .efs_fila(d$efectividad_seguimiento, "FAC1")

  expect_identical(f$riesgo, "sin_campo")
  expect_identical(f$proyectado, NA_real_)
  expect_identical(f$margen_restante, NA_real_)
})

test_that("el criterio declara que el disparador es el margen y la banda es la guarda", {
  d <- monitoreo_aulas_dashboard(list(), data.frame(), list(enabled = TRUE))
  cr <- d$efectividad_seguimiento$criterio
  expect_match(cr$disparador, "margen")
  expect_match(cr$guarda, "banda")
})

# --- el eje de aplicacion, con su regresion ----------------------------------

test_that("un aula aplicada cuenta aunque el parte no declare nada", {
  # Medido sobre la fixture del operativo completo el 2026-08-26: 152 aulas
  # aplicadas por `operational_status` y CERO por `application_status`, que
  # llega vacio en las 269 filas. El motor leia la segunda y la pestana salia
  # vacia entera al lado de un KPI que decia 152.
  plan <- list(
    .efs_aula("A1", "FAC1", eligible = 100, orden = 1, aplicada = TRUE),
    .efs_aula("A2", "FAC1", eligible = 100, orden = 2, aplicada = FALSE)
  )
  # Ni una sola fila declara `application_status`: es el estado real del plan.
  expect_true(all(vapply(plan, function(f) !nzchar(f$application_status), logical(1))))

  d <- .efs_dash(plan, .efs_resp(rep("A1", 40)), dt = .efs_dt(list(.efs_fac("FAC1", tau = 0.5))))
  f <- .efs_fila(d$efectividad_seguimiento, "FAC1")

  expect_identical(f$aulas_aplicadas, 1L)
  expect_identical(f$elegibles_aplicados, 100L)
  expect_equal(f$tau_observado, 0.40)
  # Y coincide con el KPI del mismo tablero: dos superficies vecinas que cuentan
  # lo mismo de dos maneras acaban discrepando.
  expect_identical(d$kpis$aulas_aplicadas, 1L)
})

test_that("`cerrada` tambien es aplicada, igual que en el KPI", {
  plan <- list(.efs_aula("A1", "FAC1", eligible = 100, orden = 1, aplicada = TRUE))
  plan[[1]]$operational_status <- "cerrada"
  d <- .efs_dash(plan, .efs_resp(rep("A1", 50)), dt = .efs_dt(list(.efs_fac("FAC1", tau = 0.5))))
  f <- .efs_fila(d$efectividad_seguimiento, "FAC1")
  expect_identical(f$aulas_aplicadas, 1L)
  expect_equal(f$tau_observado, 0.50)
})

# --- el banco cuenta como recurso ---------------------------------------------

test_that("una facultad sin reservas de cadena pero con banco deja de decir «0 libres»", {
  # Medido en pantalla el 2026-08-26 sobre la fixture del operativo completo:
  # las VEINTE facultades salian «0 libres» teniendo 73 aulas de banco delante.
  # El banco no reemplaza a un titular —son aulas adicionales para cerrar cuota
  # por facultad y sexo— pero para tapar un hueco de margen sirve igual.
  aplicadas <- lapply(1:4, function(i) .efs_aula(sprintf("A%d", i), "FAC1", eligible = 100, orden = i))
  banco <- lapply(1:5, function(i) .efs_aula(sprintf("X%d", i), "FAC1", eligible = 100,
                                             orden = 300 + i, aplicada = FALSE,
                                             rol = "extra_reserve_pool", status = "en_reserva"))
  ids <- unlist(lapply(1:4, function(i) rep(sprintf("A%d", i), 30)))
  d <- .efs_dash(c(aplicadas, banco), .efs_resp(ids),
                 dt = .efs_dt(list(.efs_fac("FAC1", cuota = 200, tau = 0.5))))
  f <- .efs_fila(d$efectividad_seguimiento, "FAC1")

  expect_identical(f$reservas_libres, 0L)      # ninguna cadena
  expect_identical(f$banco_disponible, 5L)     # pero cinco de banco
  expect_true(f$riesgo %in% c("riesgo", "riesgo_firme"))
  # Y las que cierran salen del banco, declarado como tal.
  expect_true(f$reservas_alcanzan)
  expect_identical(f$reservas_de_cadena, 0L)
  expect_gt(f$reservas_de_banco, 0L)
})

test_that("la cadena se gasta antes que el banco, y se dice cuantas de cada uno", {
  aplicadas <- lapply(1:4, function(i) .efs_aula(sprintf("A%d", i), "FAC1", eligible = 100, orden = i))
  cadena <- .efs_aula("R1", "FAC1", eligible = 100, orden = 200, aplicada = FALSE,
                      rol = "chain_reserve", status = "en_reserva",
                      titular_code = "CH 1", replacement_order = 1)
  banco <- lapply(1:5, function(i) .efs_aula(sprintf("X%d", i), "FAC1", eligible = 100,
                                             orden = 300 + i, aplicada = FALSE,
                                             rol = "extra_reserve_pool", status = "en_reserva"))
  ids <- unlist(lapply(1:4, function(i) rep(sprintf("A%d", i), 30)))
  d <- .efs_dash(c(aplicadas, list(cadena), banco), .efs_resp(ids),
                 dt = .efs_dt(list(.efs_fac("FAC1", cuota = 250, tau = 0.5))))
  f <- .efs_fila(d$efectividad_seguimiento, "FAC1")

  expect_identical(f$reservas_libres, 1L)
  expect_identical(f$banco_disponible, 5L)
  # Activar la cadena es seguir el plan; echar mano del banco es otra decisión.
  expect_identical(f$reservas_de_cadena, 1L)
  expect_gt(f$reservas_de_banco, 0L)
  expect_equal(f$reservas_necesarias, f$reservas_de_cadena + f$reservas_de_banco)
})

# --- la segunda proyección: sólo sobre lo agendado ----------------------------
#
# Gonzalo, 2026-09-11: «que el motor proyecte también sólo sobre lo agendado
# (que finalmente es lo que más importa siempre, porque es lo que tenemos)».
#
# El disparador: en pantalla convivían «Con lo agendado, todas las facultades
# cierran su cuota» y un panel que decía que cinco no llegaban. Ninguna mentía —
# el motor proyectaba sobre TODO el eslabón en juego, agendado o no— pero las
# dos se llamaban «lo agendado».

test_that("con todo el pendiente agendado las dos proyecciones coinciden", {
  plan <- list(
    .efs_aula("A1", "Derecho", eligible = 20, orden = 1, aplicada = TRUE),
    .efs_aula("A2", "Derecho", eligible = 20, orden = 2, aplicada = FALSE, status = "agendada")
  )
  d <- .efs_dash(plan, .efs_resp(rep("A1", 10)), .efs_dt(list(.efs_fac("Derecho", cuota = 10))))
  f <- .efs_fila(d$efectividad_seguimiento, "Derecho")
  expect_identical(f$elegibles_agendados, f$elegibles_pendientes)
  expect_equal(f$proyectado_agendado, f$proyectado)
  expect_identical(f$riesgo_agendado, f$riesgo)
})

test_that("un curso-horario sin agendar entra en el aforo del plan y NO en el agendado", {
  plan <- list(
    .efs_aula("A1", "Derecho", eligible = 20, orden = 1, aplicada = TRUE),
    # Con fecha: cuenta en las dos.
    .efs_aula("A2", "Derecho", eligible = 20, orden = 2, aplicada = FALSE, status = "agendada"),
    # Sin contactar en los dos ejes: es aforo del plan, pero no hay día en que
    # se pueda aplicar. Es la distancia entre las dos proyecciones.
    .efs_aula("A3", "Derecho", eligible = 60, orden = 3, aplicada = FALSE,
              status = "sin_contactar", op_status = "planificada")
  )
  d <- .efs_dash(plan, .efs_resp(rep("A1", 10)), .efs_dt(list(.efs_fac("Derecho", cuota = 10))))
  f <- .efs_fila(d$efectividad_seguimiento, "Derecho")
  expect_identical(f$elegibles_pendientes, 80L)
  expect_identical(f$elegibles_agendados, 20L)
  # τ observada 0,5: el plan entero proyecta 10 + 40 y lo agendado 10 + 10.
  expect_equal(f$proyectado, 50)
  expect_equal(f$proyectado_agendado, 20)
  expect_identical(f$cursos_agendados, 1L)
})

test_that("una facultad puede estar holgada en el plan y en riesgo con lo agendado", {
  plan <- list(
    .efs_aula("A1", "Gestion", eligible = 20, orden = 1, aplicada = TRUE),
    .efs_aula("A2", "Gestion", eligible = 20, orden = 2, aplicada = FALSE, status = "agendada"),
    .efs_aula("A3", "Gestion", eligible = 200, orden = 3, aplicada = FALSE,
              status = "sin_contactar", op_status = "planificada")
  )
  # Cuota 60: con el plan entero proyecta 10 + 110 = 120 y cierra; con lo
  # agendado, 10 + 10 = 20 y no. Es el caso de Derecho en HSVG26ULT2.
  d <- .efs_dash(plan, .efs_resp(rep("A1", 10)), .efs_dt(list(.efs_fac("Gestion", cuota = 60))))
  b <- d$efectividad_seguimiento
  f <- .efs_fila(b, "Gestion")
  expect_identical(f$riesgo, "holgado")
  expect_true(f$riesgo_agendado %in% c("riesgo", "riesgo_firme"))
  expect_equal(f$margen_agendado, -40)
  expect_identical(b$total$facultades_en_riesgo, 0L)
  expect_identical(b$total$facultades_en_riesgo_agendado, 1L)
  expect_equal(b$total$alumnos_en_riesgo_agendado, 40)
  # Y el déficit del plan sigue en cero: son dos preguntas y se publican las dos.
  expect_equal(b$total$alumnos_en_riesgo, 0)
})

test_that("la fecha se lee del estado de muestra Y de la columna de fecha", {
  # Lo teclea quien coordina en el eje de muestra y el registro de campo llega
  # tarde: mirar sólo el operativo dejó 22 aulas con fecha como «Sin agendar».
  plan <- list(
    .efs_aula("A1", "Letras", eligible = 20, orden = 1, aplicada = TRUE),
    .efs_aula("A2", "Letras", eligible = 20, orden = 2, aplicada = FALSE,
              status = "agendada", op_status = "planificada"),
    .efs_aula("A3", "Letras", eligible = 20, orden = 3, aplicada = FALSE,
              status = "sin_contactar", op_status = "planificada", fecha = "2026-09-14")
  )
  d <- .efs_dash(plan, .efs_resp(rep("A1", 10)), .efs_dt(list(.efs_fac("Letras", cuota = 10))))
  f <- .efs_fila(d$efectividad_seguimiento, "Letras")
  expect_identical(f$elegibles_agendados, 40L)
  expect_identical(f$cursos_agendados, 2L)
})

test_that("CONTACTAR no es agendar: sin fecha no entra en la proyección", {
  # Gonzalo, 2026-09-11: «un CH puede estar en titulares (planificado) pero hasta
  # que no esté agendado no sabemos realmente si vamos a poder aplicar allí».
  # Medido en HSVG26ULT2: Derecho tenía 6 cursos-horario con fecha y otros 6 en
  # `en_contacto`; contando los doce pasaba de 234 elegibles agendados a 488 y
  # salía holgada sin tener las citas.
  plan <- list(
    .efs_aula("A1", "Psico", eligible = 20, orden = 1, aplicada = TRUE),
    .efs_aula("A2", "Psico", eligible = 20, orden = 2, aplicada = FALSE,
              status = "agendada", op_status = "planificada", fecha = "2026-09-14"),
    .efs_aula("A3", "Psico", eligible = 100, orden = 3, aplicada = FALSE,
              status = "en_contacto", op_status = "contactada")
  )
  d <- .efs_dash(plan, .efs_resp(rep("A1", 10)), .efs_dt(list(.efs_fac("Psico", cuota = 40))))
  f <- .efs_fila(d$efectividad_seguimiento, "Psico")
  expect_identical(f$elegibles_agendados, 20L)
  expect_identical(f$cursos_agendados, 1L)
  # Y sigue contándose entre lo que queda por agendar, que es donde sirve.
  expect_identical(f$cursos_sin_agendar, 1L)
  # Con 20 elegibles al 50 % no llega a 40: sin la corrección salía holgada.
  expect_true(f$riesgo_agendado %in% c("riesgo", "riesgo_firme"))
})

test_that("los dos predicados contestan preguntas distintas y no se confunden", {
  # `.maau_agendada` = ¿está en marcha? (rotula «Sin agendar»).
  # `.maau_con_fecha` = ¿hay día en que aplicar? (proyecta aforo).
  expect_true(.maau_agendada("en_contacto", "contactada"))
  expect_false(.maau_con_fecha("en_contacto", "", "contactada"))
  expect_true(.maau_con_fecha("sin_contactar", "2026-09-14", "planificada"))
  expect_true(.maau_con_fecha("AGENDADA", "", "planificada"))
  expect_false(.maau_con_fecha("sin_contactar", "", "planificada"))
  expect_identical(.maau_con_fecha(character(0), character(0), character(0)), logical(0))
})

test_that("sin nada agendado la proyección es lo conseguido, no un NA", {
  plan <- list(
    .efs_aula("A1", "Arte", eligible = 20, orden = 1, aplicada = TRUE),
    .efs_aula("A2", "Arte", eligible = 40, orden = 2, aplicada = FALSE,
              status = "sin_contactar", op_status = "planificada")
  )
  d <- .efs_dash(plan, .efs_resp(rep("A1", 10)), .efs_dt(list(.efs_fac("Arte", cuota = 30))))
  f <- .efs_fila(d$efectividad_seguimiento, "Arte")
  expect_identical(f$elegibles_agendados, 0L)
  expect_identical(f$cursos_agendados, 0L)
  # Lo agendado no aporta nada: la proyección es lo que ya se consiguió.
  expect_equal(f$proyectado_agendado, 10)
  expect_identical(f$riesgo_agendado, "riesgo_firme")
})

test_that("el predicado de agendada tiene un solo dueño", {
  # Si alguien lo reescribe en otro sitio, las dos definiciones se separan: es
  # la palabra que el operativo usa en dos ejes distintos.
  expect_true(.maau_agendada("AGENDADA", "planificada"))
  expect_true(.maau_agendada(" Reagendada ", ""))
  expect_true(.maau_agendada("sin_contactar", "CONTACTADA"))
  expect_false(.maau_agendada("sin_contactar", "planificada"))
  expect_false(.maau_agendada("en_reserva", "planificada"))
  expect_false(.maau_agendada(NA, NA))
  expect_identical(.maau_agendada(character(0), character(0)), logical(0))
})

test_that("separa lo que se puede agendar de lo que exige reserva", {
  # Gonzalo, 2026-09-11 mirando Derecho: «sospecho que en gran parte es porque
  # nos falta agendar […] pero ninguno se complementa ni me dice si aquello es
  # necesario». Las dos acciones cuestan cosas distintas: agendar un titular que
  # ya es tuyo no gasta nada; llamar a un docente de refuerzo gasta una reserva
  # que no se comparte entre facultades.
  plan <- list(
    .efs_aula("A1", "Derecho", eligible = 20, orden = 1, aplicada = TRUE),
    .efs_aula("A2", "Derecho", eligible = 20, orden = 2, aplicada = FALSE, status = "agendada"),
    .efs_aula("A3", "Derecho", eligible = 40, orden = 3, aplicada = FALSE,
              status = "sin_contactar", op_status = "planificada"),
    .efs_aula("A4", "Derecho", eligible = 40, orden = 4, aplicada = FALSE,
              status = "sin_contactar", op_status = "planificada")
  )
  d <- .efs_dash(plan, .efs_resp(rep("A1", 10)), .efs_dt(list(.efs_fac("Derecho", cuota = 40))))
  f <- .efs_fila(d$efectividad_seguimiento, "Derecho")
  expect_identical(f$cursos_agendados, 1L)
  expect_identical(f$cursos_sin_agendar, 2L)
  # Con lo agendado no llega —20 de 40— pero su propio plan da de sobra: aquí
  # el trabajo es agendar, no pedir refuerzo.
  expect_true(f$riesgo_agendado %in% c("riesgo", "riesgo_firme"))
  expect_identical(f$riesgo, "holgado")
})

test_that("lo planificado sin fecha no es aforo seguro: se publica cuántos rechazaron", {
  # Gonzalo, 2026-09-11: «un CH puede estar en titulares (planificado) pero hasta
  # que no esté agendado no sabemos realmente si vamos a poder aplicar allí».
  # Lo que se puede afirmar es lo ya ocurrido, y por eso viajan los DOS números:
  # sin denominador, «33 %» puede ser 1 de 3.
  plan <- list(
    .efs_aula("A1", "Derecho", eligible = 20, orden = 1, aplicada = TRUE),
    .efs_aula("A2", "Derecho", eligible = 20, orden = 2, aplicada = FALSE, status = "agendada"),
    .efs_aula("A3", "Derecho", eligible = 20, orden = 3, aplicada = FALSE,
              status = "rechazo", op_status = "planificada"),
    # Éste todavía no ha resuelto su contacto: no cuenta en ninguna de las dos.
    .efs_aula("A4", "Derecho", eligible = 20, orden = 4, aplicada = FALSE,
              status = "sin_contactar", op_status = "planificada")
  )
  d <- .efs_dash(plan, .efs_resp(rep("A1", 10)), .efs_dt(list(.efs_fac("Derecho", cuota = 40))))
  b <- d$efectividad_seguimiento
  f <- .efs_fila(b, "Derecho")
  expect_identical(f$titulares_resueltos, 3L)
  expect_identical(f$titulares_rechazo, 1L)
  expect_identical(b$total$titulares_resueltos, 3L)
  expect_identical(b$total$titulares_rechazo, 1L)
  # Y el que sigue sin contactar sigue contándose como pendiente de agendar.
  expect_identical(f$cursos_sin_agendar, 1L)
})

test_that("una cita VENCIDA sin aplicar no cuenta como aforo agendado", {
  # Medido sobre el plan de HSVG26ULT2 el 2026-09-11: 70 cursos-horario tenían
  # fecha ya pasada y seguían sin aplicarse (2 346 elegibles, las más viejas del
  # 7 de septiembre) y la proyección los contaba como si fueran a rendir. Derecho
  # tenía 6 de esas 13 citas vencidas, y por eso salía holgado.
  plan <- list(
    .efs_aula("A1", "Derecho", eligible = 20, orden = 1, aplicada = TRUE),
    .efs_aula("A2", "Derecho", eligible = 20, orden = 2, aplicada = FALSE,
              status = "agendada", op_status = "planificada", fecha = "2026-09-14"),
    .efs_aula("A3", "Derecho", eligible = 100, orden = 3, aplicada = FALSE,
              status = "agendada", op_status = "planificada", fecha = "2026-09-07")
  )
  d <- .efs_dash(plan, .efs_resp(rep("A1", 10)), .efs_dt(list(.efs_fac("Derecho", cuota = 40))))
  b <- d$efectividad_seguimiento
  # El dashboard no fija la fecha, así que la vencida se comprueba llamando al
  # motor con el corte explícito: es lo que hace falsable la regla.
  f <- .efs_fila(b, "Derecho")
  expect_true(is.integer(f$cursos_vencidos))
})

test_that("con el corte puesto, la cita pasada se aparta y se publica aparte", {
  plan <- list(
    .efs_aula("A1", "Derecho", eligible = 20, orden = 1, aplicada = TRUE),
    .efs_aula("A2", "Derecho", eligible = 20, orden = 2, aplicada = FALSE,
              status = "agendada", op_status = "planificada", fecha = "2026-09-14"),
    .efs_aula("A3", "Derecho", eligible = 100, orden = 3, aplicada = FALSE,
              status = "agendada", op_status = "planificada", fecha = "2026-09-07")
  )
  cfg <- monitoreo_aulas_normalize_config(list(
    enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1", plan = plan,
    design_targets = .efs_dt(list(.efs_fac("Derecho", cuota = 40)))
  ))
  df <- .monitoreo_aulas_df(cfg$plan, "plan")
  resp <- .efs_resp(rep("A1", 10))
  b <- .monitoreo_aulas_efectividad_seguimiento(
    df, df, resp, cfg,
    .monitoreo_aulas_valid_response(resp, cfg),
    .monitoreo_aulas_response_classroom(resp, cfg),
    hoy = as.Date("2026-09-11")
  )
  f <- .efs_fila(b, "Derecho")
  # Sólo la del 14 sostiene la proyección; la del 7 se aparta.
  expect_identical(f$cursos_agendados, 1L)
  expect_identical(f$elegibles_agendados, 20L)
  expect_identical(f$cursos_vencidos, 1L)
  expect_identical(f$elegibles_vencidos, 100L)
  expect_identical(b$total$cursos_vencidos, 1L)
  # Y NO se cuenta entre las que faltan por agendar: ya se agendó y la cita se
  # pasó. Lo que pide es reagendar, no llamar por primera vez.
  expect_identical(f$cursos_sin_agendar, 0L)
  # El aforo agendado es 20 y el del plan 120: la vencida sigue en el plan —está
  # comprada— pero no en lo que se puede aplicar. Ésa es toda la diferencia.
  expect_identical(f$elegibles_pendientes, 120L)
})

test_that("un curso-horario con respuestas ya NO es aforo pendiente, diga lo que diga su estado", {
  # Medido en HSVG26ULT2 el 2026-09-11: 68 cursos-horario tenían fecha pasada,
  # respuestas recogidas y el estado todavía en `planificada`. Contaban como
  # pendientes, así que su aforo entraba en la proyección mientras sus respuestas
  # ya estaban en el conseguido: el mismo campo contado dos veces. Derecho salía
  # con 13 cursos-horario agendados teniendo 6 por delante.
  plan <- list(
    .efs_aula("A1", "Derecho", eligible = 20, orden = 1, aplicada = TRUE),
    .efs_aula("A2", "Derecho", eligible = 20, orden = 2, aplicada = FALSE,
              status = "agendada", op_status = "planificada", fecha = "2026-09-20"),
    # Ya trajo respuestas y su estado sigue sin teclearse: no es aforo futuro.
    .efs_aula("A3", "Derecho", eligible = 100, orden = 3, aplicada = FALSE,
              status = "agendada", op_status = "planificada", fecha = "2026-09-20")
  )
  d <- .efs_dash(plan, .efs_resp(c(rep("A1", 10), rep("A3", 40))),
                 .efs_dt(list(.efs_fac("Derecho", cuota = 40))))
  f <- .efs_fila(d$efectividad_seguimiento, "Derecho")
  expect_identical(f$cursos_agendados, 1L)
  expect_identical(f$elegibles_agendados, 20L)
  # Y su aforo tampoco entra en la proyección del plan entero.
  expect_identical(f$elegibles_pendientes, 20L)
})

test_that("«por agendar» separa al que nadie llamó del que ya no cierra", {
  # Gonzalo, 2026-09-11: «el toca agendar a veces puede que no logre agendar
  # sobre los titulares, por lo que aplicar refuerzos». Medido ese día: de los
  # 174 titulares, CERO estaban sin contactar; 22 llevaban semanas en gestión.
  # «Te quedan 6 por agendar» hacía creer que eran seis llamadas por delante.
  plan <- list(
    .efs_aula("A1", "Derecho", eligible = 20, orden = 1, aplicada = TRUE),
    .efs_aula("A2", "Derecho", eligible = 20, orden = 2, aplicada = FALSE,
              status = "en_contacto", op_status = "planificada"),
    .efs_aula("A3", "Derecho", eligible = 20, orden = 3, aplicada = FALSE,
              status = "sin_contactar", op_status = "planificada")
  )
  d <- .efs_dash(plan, .efs_resp(rep("A1", 10)), .efs_dt(list(.efs_fac("Derecho", cuota = 40))))
  b <- d$efectividad_seguimiento
  f <- .efs_fila(b, "Derecho")
  expect_identical(f$cursos_sin_agendar, 2L)
  expect_identical(f$cursos_en_gestion, 1L)
  expect_identical(b$total$cursos_en_gestion, 1L)
})

test_that("una gestión sin teléfono válido no es aforo: pide reserva ya", {
  # Gonzalo, 2026-09-11: «si vemos que los titulares no confirman, poder ir
  # reforzando con reemplazos disponibles», partiendo de que «un refuerzo
  # tampoco es una aplicación garantizada». Medido ese día: de 22 gestiones
  # abiertas, SEIS tenían el teléfono muerto —«Número no existe», «Número fuera
  # de servicio»—, una de Derecho y dos con diez días encima.
  plan <- list(
    .efs_aula("A1", "Derecho", eligible = 20, orden = 1, aplicada = TRUE),
    .efs_aula("A2", "Derecho", eligible = 20, orden = 2, aplicada = FALSE,
              status = "en_contacto", op_status = "planificada"),
    .efs_aula("A3", "Derecho", eligible = 20, orden = 3, aplicada = FALSE,
              status = "en_contacto", op_status = "planificada")
  )
  plan[[2]]$call_status <- "Número no existe"
  plan[[3]]$call_status <- "Contactar después"
  d <- .efs_dash(plan, .efs_resp(rep("A1", 10)), .efs_dt(list(.efs_fac("Derecho", cuota = 40))))
  b <- d$efectividad_seguimiento
  f <- .efs_fila(b, "Derecho")
  expect_identical(f$cursos_en_gestion, 2L)
  # La del teléfono muerto se señala aparte: no es una gestión lenta.
  expect_identical(f$cursos_sin_via, 1L)
  expect_identical(b$total$cursos_sin_via, 1L)
})

test_that("una gestión estancada más días de los que la reserva necesita se señala", {
  plan <- list(
    .efs_aula("A1", "Letras", eligible = 20, orden = 1, aplicada = TRUE),
    # Contactada hace 9 días y sin cerrar: la reserva necesita su propio plazo.
    .efs_aula("A2", "Letras", eligible = 20, orden = 2, aplicada = FALSE,
              status = "en_contacto", op_status = "planificada"),
    # Contactada ayer: todavía no.
    .efs_aula("A3", "Letras", eligible = 20, orden = 3, aplicada = FALSE,
              status = "en_contacto", op_status = "planificada")
  )
  plan[[2]]$contact_date <- "2026-09-02"
  plan[[3]]$contact_date <- "2026-09-10"
  cfg <- monitoreo_aulas_normalize_config(list(
    enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1", plan = plan,
    design_targets = .efs_dt(list(.efs_fac("Letras", cuota = 40)))
  ))
  df <- .monitoreo_aulas_df(cfg$plan, "plan")
  resp <- .efs_resp(rep("A1", 10))
  b <- .monitoreo_aulas_efectividad_seguimiento(
    df, df, resp, cfg,
    .monitoreo_aulas_valid_response(resp, cfg),
    .monitoreo_aulas_response_classroom(resp, cfg),
    hoy = as.Date("2026-09-11")
  )
  f <- .efs_fila(b, "Letras")
  expect_identical(f$cursos_en_gestion, 2L)
  expect_identical(f$cursos_estancados, 1L)
  expect_identical(b$total$dias_para_cubrir, 5L)
})

test_that("sin vía y estancada no se cuentan dos veces", {
  # La del teléfono muerto ya tiene su aviso: sumarla también a las estancadas
  # inflaría el número que dice cuántas reservas hay que mover.
  plan <- list(
    .efs_aula("A1", "Arte", eligible = 20, orden = 1, aplicada = TRUE),
    .efs_aula("A2", "Arte", eligible = 20, orden = 2, aplicada = FALSE,
              status = "en_contacto", op_status = "planificada")
  )
  plan[[2]]$call_status <- "Número fuera de servicio"
  plan[[2]]$contact_date <- "2026-09-01"
  cfg <- monitoreo_aulas_normalize_config(list(
    enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1", plan = plan,
    design_targets = .efs_dt(list(.efs_fac("Arte", cuota = 40)))
  ))
  df <- .monitoreo_aulas_df(cfg$plan, "plan")
  resp <- .efs_resp(rep("A1", 10))
  b <- .monitoreo_aulas_efectividad_seguimiento(
    df, df, resp, cfg,
    .monitoreo_aulas_valid_response(resp, cfg),
    .monitoreo_aulas_response_classroom(resp, cfg),
    hoy = as.Date("2026-09-11")
  )
  f <- .efs_fila(b, "Arte")
  expect_identical(f$cursos_sin_via, 1L)
  expect_identical(f$cursos_estancados, 0L)
})

test_that("el aviso sin teléfono dice CUÁLES, no sólo cuántas", {
  # «3 no tienen teléfono válido» dice que hay un problema; «CH 3, CH 17 y CH 89»
  # dice qué hacer esta tarde.
  plan <- list(
    .efs_aula("A1", "Derecho", eligible = 20, orden = 1, aplicada = TRUE),
    .efs_aula("A2", "Derecho", eligible = 20, orden = 2, aplicada = FALSE,
              status = "en_contacto", op_status = "planificada"),
    .efs_aula("A3", "Derecho", eligible = 20, orden = 3, aplicada = FALSE,
              status = "en_contacto", op_status = "planificada")
  )
  plan[[2]]$call_status <- "Número no existe"
  plan[[3]]$call_status <- "Número fuera de servicio"
  d <- .efs_dash(plan, .efs_resp(rep("A1", 10)), .efs_dt(list(.efs_fac("Derecho", cuota = 40))))
  f <- .efs_fila(d$efectividad_seguimiento, "Derecho")
  expect_identical(f$cursos_sin_via, 2L)
  expect_identical(as.character(f$codigos_sin_via), c("CH 2", "CH 3"))
})

test_that("sin ninguna, los códigos viajan vacíos y no como NULL", {
  # Un campo que desaparece obliga a la vista a distinguir «no hay» de «no vino».
  plan <- list(.efs_aula("A1", "Arte", eligible = 20, orden = 1, aplicada = TRUE))
  d <- .efs_dash(plan, .efs_resp(rep("A1", 10)), .efs_dt(list(.efs_fac("Arte", cuota = 5))))
  f <- .efs_fila(d$efectividad_seguimiento, "Arte")
  expect_identical(length(f$codigos_sin_via), 0L)
})

test_that("el veredicto del PARTE también saca a un aula del aforo pendiente", {
  # Visto con Gonzalo el 2026-09-11 sobre CH 3: su parte dice `aplicada` con 15
  # alumnos en el aula y cero encuestas válidas, mientras su eje de muestra sigue
  # en `en_contacto` con el teléfono muerto. Contaba como pendiente, su aforo
  # entraba en la proyección y el aviso de «sin teléfono» la incluía, mandando a
  # buscarle otra vía a un aula que ya se visitó.
  plan <- list(
    .efs_aula("A1", "Ingenieria", eligible = 20, orden = 1, aplicada = TRUE),
    .efs_aula("A2", "Ingenieria", eligible = 100, orden = 2, aplicada = FALSE,
              status = "en_contacto", op_status = "planificada")
  )
  # El parte la da por aplicada aunque no trajera ni una válida.
  plan[[2]]$application_status <- "aplicada"
  plan[[2]]$call_status <- "Número no existe"
  d <- .efs_dash(plan, .efs_resp(rep("A1", 10)), .efs_dt(list(.efs_fac("Ingenieria", cuota = 40))))
  b <- d$efectividad_seguimiento
  f <- .efs_fila(b, "Ingenieria")
  # Su aforo no es futuro: ya se gastó.
  expect_identical(f$elegibles_pendientes, 0L)
  # Y no es una gestión que buscar por otra vía: ya se visitó.
  expect_identical(f$cursos_sin_via, 0L)
  expect_identical(f$cursos_en_gestion, 0L)
})
