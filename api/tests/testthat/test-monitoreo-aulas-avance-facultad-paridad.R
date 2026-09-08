# Una sola definición del avance por facultad — A4 del loop de mejora
# estética y técnica (2026-09-07/08).
#
# El tablero (`.monitoreo_aulas_avance_cuota()`) y el libro
# (`.calaf_avance_por_facultad()`, hoja «Avance de campo» del xlsx y del
# Sheets) contestan «¿cuánto lleva y cuánto falta cada facultad?» desde dos
# lados —respuestas atribuidas y efectivas por aula— y coincidían el 07/09
# porque se arreglaron las dos a la vez (212 conseguidas, 2.288 de brecha en
# las 15 facultades, medido). La divergencia latente estaba en la BRECHA: el
# tablero suma lo que falta en cada celda de sexo (ADR 0079: la cuota no se
# compensa entre celdas) y el libro restaba el neto. Con un sexo pasado de su
# cuota, el libro decía «faltan 1» y el tablero «faltan 3» de la misma
# facultad. Aquí la regla vive en una función y los dos la consumen.

.par_plan <- function() list(list(
  classroom_id = "A1", operational_code = "CH 1", label = "Aula A1",
  faculty = "FAC1", stratum = "FAC1", sample_role = "titular", wave = "M1",
  orden = 1, eligible_n = 30, expected_valid = 10, sample_status = "agendada"
))

.par_dt <- function(F = 6, M = 4) list(
  schema = "monitoreo_aulas_design_targets_v1", source = "calc-muestra",
  tasa_esperada = 0.5, tasa_fuente = "tau_disenio", total_cuota = 10,
  facultades = list(list(
    facultad = "FAC1", faculty_key = .cm_criterios_fac_key("FAC1"),
    cuota = 10, cuota_sexo = if (is.null(F)) list() else list(F = F, M = M), tau = 0.5
  )),
  selection_run_id = "run_1", frame_hash = "hash_1"
)

.par_cfg <- function(dt) monitoreo_aulas_normalize_config(list(
  enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1",
  plan = .par_plan(), design_targets = dt,
  source_mapping = list(collector_var = "collectorID", sex_var = "sexo")
))

# 8 mujeres y 1 hombre: la celda F (6) se pasa, la M (4) queda a 3.
.par_resp <- function() data.frame(
  collectorID = rep("A1", 9),
  sexo = c(rep("Femenino", 8), "Masculino"),
  stringsAsFactors = FALSE
)

.par_ambas <- function(dt) {
  cfg <- .par_cfg(dt)
  resp <- .par_resp()
  d <- monitoreo_aulas_dashboard(cfg$plan, resp, cfg)
  tablero <- d$avance_cuota$facultades[[1]]
  efectivas <- monitoreo_aulas_efectivas_por_aula(cfg$plan, resp, cfg)
  ind <- aulas_libro_indicadores(
    cfg$plan, efectivas = efectivas, responses = resp, validas = rep(TRUE, nrow(resp)),
    cuotas = cfg$design_targets, cfg = cfg
  )
  list(tablero = tablero, libro = ind$facultades[1, ], efectivas = efectivas)
}

test_that("monitoreo_aulas_brecha_facultad: por celdas cuando las hay, neto cuando no", {
  # Celdas: F 6 con 8 (sobra), M 4 con 1 (faltan 3) → 3, no el neto 1.
  expect_identical(monitoreo_aulas_brecha_facultad(10, 9, list(list(target = 6, observed = 8), list(target = 4, observed = 1))), 3)
  # Sin celdas: el neto.
  expect_identical(monitoreo_aulas_brecha_facultad(10, 9, list()), 1)
  # Una celda sin target no cuenta como celda; y una sin observado observa 0.
  expect_identical(monitoreo_aulas_brecha_facultad(10, 9, list(list(target = NA, observed = 8))), 1)
  expect_identical(monitoreo_aulas_brecha_facultad(10, 2, list(list(target = 6, observed = NA), list(target = 4, observed = 2))), 8)
  # Sin cuota no hay brecha que declarar.
  expect_true(is.na(monitoreo_aulas_brecha_facultad(NA, 9, list())))
  # Nunca negativa.
  expect_identical(monitoreo_aulas_brecha_facultad(10, 14, list()), 0)
})

test_that("A4: con un sexo pasado de su cuota, el libro dice la MISMA brecha que el tablero", {
  r <- .par_ambas(.par_dt(F = 6, M = 4))
  expect_identical(as.numeric(r$efectivas[["CH 1"]]), 9)
  expect_identical(as.numeric(r$tablero$respuestas_validas), 9)
  expect_identical(as.numeric(r$libro$Conseguidas), 9)
  # ADR 0079 en los dos: la celda de hombres pide 3; la de mujeres ya sobra.
  expect_identical(as.numeric(r$tablero$brecha), 3)
  expect_identical(as.numeric(r$libro$Faltan), as.numeric(r$tablero$brecha))
  expect_identical(as.numeric(r$libro$`Conseguidas mujeres`), 8)
  expect_identical(as.numeric(r$libro$`Conseguidas hombres`), 1)
})

test_that("A4: sin reparto por sexo en el diseño, los dos restan el neto", {
  r <- .par_ambas(.par_dt(F = NULL))
  expect_identical(as.numeric(r$tablero$brecha), 1)
  expect_identical(as.numeric(r$libro$Faltan), 1)
})
