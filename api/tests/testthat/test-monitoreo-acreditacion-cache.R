# Cache de reportes de acreditacion.
#
# El riesgo de este cache no es que falle: es que acierte de mas. Servir el
# reporte de un corte anterior produce numeros que parecen frescos y no lo son,
# y eso es peor que esperar. Por eso la mayoria de estos tests comprueban que el
# cache SE INVALIDA, no que devuelva.

# Sin `modifyList`: solo copia elementos CON NOMBRE, y una lista de metas no los
# tiene, asi que la configuracion "distinta" salia identica a la base y el test
# comprobaba dos veces lo mismo.
.mac_cfg <- function(...) {
  base <- list(
    monitoreo_profile = list(family = "acreditacion"),
    goals = list(),
    control_vars = character(0)
  )
  extra <- list(...)
  for (nm in names(extra)) base[[nm]] <- extra[[nm]]
  base
}

.mac_data <- function(n = 3L) {
  data.frame(
    CodPulso = paste0("C", seq_len(n)),
    Estado = rep("Completa", n),
    stringsAsFactors = FALSE
  )
}

.mac_dashboard <- function(marca = "uno") list(acreditacion_reports = list(marca = marca))

test_that("aplica solo a las familias y scopes previstos", {
  expect_true(.monitoreo_acr_cache_aplica("acreditacion", "advance_summary"))
  expect_true(.monitoreo_acr_cache_aplica("telefonico", "phone_summary"))
  expect_false(.monitoreo_acr_cache_aplica("territorial", "advance_summary"))
  # `light` no lleva reportes, asi que no hay nada que cachear.
  expect_false(.monitoreo_acr_cache_aplica("acreditacion", "light"))
  expect_false(.monitoreo_acr_cache_aplica("acreditacion", "advance_summary", include_reports = FALSE))
})

test_that("guarda y recupera el mismo reporte", {
  cfg <- .mac_cfg(); datos <- .mac_data()
  info <- .monitoreo_acr_cache_key_info(list(synced_at = "2026-07-01"), datos, cfg, "advance_summary")
  snap <- .monitoreo_acr_cache_store(list(synced_at = "2026-07-01"), info, .mac_dashboard("uno"))
  hit <- .monitoreo_acr_cache_lookup(snap, info)
  expect_false(is.null(hit))
  expect_equal(hit$dashboard$acreditacion_reports$marca, "uno")
})

test_that("cada scope tiene su entrada: ese era el defecto de origen", {
  # El snapshot guardaba UN dashboard y la interfaz pedia cuatro scopes, asi
  # que tres se reconstruian siempre.
  cfg <- .mac_cfg(); datos <- .mac_data(); snap <- list(synced_at = "2026-07-01")
  scopes <- c("source", "advance_summary", "queries_summary", "phone_summary")
  infos <- lapply(scopes, function(sc) .monitoreo_acr_cache_key_info(snap, datos, cfg, sc))
  for (i in seq_along(scopes)) {
    snap <- .monitoreo_acr_cache_store(snap, infos[[i]], .mac_dashboard(scopes[[i]]))
  }
  for (i in seq_along(scopes)) {
    hit <- .monitoreo_acr_cache_lookup(snap, infos[[i]])
    expect_false(is.null(hit))
    expect_equal(hit$dashboard$acreditacion_reports$marca, scopes[[i]])
  }
})

test_that("un scope distinto no reutiliza la entrada de otro", {
  cfg <- .mac_cfg(); datos <- .mac_data(); snap <- list(synced_at = "2026-07-01")
  info_a <- .monitoreo_acr_cache_key_info(snap, datos, cfg, "advance_summary")
  info_b <- .monitoreo_acr_cache_key_info(snap, datos, cfg, "phone_summary")
  expect_false(identical(info_a$key, info_b$key))
  snap <- .monitoreo_acr_cache_store(snap, info_a, .mac_dashboard("solo-avance"))
  expect_null(.monitoreo_acr_cache_lookup(snap, info_b))
})

test_that("cambiar los datos invalida el cache", {
  cfg <- .mac_cfg(); snap <- list(synced_at = "2026-07-01")
  info_antes <- .monitoreo_acr_cache_key_info(snap, .mac_data(3L), cfg, "advance_summary")
  snap <- .monitoreo_acr_cache_store(snap, info_antes, .mac_dashboard("viejo"))
  info_despues <- .monitoreo_acr_cache_key_info(snap, .mac_data(9L), cfg, "advance_summary")
  expect_null(.monitoreo_acr_cache_lookup(snap, info_despues))
})

test_that("cambiar la configuracion invalida el cache", {
  # Se hashea la configuracion COMPLETA a proposito: enumerar campos es mas
  # rapido, pero olvidar uno sirve numeros viejos que parecen frescos.
  datos <- .mac_data(); snap <- list(synced_at = "2026-07-01")
  info <- .monitoreo_acr_cache_key_info(snap, datos, .mac_cfg(), "advance_summary")
  snap <- .monitoreo_acr_cache_store(snap, info, .mac_dashboard("viejo"))
  otra <- .mac_cfg(goals = list(list(filters = list(Actor = "Egresados"), meta = 10L)))
  expect_null(.monitoreo_acr_cache_lookup(snap, .monitoreo_acr_cache_key_info(snap, datos, otra, "advance_summary")))
})

test_that("una variable de interes nueva tambien invalida", {
  datos <- .mac_data(); snap <- list(synced_at = "2026-07-01")
  info <- .monitoreo_acr_cache_key_info(snap, datos, .mac_cfg(), "advance_summary")
  snap <- .monitoreo_acr_cache_store(snap, info, .mac_dashboard("viejo"))
  con_variable <- .mac_cfg(operational_model = list(
    interest_variables = list(list(actor = "Egresados", variable = "Ciclo de egreso"))
  ))
  expect_null(.monitoreo_acr_cache_lookup(snap, .monitoreo_acr_cache_key_info(snap, datos, con_variable, "advance_summary")))
})

test_that("una entrada manipulada no se sirve aunque la clave coincida", {
  # La clave es un digest y un digest puede colisionar; el lookup revalida los
  # tres componentes.
  cfg <- .mac_cfg(); datos <- .mac_data(); snap <- list(synced_at = "2026-07-01")
  info <- .monitoreo_acr_cache_key_info(snap, datos, cfg, "advance_summary")
  snap <- .monitoreo_acr_cache_store(snap, info, .mac_dashboard("uno"))
  snap$acreditacion_report_cache$entries[[info$key]]$config_hash <- "otro"
  expect_null(.monitoreo_acr_cache_lookup(snap, info))
})

test_that("un esquema viejo se descarta entero", {
  snap <- list(acreditacion_report_cache = list(schema = "v0", entries = list(a = list())))
  cache <- .monitoreo_acr_cache_get(snap)
  expect_equal(cache$schema, .MONITOREO_ACR_CACHE_SCHEMA)
  expect_equal(length(cache$entries), 0L)
})

test_that("el cache no crece sin freno", {
  cfg <- .mac_cfg(); snap <- list(synced_at = "2026-07-01")
  for (i in seq_len(.MONITOREO_ACR_CACHE_LIMIT + 6L)) {
    info <- .monitoreo_acr_cache_key_info(snap, .mac_data(i), cfg, "advance_summary")
    snap <- .monitoreo_acr_cache_store(snap, info, .mac_dashboard(paste0("d", i)))
  }
  expect_lte(length(snap$acreditacion_report_cache$entries), .MONITOREO_ACR_CACHE_LIMIT)
})

test_that("el merge trae lo del .pulso sin pisar lo de la sesion", {
  cfg <- .mac_cfg(); datos <- .mac_data()
  base <- list(synced_at = "2026-07-01")
  info <- .monitoreo_acr_cache_key_info(base, datos, cfg, "advance_summary")
  sesion <- .monitoreo_acr_cache_store(base, info, .mac_dashboard("de-la-sesion"))
  entrante <- .monitoreo_acr_cache_store(base, info, .mac_dashboard("del-pulso"))
  otra_info <- .monitoreo_acr_cache_key_info(base, datos, cfg, "phone_summary")
  entrante <- .monitoreo_acr_cache_store(entrante, otra_info, .mac_dashboard("solo-en-pulso"))

  fusionado <- .monitoreo_acr_cache_merge(sesion, entrante$acreditacion_report_cache)
  # La sesion gana en la clave compartida...
  expect_equal(.monitoreo_acr_cache_lookup(fusionado, info)$dashboard$acreditacion_reports$marca, "de-la-sesion")
  # ...y lo que solo estaba en el .pulso se incorpora.
  expect_equal(.monitoreo_acr_cache_lookup(fusionado, otra_info)$dashboard$acreditacion_reports$marca, "solo-en-pulso")
})

test_that("el merge ignora un cache de otro esquema", {
  snap <- list(synced_at = "2026-07-01")
  expect_equal(
    .monitoreo_acr_cache_merge(snap, list(schema = "v0", entries = list(x = list(dashboard = list())))),
    snap
  )
})
