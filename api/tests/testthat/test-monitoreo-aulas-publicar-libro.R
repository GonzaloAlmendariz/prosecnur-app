# Publicar el libro de aulas al Google Sheets del operativo.
#
# Unidad B1. Decisión textual de Gonzalo (2026-08-31): «El frontend debería
# poder tener un campo para poner el enlace del nuevo sheets y recordarlo, para
# escribir sobre él y leer, SIN SOBREESCRIBIR las dos primeras hojas, que las
# llenan desde el sheets, no desde la app».
#
# Traducción a contrato — dueño POR HOJA, no por documento:
#   - «Aulas Agendadas» y «Aulas Aplicadas (Campo)» son del EQUIPO: la app las
#     siembra solo si la pestaña no existe o está vacía; con CUALQUIER contenido
#     remoto no emite ni una escritura sobre ellas y las declara `respetada`.
#     La regla es de dueño, no de delta: un plan cambiado en la app NO abre la
#     puerta.
#   - «Base de control» es de la APP: se publica siempre, con el delta del motor
#     (sin cambios → sin request de values → `sin_cambios`).
#
# `monitoreo_aulas_publicar_libro()` (R/monitoreo_aulas_publicar_libro.R, NUEVO)
# produce los values con los generadores existentes (aulas_libro_hoja_*) y envía
# por el motor batch+hash (`monitoreo_sheets_publish_tabs`). Devuelve un resumen
# por hoja: `hoja`, `accion` ∈ {sembrada, actualizada, sin_cambios, respetada} y
# `filas`.
#
# El mock calca `.msi_sheets_mock()` (test-monitoreo-sync-incremental.R) y le
# suma lo que esta regla necesita: contestar lecturas de values (para que la
# implementación pueda preguntar si una pestaña tiene contenido) y APLICAR los
# values:batchUpdate al estado, para que una siembra deje huella que la segunda
# publicación y el lector releen. Sin red: todo pasa por `.monitoreo_google_api`
# mockeado.

.mapl_sin_comillas <- function(rango) {
  rango <- sub("!.*$", "", as.character(rango %||% "")[1])
  gsub("''", "'", sub("^'(.*)'$", "\\1", rango))
}

.mapl_sheets_mock <- function() {
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
        titulo <- .mapl_sin_comillas(entry$range)
        if (nzchar(titulo) && !is.null(env$sheets[[titulo]])) {
          env$sheets[[titulo]]$values <- entry$values
        }
      }
      return(list(totalUpdatedSheets = length(body$data %||% list())))
    }
    if (grepl("/values:batchGet", url)) {
      crudos <- regmatches(url, gregexpr("ranges=[^&]+", url))[[1]]
      vr <- lapply(crudos, function(r) {
        titulo <- .mapl_sin_comillas(utils::URLdecode(sub("^ranges=", "", r)))
        list(range = titulo, values = env$sheets[[titulo]]$values %||% list())
      })
      return(list(valueRanges = vr))
    }
    if (grepl("/values/", url)) {
      pedazo <- sub("[?].*$", "", sub(".*/values/", "", url))
      titulo <- .mapl_sin_comillas(utils::URLdecode(pedazo))
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

# --- lecturas del registro de llamadas --------------------------------------

# Títulos de pestaña que recibieron values en algún values:batchUpdate.
.mapl_values_titulos <- function(calls) {
  out <- character(0)
  for (call in calls) {
    if (!grepl("/values:batchUpdate$", call$url)) next
    for (entry in call$body$data %||% list()) {
      out <- c(out, .mapl_sin_comillas(entry$range))
    }
  }
  out
}

# Las llamadas registradas DESPUÉS de un corte (sin contar hacia atrás si no
# hubo ninguna nueva: seq.int(n+1, n) descendería).
.mapl_desde <- function(calls, corte) {
  if (length(calls) <= corte) return(list())
  calls[seq.int(corte + 1L, length(calls))]
}

# Requests de los batchUpdate estructurales (addSheet, reset, formato, estado).
.mapl_batch_requests <- function(calls) {
  out <- list()
  for (call in calls) {
    if (!grepl(":batchUpdate$", call$url)) next
    if (grepl("values:batchUpdate", call$url, fixed = TRUE)) next
    out <- c(out, call$body$requests %||% list())
  }
  out
}

.mapl_addsheet_titulos <- function(calls) {
  reqs <- .mapl_batch_requests(calls)
  titulos <- vapply(reqs, function(r) as.character(r$addSheet$properties$title %||% ""), character(1))
  titulos[nzchar(titulos)]
}

# Todos los sheetId referidos dentro de una estructura de requests, recursivo:
# updateCells, repeatCell, updateSheetProperties, metadata… da igual la forma.
.mapl_sheet_ids_en <- function(x) {
  out <- integer(0)
  if (!is.list(x)) return(out)
  nombres <- names(x) %||% rep("", length(x))
  for (i in seq_along(x)) {
    v <- x[[i]]
    if (identical(nombres[[i]], "sheetId") && length(v) == 1L) {
      id <- suppressWarnings(as.integer(v))
      if (!is.na(id)) out <- c(out, id)
    } else if (is.list(v)) {
      out <- c(out, .mapl_sheet_ids_en(v))
    }
  }
  out
}

# --- lectura del resumen por hoja -------------------------------------------

.mapl_resumen <- function(res) {
  candidatos <- res$hojas %||% res
  hojas <- Filter(function(h) is.list(h) && nzchar(as.character(h$hoja %||% "")), candidatos)
  stats::setNames(hojas, vapply(hojas, function(h) as.character(h$hoja), character(1)))
}

.mapl_accion <- function(res, hoja) {
  resumen <- .mapl_resumen(res)
  if (!hoja %in% names(resumen)) return("")
  as.character(resumen[[hoja]]$accion %||% "")
}

.mapl_filas <- function(res, hoja) {
  resumen <- .mapl_resumen(res)
  if (!hoja %in% names(resumen)) return(NA_real_)
  suppressWarnings(as.numeric(resumen[[hoja]]$filas %||% NA_real_))[1]
}

.mapl_hojas_datos <- c("Aulas Agendadas", "Aulas Aplicadas (Campo)", "Base de control")
.mapl_hojas_equipo <- c("Aulas Agendadas", "Aulas Aplicadas (Campo)")

# Un parte de campo del equipo, con el vocabulario que produce el LECTOR
# (`carga_aulas_aplicadas.R`), que es de donde viene en un estudio real.
.mapl_partes <- function() list(
  list(operational_code = "CH 1", intento = 1L, observed_students = 30,
       refusals = 2, duplicates = 0, effective_surveys = 28,
       applied_by = "Ana", actual_room = "L321", applied_date = "2026-08-12")
)

# --- contexto (verde deliberado): el adaptador df→values sigue en pie -------

test_that("contexto: los generadores del libro entregan la cabecera como primera fila", {
  # Assert de CONTEXTO, verde también en fase roja: pinea la entrada que
  # `monitoreo_aulas_publicar_libro()` va a adaptar (data.frame sin nombres con
  # la cabecera como primera fila). Si un generador cambia de forma, el rojo de
  # los tests de abajo dejaría de significar «falta la función».
  hoja <- aulas_libro_hoja_agendadas(.libro_de_prueba())
  expect_true(is.data.frame(hoja))
  expect_identical(as.character(hoja[1, 1]), "ID MATCH")
  hoja_campo <- aulas_libro_hoja_aplicadas(.libro_de_prueba(), partes = .mapl_partes())
  expect_true(is.data.frame(hoja_campo))
  expect_gte(nrow(hoja_campo), 3L) # dos cabeceras + al menos el titular
  hoja_control <- aulas_libro_hoja_control(.libro_de_prueba())
  expect_true(is.data.frame(hoja_control))
  expect_gte(nrow(hoja_control), 3L)
})

# --- 1. siembra completa -----------------------------------------------------

test_that("libro a Sheets: un documento vacío recibe las tres hojas sembradas", {
  skip_if_not_installed("digest")
  mock <- .mapl_sheets_mock()
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)

  res <- monitoreo_aulas_publicar_libro(
    spreadsheet_id = "sheet_libro",
    plan = .libro_de_prueba(),
    partes = .mapl_partes()
  )

  for (hoja in .mapl_hojas_datos) {
    expect_identical(.mapl_accion(res, hoja), "sembrada", info = hoja)
    expect_gt(.mapl_filas(res, hoja), 0)
  }
  # El mock registró la creación de las tres pestañas…
  creadas <- .mapl_addsheet_titulos(mock$env$calls)
  expect_true(all(.mapl_hojas_datos %in% creadas))
  # …y UN solo values:batchUpdate que las incluye (la siembra va en batch,
  # como el resto de la publicación incremental).
  values_calls <- Filter(function(c) grepl("/values:batchUpdate$", c$url), mock$env$calls)
  expect_identical(length(values_calls), 1L)
  expect_true(all(.mapl_hojas_datos %in% .mapl_values_titulos(mock$env$calls)))
})

# --- 2. dueño por hoja: contenido del equipo = intocable ---------------------

test_that("libro a Sheets: las hojas del equipo con contenido quedan respetadas", {
  skip_if_not_installed("digest")
  mock <- .mapl_sheets_mock()
  # El equipo ya trabajó sus dos hojas EN el Sheets (no vinieron de la app).
  mock$seed("Aulas Agendadas", values = list(
    list("ID MATCH", "OLA"),
    list("CH 1", "agendada a mano por el equipo")
  ))
  mock$seed("Aulas Aplicadas (Campo)", values = list(
    list("IDENTIDAD DEL AULA"),
    list("CODIGO DE CURSO"),
    list("CH 1")
  ))
  # La base de control existe con un corte viejo de la app: SÍ se actualiza.
  mock$seed("Base de control", values = list(list("corte viejo")))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  id_agendadas <- mock$env$sheets[["Aulas Agendadas"]]$sheetId
  id_aplicadas <- mock$env$sheets[["Aulas Aplicadas (Campo)"]]$sheetId

  res <- monitoreo_aulas_publicar_libro(
    spreadsheet_id = "sheet_libro",
    plan = .libro_de_prueba(),
    partes = .mapl_partes()
  )

  expect_identical(.mapl_accion(res, "Aulas Agendadas"), "respetada")
  expect_identical(.mapl_accion(res, "Aulas Aplicadas (Campo)"), "respetada")
  expect_identical(.mapl_accion(res, "Base de control"), "actualizada")

  # Ni un values sobre las hojas del equipo; la base de control sí viaja.
  tocadas <- .mapl_values_titulos(mock$env$calls)
  expect_false(any(.mapl_hojas_equipo %in% tocadas))
  expect_true("Base de control" %in% tocadas)

  # Ni un request estructural (updateCells/reset/formato/metadata) apuntando a
  # los sheetId del equipo: `respetada` es NO tocarlas, no tocarlas poco.
  estructurales <- Filter(function(r) is.null(r$addSheet), .mapl_batch_requests(mock$env$calls))
  ids_tocados <- .mapl_sheet_ids_en(estructurales)
  expect_false(any(ids_tocados %in% c(id_agendadas, id_aplicadas)))

  # Y el contenido del equipo sigue intacto en el remoto.
  expect_identical(
    as.character(mock$env$sheets[["Aulas Agendadas"]]$values[[2]][[2]]),
    "agendada a mano por el equipo"
  )
})

# --- 3. delta de la base de control ------------------------------------------

test_that("libro a Sheets: republicar sin cambios de control no reescribe nada", {
  skip_if_not_installed("digest")
  mock <- .mapl_sheets_mock()
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  plan <- .libro_de_prueba()

  monitoreo_aulas_publicar_libro(
    spreadsheet_id = "sheet_libro", plan = plan, partes = .mapl_partes()
  )
  primeras <- length(mock$env$calls)

  res2 <- monitoreo_aulas_publicar_libro(
    spreadsheet_id = "sheet_libro", plan = plan, partes = .mapl_partes()
  )

  # Las sembradas ya tienen contenido (el de la siembra): pasan a ser del
  # equipo y quedan respetadas. La base de control no cambió: sin_cambios.
  expect_identical(.mapl_accion(res2, "Aulas Agendadas"), "respetada")
  expect_identical(.mapl_accion(res2, "Aulas Aplicadas (Campo)"), "respetada")
  expect_identical(.mapl_accion(res2, "Base de control"), "sin_cambios")

  segundas <- .mapl_desde(mock$env$calls, primeras)
  expect_lte(length(segundas), 3L)
  urls <- vapply(segundas, function(c) c$url, character(1))
  expect_false(any(grepl("values:batchUpdate", urls, fixed = TRUE)))
})

# --- 4. la regla es de dueño, no de delta ------------------------------------

test_that("libro a Sheets: un plan cambiado NO reescribe las hojas del equipo", {
  skip_if_not_installed("digest")
  mock <- .mapl_sheets_mock()
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)

  monitoreo_aulas_publicar_libro(
    spreadsheet_id = "sheet_libro", plan = .libro_de_prueba(2L), partes = .mapl_partes()
  )
  agendadas_sembradas <- mock$env$sheets[["Aulas Agendadas"]]$values
  primeras <- length(mock$env$calls)

  # La app cambió el plan: cadena más profunda → values distintos para las
  # tres hojas. El hash distinto NO abre la puerta de las hojas del equipo.
  res <- monitoreo_aulas_publicar_libro(
    spreadsheet_id = "sheet_libro", plan = .libro_de_prueba(4L), partes = .mapl_partes()
  )

  expect_identical(.mapl_accion(res, "Aulas Agendadas"), "respetada")
  expect_identical(.mapl_accion(res, "Aulas Aplicadas (Campo)"), "respetada")
  expect_identical(.mapl_accion(res, "Base de control"), "actualizada")

  nuevas <- .mapl_desde(mock$env$calls, primeras)
  tocadas <- .mapl_values_titulos(nuevas)
  expect_false(any(.mapl_hojas_equipo %in% tocadas))
  expect_true("Base de control" %in% tocadas)
  # El remoto conserva byte a byte lo sembrado con el plan viejo.
  expect_identical(mock$env$sheets[["Aulas Agendadas"]]$values, agendadas_sembradas)
})

# --- 5. los nombres son los que el lector relee sin configurar ---------------

test_that("libro a Sheets: lo publicado se relee con aulas_libro_leer_de_sheets sin configurar", {
  skip_if_not_installed("digest")
  mock <- .mapl_sheets_mock()
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)

  monitoreo_aulas_publicar_libro(
    spreadsheet_id = "sheet_libro", plan = .libro_de_prueba(), partes = .mapl_partes()
  )

  # Los nombres de pestaña son EXACTAMENTE los de la spec del libro…
  hojas_spec <- vapply(AULAS_LIBRO_HOJAS, function(x) x$hoja, character(1))
  expect_true(all(hojas_spec %in% names(mock$env$sheets)))

  # …así que el lector con sus valores por defecto las encuentra las tres.
  hojas <- aulas_libro_leer_de_sheets("sheet_libro")
  expect_setequal(names(hojas), c("agendadas", "aplicadas", "control"))

  # Y la vuelta entera funciona: el plan releído trae al titular sembrado.
  releido <- aulas_libro_desde_valores(hojas$agendadas, "agendadas")
  codigos <- vapply(releido, function(p) as.character(p$operational_code %||% ""), character(1))
  expect_true("CH 1" %in% codigos)
})

# --- C. destino recordado -----------------------------------------------------

test_that("el destino del operativo se guarda en la config y se relee", {
  # Contrato mínimo (guardar → leer); la forma final del setter la fija
  # backend-r. Lo pineado: la ruta de lectura es
  # cfg$aulas_universitarias$libro_sheets$spreadsheet_id, el campo del frontend
  # trae el ENLACE (decisión 2026-08-31) y el helper devuelve el id pelado. El
  # id NO es secreto (el token sí, ADR 0005): puede viajar en cfg/.pulso.
  expect_true(exists("monitoreo_aulas_libro_destino", mode = "function"))

  cfg <- list(aulas_universitarias = list(libro_sheets = list(spreadsheet_id = "1AbC_deF-123")))
  expect_identical(monitoreo_aulas_libro_destino(cfg), "1AbC_deF-123")

  cfg_enlace <- list(aulas_universitarias = list(libro_sheets = list(
    spreadsheet_id = "https://docs.google.com/spreadsheets/d/1AbC_deF-123/edit#gid=0"
  )))
  expect_identical(monitoreo_aulas_libro_destino(cfg_enlace), "1AbC_deF-123")

  # Sin destino guardado: vacío, no error.
  expect_identical(as.character(monitoreo_aulas_libro_destino(list()) %||% "")[1], "")

  # `$` parcial-matchea (config$plan pescó plan_rows): una clave hermana no es
  # el destino.
  cfg_trampa <- list(aulas_universitarias = list(
    libro_sheets_borrador = list(spreadsheet_id = "NO-ES-EL-DESTINO")
  ))
  expect_identical(as.character(monitoreo_aulas_libro_destino(cfg_trampa) %||% "")[1], "")
})

test_that("el publicador vive en su archivo propio", {
  r_dir <- testthat::test_path("..", "..", "R")
  skip_if_not(dir.exists(r_dir), "sin fuentes R/ a mano (paquete instalado)")
  expect_true(file.exists(file.path(r_dir, "monitoreo_aulas_publicar_libro.R")))
})

# --- B68 tercera pata: la hoja «Asignación de aplicadores» -------------------

.mapl_disponibilidad <- function() list(
  list(nombre = "Ana Prueba", dias = stats::setNames(
    rep(list(list(list(inicio = "08:00", fin = "22:00"))), 6L),
    c("lunes", "martes", "miercoles", "jueves", "viernes", "sabado")
  ))
)

test_that("B68: con disponibilidad, la asignación entra como hoja de la APP y las del equipo siguen intactas", {
  skip_if_not_installed("digest")
  mock <- .mapl_sheets_mock()
  # Las dos hojas del equipo YA tienen contenido tecleado: el miedo textual de
  # Gonzalo («tengo miedo de que lo que se está avanzando se sobreescriba o
  # pierda») es exactamente este escenario.
  mock$seed("Aulas Agendadas", list(list("ID MATCH"), list("algo del equipo")))
  mock$seed("Aulas Aplicadas (Campo)", list(list("x"), list("y"), list("tecleado")))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)

  res <- monitoreo_aulas_publicar_libro(
    spreadsheet_id = "sheet_libro",
    plan = .libro_de_prueba(),
    partes = .mapl_partes(),
    disponibilidad = .mapl_disponibilidad(),
    config_reparto = list(duracion_aplicacion_min = 30L)
  )

  # La hoja nueva se siembra como hoja de la app…
  expect_identical(.mapl_accion(res, "Asignación de aplicadores"), "sembrada")
  # …y las del equipo, CON contenido, no reciben ni un request: respetadas.
  expect_identical(.mapl_accion(res, "Aulas Agendadas"), "respetada")
  expect_identical(.mapl_accion(res, "Aulas Aplicadas (Campo)"), "respetada")

  # El contenido publicado es el del motor: protocolo, día y equidad.
  vals <- mock$env$sheets[["Asignación de aplicadores"]]$values
  texto <- paste(unlist(vals), collapse = " | ")
  expect_match(texto, "ASIGNACIÓN DE APLICADORES")
  expect_match(texto, "Materiales se recogen 30 min antes")
  expect_match(texto, "CARGAS POR APLICADOR")
  expect_match(texto, "Ana Prueba")
})

test_that("B68: sin disponibilidad la hoja NO juega — ni se crea ni se toca una remota previa", {
  skip_if_not_installed("digest")
  mock <- .mapl_sheets_mock()
  # Una publicación anterior dejó la hoja; esta sesión no tiene disponibilidad.
  mock$seed("Asignación de aplicadores", list(list("ASIGNACIÓN DE APLICADORES"), list("contenido previo")))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)

  res <- monitoreo_aulas_publicar_libro(
    spreadsheet_id = "sheet_libro",
    plan = .libro_de_prueba(),
    partes = .mapl_partes()
  )

  hojas <- vapply(res$hojas, function(h) as.character(h$hoja), character(1))
  expect_false("Asignación de aplicadores" %in% hojas)
  # El contenido remoto previo sigue byte a byte.
  expect_identical(
    mock$env$sheets[["Asignación de aplicadores"]]$values[[2]][[1]],
    "contenido previo"
  )
})

# ── La disponibilidad del equipo, publicada ──────────────────────────────────
#
# Dictado 2026-09-04: «el Sheets debería tener una forma muy elegante de poder
# mostrar la disponibilidad de cada encuestador en una hoja, para que el equipo
# de campo también pueda saber cuándo o a quién reclutar y no dependa
# enteramente de mí». Hermana de la de asignación: hoja de la APP y condicional
# a que la sesión tenga oferta cargada.

test_that("con disponibilidad, su hoja se publica y las del equipo siguen intactas", {
  skip_if_not_installed("digest")
  mock <- .mapl_sheets_mock()
  mock$seed("Aulas Agendadas", list(list("ID MATCH"), list("algo del equipo")))
  mock$seed("Aulas Aplicadas (Campo)", list(list("x"), list("y"), list("tecleado")))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)

  res <- monitoreo_aulas_publicar_libro(
    spreadsheet_id = "sheet_libro",
    plan = .libro_de_prueba(),
    partes = .mapl_partes(),
    disponibilidad = .mapl_disponibilidad(),
    config_reparto = list(duracion_aplicacion_min = 30L)
  )

  expect_identical(.mapl_accion(res, "Disponibilidad de aplicadores"), "sembrada")
  # La regla de dueño no se mueve por añadir una hoja de la app.
  expect_identical(.mapl_accion(res, "Aulas Agendadas"), "respetada")
  expect_identical(.mapl_accion(res, "Aulas Aplicadas (Campo)"), "respetada")

  vals <- mock$env$sheets[["Disponibilidad de aplicadores"]]$values
  texto <- paste(unlist(vals), collapse = " | ")
  expect_match(texto, "DISPONIBILIDAD DE APLICADORES")
  # Las dos tablas que la hoja existe para cruzar (rehecha el 2026-09-04: tres
  # ejes no caben en una columna).
  expect_match(texto, "CUÁNTOS HAY, HORA POR HORA", fixed = TRUE)
  expect_match(texto, "QUIÉN PUEDE CADA DÍA", fixed = TRUE)
  expect_match(texto, "Ana Prueba")
})

test_that("sin disponibilidad la hoja NO juega — ni se crea ni se toca una remota previa", {
  skip_if_not_installed("digest")
  mock <- .mapl_sheets_mock()
  mock$seed("Disponibilidad de aplicadores",
            list(list("DISPONIBILIDAD DE APLICADORES"), list("contenido previo")))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)

  res <- monitoreo_aulas_publicar_libro(
    spreadsheet_id = "sheet_libro",
    plan = .libro_de_prueba(),
    partes = .mapl_partes()
  )

  hojas <- vapply(res$hojas, function(h) as.character(h$hoja), character(1))
  expect_false("Disponibilidad de aplicadores" %in% hojas)
  expect_identical(
    mock$env$sheets[["Disponibilidad de aplicadores"]]$values[[2]][[1]],
    "contenido previo"
  )
})

test_that("la pestaña está en la whitelist controlada, o la publicación reventaría", {
  # `.monitoreo_sheets_validate_controlled_tabs()` frena escrituras ad hoc sobre
  # pestañas del usuario; una hoja nueva que no se declare aquí no se publica,
  # revienta con E_GOOGLE_SHEETS.
  expect_true("Disponibilidad de aplicadores" %in% monitoreo_sheets_pestanas_controladas())
})
