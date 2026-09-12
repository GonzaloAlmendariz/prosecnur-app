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
    # La vieja «Asignación de aplicadores» tiene OTRA cabecera: devolverle las
    # mismas filas la haría indistinguible de una hoja de distribución —el
    # motor las reconoce por su cabecera— y entonces el test no probaría nada
    # sobre cuál es ajena, sólo que la primera no lo es.
    .cads_valores_de_pestana = function(id, pestana) {
      if (identical(pestana, "Asignación de aplicadores")) {
        return(list(list("CODIGO", "PERSONA")))
      }
      filas
    },
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

# ---------------------------------------------------------------------------
# **El Sheets como FUENTE DE VERDAD del reparto.**
#
# Dictado de Gonzalo (2026-09-08): «ese excel es la fuente de verdad, la app
# debe ser capaz de producirlo, leerlo y actualizar la distribución elaborada en
# la app en base al sheets». Cada fila se vuelve una fijación y el motor deja de
# reordenarla — lo que además congela el reparto, que se recalculaba entero en
# cada publicación y movía asignaciones ya comunicadas.
# ---------------------------------------------------------------------------

.mdc_plan <- function(...) lapply(c(...), function(cod) {
  list(operational_code = cod, classroom_id = cod, sample_role = "titular")
})

test_that("cada fila del Sheets se vuelve una fijación del reparto", {
  filas <- .mdc_hoja(
    .mdc_fila("CH 1", "2026-09-08", "Aguilar Cuya, Renzo"),
    .mdc_fila("CH 2", "2026-09-08", "Puchuri Chamorro, Sara")
  )
  out <- monitoreo_aulas_fijaciones_desde_distribucion(
    filas, .mdc_plan("CH 1", "CH 2"),
    roster = c("Aguilar Cuya, Renzo", "Puchuri Chamorro, Sara"))
  expect_equal(out$adoptadas, 2L)
  expect_identical(out$fijadas[["CH 1"]], "Aguilar Cuya, Renzo")
  expect_identical(out$fijadas[["CH 2"]], "Puchuri Chamorro, Sara")
})

test_that("un aplicador que no es del equipo se declara y NO se fija", {
  # Un nombre tecleado a mano no es una decisión: fijarlo metería en el reparto
  # a alguien que no existe, y el motor repartiría contra un fantasma.
  filas <- .mdc_hoja(
    .mdc_fila("CH 1", "2026-09-08", "Aguilar Cuya, Renzo"),
    .mdc_fila("CH 2", "2026-09-08", "Pedro el del pasillo")
  )
  out <- monitoreo_aulas_fijaciones_desde_distribucion(
    filas, .mdc_plan("CH 1", "CH 2"), roster = c("Aguilar Cuya, Renzo"))
  expect_equal(out$adoptadas, 1L)
  expect_null(out$fijadas[["CH 2"]])
  # Normalizado por `aulas_nombre_aplicador()`, que conserva las partículas en
  # minúscula: lo que se declara es lo que se leyó, escrito como la app escribe
  # los nombres.
  expect_identical(out$aplicadores_desconocidos, "Pedro el del Pasillo")
})

test_that("un curso-horario que no está en el plan se declara y NO se fija", {
  filas <- .mdc_hoja(
    .mdc_fila("CH 1", "2026-09-08", "Aguilar Cuya, Renzo"),
    .mdc_fila("CH 999", "2026-09-08", "Aguilar Cuya, Renzo")
  )
  out <- monitoreo_aulas_fijaciones_desde_distribucion(
    filas, .mdc_plan("CH 1"), roster = c("Aguilar Cuya, Renzo"))
  expect_equal(out$adoptadas, 1L)
  expect_identical(out$codigos_desconocidos, "CH 999")
})

test_that("una fila sin aplicador se declara y deja la cita en automático", {
  # Vaciar la celda es la forma de SOLTAR una fijación: la cita vuelve al
  # reparto automático en vez de quedarse fijada a nadie.
  filas <- .mdc_hoja(
    .mdc_fila("CH 1", "2026-09-08", "Aguilar Cuya, Renzo"),
    .mdc_fila("CH 2", "2026-09-08", "")
  )
  out <- monitoreo_aulas_fijaciones_desde_distribucion(
    filas, .mdc_plan("CH 1", "CH 2"), roster = c("Aguilar Cuya, Renzo"))
  expect_equal(out$adoptadas, 1L)
  expect_identical(out$sin_aplicador, "CH 2")
  expect_null(out$fijadas[["CH 2"]])
})

test_that("una hoja sin las dos columnas clave no adopta nada: se declara", {
  rota <- list(as.list(rep("", length(.mdc_cab()))),
               .mdc_fila("CH 1", "2026-09-08", "Aguilar Cuya, Renzo"))
  expect_error(
    monitoreo_aulas_fijaciones_desde_distribucion(rota, .mdc_plan("CH 1"), "Aguilar Cuya, Renzo"),
    "APLICADOR"
  )
})

# --- El desplegable y el color que lo sigue ---------------------------------

test_that("la columna de aplicador lleva desplegable con TODO el equipo", {
  # Reasignar es mover a alguien que hoy no tiene cita: una lista sacada de las
  # filas publicadas no dejaría elegirlo.
  reqs <- aulas_libro_plan_aplicadores_formato_requests(
    7L,
    list(as.list(.mdc_cab()), .mdc_fila("CH 1", "08/09", "Aguilar Cuya, Renzo")),
    roster = list("Aguilar Cuya, Renzo", "Zuniga Perez, Ana")
  )
  # Hay dos desplegables —el del aplicador y el del estado—; éste mira el de la
  # columna 1.
  dv <- Filter(function(r) {
    identical(names(r)[[1]], "setDataValidation") &&
      identical(r$setDataValidation$range$startColumnIndex, 0L)
  }, reqs)
  expect_length(dv, 1L)
  opciones <- vapply(dv[[1]]$setDataValidation$rule$condition$values,
                     function(v) v$userEnteredValue, character(1))
  expect_true("Zuniga Perez, Ana" %in% opciones)
  expect_true(aulas_nombre_aplicador(MONITOREO_AULAS_INTERNO_PULSO) %in% opciones)
  # Sobre la columna del aplicador y desde la fila 2.
  rango <- dv[[1]]$setDataValidation$range
  expect_identical(rango$startColumnIndex, 0L)
  expect_identical(rango$endColumnIndex, 1L)
  expect_identical(rango$startRowIndex, 1L)
})

test_that("el color va por VALOR de la celda, no por fila", {
  # Con relleno fijo por fila, cambiar el aplicador en el desplegable dejaba el
  # color del anterior: dice quién va, y miente. Una regla por persona hace que
  # el color siga al nombre.
  reqs <- aulas_libro_plan_aplicadores_formato_requests(
    7L,
    list(as.list(.mdc_cab()),
         .mdc_fila("CH 1", "08/09", "Aguilar Cuya, Renzo"),
         .mdc_fila("CH 2", "08/09", "Interno Pulso")),
    roster = list("Aguilar Cuya, Renzo", "Zuniga Perez, Ana")
  )
  # Las de la columna del APLICADOR: la de ESTADO tiene las suyas.
  reglas <- Filter(function(r) {
    identical(names(r)[[1]], "addConditionalFormatRule") &&
      identical(r$addConditionalFormatRule$rule$ranges[[1]]$startColumnIndex, 0L)
  }, reqs)
  # Una por persona del equipo MÁS el comodín, aunque no tengan cita hoy.
  quienes <- vapply(reglas, function(r) {
    r$addConditionalFormatRule$rule$booleanRule$condition$values[[1]]$userEnteredValue
  }, character(1))
  expect_setequal(quienes, c("Aguilar Cuya, Renzo", "Zuniga Perez, Ana",
                             aulas_nombre_aplicador(MONITOREO_AULAS_INTERNO_PULSO)))
  # Y ninguna pinta la columna del aplicador de forma fija: el relleno por fila
  # desapareció. Los `repeatCell` que quedan son la banda de cabecera y el
  # centrado de las columnas de cifras, ninguno sobre la columna 1 de datos.
  celdas <- Filter(function(r) identical(names(r)[[1]], "repeatCell"), reqs)
  pinta_aplicador <- vapply(celdas, function(r) {
    rg <- r$repeatCell$range
    isTRUE(rg$startColumnIndex == 0L) && isTRUE(rg$startRowIndex >= 1L)
  }, logical(1))
  expect_false(any(pinta_aplicador))
})

test_that("el color de cada persona no cambia entre publicaciones", {
  # El equipo aprende el suyo: si el mapa dependiera del orden de aparición, al
  # día siguiente sería otro.
  a <- prosecnurapp:::.alpa_colores_de(c("Zeta, Ana", "Alfa, Beto", "Mid, Ceci"))
  b <- prosecnurapp:::.alpa_colores_de(c("Mid, Ceci", "Zeta, Ana", "Alfa, Beto"))
  expect_identical(a, b)
  # Y una persona nueva no le mueve el color a quien va antes en el alfabeto.
  c3 <- prosecnurapp:::.alpa_colores_de(c("Zeta, Ana", "Alfa, Beto", "Mid, Ceci", "Nuevo, Zzz"))
  expect_identical(a[["Alfa, Beto"]], c3[["Alfa, Beto"]])
})

# ---------------------------------------------------------------------------
# **Una fila que el equipo añade a medias, completada y reconocida.**
#
# «Se hizo una reagendación y tenemos que ponerla en la tabla, la vamos a
# agregar y vamos a poner la hora y estatus REAGENDADA en un principio porque
# aún no se ha aplicado, y la app debe ser capaz de identificarla, ponerle los
# datos y saber que es una reagendación».
# ---------------------------------------------------------------------------

.mdc_unidad <- function(cod, fecha = "2026-09-10", hora = "10:00 am") list(
  operational_code = cod, classroom_id = cod, sample_role = "titular",
  scheduled_venue = "L318", faculty = "Letras", course_name = "LÓGICA",
  teacher = "Castillo Gamboa, Edgar", scheduled_date = fecha, scheduled_time = hora
)

# Una fila tecleada a mano: sólo el código, la hora y el estado.
.mdc_fila_manual <- function(cod, estado = "REAGENDADA", fecha = "", aplica = "15:00") {
  v <- rep("", length(.mdc_cab()))
  p <- function(t) which(.mdc_cab() == t)[[1]]
  v[[p("CURSO-HORARIO")]] <- cod
  v[[p("APLICA")]] <- aplica
  v[[p("ESTADO")]] <- estado
  if (nzchar(fecha)) v[[p("FECHA")]] <- fecha
  as.list(v)
}

.mdc_de <- function(fila, titulo) {
  as.character(unlist(fila, use.names = FALSE))[[which(.mdc_cab() == titulo)[[1]]]]
}

test_that("una fila añadida a mano se completa con los datos reales del CH", {
  out <- monitoreo_aulas_completar_distribucion(
    list(as.list(.mdc_cab()), .mdc_fila_manual("CH 7")),
    plan = list(.mdc_unidad("CH 7")),
    filas_ahora = .mdc_hoja(.mdc_fila("CH 1", "10/09", "Alguien"))
  )
  expect_length(out$filas, 1L)
  f <- out$filas[[1]]
  expect_true(f$completada)
  # El plan pone lo que el equipo no escribió.
  expect_identical(.mdc_de(f$fila, "AULA"), "L318")
  expect_identical(.mdc_de(f$fila, "FACULTAD"), "Letras")
  expect_identical(.mdc_de(f$fila, "CURSO"), "LÓGICA")
  expect_identical(.mdc_de(f$fila, "DOCENTE"), "Castillo Gamboa, Edgar")
  # Y el día de la semana escrito, derivado de la fecha del plan.
  expect_identical(.mdc_de(f$fila, "FECHA"), "10/09")
  expect_identical(.mdc_de(f$fila, "DÍA"), "Jueves")
  # Lo que el equipo SÍ escribió se respeta.
  expect_identical(.mdc_de(f$fila, "APLICA"), "15:00")
})

test_that("y se reconoce como reagendación por el estado que el equipo puso", {
  out <- monitoreo_aulas_completar_distribucion(
    list(as.list(.mdc_cab()), .mdc_fila_manual("CH 7", estado = "REAGENDADA")),
    plan = list(.mdc_unidad("CH 7")),
    filas_ahora = .mdc_hoja(.mdc_fila("CH 7", "10/09", "Alguien"))
  )
  expect_identical(out$filas[[1]]$clase, "reagendada")
  expect_equal(out$resumen$reagendada, 1L)
})

test_that("también por el hecho: la fecha que el equipo puso no es la del plan", {
  # El estado es la intención declarada y la fecha distinta es el hecho. Exigir
  # las dos perdería la mitad de los casos: quien mueve una cita a veces sólo
  # cambia la fecha.
  out <- monitoreo_aulas_completar_distribucion(
    list(as.list(.mdc_cab()), .mdc_fila_manual("CH 7", estado = "POR APLICAR", fecha = "12/09")),
    plan = list(.mdc_unidad("CH 7", fecha = "2026-09-10")),
    filas_ahora = .mdc_hoja(.mdc_fila("CH 7", "10/09", "Alguien"))
  )
  expect_identical(out$filas[[1]]$clase, "reagendada")
  # Y la fecha que el equipo escribió NO se pisa con la del plan.
  expect_identical(.mdc_de(out$filas[[1]]$fila, "FECHA"), "12/09")
})

test_that("un curso-horario que el reparto no traía sale como añadido", {
  out <- monitoreo_aulas_completar_distribucion(
    list(as.list(.mdc_cab()), .mdc_fila_manual("CH 7", estado = "POR APLICAR")),
    plan = list(.mdc_unidad("CH 7")),
    filas_ahora = .mdc_hoja(.mdc_fila("CH 1", "10/09", "Alguien"))
  )
  expect_identical(out$filas[[1]]$clase, "anadida")
})

test_that("un código que no está en el plan se declara y NO se completa", {
  # Completarlo sería inventarle facultad y docente a un aula que no existe.
  out <- monitoreo_aulas_completar_distribucion(
    list(as.list(.mdc_cab()), .mdc_fila_manual("CH 999")),
    plan = list(.mdc_unidad("CH 7")),
    filas_ahora = NULL
  )
  expect_identical(out$filas[[1]]$clase, "desconocida")
  expect_false(out$filas[[1]]$completada)
  expect_identical(.mdc_de(out$filas[[1]]$fila, "FACULTAD"), "")
})

test_that("la fila que ya venía completa del reparto no se toca ni se reclasifica", {
  completa <- .mdc_fila("CH 7", "10/09", "Alguien")
  v <- as.character(unlist(completa, use.names = FALSE))
  v[[which(.mdc_cab() == "ESTADO")[[1]]]] <- "POR APLICAR"
  v[[which(.mdc_cab() == "AULA")[[1]]]] <- "L318"
  v[[which(.mdc_cab() == "FACULTAD")[[1]]]] <- "Letras"
  v[[which(.mdc_cab() == "CURSO")[[1]]]] <- "LÓGICA"
  v[[which(.mdc_cab() == "DOCENTE")[[1]]]] <- "Castillo Gamboa, Edgar"
  v[[which(.mdc_cab() == "DÍA")[[1]]]] <- "Jueves"
  out <- monitoreo_aulas_completar_distribucion(
    list(as.list(.mdc_cab()), as.list(v)),
    plan = list(.mdc_unidad("CH 7")),
    filas_ahora = .mdc_hoja(as.list(v))
  )
  expect_identical(out$filas[[1]]$clase, "publicada")
  expect_false(out$filas[[1]]$completada)
  expect_equal(out$resumen$completadas, 0L)
})

test_that("la hoja publica el ESTADO de cada cita y su desplegable", {
  reqs <- aulas_libro_plan_aplicadores_formato_requests(
    7L, list(as.list(.mdc_cab()), .mdc_fila("CH 1", "08/09", "Alguien")),
    roster = list("Alguien"))
  dv <- Filter(function(r) identical(names(r)[[1]], "setDataValidation"), reqs)
  # Dos desplegables: el del aplicador y el del estado.
  expect_length(dv, 2L)
  estado <- Filter(function(r) {
    identical(r$setDataValidation$range$startColumnIndex,
              as.integer(which(.mdc_cab() == "ESTADO") - 1L))
  }, dv)
  expect_length(estado, 1L)
  opciones <- vapply(estado[[1]]$setDataValidation$rule$condition$values,
                     function(v) v$userEnteredValue, character(1))
  expect_identical(opciones, MONITOREO_AULAS_ESTADOS_DISTRIBUCION)
})

# --- La pestaña se localiza por su CABECERA, no por su nombre -----------------
#
# El 2026-09-08 el documento del operativo tenía UNA pestaña, llamada «Semana 1»
# —Gonzalo: «cada hoja va a ser por semana»— con las ochenta y seis citas que el
# coordinador llevaba dos días editando. La app buscaba «Plan del día», no la
# encontraba, y declaraba el documento vacío sin equivocarse en nada de lo que
# miraba: `citas_remotas: 0`, `hoja_presente: false`. Publicar encima habría
# creado una segunda pestaña y dejado su trabajo fuera del mapa.

test_that("la distribución se encuentra aunque la pestaña se llame por semana", {
  mock <- .sheets_api_mock()
  # Una sola pestaña, con el nombre que le puso el equipo y la cabecera que
  # escribió la app.
  mock$seed("Semana 1", values = c(list(as.list(.mdc_cab())),
                                   list(.mdc_fila_manual("CH 7", fecha = "07/09"))))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  out <- monitoreo_aulas_leer_distribucion("sheet_dist")
  expect_true(isTRUE(out$hoja_presente))
  expect_identical(out$hoja, "Semana 1")
  expect_true(isTRUE(out$cabecera_legible))
  expect_equal(out$citas_remotas, 1L)
  # Y no se declara ajena a sí misma.
  expect_false("Semana 1" %in% as.character(unlist(out$pestanas_ajenas %||% list())))
})

test_that("una pestaña sin forma de distribución no se confunde con ella", {
  # El documento puede tener notas, un cuadro del coordinador o una pestaña de
  # otra cosa. Sólo cuenta la que trae las dos columnas que hacen legible una
  # distribución; sin ninguna, se dice que no hay hoja en vez de leer basura.
  mock <- .sheets_api_mock()
  mock$seed("Apuntes", values = list(list("cosas", "que", "anoté")))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  out <- monitoreo_aulas_leer_distribucion("sheet_dist")
  expect_false(isTRUE(out$hoja_presente))
  expect_equal(out$citas_remotas, 0L)
  expect_true("Apuntes" %in% as.character(unlist(out$pestanas_ajenas %||% list())))
})

test_that("los cuatro estados tienen color, y «POR APLICAR» es amarillo", {
  # Dictado del 2026-09-08 con el documento del coordinador delante: «APLICADA
  # (VERDE), POR APLICAR (AMARILLO) Y REAGENDADA (NARANJA U OTRO COLOR)». «POR
  # APLICAR» iba sin color; en un documento que se abre para saber qué queda por
  # hacer, una celda sin pintar no se distingue de una sin llenar.
  colores <- prosecnurapp:::.alpa_COLOR_ESTADO
  expect_setequal(names(colores), MONITOREO_AULAS_ESTADOS_DISTRIBUCION)
  canal <- function(estado, i) grDevices::col2rgb(colores[[estado]])[i, 1]
  # Verde: más verde que rojo y que azul.
  expect_gt(canal("APLICADA", 2), canal("APLICADA", 1))
  expect_gt(canal("APLICADA", 2), canal("APLICADA", 3))
  # Amarillo: rojo y verde altos, azul bajo.
  expect_gt(canal("POR APLICAR", 1), 230)
  expect_gt(canal("POR APLICAR", 2), 230)
  expect_lt(canal("POR APLICAR", 3), 220)
  # Naranja: rojo alto, verde medio, azul bajo, y distinguible del amarillo.
  expect_gt(canal("REAGENDADA", 1), 230)
  expect_lt(canal("REAGENDADA", 2), canal("POR APLICAR", 2))
  expect_lt(canal("REAGENDADA", 3), 160)
})

# --- Con una pestaña por semana, leer una sola es leer medio documento -------
#
# Desde el 2026-09-11 la app escribe «Semana 1», «Semana 2»… Quedarse con la
# primera haría que el comparador declarara «faltan» todas las citas de las
# demás: el mismo falso negativo que costó dos días cuando buscaba la pestaña
# por su nombre, ahora por quedarse con la primera que encuentra.

test_that("leer la distribución suma las citas de todas las pestañas semanales", {
  mock <- .sheets_api_mock()
  cab <- as.list(prosecnurapp:::.alpa_CABECERA)
  fila <- function(cod, fecha) as.list(c("Ana Prueba", "Lunes", fecha, "09:30", "09:45",
                                         "10:00 a 10:30", cod, "A101", "Ciencias",
                                         "Cálculo", "Docente Uno", "POR APLICAR"))
  mock$seed("Semana 1", values = list(cab, fila("CH 1", "07/09")))
  mock$seed("Semana 2", values = list(cab, fila("CH 3", "14/09")))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  filas_ahora <- list(cab, fila("CH 1", "07/09"), fila("CH 3", "14/09"))
  out <- monitoreo_aulas_leer_distribucion("sheet_dist", filas = filas_ahora)
  expect_identical(out$citas_remotas, 2L)
  expect_length(out$faltan, 0L)
  expect_length(out$sobran, 0L)
  expect_true(isTRUE(out$coincide))
})

test_that("las pestañas semanales se ordenan por número, no alfabéticamente", {
  # «Semana 10» < «Semana 2» en orden alfabético: sin ordenar por el número, la
  # pestaña que encabeza el recibo sería la equivocada en cuanto el operativo
  # pase de nueve semanas.
  hojas <- prosecnurapp:::.madc_pestanas_de_la_distribucion(
    "id", c("Semana 10", "Semana 2", "Semana 1"))
  expect_identical(hojas, c("Semana 1", "Semana 2", "Semana 10"))
})

# --- una pestaña de la app no es una pestaña ajena ----------------------------
#
# Desde `83d98403` el documento lleva UNA PESTAÑA POR SEMANA. El lector restaba
# las ajenas contra `hoja` —la PRIMERA— así que «Semana 2» salía declarada
# ajena: la etiqueta que significa «esto no es nuestro, no lo toques». Y el
# publicador leía las filas del equipo de esa misma primera pestaña, dejando
# fuera del análisis todo lo que alguien escribiera en la semana 2.
test_that("con varias semanas, ninguna hoja de la app se declara ajena", {
  mock <- .sheets_api_mock()
  mock$seed("Semana 1", values = c(list(as.list(.mdc_cab())),
                                   list(.mdc_fila_manual("CH 7", fecha = "07/09"))))
  mock$seed("Semana 2", values = c(list(as.list(.mdc_cab())),
                                   list(.mdc_fila_manual("CH 9", fecha = "14/09"))))
  mock$seed("Apuntes", values = list(list("cosas", "que", "anoté")))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  out <- monitoreo_aulas_leer_distribucion("sheet_dist")

  ajenas <- as.character(unlist(out$pestanas_ajenas %||% list()))
  expect_false("Semana 1" %in% ajenas)
  expect_false("Semana 2" %in% ajenas)
  expect_true("Apuntes" %in% ajenas)
  # Y el recibo entrega la LISTA, no sólo la primera: quien vaya a leer el
  # documento entero la necesita.
  expect_identical(as.character(unlist(out$hojas %||% list())), c("Semana 1", "Semana 2"))
  expect_identical(out$hoja, "Semana 1")
  # Las citas de las dos semanas cuentan: apilar es lo que hace que «faltan» no
  # invente huecos.
  expect_equal(out$citas_remotas, 2L)
})

test_that("el apilado junta todas las semanas bajo una sola cabecera", {
  llamadas <- character(0)
  testthat::local_mocked_bindings(
    .cads_valores_de_pestana = function(id, pestana) {
      llamadas <<- c(llamadas, pestana)
      if (identical(pestana, "Semana 3")) stop("cuota")
      list(as.list(.mdc_cab()),
           .mdc_fila_manual(sprintf("CH %s", sub("^Semana ", "", pestana)), fecha = "07/09"))
    }
  )
  out <- monitoreo_aulas_distribucion_valores("id", list("Semana 1", "Semana 2", "Semana 3"))
  # Una cabecera y una fila por semana legible: la de la 2 NO arrastra su
  # cabecera, que sería una fila fantasma sin curso-horario.
  expect_length(out, 3L)
  expect_identical(as.character(out[[1]][[1]]), as.character(.mdc_cab()[[1]]))
  codigos <- vapply(out[-1], function(f) as.character(unlist(f))[
    which(as.character(.mdc_cab()) == "CURSO-HORARIO")], character(1))
  expect_setequal(codigos, c("CH 1", "CH 2"))
  # Y la que no se deja leer se salta sin tumbar a las demás: una cuota de
  # Google no convierte «tengo dos semanas» en «no tengo nada».
  expect_identical(llamadas, c("Semana 1", "Semana 2", "Semana 3"))
})

# --- adoptar congela TODAS las semanas, no la primera -------------------------
#
# Adoptar es lo que impide que el sorteo mueva asignaciones ya comunicadas:
# cada fila del documento se vuelve una fijación. Desde que hay una pestaña por
# semana, leer sólo «Semana 1» dejaba la semana 2 sin fijar —ya leída por las
# diecinueve personas— y una republicación podía reordenarla. Es exactamente el
# defecto que la adopción existe para impedir, reaparecido por el lado del
# plural.
test_that("la adopción fija lo escrito en todas las semanas", {
  pedidas <- character(0)
  testthat::local_mocked_bindings(
    .monitoreo_sheets_metadata = function(id) list(
      spreadsheetId = id, properties = list(title = "Distribución"),
      sheets = list(list(properties = list(title = "Semana 1")),
                    list(properties = list(title = "Semana 2")))
    ),
    .cads_valores_de_pestana = function(id, pestana) {
      pedidas <<- c(pedidas, pestana)
      codigo <- if (identical(pestana, "Semana 2")) "CH 9" else "CH 1"
      quien <- if (identical(pestana, "Semana 2")) "Berta Ficticia" else "Ana Prueba"
      list(as.list(.mdc_cab()), .mdc_fila(codigo, "08/09", quien))
    }
  )
  plan <- list(list(operational_code = "CH 1", sample_role = "titular"),
               list(operational_code = "CH 9", sample_role = "titular"))
  ad <- prosecnurapp:::.malp_adoptar_distribucion(
    list(distribucion_sheets = list(spreadsheet_id = "sheet_dist")),
    plan,
    list(monitoreo_aulas_disponibilidad = list(
      list(nombre = "Ana Prueba"), list(nombre = "Berta Ficticia")))
  )
  expect_true(isTRUE(ad$ok))
  # Las dos semanas se leyeron y las dos citas quedaron fijadas.
  expect_true(all(c("Semana 1", "Semana 2") %in% pedidas))
  expect_setequal(names(ad$fijadas), c("CH 1", "CH 9"))
  # Y el recibo dice en cuáles: «Semana 1» a secas contaría la mitad.
  expect_identical(as.character(unlist(ad$hojas)), c("Semana 1", "Semana 2"))
})
