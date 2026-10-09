# La clave de cache del estado no serializa el estudio entero — A6b del loop
# de mejora estética y técnica (2026-09-08).
#
# Medido con HSVG2026 (1.392 unidades, 273 respuestas) sobre el estado real:
# `.monitoreo_dashboard_config_json(cfg)` tardaba 2,18 s y devolvía 29 MB de
# JSON, y se corre al menos dos veces por petición (`monitoreo_state_derived_key`
# 2,04 s y `.monitoreo_dashboard_cache_token` 2,29 s); el token del tablero
# era una cadena de 29,9 millones de caracteres que luego se compara y se
# guarda en la sesión, y `monitoreo_aulas_cache_token` la vuelve a pegar. Eso
# eran los ~8 s de `/api/monitoreo/state` que no salían ni en `derived` ni en
# `dashboard`, y por qué un «hit» costaba 2 s. Sin marco ni plan, la misma
# config serializa en 0,02 s y 56 KB; un digest xxhash64 del plan como objeto
# R cuesta 0,014 s. La clave tiene que ser barata Y seguir invalidando: un
# cambio en cualquier fila del plan o en el marco cambia la clave.

.ccc_plan <- function(n = 800L) lapply(seq_len(n), function(i) list(
  classroom_id = sprintf("A-%04d", i), operational_code = sprintf("CH %d", i),
  label = sprintf("Aula %04d", i), faculty = "Ingenieria", stratum = "Ingenieria",
  sample_role = "titular", wave = "M1", orden = i, eligible_n = 30, expected_valid = 12,
  sample_status = "agendada", teacher = sprintf("Docente %d", i), course_name = sprintf("Curso %d", i),
  schedule = "LUN 08:00-10:00", link = sprintf("https://x.test/%d", i)
))

.ccc_marco <- function(n = 4000L) lapply(seq_len(n), function(i) list(
  dimension = "facultad", variable = "faculty", label = "FAC", category = paste0("c", i),
  source = "frame", frame_n = i, selected_n = i, frame_prop = 0.1, selected_prop = 0.1,
  error_balance = 0, abs_error = 0, tolerance = 0.05
))

.ccc_cfg <- function(plan = .ccc_plan(), marco = .ccc_marco()) monitoreo_normalize_config(list(
  monitoreo_profile = list(family = "aulas_universitarias"),
  aulas_universitarias = list(
    enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1", plan = plan,
    quotas = list(profile_distributions = marco, sex_by_faculty = marco, category_profiles = marco,
                  strata = list(list(stratum = "Ingenieria", n_aulas = 2L))),
    methodology = list(frame_hash = "hash_1", representativity = list(profile_distributions = marco)),
    representativity = list(profile_distributions = marco, metrics = list())
  )
), data.frame())

test_that("A6b: la clave es compacta y barata aunque la config traiga el plan y el marco enteros", {
  cfg <- .ccc_cfg()
  t <- system.time(j <- .monitoreo_dashboard_config_json(cfg))[["elapsed"]]
  expect_lt(nchar(j, type = "bytes"), 300000)   # antes: 29 MB con el estudio real
  expect_lt(t, 1.0)
  # Lo liviano sigue dentro tal cual: el criterio, los sellos, los estratos.
  expect_true(grepl("\"selection_run_id\":\"run_1\"", j, fixed = TRUE))
  expect_true(grepl("\"strata\"", j, fixed = TRUE))
})

test_that("A6b: la clave sigue invalidando: un cambio en una fila del plan o en el marco la cambia", {
  base <- .monitoreo_dashboard_config_json(.ccc_cfg())
  plan2 <- .ccc_plan(); plan2[[400]]$sample_status <- "aplicada"
  expect_false(identical(base, .monitoreo_dashboard_config_json(.ccc_cfg(plan = plan2))))
  marco2 <- .ccc_marco(); marco2[[2000]]$selected_n <- 999
  expect_false(identical(base, .monitoreo_dashboard_config_json(.ccc_cfg(marco = marco2))))
  # Y la misma config da la misma clave (determinista).
  expect_identical(base, .monitoreo_dashboard_config_json(.ccc_cfg()))
})

test_that("A6b: el token del tablero y la clave del derivado ya no arrastran el estudio entero", {
  cfg <- .ccc_cfg()
  snapshot <- list(synced_at = "2026-09-08T10:00:00Z", data = data.frame(collectorID = "CH 1"))
  tok <- .monitoreo_dashboard_cache_token(snapshot, snapshot$data, cfg, "advance_summary")
  expect_lt(nchar(tok), 300000)
  s <- list(monitoreo_snapshot = snapshot, monitoreo_config = cfg, monitoreo_sources = list())
  t <- system.time(k <- monitoreo_state_derived_key(s, list()))[["elapsed"]]
  expect_true(nzchar(k))
  expect_lt(nchar(k), 300000)
  expect_lt(t, 1.0)
})
