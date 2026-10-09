
test_that("un parte sin fecha ni aplicador no basta si Kobo no tiene nada", {
  # Gonzalo, 2026-09-18: «la fuente de verdad es Kobo —y es la fuente de verdad
  # la que cuenta las efectivas siempre en TODA LA APP—, el parte de la ficha
  # solo reporta lo que los aplicadores ven»; «me preocupa que hayan pensado que
  # se aplicó CH 3 cuando jamás se aplicó, sino que fue un caso A y se aplicó
  # R 3.1, y todos los Sheets dan evidencia de eso».
  #
  # CH 3 tenía un parte con «APLICADA» y ni fecha, ni aplicador, ni una sola
  # respuesta en Kobo, tomado en un aula que no era la suya. Con eso contaba
  # entre las que fueron a campo, contra Kobo (0 respuestas), el Sheets (sin
  # aula utilizada ni fecha agendada) y el plan (`en_contacto`).
  unidades <- list(list(operational_code = "CH 3", classroom_id = "CH 3",
                        application_status = ""))
  sin_firma <- list(list(operational_code = "CH 3", application_status = "APLICADA",
                         observed_students = 15, duplicates = 4, effective_surveys = 0))
  expect_false(monitoreo_aulas_aula_aplicada(
    unidades, partes = sin_firma, efectivas = c("CH 3" = 0)))
})

test_that("un parte FIRMADO sí basta aunque no recogiera nada", {
  # Hay aulas que fueron y volvieron con cero porque todos habían respondido ya:
  # CH 130 con 15 duplicados, CH 166 con 21. Son campo gastado y cuentan.
  unidades <- list(list(operational_code = "CH 130", classroom_id = "CH 130",
                        application_status = ""))
  con_fecha <- list(list(operational_code = "CH 130", application_status = "APLICADA",
                         applied_date = "2026-09-15", effective_surveys = 0))
  expect_true(monitoreo_aulas_aula_aplicada(
    unidades, partes = con_fecha, efectivas = c("CH 130" = 0)))
  con_aplicador <- list(list(operational_code = "CH 130", application_status = "APLICADA",
                             applied_by = "Simon Cosme, Jhonny Cesar",
                             effective_surveys = 0))
  expect_true(monitoreo_aulas_aula_aplicada(
    unidades, partes = con_aplicador, efectivas = c("CH 130" = 0)))
})

test_that("con efectivas en Kobo se aplica, firmado o no", {
  # Kobo manda: una respuesta obtenida es prueba directa de que ese salón se
  # aplicó, y no necesita que el parte diga nada.
  unidades <- list(list(operational_code = "R 3.1", classroom_id = "R 3.1",
                        application_status = ""))
  expect_true(monitoreo_aulas_aula_aplicada(unidades, partes = list(),
                                            efectivas = c("R 3.1" = 5)))
  sin_firma <- list(list(operational_code = "R 3.1", application_status = ""))
  expect_true(monitoreo_aulas_aula_aplicada(unidades, partes = sin_firma,
                                            efectivas = c("R 3.1" = 5)))
})
