# **El Sheets que se comparte con los aplicadores.**
#
# Dictado de Gonzalo (2026-09-07, primer día de campo): «ya que tenemos toda la
# distribución de aplicaciones de la semana, los aplicadores necesitan poder
# verlos en un sheets aparte. El motor debe ser capaz de publicar un sheets de
# su distribución para ser compartido a ellos».
#
# Lo que se sujeta aquí es lo que distingue este publicador del del libro: que
# escribe SOLO la distribución, que no hay hojas del equipo que respetar —el
# documento es de la app entero— y que sin disponibilidad se niega en vez de
# dejar un documento en blanco, porque un aplicador que abre su hoja vacía no
# sabe si es que no le toca nada o si el sistema falló.

.mapd_plan <- function() list(
  list(operational_code = "CH 1", classroom_id = "a1", sample_role = "titular",
       sample_status = "agendada", operational_status = "agendada",
       faculty = "Ciencias", course_name = "Cálculo", teacher = "Docente Uno",
       scheduled_date = "2026-09-07", scheduled_time = "10:00 am",
       scheduled_venue = "A101", eligible_n = 40, expected_valid = 20),
  list(operational_code = "CH 2", classroom_id = "a2", sample_role = "titular",
       sample_status = "agendada", operational_status = "agendada",
       faculty = "Letras", course_name = "Lógica", teacher = "Docente Dos",
       scheduled_date = "2026-09-07", scheduled_time = "12:00 pm",
       scheduled_venue = "L201", eligible_n = 30, expected_valid = 15)
)

.mapd_disp <- function() list(
  list(nombre = "Ana Prueba", dias = list(lunes = list(list(inicio = "08:00", fin = "20:00"))))
)

test_that("sin disponibilidad se niega con un error accionable, no publica vacío", {
  err <- tryCatch(
    monitoreo_aulas_publicar_distribucion("sheet_x", plan = .mapd_plan(), disponibilidad = NULL),
    error = function(e) e
  )
  expect_s3_class(err, "error")
  expect_match(conditionMessage(err), "disponibilidad", fixed = TRUE)
})

test_that("un enlace sin identificador se rechaza antes de tocar la red", {
  err <- tryCatch(
    monitoreo_aulas_publicar_distribucion("no-es-un-enlace", plan = .mapd_plan(),
                                          disponibilidad = .mapd_disp()),
    error = function(e) e
  )
  expect_s3_class(err, "error")
})

test_that("publica las dos hojas de la distribución y NINGUNA del equipo", {
  escritas <- NULL
  destino <- NULL
  local_mocked_bindings(
    .monitoreo_sync_sheets_publish_tabs = function(id, tabs, format_requests = NULL, ...) {
      destino <<- id
      escritas <<- tabs
      list(skipped_tabs = list())
    },
    .package = "prosecnurapp"
  )
  out <- monitoreo_aulas_publicar_distribucion(
    "https://docs.google.com/spreadsheets/d/ABC123xyz/edit#gid=0",
    plan = .mapd_plan(), disponibilidad = .mapd_disp()
  )
  expect_identical(destino, "ABC123xyz")
  expect_identical(out$spreadsheet_id, "ABC123xyz")
  # **UNA sola hoja.** La primera versión publicaba dos —la asignación por
  # persona y el plan del día del libro— y Gonzalo la corrigió el mismo día:
  # «le estás dando a los aplicadores más información de la que necesitan, y
  # documentación interna».
  # **La hoja se llama por su SEMANA desde el 2026-09-11.** Era «Plan del día»,
  # un nombre fijo, y con dos semanas de campo en curso eso sólo podía acabar
  # de una forma: la semana nueva escrita encima de la vieja. Gonzalo lo dictó
  # dos veces —«cada hoja va a ser por semana» el 08/09, y «que la app aprenda
  # a escribir una pestaña por semana» el 11/09—. Sigue siendo UNA hoja por
  # publicación cuando el reparto cabe en una semana, que es la regla que este
  # test sujeta; lo que cambió es de dónde sale su nombre.
  expect_setequal(names(escritas), "Semana 1")
  expect_false(any(grepl("Aulas ", names(escritas), fixed = TRUE)))

  # Y sin ninguna columna de gestión: esperadas, obtenidas, elegibles y el
  # enlace de la ficha se quedan en el libro operativo.
  #
  # **ESTADO salió de esta lista el 2026-09-08.** Estaba prohibido —«le estás
  # dando a los aplicadores más información de la que necesitan»— y Gonzalo lo
  # pidió explícitamente cuando la hoja pasó a ser fuente de verdad:
  # «necesitamos una columna más que diga el estatus… por aplicar, aplicada,
  # reagendada, rechazada». No es información de gestión que se les enseña: es
  # donde ELLOS y el equipo escriben, y sin ella una reagendación no se puede
  # anotar antes de aplicarse.
  cabecera <- unlist(escritas[["Semana 1"]][[1]], use.names = FALSE)
  for (fuera in c("ESPERADAS", "OBTENIDAS", "ELEGIBLES", "ENLACE", "MATRICULADOS")) {
    expect_false(any(grepl(fuera, cabecera, fixed = TRUE)), info = fuera)
  }
  expect_true("ESTADO" %in% cabecera)
  # Lo que sí tiene que estar es lo que contesta «cuándo salgo y a dónde voy».
  for (dentro in c("APLICADOR", "EN OFICINA", "SALE AL AULA", "AULA", "DOCENTE")) {
    expect_true(dentro %in% cabecera, info = dentro)
  }
  # Y el recibo declara qué hizo con cada una.
  expect_setequal(vapply(out$hojas, function(h) h$hoja, character(1)), names(escritas))
  expect_true(all(vapply(out$hojas, function(h) h$accion == "actualizada", logical(1))))
})

test_that("las pestañas que escribe están en la whitelist del motor de Sheets", {
  # Sin esto, `.monitoreo_sheets_validate_controlled_tabs()` frena la escritura
  # con E_GOOGLE_SHEETS y el publicador falla en producción, no en los tests.
  controladas <- monitoreo_sheets_pestanas_controladas()
  expect_true("Asignación de aplicadores" %in% controladas)
  expect_true("Plan del día" %in% controladas)
})

test_that("cada aplicador lleva su color, y el comodín uno propio", {
  # «Lo que sí les puede ayudar es que cada uno tenga un color distintivo en su
  # celda para que se ubique bien, incluyendo Interno Pulso» (2026-09-07). Se
  # pinta SOLO la celda del nombre: pintar la fila entera convierte la hoja en
  # un arcoíris y deja de leerse.
  filas <- list(
    as.list(prosecnurapp:::.alpa_CABECERA),
    list("Ana Uno", "lunes 07/09", "09:30", "09:45", "10:00 a 10:30", "CH 1", "A101", "F", "C", "D"),
    list("Beto Dos", "lunes 07/09", "10:00", "10:15", "10:30 a 11:00", "CH 2", "A102", "F", "C", "D"),
    list("Ana Uno", "martes 08/09", "09:30", "09:45", "10:00 a 10:30", "CH 3", "A103", "F", "C", "D"),
    list("INTERNO PULSO", "martes 08/09", "11:00", "11:15", "11:30 a 12:00", "CH 4", "A104", "F", "C", "D")
  )
  # **El color va por VALOR de la celda desde el 2026-09-08**, no como relleno
  # de cada fila: la columna lleva desplegable y quien cambia el aplicador tiene
  # que ver el color de la persona nueva al instante. Con relleno fijo el color
  # se quedaba con el anterior — dice quién va, y miente.
  reqs <- aulas_libro_plan_aplicadores_formato_requests(7L, filas)
  reglas <- Filter(function(r) {
    rr <- r$addConditionalFormatRule
    !is.null(rr) && identical(rr$rule$ranges[[1]]$startColumnIndex, 0L)
  }, reqs)
  color_de <- stats::setNames(
    lapply(reglas, function(r) r$addConditionalFormatRule$rule$booleanRule$format$backgroundColor),
    vapply(reglas, function(r) {
      r$addConditionalFormatRule$rule$booleanRule$condition$values[[1]]$userEnteredValue
    }, character(1))
  )
  quienes <- unique(vapply(filas[-1L], function(f) {
    as.character(unlist(f, use.names = FALSE))[[1L]]
  }, character(1)))
  # Una regla por persona de la hoja, y ninguna repetida: dos personas
  # contiguas con el mismo color es justo lo que se vino a evitar.
  expect_true(all(quienes %in% names(color_de)))
  expect_identical(anyDuplicated(color_de[quienes]), 0L)
  # Y el comodín no comparte con nadie: su gris cálido está fuera de la rueda.
  interno <- aulas_nombre_aplicador(MONITOREO_AULAS_INTERNO_PULSO)
  if (interno %in% names(color_de)) {
    for (quien in setdiff(quienes, interno)) {
      expect_false(identical(color_de[[interno]], color_de[[quien]]), info = quien)
    }
  }
})

test_that("los veintidós colores no se repiten y ninguno es el del comodín", {
  # «Los aplicadores no tienen colores únicos por aplicador, debe ser una paleta
  # de 22» (2026-09-07, tras ver cuatro filas seguidas del mismo beige). Con
  # doce tonos y rotación, la quinta persona repetía el color de la primera.
  expect_length(prosecnurapp:::.alpa_PALETA, 22L)
  expect_length(unique(prosecnurapp:::.alpa_PALETA), 22L)
  expect_false(prosecnurapp:::.alpa_COLOR_INTERNO %in% prosecnurapp:::.alpa_PALETA)
})

test_that("la hoja dice el día de la semana, no la fecha ISO cruda", {
  # Salía «2026-09-10» porque el reparto no publica etiqueta y el fallback era
  # la fecha. Nadie organiza su semana leyendo ISO.
  d <- prosecnurapp:::.alpa_dia_y_fecha("2026-09-10")
  expect_identical(d$dia, "Jueves")
  expect_identical(d$fecha, "10/09")
  # Y una fecha ilegible no tumba la hoja: día vacío, la fecha tal cual.
  roto <- prosecnurapp:::.alpa_dia_y_fecha("sin fecha")
  expect_identical(roto$dia, "")
  expect_identical(roto$fecha, "sin fecha")
})

# --- S7 (loop estética-aulas-sheets, 2026-09-07): la app recuerda el destino ---
#
# El día 1 de campo la distribución publicada quedó vieja —85 citas vigentes
# contra 83 publicadas, 20 cambios de persona— y nada lo decía: el publicador
# escribía el documento y no guardaba ni el id ni cuándo ni QUÉ publicó. Hubo
# que medirlo fuera de la app. Aquí se sujeta: la publicación deja una huella
# de lo publicado, el destino se recuerda en la config (whitelist, como
# `libro_sheets`) y el tablero expone la huella del reparto vigente para que
# la UI pueda decir «el reparto cambió desde la última publicación».

.mapd_publicar <- function(plan = .mapd_plan(), disp = .mapd_disp()) {
  local_mocked_bindings(
    .monitoreo_sync_sheets_publish_tabs = function(id, tabs, format_requests = NULL, ...) list(skipped_tabs = list()),
    .package = "prosecnurapp"
  )
  monitoreo_aulas_publicar_distribucion("https://docs.google.com/spreadsheets/d/ABC123xyz/edit",
                                        plan = plan, disponibilidad = disp)
}

test_that("S7: la publicación deja huella y conteo de citas de lo que escribió", {
  out <- .mapd_publicar()
  expect_true(nzchar(out$huella))
  expect_gte(out$citas, 1L)
  # Determinista: el mismo reparto da la misma huella.
  expect_identical(.mapd_publicar()$huella, out$huella)
  # Y una cita nueva la cambia.
  plan2 <- c(.mapd_plan(), list(list(
    operational_code = "CH 3", classroom_id = "a3", sample_role = "titular",
    sample_status = "agendada", operational_status = "agendada",
    faculty = "Letras", course_name = "Ética", teacher = "Docente Tres",
    scheduled_date = "2026-09-07", scheduled_time = "03:00 pm",
    scheduled_venue = "L301", eligible_n = 30, expected_valid = 15
  )))
  out2 <- .mapd_publicar(plan = plan2)
  expect_false(identical(out2$huella, out$huella))
  expect_gt(out2$citas, out$citas)
})

test_that("S7: el destino de la distribución se recuerda en la config y sobrevive a la whitelist", {
  cfg <- monitoreo_aulas_distribucion_destino_set(
    list(aulas_universitarias = list()),
    "https://docs.google.com/spreadsheets/d/ABC123xyz/edit#gid=0",
    huella = "h-1", citas = 85L
  )
  d <- cfg$aulas_universitarias$distribucion_sheets
  expect_identical(d$spreadsheet_id, "ABC123xyz")
  expect_match(d$url, "^https://docs.google.com/spreadsheets/d/ABC123xyz/edit$")
  expect_identical(d$huella, "h-1")
  expect_identical(d$citas, 85L)
  expect_true(nzchar(d$updated_at))

  # La whitelist de la config de aulas lo conserva —la trampa que ya se comió
  # a `valid_filters`— y una hermana casi homónima no lo suplanta.
  n <- monitoreo_aulas_normalize_config(list(
    distribucion_sheets = d,
    distribucion_sheets_borrador = list(spreadsheet_id = "NO-ES-EL-DESTINO")
  ))
  expect_identical(n$distribucion_sheets$spreadsheet_id, "ABC123xyz")
  expect_identical(n$distribucion_sheets$huella, "h-1")
  expect_identical(n$distribucion_sheets$citas, 85L)
  # Sin destino, nada: como todos los estudios de hoy.
  expect_null(monitoreo_aulas_normalize_config(list())$distribucion_sheets)
  # Y vaciarlo lo olvida.
  expect_null(monitoreo_aulas_distribucion_destino_set(cfg, "")$aulas_universitarias$distribucion_sheets)
})

test_that("S7: el tablero expone la huella del reparto vigente, la misma que deja la publicación", {
  out <- .mapd_publicar()
  d <- .mac_publicar_disponibilidad(list(), .mapd_plan(), .mapd_disp())
  expect_identical(d$reparto$distribucion$huella, out$huella)
  expect_identical(d$reparto$distribucion$citas, out$citas)
})

# --- Una distribución con dueño no se sobrescribe ----------------------------
#
# `monitoreo_aulas_publicar_distribucion()` nació para SEMBRAR el documento,
# cuando la pestaña estaba vacía y la app era su única autora. El 2026-09-08
# dejó de serlo: el coordinador editaba ahí en vivo y llevaba 33 cambios de
# aplicador y tres reagendaciones. Publicar encima los habría borrado de un
# request, y es la llamada que se hace sin pensar («republico y ya»).

test_that("publicar la distribución se niega cuando la pestaña ya tiene citas", {
  mock <- .sheets_api_mock()
  cab <- as.list(prosecnurapp:::.alpa_CABECERA)
  fila <- function(cod) as.list(c("Aplicador Uno", "Lunes", "07/09", "09:30", "09:45",
                                  "10:00 a 10:30", cod, "A101", "Ciencias", "Cálculo",
                                  "Docente Uno", "POR APLICAR"))
  mock$seed("Semana 1", values = list(cab, fila("CH 1"), fila("CH 2")))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  err <- tryCatch(
    monitoreo_aulas_publicar_distribucion("sheet_dist", plan = .mapd_plan(),
                                          disponibilidad = .mapd_disp()),
    api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_AULAS_DISTRIBUCION_CON_DUENO")
  # El mensaje dice qué hacer en su lugar, no sólo que no.
  expect_match(conditionMessage(err), "Adopta la distribución")
  expect_match(conditionMessage(err), "Semana 1", fixed = TRUE)
  # Y no se escribió ni un values sobre el documento.
  escrituras <- Filter(function(c) grepl("values", c$url) && !identical(c$method, "GET"),
                       mock$env$calls)
  expect_length(escrituras, 0L)
})

test_that("un documento vacío sí se siembra: la guarda protege el trabajo, no el flujo", {
  mock <- .sheets_api_mock()
  mock$seed("Semana 1", values = list())
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  out <- monitoreo_aulas_publicar_distribucion("sheet_dist", plan = .mapd_plan(),
                                               disponibilidad = .mapd_disp())
  expect_true(isTRUE(out$ok))
  expect_gt(out$citas, 0L)
})

# --- Una pestaña por semana ---------------------------------------------------
#
# Dictado de Gonzalo, dos veces. El 2026-09-08, cuando la app leía cero citas de
# un documento con ochenta y seis porque buscaba «Plan del día» y la pestaña se
# llamaba «Semana 1»: «cada hoja va a ser por semana». Entonces sólo se arregló
# la LECTURA. El 2026-09-11, al armar el reparto del 14 al 18: «ojo, el reparto
# va a una segunda hoja llamada Semana 2» y «que la app aprenda a escribir una
# pestaña por semana».
#
# Lo que estaba roto no era el nombre: era que con UNA hoja fija la semana 2 se
# publica encima de la 1, y la 1 es donde el coordinador lleva sus cambios.

.mapd_plan_dos_semanas <- function() c(.mapd_plan(), list(
  list(operational_code = "CH 3", classroom_id = "a3", sample_role = "titular",
       sample_status = "agendada", operational_status = "agendada",
       faculty = "Ciencias", course_name = "Álgebra", teacher = "Docente Tres",
       scheduled_date = "2026-09-14", scheduled_time = "10:00 am",
       scheduled_venue = "A102", eligible_n = 40, expected_valid = 20)
))

test_that("la semana se cuenta desde el lunes de la primera aula del plan", {
  inicio <- monitoreo_aulas_inicio_de_campo(.mapd_plan_dos_semanas())
  # El 07/09/2026 es lunes: el origen es ese mismo día.
  expect_identical(format(inicio), "2026-09-07")
  expect_identical(monitoreo_aulas_semana_de("2026-09-07", inicio), 1L)
  # El domingo cierra la semana: el 13 sigue siendo la 1 y el 14 abre la 2.
  expect_identical(monitoreo_aulas_semana_de("2026-09-13", inicio), 1L)
  expect_identical(monitoreo_aulas_semana_de("2026-09-14", inicio), 2L)
  expect_identical(monitoreo_aulas_semana_de("2026-09-21", inicio), 3L)
  # Lo ilegible y lo anterior al origen NO inventan semana: sin esto una fecha
  # rota bautizaría una pestaña «Semana NA» y el validador de pestañas
  # controladas frenaría la publicación entera.
  expect_true(is.na(monitoreo_aulas_semana_de("ayer", inicio)))
  expect_true(is.na(monitoreo_aulas_semana_de("2026-08-31", inicio)))
})

test_that("un reparto que cruza el domingo se publica en dos pestañas", {
  escritas <- NULL
  local_mocked_bindings(
    .monitoreo_sync_sheets_publish_tabs = function(id, tabs, format_requests = NULL, ...) {
      escritas <<- tabs
      # El formato tiene que llegar a las DOS: una semana sin desplegable de
      # estado ni colores por aplicador es una tabla muerta desde la que nadie
      # puede reasignar.
      for (nm in names(tabs)) {
        expect_gt(length(format_requests(7L, nm, tabs[[nm]])), 0L)
      }
      list(skipped_tabs = list())
    },
    .package = "prosecnurapp"
  )
  out <- monitoreo_aulas_publicar_distribucion(
    "sheet_dist", plan = .mapd_plan_dos_semanas(), disponibilidad = .mapd_disp())
  expect_setequal(names(escritas), c("Semana 1", "Semana 2"))
  codigos <- function(hoja) {
    cab <- unlist(escritas[[hoja]][[1]], use.names = FALSE)
    col <- which(cab == "CURSO-HORARIO")
    vapply(escritas[[hoja]][-1], function(r) unlist(r, use.names = FALSE)[[col]], character(1))
  }
  expect_setequal(codigos("Semana 1"), c("CH 1", "CH 2"))
  expect_setequal(codigos("Semana 2"), "CH 3")
  expect_setequal(vapply(out$hojas, function(h) h$hoja, character(1)),
                  c("Semana 1", "Semana 2"))
})

test_that("la semana 1 con dueño no impide sembrar la semana 2", {
  # **El defecto que obligó al cambio.** La guarda era por DOCUMENTO: bastaba
  # que una pestaña tuviera citas para que la publicación entera se negara. Con
  # una hoja por semana eso significa que el trabajo del coordinador en la
  # semana en curso bloquea para siempre la siguiente.
  mock <- .sheets_api_mock()
  cab <- as.list(prosecnurapp:::.alpa_CABECERA)
  fila <- function(cod, fecha) as.list(c("Ana Prueba", "Lunes", fecha, "09:30", "09:45",
                                         "10:00 a 10:30", cod, "A101", "Ciencias",
                                         "Cálculo", "Docente Uno", "APLICADA"))
  mock$seed("Semana 1", values = list(cab, fila("CH 1", "07/09"), fila("CH 2", "07/09")))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  out <- monitoreo_aulas_publicar_distribucion(
    "sheet_dist", plan = .mapd_plan_dos_semanas(), disponibilidad = .mapd_disp())
  expect_true(isTRUE(out$ok))
  accion <- vapply(out$hojas, function(h) h$accion, character(1))
  names(accion) <- vapply(out$hojas, function(h) h$hoja, character(1))
  # La 1 se respeta y se DICE; callarla dejaría una publicación que parece
  # completa habiendo dejado una semana fuera.
  expect_identical(unname(accion[["Semana 1"]]), "respetada")
  expect_identical(unname(accion[["Semana 2"]]), "actualizada")
})

test_that("si TODAS las semanas tienen dueño sigue siendo un error, no un silencio", {
  mock <- .sheets_api_mock()
  cab <- as.list(prosecnurapp:::.alpa_CABECERA)
  fila <- function(cod) as.list(c("Ana Prueba", "Lunes", "07/09", "09:30", "09:45",
                                  "10:00 a 10:30", cod, "A101", "Ciencias",
                                  "Cálculo", "Docente Uno", "POR APLICAR"))
  mock$seed("Semana 1", values = list(cab, fila("CH 1"), fila("CH 2")))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  err <- tryCatch(
    monitoreo_aulas_publicar_distribucion("sheet_dist", plan = .mapd_plan(),
                                          disponibilidad = .mapd_disp()),
    api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_AULAS_DISTRIBUCION_CON_DUENO")
  escrituras <- Filter(function(c) grepl("values", c$url) && !identical(c$method, "GET"),
                       mock$env$calls)
  expect_length(escrituras, 0L)
})

test_that("una semana que ya vive en la pestaña heredada no se duplica", {
  # Los documentos que ya están en la calle traen la semana 1 en «Plan del día».
  # Escribir «Semana 1» sin mirar dejaría la misma semana en dos pestañas y al
  # aplicador con dos verdades abiertas.
  mock <- .sheets_api_mock()
  cab <- as.list(prosecnurapp:::.alpa_CABECERA)
  fila <- function(cod) as.list(c("Ana Prueba", "Lunes", "07/09", "09:30", "09:45",
                                  "10:00 a 10:30", cod, "A101", "Ciencias",
                                  "Cálculo", "Docente Uno", "POR APLICAR"))
  mock$seed("Plan del día", values = list(cab, fila("CH 1")))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  err <- tryCatch(
    monitoreo_aulas_publicar_distribucion("sheet_dist", plan = .mapd_plan(),
                                          disponibilidad = .mapd_disp()),
    api_error = function(e) e)
  # Reconoce que esa semana ya tiene dueño AHÍ: la nombra por el nombre real de
  # la pestaña, no por el canónico que habría creado.
  expect_s3_class(err, "api_error")
  expect_match(conditionMessage(err), "Plan del día", fixed = TRUE)
})

# --- El recibo no dice «sin_cambios» sobre una hoja en blanco -----------------
#
# Medido el 2026-09-21 sobre este mismo Sheets, el de aplicadores de CCSS Perfil
# 2026-II: se limpiaron los VALORES de «Semana 1» (a mano desde Sheets, que es
# lo mismo que un `values:clear`), se republicó, y el recibo salió
# `{"hoja": "Semana 1", "accion": "sin_cambios"}` con cero filas — leyéndose
# como «todo en orden» encima de un documento en blanco. El motor comparaba su
# hash contra la developerMetadata `prosecnur.tab_state`, que sobrevive al
# borrado de valores, así que la pestaña coincidía consigo misma y se saltaba.
# Sólo se recuperaba borrando esa metadata a mano hoja por hoja.

test_that("una semana vaciada a mano se REPONE, y el recibo no la llama sin_cambios", {
  skip_if_not_installed("digest")
  mock <- .sheets_api_mock()
  mock$seed("Semana 1", values = list())
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)

  primera <- monitoreo_aulas_publicar_distribucion(
    "sheet_dist", plan = .mapd_plan(), disponibilidad = .mapd_disp())
  expect_true(isTRUE(primera$ok))
  filas_sembradas <- length(mock$env$sheets[["Semana 1"]]$values)
  expect_gt(filas_sembradas, 1L)

  estado_de <- function(hoja) {
    md <- Filter(function(m) identical(m$metadataKey, "prosecnur.tab_state"),
                 mock$env$sheets[[hoja]]$developerMetadata)
    if (!length(md)) "" else md[[1]]$metadataValue
  }
  estado_antes <- estado_de("Semana 1")
  expect_true(nzchar(estado_antes))

  # El vaciado: los valores se van, la metadata se queda.
  mock$env$sheets[["Semana 1"]]$values <- list()
  expect_identical(estado_de("Semana 1"), estado_antes)

  llamadas_antes <- length(mock$env$calls)
  segunda <- monitoreo_aulas_publicar_distribucion(
    "sheet_dist", plan = .mapd_plan(), disponibilidad = .mapd_disp())

  accion <- vapply(segunda$hojas, function(h) h$accion, character(1))
  names(accion) <- vapply(segunda$hojas, function(h) h$hoja, character(1))
  expect_identical(unname(accion[["Semana 1"]]), "actualizada")
  # Y el documento vuelve a tener sus filas: el arreglo se mide en el remoto,
  # no en el recibo.
  expect_equal(length(mock$env$sheets[["Semana 1"]]$values), filas_sembradas)

  # La PREMISA del defecto, sujeta aquí para que este test no pueda pasar por
  # la razón equivocada: el estado guardado quedó IGUAL, o sea que el hash de lo
  # publicado coincidía y el motor de antes tenía todo para saltarse la hoja.
  expect_identical(estado_de("Semana 1"), estado_antes)

  # Y sin pagar un request extra: la lectura que esta función ya hace para su
  # guarda de dueño se le presta al motor por `remote_values`.
  nuevas <- mock$env$calls[(llamadas_antes + 1L):length(mock$env$calls)]
  sondas <- Filter(function(c) grepl("/values:batchGet", c$url), nuevas)
  expect_length(sondas, 0L)
})
