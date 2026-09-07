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
  expect_setequal(names(escritas), "Plan del día")
  expect_false(any(grepl("Aulas ", names(escritas), fixed = TRUE)))

  # Y sin ninguna columna de gestión: esperadas, obtenidas, elegibles, estado y
  # el enlace de la ficha se quedan en el libro operativo.
  cabecera <- unlist(escritas[["Plan del día"]][[1]], use.names = FALSE)
  for (fuera in c("ESPERADAS", "OBTENIDAS", "ELEGIBLES", "ENLACE", "ESTADO", "MATRICULADOS")) {
    expect_false(any(grepl(fuera, cabecera, fixed = TRUE)), info = fuera)
  }
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
  reqs <- aulas_libro_plan_aplicadores_formato_requests(7L, filas)
  celdas <- Filter(function(r) {
    rg <- r$repeatCell$range
    !is.null(rg) && identical(rg$startColumnIndex, 0L) && identical(rg$endColumnIndex, 1L) &&
      rg$startRowIndex > 0L
  }, reqs)
  # Una celda pintada por fila de datos.
  expect_length(celdas, 4L)
  color <- function(k) celdas[[k]]$repeatCell$cell$userEnteredFormat$backgroundColor
  # La misma persona, el mismo color en los dos días: el equipo aprende el suyo.
  expect_identical(color(1L), color(3L))
  # Dos personas contiguas, colores distintos.
  expect_false(identical(color(1L), color(2L)))
  # Y el comodín no comparte con nadie.
  expect_false(identical(color(4L), color(1L)))
  expect_false(identical(color(4L), color(2L)))
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
