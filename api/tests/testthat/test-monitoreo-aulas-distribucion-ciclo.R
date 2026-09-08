# El documento de los aplicadores, de ida y de vuelta.
#
# Dictado de Gonzalo (2026-09-08): «quiero ver si el sheets de distribución de
# aplicadores externo tiene forma de crearse desde la app y de leerlo también».
#
# Crear cierra un paso que se hacía fuera —y cada paso fuera es una oportunidad
# de pegar el documento equivocado, que ya pasó—. Leer contesta la pregunta que
# nadie podía contestar: si lo que los veintidós están mirando sigue siendo el
# reparto de ahora.

.mdc_cab <- function() prosecnurapp:::.alpa_CABECERA

# Una fila de la hoja de aplicadores, con lo justo para identificarla.
.mdc_fila <- function(codigo, fecha, aplicador, aplica = "10:00") {
  v <- rep("", length(.mdc_cab()))
  puesto <- function(t) which(.mdc_cab() == t)[[1]]
  v[[puesto("APLICADOR")]] <- aplicador
  v[[puesto("FECHA")]] <- fecha
  v[[puesto("APLICA")]] <- aplica
  v[[puesto("CURSO-HORARIO")]] <- codigo
  as.list(v)
}

.mdc_hoja <- function(...) c(list(as.list(.mdc_cab())), list(...))

# Lo que devolvería el Sheets remoto para esa misma hoja.
#
# `.env = parent.frame()`: sin eso el mock se deshace al RETORNAR este helper y
# el test sale a la red de verdad —«Requested entity was not found» contra un id
# inventado—. El parámetro se llama `.env`, no `.local_envir`; con el nombre
# equivocado `local_mocked_bindings` lo toma por una función más que mockear y
# falla con «Can't find binding».
.mdc_remoto <- function(filas, envir = parent.frame()) {
  local_mocked_bindings(
    .monitoreo_sheets_metadata = function(id) list(
      spreadsheetId = id,
      properties = list(title = "Distribución de aplicadores"),
      sheets = list(
        list(properties = list(title = prosecnurapp:::.mapd_hoja())),
        # La pestaña vieja que quedó de la primera versión: se nombra, no se toca.
        list(properties = list(title = "Asignación de aplicadores"))
      )
    ),
    .cads_valores_de_pestana = function(id, pestana) filas,
    .package = "prosecnurapp",
    .env = envir
  )
}

test_that("crear devuelve el documento con su pestaña y no comparte con nadie", {
  cuerpo <- NULL
  local_mocked_bindings(
    .monitoreo_google_api = function(url, method = "GET", body = NULL) {
      cuerpo <<- list(url = url, method = method, body = body)
      list(spreadsheetId = "NUEVO123")
    },
    .package = "prosecnurapp"
  )
  out <- monitoreo_aulas_crear_distribucion("Distribución HSVG2026")
  expect_identical(out$spreadsheet_id, "NUEVO123")
  expect_match(out$url, "NUEVO123")
  expect_identical(cuerpo$method, "POST")
  # Nace con la ÚNICA pestaña que el motor publica, así que la primera
  # publicación no tiene que crearla.
  expect_identical(cuerpo$body$sheets[[1]]$properties$title, prosecnurapp:::.mapd_hoja())
  expect_identical(cuerpo$body$properties$title, "Distribución HSVG2026")
  # Ni un solo request a Drive: repartir accesos es decisión del lead, no un
  # efecto de crear el archivo.
  expect_false(grepl("drive", cuerpo$url, fixed = TRUE))
})

test_that("si Google no devuelve identificador, se declara y no se recuerda nada", {
  local_mocked_bindings(
    .monitoreo_google_api = function(url, method = "GET", body = NULL) list(ok = TRUE),
    .package = "prosecnurapp"
  )
  expect_error(monitoreo_aulas_crear_distribucion("X"), "identificador")
})

test_that("leer dice que coincide cuando el documento es el reparto de ahora", {
  filas <- .mdc_hoja(
    .mdc_fila("CH 1", "2026-09-08", "Aguilar Cuya, Renzo"),
    .mdc_fila("CH 2", "2026-09-08", "Puchuri Chamorro, Sara")
  )
  .mdc_remoto(filas)
  out <- monitoreo_aulas_leer_distribucion("ABC123", filas)
  expect_true(out$coincide)
  expect_equal(out$citas_remotas, 2L)
  expect_equal(out$citas_ahora, 2L)
  expect_identical(out$faltan, character(0))
  expect_identical(out$sobran, character(0))
  expect_length(out$cambiadas, 0L)
})

test_that("y nombra lo que falta, lo que sobra y lo que cambió de aplicador", {
  # El caso del operativo: se repartió de nuevo y el documento compartido se
  # quedó con lo de antes.
  publicado <- .mdc_hoja(
    .mdc_fila("CH 1", "2026-09-08", "Aguilar Cuya, Renzo"),
    .mdc_fila("CH 9", "2026-09-08", "Se dio de baja")
  )
  ahora <- .mdc_hoja(
    .mdc_fila("CH 1", "2026-09-08", "Chamorro Rodriguez, Rosa"),
    .mdc_fila("CH 5", "2026-09-08", "Puchuri Chamorro, Sara")
  )
  .mdc_remoto(publicado)
  out <- monitoreo_aulas_leer_distribucion("ABC123", ahora)
  expect_false(out$coincide)
  expect_true(out$comparado)
  # La cita nueva todavía no publicada.
  expect_true(any(grepl("CH 5", out$faltan)))
  # La que sigue publicada y ya no existe: el aplicador que se dio de baja.
  expect_true(any(grepl("CH 9", out$sobran)))
  # Y la que cambió de manos, con las dos versiones.
  expect_length(out$cambiadas, 1L)
  cambio <- out$cambiadas[[1]]
  expect_identical(cambio$curso_horario, "CH 1")
  campos <- vapply(cambio$campos, function(c) c$columna, character(1))
  expect_true("APLICADOR" %in% campos)
  el <- cambio$campos[[which(campos == "APLICADOR")[[1]]]]
  expect_identical(el$publicado, "Aguilar Cuya, Renzo")
  expect_identical(el$ahora, "Chamorro Rodriguez, Rosa")
})

test_that("una pestaña ajena se nombra, no se toca", {
  filas <- .mdc_hoja(.mdc_fila("CH 1", "2026-09-08", "Alguien"))
  .mdc_remoto(filas)
  out <- monitoreo_aulas_leer_distribucion("ABC123", filas)
  # El motor publica UNA hoja; lo que alguien haya añadido no es suyo. La vieja
  # «Asignación de aplicadores» quedó de la primera versión y sigue ahí.
  expect_identical(out$pestanas_ajenas, "Asignación de aplicadores")
})

test_that("sin disponibilidad la lectura vale igual: dice qué hay publicado", {
  # No hay reparto que comparar —el estudio aún no cargó su oferta— pero saber
  # qué están viendo los aplicadores sigue sirviendo, y se declara que no se
  # comparó en vez de decir que coincide.
  filas <- .mdc_hoja(.mdc_fila("CH 1", "2026-09-08", "Alguien"))
  .mdc_remoto(filas)
  out <- monitoreo_aulas_leer_distribucion("ABC123", NULL)
  expect_equal(out$citas_remotas, 1L)
  expect_equal(out$citas_ahora, 0L)
  expect_false(out$comparado)
  expect_false(out$coincide)
})

test_that("una cabecera que alguien reordenó no inventa diferencias", {
  # Comparar por POSICIÓN sobre un documento que alguien pudo tocar produciría
  # cambios que no existen. Sin las dos columnas clave no se compara y se dice.
  rota <- list(as.list(rep("", length(.mdc_cab()))), .mdc_fila("CH 1", "2026-09-08", "Alguien"))
  .mdc_remoto(rota)
  out <- monitoreo_aulas_leer_distribucion("ABC123", .mdc_hoja(.mdc_fila("CH 1", "2026-09-08", "Otro")))
  expect_false(out$cabecera_legible)
  expect_false(out$comparado)
  expect_length(out$cambiadas, 0L)
})
