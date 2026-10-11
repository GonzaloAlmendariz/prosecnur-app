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

# Una cita que todavía no pasó. Fija en el calendario, se volvía VENCIDA al
# llegar su día y el test dejaba de medir lo que decía: tres fallaron el
# 2026-09-22 sin que el motor cambiara.
.efs_futura <- function() format(Sys.Date() + 7)

.efs_resp <- function(ids) data.frame(collectorID = ids, stringsAsFactors = FALSE)

# --- fechas ANCLADAS AL CORTE, nunca escritas a mano --------------------------
#
# `.efs_dash()` entra por `monitoreo_aulas_dashboard()`, que no recibe `hoy` y
# toma `Sys.Date()`. Así que una cita literal en el fixture se vuelve pasado
# sola, sin que nadie toque una línea de código: los dos casos de aforo agendado
# se escribieron el 2026-09-11 con la cita al 14 y amanecieron en rojo el 15,
# cuando el motor empezó a apartarlas por vencidas —que es exactamente lo que
# debe hacer, y lo prueba su propio caso más abajo—. Un rojo así manda a buscar
# al motor un bug que no tiene, y los dos arreglos posibles son opuestos.
#
# Lo que el fixture quiere decir nunca fue «el 14»: es «tiene día por delante»
# o «se le pasó». Escrito como relación con el corte, dice lo que mide y deja de
# caducar. Los tres días de holgura sobran para que una corrida que cruce la
# medianoche no cambie de respuesta.
#
# El caso que fija `hoy` explícitamente (`hoy = as.Date("2026-09-11")`) es el
# otro camino válido y por eso conserva sus fechas literales: ahí el corte
# también está clavado, así que el par completo es determinista.
.efs_fecha_futura <- function(dias = 3) format(Sys.Date() + dias)
.efs_fecha_pasada <- function(dias = 3) format(Sys.Date() - dias)

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
              status = "sin_contactar", op_status = "planificada", fecha = .efs_futura())
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
              status = "agendada", op_status = "planificada", fecha = .efs_futura()),
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
              status = "agendada", op_status = "planificada", fecha = .efs_fecha_futura()),
    .efs_aula("A3", "Derecho", eligible = 100, orden = 3, aplicada = FALSE,
              status = "agendada", op_status = "planificada", fecha = .efs_fecha_pasada())
  )
  d <- .efs_dash(plan, .efs_resp(rep("A1", 10)), .efs_dt(list(.efs_fac("Derecho", cuota = 40))))
  b <- d$efectividad_seguimiento
  f <- .efs_fila(b, "Derecho")
  # Aquí decía `expect_true(is.integer(f$cursos_vencidos))` —el TIPO— con el
  # comentario de que la regla sólo era falsable llamando al motor con el corte
  # explícito. Era verdad mientras la cita estaba escrita a mano: el dashboard
  # toma `Sys.Date()` y no había forma de ponerle un ayer y un mañana. Anclada
  # al corte sí la hay, así que el caso mide el reparto que promete su título en
  # vez de comprobar que el campo existe.
  expect_identical(f$cursos_agendados, 1L)
  expect_identical(f$elegibles_agendados, 20L)
  expect_identical(f$cursos_vencidos, 1L)
  expect_identical(f$elegibles_vencidos, 100L)
  expect_identical(b$total$cursos_vencidos, 1L)
  # Y el plan entero las sigue contando a las dos: apartar la vencida es una
  # afirmación sobre el aforo AGENDADO, no sobre lo que queda por aplicar.
  expect_identical(f$elegibles_pendientes, 120L)
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
              status = "agendada", op_status = "planificada", fecha = .efs_futura()),
    # Ya trajo respuestas y su estado sigue sin teclearse: no es aforo futuro.
    .efs_aula("A3", "Derecho", eligible = 100, orden = 3, aplicada = FALSE,
              status = "agendada", op_status = "planificada", fecha = .efs_futura())
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

# --- las claves del diseño y las del plan -----------------------------------
#
# **La raiz de tres mentiras de pantalla**, medida el 2026-09-17 sobre el
# simulacro de CCSS por nivel: este motor unia las claves de `design_targets`
# —«6», «7», «8», «9» con la cuota por nivel— con las de la columna `faculty`
# del plan —«ciencias sociales»—, y fabricaba CINCO grupos para un estudio de
# cuatro niveles: cuatro fantasma, con cuota y sin una sola aula que medir, y
# uno con las 60 efectivas y sin cuota. Ninguno se podia evaluar, y de ahi
# salian «todas las facultades cierran su cuota», «ninguna facultad debe nada»
# y «ninguna necesita refuerzo» (arreglados en `0f434b03` y `4d46433a`).

test_that("con el eje en el AULA, una facultad con cuota y sin aulas SI se enseña", {
  # Es informacion real y por eso la union se conserva para el eje de siempre:
  # tener cuota del diseño y cero aulas en el plan es justo lo que hay que ver.
  plan <- list(.efs_aula("A1", "Letras", eligible = 20, orden = 1, aplicada = TRUE))
  dt <- .efs_dt(list(.efs_fac("Letras", cuota = 10), .efs_fac("Derecho", cuota = 40)))
  d <- .efs_dash(plan, .efs_resp(rep("A1", 10)), dt)
  nombres <- vapply(d$efectividad_seguimiento$facultades,
                    function(f) as.character(f$facultad), character(1))
  expect_true("Letras" %in% nombres)
  expect_true("Derecho" %in% nombres)
  expect_identical(d$efectividad_seguimiento$total$facultades, 2L)
})

test_that("con el eje en la PERSONA no se inventan grupos que el plan no tiene", {
  # Las claves del diseño son valores del eje y no se pueden casar contra
  # ninguna aula: unirlas no añade un grupo, inventa uno. Lo que el estudio SI
  # puede afirmar por nivel vive en `avance_cuota`, y Metas ya lo publica.
  plan <- list(
    .efs_aula("A1", "CIENCIAS SOCIALES", eligible = 20, orden = 1, aplicada = TRUE),
    .efs_aula("A2", "CIENCIAS SOCIALES", eligible = 20, orden = 2, aplicada = TRUE)
  )
  dt <- .efs_dt(list(.efs_fac("6", cuota = 120), .efs_fac("7", cuota = 121)))
  cfg <- monitoreo_aulas_normalize_config(list(
    enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1",
    plan = plan, design_targets = dt, eje_cuota = "nivel"
  ))
  d <- monitoreo_aulas_dashboard(cfg$plan, .efs_resp(rep("A1", 10)), cfg)
  nombres <- vapply(d$efectividad_seguimiento$facultades,
                    function(f) as.character(f$facultad), character(1))
  # UNA fila, la del plan. Ni «6» ni «7» aparecen: no hay aula que medirles.
  expect_identical(nombres, "CIENCIAS SOCIALES")
  t <- d$efectividad_seguimiento$total
  expect_identical(t$facultades, 1L)
  # Y el DENOMINADOR lo dice: cero evaluadas, una sin cuota contra la que medir.
  # Es lo que impide que la pantalla lea el cero como buena noticia.
  expect_identical(t$facultades_evaluadas, 0L)
  expect_identical(t$facultades_sin_cuota, 1L)
  expect_identical(t$facultades_en_riesgo_agendado, 0L)
})

# --- el numerador y el denominador son de la MISMA población ------------------
#
# Medido el 2026-09-22, primer día de campo de CCSS Perfil 2026-II: el diseño
# mide niveles 6 a 9, el aula entera contesta, y las respuestas de nivel 5 y 10
# entraban al numerador de τ mientras `eligible_n` sólo cuenta a los del diseño.
# τ salía 75 % contra una prevista de 0,50, en el panel que decide reservas.

.efs_persona <- function(codigos, collectors = rep("a1", length(codigos)), sexo = NULL) {
  plan <- list(
    list(classroom_id = "a1", operational_code = "CH 1", label = "a1",
         faculty = "CIENCIAS SOCIALES", level = "7",
         sample_role = "titular", wave = "M1", orden = 1,
         eligible_n = 10, expected_valid = 5, sample_status = "agendada",
         operational_status = "aplicada",
         sex_top_1 = "Femenino", sex_top_1_n = 6, sex_top_2 = "Masculino", sex_top_2_n = 4),
    list(classroom_id = "a2", operational_code = "CH 2", label = "a2",
         faculty = "CIENCIAS SOCIALES", level = "5",
         sample_role = "titular", wave = "M1", orden = 2,
         eligible_n = 10, expected_valid = 5, sample_status = "agendada",
         operational_status = "agendada")
  )
  dt <- list(
    schema = "monitoreo_aulas_design_targets_v1", source = "calc-muestra",
    tasa_esperada = 0.5, tasa_fuente = "tau_disenio", total_cuota = 20,
    facultades = list(
      list(facultad = "7", faculty_key = monitoreo_aulas_eje_key("7"), cuota = 10, tau = 0.5),
      list(facultad = "8", faculty_key = monitoreo_aulas_eje_key("8"), cuota = 10, tau = 0.5)
    ),
    selection_run_id = "run_1", frame_hash = "hash_1"
  )
  cfg <- monitoreo_aulas_normalize_config(list(
    enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1",
    plan = plan, design_targets = dt, eje_cuota = "nivel",
    source_mapping = c(list(collector_var = "collectorID", student_code_var = "codigo"),
                       if (!is.null(sexo)) list(sex_var = "sexo"))
  ))
  padron <- list(
    schema = "monitoreo_aulas_padron_v1", vigencia = "2026-09-07",
    filas = list(
      list(codigo = "20190001", nivel = 7L, carrera = "ECONOMÍA", sexo = "F"),
      list(codigo = "20190002", nivel = 7L, carrera = "ECONOMÍA", sexo = "M"),
      list(codigo = "20190003", nivel = 8L, carrera = "ECONOMÍA", sexo = "F"),
      list(codigo = "20190501", nivel = 5L, carrera = "ECONOMÍA", sexo = "M"),
      list(codigo = "20190502", nivel = 5L, carrera = "ECONOMÍA", sexo = "F")
    )
  )
  resp <- data.frame(collectorID = collectors, codigo = codigos, stringsAsFactors = FALSE)
  if (!is.null(sexo)) resp$sexo <- sexo
  monitoreo_aulas_dashboard(cfg$plan, resp, cfg, padron = padron)
}

test_that("con el eje en la PERSONA, τ no cuenta arriba a quien no cuenta abajo", {
  # Tres del diseño (niveles 7, 7 y 8) y dos de nivel 5, en un aula cuyos 10
  # elegibles son sólo de niveles del diseño. τ = 3/10, no 5/10.
  d <- .efs_persona(c("20190001", "20190002", "20190003", "20190501", "20190502"))
  t <- d$efectividad_seguimiento$total
  expect_identical(t$efectivas, 3L)
  expect_identical(t$elegibles_aplicados, 10L)
  expect_equal(t$tau_observado, 0.3)
  # Y es la misma cuenta que suma a la cuota: la proyección no mezcla clases.
  en_cuota <- sum(vapply(d$avance_cuota$facultades, function(f) {
    if (is.finite(.monitoreo_num(f$cuota, NA_real_))) as.numeric(f$respuestas_validas) else 0
  }, numeric(1)))
  expect_identical(as.numeric(t$efectivas), en_cuota)
})

test_that("un aula donde sólo contestaron los de fuera del diseño ya está aplicada", {
  # CH 2 figura agendada y sólo le llegan alumnos de nivel 5: no aporta a τ,
  # pero se visitó, y su aforo no puede volver a la proyección como pendiente.
  d <- .efs_persona(c("20190001", "20190501", "20190502"), collectors = c("a1", "a2", "a2"))
  t <- d$efectividad_seguimiento$total
  expect_identical(t$aulas_aplicadas, 2L)
  expect_identical(t$elegibles_aplicados, 20L)
  expect_identical(t$efectivas, 1L)
  expect_equal(t$tau_observado, 0.05)
})

# --- la τ prevista con el eje en la persona -----------------------------------
#
# Las claves del diseño son niveles y los grupos del plan son facultades: con la
# unión se perdía también la τ, y la fila salía `sin_previsto` —0,578 observada
# sin nada al lado— aunque los cuatro niveles de CCSS declaran la misma 0,50.

test_that("con una τ única en el diseño, el grupo del plan la hereda y la banda contrasta", {
  d <- .efs_persona(c("20190001", "20190002", "20190003", "20190501", "20190502"))
  seg <- d$efectividad_seguimiento
  f <- seg$facultades[[1]]
  expect_equal(f$tau_previsto, 0.5)
  expect_identical(f$tau_previsto_fuente, "uniforme_del_diseno")
  expect_false(identical(f$senal, "sin_previsto"))
  expect_false(identical(f$estado, "sin_previsto"))
  expect_equal(seg$total$tau_previsto, 0.5)
})

test_that("con τ distintas por nivel no se inventa una mezcla: se dice por qué falta", {
  plan <- list(list(classroom_id = "a1", operational_code = "CH 1", label = "a1",
                    faculty = "CIENCIAS SOCIALES", level = "7", sample_role = "titular",
                    wave = "M1", orden = 1, eligible_n = 10, expected_valid = 5,
                    sample_status = "agendada", operational_status = "aplicada"))
  dt <- list(
    schema = "monitoreo_aulas_design_targets_v1", source = "calc-muestra",
    tasa_esperada = NA_real_, tasa_fuente = "tau_disenio", total_cuota = 20,
    facultades = list(
      list(facultad = "7", faculty_key = monitoreo_aulas_eje_key("7"), cuota = 10, tau = 0.5),
      list(facultad = "8", faculty_key = monitoreo_aulas_eje_key("8"), cuota = 10, tau = 0.6)
    ),
    selection_run_id = "run_1", frame_hash = "hash_1"
  )
  cfg <- monitoreo_aulas_normalize_config(list(
    enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1",
    plan = plan, design_targets = dt, eje_cuota = "nivel",
    source_mapping = list(collector_var = "collectorID", student_code_var = "codigo")
  ))
  d <- monitoreo_aulas_dashboard(cfg$plan, data.frame(collectorID = "a1", codigo = "x"), cfg)
  f <- d$efectividad_seguimiento$facultades[[1]]
  expect_identical(f$tau_previsto, NA_real_)
  expect_identical(f$tau_previsto_fuente, "diseno_con_tau_distintas")
  expect_identical(f$estado, "sin_previsto")
})

test_that("con el eje en el AULA la τ sigue saliendo de su celda, y una facultad sin celda no hereda", {
  plan <- list(.efs_aula("A1", "Letras", eligible = 20, orden = 1),
               .efs_aula("A2", "Arte", eligible = 20, orden = 2))
  d <- .efs_dash(plan, .efs_resp(rep("A1", 10)), .efs_dt(list(.efs_fac("Letras", tau = 0.4))))
  expect_identical(.efs_fila(d$efectividad_seguimiento, "Letras")$tau_previsto_fuente, "celda_del_diseno")
  arte <- .efs_fila(d$efectividad_seguimiento, "Arte")
  expect_identical(arte$tau_previsto, NA_real_)
  expect_identical(arte$tau_previsto_fuente, "sin_tau_del_diseno")
})

test_that("con el eje en la PERSONA el riesgo dice que la cuota va por otro eje, no que falte un dato", {
  # CCSS publicaba «No se pudo leer lo conseguido de esta facultad» con 123
  # conseguidas bien leídas: la facultad no tiene cuota propia porque el diseño
  # la reparte por nivel.
  d <- .efs_persona(c("20190001", "20190002", "20190003"))
  seg <- d$efectividad_seguimiento
  f <- seg$facultades[[1]]
  expect_identical(f$riesgo, "cuota_en_otro_eje")
  expect_identical(f$riesgo_agendado, "cuota_en_otro_eje")
  expect_identical(seg$total$facultades_evaluadas, 0L)
  expect_identical(seg$total$facultades_sin_cuota, 1L)
  # Y el bloque declara contra qué eje se mide, para que la pantalla lo nombre.
  expect_identical(seg$eje$clave, "nivel")
  expect_identical(seg$eje$etiqueta, "Nivel")
})

test_that("con el eje en el AULA la falta de conseguido sigue siendo `sin_cumplimiento`", {
  plan <- list(.efs_aula("A1", "Letras", eligible = 20, orden = 1))
  d <- .efs_dash(plan, .efs_resp(rep("A1", 10)), .efs_dt(list(.efs_fac("Letras"))))
  expect_false(identical(.efs_fila(d$efectividad_seguimiento, "Letras")$riesgo, "cuota_en_otro_eje"))
  expect_identical(d$efectividad_seguimiento$eje$clave, "facultad")
})

test_that("la efectividad por sexo usa la misma población arriba y abajo", {
  # CCSS al cierre del 2026-09-22: Mujeres 78,8 % y Hombres 74,7 % al lado de
  # una τ de 57,8 %. Ninguna parte puede quedar por encima del todo.
  plan <- list(list(classroom_id = "a1", operational_code = "CH 1", label = "a1",
                    faculty = "CIENCIAS SOCIALES", level = "7", sample_role = "titular",
                    wave = "M1", orden = 1, eligible_n = 10, expected_valid = 5,
                    sample_status = "agendada", operational_status = "aplicada",
                    sex_top_1 = "Femenino", sex_top_1_n = 6,
                    sex_top_2 = "Masculino", sex_top_2_n = 4))
  resp <- data.frame(collectorID = "a1", codigo = c("x", "y", "z"),
                     sexo = c("Femenino", "Femenino", "Masculino"), stringsAsFactors = FALSE)
  cfg <- list(source_mapping = list(collector_var = "collectorID", sex_var = "sexo"))
  plan_df <- as.data.frame(do.call(rbind, lapply(plan, as.data.frame)))
  sin <- monitoreo_aulas_efectividad_por_sexo(
    plan_df, resp, cfg = cfg, valid_response = rep(TRUE, 3),
    response_classroom = rep("a1", 3), aplicada = TRUE)
  con <- monitoreo_aulas_efectividad_por_sexo(
    plan_df, resp, cfg = cfg, valid_response = rep(TRUE, 3),
    response_classroom = rep("a1", 3), aplicada = TRUE,
    efectiva = c(TRUE, FALSE, TRUE))
  f <- function(x, s) Filter(function(c) identical(c$sexo, s), x)[[1]]
  expect_identical(f(sin, "F")$efectivas, 2L)
  expect_identical(f(con, "F")$efectivas, 1L)
  expect_identical(f(con, "M")$efectivas, 1L)
  # Una máscara de otra longitud no se aplica a ciegas: conserva la cuenta.
  otra <- monitoreo_aulas_efectividad_por_sexo(
    plan_df, resp, cfg = cfg, valid_response = rep(TRUE, 3),
    response_classroom = rep("a1", 3), aplicada = TRUE, efectiva = TRUE)
  expect_identical(f(otra, "F")$efectivas, 2L)
})

test_that("en el tablero, con el eje en la persona, el sexo no suma más que la τ", {
  d <- .efs_persona(c("20190001", "20190002", "20190003", "20190501", "20190502"),
                    sexo = c("Femenino", "Masculino", "Femenino", "Femenino", "Masculino"))
  por <- stats::setNames(
    vapply(d$efectividad_por_sexo, function(c) as.integer(c$efectivas), integer(1)),
    vapply(d$efectividad_por_sexo, function(c) as.character(c$sexo), character(1)))
  # Del diseño: 0001 (F), 0002 (M), 0003 (F). Los dos de nivel 5 no cuentan.
  expect_identical(unname(por[["F"]]), 2L)
  expect_identical(unname(por[["M"]]), 1L)
  expect_identical(sum(por), d$efectividad_seguimiento$total$efectivas)
})

test_that("con el eje en el AULA la efectividad por sexo no cambia, aun con un aula fuera de universo", {
  # Lo cazó el verificador: la máscara del diseño también saca las respuestas
  # de un aula virtual, cuyo padrón este motor sigue contando en los elegibles.
  # Con el eje en el aula la cuenta de siempre es la coherente.
  plan <- list(
    c(.efs_aula("A1", "Letras", eligible = 6, orden = 1),
      list(sex_top_1 = "Femenino", sex_top_1_n = 6)),
    c(.efs_aula("A3", "Letras", eligible = 6, orden = 3),
      list(sex_top_1 = "Femenino", sex_top_1_n = 6, replacement_reason = "virtual_no_presencial"))
  )
  cfg <- monitoreo_aulas_normalize_config(list(
    enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1", plan = plan,
    design_targets = .efs_dt(list(.efs_fac("Letras"))),
    source_mapping = list(collector_var = "collectorID", sex_var = "sexo")
  ))
  resp <- data.frame(collectorID = c("A1", "A1", "A3", "A3"),
                     sexo = rep("Femenino", 4), stringsAsFactors = FALSE)
  d <- monitoreo_aulas_dashboard(cfg$plan, resp, cfg)
  f <- Filter(function(c) identical(c$sexo, "F"), d$efectividad_por_sexo)[[1]]
  plan_df <- as.data.frame(do.call(rbind, lapply(cfg$plan, function(u)
    as.data.frame(u[c("classroom_id", "faculty", "stratum", "eligible_n", "sex_top_1", "sex_top_1_n")]))))
  directo <- monitoreo_aulas_efectividad_por_sexo(
    plan_df, resp, cfg = cfg, valid_response = rep(TRUE, 4),
    response_classroom = resp$collectorID)
  g <- Filter(function(c) identical(c$sexo, "F"), directo)[[1]]
  expect_identical(f$efectivas, g$efectivas)
  expect_identical(f$elegibles, g$elegibles)
})
