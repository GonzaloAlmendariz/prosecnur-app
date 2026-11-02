# La base de barrido sembrada en el Sheets del estudio (decisión de Gonzalo 2 nov 2026). Sin red:
# la API de Google se reemplaza por un doble que registra cada pedido. Lo que se prueba es lo que
# no se puede romper: sólo se crean las pestañas que faltan, una que existe no recibe un solo
# pedido, no viajan datos personales ni columnas sensibles, y sin poder leer el documento no se escribe.

.mbs_code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)

.mbs_sesion <- function() {
  sid <- session_create()
  collection_campaign_create(sid, "telefonica", "Barrido RMS")
  collection_telefonica_config_put(sid, llave = "Código proGres", estratos = list("Periodo de Llegada", "Estatus Legal"),
                                   telefonos = 2, reemplazo = TRUE, muestra = 3, backup = 2,
                                   responsables = list("Agente Uno", "Agente Dos"), sensibles = list("Estatus Legal"),
                                   expected_revision = 0L)
  sid
}

# Un Sheets falso: guarda las pestañas que existen y cada pedido de escritura.
.mbs_doble <- function(existentes = character(0), env = parent.frame()) {
  estado <- new.env()
  estado$tabs <- existentes
  estado$escrituras <- list()
  meta <- function() list(sheets = lapply(seq_along(estado$tabs), function(i) list(properties = list(sheetId = 100L + i, title = estado$tabs[[i]]))))
  local_mocked_bindings(
    .monitoreo_sheets_metadata = function(spreadsheet_id) meta(),
    .monitoreo_sheets_batch_update = function(spreadsheet_id, requests) {
      estado$escrituras[[length(estado$escrituras) + 1L]] <- list(tipo = "batch", requests = requests)
      for (r in requests) if (!is.null(r$addSheet)) estado$tabs <- c(estado$tabs, r$addSheet$properties$title)
      list()
    },
    .monitoreo_google_api = function(url, method = "GET", body = NULL, ...) {
      estado$escrituras[[length(estado$escrituras) + 1L]] <- list(tipo = "values", url = url, body = body)
      list()
    },
    .env = env
  )
  estado
}

test_that("un documento vacío recibe las tres pestañas, con la base sin datos personales ni sensibles", {
  sid <- .mbs_sesion(); on.exit(session_delete(sid), add = TRUE)
  g <- .mbs_doble()
  r <- collection_telefonica_sheets_sembrar(sid, enlace = "https://docs.google.com/spreadsheets/d/AbC123_x/edit#gid=0")
  expect_identical(r$spreadsheet_id, "AbC123_x")
  expect_identical(vapply(r$hojas, `[[`, "", "accion"), c("sembrada", "sembrada", "sembrada"))
  expect_identical(vapply(r$hojas, `[[`, "", "hoja"), c("Barrido", "Listas", "Léeme"))
  expect_setequal(g$tabs, c("Barrido", "Listas", "Léeme"))

  valores <- Filter(function(w) identical(w$tipo, "values"), g$escrituras)[[1]]$body$data
  barrido <- valores[[1]]$values
  cabecera <- unlist(barrido[[1]])
  expect_identical(cabecera[1:4], c("Cod pulso", "Código proGres", "Origen", "Tanda"))
  expect_true("Periodo de Llegada" %in% cabecera)
  expect_false("Estatus Legal" %in% cabecera)
  expect_identical(r$sin_sensibles, list("Estatus Legal"))
  # Cinco casos: correlativo y Origen; el resto, vacío para que el analista pegue la base.
  expect_length(barrido, 6L)
  expect_identical(vapply(barrido[-1], function(f) f[[1]], ""), as.character(1:5))
  expect_identical(vapply(barrido[-1], function(f) f[[match("Origen", cabecera)]], ""), c("Muestra", "Muestra", "Muestra", "Backup", "Backup"))
  expect_true(all(vapply(barrido[-1], function(f) f[[match("Nombre", cabecera)]], "") == ""))
  # Los desplegables apuntan a «Listas».
  formato <- Filter(function(w) identical(w$tipo, "batch") && any(vapply(w$requests, function(q) !is.null(q$setDataValidation), TRUE)), g$escrituras)
  expect_length(formato, 1L)
  rangos <- unlist(lapply(formato[[1]]$requests, function(q) q$setDataValidation$rule$condition$values[[1]]$userEnteredValue))
  expect_true(all(startsWith(rangos, "='Listas'!")))
  expect_length(rangos, 3L)  # Status, Responsable y Origen
})

test_that("una pestaña que ya existe es del equipo: no recibe ningún pedido", {
  sid <- .mbs_sesion(); on.exit(session_delete(sid), add = TRUE)
  g <- .mbs_doble(existentes = c("Barrido", "Hoja 1"))
  r <- collection_telefonica_sheets_sembrar(sid, enlace = "AbC123_x")
  expect_identical(vapply(r$hojas, `[[`, "", "accion"), c("respetada", "sembrada", "sembrada"))
  rangos <- unlist(lapply(Filter(function(w) identical(w$tipo, "values"), g$escrituras), function(w) vapply(w$body$data, `[[`, "", "range")))
  expect_false(any(grepl("Barrido", rangos)))
  todos <- unlist(lapply(Filter(function(w) identical(w$tipo, "batch"), g$escrituras), function(w) w$requests), recursive = FALSE)
  expect_false(any(vapply(todos, function(q) !is.null(q$setDataValidation) || !is.null(q$repeatCell), TRUE)))
  # Con todo sembrado, una segunda vez no escribe nada.
  g$escrituras <- list()
  g2 <- collection_telefonica_sheets_sembrar(sid, enlace = "AbC123_x")
  expect_true(all(vapply(g2$hojas, `[[`, "", "accion") == "respetada"))
  expect_length(g$escrituras, 0L)
})

test_that("sin enlace es 422; si Google no deja leer el documento, no se escribe", {
  sid <- .mbs_sesion(); on.exit(session_delete(sid), add = TRUE)
  expect_identical(.mbs_code(collection_telefonica_sheets_sembrar(sid, enlace = "")), "E_COLLECTION_BARRIDO_SHEETS_SIN_ENLACE")
  expect_identical(.mbs_code(collection_telefonica_sheets_sembrar(sid, enlace = "https://example.com/x")), "E_COLLECTION_BARRIDO_SHEETS_SIN_ENLACE")
  escrito <- FALSE
  local_mocked_bindings(
    .monitoreo_sheets_metadata = function(spreadsheet_id) stop("403 PERMISSION_DENIED"),
    .monitoreo_sheets_batch_update = function(...) { escrito <<- TRUE; list() },
    .monitoreo_google_api = function(...) { escrito <<- TRUE; list() }
  )
  e <- tryCatch(collection_telefonica_sheets_sembrar(sid, enlace = "AbC123_x"), api_error = function(e) e)
  expect_identical(e$code, "E_COLLECTION_BARRIDO_SHEETS_GOOGLE")
  expect_match(conditionMessage(e), "PERMISSION_DENIED")
  expect_false(escrito)
})

test_that("el barrido nunca se arma en un Sheets de control de Monitoreo: es un documento propio", {
  sid <- .mbs_sesion(); on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$monitoreo_config <- list(
    aulas_universitarias = list(libro_sheets = list(spreadsheet_id = "CtrlLibro1")),
    fuentes = list(
      list(role = "respuestas", sheet_binding = list(spreadsheet_id = "https://docs.google.com/spreadsheets/d/CtrlResp2/edit")),
      list(role = "barrido", sheet_binding = list(spreadsheet_id = "Barrido9"))
    )
  )
  s$monitoreo_supervision_rondas <- list(rondas = list(list(numero = 1, publicada = list(spreadsheet_id = "CtrlSup3"))))
  .session_env[[sid]] <- s
  expect_setequal(.mbs_documentos_de_control(session_get(sid)), c("CtrlLibro1", "CtrlResp2", "CtrlSup3"))
  escrito <- FALSE
  local_mocked_bindings(
    .monitoreo_sheets_metadata = function(...) { escrito <<- TRUE; list() },
    .monitoreo_sheets_batch_update = function(...) { escrito <<- TRUE; list() },
    .monitoreo_google_api = function(...) { escrito <<- TRUE; list() }
  )
  for (enlace in c("CtrlLibro1", "https://docs.google.com/spreadsheets/d/CtrlResp2/edit#gid=0", "CtrlSup3")) {
    e <- tryCatch(collection_telefonica_sheets_sembrar(sid, enlace = enlace), api_error = function(e) e)
    expect_identical(e$code, "E_COLLECTION_BARRIDO_SHEETS_ES_CONTROL")
  }
  expect_false(escrito)
  # El que Monitoreo ya conecta como barrido sí es el de los enumeradores.
  expect_false("Barrido9" %in% .mbs_documentos_de_control(session_get(sid)))
})
