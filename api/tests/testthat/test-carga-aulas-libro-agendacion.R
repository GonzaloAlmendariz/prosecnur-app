# **La hoja que reemplaza a «Tabla dinámica 2».**
#
# Dictado de Gonzalo (2026-09-08): «me gustaría que Tabla dinámica 2 se vuelva
# una hoja que la app pueda producir en base a lo agendado, viendo no sólo
# titulares sino los reemplazos y sus columnas… y la relación de aulas agendadas
# por semana, siendo la del 7 al 11 la primera semana (domingos no cuentan)».
#
# Lo que se sujeta aquí es lo que la tabla dinámica hecha a mano NO podía saber:
# que los once eslabones de reemplazo viven a la derecha del titular en la misma
# fila de la hoja de agenda, así que una dinámica sobre esa hoja sólo cuenta el
# bloque titular y no distingue un rechazo ya relevado de uno pendiente.

.calan_u <- function(cod, fac = "Ciencias", estado = "sin_contactar", fecha = "",
                     rol = "titular", titular = "", orden = 0) {
  list(operational_code = cod, classroom_id = tolower(gsub(" ", "", cod)),
       faculty = fac, sample_role = rol, sample_status = estado,
       titular_operational_code = titular, replacement_order = orden,
       scheduled_date = fecha, eligible_n = 30, expected_valid = 15)
}

test_that("un rechazo con reemplazo agendado NO se cuenta como pendiente, y uno sin relevo sí", {
  # La distinción que la dinámica a mano no podía hacer: las dos cadenas tienen
  # el titular rechazado y son situaciones opuestas.
  plan <- list(
    .calan_u("CH 1", estado = "rechazo"),
    .calan_u("R 1.1", estado = "agendada", fecha = "2026-09-09",
             rol = "chain_reserve", titular = "CH 1", orden = 1),
    .calan_u("CH 2", estado = "rechazo"),
    .calan_u("R 2.1", rol = "chain_reserve", titular = "CH 2", orden = 1)
  )
  f <- aulas_libro_agendacion(plan)$facultad
  expect_identical(nrow(f), 1L)
  expect_identical(f$Slots, 2L)
  expect_identical(f$Rechazos, 2L)
  expect_identical(f$`Rechazos con reemplazo agendado`, 1L)
  expect_identical(f$`Rechazos sin reemplazo`, 1L)
  # La cadena relevada YA está agendada: no cuenta como pendiente de agendar.
  expect_identical(f$Agendadas, 1L)
  expect_identical(f$`Pendientes de agendar`, 1L)
  expect_identical(f$`Reemplazos agendados`, 1L)
  expect_identical(f$`Titulares agendadas`, 0L)
})

test_that("las reservas EXTRA no son slots: no reemplazan a nadie", {
  # Contándolas, DERECHO salía con 61 slots donde el diseño le puso 19 y sus
  # cuarenta y dos reservas dormidas se leían como aulas sin agendar.
  plan <- c(
    lapply(1:3, function(i) .calan_u(sprintf("CH %d", i), estado = "agendada",
                                     fecha = "2026-09-07")),
    lapply(1:5, function(i) .calan_u(sprintf("EX %d", i), rol = "extra_reserve_pool"))
  )
  f <- aulas_libro_agendacion(plan)$facultad
  expect_identical(f$Slots, 3L)
  expect_identical(f$`Pendientes de agendar`, 0L)
  # Pero siguen existiendo, en su propia fila de la tabla por eslabón.
  esl <- aulas_libro_agendacion(plan)$eslabon
  expect_true("Extra" %in% esl$`Eslabón`)
  expect_identical(esl$`En el plan`[esl$`Eslabón` == "Extra"], 5L)
  # Y la fila «Extra» va al final, después de todas las erres.
  expect_identical(esl$`Eslabón`[[nrow(esl)]], "Extra")
})

test_that("la semana va de lunes a sábado y el domingo no abre una semana propia", {
  # «la del 7 al 11 la primera semana (domingos no cuentan)». El 07/09/2026 es
  # lunes; el 12 es sábado y cierra la semana 1; el 14 es el lunes siguiente.
  fechas <- c("2026-09-07", "2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14")
  expect_identical(prosecnurapp:::.calan_semana(fechas, "2026-09-07"),
                   c(1L, 1L, 1L, 1L, 2L))
  r <- prosecnurapp:::.calan_rango_semana(1L, "2026-09-07")
  expect_identical(r$desde, "07/09")
  expect_identical(r$hasta, "12/09")
  r2 <- prosecnurapp:::.calan_rango_semana(2L, "2026-09-07")
  expect_identical(r2$desde, "14/09")
  # Y el ancla se toma del LUNES de la fecha que se le dé, no de la fecha misma.
  expect_identical(prosecnurapp:::.calan_semana("2026-09-09", "2026-09-09"), 1L)
})

test_that("agendada es estado Y fecha: un AGENDADA sin fecha no cuadra ningún día", {
  plan <- list(
    .calan_u("CH 1", estado = "agendada", fecha = "2026-09-07"),
    .calan_u("CH 2", estado = "agendada", fecha = "")
  )
  a <- aulas_libro_agendacion(plan)
  expect_identical(a$facultad$Agendadas, 1L)
  # Y las tres tablas cuadran entre sí, que es la razón de la regla.
  expect_identical(sum(a$dia$Agendadas), a$facultad$Agendadas)
  expect_identical(sum(a$semana$Agendadas), a$facultad$Agendadas)
})

test_that("por día se cuenta por FILA y no por cadena: dos fechas son dos trabajos", {
  # Si el titular cayó y su reserva se agendó para otro día, los dos días
  # tienen trabajo aunque el slot sea uno solo.
  plan <- list(
    .calan_u("CH 1", estado = "agendada", fecha = "2026-09-07"),
    .calan_u("R 1.1", estado = "agendada", fecha = "2026-09-09",
             rol = "chain_reserve", titular = "CH 1", orden = 1)
  )
  a <- aulas_libro_agendacion(plan)
  expect_identical(nrow(a$dia), 2L)
  expect_identical(sum(a$dia$Agendadas), 2L)
  expect_identical(a$dia$`De reemplazos`, c(0L, 1L))
  expect_identical(a$dia$`Día de la semana`, c("Lunes", "Miércoles"))
  # La cadena, en cambio, es UNA: el slot no se cuenta dos veces.
  expect_identical(a$facultad$Slots, 1L)
  expect_identical(a$facultad$Agendadas, 1L)
})

test_that("las cuatro tablas llevan exactamente las columnas del vocabulario", {
  plan <- list(.calan_u("CH 1", estado = "agendada", fecha = "2026-09-07"))
  a <- aulas_libro_agendacion(plan)
  for (clave in names(AULAS_AGENDACION_CABECERAS)) {
    expect_identical(names(a[[clave]]), AULAS_AGENDACION_CABECERAS[[clave]],
                     info = sprintf("la tabla «%s» divergió del vocabulario", clave))
  }
  # Y un plan vacío devuelve las cuatro en NULL, sin reventar.
  vacio <- aulas_libro_agendacion(list())
  expect_true(all(vapply(vacio, is.null, logical(1))))
})

# --- la pestaña ---------------------------------------------------------------

test_that("la hoja sale con sus cuatro bloques, cada uno con su título y su vacío declarado", {
  plan <- list(
    .calan_u("CH 1", estado = "agendada", fecha = "2026-09-07"),
    .calan_u("CH 2", estado = "rechazo")
  )
  rows <- aulas_libro_hoja_agendacion(aulas_libro_agendacion(plan))
  texto <- vapply(rows, function(r) {
    v <- r[[1]] %||% ""
    if (is.numeric(v)) format(v) else as.character(v)
  }, character(1))
  expect_identical(texto[[1]], "Avance de agendación")
  # Los cuatro títulos, en el orden de lectura: el resumen de la semana antes
  # que el detalle del día.
  posiciones <- vapply(unname(AULAS_AGENDACION_TITULOS), function(t) {
    which(texto == t)[[1]]
  }, integer(1))
  expect_true(all(diff(posiciones) > 0))
  expect_identical(names(AULAS_AGENDACION_TITULOS)[order(posiciones)],
                   c("facultad", "semana", "dia", "eslabon"))
})

test_that("las cifras viajan como NÚMEROS, no como texto", {
  # Sobre texto no hay numFmt que aplicar ni columna que se pueda ordenar o
  # sumar en el propio Sheets. Es la misma decisión que «Avance de campo» tomó
  # el 2026-09-08.
  plan <- list(.calan_u("CH 1", estado = "agendada", fecha = "2026-09-07"))
  rows <- aulas_libro_hoja_agendacion(aulas_libro_agendacion(plan))
  cab <- which(vapply(rows, function(r) {
    identical(as.character(r[[1]] %||% ""), "Facultad")
  }, logical(1)))
  expect_length(cab, 1L)
  fila <- rows[[cab + 1L]]
  expect_true(is.character(fila[[1]]))
  expect_true(is.numeric(fila[[2]]))
  expect_identical(fila[[2]], 1)
})

test_that("el corte NO sale del reloj: sin fecha agendada lo declara", {
  # Si leyera `Sys.Date()`, dos publicaciones del MISMO estado en días distintos
  # darían hashes distintos y la pestaña se reescribiría sin que nada cambie.
  rows <- aulas_libro_hoja_agendacion(aulas_libro_agendacion(list(.calan_u("CH 1"))))
  expect_match(as.character(rows[[2]][[1]]), "Todavía no hay ninguna aula con fecha agendada")
  rows2 <- aulas_libro_hoja_agendacion(
    aulas_libro_agendacion(list(.calan_u("CH 1", estado = "agendada", fecha = "2026-09-11"))))
  expect_match(as.character(rows2[[2]][[1]]), "11/09", fixed = TRUE)
})

test_that("el formato pone banda a los títulos y a las cabeceras, y nada de color por valor", {
  plan <- list(.calan_u("CH 1", estado = "agendada", fecha = "2026-09-07"))
  rows <- aulas_libro_hoja_agendacion(aulas_libro_agendacion(plan))
  reqs <- aulas_libro_agendacion_formato_requests(111L, rows)
  expect_gt(length(reqs), 0L)
  tipos <- vapply(reqs, function(r) names(r)[[1]], character(1))
  # Ni una regla condicional: todas sus columnas son conteos, y una escala sobre
  # un conteo diría que veinte aulas agendadas es «mejor» que dos.
  expect_false("addConditionalFormatRule" %in% tipos)
  expect_true(all(tipos %in% c("repeatCell", "updateDimensionProperties")))
  # Una banda por cada uno de los cinco títulos (la portada y los cuatro
  # bloques), aunque una tabla salga vacía.
  bandas <- Filter(function(r) {
    !is.null(r$repeatCell$cell$userEnteredFormat$backgroundColor) &&
      identical(r$repeatCell$range$startColumnIndex, 0L) &&
      isTRUE(r$repeatCell$range$endRowIndex - r$repeatCell$range$startRowIndex == 1L)
  }, reqs)
  expect_gte(length(bandas), 5L)
})

test_that("la cabecera se reconoce por la fila ENTERA, no por su primera celda", {
  # «Agendación por semana» y «Agendación por día» comparten cinco columnas; con
  # la primera celda, la del día se leería como la de la semana.
  expect_identical(prosecnurapp:::.calan_tabla_de_cabecera(AULAS_AGENDACION_CABECERAS$semana), "semana")
  expect_identical(prosecnurapp:::.calan_tabla_de_cabecera(AULAS_AGENDACION_CABECERAS$dia), "dia")
  expect_identical(prosecnurapp:::.calan_tabla_de_cabecera(c("Semana", "Otra cosa")), "")
})
