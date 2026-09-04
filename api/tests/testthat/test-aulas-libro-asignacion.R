# La hoja «Asignación de aplicadores» del libro (B68, dictado 2026-09-03):
# la doble escritura del reparto — el mismo motor y la misma configuración
# que la pestaña de Asignación de la app.

.tla_fila <- function(codigo, fecha = "", hora = "", venue = "") {
  list(operational_code = codigo, classroom_id = tolower(gsub(" ", "", codigo)),
       sample_role = "titular", operational_status = "agendada",
       scheduled_date = fecha, scheduled_time = hora, scheduled_venue = venue,
       faculty = "DERECHO", teacher = "Docente Prueba")
}

.tla_disp <- function(nombre) {
  list(nombre = nombre, dias = stats::setNames(
    rep(list(list(list(inicio = "08:00", fin = "22:00"))), 6L),
    c("lunes", "martes", "miercoles", "jueves", "viernes", "sabado")
  ))
}

.tla_libro <- function(plan, disponibilidad = NULL, cfg = list()) {
  destino <- tempfile(fileext = ".xlsx")
  aulas_libro_generar(plan, destino, cfg = cfg, disponibilidad = disponibilidad)
  destino
}

test_that("B68: con disponibilidad, el libro lleva la hoja con el reparto de la app", {
  plan <- list(
    .tla_fila("CH 1", fecha = "2026-09-11", hora = "10:00", venue = "A703"),
    .tla_fila("CH 2", fecha = "2026-09-11", hora = "15:00", venue = "J308"),
    .tla_fila("CH 3", fecha = "2026-09-18")
  )
  destino <- .tla_libro(plan, disponibilidad = list(.tla_disp("Ana Prueba"),
                                                    .tla_disp("Berta Ficticia")))
  hojas <- openxlsx::getSheetNames(destino)
  expect_true("Asignación de aplicadores" %in% hojas)

  celdas <- openxlsx::read.xlsx(destino, sheet = "Asignación de aplicadores",
                                colNames = FALSE, skipEmptyRows = FALSE)
  texto <- paste(unlist(lapply(celdas, as.character)), collapse = " | ")
  # El protocolo va EN la hoja, no como folclore del equipo.
  expect_match(texto, "Materiales se recogen 30 min antes")
  # La hoja gira alrededor del APLICADOR desde el 2026-09-04 («asignación debe
  # estar centrada en torno al aplicador: lo que tiene, a cuántas aulas va, en
  # qué días y qué días tiene que estar en oficina»). El recorrido por jornada
  # vive en «Plan del día», que es la operativa.
  expect_match(texto, "QUÉ LE TOCA A CADA APLICADOR", fixed = TRUE)
  expect_match(texto, "EN OFICINA", fixed = TRUE)
  expect_match(texto, "SALE A APLICAR", fixed = TRUE)
  expect_match(texto, "TERMINA", fixed = TRUE)
  # Su día, con la etiqueta de la casa.
  expect_match(texto, "Viernes 11/09")
  # El reparto del MISMO motor: empate 0-0 lo gana el alfabeto.
  expect_match(texto, "Ana Prueba")
  expect_match(texto, "Berta Ficticia")
  # La jornada de punta a punta: entra a la oficina con el primer recojo.
  expect_match(texto, "09:30")
  # La fecha sin hora se declara, no se traga.
  expect_match(texto, "Por confirmar")
  # La equidad, dicha, con el mismo criterio del rail.
  expect_match(texto, "CARGAS POR APLICADOR")
  expect_match(texto, "Reparto parejo")
})

test_that("B68: la configuración vigente manda — fijadas, duración y semilla entran a la hoja", {
  plan <- list(.tla_fila("CH 1", fecha = "2026-09-11", hora = "10:00", venue = "A703"))
  destino <- .tla_libro(
    plan,
    disponibilidad = list(.tla_disp("Ana Prueba"), .tla_disp("Berta Ficticia")),
    cfg = list(reparto_fijado = list("CH 1" = "Berta Ficticia"),
               duracion_aplicacion_min = 45L, reparto_semilla = 3L)
  )
  celdas <- openxlsx::read.xlsx(destino, sheet = "Asignación de aplicadores",
                                colNames = FALSE, skipEmptyRows = FALSE)
  texto <- paste(unlist(lapply(celdas, as.character)), collapse = " | ")
  # «FIJADA» dejó de ser columna el 2026-09-04 («no entiendo a qué se refiere
  # con fijada y aviso; siento que debería mostrar el estatus de aplicación»):
  # era contabilidad de la app y salía vacía en toda la hoja. La marca de puesta
  # a mano se queda en la app, que es donde se pone y se deshace; lo que la
  # config fijada sigue probando aquí es que la cita la aplica QUIEN se fijó.
  # La cita la aplica QUIEN se fijó, y su jornada sale con el estado inicial.
  expect_match(texto, "Berta Ficticia", fixed = TRUE)
  expect_match(texto, "POR APLICAR", fixed = TRUE)
  # La duración del config se ve en el fin de la jornada.
  expect_match(texto, "10:45", fixed = TRUE)
  expect_match(texto, "Sorteo: n")
})

test_that("B68: sin disponibilidad NO hay hoja — una vacía se leería como «nadie asignado»", {
  plan <- list(.tla_fila("CH 1", fecha = "2026-09-11", hora = "10:00"))
  destino <- .tla_libro(plan, disponibilidad = NULL)
  expect_false("Asignación de aplicadores" %in% openxlsx::getSheetNames(destino))
})

test_that("B68: el formato de Sheets calca la estética de las otras hojas — bandas derivadas del contenido", {
  plan <- list(
    .tla_fila("CH 1", fecha = "2026-09-11", hora = "10:00", venue = "A703"),
    .tla_fila("CH 3", fecha = "2026-09-18")
  )
  vals <- aulas_libro_valores_asignacion(
    plan, list(.tla_disp("Ana Prueba")),
    cfg = list(reparto_rango = list(desde = "2026-09-07", hasta = "2026-09-13"))
  )
  reqs <- aulas_libro_asignacion_formato_requests(7L, vals)
  expect_gt(length(reqs), 3L)

  # Cada request toca SOLO formato o geometría (jamás values ni
  # dataValidation): repeatCell acotado a userEnteredFormat o un ancho/alto
  # de dimensión acotado a pixelSize.
  for (r in reqs) {
    if (!is.null(r$repeatCell)) {
      expect_true(startsWith(r$repeatCell$fields, "userEnteredFormat("))
    } else {
      expect_identical(r$updateDimensionProperties$fields, "pixelSize")
    }
  }
  bandas <- Filter(function(r) {
    !is.null(r$repeatCell) && grepl("backgroundColor", r$repeatCell$fields)
  }, reqs)
  filas_banda <- vapply(bandas, function(r) r$repeatCell$range$startRowIndex + 1L, integer(1))
  # El título (fila 1) lleva la banda navy de la casa, a 13 pt y con aire
  # (alto de fila propio).
  expect_true(1L %in% filas_banda)
  titulo <- bandas[[which(filas_banda == 1L)[1]]]
  expect_identical(titulo$repeatCell$cell$userEnteredFormat$textFormat$fontSize, 13L)
  altos <- Filter(function(r) {
    !is.null(r$updateDimensionProperties) &&
      identical(r$updateDimensionProperties$range$dimension, "ROWS")
  }, reqs)
  expect_true(0L %in% vapply(altos, function(r) r$updateDimensionProperties$range$startIndex, integer(1)))
  # El día (título de bloque), la cabecera de tabla y la alerta de fuera de
  # rango también ganan banda — derivadas del contenido, no de números mágicos.
  primeras <- vapply(vals, function(row) trimws(as.character(row[[1]] %||% "")), character(1))
  # Desde el 2026-09-04 los bloques son los del aplicador; el recorrido por
  # jornada vive en «Plan del día».
  expect_true(which(primeras == "QUÉ LE TOCA A CADA APLICADOR")[1] %in% filas_banda)
  expect_true(which(primeras == "APLICADOR")[1] %in% filas_banda)
  expect_true(which(grepl("^FUERA DEL RANGO", primeras))[1] %in% filas_banda)
  expect_true(which(primeras == "CARGAS POR APLICADOR")[1] %in% filas_banda)
  # Las notas van en el gris pequeño e itálico del xlsx (el protocolo es la
  # fila 3): un aparte, no un dato — y jamás en navy.
  nota <- bandas[[which(filas_banda == 3L)[1]]]
  fmt_nota <- nota$repeatCell$cell$userEnteredFormat
  expect_identical(fmt_nota$textFormat$fontSize, 9L)
  expect_true(isTRUE(fmt_nota$textFormat$italic))
  expect_false(isTRUE(fmt_nota$textFormat$bold))
  # Una fila-DATO no se tiñe: el reparto se lee sobre blanco.
  fila_dato <- which(grepl("^CH ", primeras))[1]
  if (!is.na(fila_dato)) expect_false(fila_dato %in% filas_banda)
})

test_that("B68: la hoja publica sus anchos del xlsx y centra las horas", {
  plan <- list(.tla_fila("CH 1", fecha = "2026-09-11", hora = "10:00", venue = "A703"))
  vals <- aulas_libro_valores_asignacion(plan, list(.tla_disp("Ana Prueba")))
  reqs <- aulas_libro_asignacion_formato_requests(7L, vals)

  # Los anchos cubren las 8 columnas de la tabla, por rangos agrupados.
  anchos <- Filter(function(r) {
    !is.null(r$updateDimensionProperties) &&
      identical(r$updateDimensionProperties$range$dimension, "COLUMNS")
  }, reqs)
  expect_gte(length(anchos), 3L)
  cubiertas <- rep(FALSE, 8L)
  for (a in anchos) {
    rg <- a$updateDimensionProperties$range
    expect_gt(a$updateDimensionProperties$properties$pixelSize, 0L)
    cubiertas[seq.int(rg$startIndex + 1L, min(8L, rg$endIndex))] <- TRUE
  }
  expect_true(all(cubiertas))

  # RECOJO/SALE/APLICACIÓN y FIJADA van centradas a toda la altura publicada.
  centrados <- Filter(function(r) {
    !is.null(r$repeatCell) &&
      identical(r$repeatCell$fields, "userEnteredFormat(horizontalAlignment)")
  }, reqs)
  # Un solo tramo centrado desde que FIJADA salió: las tres horas.
  expect_identical(length(centrados), 1L)
  for (ctr in centrados) {
    expect_identical(ctr$repeatCell$cell$userEnteredFormat$horizontalAlignment, "CENTER")
    expect_identical(ctr$repeatCell$range$endRowIndex, length(vals))
  }
})

# **El nombre del aplicador se escribe como se escribe un nombre.**
#
# Dictado 2026-09-04: «el nombre normalizado: apellido, coma, nombre y nombre.
# Y SIEMPRE tiene que ser así». Ese «siempre» incluye el libro y el Sheets, que
# es lo que el equipo de campo lee: la vista ya normalizaba y aquí salía crudo.
test_that("la hoja escribe el nombre normalizado, no el crudo del libro", {
  plan <- list(.tla_fila("CH 1", fecha = "2026-09-11", hora = "10:00", venue = "A703"))
  destino <- .tla_libro(
    plan,
    disponibilidad = list(.tla_disp("Castillo SOLORSANO , LEIDY VIVIANA"))
  )
  celdas <- openxlsx::read.xlsx(destino, sheet = "Asignación de aplicadores",
                                colNames = FALSE, skipEmptyRows = FALSE)
  texto <- paste(unlist(lapply(celdas, as.character)), collapse = " | ")
  expect_match(texto, "Castillo Solorsano, Leidy Viviana", fixed = TRUE)
  # Ni en la tabla del día ni en el bloque de cargas queda el crudo.
  expect_no_match(texto, "SOLORSANO", fixed = TRUE)
})

test_that("aulas_nombre_aplicador es el espejo del normalizador del frontend", {
  # Los mismos casos que `nombreDeAplicador.test.ts`: si alguien cambia un
  # lado, este test o el suyo lo delata.
  expect_equal(aulas_nombre_aplicador("PANTA GUTIERREZ, PERCY AARÓN"),
               "Panta Gutierrez, Percy Aarón")
  expect_equal(aulas_nombre_aplicador("Castillo SOLORSANO , LEIDY VIVIANA"),
               "Castillo Solorsano, Leidy Viviana")
  expect_equal(aulas_nombre_aplicador("Uribe Olaechea , Jesús Ramiro"),
               "Uribe Olaechea, Jesús Ramiro")
  expect_equal(aulas_nombre_aplicador("Álvarez Espinosa Saldaña, José Alejandro"),
               "Álvarez Espinosa Saldaña, José Alejandro")
  # La partícula se agacha, salvo cuando abre su bloque.
  expect_equal(aulas_nombre_aplicador("RAMOS DE LA CRUZ, JUAN"), "Ramos de la Cruz, Juan")
  expect_equal(aulas_nombre_aplicador("DE LA CRUZ RAMOS, JUAN"), "De la Cruz Ramos, Juan")
  expect_equal(aulas_nombre_aplicador("D'ANGELO ROJAS, ANA-MARÍA"), "D'Angelo Rojas, Ana-María")
  # Sin coma no reordena; el vacío no inventa un guion.
  expect_equal(aulas_nombre_aplicador("JUAN PEREZ"), "Juan Perez")
  expect_equal(aulas_nombre_aplicador(""), "")
  expect_equal(aulas_nombre_aplicador(NULL), "")
  expect_equal(aulas_nombre_aplicador("   "), "")
})

# **La hoja gira alrededor del aplicador** (dictado 2026-09-04: «asignación
# debe estar centrada en torno al aplicador: lo que tiene el aplicador, a
# cuántas aulas va, en qué días y qué días tiene que estar en oficina»).
#
# La facultad y el detalle cita a cita salieron de aquí a propósito: viven en
# «Plan del día», que es la hoja operativa. Dos hojas diciendo lo mismo era el
# defecto que esta división corrige.
test_that("una fila por aplicador y día, con su jornada de punta a punta", {
  plan <- list(
    .tla_fila("CH 1", fecha = "2026-09-11", hora = "10:00", venue = "A703"),
    .tla_fila("CH 2", fecha = "2026-09-11", hora = "16:00", venue = "J308")
  )
  filas <- aulas_libro_filas_asignacion(plan, list(.tla_disp("Ana Prueba")))
  datos <- Filter(function(f) identical(f$tipo, "dato"), filas)
  jornada <- datos[[1]]$celdas
  expect_equal(jornada[[1]], "Ana Prueba")
  expect_equal(jornada[[2]], "Viernes 11/09")
  expect_equal(jornada[[3]], "2")            # a cuántas aulas va ese día
  expect_equal(jornada[[4]], "09:30")        # en oficina: su primer recojo
  expect_equal(jornada[[5]], "09:45")        # sale a aplicar
  expect_equal(jornada[[6]], "16:30")        # termina con la última
  expect_match(jornada[[7]], "CH 1 (A703)", fixed = TRUE)
  expect_match(jornada[[7]], "CH 2 (J308)", fixed = TRUE)
  expect_equal(jornada[[8]], "POR APLICAR")
})

test_that("dos días de la misma persona son dos filas, no una", {
  plan <- list(
    .tla_fila("CH 1", fecha = "2026-09-11", hora = "10:00"),
    .tla_fila("CH 2", fecha = "2026-09-18", hora = "10:00")
  )
  filas <- aulas_libro_filas_asignacion(plan, list(.tla_disp("Ana Prueba")))
  datos <- Filter(function(f) identical(f$tipo, "dato"), filas)
  jornadas <- Filter(function(f) length(f$celdas) >= 8L, datos)
  expect_length(jornadas, 2L)
  expect_equal(vapply(jornadas, function(f) f$celdas[[2]], character(1)),
               c("Viernes 11/09", "Viernes 18/09"))
})

# **Los anchos y el centrado siguen a la columna, no a un número congelado.**
#
# Al entrar FACULTAD (dictado 2026-09-04) la hoja pasó de ocho columnas a
# nueve, y el centrado que apuntaba a 2..5 y 6..7 empezaba a centrar LUGAR y
# APLICADOR, que son justo las que no se centran. Se fija aquí porque es el
# tipo de descuadre que sólo se ve abriendo el Sheets.
test_that("el centrado apunta a las cifras de la jornada, no a los textos", {
  plan <- list(.tla_fila("CH 1", fecha = "2026-09-11", hora = "10:00", venue = "A703"))
  vals <- aulas_libro_valores_asignacion(plan, list(.tla_disp("Ana Prueba")))
  # Ocho columnas: aplicador, día, aulas, tres horas, sus cursos y el estado.
  expect_equal(max(vapply(vals, length, integer(1))), 8L)

  reqs <- aulas_libro_asignacion_formato_requests(7L, vals)
  centrados <- Filter(function(r) {
    !is.null(r$repeatCell) && grepl("horizontalAlignment", r$repeatCell$fields %||% "")
  }, reqs)
  tramos <- lapply(centrados, function(r) c(r$repeatCell$range$startColumnIndex,
                                            r$repeatCell$range$endColumnIndex))
  # AULAS y las tres horas de la jornada son las columnas 3 a 6 (índices 2..6).
  tiene <- function(desde, hasta) any(vapply(tramos, function(t)
    identical(as.integer(t), c(desde, hasta)), logical(1)))
  expect_true(tiene(2L, 6L))
  # Ni el nombre ni la lista de aulas ni el estado se centran: son textos.
  expect_false(tiene(0L, 2L))
  expect_false(tiene(6L, 8L))
})
