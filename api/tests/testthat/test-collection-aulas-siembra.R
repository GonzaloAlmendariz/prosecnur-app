# X7 detrás del interruptor por estudio: Material siembra desde Cálculo en estudios nuevos y
# sigue sembrando desde Monitoreo donde ya lo hacía o en HSVG 2026 (collection_aulas_siembra.R).

.mas_code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)

.mas_plan <- function(prefijo) list(
  list(selection_run_id = "sel-1", classroom_id = paste0(prefijo, "-01"), operational_code = paste0(prefijo, "-01"), label = "Aula 1", wave = "M1", faculty = "Ingeniería"),
  list(selection_run_id = "sel-1", classroom_id = paste0(prefijo, "-02"), operational_code = paste0(prefijo, "-02"), label = "Aula 2", wave = "M1", faculty = "Derecho")
)

test_that("estudio nuevo con sorteo de Cálculo y plan de Monitoreo: siembra desde Cálculo", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "monitoreo_aulas_plan", .mas_plan("MON"))
  session_set(sid, "calc_muestra_aulas_selection", list(selection = .mas_plan("CALC")))
  expect_identical(collection_aulas_siembra_get(sid)$modo, "calculo")
  expect_identical(.collection_seed_source(session_get(sid))$source, "calc_muestra_aulas_selection")
})

test_that("sin sorteo de Cálculo, el modo nuevo cae al plan de Monitoreo", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "monitoreo_aulas_plan", .mas_plan("MON"))
  expect_identical(.collection_seed_source(session_get(sid))$source, "monitoreo_aulas_plan")
})

test_that("HSVG 2026 y un plan que ya sembró de Monitoreo no cambian de fuente", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "monitoreo_aulas_plan", .mas_plan("MON"))
  session_set(sid, "calc_muestra_aulas_selection", list(selection = .mas_plan("CALC")))
  session_set(sid, "project_path", "/tmp/HSVG2026_operativo.pulso")
  g <- collection_aulas_siembra_get(sid)
  expect_identical(g$modo, "monitoreo"); expect_identical(g$origen, "operativo_hsvg")
  expect_identical(.collection_seed_source(session_get(sid))$source, "monitoreo_aulas_plan")

  sid2 <- session_create(); on.exit(session_delete(sid2), add = TRUE)
  session_set(sid2, "monitoreo_aulas_plan", .mas_plan("MON"))
  collection_state_seed(sid2)  # siembra desde Monitoreo (no hay sorteo)
  session_set(sid2, "calc_muestra_aulas_selection", list(selection = .mas_plan("CALC")))
  g2 <- collection_aulas_siembra_get(sid2)
  expect_identical(g2$modo, "monitoreo"); expect_identical(g2$origen, "plan_existente")
  expect_identical(.collection_seed_source(session_get(sid2))$source, "monitoreo_aulas_plan")
})

test_that("el interruptor se elige, se guarda y no resiembra; lo malo es 422", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "monitoreo_aulas_plan", .mas_plan("MON"))
  session_set(sid, "calc_muestra_aulas_selection", list(selection = .mas_plan("CALC")))
  antes <- session_get(sid)$collection_state
  g <- collection_aulas_siembra_put(sid, "monitoreo")
  expect_identical(g$origen, "elegido")
  expect_identical(session_get(sid)$material_aulas_siembra, "monitoreo")
  expect_identical(session_get(sid)$collection_state, antes)
  expect_identical(.collection_seed_source(session_get(sid))$source, "monitoreo_aulas_plan")
  expect_identical(.mas_code(collection_aulas_siembra_put(sid, "otro")), "E_COLLECTION_CAMPAIGN_INVALID")
})

test_that("un estudio en operativo se reconoce por su estado, no por el nombre ni la ruta (1 nov 2026)", {
  # Como HSVG 2026: el plan de Material se sembró del sorteo de Cálculo antes del interruptor,
  # Monitoreo tiene su plan vivo, el Planner no nombra el estudio y la ruta no dice «hsvg».
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "calc_muestra_aulas_selection", list(selection = .mas_plan("CALC")))
  collection_state_seed(sid)
  expect_identical(session_get(sid)$collection_state$plan$source_ref$module, "calc-muestra")
  session_set(sid, "project_path", "/tmp/copia_de_trabajo.pulso")
  expect_identical(collection_aulas_siembra_get(sid)$modo, "calculo")  # sin plan vivo en Monitoreo, los modos no difieren
  session_set(sid, "monitoreo_aulas_plan", .mas_plan("MON"))
  g <- collection_aulas_siembra_get(sid)
  expect_identical(g$modo, "monitoreo"); expect_identical(g$origen, "operativo_en_curso")
  expect_identical(.collection_seed_source(session_get(sid))$source, "monitoreo_aulas_plan")
  # Lo elegido sigue mandando.
  collection_aulas_siembra_put(sid, "calculo")
  expect_identical(collection_aulas_siembra_get(sid)$origen, "elegido")
})
