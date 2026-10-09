# **La adopción envejece en silencio.**
#
# El 2026-09-09 la app llevaba 86 fijaciones adoptadas en algún momento anterior
# y el coordinador había movido 11 citas desde entonces. La pestaña de
# Asignación enseñaba el reparto de la app como si fuera el de la hoja y NADA lo
# decía: la única forma de enterarse era abrir el Sheets y comparar a ojo.
#
# Lo que se sujeta aquí: qué enciende el aviso y qué no, y que la comparación
# aguante los nombres tal como el equipo los teclea.

test_that("una cita con otro aplicador en la hoja es la que enciende el aviso", {
  out <- monitoreo_aulas_fijaciones_desfasadas(
    guardadas = list("CH 117" = "Aguilar Cuya, Renzo Mariano"),
    en_la_hoja = list("CH 117" = "Simon Cosme, Jhonny Cesar")
  )
  expect_true(out$hay)
  expect_length(out$cambiadas, 1L)
  expect_identical(out$cambiadas[[1]]$curso_horario, "CH 117")
  expect_identical(out$cambiadas[[1]]$guardado, "Aguilar Cuya, Renzo Mariano")
  expect_identical(out$cambiadas[[1]]$en_la_hoja, "Simon Cosme, Jhonny Cesar")
})

test_that("una cita NUEVA en la hoja no enciende el aviso: no contradice a la app", {
  # Encender por las tres clases haría saltar el aviso cada día del operativo y
  # dejaría de leerse justo cuando importe.
  out <- monitoreo_aulas_fijaciones_desfasadas(
    guardadas = list("CH 1" = "Ana Prueba"),
    en_la_hoja = list("CH 1" = "Ana Prueba", "CH 2" = "Berta Ficticia")
  )
  expect_false(out$hay)
  expect_identical(unlist(out$nuevas), "CH 2")
  expect_length(out$cambiadas, 0L)
})

test_that("una cita que la hoja ya no menciona se declara y no se toca", {
  out <- monitoreo_aulas_fijaciones_desfasadas(
    guardadas = list("CH 1" = "Ana Prueba", "CH 9" = "Ana Prueba"),
    en_la_hoja = list("CH 1" = "Ana Prueba")
  )
  expect_false(out$hay)
  expect_identical(unlist(out$retiradas), "CH 9")
})

test_that("el mismo nombre tecleado distinto NO es un cambio", {
  # La hoja del operativo trae «Castillo SOLORSANO , LEIDY VIVIANA» donde la app
  # guarda «Castillo Solorsano, Leidy Viviana». Contarlas como distintas
  # llenaría el aviso de falsos y lo volvería ilegible en un día.
  out <- monitoreo_aulas_fijaciones_desfasadas(
    guardadas = list("CH 40" = "Castillo Solorsano, Leidy Viviana"),
    en_la_hoja = list("CH 40" = "Castillo SOLORSANO , LEIDY VIVIANA")
  )
  expect_false(out$hay)
  expect_length(out$cambiadas, 0L)
})

test_that("un lado vacío no inventa un cambio", {
  out <- monitoreo_aulas_fijaciones_desfasadas(
    guardadas = list("CH 1" = ""),
    en_la_hoja = list("CH 1" = "Ana Prueba")
  )
  expect_false(out$hay)
})

test_that("sin fijaciones de ninguno de los dos lados no hay nada que decir", {
  out <- monitoreo_aulas_fijaciones_desfasadas(list(), list())
  expect_false(out$hay)
  expect_length(out$nuevas, 0L)
  expect_length(out$retiradas, 0L)
})

test_that("el aviso dice cuántas y cuáles, no «puede estar desactualizado»", {
  texto <- monitoreo_aulas_fijaciones_desfasadas_texto(
    monitoreo_aulas_fijaciones_desfasadas(
      guardadas = list("CH 117" = "Aguilar Cuya, Renzo", "CH 14" = "Rodríguez Zárate, Marco"),
      en_la_hoja = list("CH 117" = "Simon Cosme, Jhonny", "CH 14" = "Uribe Olaechea, Jesús")
    )
  )
  expect_true(grepl("2 citas tienen otro aplicador", texto, fixed = TRUE))
  expect_true(grepl("CH 117 (Aguilar Cuya, Renzo → Simon Cosme, Jhonny)", texto, fixed = TRUE))
  expect_true(grepl("Sincroniza", texto, fixed = TRUE))
})

test_that("con muchas, enumera unas cuantas y resume el resto", {
  guardadas <- stats::setNames(as.list(rep("Ana Prueba", 11)), paste("CH", 1:11))
  hoja <- stats::setNames(as.list(rep("Berta Ficticia", 11)), paste("CH", 1:11))
  texto <- monitoreo_aulas_fijaciones_desfasadas_texto(
    monitoreo_aulas_fijaciones_desfasadas(guardadas, hoja)
  )
  expect_true(grepl("11 citas tienen otro aplicador", texto, fixed = TRUE))
  expect_true(grepl("y 5 más", texto, fixed = TRUE))
})

test_that("sin cambios no hay frase: un aviso vacío es ruido", {
  expect_identical(monitoreo_aulas_fijaciones_desfasadas_texto(
    monitoreo_aulas_fijaciones_desfasadas(list("CH 1" = "Ana"), list("CH 1" = "Ana"))), "")
  expect_identical(monitoreo_aulas_fijaciones_desfasadas_texto(NULL), "")
})

test_that("el recibo del ciclo pone el desfase PRIMERO, antes de lo que haría", {
  # Es lo único de la frase que dice que lo que se está mirando en la app no es
  # lo que el equipo tiene delante: detrás de «se añadirían 3 aulas» se pierde.
  texto <- monitoreo_aulas_sincronizacion_texto(list(
    aplicado = FALSE,
    anadidas = list(list(curso_horario = "CH 35"), list(curso_horario = "CH 40")),
    sin_aplicador = list(),
    fijaciones_desfasadas = list(
      hay = TRUE,
      cambiadas = list(list(curso_horario = "CH 117", guardado = "Ana Prueba",
                            en_la_hoja = "Berta Ficticia"))
    )
  ))
  expect_true(startsWith(texto, "El reparto de la app no es el de la hoja"))
  expect_true(grepl("Se añadirían 2 aulas", texto, fixed = TRUE))
})

test_that("sin desfase el recibo se lee exactamente como antes", {
  con <- monitoreo_aulas_sincronizacion_texto(list(
    aplicado = TRUE, anadidas = list(), sin_aplicador = list(),
    fijaciones_desfasadas = list(hay = FALSE, cambiadas = list())))
  sin <- monitoreo_aulas_sincronizacion_texto(list(
    aplicado = TRUE, anadidas = list(), sin_aplicador = list()))
  expect_identical(con, sin)
})

# --- el cableado: que el recibo lo TRAIGA, no sólo que el motor sepa ---------
#
# El motor y la frase ya tienen prueba, pero nada fallaba si alguien quitaba el
# cálculo del recibo o dejaba de pasarle las fijaciones vigentes. Un aviso sin
# prueba de cableado es un aviso que desaparece en el próximo refactor sin que
# ningún rojo lo diga — que es exactamente cómo la adopción se quedó envejeciendo
# en silencio.

# Constructores propios: los de `test-monitoreo-aulas-distribucion-mantenimiento.R`
# viven en su archivo y testthat no los comparte. Sólo `helper-sheets-mock.R` es
# común.
.mafd_fila_hoja <- function(quien, cod) {
  as.list(c(quien, "Lunes", "07/09", "09:30", "09:45", "10:00 a 10:30",
            cod, "A101", "Ciencias", "Cálculo", "Docente Uno", ""))
}

.mafd_aula <- function(cod, fecha, hora) {
  list(operational_code = cod, classroom_id = tolower(gsub(" ", "", cod)),
       sample_role = "titular", sample_status = "agendada", faculty = "Ciencias",
       course_name = "Cálculo", teacher = "Docente Uno", scheduled_venue = "A101",
       scheduled_date = fecha, scheduled_time = hora,
       eligible_n = 40, expected_valid = 20)
}

.mafd_mock_hoja <- function() {
  mock <- .sheets_api_mock()
  mock$seed("Semana 1", values = c(
    list(as.list(prosecnurapp:::.alpa_CABECERA)),
    list(.mafd_fila_hoja("Berta Ficticia", "CH 1"))
  ))
  mock
}

test_that("el recibo del ensayo TRAE el desfase de las fijaciones vigentes", {
  mock <- .mafd_mock_hoja()
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  out <- monitoreo_aulas_sincronizar_distribucion(
    "sheet_dist",
    plan = list(.mafd_aula("CH 1", "2026-09-07", "10:00 am")),
    roster = c("Ana Prueba", "Berta Ficticia"),
    # La app tiene fijada a Ana; la hoja dice Berta.
    fijadas_guardadas = list("CH 1" = "Ana Prueba")
  )
  expect_true(isTRUE(out$fijaciones_desfasadas$hay))
  expect_length(out$fijaciones_desfasadas$cambiadas, 1L)
  expect_identical(out$fijaciones_desfasadas$cambiadas[[1]]$guardado, "Ana Prueba")
  expect_identical(out$fijaciones_desfasadas$cambiadas[[1]]$en_la_hoja, "Berta Ficticia")
  # Y la frase del recibo lo dice, que es donde el usuario lo ve.
  expect_true(grepl("no es el de la hoja", monitoreo_aulas_sincronizacion_texto(out), fixed = TRUE))
})

test_that("sin fijaciones guardadas el recibo no inventa un desfase", {
  # Es el caso del primer día: nadie ha adoptado nada todavía y la hoja ya tiene
  # nombres. Eso no es que la app esté desfasada.
  mock <- .mafd_mock_hoja()
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  out <- monitoreo_aulas_sincronizar_distribucion(
    "sheet_dist",
    plan = list(.mafd_aula("CH 1", "2026-09-07", "10:00 am")),
    roster = c("Ana Prueba", "Berta Ficticia")
  )
  expect_false(isTRUE(out$fijaciones_desfasadas$hay))
  expect_false(grepl("no es el de la hoja",
                     monitoreo_aulas_sincronizacion_texto(out), fixed = TRUE))
})
