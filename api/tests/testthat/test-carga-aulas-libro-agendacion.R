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
  expect_identical(f[["Aulas del diseño"]], 2L)
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
  expect_identical(f[["Aulas del diseño"]], 3L)
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
  expect_identical(a$facultad[["Aulas del diseño"]], 1L)
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
  # Los CINCO títulos, en el orden de lectura: el total antes que nada —«una
  # tabla al inicio que diga cuántas agendadas en total ya hay», dictado del
  # 2026-09-09—, y el resumen de la semana antes que el detalle del día.
  posiciones <- vapply(unname(AULAS_AGENDACION_TITULOS), function(t) {
    which(texto == t)[[1]]
  }, integer(1))
  expect_true(all(diff(posiciones) > 0))
  expect_identical(names(AULAS_AGENDACION_TITULOS)[order(posiciones)],
                   c("total", "facultad", "semana", "dia", "eslabon"))
})

test_that("el total dice cuántas van, y de titulares y de reemplazos por separado", {
  # La unidad aquí es la FILA y no la cadena: un titular caído y su reemplazo
  # agendado son DOS visitas al campus, y las dos tienen que verse. La tabla de
  # facultad cuenta cadenas y diría «1».
  plan <- list(
    .calan_u("CH 1", estado = "agendada", fecha = "2026-09-07"),
    .calan_u("CH 2", estado = "rechazo"),
    .calan_u("R 2.1", estado = "agendada", fecha = "2026-09-08",
             rol = "chain_reserve", titular = "CH 2", orden = 1),
    .calan_u("CH 3", estado = "en_contacto")
  )
  tot <- aulas_libro_agendacion(plan)$total
  valor <- function(k) tot$Total[[which(tot$Indicador == k)]]
  expect_equal(valor("Cursos-horario agendados"), 2)
  expect_equal(valor("De titulares"), 1)
  expect_equal(valor("De reemplazos"), 1)
  expect_equal(valor("Rechazos"), 1)
  # CH 3 está en contacto: cuenta como pendiente de agendar.
  expect_equal(valor("Sin agendar todavía"), 1)
  # Y la fila de extras NO aparece si no hay ninguna: una fila en cero sobre
  # algo que este estudio no usa es ruido.
  expect_false("De reservas extra" %in% tot$Indicador)
})

test_that("sin ninguna agendada el bloque calla y la hoja lo dice", {
  plan <- list(.calan_u("CH 1", estado = "en_contacto"))
  expect_null(aulas_libro_agendacion(plan)$total)
  rows <- aulas_libro_hoja_agendacion(aulas_libro_agendacion(plan))
  texto <- vapply(rows, function(r) {
    v <- r[[1]] %||% ""
    if (is.numeric(v)) format(v) else as.character(v)
  }, character(1))
  expect_true(any(texto == prosecnurapp:::.calan_VACIOS[["total"]]))
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

# --- la hoja del xlsx ---------------------------------------------------------

test_that("el xlsx gana su hoja, con los cuatro bloques y sus notas", {
  skip_if_not_installed("openxlsx")
  wb <- openxlsx::createWorkbook()
  plan <- list(
    .calan_u("CH 1", estado = "agendada", fecha = "2026-09-07"),
    .calan_u("CH 2", estado = "rechazo")
  )
  aulas_libro_escribir_agendacion(aulas_libro_agendacion(plan), wb)
  expect_true("Avance de agendación" %in% names(wb))
  d <- openxlsx::readWorkbook(wb, sheet = "Avance de agendación", colNames = FALSE)
  texto <- paste(as.character(unlist(d)), collapse = " | ")
  for (t in unname(AULAS_AGENDACION_TITULOS)) {
    expect_match(texto, t, fixed = TRUE)
  }
  # Y las cabeceras de las cuatro, para que la hoja no salga con los bloques
  # vacíos y el título puesto.
  expect_match(texto, "Rechazos con reemplazo agendado", fixed = TRUE)
  expect_match(texto, "Agendación por eslabón", fixed = TRUE)
})

test_that("el vacío declarado se FUSIONA a lo ancho de la hoja, no se apila en la columna A", {
  # Se vio al abrir el libro, no aquí: escrito sólo en la columna A, el texto se
  # partía en seis renglones dentro de una columna de 34 caracteres y empujaba
  # la tabla media pantalla hacia abajo. El test miraba que el texto estuviera,
  # que es lo que un texto apilado también cumple.
  #
  # Lo que se fusiona son los vacíos de `.calan_VACIOS` (C3): las notas
  # didácticas de cada tabla se retiraron el 2026-09-22. Por eso el plan de este
  # fixture no agenda nada — con las cuatro tablas llenas ya no queda una sola
  # celda larga en la columna A que fusionar.
  skip_if_not_installed("openxlsx")
  wb <- openxlsx::createWorkbook()
  plan <- list(.calan_u("CH 1", estado = "en_contacto"))
  aulas_libro_escribir_agendacion(aulas_libro_agendacion(plan), wb)
  celdas <- wb$worksheets[[1]]$mergeCells
  expect_gt(length(celdas), 0L)
  # Cada fusión abarca de la columna A hasta el ancho de la hoja, que es el de
  # su tabla más ancha.
  ancho <- max(vapply(AULAS_AGENDACION_CABECERAS, length, integer(1)))
  ultima <- openxlsx::int2col(ancho)
  #  viaja como XML crudo («<mergeCell ref="A5:M5"/>»): se saca el
  # rango antes de mirarlo, o el patrón nunca casa y el test pasa por el motivo
  # equivocado el día que alguien lo relaje.
  rangos <- gsub(".*ref=\"([^\"]+)\".*", "\\1", celdas)
  expect_true(all(grepl(sprintf("^A[0-9]+:%s[0-9]+$", ultima), rangos)),
              info = paste(utils::head(rangos, 3), collapse = " | "))
})

test_that("una tabla sin datos conserva su título y DICE por qué está vacía", {
  skip_if_not_installed("openxlsx")
  wb <- openxlsx::createWorkbook()
  # Sin ninguna agendada: las tablas de semana y de día quedan vacías.
  aulas_libro_escribir_agendacion(aulas_libro_agendacion(list(.calan_u("CH 1"))), wb)
  d <- openxlsx::readWorkbook(wb, sheet = "Avance de agendación", colNames = FALSE)
  texto <- paste(as.character(unlist(d)), collapse = " | ")
  expect_match(texto, "Agendación por semana", fixed = TRUE)
  expect_match(texto, "Todavía no hay ninguna aula con fecha agendada", fixed = TRUE)
})

test_that("el corte del xlsx tampoco sale del reloj", {
  skip_if_not_installed("openxlsx")
  wb <- openxlsx::createWorkbook()
  aulas_libro_escribir_agendacion(
    aulas_libro_agendacion(list(.calan_u("CH 1", estado = "agendada", fecha = "2026-09-11"))), wb)
  d <- openxlsx::readWorkbook(wb, sheet = "Avance de agendación", colNames = FALSE)
  texto <- paste(as.character(unlist(d)), collapse = " | ")
  expect_match(texto, "11/09", fixed = TRUE)
  # La fecha de HOY no aparece: dos generaciones del mismo estado tienen que dar
  # el mismo libro.
  expect_false(grepl(format(Sys.Date(), "%d/%m/%Y"), texto, fixed = TRUE))
})

test_that("los anchos salen del modelo: una facultad larga ensancha su columna", {
  # La hoja nació con «34 la primera y 16 las demás», que cabía porque la
  # facultad más larga del operativo mide 32. Cabía POR SUERTE, que es como el
  # libro se ganó cinco cortes (docs/qa/anchos-que-cortan-datos-2026-09-09.md).
  skip_if_not_installed("openxlsx")
  ancho1 <- function(wb) {
    a <- wb$colWidths[[1L]]
    suppressWarnings(as.numeric(a[names(a) == "1"]))
  }
  largo <- paste(rep("FACULTAD", 6L), collapse = " ")   # 53 caracteres
  wb <- openxlsx::createWorkbook()
  aulas_libro_escribir_agendacion(
    aulas_libro_agendacion(list(.calan_u("CH 1", fac = largo, estado = "agendada",
                                         fecha = "2026-09-07"))), wb)
  expect_gt(ancho1(wb), 34)

  # Y con nombres cortos se queda en el suelo: una tabla floja no la estrecha.
  wb2 <- openxlsx::createWorkbook()
  aulas_libro_escribir_agendacion(
    aulas_libro_agendacion(list(.calan_u("CH 1", fac = "Letras", estado = "agendada",
                                         fecha = "2026-09-07"))), wb2)
  expect_equal(ancho1(wb2), 34)
})

test_that("en Sheets la primera columna también mide, y sólo cuenta las filas de dato", {
  # Otro «cabe por suerte» de este mismo loop: 260 px fijos para nombres de
  # facultad, y el más largo del operativo pide 250. Diez de margen.
  ancho1 <- function(rows) {
    r <- aulas_libro_agendacion_formato_requests(111L, rows)
    d <- Filter(function(x) {
      !is.null(x$updateDimensionProperties) &&
        identical(x$updateDimensionProperties$range$dimension, "COLUMNS") &&
        identical(x$updateDimensionProperties$range$startIndex, 0L)
    }, r)
    d[[1]]$updateDimensionProperties$properties$pixelSize
  }
  largo <- paste(rep("FACULTAD", 6L), collapse = " ")
  filas_largas <- aulas_libro_hoja_agendacion(
    aulas_libro_agendacion(list(.calan_u("CH 1", fac = largo, estado = "agendada",
                                         fecha = "2026-09-07"))))
  expect_gt(ancho1(filas_largas), 260L)

  # Con nombres cortos se queda en el suelo. Y las NOTAS, que son mucho más
  # largas que cualquier facultad, no lo mueven: van solas en su fila y se
  # derraman sobre las celdas vacías de su derecha.
  filas_cortas <- aulas_libro_hoja_agendacion(
    aulas_libro_agendacion(list(.calan_u("CH 1", fac = "Letras", estado = "agendada",
                                         fecha = "2026-09-07"))))
  expect_equal(ancho1(filas_cortas), 260L)
})


# --- las aulas EXTRA agendadas se ven, y no se cuentan como titulares --------
#
# Gonzalo, 2026-09-12: «Avance de agendación debería también considerar las
# aulas extra, ¿no? Ahorita solo está considerando las agendadas, lo agendado,
# las aplicadas, por aplicar, titulares agendadas, reemplazos agendados, pero
# no están las extras agendadas; a menos que lo estés considerando dentro de
# reemplazos».
#
# La respuesta medida fue peor que su sospecha: **no caían en reemplazos, caían
# en TITULARES**. `es_reserva` es FALSE para el banco, así que `!es_reserva`
# las recogía junto a las aulas que el diseño muestral eligió. No se veía
# porque las 45 del banco del operativo estaban sin agendar; se habría visto el
# día que alguien agendara la primera, y como un titular de más.

.tag_fila_extra <- function(codigo, fecha, rol = "extra_reserve_pool") {
  list(operational_code = codigo, classroom_id = tolower(gsub(" ", "", codigo)),
       sample_role = rol, operational_status = "agendada",
       scheduled_date = fecha, scheduled_time = "10:00",
       faculty = "DERECHO", teacher = "Docente", course_name = "Curso",
       sample_status = "AGENDADA")
}

test_that("una extra agendada NO engorda «De titulares» ni en el día ni en la semana", {
  plan <- list(
    .tag_fila_extra("CH 1", "2026-09-08", rol = "titular"),
    .tag_fila_extra("R 1.1", "2026-09-08", rol = "chain_reserve"),
    .tag_fila_extra("EXTRA 7", "2026-09-08")
  )
  ejes <- prosecnurapp:::.calan_ejes(plan, partes = list())
  dia <- prosecnurapp:::.calan_por_dia(ejes)
  expect_equal(dia[["Agendadas"]][[1]], 3L)
  expect_equal(dia[["De titulares"]][[1]], 1L)
  expect_equal(dia[["De reemplazos"]][[1]], 1L)
  expect_equal(dia[["De reservas extra"]][[1]], 1L)
  # Y las tres columnas suman el total: si una población se cuela en dos, deja
  # de cuadrar y es lo único que lo delata.
  expect_equal(dia[["De titulares"]][[1]] + dia[["De reemplazos"]][[1]] +
                 dia[["De reservas extra"]][[1]], dia[["Agendadas"]][[1]])

  sem <- prosecnurapp:::.calan_por_semana(ejes)
  expect_equal(sem[["De titulares"]][[1]], 1L)
  expect_equal(sem[["De reservas extra"]][[1]], 1L)
  expect_equal(sem[["De titulares"]][[1]] + sem[["De reemplazos"]][[1]] +
                 sem[["De reservas extra"]][[1]], sem[["Agendadas"]][[1]])
})

test_that("la fila «De reservas extra» se dice aunque sea cero, si hay banco", {
  # Una fila que aparece y desaparece no distingue «ninguna agendada» de «esta
  # hoja no las mira», que es exactamente la duda que tuvo el lead.
  con_banco <- list(
    .tag_fila_extra("CH 1", "2026-09-08", rol = "titular"),
    # Del banco y SIN agendar: la fila tiene que salir igual, en cero.
    list(operational_code = "EXTRA 1", classroom_id = "x1",
         sample_role = "extra_reserve_pool", operational_status = "contactada",
         faculty = "DERECHO", sample_status = "SIN CONTACTAR")
  )
  total <- prosecnurapp:::.calan_total(prosecnurapp:::.calan_ejes(con_banco, partes = list()))
  fila <- total[total$Indicador == "De reservas extra", , drop = FALSE]
  expect_equal(nrow(fila), 1L)
  expect_equal(fila$Total[[1]], 0)

  # Sin banco NO se dice: ahí sí sería una fila sobre algo que no existe.
  sin_banco <- list(.tag_fila_extra("CH 1", "2026-09-08", rol = "titular"))
  total2 <- prosecnurapp:::.calan_total(prosecnurapp:::.calan_ejes(sin_banco, partes = list()))
  expect_equal(nrow(total2[total2$Indicador == "De reservas extra", , drop = FALSE]), 0L)
})

# --- por qué «Ya aplicados» puede superar a las agendadas ---------------------
#
# Medido en el operativo el 2026-09-12: 87 aulas con parte y 86 de ellas
# agendadas. La diferencia era **CH 143**, con el parte rendido y STATUS
# MUESTRA todavía en «EN CONTACTO», sin fecha agendada. No es un error de la
# hoja: es el patrón de siempre —el hecho ocurre antes que el verbo, alguien
# aplica y la celda de la agenda se teclea después o no se teclea—, y hasta
# ahora había que salir a buscar cuál era para entender el descuadre.

test_that("un aula con parte que no consta agendada se nombra, no se deja adivinar", {
  plan <- list(
    .tag_fila_extra("CH 1", "2026-09-08", rol = "titular"),
    # Aplicada de verdad, pero la agenda se quedó en «EN CONTACTO» y sin fecha.
    list(operational_code = "CH 143", classroom_id = "ch143", sample_role = "titular",
         operational_status = "contactada", faculty = "DERECHO",
         sample_status = "EN CONTACTO")
  )
  partes <- list(list(operational_code = "CH 143", intento = 1L, estado = "aplicada",
                      aplicador = "Ana Prueba", efectivas = 12, asistentes = 20))
  ag <- aulas_libro_agendacion(plan, partes = partes)
  expect_identical(ag$aplicadas_sin_agendar, "CH 143")

  # **El modelo lo sigue midiendo; la hoja ya no lo escribe.** El aviso se
  # retiró con las notas didácticas (Gonzalo, 2026-09-22), así que el dato queda
  # disponible para quien lo consuma y la pestaña no lo pregona.
  textos <- vapply(aulas_libro_hoja_agendacion(ag),
                   function(f) as.character(unlist(f))[1] %||% "", character(1))
  expect_false(any(grepl("por agendada", textos, fixed = TRUE)))
  expect_false(any(grepl("«Ya aplicados» puede superar", textos, fixed = TRUE)))
})

test_that("sin ninguna así, la hoja no inventa el aviso", {
  ag <- aulas_libro_agendacion(
    list(.tag_fila_extra("CH 1", "2026-09-08", rol = "titular")),
    partes = list(list(operational_code = "CH 1", intento = 1L, estado = "aplicada",
                       efectivas = 10)))
  expect_identical(ag$aplicadas_sin_agendar, character(0))
  textos <- vapply(aulas_libro_hoja_agendacion(ag),
                   function(f) as.character(unlist(f))[1] %||% "", character(1))
  expect_false(any(grepl("por agendada", textos, fixed = TRUE)))
})

test_that("las notas didácticas de las cuatro tablas se fueron, y su registro no existe", {
  # Gonzalo, 2026-09-22: «también quitemos las notas didácticas, son ai slop
  # para mí» — `.calan_NOTAS` era el registro de las cinco. Lo que SÍ se queda
  # es `.calan_VACIOS`: el estado vacío de cada tabla (C3), sin el cual una
  # tabla sin filas es un rectángulo en blanco que no distingue «no hay nada»
  # de «esto se rompió».
  expect_false(exists(".calan_NOTAS", envir = asNamespace("prosecnurapp"), inherits = FALSE))
  expect_true(exists(".calan_VACIOS", envir = asNamespace("prosecnurapp"), inherits = FALSE))

  plan <- list(.calan_u("CH 1", estado = "agendada", fecha = "2026-09-07"))
  textos <- vapply(aulas_libro_hoja_agendacion(aulas_libro_agendacion(plan)),
                   function(f) as.character(unlist(f))[1] %||% "", character(1))
  for (frase in c("Aquí la unidad es la FILA", "Aulas del diseño» son las que el sorteo",
                  "Semanas de lunes a sábado", "la tabla dinámica hecha a mano")) {
    expect_false(any(grepl(frase, textos, fixed = TRUE)), info = frase)
  }
  # Y el corte ya no arrastra la procedencia: el renderer ni siquiera acepta la
  # marca de sincronización.
  expect_false("actualizado" %in% names(formals(aulas_libro_hoja_agendacion)))
  expect_false(any(grepl("datos de plataforma actualizados", textos, fixed = TRUE)))
})
