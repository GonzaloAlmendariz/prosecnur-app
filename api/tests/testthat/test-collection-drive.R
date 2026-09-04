# B6(b): la ficha QR en PDF conectada al Drive.
#
# El artefacto YA RENDERIZADO (bundle de fichas o PDF, registrado con recibo
# en collection_state) se sube al Drive del operativo con la misma credencial
# Google del libro (ADR 0005: el token vive fuera del .pulso). La carpeta
# destino se recuerda en el estado como el `libro_sheets`; lo que falla se
# declara con su causa (sin credencial, sin permiso de Drive, artefacto
# movido), nunca a medias: un 403 no deja escrito nada.
#
# Todo sin red: los transportes se mockean y lo que se fija es el CONTRATO —
# que se llama, con que, y que queda en el estado.

.cdx_seed_con_artefacto <- function(bytes = charToRaw("fichas-de-prueba")) {
  sid <- session_create()
  session_set(sid, "monitoreo_aulas_plan", list(list(
    selection_run_id = "sel-drive", operational_code = "CH 1", classroom_id = "CH 1",
    label = "CH 1", wave = "M1", faculty = "Ingeniería",
    link = "https://kf.kobotoolbox.org/x/asset1?d%5BcollectorID%5D=CH1"
  )))
  seeded <- collection_state_seed(sid)

  path <- tempfile(fileext = ".zip")
  writeBin(bytes, path)
  sha <- paste0("sha256:", tolower(digest::digest(file = path, algo = "sha256")))
  file_id <- "file-fichas-drive"
  session <- session_get(sid)
  session$files[[file_id]] <- list(
    path = path, original_name = "fichas_qr.zip", sha256 = sha,
    media_type = "application/zip", role = "deliverable",
    receipt_id = "receipt-drive-1"
  )
  session_set(sid, "files", session$files)

  current <- prosecnurapp:::.collection_current(session_get(sid))
  current$artifact_receipts <- list(list(
    schema = "collection_artifact_receipt/v1",
    receipt_id = "receipt-drive-1", artifact_id = "artifact-drive-1",
    file_id = file_id, filename = "fichas_qr.zip",
    media_type = "application/zip", sha256 = sha,
    size_bytes = length(bytes)
  ))
  current$state_revision <- as.integer(current$state_revision) + 1L
  prosecnurapp:::.collection_store(sid, current)
  list(sid = sid, file_id = file_id, path = path, sha = sha,
       revision = prosecnurapp:::.collection_current(session_get(sid))$state_revision)
}

test_that("el cuerpo multipart lleva metadata JSON y los bytes crudos, con su frontera", {
  # Drive exige multipart/related: parte 1 metadata JSON, parte 2 el binario.
  # Se fija el armado byte a byte porque un multipart torcido no falla ruidoso:
  # Google crea un archivo vacio o sin nombre.
  bytes <- as.raw(c(0x50, 0x4b, 0x03, 0x04, 0xff))
  cuerpo <- prosecnurapp:::.cdr_multipart_body(
    metadata = list(name = "fichas_qr.zip", parents = list("carpeta-1")),
    bytes = bytes, media_type = "application/zip", boundary = "FRONTERA"
  )
  texto <- rawToChar(cuerpo[cuerpo != as.raw(0xff)])
  expect_true(is.raw(cuerpo))
  expect_match(texto, "--FRONTERA\r\n", fixed = TRUE)
  expect_match(texto, "Content-Type: application/json", fixed = TRUE)
  expect_match(texto, '"name":"fichas_qr.zip"', fixed = TRUE)
  expect_match(texto, '"parents":\\["carpeta-1"\\]')
  expect_match(texto, "Content-Type: application/zip", fixed = TRUE)
  expect_match(texto, "--FRONTERA--", fixed = TRUE)
  # Los bytes del archivo viajan INTACTOS dentro del cuerpo.
  expect_true(any(vapply(seq_len(length(cuerpo) - length(bytes) + 1L), function(i) {
    identical(cuerpo[i:(i + length(bytes) - 1L)], bytes)
  }, logical(1))))
})

test_that("publicar sube el artefacto, crea la carpeta una vez y sella el estado", {
  fx <- .cdx_seed_con_artefacto()
  llamadas <- new.env(parent = emptyenv())
  llamadas$json <- list(); llamadas$upload <- list()

  testthat::local_mocked_bindings(
    .cdr_token = function() "token-prueba",
    .cdr_drive_json = function(url, method = "GET", body = NULL, token = NULL) {
      llamadas$json <- c(llamadas$json, list(list(url = url, method = method, body = body)))
      if (grepl("files\\?q=", url)) return(list(files = list()))          # buscar carpeta: no hay
      if (identical(method, "POST")) return(list(id = "carpeta-nueva"))    # crearla
      list()
    },
    .cdr_drive_upload = function(metadata, path, media_type, token) {
      llamadas$upload <- c(llamadas$upload, list(list(metadata = metadata, path = path)))
      list(id = "drive-file-1", name = metadata$name,
           webViewLink = "https://drive.google.com/file/d/drive-file-1/view")
    }
  )

  antes <- fx$revision
  out <- collection_drive_publicar(fx$sid, file_id = fx$file_id, expected_revision = antes)

  # La carpeta se busco, se creo con el nombre del estudio, y el upload fue a ella.
  urls <- vapply(llamadas$json, function(x) x$url, character(1))
  expect_true(any(grepl("files\\?q=", urls)))
  creado <- Filter(function(x) identical(x$method, "POST"), llamadas$json)[[1]]
  expect_match(creado$body$name, "Fichas QR", fixed = TRUE)
  expect_length(llamadas$upload, 1L)
  expect_identical(llamadas$upload[[1]]$metadata$parents, list("carpeta-nueva"))
  expect_identical(llamadas$upload[[1]]$metadata$name, "fichas_qr.zip")
  expect_identical(llamadas$upload[[1]]$path, fx$path)

  # El resultado trae el enlace y el estado quedo sellado: carpeta recordada,
  # publicacion anotada junto a su recibo, revision avanzada.
  expect_identical(out$drive_file_id, "drive-file-1")
  expect_match(out$web_view_link, "^https://drive.google.com/")
  estado <- prosecnurapp:::.collection_current(session_get(fx$sid))
  expect_identical(estado$drive_fichas$folder_id, "carpeta-nueva")
  pubs <- estado$drive_publicaciones
  expect_length(pubs, 1L)
  expect_identical(pubs[[1]]$receipt_id, "receipt-drive-1")
  expect_identical(pubs[[1]]$drive_file_id, "drive-file-1")
  expect_gt(estado$state_revision, antes)

  # Segunda publicacion: la carpeta recordada NO se vuelve a buscar ni crear.
  llamadas$json <- list()
  out2 <- collection_drive_publicar(
    fx$sid, file_id = fx$file_id,
    expected_revision = prosecnurapp:::.collection_current(session_get(fx$sid))$state_revision
  )
  expect_length(Filter(function(x) grepl("files\\?q=", x$url), llamadas$json), 0L)
  expect_identical(out2$drive_file_id, "drive-file-1")
})

test_that("sin credencial de Google se declara la causa, no un 500", {
  fx <- .cdx_seed_con_artefacto()
  testthat::local_mocked_bindings(
    .cdr_token = function() stop("No hay credencial de Google Sheets registrada.", call. = FALSE)
  )
  err <- tryCatch(
    collection_drive_publicar(fx$sid, file_id = fx$file_id, expected_revision = fx$revision),
    error = function(e) e
  )
  expect_identical(err$code, "E_DRIVE_SIN_GOOGLE")
  expect_identical(err$status, 409)
})

test_that("un 403 de permisos pide reconectar y no deja NADA escrito", {
  fx <- .cdx_seed_con_artefacto()
  testthat::local_mocked_bindings(
    .cdr_token = function() "token-sin-scope",
    .cdr_drive_json = function(url, method = "GET", body = NULL, token = NULL) list(files = list(list(id = "carpeta-x"))),
    .cdr_drive_upload = function(metadata, path, media_type, token) {
      stop_api(409, "E_DRIVE_SCOPE", "La conexión con Google no tiene permiso de Drive: reconecta Google para autorizarlo.")
    }
  )
  antes <- prosecnurapp:::.collection_current(session_get(fx$sid))
  err <- tryCatch(
    collection_drive_publicar(fx$sid, file_id = fx$file_id, expected_revision = fx$revision),
    error = function(e) e
  )
  expect_identical(err$code, "E_DRIVE_SCOPE")
  despues <- prosecnurapp:::.collection_current(session_get(fx$sid))
  expect_identical(despues$state_revision, antes$state_revision)
  expect_length(despues$drive_publicaciones %||% list(), 0L)
})

test_that("un artefacto cuyo checksum cambio no se sube: se declara el drift", {
  fx <- .cdx_seed_con_artefacto()
  writeBin(charToRaw("otro contenido"), fx$path)  # el archivo ya no es el del recibo
  testthat::local_mocked_bindings(
    .cdr_token = function() "token-prueba",
    .cdr_drive_upload = function(metadata, path, media_type, token) {
      stop("el upload no debe llamarse con un artefacto adulterado")
    }
  )
  err <- tryCatch(
    collection_drive_publicar(fx$sid, file_id = fx$file_id, expected_revision = fx$revision),
    error = function(e) e
  )
  expect_identical(err$code, "E_DRIVE_FICHAS")
})

test_that("los codigos E_DRIVE_* estan en el registro de errores", {
  registro <- errores_registrados()
  codigos <- registro$codigo
  for (code in c("E_DRIVE_SIN_GOOGLE", "E_DRIVE_SCOPE", "E_DRIVE_FICHAS")) {
    expect_true(code %in% codigos, info = code)
  }
})

test_that("el scope de Drive por archivo entra a la conexion Google", {
  # Sin `drive.file` en los scopes, el token nuevo jamas podria subir: el
  # boton naceria muerto. Los tokens viejos siguen sirviendo para Sheets y el
  # 403 de arriba les pide reconectar.
  expect_true(
    "https://www.googleapis.com/auth/drive.file" %in%
      prosecnurapp:::.monitoreo_sheets_oauth_scopes()
  )
})

test_that("el 403 al CREAR la carpeta tambien pide reconectar, no un 500", {
  # Hallazgo del verificador: el escenario PRIMARIO del token viejo es la
  # primera publicacion — la busqueda de carpeta pasa (drive.metadata.readonly
  # la permite) y el POST de creacion es el que choca con el scope. Ese camino
  # llegaba al stop() crudo del transporte y salia como E_INTERNAL 500. Se
  # mockea el transporte REAL (status codes), no el wrapper, porque ahi vivio
  # el defecto.
  fx <- .cdx_seed_con_artefacto()
  testthat::local_mocked_bindings(
    .cdr_token = function() "token-viejo"
  )
  testthat::local_mocked_bindings(
    .monitoreo_google_api_once = function(url, method = "GET", body = NULL, token = NULL) {
      if (identical(method, "POST")) {
        return(list(status_code = 403L, parsed = list(error = list(
          message = "Request had insufficient authentication scopes."
        ))))
      }
      list(status_code = 200L, parsed = list(files = list()))
    },
    .env = asNamespace("prosecnurapp")
  )
  antes <- prosecnurapp:::.collection_current(session_get(fx$sid))
  err <- tryCatch(
    collection_drive_publicar(fx$sid, file_id = fx$file_id, expected_revision = fx$revision),
    error = function(e) e
  )
  expect_identical(err$code, "E_DRIVE_SCOPE")
  despues <- prosecnurapp:::.collection_current(session_get(fx$sid))
  expect_identical(despues$state_revision, antes$state_revision)
  expect_length(despues$drive_publicaciones %||% list(), 0L)
})

test_that("un fallo de Drive al crear la carpeta llega con su causa, no generico", {
  fx <- .cdx_seed_con_artefacto()
  testthat::local_mocked_bindings(
    .cdr_token = function() "token-prueba"
  )
  testthat::local_mocked_bindings(
    .monitoreo_google_api_once = function(url, method = "GET", body = NULL, token = NULL) {
      if (identical(method, "POST")) {
        return(list(status_code = 500L, parsed = list(error = list(message = "backendError"))))
      }
      list(status_code = 200L, parsed = list(files = list()))
    },
    .env = asNamespace("prosecnurapp")
  )
  err <- tryCatch(
    collection_drive_publicar(fx$sid, file_id = fx$file_id, expected_revision = fx$revision),
    error = function(e) e
  )
  expect_identical(err$code, "E_DRIVE_FICHAS")
  expect_match(err$message, "backendError", fixed = TRUE)
})
