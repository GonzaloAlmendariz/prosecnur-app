# F4/F10 — Los on_complete de los jobs de aulas no pisan la sesion con
# resultados de un marco viejo.
#
# Un job de comparar/seleccionar/simular puede terminar DESPUES de que el
# usuario reconstruyo el marco (marco/construir invalida seleccion y
# comparacion). El callback captura frame_hash al submit y solo persiste si el
# marco vigente coincide; si no, deja la nota `stale_job_result` en la sesion
# (el resultado completo sigue en el job store). Las fabricas de callbacks
# estan extraidas del router justamente para poder testearlas sin HTTP.

.frescura_frame <- function(hash) {
  list(schema = "calc_muestra_aulas_frame_v1", frame_hash = hash,
       aula_frame = data.frame(classroom_id = "A1", stringsAsFactors = FALSE))
}

.frescura_job <- function(id, kind, result) {
  list(id = id, kind = kind, result_data = result)
}

test_that("comparar: el callback persiste con marco vigente y NO persiste con marco reemplazado", {
  sid <- session_create()
  session_set(sid, "calc_muestra_aulas_frame", .frescura_frame("h1"))

  # Caso fresco: mismo hash -> escribe comparacion y limpia la nota.
  cb <- prosecnurapp:::.cm_aulas_comparar_on_complete(sid, list(mark = "cfg1"), "h1")
  publico <- cb(.frescura_job("job-c1", "calc_muestra_aulas_comparar",
                              list(schema = "cmp", simulation_runs = 10L)))
  s <- session_get(sid)
  expect_equal(s$calc_muestra_aulas_method_comparison$schema, "cmp")
  expect_null(s$calc_muestra_aulas_stale_job_result)
  expect_false(isTRUE(publico$stale_frame))

  # Caso stale: el usuario reconstruyo el marco (hash nuevo) durante el job.
  session_set(sid, "calc_muestra_aulas_frame", .frescura_frame("h2"))
  cb_viejo <- prosecnurapp:::.cm_aulas_comparar_on_complete(sid, list(mark = "cfg1"), "h1")
  publico2 <- cb_viejo(.frescura_job("job-c2", "calc_muestra_aulas_comparar",
                                     list(schema = "cmp_vieja", simulation_runs = 10L)))
  s <- session_get(sid)
  # La comparacion vigente sigue siendo la del marco actual, no la del job viejo.
  expect_equal(s$calc_muestra_aulas_method_comparison$schema, "cmp")
  stale <- s$calc_muestra_aulas_stale_job_result
  expect_equal(stale$job_id, "job-c2")
  expect_equal(stale$frame_hash, "h1")
  expect_true(isTRUE(publico2$stale_frame))
})

test_that("seleccionar: la sesion NO queda con seleccion del hash viejo tras reconstruir el marco", {
  sid <- session_create()
  session_set(sid, "calc_muestra_aulas_frame", .frescura_frame("h1"))

  # El job se somete contra h1... y el usuario reconstruye el marco (h2).
  cb <- prosecnurapp:::.cm_aulas_seleccionar_on_complete(sid, list(mark = "cfg"), "h1")
  session_set(sid, "calc_muestra_aulas_frame", .frescura_frame("h2"))
  session_set(sid, "calc_muestra_aulas_selection", NULL)

  publico <- cb(.frescura_job("job-s1", "calc_muestra_aulas_seleccionar",
                              list(schema = "sel", selection_run_id = "run_vieja", frame_hash = "h1")))
  s <- session_get(sid)
  expect_null(s$calc_muestra_aulas_selection) # el resultado viejo NO se aplico
  expect_equal(s$calc_muestra_aulas_stale_job_result$job_id, "job-s1")
  expect_true(isTRUE(publico$stale_frame))

  # Con marco vigente si persiste y adjunta la comparacion de la sesion.
  session_set(sid, "calc_muestra_aulas_method_comparison", list(schema = "cmp_fresca"))
  cb2 <- prosecnurapp:::.cm_aulas_seleccionar_on_complete(sid, list(mark = "cfg"), "h2")
  publico2 <- cb2(.frescura_job("job-s2", "calc_muestra_aulas_seleccionar",
                                list(schema = "sel", selection_run_id = "run_nueva", frame_hash = "h2")))
  s <- session_get(sid)
  expect_equal(s$calc_muestra_aulas_selection$selection_run_id, "run_nueva")
  expect_equal(s$calc_muestra_aulas_selection$method_comparison$schema, "cmp_fresca")
  expect_null(s$calc_muestra_aulas_stale_job_result) # la nota se limpia al aplicar fresco
  expect_false(isTRUE(publico2$stale_frame))
})

test_that("simular-reemplazos: exige marco vigente Y la misma seleccion (selection_run_id)", {
  sid <- session_create()
  session_set(sid, "calc_muestra_aulas_frame", .frescura_frame("h1"))
  session_set(sid, "calc_muestra_aulas_selection", list(selection_run_id = "run_a"))

  # Mismo marco pero la seleccion fue re-sorteada durante el job -> stale.
  cb <- prosecnurapp:::.cm_aulas_simular_on_complete(sid, list(mark = "cfg"), "h1", "run_vieja")
  publico <- cb(.frescura_job("job-r1", "calc_muestra_aulas_simular_reemplazos",
                              list(schema = "rep", suggestions = data.frame(x = 1))))
  s <- session_get(sid)
  expect_null(s$calc_muestra_aulas_replacement_simulation)
  expect_equal(s$calc_muestra_aulas_stale_job_result$job_id, "job-r1")
  expect_true(isTRUE(publico$stale_frame))

  # Marco y seleccion vigentes -> persiste y adjunta a la seleccion.
  cb2 <- prosecnurapp:::.cm_aulas_simular_on_complete(sid, list(mark = "cfg"), "h1", "run_a")
  publico2 <- cb2(.frescura_job("job-r2", "calc_muestra_aulas_simular_reemplazos",
                                list(schema = "rep", suggestions = data.frame(x = 1:2))))
  s <- session_get(sid)
  expect_equal(s$calc_muestra_aulas_replacement_simulation$schema, "rep")
  expect_equal(s$calc_muestra_aulas_selection$replacement_simulation$schema, "rep")
  expect_null(s$calc_muestra_aulas_stale_job_result)
  expect_false(isTRUE(publico2$stale_frame))
  expect_equal(publico2$suggestions_n, 2L)
})

test_that("jobs viejos no repueblan artefactos tras cambiar Alumnos por CH", {
  decision <- function(method, at) list(
    schema = "calc_muestra_alumnos_por_ch_decision_v1",
    frame_hash = "h1",
    denominador = "elegible",
    estadistico_default = method,
    por_facultad = list(),
    confirmado_at = at
  )
  estudio <- function(value) list(
    workspace = list(aulas_config = list(alumnos_por_ch_decision = value))
  )
  old_decision <- decision("media", "2026-08-02T05:00:00Z")
  new_decision <- decision("p25", "2026-08-02T06:00:00Z")
  old_config <- calc_muestra_aulas_normalize_config(list(
    alumnos_por_ch_decision = old_decision
  ))

  sid_compare <- session_create()
  session_set(sid_compare, "calc_muestra_aulas_frame", .frescura_frame("h1"))
  session_set(sid_compare, "calc_muestra_estudio", estudio(new_decision))
  compare_cb <- prosecnurapp:::.cm_aulas_comparar_on_complete(
    sid_compare, old_config, "h1"
  )
  compare_public <- compare_cb(.frescura_job(
    "job-d1", "calc_muestra_aulas_comparar", list(schema = "cmp-vieja")
  ))
  expect_true(isTRUE(compare_public$stale_frame))
  expect_null(session_get(sid_compare)$calc_muestra_aulas_method_comparison)

  sid_select <- session_create()
  session_set(sid_select, "calc_muestra_aulas_frame", .frescura_frame("h1"))
  session_set(sid_select, "calc_muestra_estudio", estudio(new_decision))
  select_cb <- prosecnurapp:::.cm_aulas_seleccionar_on_complete(
    sid_select, old_config, "h1"
  )
  select_public <- select_cb(.frescura_job(
    "job-d2", "calc_muestra_aulas_seleccionar",
    list(schema = "sel-vieja", selection_run_id = "run-a", frame_hash = "h1")
  ))
  expect_true(isTRUE(select_public$stale_frame))
  expect_null(session_get(sid_select)$calc_muestra_aulas_selection)

  sid_replace <- session_create()
  session_set(sid_replace, "calc_muestra_aulas_frame", .frescura_frame("h1"))
  session_set(sid_replace, "calc_muestra_estudio", estudio(new_decision))
  session_set(sid_replace, "calc_muestra_aulas_selection", list(selection_run_id = "run-a"))
  replace_cb <- prosecnurapp:::.cm_aulas_simular_on_complete(
    sid_replace, old_config, "h1", "run-a"
  )
  replace_public <- replace_cb(.frescura_job(
    "job-d3", "calc_muestra_aulas_simular_reemplazos",
    list(schema = "rep-vieja", suggestions = data.frame(x = 1))
  ))
  expect_true(isTRUE(replace_public$stale_frame))
  expect_null(session_get(sid_replace)$calc_muestra_aulas_replacement_simulation)
})

test_that("cambiar Alumnos por CH borra todo artefacto de Aulas en sesión", {
  sid <- session_create()
  session_set(sid, "calc_muestra_aulas_selection", list(schema = "sel-vieja"))
  session_set(sid, "calc_muestra_aulas_method_comparison", list(schema = "cmp-vieja"))
  session_set(sid, "calc_muestra_aulas_replacement_simulation", list(schema = "rep-vieja"))
  session_set(sid, "calc_muestra_aulas_export", list(file_id = "export-viejo"))
  session_set(sid, "calc_muestra_aulas_stale_job_result", list(job_id = "job-viejo"))

  prosecnurapp:::.cm_aulas_invalidar_derivados_decision(sid)
  state <- session_get(sid)
  expect_null(state$calc_muestra_aulas_selection)
  expect_null(state$calc_muestra_aulas_method_comparison)
  expect_null(state$calc_muestra_aulas_replacement_simulation)
  expect_null(state$calc_muestra_aulas_export)
  expect_null(state$calc_muestra_aulas_stale_job_result)
})

test_that("e2e: job real de seleccion termina tras reconstruir el marco y NO pisa la sesion", {
  skip_if_not_installed("callr")

  old_api_dir <- Sys.getenv("PULSO_API_DIR", unset = NA_character_)
  Sys.setenv(PULSO_API_DIR = normalizePath(".", mustWork = TRUE))
  on.exit({
    if (is.na(old_api_dir)) Sys.unsetenv("PULSO_API_DIR") else Sys.setenv(PULSO_API_DIR = old_api_dir)
    jobs_kill_all()
  }, add = TRUE)

  base <- data.frame(
    student_id = paste0("s", 1:36),
    aula_id = rep(paste0("A", 1:6), each = 6),
    curso_id = rep(paste0("C", 1:6), each = 6),
    curso = rep(paste("Curso", 1:6), each = 6),
    horario = rep(c("manana", "tarde"), length.out = 36),
    facultad = rep(c("FAC1", "FAC2"), each = 18),
    programa = rep(c("P1", "P2"), length.out = 36),
    sexo = rep(c("F", "M"), length.out = 36),
    edad = 20,
    condicion = "regular",
    nivel = "pregrado",
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(seed = 5L, n_aulas = 2L, replacement_waves = 0L,
                    selector_engine = "sistematico_pps",
                    strata_cols = list("faculty"), monte_carlo_n = 0L)
  ))
  frame_v1 <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  # Marco v2: mismo insumo con filtro distinto -> hash distinto.
  cfg2 <- cfg
  cfg2$filters$min_eligible_per_class <- 2L
  frame_v2 <- calc_muestra_aulas_construir(base_madre = base, config = cfg2)
  expect_false(identical(frame_v1$frame_hash, frame_v2$frame_hash))

  sid <- session_create()
  session_set(sid, "calc_muestra_aulas_frame", frame_v1)

  job_id <- job_submit(
    sid = sid,
    kind = "calc_muestra_aulas_seleccionar",
    func = calc_muestra_aulas_seleccionar_job,
    args = list(frame = frame_v1, config = cfg),
    on_complete = prosecnurapp:::.cm_aulas_seleccionar_on_complete(
      sid, cfg, prosecnurapp:::.cm_aulas_scalar(frame_v1$frame_hash, "")
    )
  )

  # El usuario reconstruye el marco ANTES de que el poll coseche el job
  # (mismo efecto que POST /marco/construir: frame nuevo + seleccion NULL).
  session_set(sid, "calc_muestra_aulas_frame", frame_v2)
  session_set(sid, "calc_muestra_aulas_selection", NULL)

  deadline <- Sys.time() + 90
  repeat {
    job <- job_poll(job_id)
    if (!identical(job$status, "running")) break
    if (Sys.time() > deadline) fail("El job de seleccion no termino a tiempo.")
    Sys.sleep(0.3)
  }

  expect_equal(job$status, "done")
  expect_true(isTRUE(job$result_public$stale_frame))
  s <- session_get(sid)
  # La sesion NO quedo con la seleccion del marco viejo...
  expect_null(s$calc_muestra_aulas_selection)
  # ...y la nota apunta al job para que la UI pueda avisar/reofrecer.
  expect_equal(s$calc_muestra_aulas_stale_job_result$job_id, job_id)
  expect_equal(s$calc_muestra_aulas_stale_job_result$frame_hash, frame_v1$frame_hash)
})
