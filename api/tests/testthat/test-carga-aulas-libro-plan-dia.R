# La hoja «Plan del día» del libro de aulas — unidad B2.1.
#
# En 2025 el equipo tecleaba SEIS hojas «aplicación del día N» a mano: el
# recorte de la fila agenda+campo por fecha, copiado celda a celda cada mañana.
# En 2026 la genera la app como UNA hoja del libro, ordenada por fecha y hora:
# el plan del día es de quien va al aula.
#
# Contrato congelado (2026-08-31):
#   A) `aulas_libro_hoja_plan_dia(unidades, partes = list())` en
#      R/carga_aulas_libro_plan_dia.R (NUEVO) — data.frame de celdas SIN
#      nombres de columna, cabecera como PRIMERA fila (mismo patrón que las
#      otras hojas del libro). Población: SOLO filas con `scheduled_date` no
#      vacío, excluyendo estados retirados del eje `operational_status`
#      (reemplazada/cancelada/sin_acceso/reemplazo_pendiente — el vocabulario
#      de baldes de monitoreo_aulas_dos_tasas.R). Titulares y reservas
#      activadas con fecha entran por igual. Orden: fecha ISO ascendente y
#      dentro del día por hora. APLICADOR sale del parte del intento 1 vía
#      `.MONITOREO_AULAS_PARTE_ALIAS[["aplicador"]]`; ESTADO legible (no el
#      interno crudo «en_campo»); ENLACE = row$link.
#   B) `aulas_libro_generar()` la escribe como 4.ª hoja de datos — después de
#      «Base de control», ANTES de «Avance de campo»; indicadores sigue
#      penúltima y «Listas» última. Es hoja DE IDA: sin lector;
#      `aulas_libro_importar()` la ignora sin error.
#   C) Es hoja de la APP: `monitoreo_aulas_publicar_libro()` la publica
#      SIEMPRE (acción ∈ sembrada/actualizada/sin_cambios, JAMÁS `respetada`)
#      y su nombre entra a `monitoreo_sheets_pestanas_controladas()`.

# --- fixture -----------------------------------------------------------------

# Un plan con los cuatro casos de población y un orden que cruza el mes:
#   CH 1  titular, 2026-10-01 09:00, en_campo, con enlace  -> DENTRO (última)
#   CH 2  titular, 2026-09-08 14:00                        -> DENTRO
#   CH 3  titular, 2026-09-08 09:00, sin operational_status -> DENTRO (primera:
#         la AUSENCIA de estado no es un retiro)
#   CH 4  titular, SIN fecha                                -> FUERA
#   CH 5  titular, 2026-09-10, reemplazada                  -> FUERA (retirada)
#   R 5.1 reserva activada CON fecha, 2026-09-12 10:00      -> DENTRO
.pd_plan <- function() list(
  list(operational_code = "CH 1", titular_operational_code = "CH 1",
       sample_role = "titular", faculty = "Ciencias",
       course_name = "Curso 1", teacher = "Docente 1",
       teacher_phone = "999111222", label = "Aula 101", eligible_n = 30,
       scheduled_date = "2026-10-01", scheduled_day = "Jueves",
       scheduled_time = "09:00", operational_status = "en_campo",
       link = "https://ee.kobotoolbox.org/x/abc?d[collectorID]=CH%201"),
  list(operational_code = "CH 2", titular_operational_code = "CH 2",
       sample_role = "titular", faculty = "Letras",
       course_name = "Curso 2", teacher = "Docente 2", eligible_n = 25,
       scheduled_date = "2026-09-08", scheduled_time = "14:00",
       operational_status = "agendada"),
  list(operational_code = "CH 3", titular_operational_code = "CH 3",
       sample_role = "titular", faculty = "Letras",
       course_name = "Curso 3", teacher = "Docente 3", eligible_n = 28,
       scheduled_date = "2026-09-08", scheduled_time = "09:00"),
  list(operational_code = "CH 4", titular_operational_code = "CH 4",
       sample_role = "titular", faculty = "Derecho",
       course_name = "Curso 4", teacher = "Docente 4", eligible_n = 22),
  list(operational_code = "CH 5", titular_operational_code = "CH 5",
       sample_role = "titular", faculty = "Derecho",
       course_name = "Curso 5", teacher = "Docente 5", eligible_n = 20,
       scheduled_date = "2026-09-10", scheduled_time = "11:00",
       operational_status = "reemplazada"),
  list(operational_code = "R 5.1", titular_operational_code = "CH 5",
       sample_role = "chain_reserve", replacement_order = 1,
       faculty = "Derecho", course_name = "Curso 5 (reserva)",
       teacher = "Docente R 5.1", eligible_n = 18,
       scheduled_date = "2026-09-12", scheduled_time = "10:00",
       operational_status = "agendada")
)

.pd_cabecera <- c(
  "FECHA AGENDADA", "DÍA", "HORA", "CURSO-HORARIO", "NOMBRE DEL CURSO",
  "FACULTAD", "SESIONES Y AULA", "NOMBRE DE DOCENTE", "TELÉFONO DE DOCENTE",
  "ELEGIBLES", "APLICADOR", "ESTADO", "ENLACE DE LA FICHA"
)

# La columna de un título, leyendo la PRIMERA fila como cabecera (la hoja no
# lleva nombres de columna, igual que sus hermanas del libro).
.pd_col <- function(hoja, titulo) {
  i <- which(as.character(unlist(hoja[1, ], use.names = FALSE)) == titulo)
  if (!length(i)) stop(sprintf("la cabecera no trae «%s»", titulo))
  i[[1]]
}

# Las celdas de datos de una columna, por su título de cabecera.
.pd_celdas <- function(hoja, titulo) {
  as.character(hoja[[.pd_col(hoja, titulo)]])[-1]
}

# --- A. la hoja --------------------------------------------------------------

test_that("la cabecera es exacta y en ese orden, como primera fila", {
  hoja <- aulas_libro_hoja_plan_dia(.pd_plan())
  expect_true(is.data.frame(hoja))
  expect_identical(
    as.character(unlist(hoja[1, ], use.names = FALSE)),
    .pd_cabecera
  )
})

test_that("población: sin fecha fuera, retirada fuera, reserva activada dentro", {
  hoja <- aulas_libro_hoja_plan_dia(.pd_plan())
  codigos <- .pd_celdas(hoja, "CURSO-HORARIO")
  # B2.1b: las filas-aula son las de código NO vacío. Las filas de totales y de
  # sección (sección D) declaran vacío en esta columna justamente para no
  # confundirse con aulas; hoy el recorte es un no-op.
  codigos <- codigos[nzchar(codigos)]
  # La reserva activada con fecha entra IGUAL que un titular: el plan del día
  # es de quien va al aula, no del rol de muestreo.
  expect_true(all(c("CH 1", "CH 2", "CH 3", "R 5.1") %in% codigos))
  # Sin fecha no hay fila (tampoco «al final»):
  expect_false("CH 4" %in% codigos)
  # Retirada (`operational_status = "reemplazada"`) no va aunque tenga fecha:
  expect_false("CH 5" %in% codigos)
  # Y nada más se cuela: exactamente las cuatro.
  expect_length(codigos, 4L)
})

test_that("orden: fecha ISO ascendente cruzando el mes, y dentro del día por hora", {
  hoja <- aulas_libro_hoja_plan_dia(.pd_plan())
  # 2026-09-08 va antes que 2026-10-01 (lexicográfico ISO, no «8 > 1»), y
  # dentro del 09-08 las 09:00 antes que las 14:00. El orden se afirma sobre
  # las filas-aula (código no vacío): los totales y la sección de B2.1b llevan
  # rótulo en la columna de fecha y romperían un sort() ciego.
  codigos <- .pd_celdas(hoja, "CURSO-HORARIO")
  expect_identical(
    codigos[nzchar(codigos)],
    c("CH 3", "CH 2", "R 5.1", "CH 1")
  )
  fechas <- .pd_celdas(hoja, "FECHA AGENDADA")[nzchar(codigos)]
  expect_identical(fechas, sort(fechas))
})

test_that("APLICADOR sale del parte por alias castellano; sin parte, vacío", {
  # El parte llega en el vocabulario del EQUIPO (`aplicador`), no en el del
  # lector (`applied_by`): la constante de alias existe porque cuatro capas ya
  # se descubrieron ciegas a esto, de una en una.
  partes <- list(list(operational_code = "CH 2", intento = 1L,
                      aplicador = "Equipo A"))
  hoja <- aulas_libro_hoja_plan_dia(.pd_plan(), partes = partes)
  apl <- stats::setNames(.pd_celdas(hoja, "APLICADOR"),
                         .pd_celdas(hoja, "CURSO-HORARIO"))
  expect_identical(unname(apl[["CH 2"]]), "Equipo A")
  expect_identical(unname(apl[["CH 3"]]), "")
})

test_that("el ESTADO se escribe legible, no el interno crudo «en_campo»", {
  hoja <- aulas_libro_hoja_plan_dia(.pd_plan())
  estados <- stats::setNames(.pd_celdas(hoja, "ESTADO"),
                             .pd_celdas(hoja, "CURSO-HORARIO"))
  celda <- unname(estados[["CH 1"]]) # operational_status = "en_campo"
  # Con tolerancia deliberada: la forma legible exacta la decide backend-r; lo
  # pineado es que NO viaja el guion bajo interno y que la celda no sale vacía
  # (un "" pasaría el grepl en falso — verde por ausencia).
  expect_true(nzchar(celda))
  expect_false(grepl("_", celda, fixed = TRUE))
})

test_that("el ENLACE de la ficha es el link de la fila", {
  hoja <- aulas_libro_hoja_plan_dia(.pd_plan())
  enlaces <- stats::setNames(.pd_celdas(hoja, "ENLACE DE LA FICHA"),
                             .pd_celdas(hoja, "CURSO-HORARIO"))
  expect_identical(
    unname(enlaces[["CH 1"]]),
    "https://ee.kobotoolbox.org/x/abc?d[collectorID]=CH%201"
  )
})

# --- B. su sitio en el libro -------------------------------------------------

test_that("el libro trae SEIS hojas con «Plan del día» en la posición 4", {
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.pd_plan(), libro)
  hojas <- readxl::excel_sheets(libro)
  expect_length(hojas, 6L)
  # Después de «Base de control», ANTES de «Avance de campo»: quien abre el
  # libro para agendar sigue aterrizando en su hoja, y los indicadores siguen
  # penúltimos (lo pinea test-carga-aulas-libro-indicadores.R).
  expect_identical(hojas[[4]], "Plan del día")
  # A13a (2026-08-31): era «Cómo va el campo»; Gonzalo: «es AVANCE».
  expect_identical(hojas[[5]], "Avance de campo")
  expect_identical(hojas[[6]], "Listas")
})

test_that("es hoja DE IDA: reimportar el libro no falla ni pierde nada", {
  # `aulas_libro_importar()` lee por nombre y declara ausencias; una hoja que
  # no conoce se ignora. El roundtrip con «Plan del día» dentro devuelve los
  # MISMOS conteos que sin ella.
  partes <- list(list(operational_code = "CH 1", intento = 1L,
                      observed_students = 22, effective_surveys = 20,
                      applied_by = "Equipo A", application_status = "APLICADA"))
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.pd_plan(), libro, partes = partes)
  v <- aulas_libro_importar(libro)
  # Las seis unidades del plan (la hoja nueva filtra; el plan no).
  expect_length(v$plan, 6L)
  expect_length(v$partes, 1L)
  expect_equal(as.numeric(v$partes[[1]]$observed_students), 22)
  expect_length(v$hojas_ausentes, 0L)
})

# --- C. publicación a Sheets -------------------------------------------------
#
# El mock calca `.mapl_sheets_mock()` (test-monitoreo-aulas-publicar-libro.R):
# contesta metadata, lecturas de values y APLICA los values:batchUpdate al
# estado. Sin red: todo pasa por `.monitoreo_google_api` mockeado. Es una
# copia de fixture —los helpers de un test file no se ven desde otro—;
# candidata a promoverse a helper-sheets-mock.R cuando alguien la necesite por
# tercera vez.

.pd_sin_comillas <- function(rango) {
  rango <- sub("!.*$", "", as.character(rango %||% "")[1])
  gsub("''", "'", sub("^'(.*)'$", "\\1", rango))
}

.pd_sheets_mock <- function() {
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
        titulo <- .pd_sin_comillas(entry$range)
        if (nzchar(titulo) && !is.null(env$sheets[[titulo]])) {
          env$sheets[[titulo]]$values <- entry$values
        }
      }
      return(list(totalUpdatedSheets = length(body$data %||% list())))
    }
    if (grepl("/values:batchGet", url)) {
      crudos <- regmatches(url, gregexpr("ranges=[^&]+", url))[[1]]
      vr <- lapply(crudos, function(r) {
        titulo <- .pd_sin_comillas(utils::URLdecode(sub("^ranges=", "", r)))
        list(range = titulo, values = env$sheets[[titulo]]$values %||% list())
      })
      return(list(valueRanges = vr))
    }
    if (grepl("/values/", url)) {
      pedazo <- sub("[?].*$", "", sub(".*/values/", "", url))
      titulo <- .pd_sin_comillas(utils::URLdecode(pedazo))
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

# Títulos de pestaña que recibieron values en algún values:batchUpdate.
.pd_values_titulos <- function(calls) {
  out <- character(0)
  for (call in calls) {
    if (!grepl("/values:batchUpdate$", call$url)) next
    for (entry in call$body$data %||% list()) {
      out <- c(out, .pd_sin_comillas(entry$range))
    }
  }
  out
}

.pd_accion <- function(res, hoja) {
  hojas <- Filter(
    function(h) is.list(h) && identical(as.character(h$hoja %||% ""), hoja),
    res$hojas %||% list()
  )
  if (!length(hojas)) return("")
  as.character(hojas[[1]]$accion %||% "")
}

test_that("publicar el libro lleva «Plan del día» como hoja de la app", {
  skip_if_not_installed("digest")
  mock <- .pd_sheets_mock()
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)

  res <- monitoreo_aulas_publicar_libro(
    spreadsheet_id = "sheet_libro",
    plan = .pd_plan()
  )

  # La hoja está en el resumen con una acción de hoja de la APP…
  accion <- .pd_accion(res, "Plan del día")
  expect_true(accion %in% c("sembrada", "actualizada", "sin_cambios"),
              info = sprintf("accion = «%s»", accion))
  # …y sus values viajaron de verdad al documento vacío.
  expect_true("Plan del día" %in% .pd_values_titulos(mock$env$calls))
})

test_that("«Plan del día» JAMÁS es respetada: contenido remoto no la protege", {
  skip_if_not_installed("digest")
  mock <- .pd_sheets_mock()
  # La pestaña remota ya existe y trae contenido (da igual quién lo puso): la
  # regla de dueño de las hojas del equipo NO aplica aquí — esta es de la app,
  # como «Base de control».
  mock$seed("Plan del día", values = list(list("apunte viejo del equipo")))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)

  res <- monitoreo_aulas_publicar_libro(
    spreadsheet_id = "sheet_libro",
    plan = .pd_plan()
  )

  accion <- .pd_accion(res, "Plan del día")
  expect_false(identical(accion, "respetada"))
  expect_true(accion %in% c("sembrada", "actualizada", "sin_cambios"),
              info = sprintf("accion = «%s»", accion))
  # El contenido remoto difiere de lo producido, así que la app lo reescribe.
  expect_true("Plan del día" %in% .pd_values_titulos(mock$env$calls))
})

test_that("la lista controlada contiene «Plan del día»", {
  expect_true("Plan del día" %in% monitoreo_sheets_pestanas_controladas())
  # Y el validador la deja pasar: el motor valida nombres antes de escribir,
  # así que sin esto la publicación reventaría con E_GOOGLE_SHEETS.
  expect_silent(.monitoreo_sheets_validate_controlled_tabs(c("Plan del día")))
})

# --- D. B2.1b: totales por jornada y pendientes de jornadas anteriores -------
#
# Mejora sobre el formato tecleado de 2025 (checklist B2.1b). De la propuesta
# de cuatro, avanzan SOLO (a) totales por jornada y (c) pendientes de jornadas
# anteriores; choques de franja (b) y orden por pabellón (d) quedan fuera.
#
# Contrato congelado (2026-09-01), mapeo columna a columna:
#   (a) Al cierre de CADA grupo de fecha agendada, una fila de totales:
#         FECHA AGENDADA    = «Total de la jornada» (rótulo académico)
#         CURSO-HORARIO     = "" (jamás un código: la fila no es un aula)
#         NOMBRE DEL CURSO  = «Aulas agendadas: N»
#         APLICADOR         = «Con parte rendido: N»
#         ESTADO            = «Pendientes: N»
#       Conteos ENTEROS de la POBLACIÓN del día (las retiradas ya están
#       fuera), con la identidad agendadas = con parte + pendientes. «Con
#       parte rendido» = existe al menos un parte para ese código.
#   (c) Sección final tras el último grupo. El generador NO tiene reloj
#       (cero Sys.Date() a propósito: la hoja es determinista); la frontera
#       es la ÚLTIMA fecha agendada que ya tiene algún parte rendido.
#       Pendiente de jornada anterior = aula de la población con fecha
#       ESTRICTAMENTE anterior a esa frontera y sin parte. Con pendientes:
#       fila-marcador «Pendientes de jornadas anteriores» (columna de fecha;
#       código vacío) y debajo una fila por aula con su fecha ORIGINAL
#       visible, curso, docente y estado legible — pero código VACÍO, para
#       que ningún recorte por código cuente un aula dos veces. Sin
#       pendientes (o sin partes, que es no tener frontera): UNA fila final
#       «Sin pendientes de jornadas anteriores» — C3, jamás la sección
#       ausente en silencio.
#
# Invariantes: los 13 títulos no cambian (lo pinea la sección A); las
# filas-aula son EXACTAMENTE las de hoy (las mejoras agregan filas, no quitan
# ni duplican); los estados siguen pasando por `.capd_estado_legible`;
# vocabulario académico (A13).

# Dos fechas y una retirada, en desorden a propósito (el orden lo pone la
# hoja): 09-08 trae CH 10 (con parte) y CH 11 (sin parte, la pendiente de
# jornada anterior); 09-10 trae CH 12 (con parte, fija la frontera) y CH 13
# (sin parte: pendiente de SU día, no de una jornada anterior). CH 99 está
# reemplazada: fuera de la población y de los totales.
.pd_plan_b21b <- function() list(
  list(operational_code = "CH 12", titular_operational_code = "CH 12",
       sample_role = "titular", faculty = "Ciencias",
       course_name = "Curso 12", teacher = "Docente 12", eligible_n = 30,
       scheduled_date = "2026-09-10", scheduled_time = "10:00",
       operational_status = "en_campo"),
  list(operational_code = "CH 11", titular_operational_code = "CH 11",
       sample_role = "titular", faculty = "Letras",
       course_name = "Curso 11", teacher = "Docente 11", eligible_n = 25,
       scheduled_date = "2026-09-08", scheduled_time = "11:00",
       operational_status = "agendada"),
  list(operational_code = "CH 99", titular_operational_code = "CH 99",
       sample_role = "titular", faculty = "Letras",
       course_name = "Curso 99", teacher = "Docente 99", eligible_n = 20,
       scheduled_date = "2026-09-08", scheduled_time = "08:00",
       operational_status = "reemplazada"),
  list(operational_code = "CH 10", titular_operational_code = "CH 10",
       sample_role = "titular", faculty = "Ciencias",
       course_name = "Curso 10", teacher = "Docente 10", eligible_n = 28,
       scheduled_date = "2026-09-08", scheduled_time = "09:00",
       operational_status = "agendada"),
  list(operational_code = "CH 13", titular_operational_code = "CH 13",
       sample_role = "titular", faculty = "Derecho",
       course_name = "Curso 13", teacher = "Docente 13", eligible_n = 22,
       scheduled_date = "2026-09-10", scheduled_time = "14:00",
       operational_status = "agendada")
)

.pd_partes_b21b <- function() list(
  list(operational_code = "CH 10", intento = 1L, aplicador = "Equipo A"),
  list(operational_code = "CH 12", intento = 1L, aplicador = "Equipo B")
)

# Las filas de datos (sin cabecera) como matriz de caracteres sin nombres.
.pd_matriz <- function(hoja) {
  m <- as.matrix(hoja[-1, , drop = FALSE])
  dimnames(m) <- NULL
  m
}

test_that("B2.1b: el recorte completo — grupo, total, grupo, total, sección", {
  hoja <- aulas_libro_hoja_plan_dia(.pd_plan_b21b(), partes = .pd_partes_b21b())
  m <- .pd_matriz(hoja)
  cols <- vapply(
    c("FECHA AGENDADA", "CURSO-HORARIO", "NOMBRE DEL CURSO",
      "NOMBRE DE DOCENTE", "APLICADOR", "ESTADO"),
    function(t) .pd_col(hoja, t), integer(1)
  )
  esperado <- rbind(
    c("2026-09-08", "CH 10", "Curso 10", "Docente 10", "Equipo A", "AGENDADA"),
    c("2026-09-08", "CH 11", "Curso 11", "Docente 11", "",         "AGENDADA"),
    c("Total de la jornada", "", "Aulas agendadas: 2", "",
      "Con parte rendido: 1", "Pendientes: 1"),
    c("2026-09-10", "CH 12", "Curso 12", "Docente 12", "Equipo B", "EN CAMPO"),
    c("2026-09-10", "CH 13", "Curso 13", "Docente 13", "",         "AGENDADA"),
    c("Total de la jornada", "", "Aulas agendadas: 2", "",
      "Con parte rendido: 1", "Pendientes: 1"),
    c("Pendientes de jornadas anteriores", "", "", "", "", ""),
    # CH 11 con su fecha ORIGINAL visible y SIN código: la sección re-lista,
    # no duplica aulas ante un recorte por código.
    c("2026-09-08", "", "Curso 11", "Docente 11", "", "AGENDADA")
  )
  expect_identical(unname(m[, cols, drop = FALSE]), esperado)
})

test_that("B2.1b(a): cada jornada cierra con totales enteros que cuadran, sin código", {
  hoja <- aulas_libro_hoja_plan_dia(.pd_plan_b21b(), partes = .pd_partes_b21b())
  m <- .pd_matriz(hoja)
  totales <- which(m[, .pd_col(hoja, "FECHA AGENDADA")] == "Total de la jornada")
  # Una por fecha agendada con aulas (la retirada CH 99 no abre jornada extra).
  expect_length(totales, 2L)
  entero <- function(x) as.integer(sub("^.*: ", "", x))
  for (i in totales) {
    # Jamás un código: la fila de totales no se confunde con un aula.
    expect_identical(m[i, .pd_col(hoja, "CURSO-HORARIO")], "")
    agendadas <- m[i, .pd_col(hoja, "NOMBRE DEL CURSO")]
    con_parte <- m[i, .pd_col(hoja, "APLICADOR")]
    pendientes <- m[i, .pd_col(hoja, "ESTADO")]
    # Enteros: nada de decimales sobre aulas (el $ tras [0-9]+ veta «2.0»).
    expect_match(agendadas, "^Aulas agendadas: [0-9]+$")
    expect_match(con_parte, "^Con parte rendido: [0-9]+$")
    expect_match(pendientes, "^Pendientes: [0-9]+$")
    # Y cuadran: lo agendado del día es con parte + pendiente, sin residuo.
    expect_identical(entero(agendadas), entero(con_parte) + entero(pendientes))
  }
})

test_that("B2.1b(c): la frontera es la última fecha con parte, no el reloj del sistema", {
  # Solo el 09-08 tiene parte (CH 10): la frontera queda EN 09-08 y nada es
  # estrictamente anterior — ni CH 11, que es del mismo 09-08 y sin parte.
  # Determinista por construcción: el generador no consulta Sys.Date().
  partes <- list(list(operational_code = "CH 10", intento = 1L,
                      aplicador = "Equipo A"))
  hoja <- aulas_libro_hoja_plan_dia(.pd_plan_b21b(), partes = partes)
  m <- .pd_matriz(hoja)
  col1 <- m[, .pd_col(hoja, "FECHA AGENDADA")]
  # C3, vacío declarado: UNA fila de cierre, jamás la sección ausente ni el
  # marcador de una lista que no existe.
  expect_identical(col1[[length(col1)]], "Sin pendientes de jornadas anteriores")
  expect_false("Pendientes de jornadas anteriores" %in% col1)
  # Los totales del 09-10 declaran sus dos aulas sin parte COMO pendientes del
  # día — pendiente de SU jornada no es pendiente de una jornada anterior.
  totales <- which(col1 == "Total de la jornada")
  expect_length(totales, 2L)
  if (length(totales) == 2L) {
    expect_identical(m[totales[[2]], .pd_col(hoja, "APLICADOR")],
                     "Con parte rendido: 0")
    expect_identical(m[totales[[2]], .pd_col(hoja, "ESTADO")], "Pendientes: 2")
  }
})

test_that("B2.1b(c): sin partes no hay frontera — vacío declarado y totales en cero", {
  hoja <- aulas_libro_hoja_plan_dia(.pd_plan_b21b())
  m <- .pd_matriz(hoja)
  col1 <- m[, .pd_col(hoja, "FECHA AGENDADA")]
  expect_identical(col1[[length(col1)]], "Sin pendientes de jornadas anteriores")
  totales <- which(col1 == "Total de la jornada")
  expect_length(totales, 2L)
  for (i in totales) {
    expect_identical(m[i, .pd_col(hoja, "APLICADOR")], "Con parte rendido: 0")
  }
})

test_that("B2.1b: los rótulos sobreviven al tipado de fechas del libro", {
  # `.calg_tipar_fechas` REESCRIBE la columna 1 con el vector parseado: un
  # rótulo que no parsea como fecha se volvería NA y moriría camino al xlsx
  # en silencio. Se pinea en el libro real, no solo en el data.frame.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.pd_plan_b21b(), libro, partes = .pd_partes_b21b())
  hoja <- suppressMessages(readxl::read_excel(
    libro, sheet = "Plan del día", col_names = FALSE, col_types = "text"
  ))
  col1 <- as.character(hoja[[1]])
  expect_true("Total de la jornada" %in% col1)
  expect_true("Pendientes de jornadas anteriores" %in% col1)
})

test_that("B2.1b invariante: las mejoras agregan filas — las filas-aula son las de hoy", {
  # Con el fixture ORIGINAL de B2.1: mismas cuatro aulas, mismo orden. Y con el
  # de B2.1b: sus cuatro, sin que la sección duplique a CH 11 ante un recorte
  # por código (las filas nuevas declaran vacío en CURSO-HORARIO).
  hoja <- aulas_libro_hoja_plan_dia(.pd_plan())
  codigos <- .pd_celdas(hoja, "CURSO-HORARIO")
  expect_identical(codigos[nzchar(codigos)], c("CH 3", "CH 2", "R 5.1", "CH 1"))

  hoja2 <- aulas_libro_hoja_plan_dia(.pd_plan_b21b(), partes = .pd_partes_b21b())
  codigos2 <- .pd_celdas(hoja2, "CURSO-HORARIO")
  expect_identical(codigos2[nzchar(codigos2)],
                   c("CH 10", "CH 11", "CH 12", "CH 13"))
})

test_that("B2.1b invariante A13: vocabulario académico en toda la hoja", {
  hoja <- aulas_libro_hoja_plan_dia(.pd_plan_b21b(), partes = .pd_partes_b21b())
  celdas <- unlist(lapply(hoja, as.character), use.names = FALSE)
  expect_false(any(grepl("c[oó]mo va\\b|c[oó]mo vamos|va respondiendo",
                         tolower(celdas))))
})
