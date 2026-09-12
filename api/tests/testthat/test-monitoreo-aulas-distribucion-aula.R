# **El aula de la hoja de los aplicadores sigue a la del libro.**
#
# Dictado de Gonzalo (2026-09-09): «no se están actualizando las aulas con lo
# que el agendador está poniendo en LUGAR DE APLICACIÓN». Medido ese día sobre
# el operativo: de 93 citas, 6 con la celda vacía teniendo el libro un aula y 3
# con un aula DISTINTA de la del libro. Las 3 eran las peligrosas — nadie las
# habría corregido nunca, porque lo único que escribía esa columna era la
# siembra y la regla de completar sólo rellenaba vacíos.
#
# Lo que se sujeta aquí es la asimetría que hace correcta la escritura: el
# ESTADO es del coordinador y no se pisa; el aula NO es suya y sí.

.mada_cab <- function() as.list(prosecnurapp:::.alpa_CABECERA)

.mada_fila <- function(cod, aula = "", fecha = "07/09", estado = "POR APLICAR") {
  as.list(c("Ana Prueba", "Lunes", fecha, "09:30", "09:45", "10:00 a 10:30",
            cod, aula, "Ciencias", "Cálculo", "Docente Uno", estado))
}

.mada_hoja <- function(...) c(list(.mada_cab()), list(...))

.mada_aula <- function(cod, lugar = "A101", ambiente = "") {
  list(operational_code = cod, scheduled_venue = lugar, venue = ambiente,
       scheduled_date = "2026-09-07")
}

test_that("una celda vacía se rellena con el lugar que el libro pactó", {
  out <- monitoreo_aulas_aulas_distribucion(
    .mada_hoja(.mada_fila("CH 40")), list(.mada_aula("CH 40", "E203")))
  expect_identical(out$rellenadas, 1L)
  expect_identical(out$corregidas, 0L)
  expect_identical(out$columna[[2L]], "E203")
  expect_identical(out$cambios[[1L]]$motivo, "rellenada")
  expect_identical(out$cambios[[1L]]$curso_horario, "CH 40")
})

test_that("un aula distinta de la del libro se CORRIGE, y el recibo dice de qué a qué", {
  out <- monitoreo_aulas_aulas_distribucion(
    .mada_hoja(.mada_fila("CH 74", "L312")), list(.mada_aula("CH 74", "L409")))
  expect_identical(out$corregidas, 1L)
  expect_identical(out$columna[[2L]], "L409")
  expect_identical(out$cambios[[1L]]$antes, "L312")
  expect_identical(out$cambios[[1L]]$despues, "L409")
  expect_identical(out$cambios[[1L]]$motivo, "corregida")
})

test_that("el plan sin aula NO blanquea la celda escrita", {
  # Un vacío del plan es «todavía no lo sé», no «no hay aula». Ésta es la
  # trampa que ya costó la composición muestral entera en la fusión del libro.
  out <- monitoreo_aulas_aulas_distribucion(
    .mada_hoja(.mada_fila("CH 5", "A305")), list(.mada_aula("CH 5", "")))
  expect_identical(out$columna[[2L]], "A305")
  expect_identical(out$corregidas, 0L)
  expect_length(out$cambios, 0L)
})

test_that("una fila que el plan no conoce se conserva tal cual", {
  out <- monitoreo_aulas_aulas_distribucion(
    .mada_hoja(.mada_fila("CH 999", "Z001")), list(.mada_aula("CH 1", "A101")))
  expect_identical(out$columna[[2L]], "Z001")
  expect_length(out$cambios, 0L)
})

test_that("una cita sin aula en ninguno de los dos lados se CUENTA, no se calla", {
  out <- monitoreo_aulas_aulas_distribucion(
    .mada_hoja(.mada_fila("CH 7")), list(.mada_aula("CH 7", "")))
  expect_identical(out$sin_dato, 1L)
  expect_identical(out$columna[[2L]], "")
})

test_that("cuando el aula ya coincide no hay cambio que escribir", {
  out <- monitoreo_aulas_aulas_distribucion(
    .mada_hoja(.mada_fila("CH 1", "A101")), list(.mada_aula("CH 1", "A101")))
  expect_identical(out$rellenadas + out$corregidas, 0L)
  expect_length(out$cambios, 0L)
})

test_that("sin columna AULA en la hoja no se escribe nada", {
  cab <- as.list(setdiff(prosecnurapp:::.alpa_CABECERA, "AULA"))
  hoja <- list(cab, as.list(c("Ana Prueba", "Lunes", "07/09", "09:30", "09:45",
                              "10:00 a 10:30", "CH 1", "Ciencias", "Cálculo",
                              "Docente Uno", "POR APLICAR")))
  out <- monitoreo_aulas_aulas_distribucion(hoja, list(.mada_aula("CH 1", "A101")))
  expect_null(out$columna)
  expect_identical(out$rellenadas, 0L)
})

test_that("el lugar confirmado manda sobre el ambiente de la clase", {
  # La misma expresión que la siembra: si no hay lugar pactado se usa el
  # ambiente; si lo hay, manda. Dos expresiones para el mismo valor acabarían
  # peleándose entre publicar y sincronizar.
  out <- monitoreo_aulas_aulas_distribucion(
    .mada_hoja(.mada_fila("CH 133", "L408 · L104")),
    list(.mada_aula("CH 133", "L104", "L408 · L104")))
  expect_identical(out$columna[[2L]], "L104")
  expect_identical(out$corregidas, 1L)
})

test_that("el recibo en una frase lista las corregidas una por una", {
  # Un conteo escondería la peligrosa entre las inofensivas: rellenar un vacío
  # no manda a nadie a ninguna parte; corregir un aula que la hoja daba por
  # buena sí dice que alguien iba a caminar hasta la equivocada.
  texto <- monitoreo_aulas_sincronizacion_texto(list(
    aplicado = TRUE,
    aulas = list(rellenadas = 6L, corregidas = 2L, cambios = list(
      list(motivo = "rellenada", curso_horario = "CH 40", antes = "", despues = "E203"),
      list(motivo = "corregida", curso_horario = "CH 74", antes = "L312", despues = "L409"),
      list(motivo = "corregida", curso_horario = "CH 135", antes = "H404", despues = "H411")
    )),
    sin_aplicador = list()
  ))
  expect_true(grepl("el aula de 6 filas que la tenía en blanco", texto, fixed = TRUE))
  expect_true(grepl("CH 74 L312 → L409", texto, fixed = TRUE))
  expect_true(grepl("CH 135 H404 → H411", texto, fixed = TRUE))
  # La rellenada NO se enumera: son seis y no aportan nada leídas una a una.
  expect_false(grepl("CH 40", texto, fixed = TRUE))
})

test_that("sin cambios de aula la frase no menciona aulas", {
  texto <- monitoreo_aulas_sincronizacion_texto(list(
    aplicado = TRUE, aulas = list(rellenadas = 0L, corregidas = 0L, cambios = list()),
    sin_aplicador = list()))
  expect_false(grepl("aula", texto, fixed = TRUE))
})

# --- las dos respuestas a «¿de qué aula habla esta fila?» ---------------------
#
# La adopción de la hoja ya emparejaba «CH164» con «CH 164»
# (`monitoreo_aulas_fijaciones_desde_distribucion` normaliza el código), y esta
# corrección comparaba el texto tal cual. Resultado: la misma fila conservaba su
# aplicador y se quedaba SIN la corrección del aula — dos respuestas a la misma
# pregunta, que es la familia de defectos que más ha costado en este operativo.
#
# Medido en el Sheets el 2026-09-12: cinco filas de «Semana 1» escritas sin el
# espacio (CH164, CH143, CH128, CH89, CH91) y ninguna con la escritura buena,
# así que las cinco estaban en ese hueco.

test_that("un código sin el espacio encuentra su aula igual que con él", {
  cab <- prosecnurapp:::.alpa_CABECERA
  pon <- function(codigo, aula_escrita) {
    fila <- as.list(rep("", length(cab)))
    fila[[which(cab == "APLICADOR")]] <- "Ana Prueba"
    fila[[which(cab == "CURSO-HORARIO")]] <- codigo
    fila[[which(cab == "FECHA")]] <- "07/09"
    fila[[which(cab == "AULA")]] <- aula_escrita
    list(as.list(cab), fila)
  }
  plan <- list(list(operational_code = "CH 164", classroom_id = "ch164",
                    sample_role = "titular", operational_status = "agendada",
                    sample_status = "AGENDADA", scheduled_date = "2026-09-07",
                    scheduled_time = "09:00", scheduled_venue = "I108"))

  # En blanco: se rellena con la del plan, se escriba como se escriba el código.
  for (cod in c("CH 164", "CH164", "ch164", "CH  164")) {
    out <- monitoreo_aulas_aulas_distribucion(pon(cod, ""), plan)
    expect_equal(out$rellenadas, 1L, info = cod)
    expect_equal(out$sin_dato, 0L, info = cod)
  }

  # Y con un aula que NO coincide, se corrige: es el caso que manda a alguien
  # al sitio equivocado.
  out <- monitoreo_aulas_aulas_distribucion(pon("CH164", "I203"), plan)
  expect_equal(out$corregidas, 1L)
})

test_that("dos aulas distintas siguen siendo dos: la clave no las funde", {
  # La clave colapsa espacios y mayúsculas y NADA más. «R 1.1» y «R 11» son
  # aulas distintas y tienen que seguir siéndolo.
  cab <- prosecnurapp:::.alpa_CABECERA
  fila <- function(codigo) {
    f <- as.list(rep("", length(cab)))
    f[[which(cab == "CURSO-HORARIO")]] <- codigo
    f[[which(cab == "FECHA")]] <- "07/09"
    f
  }
  plan <- list(
    list(operational_code = "R 1.1", sample_role = "chain_reserve",
         scheduled_date = "2026-09-07", scheduled_venue = "A101"),
    list(operational_code = "R 11", sample_role = "chain_reserve",
         scheduled_date = "2026-09-07", scheduled_venue = "B202"))
  out <- monitoreo_aulas_aulas_distribucion(
    list(as.list(cab), fila("R 1.1"), fila("R 11")), plan)
  expect_equal(out$rellenadas, 2L)
  aulas <- vapply(out$cambios, function(c) as.character(c$despues %||% ""), character(1))
  expect_setequal(aulas, c("A101", "B202"))
})
