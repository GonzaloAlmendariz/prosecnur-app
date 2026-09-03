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
