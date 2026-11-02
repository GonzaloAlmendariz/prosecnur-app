# La campaña telefónica de Material (P10): un tipo más del registro, con su configuración
# y la plantilla del barrido armada con ella. Sin datos personales del listado.

.mtel_code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)

test_that("el tipo aparece disponible, se crea una sola vez y se lista con su estado", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  antes <- collection_campaigns_get(sid)
  tel <- Filter(function(t) identical(t$tipo, "telefonica"), antes$tipos)[[1]]
  expect_true(tel$disponible)
  r <- collection_campaign_create(sid, "telefonica", "Barrido RMS")
  expect_identical(r$campaign$id, "telefonica.principal")
  expect_identical(r$campaign$estado$casos, 0L)
  expect_false(r$campaign$estado$configurada)
  despues <- collection_campaigns_get(sid)
  expect_false(Filter(function(t) identical(t$tipo, "telefonica"), despues$tipos)[[1]]$disponible)
  expect_identical(.mtel_code(collection_campaign_create(sid, "telefonica", "Otra")), "E_COLLECTION_CAMPAIGN_TELEFONICA_UNICA")
  expect_identical(.mtel_code(collection_campaign_create(sid, "telefonica", "Otra", fase = "field")), "E_COLLECTION_CAMPAIGN_TELEFONICA_UNICA")
  m <- collection_campaign_meta_put(sid, "telefonica.principal", name = "Barrido RMS 2026")
  expect_identical(m$campaign$name, "Barrido RMS 2026")
})

test_that("la configuración se guarda con revisión y con las reglas de la plantilla", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  collection_campaign_create(sid, "telefonica", "Barrido RMS")
  g <- collection_telefonica_config_get(sid)
  expect_identical(g$revision, 0L)
  expect_identical(length(g$status), 14L)
  expect_false(g$status_propio)
  r <- collection_telefonica_config_put(sid, llave = "Código proGres", estratos = list("Periodo de Llegada"), telefonos = 3,
                                        muestra = 400, backup = 400, responsables = list("Responsable", "Agente Uno"),
                                        expected_revision = 0L)
  expect_identical(r$revision, 1L)
  expect_identical(r$responsables, list("Agente Uno"))
  expect_identical(r$lee_monitoreo[[1]], "Código proGres")
  expect_true(collection_campaigns_get(sid)$campaigns[[1]]$estado$configurada)
  expect_identical(.mtel_code(collection_telefonica_config_put(sid, muestra = 1, expected_revision = 0L)), "E_COLLECTION_TELEFONICA_CONFIG_STALE")
  expect_identical(.mtel_code(collection_telefonica_config_put(sid, telefonos = 5)), "E_COLLECTION_TELEFONICA_CONFIG_INVALIDA")
  expect_identical(.mtel_code(collection_telefonica_config_put(sid, muestra = -1)), "E_COLLECTION_TELEFONICA_CONFIG_INVALIDA")
  expect_identical(.mtel_code(collection_telefonica_config_put(sid, estratos = list("Status"))), "E_COLLECTION_TELEFONICA_CONFIG_INVALIDA")
  expect_identical(collection_telefonica_config_get(sid)$revision, 1L)
})

test_that("con reemplazo, Entrega declara «Origen» entre lo que lee Monitoreo", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  collection_campaign_create(sid, "telefonica", "Barrido RMS")
  sin <- collection_telefonica_config_put(sid, muestra = 10, backup = 5, expected_revision = 0L)
  expect_false("Origen" %in% unlist(sin$lee_monitoreo))
  # La cola y los no barridos de Monitoreo separan muestra de backup por «Origen»: también es llave.
  con <- collection_telefonica_config_put(sid, reemplazo = TRUE, expected_revision = 1L)
  expect_identical(utils::tail(unlist(con$lee_monitoreo), 1L), "Origen")
})

test_that("la plantilla sale con la configuración y con tantas filas como casos", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  collection_campaign_create(sid, "telefonica", "Barrido RMS")
  collection_telefonica_config_put(sid, llave = "Código proGres", estratos = list("Sede"), muestra = 30, backup = 10)
  r <- collection_telefonica_plantilla(sid)
  expect_identical(r$filas, 40L)
  expect_identical(unlist(r$columnas[1:2]), c("Cod pulso", "Código proGres"))
  expect_true("Sede" %in% unlist(r$columnas))
  expect_identical(.mtel_code(collection_telefonica_config_get(sid, "telefonica.otra")), "E_COLLECTION_CAMPAIGN_NOT_FOUND")
})

test_that("con reemplazo, la columna Origen llega llena: muestra primero, backup después", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  collection_campaign_create(sid, "telefonica", "Barrido RMS")
  collection_telefonica_config_put(sid, reemplazo = TRUE, muestra = 3, backup = 2)
  r <- collection_telefonica_plantilla(sid)
  path <- session_get(sid)$files[[r$file_id]]$path
  hoja <- openxlsx::read.xlsx(path, sheet = "Barrido", check.names = FALSE, sep.names = " ")
  expect_identical(hoja$Origen, c("Muestra", "Muestra", "Muestra", "Backup", "Backup"))
  # Sin reemplazo no hay columna Origen.
  collection_telefonica_config_put(sid, reemplazo = FALSE)
  r2 <- collection_telefonica_plantilla(sid)
  expect_false("Origen" %in% unlist(r2$columnas))
})

test_that("HTTP: config y plantilla", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  collection_campaign_create(sid, "telefonica", "Barrido RMS")
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  g <- .hre_call(pr, sid, "GET", "/api/recopiladores/campaigns/telefonica/config", query = "id=telefonica.principal")
  expect_identical(g$status, 200L)
  p <- .hre_call(pr, sid, "PUT", "/api/recopiladores/campaigns/telefonica/config",
                 body = .hre_json(list(id = "telefonica.principal", muestra = 5, expected_revision = 0L)))
  expect_identical(p$status, 200L)
  expect_identical(p$body$muestra, 5L)
  x <- .hre_call(pr, sid, "POST", "/api/recopiladores/campaigns/telefonica/plantilla", body = .hre_json(list(id = "telefonica.principal")))
  expect_identical(x$status, 200L)
  expect_true(nzchar(x$body$file_id))
})

test_that("en acreditación la telefónica y la de aulas guardan su propósito; fuera de ella, no hay clave (ADR 0125 A4)", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  local_mocked_bindings(.planner_modos = function(s) list(material = list(proposito = "acreditacion")))
  r <- collection_campaign_create(sid, "telefonica", "Acreditación telefónica")
  expect_identical(r$campaign$proposito, "acreditacion")
  entry <- Find(function(e) identical(e$tipo, "telefonica"), session_get(sid)$material_campaigns$campaigns)
  expect_identical(entry$proposito, "acreditacion")
  a <- collection_campaign_create(sid, "aulas", "Acreditación en aulas")
  expect_identical(a$campaign$proposito, "acreditacion")

  sid2 <- session_create(); on.exit(session_delete(sid2), add = TRUE)
  local_mocked_bindings(.planner_modos = function(s) list(material = list(proposito = NULL)))
  collection_campaign_create(sid2, "telefonica", "Barrido")
  entry2 <- Find(function(e) identical(e$tipo, "telefonica"), session_get(sid2)$material_campaigns$campaigns)
  expect_false("proposito" %in% names(entry2))
  expect_null(collection_campaigns_get(sid2)$campaigns[[1]]$proposito)
})
