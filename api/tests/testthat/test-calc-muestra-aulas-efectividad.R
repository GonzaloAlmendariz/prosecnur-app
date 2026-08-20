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
  expect_true(all(c("p_aplicada_ref", "rendimiento_ref", "efectivas_esperadas",
                    "tasa_efectividad_aula") %in% names(out)))
  # V7 — ecuacion CONDICIONAL (el docente no descuenta efectivas):
  # A: 12 x 0.80 = 9.6 ; B: 60 x 0.44 = 26.4
  expect_equal(out$efectivas_esperadas, c(9.6, 26.4))
  expect_equal(out$tasa_efectividad_aula, c(0.80, 0.44))
  # La tasa de aplicacion sigue viajando como dato OPERATIVO.
  expect_equal(out$p_aplicada_ref, c(0.87, 0.73))
  # La tension medida: la chica rinde MAS en tasa, la grande aporta MAS absoluto.
  expect_gt(out$rendimiento_ref[[1]], out$rendimiento_ref[[2]])
  expect_gt(out$efectivas_esperadas[[2]], out$efectivas_esperadas[[1]])
  # Contrato con Monitoreo: el origen de la meta viaja declarado, literal
  # estable "diseno" (su normalizador lo consume en vez de inferirlo).
  expect_identical(out$meta_origen, c("diseno", "diseno"))
})

test_that("sin meta no hay origen: el marcador solo existe donde hay diseno", {
  sin <- data.frame(classroom_id = "A", stringsAsFactors = FALSE)
  expect_false("meta_origen" %in% names(.cm_aulas_efectividad_anotar(sin)))
})

test_that("sin declaracion la procedencia se dice en voz alta: calibracion_embebida", {
  af <- data.frame(classroom_id = "A", eligible_n = 20,
                   teacher_type = "DOCENTE CONTRATADO - CONTRATADO",
                   stringsAsFactors = FALSE)
  out <- .cm_aulas_efectividad_anotar(af)
  expect_identical(out$efectividad_fuente, "calibracion_embebida")
  expect_identical(out$efectividad_periodo, "")
})

test_that("declarar historico con periodo viaja en la fila", {
  cal <- .cm_efectividad_calibracion(list(efectividad = list(fuente = "historico", periodo = "2025")))
  af <- data.frame(classroom_id = "A", eligible_n = 20,
                   teacher_type = "DOCENTE CONTRATADO - CONTRATADO",
                   stringsAsFactors = FALSE)
  out <- .cm_aulas_efectividad_anotar(af, calibracion = cal)
  expect_identical(out$efectividad_fuente, "historico")
  expect_identical(out$efectividad_periodo, "2025")
  # V7: condicional — 20 x 0.69 = 13.8 (el docente ya no multiplica).
  expect_equal(out$efectivas_esperadas, 13.8)
})

test_that("sin historico, tau_global: esperado = elegibles x tau y SIN curvas", {
  cal <- .cm_efectividad_calibracion(list(efectividad = list(fuente = "tau_global", tau = 0.5)))
  af <- data.frame(classroom_id = c("A", "B"), eligible_n = c(20, 41),
                   stringsAsFactors = FALSE)
  out <- .cm_aulas_efectividad_anotar(af, calibracion = cal)
  expect_identical(out$efectividad_fuente, c("tau_global", "tau_global"))
  expect_true(all(is.na(out$p_aplicada_ref)))
  expect_true(all(is.na(out$rendimiento_ref)))
  expect_equal(out$efectividad_tau, c(0.5, 0.5))
  expect_equal(out$efectivas_esperadas, c(10.0, 20.5))
  expect_identical(out$meta_origen, c("diseno", "diseno"))
})

test_that("un tau ilegal NO habilita el modo global: cae a embebida declarada", {
  expect_identical(
    .cm_efectividad_calibracion(list(efectividad = list(fuente = "tau_global", tau = 1.4)))$fuente,
    "calibracion_embebida"
  )
  expect_identical(
    .cm_efectividad_calibracion(list(efectividad = list(fuente = "tau_global")))$fuente,
    "calibracion_embebida"
  )
  # El normalizador de config preserva la clave declarada (lista cerrada S2).
  cfg <- calc_muestra_aulas_normalize_config(list(efectividad = list(fuente = "historico", periodo = "2025-2")))
  expect_identical(cfg$efectividad,
                   list(fuente = "historico", periodo = "2025-2", tau = NA_real_,
                        tau_base = NA_real_, por_facultad = NULL,
                        rendimiento_tramos = NULL, tasa_aplicacion = NULL))
})

test_that("la proyeccion del workspace NO borra la procedencia (septima lista cerrada)", {
  ws <- .cm_normalize_workspace_aulas_config(list(
    efectividad = list(fuente = "historico", periodo = "2025-2")
  ))
  expect_identical(ws$efectividad,
                   list(fuente = "historico", periodo = "2025-2", tau = NA_real_,
                        tau_base = NA_real_, por_facultad = NULL,
                        rendimiento_tramos = NULL, tasa_aplicacion = NULL))
  # Sin declaracion la clave queda NULL (no un default disfrazado).
  expect_null(.cm_normalize_workspace_aulas_config(list())$efectividad)
})

test_that("el factor por facultad muerde solo donde el historico tiene base", {
  cal <- .cm_efectividad_calibracion(list(efectividad = list(
    fuente = "historico", periodo = "2025-2", tau_base = 0.53,
    por_facultad = list(
      list(facultad = "DERECHO", tau = 0.562, k = 16, suficiencia = "delgada"),
      # invalida (fuera de la cota de residuales, > 2): se descarta
      list(facultad = "PSICOLOGIA", tau = 2.4, k = 6)
    )
  )))
  expect_length(cal$por_facultad, 1L)
  af <- data.frame(
    classroom_id = c("A", "B"),
    faculty = c("DERECHO", "EDUCACION"),
    eligible_n = c(20, 20),
    teacher_type = "DOCENTE CONTRATADO - CONTRATADO",
    stringsAsFactors = FALSE
  )
  out <- .cm_aulas_efectividad_anotar(af, calibracion = cal)
  # V7 condicional — DERECHO: 20 x 0.69 x (0.562/0.53 = 1.060) = 14.63 -> 14.6
  expect_equal(out$factor_facultad, c(1.06, 1))
  expect_equal(out$facultad_k, c(16L, NA_integer_))
  expect_equal(out$efectivas_esperadas, c(14.6, 13.8))
})

test_that("sin tau_base el factor NO se aplica (nunca dividir por un supuesto mudo)", {
  cal <- .cm_efectividad_calibracion(list(efectividad = list(
    fuente = "historico",
    por_facultad = list(list(facultad = "DERECHO", tau = 0.562, k = 16))
  )))
  af <- data.frame(classroom_id = "A", faculty = "DERECHO", eligible_n = 20,
                   teacher_type = "DOCENTE CONTRATADO - CONTRATADO",
                   stringsAsFactors = FALSE)
  out <- .cm_aulas_efectividad_anotar(af, calibracion = cal)
  expect_equal(out$factor_facultad, 1)
  expect_equal(out$efectivas_esperadas, 13.8)
})

test_that("E1: los tramos sellados gobiernan el rendimiento (la curva es DATO)", {
  TRAMOS <- list(
    list(hasta = 15, tasa = 0.809), list(hasta = 25, tasa = 0.642),
    list(hasta = 35, tasa = 0.566), list(hasta = 50, tasa = 0.500),
    list(tasa = 0.409)
  )
  cfg <- calc_muestra_aulas_normalize_config(list(efectividad = list(
    fuente = "historico", periodo = "2025", rendimiento_tramos = TRAMOS
  )))
  expect_length(cfg$efectividad$rendimiento_tramos, 5L)
  r <- .cm_efectividad_rendimiento(c(10, 15, 16, 25, 26, 40, 51, 200),
                                   tramos = cfg$efectividad$rendimiento_tramos)
  expect_equal(r, c(0.809, 0.809, 0.642, 0.642, 0.566, 0.500, 0.409, 0.409))
  # Sin tramos: la embebida sigue byte a byte (retro-compat).
  expect_equal(.cm_efectividad_rendimiento(c(10, 60)), c(0.80, 0.44))
  # Tramos desordenados NO pasan la normalizacion: NULL, rige embebida.
  malo <- calc_muestra_aulas_normalize_config(list(efectividad = list(
    fuente = "historico",
    rendimiento_tramos = list(list(hasta = 25, tasa = 0.6), list(hasta = 15, tasa = 0.8))
  )))
  expect_null(malo$efectividad$rendimiento_tramos)
})

test_that("E1: la tasa de aplicacion sellada resuelve tipos y compuestos (manda el minimo)", {
  TABLA <- list(
    list(tipo = "DOCENTE CONTRATADO - CONTRATADO", tasa = 0.865, k = 193),
    list(tipo = "DOCENTE ORDINARIO - PRINCIPAL", tasa = 0.730, k = 37),
    list(tipo = "GENERAL", tasa = 0.843, k = 230)
  )
  cfg <- calc_muestra_aulas_normalize_config(list(efectividad = list(
    fuente = "historico", tasa_aplicacion = TABLA
  )))
  expect_length(cfg$efectividad$tasa_aplicacion, 3L)
  p <- .cm_efectividad_p_desde_tabla(c(
    "DOCENTE CONTRATADO - CONTRATADO",
    "DOCENTE ORDINARIO - PRINCIPAL | DOCENTE CONTRATADO - CONTRATADO",
    "DOCENTE ORDINARIO - ASOCIADO",
    ""
  ), cfg$efectividad$tasa_aplicacion)
  expect_equal(p, c(0.865, 0.730, 0.843, 0.843))
})

test_that("E3: las tasas por facultad se derivan del frame anotado (un dueño)", {
  cal <- .cm_efectividad_calibracion(list(efectividad = list(
    fuente = "historico", periodo = "2025", tau_base = 1,
    rendimiento_tramos = list(
      list(hasta = 15, tasa = 0.809), list(hasta = 25, tasa = 0.642),
      list(hasta = 35, tasa = 0.566), list(hasta = 50, tasa = 0.500),
      list(tasa = 0.409)
    ),
    por_facultad = list(list(facultad = "DERECHO", tau = 1.115, k = 16, suficiencia = "delgada"))
  )))
  af <- data.frame(
    classroom_id = c("A", "B", "C"),
    faculty = c("DERECHO", "DERECHO", "EDUCACION"),
    eligible_n = c(20, 40, 10),
    teacher_type = "DOCENTE CONTRATADO - CONTRATADO",
    stringsAsFactors = FALSE
  )
  out <- .cm_aulas_efectividad_anotar(af, calibracion = cal)
  tasas <- calc_muestra_aulas_tasas_facultad(out)
  expect_length(tasas, 2L)
  der <- tasas[[which(vapply(tasas, function(x) x$facultad, character(1)) == "DERECHO")]]
  # DERECHO: (20x0.642x1.115 + 40x0.500x1.115) / 60 = (14.317 + 22.3)/60 = 0.6103
  expect_equal(der$tasa, round((20*0.642*1.115 + 40*0.500*1.115)/60, 4))
  expect_true(der$con_residual)
  expect_equal(der$facultad_k, 16L)
  edu <- tasas[[which(vapply(tasas, function(x) x$facultad, character(1)) == "EDUCACION")]]
  # EDUCACION sin residual: su tasa es la de su mix (10 eleg -> tramo <=15).
  expect_equal(edu$tasa, 0.809)
  expect_false(edu$con_residual)
  expect_true(is.na(edu$facultad_k))
  # Un frame sin anotar no inventa tasas.
  expect_length(calc_muestra_aulas_tasas_facultad(af), 0L)
})

test_that("E3: construir publica tasas_efectividad_facultad en el frame", {
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
  expect_true(length(frame$tasas_efectividad_facultad) >= 1L)
  expect_equal(frame$tasas_efectividad_facultad[[1]]$facultad, "FAC1")
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
    .cm_aulas_efectividad_anotar = function(aula_frame, calibracion = NULL) aula_frame
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
  expect_true(all(c("p_aplicada_ref", "rendimiento_ref", "efectivas_esperadas",
                    "tasa_efectividad_aula") %in% names(sel$selection)))
  expect_true(all(is.finite(sel$selection$efectivas_esperadas)))
})
