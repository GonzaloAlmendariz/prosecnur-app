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

# ---- columnas y Excel de la base (collection_supervision_base.R) ----

test_that("las columnas: del barrido sin llave ni sensibles, Responsable y Status por defecto, y las tres fijas", {
  sid <- .msupt_sesion(); on.exit(session_delete(sid), add = TRUE)
  collection_telefonica_config_put(sid, llave = "Código", estratos = list("Región", "Estatus Legal"), sensibles = list("Estatus Legal"),
                                   expected_revision = 0L)
  collection_campaign_create(sid, "supervision", "Sup", lote = "ronda-1")
  g <- collection_supervision_columnas_get(sid, "supervision.ronda-1")
  disp <- unlist(g$disponibles$barrido)
  expect_true(all(c("Nombre", "Teléfono 1", "Región", "Responsable", "Status") %in% disp))
  expect_false(any(c("Código", "Cod pulso", "Estatus Legal") %in% disp))
  expect_identical(unlist(g$elegidas$barrido), c("Responsable", "Status"))
  expect_identical(unlist(g$fijas), c("Observaciones del supervisor", "Estatus de la llamada de supervisión", "Veredicto"))
  expect_identical(unlist(g$veredictos), c("Confirmada", "No confirmada", "No contactado"))
  # Sin XLSForm cargado no hay variables de resultados que ofrecer, y no se inventan.
  expect_length(g$disponibles$resultados, 0L)

  r <- collection_supervision_columnas_put(sid, "supervision.ronda-1", barrido = list("Nombre", "Teléfono 1", "Status"), expected_revision = 0L)
  expect_identical(r$revision, 1L)
  expect_identical(unlist(r$elegidas$barrido), c("Nombre", "Teléfono 1", "Status"))
  expect_identical(.msupt_code(collection_supervision_columnas_put(sid, "supervision.ronda-1", barrido = list("Estatus Legal"))),
                   "E_COLLECTION_SUPERVISION_COLUMNAS_INVALIDAS")
  expect_identical(.msupt_code(collection_supervision_columnas_put(sid, "supervision.ronda-1", expected_revision = 0L)),
                   "E_COLLECTION_SUPERVISION_COLUMNAS_STALE")
  expect_identical(.msupt_code(collection_supervision_columnas_get(sid, "supervision.ronda-9")), "E_COLLECTION_CAMPAIGN_NOT_FOUND")
})

test_that("las variables de resultados salen del instrumento, sin notas, grupos ni metadatos", {
  sid <- .msupt_sesion(); on.exit(session_delete(sid), add = TRUE)
  collection_campaign_create(sid, "supervision", "Sup", lote = "ronda-1")
  xls <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook(); openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", data.frame(
    type = c("start", "note", "begin group", "select_one sino", "integer", "end group", "calculate"),
    name = c("start", "intro", "g1", "recibio", "monto", "", "total"),
    `label::Español` = c("", "Hola", "Grupo", "¿Recibió la ayuda?", "¿Cuánto recibió?", "", ""), check.names = FALSE))
  openxlsx::saveWorkbook(wb, xls)
  local_mocked_bindings(codif_xlsform_path = function(sid, source = NULL) xls)
  g <- collection_supervision_columnas_get(sid, "supervision.ronda-1")
  expect_identical(vapply(g$disponibles$resultados, `[[`, "", "nombre"), c("recibio", "monto"))
  expect_identical(g$disponibles$resultados[[1]]$etiqueta, "¿Recibió la ayuda?")
  r <- collection_supervision_columnas_put(sid, "supervision.ronda-1", resultados = list("recibio"))
  expect_identical(unlist(r$elegidas$resultados), "recibio")
})

test_that("el Excel: una fila por caso del lote, con lo elegido vacío y el Veredicto con su catálogo", {
  sid <- .msupt_sesion(); on.exit(session_delete(sid), add = TRUE)
  collection_campaign_create(sid, "supervision", "Sup", lote = "ronda-2")
  collection_supervision_columnas_put(sid, "supervision.ronda-2", barrido = list("Nombre", "Status"))
  r <- collection_supervision_excel(sid, "supervision.ronda-2")
  expect_identical(r$casos, 2L)
  path <- session_get(sid)$files[[r$file_id]]$path
  t <- openxlsx::read.xlsx(path, sheet = "Supervisión", check.names = FALSE, sep.names = " ")
  esperadas <- c("Código", "Enumerador", "Fecha de la llamada", "Nombre", "Status",
                 "Observaciones del supervisor", "Estatus de la llamada de supervisión", "Veredicto")
  expect_identical(names(t)[seq_along(esperadas)], esperadas)
  expect_identical(t[["Código"]], c("P021", "P022"))
  expect_identical(t$Enumerador, c("Ana", "Beto"))
  expect_true(all(is.na(t$Nombre)))  # Material no tiene los nombres: se completan desde el barrido
  control <- openxlsx::read.xlsx(path, sheet = "Control", colNames = FALSE)
  expect_identical(control[[2]][control[[1]] == "lote_id"], "ronda-2")
  expect_identical(control[[2]][control[[1]] == "viene_de"], "telefonica.principal")
  # Sin el lote en Monitoreo, no se arma.
  s <- session_get(sid); s$monitoreo_supervision_rondas <- list(rondas = list(.msupt_ronda(1))); .session_env[[sid]] <- s
  expect_identical(.msupt_code(collection_supervision_excel(sid, "supervision.ronda-2")), "E_COLLECTION_SUPERVISION_SIN_LOTE")
})
