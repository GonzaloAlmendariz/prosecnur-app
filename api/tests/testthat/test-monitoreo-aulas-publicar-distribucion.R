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
  # Sólo la distribución: ni «Aulas Agendadas» ni «Aulas Aplicadas (Campo)»,
  # que son las que el equipo edita y no tienen nada que hacer en el documento
  # de los aplicadores.
  expect_setequal(names(escritas), c("Asignación de aplicadores", "Plan del día"))
  expect_false(any(grepl("Aulas ", names(escritas), fixed = TRUE)))
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
