# La campaña de supervisión de Material (ADR 0125 anexo A3): una por lote que arma Monitoreo, relacionada
# con la telefónica de la que viene. Material no recalcula a quién supervisar: lee el lote.

.msupt_code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)

.msupt_ronda <- function(numero) list(
  numero = numero, generada_el = "2026-11-02T08:00:00-05:00", semilla = 7L, porcentaje = 10, cantidad = 2L, universo = 20L,
  casos = data.frame(N = 1:2, CodPulso = sprintf("P%03d", 1:2 + numero * 10), proGres = "", Enumerador = c("Ana", "Beto"),
                     `Categoría` = "", `Fecha Kobo` = "2026-10-30", `Response ID` = "", Origen = "sorteo",
                     check.names = FALSE, stringsAsFactors = FALSE),
  reparto = data.frame())

.msupt_sesion <- function(rondas = list(.msupt_ronda(1), .msupt_ronda(2)), telefonica = TRUE) {
  sid <- session_create()
  if (telefonica) collection_campaign_create(sid, "telefonica", "Barrido RMS")
  s <- session_get(sid)
  s$monitoreo_supervision_rondas <- list(rondas = rondas)
  .session_env[[sid]] <- s
  sid
}

.msupt_tipo <- function(sid) Filter(function(t) identical(t$tipo, "supervision"), collection_campaigns_get(sid)$tipos)[[1]]

test_that("sin telefónica o sin lotes, la supervisión no está disponible y dice por qué", {
  sid <- .msupt_sesion(telefonica = FALSE); on.exit(session_delete(sid), add = TRUE)
  expect_false(.msupt_tipo(sid)$disponible)
  expect_match(.msupt_tipo(sid)$motivo, "campaña telefónica")
  expect_identical(.msupt_code(collection_campaign_create(sid, "supervision", "Sup", lote = "ronda-1")), "E_COLLECTION_SUPERVISION_SIN_LOTE")
  sid2 <- .msupt_sesion(rondas = list()); on.exit(session_delete(sid2), add = TRUE)
  expect_match(.msupt_tipo(sid2)$motivo, "lote de supervisión")
})

test_that("una campaña por lote, relacionada con la telefónica, con los casos del lote", {
  sid <- .msupt_sesion(); on.exit(session_delete(sid), add = TRUE)
  t <- .msupt_tipo(sid)
  expect_true(t$disponible)
  expect_identical(vapply(t$lotes_libres, `[[`, "", "lote_id"), c("ronda-1", "ronda-2"))
  rev <- collection_campaigns_get(sid)$registry_revision
  r <- collection_campaign_create(sid, "supervision", "Supervisión ronda 1", lote = "ronda-1", expected_registry_revision = rev)
  expect_identical(r$campaign$id, "supervision.ronda-1")
  expect_identical(r$campaign$relacion$viene_de, "telefonica.principal")
  expect_identical(r$campaign$ref$lote_id, "ronda-1")
  expect_identical(r$campaign$estado$casos, 2L)
  expect_false(r$campaign$estado$sin_lote)
  # La relación se guarda en la entrada del registro, no sólo en la proyección.
  entry <- Find(function(e) identical(e$id, "supervision.ronda-1"), session_get(sid)$material_campaigns$campaigns)
  expect_identical(entry$relacion$viene_de, "telefonica.principal")
  expect_identical(.msupt_code(collection_campaign_create(sid, "supervision", "Otra", lote = "ronda-1")), "E_COLLECTION_SUPERVISION_UNICA")
  expect_identical(.msupt_code(collection_campaign_create(sid, "supervision", "Otra", lote = "ronda-9")), "E_COLLECTION_SUPERVISION_SIN_LOTE")
  expect_identical(.msupt_code(collection_campaign_create(sid, "supervision", "Otra")), "E_COLLECTION_SUPERVISION_SIN_LOTE")
  expect_identical(vapply(.msupt_tipo(sid)$lotes_libres, `[[`, "", "lote_id"), "ronda-2")
  # Se renombra y archiva como las demás.
  m <- collection_campaign_meta_put(sid, "supervision.ronda-1", name = "Sup. R1", archived = TRUE)
  expect_identical(m$campaign$name, "Sup. R1")
  expect_true(m$campaign$archived)
})

test_that("si Monitoreo borra el lote, la campaña lo dice en vez de inventar casos", {
  sid <- .msupt_sesion(); on.exit(session_delete(sid), add = TRUE)
  collection_campaign_create(sid, "supervision", "Sup", lote = "ronda-2")
  s <- session_get(sid); s$monitoreo_supervision_rondas <- list(rondas = list(.msupt_ronda(1))); .session_env[[sid]] <- s
  c <- Find(function(x) identical(x$id, "supervision.ronda-2"), collection_campaigns_get(sid)$campaigns)
  expect_true(c$estado$sin_lote)
  expect_identical(c$estado$casos, 0L)
})
