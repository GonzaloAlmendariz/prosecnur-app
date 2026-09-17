# El formato llega a las hojas del equipo; los valores no, nunca.
#
# Decisión de Gonzalo (2026-09-12): a «¿el formato debe viajar aunque la hoja
# sea respetada?» contestó «mi decisión es sí». Lo que su sí NO incluye es
# escribir valores: una hoja del equipo la llenan veintidós personas y pisarla
# les borra el trabajo. Por eso el permiso no se implementa con cuidado sino
# con un filtro, y este archivo es el filtro puesto a prueba.

test_that("un request de formato pasa; uno que escribe valores NO", {
  formato <- list(repeatCell = list(
    range = list(sheetId = 1L),
    cell = list(userEnteredFormat = list(backgroundColor = list(red = 1))),
    fields = "userEnteredFormat(backgroundColor)"))
  expect_true(prosecnurapp:::.mafr_seguro(formato))

  # El MISMO tipo de request, con la máscara abierta a valores: fuera. Es el
  # caso que importa, porque el tipo no distingue — el formateador del libro
  # manda `updateCells` de formato puro todos los días.
  con_valor <- list(updateCells = list(
    range = list(sheetId = 1L),
    rows = list(list(values = list(list(userEnteredValue = list(stringValue = "X"))))),
    fields = "userEnteredValue,userEnteredFormat(backgroundColor)"))
  expect_false(prosecnurapp:::.mafr_seguro(con_valor))

  # Y el updateCells de formato puro que el libro sí produce.
  solo_formato <- list(updateCells = list(
    range = list(sheetId = 1L),
    rows = list(list(values = list(list(userEnteredFormat = list())))),
    fields = "userEnteredFormat(backgroundColor,textFormat)"))
  expect_true(prosecnurapp:::.mafr_seguro(solo_formato))
})

test_that("sin máscara no pasa, aunque parezca inofensivo", {
  # Un request que no declara qué toca podría tocarlo todo. «Probablemente sea
  # inofensivo» no es un criterio sobre la hoja donde el equipo escribe a
  # diario.
  # Un tipo desconocido y sin máscara: fuera.
  expect_false(prosecnurapp:::.mafr_seguro(list(inventado = list(range = list(sheetId = 1L)))))
  expect_false(prosecnurapp:::.mafr_seguro(list()))
  expect_false(prosecnurapp:::.mafr_seguro(NULL))
})

test_that("los tipos que escriben contenido sin máscara están vetados", {
  for (tipo in c("appendCells", "pasteData", "findReplace", "deleteDimension",
                 "deleteSheet", "cutPaste", "sortRange")) {
    req <- stats::setNames(list(list(fields = "userEnteredFormat")), tipo)
    expect_false(prosecnurapp:::.mafr_seguro(req), info = tipo)
  }
})

test_that("los desplegables y las columnas congeladas sí pasan", {
  expect_true(prosecnurapp:::.mafr_seguro(list(setDataValidation = list(
    range = list(sheetId = 1L), rule = list(), fields = "dataValidation"))))
  expect_true(prosecnurapp:::.mafr_seguro(list(updateSheetProperties = list(
    properties = list(sheetId = 1L),
    fields = "gridProperties(frozenRowCount,frozenColumnCount)"))))
  expect_true(prosecnurapp:::.mafr_seguro(list(updateDimensionProperties = list(
    range = list(sheetId = 1L), properties = list(pixelSize = 100L),
    fields = "pixelSize"))))
})

test_that("el filtro cuenta lo que descarta: un silencio no serviría", {
  mezcla <- list(
    list(repeatCell = list(fields = "userEnteredFormat(backgroundColor)")),
    list(updateCells = list(fields = "userEnteredValue")),
    list(setDataValidation = list(fields = "dataValidation"))
  )
  out <- monitoreo_aulas_formato_seguro(mezcla)
  expect_length(out, 2L)
  expect_identical(attr(out, "descartados"), 1L)
})

# --- el reenvío completo ------------------------------------------------------

test_that("reenvía el formato a la hoja del equipo y no manda ni un valor", {
  enviado <- NULL
  testthat::local_mocked_bindings(
    .monitoreo_google_api = function(url, method = "GET", body = NULL, ...) {
      enviado <<- list(url = url, body = body)
      list(replies = list())
    }
  )
  remotas <- list(`Aulas Agendadas` = list(
    as.list(c("ID MATCH", "CURSO-HORARIO", "STATUS MUESTRA")),
    as.list(c("1", "CH 1", "REFUERZO POR CONTACTAR"))))
  out <- monitoreo_aulas_formato_a_hojas_del_equipo(
    "sheet_x", "Aulas Agendadas", remotas = remotas,
    tab_map = list(`Aulas Agendadas` = list(title = "Aulas Agendadas", sheet_id = 9L)))

  expect_identical(out$hojas, "Aulas Agendadas")
  expect_gt(out$requests, 0L)
  expect_identical(out$error, "")
  # Va por `batchUpdate` del documento, JAMÁS por `values:batchUpdate`.
  expect_true(grepl(":batchUpdate", enviado$url, fixed = TRUE))
  expect_false(grepl("values:batchUpdate", enviado$url, fixed = TRUE))
  # Y ni un `userEnteredValue` en todo el cuerpo.
  expect_false(grepl("userEnteredValue", paste(unlist(enviado$body), collapse = " "),
                     fixed = TRUE))
})

test_that("sin hojas respetadas no emite una sola llamada", {
  llamadas <- 0L
  testthat::local_mocked_bindings(
    .monitoreo_google_api = function(url, method = "GET", body = NULL, ...) {
      llamadas <<- llamadas + 1L; list()
    }
  )
  out <- monitoreo_aulas_formato_a_hojas_del_equipo("sheet_x", character(0))
  expect_identical(out$hojas, character(0))
  expect_equal(llamadas, 0L)
  # Una hoja sin `sheetId` conocido tampoco inventa una llamada.
  out2 <- monitoreo_aulas_formato_a_hojas_del_equipo(
    "sheet_x", "Aulas Agendadas", remotas = list(`Aulas Agendadas` = list(list("x"))),
    tab_map = list())
  expect_identical(out2$hojas, character(0))
  expect_equal(llamadas, 0L)
})

test_that("si Google rechaza el formato, la publicación no se cae y se dice", {
  # Lo único que se pierde es el color: la hoja del equipo sigue intacta.
  testthat::local_mocked_bindings(
    .monitoreo_google_api = function(url, method = "GET", body = NULL, ...) stop("cuota")
  )
  out <- monitoreo_aulas_formato_a_hojas_del_equipo(
    "sheet_x", "Aulas Agendadas",
    remotas = list(`Aulas Agendadas` = list(as.list(c("ID MATCH", "CURSO-HORARIO")))),
    tab_map = list(`Aulas Agendadas` = list(title = "Aulas Agendadas", sheet_id = 9L)))
  expect_identical(out$hojas, character(0))
  expect_match(out$error, "cuota", fixed = TRUE)
})

test_that("el filtro está EN el reenvío, no sólo disponible al lado", {
  # Hoy el formateador del libro sólo produce requests de formato, así que
  # quitar el filtro no rompería nada — y por eso hace falta este test: el
  # guard existe para el día en que alguien añada al formateador un request
  # que escriba, no para hoy. Se le hace producir uno peligroso a propósito.
  enviado <- NULL
  testthat::local_mocked_bindings(
    .malp_formato_requests = function(sheet_id, tab_name, rows, con_daa = FALSE) {
      list(
        list(repeatCell = list(range = list(sheetId = sheet_id),
                               fields = "userEnteredFormat(backgroundColor)")),
        # El accidente: alguien añade una celda con su valor «de paso».
        list(updateCells = list(
          range = list(sheetId = sheet_id),
          rows = list(list(values = list(list(userEnteredValue = list(stringValue = "X"))))),
          fields = "userEnteredValue"))
      )
    },
    .monitoreo_google_api = function(url, method = "GET", body = NULL, ...) {
      enviado <<- body; list(replies = list())
    }
  )
  out <- monitoreo_aulas_formato_a_hojas_del_equipo(
    "sheet_x", "Aulas Agendadas",
    remotas = list(`Aulas Agendadas` = list(as.list(c("ID MATCH", "CURSO-HORARIO")))),
    tab_map = list(`Aulas Agendadas` = list(title = "Aulas Agendadas", sheet_id = 9L)))

  expect_identical(out$requests, 1L)
  expect_identical(out$descartados, 1L)
  # Y sobre todo: el peligroso NO salió por el cable.
  expect_false(grepl("userEnteredValue", paste(unlist(enviado), collapse = " "), fixed = TRUE))
  expect_length(enviado$requests, 1L)
})

# =============================================================================
# El primer día de campo: una hoja SEMBRADA también es del equipo
# =============================================================================
#
# El reenvío nació para las hojas `respetada` —las que el equipo ya había
# llenado— y el filtro se quedó ahí. En un documento NUEVO todas las hojas del
# equipo salen `sembrada`, así que no se aplicaba ni una regla: medido en CCSS
# Perfil 2026-II el 2026-09-17, la primera publicación devolvió
# `formato_equipo` con **0 requests sobre ocho hojas** y el recibo dijo «ok».
# El agendador abría el Sheets con «STATUS DE LLAMADA» y «RECIBIÓ CORREO» en
# texto libre, sin desplegable y sin color, el día de las llamadas.
#
# Y había un SEGUNDO cerrojo detrás del primero: la geometría salía de lo
# remoto, que en una hoja recién sembrada está vacío, así que aun pasándole las
# sembradas el `if (!length(filas)) next` las saltaba una por una. Por eso la
# prueba comprueba las dos mitades.

test_that("una hoja recien SEMBRADA recibe su formato, con la geometria producida", {
  enviado <- NULL
  testthat::local_mocked_bindings(
    .monitoreo_google_api = function(url, method = "GET", body = NULL, ...) {
      enviado <<- list(url = url, body = body); list(replies = list())
    }
  )
  # Lo REMOTO está vacío —es un documento nuevo— y la geometría es la que la
  # app acaba de escribir. Es el caso que el cerrojo de `remotas` saltaba.
  producida <- list(`Aulas Agendadas` = list(
    as.list(c("ID MATCH", "CURSO-HORARIO", "STATUS MUESTRA", "STATUS DE LLAMADA")),
    as.list(c("1", "CH 1", "SIN CONTACTAR", ""))))
  out <- monitoreo_aulas_formato_a_hojas_del_equipo(
    "sheet_x", "Aulas Agendadas", geometria = producida,
    tab_map = list(`Aulas Agendadas` = list(title = "Aulas Agendadas", sheet_id = 9L)))

  expect_identical(out$hojas, "Aulas Agendadas")
  expect_gt(out$requests, 0L)
  expect_identical(out$error, "")
  # Sigue sin mandar un solo valor: escribir cómo se ve su hoja es seguro,
  # escribir lo que dice les borraría el trabajo.
  expect_false(grepl("userEnteredValue", paste(unlist(enviado$body), collapse = " "),
                     fixed = TRUE))
})

test_that("con la geometria vacia no se inventa un rectangulo", {
  # La contracara: sin filas no hay dónde pintar, y pintar sobre un rectángulo
  # imaginado dejaría bandas a media tabla. Cero llamadas, no un error.
  llamadas <- 0L
  testthat::local_mocked_bindings(
    .monitoreo_google_api = function(url, method = "GET", body = NULL, ...) {
      llamadas <<- llamadas + 1L; list()
    }
  )
  out <- monitoreo_aulas_formato_a_hojas_del_equipo(
    "sheet_x", "Aulas Agendadas", geometria = list(`Aulas Agendadas` = list()),
    tab_map = list(`Aulas Agendadas` = list(title = "Aulas Agendadas", sheet_id = 9L)))
  expect_identical(out$hojas, character(0))
  expect_equal(llamadas, 0L)
})

test_that("`remotas` sigue valiendo como alias de la geometria", {
  # El parámetro se llamaba así cuando la geometría venía siempre de lo remoto.
  # Se conserva para no romper a quien lo pasa por nombre — los tests de arriba
  # lo hacen — y `geometria` manda cuando vienen las dos.
  testthat::local_mocked_bindings(
    .monitoreo_google_api = function(url, method = "GET", body = NULL, ...) list(replies = list())
  )
  filas <- list(as.list(c("ID MATCH", "STATUS MUESTRA")), as.list(c("1", "AGENDADA")))
  tm <- list(`Aulas Agendadas` = list(title = "Aulas Agendadas", sheet_id = 9L))
  por_alias <- monitoreo_aulas_formato_a_hojas_del_equipo(
    "sheet_x", "Aulas Agendadas", remotas = list(`Aulas Agendadas` = filas), tab_map = tm)
  por_nombre <- monitoreo_aulas_formato_a_hojas_del_equipo(
    "sheet_x", "Aulas Agendadas", geometria = list(`Aulas Agendadas` = filas), tab_map = tm)
  expect_identical(por_alias$requests, por_nombre$requests)
  expect_identical(por_alias$hojas, "Aulas Agendadas")
})
