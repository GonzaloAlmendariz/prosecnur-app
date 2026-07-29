# Coherencia entre la tarjeta de Monitoreo del home y la vista viva de cada
# familia. Regresiones cubiertas (ver api/R/monitoreo_overview_facts.R):
#   territorial   el home leia el tablero "full" congelado mientras la vista
#                 viva servia KPIs frescos de scope "advance_summary".
#   telefonico    el snapshot no guarda `dashboard`: el home mostraba 0
#                 recolectados sobre miles de filas ya sincronizadas.
#   acreditacion  el home usaba el bloque `kpis` generico (filas crudas sobre
#                 objetivo_total) en vez del modelo de efectividad: 444.9%.
#   alertas       territorial sumaba `revision + geo_no_defendible`, ejes
#                 ortogonales, dando mas alertas que casos no validos.

test_that("monitoreo_territorial_overview_facts extrae los KPIs del tablero servido", {
  dashboard <- list(territorial_reports = list(kpis = list(
    total_respuestas = 1693L, validas = 1283L, meta = 1200L, avance_pct = 107,
    revision = 11L, geo_no_defendible = 4L, gps_crossable = 900L
  )))
  facts <- monitoreo_territorial_overview_facts(dashboard)
  expect_equal(facts$validas, 1283L)
  expect_equal(facts$meta, 1200L)
  expect_equal(facts$avance_pct, 107)
  expect_equal(facts$total_respuestas, 1693L)
  expect_equal(facts$revision, 11L)
  expect_equal(facts$geo_no_defendible, 4L)
  # Solo espeja el subconjunto que consume la tarjeta (no arrastra gps_crossable).
  expect_setequal(names(facts), .MONITOREO_OVERVIEW_TERRITORIAL_KEYS)
})

test_that("monitoreo_territorial_overview_facts degrada a NULL sin KPIs territoriales", {
  expect_null(monitoreo_territorial_overview_facts(NULL))
  expect_null(monitoreo_territorial_overview_facts(list()))
  expect_null(monitoreo_territorial_overview_facts(list(kpis = list(total = 10L))))
  expect_null(monitoreo_territorial_overview_facts(list(territorial_reports = list(kpis = list()))))
})

test_that("monitoreo_snapshot_refresh_territorial_facts solo marca changed cuando cambia", {
  snapshot <- list(dashboard = list())
  dashboard <- list(territorial_reports = list(kpis = list(
    total_respuestas = 100L, validas = 80L, meta = 200L, avance_pct = 40,
    revision = 5L, geo_no_defendible = 2L
  )))
  first <- monitoreo_snapshot_refresh_territorial_facts(snapshot, dashboard)
  expect_true(first$changed)
  expect_equal(first$snapshot$territorial_overview_facts$validas, 80L)

  # Segundo pase con el mismo tablero: no debe reescribir.
  again <- monitoreo_snapshot_refresh_territorial_facts(first$snapshot, dashboard)
  expect_false(again$changed)

  # Un tablero no territorial no toca el campo (no-op).
  noop <- monitoreo_snapshot_refresh_territorial_facts(first$snapshot, list(kpis = list(total = 1L)))
  expect_false(noop$changed)
  expect_equal(noop$snapshot$territorial_overview_facts$validas, 80L)
})

test_that("el home refleja el avance vivo tras refrescar el fact territorial", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "monitoreo_config", list(monitoreo_profile = list(family = "territorial")))

  # Tablero "full" congelado en el snapshot (lo que el home leia antes del fix).
  stale_dashboard <- list(territorial_reports = list(kpis = list(
    total_respuestas = 1200L, validas = 1028L, meta = 1351L, avance_pct = 85.7,
    revision = 6L, geo_no_defendible = 3L
  )))
  session_set(sid, "monitoreo_snapshot", list(
    synced_at = "2026-07-09T07:24:00Z",
    dashboard = stale_dashboard
  ))

  # Sin fact fresco, el home cae al tablero congelado (compat hacia atras).
  mon_stale <- .project_overview_payload(sid)$facts$monitoreo
  # Levantadas = validadas (1028) + en revision (6).
  expect_equal(mon_stale$valid, 1034L)
  expect_equal(mon_stale$target, 1351L)
  expect_equal(mon_stale$avance_pct, 85.7)

  # La vista viva de "Avance territorial" sirve un tablero fresco (scope
  # advance_summary): esto es exactamente lo que el modulo muestra al usuario.
  live_dashboard <- list(territorial_reports = list(kpis = list(
    total_respuestas = 1693L, validas = 1283L, meta = 1200L, avance_pct = 107,
    revision = 11L, geo_no_defendible = 4L
  )))
  module_kpis <- .monitoreo_public_dashboard(live_dashboard)$territorial_reports$kpis

  # El backend espeja esos KPIs al snapshot (lo que hace .monitoreo_state_payload).
  s <- session_get(sid)
  refreshed <- monitoreo_snapshot_refresh_territorial_facts(s$monitoreo_snapshot, live_dashboard)
  expect_true(refreshed$changed)
  session_set(sid, "monitoreo_snapshot", refreshed$snapshot)

  # Ahora el home debe coincidir EXACTAMENTE con lo que sirve el modulo.
  mon_live <- .project_overview_payload(sid)$facts$monitoreo
  expect_equal(mon_live$valid, as.integer(module_kpis$validas + module_kpis$revision))
  expect_equal(mon_live$target, as.integer(module_kpis$meta))
  expect_equal(mon_live$collected, as.integer(module_kpis$total_respuestas))
  expect_equal(mon_live$avance_pct, module_kpis$avance_pct)
  # Alertas = casos en revision. NO se suma geo_no_defendible: validas +
  # revision + no_defendibles particionan el total, mientras que los geo_* son
  # un eje ortogonal, asi que sumarlos doble-contaba casos.
  expect_equal(mon_live$alerts, as.integer(module_kpis$revision))
  # Ya no queda rastro del avance congelado.
  expect_equal(mon_live$avance_pct, 107)
})

test_that("las alertas territoriales no doble-cuentan el eje de geolocalizacion", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "monitoreo_config", list(monitoreo_profile = list(family = "territorial")))
  # Particion real de un estudio: validas + revision + no_defendibles = total.
  # El eje geo cruza esa particion, no la extiende.
  session_set(sid, "monitoreo_snapshot", list(
    synced_at = "2026-07-24T10:00:00Z",
    territorial_overview_facts = list(
      total_respuestas = 1351L, validas = 975L, meta = 1200L, avance_pct = 81.2,
      revision = 308L, geo_no_defendible = 109L
    )
  ))
  mon <- .project_overview_payload(sid)$facts$monitoreo
  expect_equal(mon$alerts, 308L)
  # Los casos en revision son un SUBCONJUNTO de lo levantado (cuentan para el
  # avance y ademas piden revision), asi que la cota es sobre `valid`. Antes se
  # comparaba contra "lo que falta", cuando la revision quedaba fuera del
  # numerador.
  expect_lte(mon$alerts, mon$valid)
})

test_that("monitoreo_efectividad_overview_facts agrega efectivas, universo y meta", {
  dashboard <- list(
    kpis = list(total = 1277L, valid = 1277L, target = 287L, avance_pct = 444.9, inconsistencies = 39L),
    acreditacion_reports = list(client_report = list(actors = list(
      list(Actor = "Docentes", Universo = 300L, Efectivas = 250L, Parciales = 5L,
           `Sin respuesta` = 45L, Meta = 120L),
      list(Actor = "Estudiantes", Universo = 219L, Efectivas = 168L, Parciales = 2L,
           `Sin respuesta` = 49L, Meta = NA_integer_)
    )))
  )
  facts <- monitoreo_efectividad_overview_facts(dashboard)
  expect_equal(facts$efectivas, 418L)
  expect_equal(facts$universo, 519L)
  expect_equal(facts$parciales, 7L)
  expect_equal(facts$sin_respuesta, 94L)
  # Meta declarada por actor: ignora el que no declara minimo (NA).
  expect_equal(facts$meta, 120L)
  # El avance principal es contra la meta; el recorrido del universo se espeja
  # aparte porque es el respaldo cuando no hay meta.
  expect_equal(facts$avance_pct, 348.3)
  expect_equal(facts$avance_universo_pct, 80.5)
  expect_equal(facts$actores, 2L)
  expect_equal(facts$inconsistencias, 39L)
  expect_setequal(names(facts), .MONITOREO_OVERVIEW_EFECTIVIDAD_KEYS)
})

test_that("la meta cae a kpis$target cuando los actores no la declaran", {
  # Caso de los estudios reales: `Meta` por actor viene vacia y la meta vive en
  # la config (objetivo_total o la suma de goals), que el engine ya resolvio en
  # kpis$target — 287 en acrconta, 400 en el PDM telefonico.
  dashboard <- list(
    kpis = list(total = 1277L, target = 287L, inconsistencies = 39L),
    acreditacion_reports = list(client_report = list(actors = list(
      list(Actor = "Egresados", Universo = 270L, Efectivas = 157L, Parciales = 0L,
           `Sin respuesta` = 113L, Meta = NA_integer_),
      list(Actor = "Estudiantes", Universo = 249L, Efectivas = 31L, Parciales = 0L,
           `Sin respuesta` = 218L, Meta = NA_integer_)
    )))
  )
  facts <- monitoreo_efectividad_overview_facts(dashboard)
  expect_equal(facts$meta, 287L)
  expect_equal(facts$efectivas, 188L)
  expect_equal(facts$avance_pct, 65.5)
  expect_equal(facts$avance_universo_pct, 36.2)
})

test_that("monitoreo_efectividad_overview_facts degrada a NULL sin reporte de cliente", {
  expect_null(monitoreo_efectividad_overview_facts(NULL))
  expect_null(monitoreo_efectividad_overview_facts(list()))
  expect_null(monitoreo_efectividad_overview_facts(list(kpis = list(total = 10L))))
  expect_null(monitoreo_efectividad_overview_facts(
    list(acreditacion_reports = list(client_report = list(actors = list())))
  ))
})

test_that("el home de acreditacion mide efectivas contra la meta, no filas sobre objetivo", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "monitoreo_config", list(monitoreo_profile = list(family = "acreditacion")))
  # Tablero tal como lo guarda un proyecto real: el bloque `kpis` generico
  # convive con el reporte de efectividad de la familia.
  dashboard <- list(
    kpis = list(total = 1277L, valid = 1277L, target = 287L, avance_pct = 444.9, inconsistencies = 39L),
    acreditacion_reports = list(client_report = list(actors = list(
      list(Actor = "Unico", Universo = 519L, Efectivas = 188L, Parciales = 8L,
           `Sin respuesta` = 90L, Meta = NA_integer_)
    )))
  )
  session_set(sid, "monitoreo_snapshot", list(synced_at = "2026-07-23T23:09:36Z", dashboard = dashboard))

  mon <- .project_overview_payload(sid)$facts$monitoreo
  expect_equal(mon$valid, 188L)
  # `target` es la meta (lo que falta por levantar) y `collected` el recorrido
  # de la base, que es el dato secundario.
  expect_equal(mon$target, 287L)
  expect_equal(mon$collected, 519L)
  expect_equal(mon$avance_pct, 65.5)
  # El 444.9% del bloque generico no debe sobrevivir en ninguna forma.
  expect_lte(mon$avance_pct, 100)
  expect_equal(mon$valid_label, "efectivas")
  expect_equal(mon$collected_label, "universo")
  expect_equal(mon$avance_label, "avance de meta")
})

test_that("sin meta declarada el avance cae al recorrido del universo", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "monitoreo_config", list(monitoreo_profile = list(family = "acreditacion")))
  session_set(sid, "monitoreo_snapshot", list(dashboard = list(
    kpis = list(total = 600L, inconsistencies = 0L),
    acreditacion_reports = list(client_report = list(actors = list(
      list(Actor = "Unico", Universo = 519L, Efectivas = 188L, Parciales = 0L,
           `Sin respuesta` = 331L, Meta = NA_integer_)
    )))
  )))
  mon <- .project_overview_payload(sid)$facts$monitoreo
  expect_equal(mon$target, 0L)
  expect_equal(mon$avance_pct, 36.2)
  expect_equal(mon$avance_label, "avance sobre universo")
})

test_that("el home telefonico se llena con el espejo aunque el snapshot no guarde tablero", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "monitoreo_config", list(monitoreo_profile = list(family = "telefonico")))
  # Asi viaja un .pulso telefonico real: data sincronizada y NINGUN `dashboard`.
  session_set(sid, "monitoreo_snapshot", list(
    synced_at = "2026-07-24T16:59:33Z",
    data = data.frame(x = seq_len(2726))
  ))

  mon_cold <- .project_overview_payload(sid)$facts$monitoreo
  expect_equal(mon_cold$valid, 0L)

  # El warm start sirve el estado telefonico; eso espeja los facts.
  live_dashboard <- list(
    kpis = list(total = 2726L, valid = 2726L, target = 400L, avance_pct = 681.5, inconsistencies = 57L),
    acreditacion_reports = list(client_report = list(actors = list(
      list(Actor = "Hogares", Universo = 2296L, Efectivas = 423L, Parciales = 0L,
           `Sin respuesta` = 1873L, Meta = NA_integer_)
    )))
  )
  s <- session_get(sid)
  refreshed <- monitoreo_snapshot_refresh_overview_facts(s$monitoreo_snapshot, live_dashboard, "telefonico")
  expect_true(refreshed$changed)
  session_set(sid, "monitoreo_snapshot", refreshed$snapshot)

  mon <- .project_overview_payload(sid)$facts$monitoreo
  expect_equal(mon$valid, 423L)
  expect_equal(mon$target, 400L)
  expect_equal(mon$collected, 2296L)
  expect_equal(mon$alerts, 57L)
  # Meta sobrecumplida: 423 de 400. El avance puede pasar de 100 — eso es una
  # lectura verdadera, distinta del 681.5% que salia de contar filas crudas.
  expect_equal(mon$avance_pct, 105.8)
  # El recorrido de la base (18.4%) sigue disponible, pero como dato secundario.
  expect_equal(mon$collected_label, "universo")
})

test_that("espejar los facts no marca el proyecto como modificado", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "monitoreo_snapshot", list(synced_at = "2026-07-24T16:59:33Z"))
  session_set(sid, "project_dirty", FALSE)

  dashboard <- list(acreditacion_reports = list(client_report = list(actors = list(
    list(Actor = "A", Universo = 100L, Efectivas = 40L, Parciales = 0L,
         `Sin respuesta` = 60L, Meta = NA_integer_)
  ))))
  snapshot <- monitoreo_snapshot_store_overview_facts(
    sid, session_get(sid)$monitoreo_snapshot, dashboard, "telefonico"
  )
  expect_equal(snapshot$efectividad_overview_facts$efectivas, 40L)
  expect_equal(session_get(sid)$monitoreo_snapshot$efectividad_overview_facts$efectivas, 40L)
  # Abrir un proyecto y mirar su tablero no es una edicion del usuario.
  expect_false(isTRUE(session_get(sid)$project_dirty))
})

test_that("espejar los facts respeta un proyecto que ya estaba sucio", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "monitoreo_snapshot", list(synced_at = "2026-07-24T16:59:33Z"))
  session_set(sid, "project_dirty", TRUE)

  dashboard <- list(territorial_reports = list(kpis = list(
    total_respuestas = 10L, validas = 8L, meta = 20L, avance_pct = 40,
    revision = 1L, geo_no_defendible = 0L
  )))
  monitoreo_snapshot_store_overview_facts(
    sid, session_get(sid)$monitoreo_snapshot, dashboard, "territorial"
  )
  expect_true(isTRUE(session_get(sid)$project_dirty))
})

test_that("el refresco por familia escribe el campo de esa familia y nada mas", {
  dashboard <- list(acreditacion_reports = list(client_report = list(actors = list(
    list(Actor = "A", Universo = 10L, Efectivas = 4L, Parciales = 0L, `Sin respuesta` = 6L, Meta = NA_integer_)
  ))))
  out <- monitoreo_snapshot_refresh_overview_facts(list(), dashboard, "acreditacion")
  expect_true(out$changed)
  expect_equal(out$snapshot$efectividad_overview_facts$efectivas, 4L)
  expect_null(out$snapshot$territorial_overview_facts)

  # Segundo pase identico: no reescribe.
  again <- monitoreo_snapshot_refresh_overview_facts(out$snapshot, dashboard, "acreditacion")
  expect_false(again$changed)

  # Familia sin espejo definido: no-op.
  unknown <- monitoreo_snapshot_refresh_overview_facts(out$snapshot, dashboard, "digital_general")
  expect_false(unknown$changed)
})
