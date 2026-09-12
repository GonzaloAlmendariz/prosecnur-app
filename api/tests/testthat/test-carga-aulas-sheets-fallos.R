# «No existe» y «no se pudo leer» no son lo mismo.
#
# Clase 4 del catálogo en su forma más cara: no es que el paso calle, es que
# **cuenta la razón equivocada**. Cualquier error al leer una pestaña —red
# caída, cuota de la API, permiso revocado, token vencido— se tragaba con NULL y
# la pestaña acababa en `hojas_ausentes`, donde la UI dice «no está en el
# libro». Eso manda a mirar el Sheets cuando lo que tocaba era reintentar; y si
# la pestaña es «Aulas Aplicadas (Campo)», el parte entero desaparece de la
# lectura sin una sola alarma.

test_that("una pestaña que falla por red se reporta, no se cuenta como ausente", {
  local_mocked_bindings(
    .cads_valores_de_pestana = function(spreadsheet_id, pestana) {
      if (identical(pestana, "Aulas Agendadas")) {
        return(list(list("CURSO-HORARIO"), list("CH 1")))
      }
      stop("HTTP 429: quota exceeded", call. = FALSE)
    }
  )
  out <- aulas_libro_leer_de_sheets("abc")
  fallos <- attr(out, "fallos")
  expect_true(length(fallos) > 0L)
  motivos <- vapply(fallos, function(f) f$motivo, character(1))
  expect_true(all(grepl("quota", motivos)))
  # Y lo que SÍ se leyó sigue ahí: un fallo parcial no tira la lectura entera.
  expect_true("agendadas" %in% names(out))
})

test_that("una pestaña que no existe NO se reporta como fallo", {
  # Es el caso legítimo: un libro a mitad de operativo no tiene la hoja de
  # campo, y obligar a crearla vacía para poder sincronizar sería absurdo.
  local_mocked_bindings(
    .cads_valores_de_pestana = function(spreadsheet_id, pestana) {
      stop("Unable to parse range: 'Aulas Aplicadas (Campo)'", call. = FALSE)
    }
  )
  out <- aulas_libro_leer_de_sheets("abc")
  expect_length(attr(out, "fallos"), 0L)
  expect_length(out, 0L)
})

test_that("un motivo que no sabemos clasificar cuenta como FALLO", {
  # Fallar cerrado: ante la duda se avisa, en vez de dar por ausente una hoja
  # que quizá esté ahí.
  local_mocked_bindings(
    .cads_valores_de_pestana = function(spreadsheet_id, pestana) {
      stop("algo raro que nadie previo", call. = FALSE)
    }
  )
  fallos <- attr(aulas_libro_leer_de_sheets("abc"), "fallos")
  expect_true(length(fallos) > 0L)
})

test_that("los fallos llegan hasta el resumen de la importacion", {
  # Un campo sin consumidor no es prueba de nada: la distincion solo sirve si
  # llega a quien pulsa el boton.
  fuente <- readLines(testthat::test_path("..", "..", "R", "carga_aulas_libro.R"), warn = FALSE)
  expect_true(any(grepl("hojas_con_fallo", fuente, fixed = TRUE)))
  router <- readLines(testthat::test_path("..", "..", "R", "router_monitoreo.R"), warn = FALSE)
  # Las dos puertas de importacion del libro lo emiten.
  expect_gte(sum(grepl("hojas_con_fallo", router, fixed = TRUE)), 2L)
})

test_that("si renovar el acceso falla, su motivo viaja en el error", {
  # El 401 de Google dice «invalid authentication credentials» y manda a revisar
  # el permiso del documento. Cuando lo que falló fue LEER el secreto —un
  # escalón antes—, ése es el mensaje equivocado, no uno de menos.
  local_mocked_bindings(
    .monitoreo_google_api_once = function(url, method = "GET", body = NULL, token = NULL) {
      list(status_code = 401L,
           parsed = list(error = list(message = "Request had invalid authentication credentials.")))
    },
    .monitoreo_sheets_refresh_access_token = function() {
      stop("no se pudo descifrar el secreto guardado", call. = FALSE)
    }
  )
  err <- tryCatch(prosecnurapp:::.monitoreo_google_api("https://x"),
                  error = function(e) conditionMessage(e))
  expect_match(err, "invalid authentication", fixed = TRUE)
  expect_match(err, "no se pudo descifrar el secreto guardado", fixed = TRUE)
})
