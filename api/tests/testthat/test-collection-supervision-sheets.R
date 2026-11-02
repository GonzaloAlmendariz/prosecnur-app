# La base de supervisión en su propio Sheets (ADR 0125 A3; Gonzalo: «Fórmula en el Sheets»). Sin red: Google
# se reemplaza por un doble que registra cada pedido y responde la fórmula de prueba según el idioma del
# documento. Lo que no se puede romper: no viaja PII, el separador sale del documento y no del locale, una
# pestaña existente no recibe pedidos y la supervisión nunca va en el documento del barrido.

.msst_ronda <- function(numero) list(
  numero = numero, generada_el = "2026-11-02T08:00:00-05:00", semilla = 7L, porcentaje = 10, cantidad = 2L, universo = 20L,
  casos = data.frame(N = 1:2, CodPulso = c("00123", "P022"), proGres = "", Enumerador = c("Ana", "Beto"),
                     `Categoría` = "", `Fecha Kobo` = "2026-10-30", `Response ID` = "", Origen = "sorteo",
                     check.names = FALSE, stringsAsFactors = FALSE),
  reparto = data.frame())

.msst_sesion <- function(con_barrido = TRUE) {
  sid <- session_create()
  collection_campaign_create(sid, "telefonica", "Barrido RMS")
  s <- session_get(sid)
  s$monitoreo_supervision_rondas <- list(rondas = list(.msst_ronda(1)))
  if (con_barrido) s$material_telefonica_sheets <- list(campaign_id = "telefonica.principal", spreadsheet_id = "BARRIDO1")
  .session_env[[sid]] <- s
  collection_campaign_create(sid, "supervision", "Sup R1", lote = "ronda-1")
  collection_supervision_columnas_put(sid, "supervision.ronda-1", barrido = list("Nombre", "Teléfono 1", "Status"))
  sid
}

.msst_doble <- function(idioma = "es", existentes = character(0), env = parent.frame()) {
  e <- new.env()
  e$tabs <- existentes; e$escrituras <- list()
  local_mocked_bindings(
    .monitoreo_sheets_metadata = function(id) list(sheets = lapply(seq_along(e$tabs), function(i) list(properties = list(sheetId = i, title = e$tabs[[i]])))),
    .monitoreo_sheets_batch_update = function(id, requests) {
      e$escrituras[[length(e$escrituras) + 1L]] <- list(id = id, tipo = "batch", requests = requests)
      for (r in requests) if (!is.null(r$addSheet)) e$tabs <- c(e$tabs, r$addSheet$properties$title)
      list()
    },
    .monitoreo_google_api = function(url, method = "GET", body = NULL, ...) {
      if (identical(method, "GET") && grepl("BARRIDO1", url)) {
        return(list(values = list(list("Cod pulso", "Código", "Nombre", "Teléfono 1", "Teléfono 2", "Responsable", "Status"))))
      }
      if (identical(method, "GET")) {
        # La prueba COUNTA("a";"b"): 2 en un documento en español, error en uno en inglés.
        return(list(values = list(list(if (identical(idioma, "es")) 2 else "#ERROR!"))))
      }
      e$escrituras[[length(e$escrituras) + 1L]] <- list(url = url, tipo = "values", body = body)
      list()
    },
    .env = env
  )
  e
}

.msst_base <- function(e) {
  w <- Filter(function(x) identical(x$tipo, "values") && identical(x$body$valueInputOption, "USER_ENTERED") &&
                 identical(x$body$data[[1]]$range, "'Supervisión ronda-1'"), e$escrituras)
  w[[1]]$body$data[[1]]$values
}

test_that("en un documento en español: separador «;», nombre y teléfono por fórmula, sin PII y la llave como texto", {
  sid <- .msst_sesion(); on.exit(session_delete(sid), add = TRUE)
  e <- .msst_doble("es")
  r <- collection_supervision_sheets_sembrar(sid, "supervision.ronda-1", enlace = "https://docs.google.com/spreadsheets/d/SUP1/edit")
  expect_identical(r$pestana, "Supervisión ronda-1")
  expect_identical(vapply(r$hojas, `[[`, "", "accion"), c("sembrada", "sembrada"))
  v <- .msst_base(e)
  expect_identical(unlist(v[[1]]), c("Código", "Enumerador", "Fecha de la llamada", "Nombre", "Teléfono 1", "Status",
                                     "Observaciones del supervisor", "Estatus de la llamada de supervisión", "Veredicto"))
  fila <- unlist(v[[2]])
  expect_identical(fila[1], "'00123")  # el cero no se pierde
  expect_match(fila[4], '^=IFERROR\\(XLOOKUP\\(\\$A2;IMPORTRANGE\\("https://docs.google.com/spreadsheets/d/BARRIDO1/edit";"Barrido!B:B"\\);IMPORTRANGE\\("[^"]+";"Barrido!C:C"\\);""\\);""\\)$')
  expect_match(fila[5], '"Barrido!D:D"', fixed = TRUE)
  expect_identical(fila[7:9], c("", "", ""))
  # Ningún pedido lleva un nombre: sólo llaves, rótulos y fórmulas.
  todo <- paste(unlist(lapply(e$escrituras, function(w) unlist(w$body))), collapse = " ")
  expect_false(grepl("Ana Pérez|Beto Gómez", todo))
  # La pestaña de acceso lleva el IMPORTRANGE desnudo, donde se pulsa «Permitir acceso».
  acceso <- Filter(function(x) identical(x$tipo, "values") && identical(x$body$data[[1]]$range, "'Acceso al barrido'"), e$escrituras)
  expect_match(unlist(acceso[[1]]$body$data[[1]]$values)[2], '^=IMPORTRANGE\\("[^"]+";"Barrido!B1"\\)$')
  # Monitoreo lo lee de aquí.
  d <- collection_supervision_documentos(session_get(sid))
  expect_identical(d[[1]][c("campaign_id", "lote_id", "spreadsheet_id", "pestana")],
                   list(campaign_id = "supervision.ronda-1", lote_id = "ronda-1", spreadsheet_id = "SUP1", pestana = "Supervisión ronda-1"))
})

test_that("en un documento en inglés el separador es «,»", {
  sid <- .msst_sesion(); on.exit(session_delete(sid), add = TRUE)
  e <- .msst_doble("en")
  collection_supervision_sheets_sembrar(sid, "supervision.ronda-1", enlace = "SUP2")
  fila <- unlist(.msst_base(e)[[2]])
  expect_match(fila[4], '^=IFERROR\\(XLOOKUP\\(\\$A2,IMPORTRANGE\\("[^"]+","Barrido!B:B"\\),IMPORTRANGE\\("[^"]+","Barrido!C:C"\\),""\\),""\\)$')
})

test_that("la pestaña del lote ya existe: no recibe ningún pedido; cambiar columnas no olvida el documento", {
  sid <- .msst_sesion(); on.exit(session_delete(sid), add = TRUE)
  e <- .msst_doble("es", existentes = "Supervisión ronda-1")
  r <- collection_supervision_sheets_sembrar(sid, "supervision.ronda-1", enlace = "SUP3")
  expect_identical(r$hojas[[1]]$accion, "respetada")
  expect_length(e$escrituras, 0L)
  collection_supervision_columnas_put(sid, "supervision.ronda-1", barrido = list("Nombre"))
  expect_identical(collection_supervision_documentos(session_get(sid))[[1]]$spreadsheet_id, "SUP3")
})

test_that("nunca en el documento del barrido; sin barrido construido ni enlace, no se arma", {
  sid <- .msst_sesion(); on.exit(session_delete(sid), add = TRUE)
  e <- .msst_doble("es")
  code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(x) x$code)
  expect_identical(code(collection_supervision_sheets_sembrar(sid, "supervision.ronda-1", enlace = "BARRIDO1")), "E_COLLECTION_SUPERVISION_SHEETS_ES_BARRIDO")
  expect_identical(code(collection_supervision_sheets_sembrar(sid, "supervision.ronda-1", enlace = "")), "E_COLLECTION_SUPERVISION_SHEETS_SIN_ENLACE")
  expect_length(e$escrituras, 0L)
  sid2 <- .msst_sesion(con_barrido = FALSE); on.exit(session_delete(sid2), add = TRUE)
  expect_identical(code(collection_supervision_sheets_sembrar(sid2, "supervision.ronda-1", enlace = "SUP4")), "E_COLLECTION_SUPERVISION_SHEETS_SIN_BARRIDO")
  expect_length(collection_supervision_documentos(session_get(sid2)), 0L)
})
