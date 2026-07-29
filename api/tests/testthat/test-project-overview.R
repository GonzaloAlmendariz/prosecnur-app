test_that("overview de proyecto reporta madurez 'new' en sesion vacia", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))

  overview <- .project_overview_payload(sid)

  expect_true(isTRUE(overview$ok))
  expect_equal(overview$schema, "project_overview_v1")
  expect_equal(overview$maturity$level, "new")
  expect_false(overview$maturity$has_any_work)
  expect_equal(overview$metrics$bases_count, 0L)
  # El agregador debe conservar los nodos por modulo canonicos.
  ids <- vapply(overview$modules, function(item) item$id, character(1))
  expect_true(all(c("carga", "calc-muestra", "monitoreo") %in% ids))
})

test_that("overview expone modulos agregados curados y normaliza slugs", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))

  overview <- .project_overview_payload(sid)
  expect_null(overview$added_modules)

  # Guardar una lista con un slug invalido: se normaliza (se descarta).
  session_set(sid, "project_modules", list("monitoreo", "procesamiento", "inexistente"))
  overview2 <- .project_overview_payload(sid)
  expect_equal(sort(unlist(overview2$added_modules)), c("monitoreo", "procesamiento"))

  expect_equal(.project_normalize_modules(list("dashboard", "dashboard")), list("dashboard"))
  expect_equal(length(.project_normalize_modules(list("no-existe"))), 0L)
})

test_that("facts.bitacora cuenta entradas del log y desglosa por tono", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "diseno_estudio_bitacora", list(
    list(title = "Decision A", tone = "decision", occurred_at = "2026-07-01T10:00:00Z"),
    list(title = "Riesgo B", tone = "riesgo", occurred_at = "2026-07-03T10:00:00Z"),
    list(title = "Nota C", tone = "nota", occurred_at = "2026-07-05T10:00:00Z")
  ))

  facts <- .project_overview_payload(sid)$facts

  expect_equal(facts$bitacora$entries_count, 3L)
  expect_equal(facts$bitacora$decisions_count, 1L)
  expect_equal(facts$bitacora$risks_count, 1L)
  # Ordenadas desc por occurred_at: la mas reciente encabeza.
  expect_equal(facts$bitacora$last_entry_title, "Nota C")
})

test_that("facts.monitoreo despacha KPIs por familia (territorial vs generico)", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))

  session_set(sid, "monitoreo_config", list(monitoreo_profile = list(family = "territorial")))
  session_set(sid, "monitoreo_snapshot", list(dashboard = list(territorial_reports = list(kpis = list(
    total_respuestas = 100L, validas = 80L, meta = 200L, avance_pct = 40,
    revision = 5L, geo_no_defendible = 2L
  )))))
  mon_t <- .project_overview_payload(sid)$facts$monitoreo
  expect_equal(mon_t$family, "territorial")
  expect_equal(mon_t$collected, 100L)
  # Numerador = lo levantado: validadas (80) + en revision (5). La revision es
  # trabajo de campo hecho pendiente de aprobar, no trabajo faltante.
  expect_equal(mon_t$valid, 85L)
  expect_equal(mon_t$valid_label, "levantadas")
  expect_equal(mon_t$avance_pct, 40)
  # Alertas = casos en revision, sin sumar el eje geo (ver
  # test-monitoreo-overview-facts.R).
  expect_equal(mon_t$alerts, 5L)

  # Telefonico sin modelo de efectividad todavia: se degrada a un conteo
  # honesto (cuantas respuestas hay) en vez de publicar el avance del bloque
  # generico, que divide filas crudas entre objetivo_total.
  session_set(sid, "monitoreo_config", list(monitoreo_profile = list(family = "telefonico")))
  session_set(sid, "monitoreo_snapshot", list(dashboard = list(kpis = list(
    total = 50L, valid = 45L, target = 100L, avance_pct = 45, inconsistencies = 3L
  ))))
  mon_g <- .project_overview_payload(sid)$facts$monitoreo
  expect_equal(mon_g$family, "telefonico")
  expect_equal(mon_g$collected, 50L)
  expect_equal(mon_g$alerts, 3L)
  expect_equal(mon_g$avance_pct, -1)
  expect_equal(mon_g$valid, 0L)
})

test_that("facts.calc detecta modo aulas y lee el summary data.frame", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "calc_muestra_aulas_selection", list(
    summary = data.frame(
      metric = c("n_aulas_m1", "unique_students_covered"),
      value = c("12", "480"),
      stringsAsFactors = FALSE
    ),
    selection = data.frame(faculty = c("Ingenieria", "Derecho", "Ingenieria"), stringsAsFactors = FALSE)
  ))

  calc <- .project_overview_payload(sid)$facts$calc
  expect_equal(calc$mode, "aulas")
  expect_equal(calc$aulas_titulares, 12L)
  expect_equal(calc$students_covered, 480L)
  expect_equal(calc$faculties_count, 2L)
})

test_that("facts de campo/formulario/dashboard se extraen de sus claves de sesion", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))

  session_set(sid, "hojas_ruta_active_phase", "field")
  session_set(sid, "hojas_ruta_config", list(territorios = list("150101", "150102"), n_objetivo = 300L))
  session_set(sid, "hojas_ruta_workspace_outputs", list(
    sample = list(n_blocks = 25L, total_entrevistas = 300L, n_replacement_blocks = 10L),
    quota = list(total_asignado = 300L)
  ))
  session_set(sid, "hojas_ruta_runs", list(pilot = list(role = "pilot"), field = list(role = "field")))

  session_set(sid, "monitoreo_aulas_plan", list(
    list(wave = "M1", link = "http://a", faculty = "Ing", eligible_n = 30),
    list(wave = "M1", link = "", faculty = "Der", eligible_n = 25),
    list(wave = "R1", sample_role = "chain_reserve", link = "http://c", faculty = "Ing", eligible_n = 0)
  ))

  session_set(sid, "xlsform_state", list(
    source = list(kind = "surveymonkey"),
    workbook = list(
      survey = list(
        columns = list("type", "name", "label"),
        rows = list(
          list("begin_group", "g1", "Grupo"),
          list("select_one si_no", "p1", "Pregunta 1"),
          list("text", "p2", "Nombre"),
          list("end_group", "", "")
        )
      ),
      choices = list(
        columns = list("list_name", "name", "label"),
        rows = list(list("si_no", "1", "Si"), list("si_no", "0", "No"))
      )
    )
  ))

  session_set(sid, "dashboard_curacion", list(confirmed = TRUE, exclude_vars = list("v1", "v2")))
  session_set(sid, "dashboard_source", list(n_filas = 500L))
  session_set(sid, "dashboard_config", list(last_deploy = list(published_at = "2026-07-05T10:00:00Z")))

  facts <- .project_overview_payload(sid)$facts

  expect_equal(facts$hojas$phase, "field")
  expect_equal(facts$hojas$districts_count, 2L)
  expect_equal(facts$hojas$blocks_count, 25L)
  expect_equal(facts$hojas$interviews_count, 300L)
  expect_true(facts$hojas$from_pilot)

  expect_equal(facts$recopiladores$titulares, 2L)
  expect_equal(facts$recopiladores$with_link, 1L)   # solo titulares con enlace
  expect_equal(facts$recopiladores$without_link, 1L)
  expect_equal(facts$recopiladores$faculties_count, 2L)

  expect_equal(facts$editor$source_kind, "surveymonkey")
  expect_equal(facts$editor$questions_count, 2L)
  expect_equal(facts$editor$sections_count, 1L)
  expect_equal(facts$editor$catalogs_count, 1L)

  expect_true(facts$dashboard$confirmed)
  expect_equal(facts$dashboard$excluded_vars_count, 2L)
  expect_true(facts$dashboard$published)
  expect_equal(facts$dashboard$rows_count, 500L)
})

test_that("overview de proyecto reporta madurez 'in_progress' con trabajo real", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "calc_muestra_estudio", list(
    titulo = "Estudio de prueba",
    contexto = list(cliente = "Cliente"),
    componentes = list(
      list(actor = "estudiantes", resultado = list(n_objetivo = 200L))
    )
  ))
  session_set(sid, "monitoreo_snapshot", list(synced_at = "2026-07-01T10:00:00Z"))

  overview <- .project_overview_payload(sid)

  expect_equal(overview$maturity$level, "in_progress")
  expect_true(overview$maturity$has_any_work)
  expect_equal(overview$metrics$sample_target_n, 200L)
  expect_equal(overview$metrics$monitoreo_last_cut, "2026-07-01T10:00:00Z")
  expect_equal(overview$project$name, "Estudio de prueba")
  expect_equal(overview$project$client, "Cliente")
})

test_that("overview deriva el nombre del proyecto del .pulso cuando el titulo es sentinel o vacio", {
  # Titulo real del estudio: se respeta tal cual.
  expect_equal(
    .overview_project_name(list(title = "Encuesta ACNUR 2026"), "/x/y/HSVG2026.pulso"),
    "Encuesta ACNUR 2026"
  )
  # Sentinel por defecto: deriva del nombre del archivo .pulso.
  expect_equal(
    .overview_project_name(list(title = "Estudio sin título"), "/ruta/al/HSVG2026.pulso"),
    "HSVG2026"
  )
  # Titulo vacio + ruta estilo Windows con backslashes.
  expect_equal(
    .overview_project_name(list(title = ""), "C:\\Users\\me\\Padron 2026.pulso"),
    "Padron 2026"
  )
  # Sin titulo ni ruta: cae al sentinel.
  expect_equal(.overview_project_name(list(), ""), "Estudio sin título")
})

test_that("facts.editor lee el instrumento vinculado y no el borrador del editor", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))

  # Caso real (ACNUR ACG): el estudio tiene un instrumento vinculado de decenas
  # de preguntas y el borrador del editor esta practicamente vacio. La tarjeta
  # decia "1 pregunta" para un cuestionario de 100 variables.
  session_set(sid, "xlsform_state", list(workbook = list(
    survey = list(
      columns = list("type", "name"),
      rows = list(list("text", "unica_del_borrador"))
    ),
    choices = list(columns = list("list_name"), rows = list(list("si_no")))
  )))
  session_set(sid, "rp_inst", list(
    survey = data.frame(
      type = c("begin_group", "text", "select_one", "integer", "end_group", "note"),
      name = c("grupo", "p1", "p2", "p3", "", "aviso"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("sexo", "sexo", "edad"),
      stringsAsFactors = FALSE
    )
  ))

  editor <- .project_overview_payload(sid)$facts$editor
  expect_equal(editor$questions_count, 4L)
  expect_equal(editor$sections_count, 1L)
  expect_equal(editor$catalogs_count, 2L)
  expect_equal(editor$instruments_count, 1L)
})

test_that("sin instrumento vinculado, facts.editor sigue leyendo el borrador", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "xlsform_state", list(
    source = list(kind = "xlsform"),
    workbook = list(
      survey = list(
        columns = list("type", "name"),
        rows = list(list("text", "p1"), list("text", "p2"), list("begin_group", "g"))
      ),
      choices = list(columns = list("list_name"), rows = list(list("si_no")))
    )
  ))
  editor <- .project_overview_payload(sid)$facts$editor
  expect_equal(editor$questions_count, 2L)
  expect_equal(editor$sections_count, 1L)
  expect_equal(editor$instruments_count, 0L)
})
