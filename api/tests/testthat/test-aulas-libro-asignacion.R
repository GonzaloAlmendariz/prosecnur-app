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
  # El día con su unidad correcta (dictado 2026-09-03: «no son citas, son
  # aplicaciones») y el croquis en corto para no repetir la palabra.
  expect_match(texto, "Viernes 11/09")
  # Dictado 2026-09-04 («basta de los em dashes»): el separador del día y de
  # su croquis es el punto medio de la casa.
  expect_match(texto, "aplicaciones · 1 en A")
  expect_no_match(texto, "Viernes 11/09 —")
  # El reparto del MISMO motor: empate 0-0 lo gana el alfabeto.
  expect_match(texto, "Ana Prueba")
  expect_match(texto, "Berta Ficticia")
  # La secuencia completa de la cita: recojo, salida y aplicación con FIN.
  expect_match(texto, "09:30")             # recojo de la cita de las 10:00
  # Y el rango de la aplicación se lee «de X a Y», como en la vista.
  expect_match(texto, "10:00 a 10:30")
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
  expect_match(texto, "fijada a mano")
  expect_match(texto, "10:00 a 10:45")
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
  expect_true(which(grepl("^Viernes 11/09", primeras))[1] %in% filas_banda)
  expect_true(which(primeras == "CURSO-HORARIO")[1] %in% filas_banda)
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
  expect_identical(length(centrados), 2L)
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
