# La conversación app↔Sheets del libro de aulas en un solo gesto — unidad B7.
#
# Dictado textual de Gonzalo (2026-08-31): «sigue con el sheets, la idea es que
# se hablen entre sí y cumpla con todos los estandares ya establecidos y pueda
# comunicarse bien con la app». El gesto único: el sync de aulas, con
# `libro_sheets` recordado, LEE del Sheets las hojas del equipo y RE-PUBLICA
# las de la app.
#
# Contrato congelado — `monitoreo_aulas_conversar_libro(sid, cfg)` en
# R/monitoreo_aulas_conversar.R (NUEVO):
#   - Sin destino (`monitoreo_aulas_libro_destino(cfg)` vacío):
#     `list(conversado = FALSE, motivo = "sin_destino")` SIN error y sin tocar
#     la API — el sync sigue como si nada.
#   - Con destino, EN ESTE ORDEN: (1) LEE vía la importación existente
#     (`aulas_libro_importar_sheets_en_sesion`, carga_aulas_libro.R:198 — su
#     fusión ya aplica dueño, alias castellano, cero-es-dato, nada-se-blanquea
#     y partes→plan de A10); (2) PUBLICA las hojas de la app por el núcleo de
#     publicar-libro. El test pina la CONDUCTA de la publicación (qué viaja y
#     qué no), no el nombre interno del núcleo extraído.
#   - Si la LECTURA falla (HTTP/estructura): `conversado = FALSE`,
#     `motivo = "lectura_fallo"` con el `mensaje`, y la publicación NO corre —
#     jamás publicar un control desactualizado como verdad del día.
#   - Si la lectura va y la PUBLICACIÓN falla: `motivo = "publicacion_fallo"` y
#     lo leído SE CONSERVA en sesión (la mitad buena no se revierte).
#   - Éxito: `conversado = TRUE` con las dos mitades — `leido` (el resumen de
#     la importación: fusión actualizadas/nuevas/intactas, hojas ausentes,
#     partes) y `publicado` (el resumen por hoja de publicar-libro).
#
# El mock calca `.mapl_sheets_mock()` (test-monitoreo-aulas-publicar-libro.R).
# CUARTA copia del mismo fixture — `.msi_` (sync incremental), `.mapl_`
# (publicar-libro), `.pd_` (plan del día) y esta —: toca promoverlo a un
# helper-sheets-mock.R compartido. Sin red: todo pasa por
# `.monitoreo_google_api` mockeado.
#
# Lecturas de resultados con `[[` de punta a punta: el `$` de R parcial-matchea
# (la lección de `config$plan` pescando `plan_rows`).

.macl_sin_comillas <- function(rango) {
  rango <- sub("!.*$", "", as.character(rango %||% "")[1])
  gsub("''", "'", sub("^'(.*)'$", "\\1", rango))
}

.macl_sheets_mock <- function() {
  env <- new.env(parent = emptyenv())
  env$sheets <- list()
  env$calls <- list()
  env$next_id <- 100L
  sembrar <- function(titulo, values = list()) {
    env$sheets[[titulo]] <- list(
      sheetId = env$next_id, title = titulo,
      developerMetadata = list(), values = values
    )
    env$next_id <- env$next_id + 1L
  }
  handler <- function(url, method = "GET", body = NULL) {
    env$calls[[length(env$calls) + 1L]] <- list(url = url, method = method, body = body)
    if (grepl("/values:batchUpdate$", url)) {
      for (entry in body$data %||% list()) {
        titulo <- .macl_sin_comillas(entry$range)
        if (nzchar(titulo) && !is.null(env$sheets[[titulo]])) {
          env$sheets[[titulo]]$values <- entry$values
        }
      }
      return(list(totalUpdatedSheets = length(body$data %||% list())))
    }
    if (grepl("/values:batchGet", url)) {
      crudos <- regmatches(url, gregexpr("ranges=[^&]+", url))[[1]]
      vr <- lapply(crudos, function(r) {
        titulo <- .macl_sin_comillas(utils::URLdecode(sub("^ranges=", "", r)))
        list(range = titulo, values = env$sheets[[titulo]]$values %||% list())
      })
      return(list(valueRanges = vr))
    }
    if (grepl("/values/", url)) {
      pedazo <- sub("[?].*$", "", sub(".*/values/", "", url))
      titulo <- .macl_sin_comillas(utils::URLdecode(pedazo))
      return(list(values = env$sheets[[titulo]]$values %||% list()))
    }
    if (grepl("[?]fields=", url)) {
      return(list(
        spreadsheetId = "sheet_libro",
        sheets = unname(lapply(env$sheets, function(s) list(
          properties = list(
            sheetId = s$sheetId,
            title = s$title,
            gridProperties = list(rowCount = 1000L, columnCount = 26L)
          ),
          developerMetadata = s$developerMetadata
        )))
      ))
    }
    if (grepl(":batchUpdate$", url)) {
      apply_metadata <- function(sheet_id, key, value, update = FALSE) {
        for (nm in names(env$sheets)) {
          if (!identical(env$sheets[[nm]]$sheetId, sheet_id)) next
          md <- env$sheets[[nm]]$developerMetadata
          if (isTRUE(update)) {
            for (j in seq_along(md)) {
              if (identical(md[[j]]$metadataKey, key)) md[[j]]$metadataValue <- value
            }
          } else {
            md[[length(md) + 1L]] <- list(metadataKey = key, metadataValue = value)
          }
          env$sheets[[nm]]$developerMetadata <- md
        }
      }
      for (request in body$requests %||% list()) {
        title <- request$addSheet$properties$title %||% ""
        if (nzchar(title)) sembrar(title)
        cdm <- request$createDeveloperMetadata$developerMetadata
        if (!is.null(cdm)) apply_metadata(cdm$location$sheetId, cdm$metadataKey, cdm$metadataValue)
        udm <- request$updateDeveloperMetadata
        if (!is.null(udm)) {
          apply_metadata(
            udm$developerMetadata$location$sheetId,
            udm$developerMetadata$metadataKey,
            udm$developerMetadata$metadataValue,
            update = TRUE
          )
        }
      }
      return(list(replies = list()))
    }
    list()
  }
  list(env = env, handler = handler, seed = sembrar)
}

# --- lecturas del registro de llamadas ---------------------------------------

.macl_urls <- function(calls) {
  vapply(calls, function(c) as.character(c$url %||% ""), character(1))
}

# Títulos de pestaña que recibieron values en algún values:batchUpdate.
.macl_values_titulos <- function(calls) {
  out <- character(0)
  for (call in calls) {
    if (!grepl("/values:batchUpdate$", call$url)) next
    for (entry in call$body$data %||% list()) {
      out <- c(out, .macl_sin_comillas(entry$range))
    }
  }
  out
}

# Las llamadas registradas DESPUÉS de un corte.
.macl_desde <- function(calls, corte) {
  if (length(calls) <= corte) return(list())
  calls[seq.int(corte + 1L, length(calls))]
}

# Requests de los batchUpdate estructurales (addSheet, formato, metadata).
.macl_batch_requests <- function(calls) {
  out <- list()
  for (call in calls) {
    if (!grepl(":batchUpdate$", call$url)) next
    if (grepl("values:batchUpdate", call$url, fixed = TRUE)) next
    out <- c(out, call$body$requests %||% list())
  }
  out
}

# Todos los sheetId referidos dentro de una estructura de requests, recursivo.
.macl_sheet_ids_en <- function(x) {
  out <- integer(0)
  if (!is.list(x)) return(out)
  nombres <- names(x) %||% rep("", length(x))
  for (i in seq_along(x)) {
    v <- x[[i]]
    if (identical(nombres[[i]], "sheetId") && length(v) == 1L) {
      id <- suppressWarnings(as.integer(v))
      if (!is.na(id)) out <- c(out, id)
    } else if (is.list(v)) {
      out <- c(out, .macl_sheet_ids_en(v))
    }
  }
  out
}

# Índice de la primera llamada cuya url casa con el patrón; NA si ninguna.
.macl_primer_indice <- function(calls, patron) {
  idx <- which(grepl(patron, .macl_urls(calls)))
  if (!length(idx)) return(NA_integer_)
  idx[[1]]
}

# --- lectura del resumen de publicación --------------------------------------

# `publicado` puede ser el resultado entero de publicar-libro (con `$hojas`) o
# la lista de hojas a secas; se pina la CONDUCTA, no el envoltorio.
.macl_accion <- function(publicado, hoja) {
  candidatos <- publicado[["hojas"]] %||% publicado %||% list()
  hojas <- Filter(
    function(h) is.list(h) && identical(as.character(h[["hoja"]] %||% ""), hoja),
    candidatos
  )
  if (!length(hojas)) return("")
  as.character(hojas[[1]][["accion"]] %||% "")
}

# --- fixtures -----------------------------------------------------------------

.macl_hojas_equipo <- c("Aulas Agendadas", "Aulas Aplicadas (Campo)")
.macl_hojas_app <- c("Base de control", "Plan del día")

.macl_cfg <- function(id = "sheet_libro") list(
  aulas_universitarias = list(
    enabled = TRUE,
    libro_sheets = list(spreadsheet_id = id)
  )
)

# Un parte del EQUIPO tal como vive en el Sheets: vocabulario CASTELLANO, que
# es como se coló cuatro veces la misma regla (ver test-carga-aulas-libro.R).
.macl_parte_es <- function() list(
  operational_code = "CH 1", asistentes = 30, validas = 28,
  rechazos = 2, duplicados = 0, aplicador = "Ana", fecha = "2026-08-12"
)

# data.frame del generador → filas de values como las devuelve la API.
.macl_values <- function(hoja) {
  lapply(seq_len(nrow(hoja)), function(i) as.list(as.character(hoja[i, ])))
}

# Una sesión con el plan del estudio y la config con (o sin) destino, que es el
# estado desde el que el sync de aulas invoca la conversación.
.macl_sesion <- function(cfg) {
  sid <- session_create()
  session_set(sid, "monitoreo_aulas_plan", .libro_de_prueba())
  session_set(sid, "monitoreo_config", cfg)
  sid
}

# Siembra en el remoto las DOS hojas del equipo como quedaron tras su trabajo:
# la agenda del estudio y el parte castellano en la hoja de campo. «Base de
# control» NO se siembra: la publica la app.
.macl_sembrar_equipo <- function(mock) {
  mock$seed("Aulas Agendadas", values = .macl_values(
    aulas_libro_hoja_agendadas(.libro_de_prueba())
  ))
  mock$seed("Aulas Aplicadas (Campo)", values = .macl_values(
    aulas_libro_hoja_aplicadas(.libro_de_prueba(), partes = list(.macl_parte_es()))
  ))
}

# --- la función existe y vive en su archivo propio ---------------------------

test_that("la conversación vive en monitoreo_aulas_conversar.R", {
  expect_true(exists("monitoreo_aulas_conversar_libro", mode = "function"))
  r_dir <- testthat::test_path("..", "..", "R")
  skip_if_not(dir.exists(r_dir), "sin fuentes R/ a mano (paquete instalado)")
  expect_true(file.exists(file.path(r_dir, "monitoreo_aulas_conversar.R")))
})

# --- 1. sin destino: el sync sigue como si nada ------------------------------

test_that("conversar sin destino declara sin_destino y no toca la API", {
  mock <- .macl_sheets_mock()
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  cfg <- list(aulas_universitarias = list(enabled = TRUE))
  sid <- .macl_sesion(cfg)
  on.exit(session_delete(sid), add = TRUE)

  res <- monitoreo_aulas_conversar_libro(sid, cfg)

  expect_false(isTRUE(res[["conversado"]]))
  expect_identical(as.character(res[["motivo"]] %||% ""), "sin_destino")
  # Cero llamadas: ni lectura ni publicación ni metadata.
  expect_identical(length(mock$env$calls), 0L)
})

# --- 2. la conversación completa: leer, fusionar, publicar -------------------

test_that("conversar lee las hojas del equipo y re-publica las de la app", {
  skip_if_not_installed("digest")
  mock <- .macl_sheets_mock()
  .macl_sembrar_equipo(mock)
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  id_agendadas <- mock$env$sheets[["Aulas Agendadas"]]$sheetId
  id_aplicadas <- mock$env$sheets[["Aulas Aplicadas (Campo)"]]$sheetId
  aplicadas_antes <- mock$env$sheets[["Aulas Aplicadas (Campo)"]]$values
  cfg <- .macl_cfg()
  sid <- .macl_sesion(cfg)
  on.exit(session_delete(sid), add = TRUE)

  res <- monitoreo_aulas_conversar_libro(sid, cfg)

  expect_true(isTRUE(res[["conversado"]]))

  # LECTURA — el parte castellano del equipo entró a la sesión…
  s <- session_get(sid)
  partes <- s$monitoreo_aulas_partes_campo %||% list()
  codigos <- vapply(partes, function(p) as.character(p[["operational_code"]] %||% ""), character(1))
  expect_true("CH 1" %in% codigos)
  parte <- partes[[which(codigos == "CH 1")[[1]]]]
  expect_equal(as.numeric(parte[["observed_students"]]), 30)
  # …y LLEGÓ AL PLAN (A10): es lo que lee la pestaña «Registro de campo».
  plan <- s$monitoreo_aulas_plan %||% list()
  pcod <- vapply(plan, function(r) as.character(r[["operational_code"]] %||% ""), character(1))
  expect_true("CH 1" %in% pcod)
  fila <- plan[[which(pcod == "CH 1")[[1]]]]
  expect_equal(as.numeric(fila[["observed_students"]]), 30)

  # La mitad `leido` trae el resumen de la importación.
  leido <- res[["leido"]]
  expect_true(is.list(leido))
  fusion <- leido[["fusion"]] %||% list()
  expect_true(all(c("actualizadas", "nuevas", "intactas") %in% names(fusion)))
  expect_true("Base de control" %in% unlist(leido[["hojas_ausentes"]]))
  expect_identical(as.integer(leido[["resumen"]][["partes_de_campo"]]), 1L)

  # PUBLICACIÓN — las hojas de la app viajaron; las del equipo, respetadas.
  publicado <- res[["publicado"]]
  expect_identical(.macl_accion(publicado, "Aulas Agendadas"), "respetada")
  expect_identical(.macl_accion(publicado, "Aulas Aplicadas (Campo)"), "respetada")
  expect_identical(.macl_accion(publicado, "Base de control"), "sembrada")
  expect_identical(.macl_accion(publicado, "Plan del día"), "sembrada")

  tocadas <- .macl_values_titulos(mock$env$calls)
  expect_true(all(.macl_hojas_app %in% tocadas))
  expect_false(any(.macl_hojas_equipo %in% tocadas))

  # Regla de dueño por sheetId: sobre las del equipo sólo FORMATO.
  #
  # Decía «ni un request estructural» y quedó vieja el 2026-09-12, cuando
  # Gonzalo decidió que el formato —colores, desplegables— sí viaje a esas dos
  # hojas y los valores nunca (monitoreo_aulas_formato_respetadas.R). El test
  # siguió exigiendo cero y estuvo en rojo desde entonces. Lo que protege la
  # regla de dueño es que no se escriba CONTENIDO: cada request que toca una
  # hoja del equipo tiene que pasar el mismo filtro de formato que el código.
  estructurales <- Filter(function(r) is.null(r$addSheet), .macl_batch_requests(mock$env$calls))
  del_equipo <- Filter(function(r) any(.macl_sheet_ids_en(r) %in% c(id_agendadas, id_aplicadas)),
                       estructurales)
  expect_identical(length(monitoreo_aulas_formato_seguro(del_equipo)), length(del_equipo))
  prohibidos <- vapply(del_equipo, function(r) names(r)[1] %in% .mafr_PROHIBIDOS, logical(1))
  expect_false(any(prohibidos))
  # Y el contenido del equipo sigue byte a byte en el remoto.
  expect_identical(mock$env$sheets[["Aulas Aplicadas (Campo)"]]$values, aplicadas_antes)

  # ORDEN pineado: leer ANTES de publicar. La primera lectura de pestaña
  # (`/values/`) precede a la primera escritura (`batchUpdate`).
  primera_lectura <- .macl_primer_indice(mock$env$calls, "/values/")
  primera_escritura <- .macl_primer_indice(mock$env$calls, "batchUpdate")
  expect_false(is.na(primera_lectura))
  expect_false(is.na(primera_escritura))
  expect_lt(primera_lectura, primera_escritura)
})

# --- 3. la lectura falla: la publicación NO corre ----------------------------

test_that("si la lectura falla no se publica nada: lectura_fallo y cero escrituras", {
  mock <- .macl_sheets_mock()
  .macl_sembrar_equipo(mock)
  # El GET de values de pestaña revienta (HTTP caído / sin permiso); el resto
  # del mock sigue vivo para DELATAR una publicación que no debería correr.
  falla_lectura <- function(url, method = "GET", body = NULL) {
    if (grepl("/values/", url)) {
      stop("HTTP 500 al leer la pestana (simulado)")
    }
    mock$handler(url, method = method, body = body)
  }
  testthat::local_mocked_bindings(.monitoreo_google_api = falla_lectura)
  cfg <- .macl_cfg()
  sid <- .macl_sesion(cfg)
  on.exit(session_delete(sid), add = TRUE)

  res <- monitoreo_aulas_conversar_libro(sid, cfg)

  expect_false(isTRUE(res[["conversado"]]))
  expect_identical(as.character(res[["motivo"]] %||% ""), "lectura_fallo")
  # El aviso dice la causa, no solo el hecho: viaja el mensaje del fallo.
  expect_true(nzchar(as.character(res[["mensaje"]] %||% "")))
  # CERO escrituras al remoto: ningún batchUpdate (ni values ni estructural).
  expect_identical(sum(grepl("batchUpdate", .macl_urls(mock$env$calls))), 0L)
})

# --- 4. la publicación falla: la mitad buena no se revierte ------------------

test_that("si la publicación falla lo leído se conserva en sesión", {
  skip_if_not_installed("digest")
  mock <- .macl_sheets_mock()
  .macl_sembrar_equipo(mock)
  # La lectura va; el remoto revienta SOLO al escribir.
  falla_publicacion <- function(url, method = "GET", body = NULL) {
    if (grepl("batchUpdate", url)) {
      stop("HTTP 500 al escribir en el documento (simulado)")
    }
    mock$handler(url, method = method, body = body)
  }
  testthat::local_mocked_bindings(.monitoreo_google_api = falla_publicacion)
  cfg <- .macl_cfg()
  sid <- .macl_sesion(cfg)
  on.exit(session_delete(sid), add = TRUE)

  res <- monitoreo_aulas_conversar_libro(sid, cfg)

  expect_false(isTRUE(res[["conversado"]]))
  expect_identical(as.character(res[["motivo"]] %||% ""), "publicacion_fallo")
  expect_true(nzchar(as.character(res[["mensaje"]] %||% "")))

  # Lo leído SIGUE en la sesión: el parte de la vuelta y su copia en el plan.
  s <- session_get(sid)
  partes <- s$monitoreo_aulas_partes_campo %||% list()
  codigos <- vapply(partes, function(p) as.character(p[["operational_code"]] %||% ""), character(1))
  expect_true("CH 1" %in% codigos)
  plan <- s$monitoreo_aulas_plan %||% list()
  pcod <- vapply(plan, function(r) as.character(r[["operational_code"]] %||% ""), character(1))
  fila <- plan[[which(pcod == "CH 1")[[1]]]]
  expect_equal(as.numeric(fila[["observed_students"]]), 30)
})

# --- 5. dos ciclos sin cambios: la segunda conversación no reescribe ---------

test_that("el segundo ciclo sin cambios no reescribe nada y cuesta pocos requests", {
  skip_if_not_installed("digest")
  mock <- .macl_sheets_mock()
  .macl_sembrar_equipo(mock)
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  cfg <- .macl_cfg()
  sid <- .macl_sesion(cfg)
  on.exit(session_delete(sid), add = TRUE)

  res1 <- monitoreo_aulas_conversar_libro(sid, cfg)
  expect_true(isTRUE(res1[["conversado"]]))
  expect_identical(.macl_accion(res1[["publicado"]], "Base de control"), "sembrada")
  primeras <- length(mock$env$calls)

  res2 <- monitoreo_aulas_conversar_libro(sid, cfg)

  expect_true(isTRUE(res2[["conversado"]]))
  # Delta del segundo ciclo: nada del equipo se toca, nada de la app cambió.
  publicado <- res2[["publicado"]]
  expect_identical(.macl_accion(publicado, "Aulas Agendadas"), "respetada")
  expect_identical(.macl_accion(publicado, "Aulas Aplicadas (Campo)"), "respetada")
  expect_identical(.macl_accion(publicado, "Base de control"), "sin_cambios")
  expect_identical(.macl_accion(publicado, "Plan del día"), "sin_cambios")

  segundas <- .macl_desde(mock$env$calls, primeras)
  # Ni un values:batchUpdate: la segunda conversación no reescribe.
  expect_false(any(grepl("values:batchUpdate", .macl_urls(segundas), fixed = TRUE)))
  # Y cuesta pocos requests: 5 lecturas de pestaña (las tres del libro + las
  # dos Extra de B14, que el pin de test-carga-aulas-desde-sheets.R OBLIGA a
  # pedir para que lo tecleado ahí no muera camino a la app) + el ciclo sin
  # cambios del publicador (≤ 3, pineado en test-monitoreo-aulas-publicar-
  # libro.R). Presupuesto subido 6→8 a conciencia el 2026-09-01 por eso.
  expect_lte(length(segundas), 8L)
})
