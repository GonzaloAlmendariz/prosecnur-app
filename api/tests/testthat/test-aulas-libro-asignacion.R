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
  # El día con su croquis en palabras (B79, nunca «A×1»).
  expect_match(texto, "Viernes 11/09")
  expect_match(texto, "1 aplicación en A")
  # El reparto del MISMO motor: empate 0-0 lo gana el alfabeto.
  expect_match(texto, "Ana Prueba")
  expect_match(texto, "Berta Ficticia")
  # La secuencia completa de la cita: recojo, salida y aplicación con FIN.
  expect_match(texto, "09:30")             # recojo de la cita de las 10:00
  expect_match(texto, "10:00–10:30")
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
  expect_match(texto, "10:00–10:45")
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

  # Cada request es un repeatCell acotado a formato (no toca values).
  for (r in reqs) {
    expect_identical(r$repeatCell$fields, "userEnteredFormat(backgroundColor,textFormat)")
  }
  # El título (fila 1) lleva la banda navy de la casa.
  filas_banda <- vapply(reqs, function(r) r$repeatCell$range$startRowIndex + 1L, integer(1))
  expect_true(1L %in% filas_banda)
  # El día (título de bloque), la cabecera de tabla y la alerta de fuera de
  # rango también ganan banda — derivadas del contenido, no de números mágicos.
  primeras <- vapply(vals, function(row) trimws(as.character(row[[1]] %||% "")), character(1))
  expect_true(which(grepl("^Viernes 11/09", primeras))[1] %in% filas_banda)
  expect_true(which(primeras == "CURSO-HORARIO")[1] %in% filas_banda)
  expect_true(which(grepl("^FUERA DEL RANGO", primeras))[1] %in% filas_banda)
  expect_true(which(primeras == "CARGAS POR APLICADOR")[1] %in% filas_banda)
  # Las notas no se tiñen: el protocolo (fila 3) no lleva banda.
  expect_false(3L %in% filas_banda)
})
