# Hoja de ruteo y hoja de consolidados por UMP (D1): cabecera llena y códigos del estudio.

.mtp_code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)

.mtp_sesion <- function(env = parent.frame()) {
  local_mocked_bindings(.mcamp_territorial_habilitada = function() TRUE, .env = env)
  sid <- .hre_session()
  hojas_ruta_enviar(sid)
  collection_campaign_create(sid, "territorial", "UMP Lima")
  s <- session_get(sid)
  s$monitoreo_config$territorial$enumerator_roster <- list(code_format = "PXXX", assignments = list(
    list(codigo_pulso = "P844", nombre = "Encuestador Ejemplo Uno", dni = "40000001")))
  .session_env[[sid]] <- s
  sid
}

.mtp_texto <- function(sid, file_id) {
  testthat::skip_if_not(nzchar(Sys.which("pdftotext")), "sin pdftotext")
  path <- session_get(sid)$files[[file_id]]$path
  testthat::expect_true(file.exists(path))
  paste(system2("pdftotext", c("-layout", shQuote(path), "-"), stdout = TRUE), collapse = "\n")
}

T1 <- "150101001001"

test_that("ruteo: una hoja por UMP titular y cara, con el encuestador asignado y los códigos editados", {
  sid <- .mtp_sesion(); on.exit(session_delete(sid), add = TRUE)
  collection_territorial_asignacion_put(sid, asignacion = list(list(id_manzana = T1, codigo = "P844")))
  collection_territorial_formatos_put(sid, rotulos = list(`5` = "No hay persona de 18 a 25 años"), columna_criterio = "Cursa estudios")
  todas <- collection_territorial_papel(sid, pieza = "ruteo")
  titulares <- length(Filter(function(u) identical(u$role, "titular"), .mta_unidades(.mcamp_territorial_envio(session_get(sid), "field"))))
  expect_identical(todas$umps, titulares)
  expect_identical(todas$paginas, 2L * titulares)
  una <- collection_territorial_papel(sid, pieza = "ruteo", unidad = T1)
  expect_true(all(c("modulo", "rotulo", "guardado_en", "aviso_guardado", "size") %in% names(una)))  # ADR 0133, fase 5
  expect_identical(una$umps, 1L)
  expect_match(una$filename, "_Hoja_de_ruteo_.+_\\d{2}_\\d{2}_\\d{2}\\.pdf$")
  txt <- .mtp_texto(sid, una$file_id)
  expect_match(txt, "P844 · Encuestador Ejemplo Uno", fixed = TRUE)
  expect_match(txt, "No hay persona de 18 a 25", fixed = TRUE)
  expect_match(txt, "Cursa", fixed = TRUE)  # el rótulo parte en dos líneas en la cabecera
  expect_false(grepl("40000001", txt, fixed = TRUE))
  # Como la hoja real: supervisión, hoja n.º y ámbito; cara 2 hasta la fila 105.
  expect_match(txt, "SUP. (Sí / No)", fixed = TRUE)
  expect_match(txt, "Periurbano", fixed = TRUE)
  expect_match(txt, "Hoja de ruteo, cara 2 de 2", fixed = TRUE)
  expect_match(txt, "\\b105\\b", perl = TRUE)
})

test_that("ruteo: columnas opcionales de la hoja de seguimiento de ACNUR (Mz., N.º de encuesta) y SUP. apagable", {
  sid <- .mtp_sesion(); on.exit(session_delete(sid), add = TRUE)
  expect_identical(unlist(collection_territorial_formatos_get(sid)$extras_ruteo), "supervision")
  collection_territorial_formatos_put(sid, extras_ruteo = list("manzana", "cuestionario"))
  r <- collection_territorial_papel(sid, pieza = "ruteo", unidad = T1)
  txt <- .mtp_texto(sid, r$file_id)
  expect_match(txt, "Mz.", fixed = TRUE)
  expect_match(txt, "encuesta", fixed = TRUE)
  expect_false(grepl("SUP.", txt, fixed = TRUE))
  expect_identical(.mtp_code(collection_territorial_formatos_put(sid, extras_ruteo = list("otra"))), "E_COLLECTION_TERRITORIAL_FORMATOS_INVALIDOS")
})

test_that("ruteo a una cara y consolidados con el rango de cuestionarios ya numerado", {
  sid <- .mtp_sesion(); on.exit(session_delete(sid), add = TRUE)
  collection_territorial_formatos_put(sid, caras_ruteo = 1L)
  expect_identical(collection_territorial_papel(sid, pieza = "ruteo", unidad = T1)$paginas, 1L)
  r <- collection_territorial_papel(sid, pieza = "consolidados", unidad = T1)
  expect_identical(r$paginas, 1L)
  u <- Filter(function(x) identical(x$unit_id, T1), .mta_unidades(.mcamp_territorial_envio(session_get(sid), "field")))[[1]]
  txt <- .mtp_texto(sid, r$file_id)
  expect_match(txt, "Ocurrencias del recorrido", fixed = TRUE)
  expect_match(txt, "Total de intentos", fixed = TRUE)
  expect_false(grepl("NSE", txt, fixed = TRUE))
  # Columnas opcionales del consolidado (acogida): Mz., NSE y Hora final.
  collection_territorial_formatos_put(sid, extras_consolidado = list("manzana", "nse", "hora_final"))
  r2 <- collection_territorial_papel(sid, pieza = "consolidados", unidad = T1)  # antes: .mtp_texto lee la sesión al entrar
  txt2 <- .mtp_texto(sid, r2$file_id)
  expect_match(txt2, "NSE", fixed = TRUE)
  expect_match(txt2, "Hora final", fixed = TRUE)
  expect_match(txt2, "TOTAL DE MANZANAS RECORRIDAS", fixed = TRUE)  # los rótulos de campo van en mayúsculas
  expect_match(txt, as.character(u$rango_inicio), fixed = TRUE)
  expect_match(txt, as.character(u$rango_fin), fixed = TRUE)
})

test_that("errores: pieza desconocida, UMP ajena y muestra cambiada desde el envío", {
  sid <- .mtp_sesion(); on.exit(session_delete(sid), add = TRUE)
  expect_identical(.mtp_code(collection_territorial_papel(sid, pieza = "otra")), "E_COLLECTION_TERRITORIAL_PAPEL_PIEZA")
  expect_identical(.mtp_code(collection_territorial_papel(sid, unidad = "999")), "E_COLLECTION_TERRITORIAL_PAPEL_UNIDAD")
  s <- session_get(sid); s$hojas_ruta_runs$field$workspace_outputs$sample <- .hre_sample(viviendas = 7L); .session_env[[sid]] <- s
  expect_identical(.mtp_code(collection_territorial_papel(sid)), "E_COLLECTION_TERRITORIAL_DESACTUALIZADA")
})

test_that("HTTP: POST papel devuelve el archivo registrado", {
  sid <- .mtp_sesion(); on.exit(session_delete(sid), add = TRUE)
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  r <- .hre_call(pr, sid, "POST", "/api/recopiladores/campaigns/territorial/papel",
                 body = .hre_json(list(id = "territorial.principal", pieza = "consolidados", unidad = T1)))
  expect_identical(r$status, 200L)
  expect_true(nzchar(r$body$file_id))
})
