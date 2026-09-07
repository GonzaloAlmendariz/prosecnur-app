# B24 — la hoja de campo deja de ser «3 intentos» y pasa a UN bloque por ESLABÓN.
#
# Dictado textual de Gonzalo (2026-09-01, respondiendo a por qué la hoja de
# campo solo muestra hasta REEMPLAZO 2): «Tiene que ser como aulas agendadas,
# es el mismo diseño de columnas por titular o reemplazo pero con la
# información de campo».
#
# Hoy `aulas_libro_hoja_aplicadas(unidades, intentos = 3L, partes)` arma TRES
# bloques fijos por INTENTO de aplicación: medido con una cadena de
# profundidad 4, agendadas sale con 4 bloques (1 + 4x22 columnas) y la hoja de
# campo con 3 (3x37) — el eslabón REEMPLAZO 3 no tiene dónde vivir.
#
# Contrato B24 (congelado por el lead):
#   1. ROJO — profundidad espejo: tantos bloques como el eslabón más largo del
#      plan, no 3 fijos.
#   2. ROJO — cada bloque ES el eslabón b: su agenda (código incluido) es la
#      del eslabón b de la cadena, y el eslabón ausente queda VACÍO.
#   3. ROJO — el parte de una reserva cae en SU eslabón y la hoja va fila a
#      fila con agendadas (el M1 de 2025): una fila por CADENA, sin fila extra
#      para la reserva con parte.
#   4. ROJO — un parte tecleado en el bloque REEMPLAZO 3 vuelve bajo el código
#      de ESA reserva (el código del bloque llega sembrado/arrastrado y se lee
#      como valor).
#   5. VERDE-GUARDIA — la herencia A16 (bloque sin código hereda del titular)
#      queda como red de seguridad para celdas borradas, y un libro nuevo con
#      códigos sembrados NO inventa partes.
#   6. ROJO — el arrastre de Sheets cubre TODOS los eslabones (hoy
#      `.malar_bloques_arrastre` recorta a los 3 bloques del generador).
#      VERDE-GUARDIA: el bloque b YA arrastra del bloque b de agendadas
#      (`.malar_celdas_bloque` referencia `1+(b-1)*paso+j`) — investigado hoy:
#      los bloques 2-3 NO copian del titular; lo que falta es que existan los
#      bloques 4+.
#   7. VERDE-GUARDIA — las hojas Extra (B14) no cambian: un bloque.
#   8. ROJO — la geometría derivada del xlsx (bandas de color por eslabón,
#      semáforo de STATUS DE APLICACIÓN) recomputa con la profundidad nueva.
#
# Pines ARITMÉTICOS desde las specs (precedente: test-carga-aulas-libro-daa-
# plomeria.R): nunca un 22, un 37 ni una letra a mano — el bloque de agenda
# acaba de crecer con B22/B23 y volverá a crecer.

# --- fixture sintético: cadenas de profundidad 4 y 2, más un extra -----------

.ce24_plan <- function() list(
  list(operational_code = "CH 1", titular_operational_code = "CH 1",
       sample_role = "titular", faculty = "Letras y Ciencias Humanas",
       course_name = "CURSO UNO", teacher = "Docente CH 1",
       sample_status = "agendada", scheduled_date = "2026-09-08",
       eligible_n = 40, enrolled_total = 45),
  list(operational_code = "R 1.1", titular_operational_code = "CH 1",
       sample_role = "chain_reserve", replacement_order = 1,
       faculty = "Letras y Ciencias Humanas", course_name = "RESERVA UNO",
       teacher = "Docente R 1.1", eligible_n = 30, enrolled_total = 33),
  list(operational_code = "R 1.2", titular_operational_code = "CH 1",
       sample_role = "chain_reserve", replacement_order = 2,
       faculty = "Letras y Ciencias Humanas", course_name = "RESERVA DOS",
       teacher = "Docente R 1.2", eligible_n = 28, enrolled_total = 31),
  list(operational_code = "R 1.3", titular_operational_code = "CH 1",
       sample_role = "chain_reserve", replacement_order = 3,
       faculty = "Letras y Ciencias Humanas", course_name = "RESERVA TRES",
       teacher = "Docente R 1.3", eligible_n = 26, enrolled_total = 29),
  list(operational_code = "CH 2", titular_operational_code = "CH 2",
       sample_role = "titular", faculty = "Ciencias Sociales",
       course_name = "CURSO DOS", teacher = "Docente CH 2",
       eligible_n = 25, enrolled_total = 28),
  list(operational_code = "R 2.1", titular_operational_code = "CH 2",
       sample_role = "chain_reserve", replacement_order = 1,
       faculty = "Ciencias Sociales", course_name = "OTRA RESERVA",
       teacher = "Docente R 2.1", eligible_n = 22, enrolled_total = 24)
)

.ce24_extras <- function() list(
  list(operational_code = "EXTRA 1", titular_operational_code = "",
       sample_role = "extra_reserve_pool", faculty = "Arte y Diseño",
       course_name = "CURSO EXTRA", teacher = "Docente E1", eligible_n = 15)
)

.ce24_PROFUNDIDAD <- 4L   # la cadena de CH 1: titular + R 1.1 + R 1.2 + R 1.3

# --- geometría derivada de las MISMAS specs que usan los generadores ---------

.ce24_A <- function() AULAS_AGENDADAS_ANCHO_BLOQUE
.ce24_titulos_campo <- function() prosecnurapp:::.calg_titulos_campo()
.ce24_ancho <- function() 1L + .ce24_A() + length(.ce24_titulos_campo())
.ce24_idx <- function(campo) {
  which(vapply(AULAS_AGENDADAS_BLOQUE,
               function(s) identical(s$campo, campo), logical(1)))[[1]]
}
# Columna (1-based) de un campo de AGENDA en el bloque b de la hoja de campo.
.ce24_col_agenda <- function(campo, b) {
  (b - 1L) * .ce24_ancho() + 1L + .ce24_idx(campo)
}
# Columna (1-based) de un título del PARTE en el bloque b.
.ce24_col_parte <- function(titulo, b) {
  (b - 1L) * .ce24_ancho() + 1L + .ce24_A() +
    which(.ce24_titulos_campo() == titulo)[[1]]
}
# Celda por posición, con NA legible cuando la columna NO existe: así el rojo
# dice «esperaba R 1.3, no hay columna» y no un «undefined columns selected».
.ce24_celda <- function(hoja, fila, col) {
  if (col > ncol(hoja) || fila > nrow(hoja)) return(NA_character_)
  as.character(hoja[fila, col])
}
.ce24_values <- function(hoja) {
  lapply(seq_len(nrow(hoja)), function(i) as.list(as.character(hoja[i, ])))
}
# Teclear una celda en el rectángulo de values (lo que hace el equipo en el
# Sheets vivo), extendiendo la fila si hace falta.
.ce24_teclear <- function(values, fila, col, valor) {
  f <- as.list(values[[fila]] %||% list())
  while (length(f) < col) f[[length(f) + 1L]] <- ""
  f[[col]] <- valor
  values[[fila]] <- f
  values
}

# --- 0. VERDE-CONTEXTO: la aritmética casa con las hojas reales --------------

test_that("contexto B24: la aritmética de bloques casa con las hojas que producen los generadores", {
  # Si un generador cambia de forma, los rojos de abajo pasarían a significar
  # «conté mal»; este test lo separa (el patrón de test-monitoreo-aulas-libro-
  # arrastre.R).
  ag <- aulas_libro_hoja_agendadas(.ce24_plan())
  expect_identical(ncol(ag), 1L + .ce24_PROFUNDIDAD * .ce24_A())
  cab_ag <- as.character(unlist(ag[1, ], use.names = FALSE))
  expect_identical(cab_ag[[1L + .ce24_A() + .ce24_idx("operational_code")]],
                   "CURSO-HORARIO R1")

  ap <- aulas_libro_hoja_aplicadas(.ce24_plan())
  campos <- as.character(unlist(ap[2, ], use.names = FALSE))
  inicios <- which(campos == "ID MATCH")
  expect_gt(length(inicios), 0L)
  # El bloque 1 es ID MATCH + agenda v4 + parte v4, derivado de las dos specs.
  fin1 <- if (length(inicios) > 1L) inicios[[2]] - 1L else length(campos)
  expect_identical(campos[inicios[[1]]:fin1],
                   c("ID MATCH", prosecnurapp:::.calg_titulos_agenda(),
                     .ce24_titulos_campo()))
  # Y las filas de datos son la 3 (CH 1) y la 4 (CH 2).
  expect_identical(.ce24_celda(ap, 3L, .ce24_col_agenda("operational_code", 1L)), "CH 1")
  expect_identical(.ce24_celda(ap, 4L, .ce24_col_agenda("operational_code", 1L)), "CH 2")
})

# --- 1. ROJO: profundidad espejo de agendadas, no 3 bloques fijos ------------

test_that("B24: la hoja de campo tiene tantos bloques como el eslabón más largo", {
  ap <- aulas_libro_hoja_aplicadas(.ce24_plan())
  # Con la cadena de profundidad 4, agendadas reparte 4 bloques (contexto de
  # arriba); la hoja de campo tiene que repartir los MISMOS.
  expect_identical(ncol(ap), .ce24_PROFUNDIDAD * .ce24_ancho())
  bandas <- Filter(nzchar, as.character(unlist(ap[1, ], use.names = FALSE)))
  expect_identical(bandas,
                   c("TITULAR", "REEMPLAZO 1", "REEMPLAZO 2", "REEMPLAZO 3"))
})

# --- 2. ROJO: cada bloque ES el eslabón b --------------------------------------

test_that("B24: el bloque b lleva la agenda del eslabón b, y el eslabón ausente queda vacío", {
  ap <- aulas_libro_hoja_aplicadas(.ce24_plan())

  # El titular sigue en el bloque 1 (guardia de que nada se corre).
  expect_identical(.ce24_celda(ap, 3L, .ce24_col_agenda("operational_code", 1L)), "CH 1")
  expect_identical(.ce24_celda(ap, 3L, .ce24_col_parte("MATRICULADOS ELEGIBLES", 1L)), "40")

  # La cadena de CH 1, eslabón por eslabón. Hoy los bloques 2-3 salen con la
  # agenda VACÍA y el bloque 4 no existe.
  expect_identical(.ce24_celda(ap, 3L, .ce24_col_agenda("operational_code", 2L)), "R 1.1")
  expect_identical(.ce24_celda(ap, 3L, .ce24_col_agenda("teacher", 2L)), "Docente R 1.1")
  expect_identical(.ce24_celda(ap, 3L, .ce24_col_agenda("operational_code", 3L)), "R 1.2")
  expect_identical(.ce24_celda(ap, 3L, .ce24_col_agenda("operational_code", 4L)), "R 1.3")
  # Los denominadores que ABREN el parte son los del eslabón, no los del
  # titular repetidos: el % de asistencia de R 1.1 se juzga contra SUS 30.
  expect_identical(.ce24_celda(ap, 3L, .ce24_col_parte("MATRICULADOS ELEGIBLES", 2L)), "30")

  # La cadena corta (CH 2, profundidad 2): su eslabón 2 y NADA más — un
  # eslabón que la cadena no tiene se queda vacío, no se inventa (la misma
  # regla que agendadas pinea en test-carga-aulas-libro-recibio-correo.R).
  expect_identical(.ce24_celda(ap, 4L, .ce24_col_agenda("operational_code", 2L)), "R 2.1")
  expect_identical(.ce24_celda(ap, 4L, .ce24_col_agenda("operational_code", 3L)), "")
  expect_identical(.ce24_celda(ap, 4L, .ce24_col_agenda("operational_code", 4L)), "")
})

# --- 3. ROJO: el parte de una reserva cae en SU eslabón, fila a fila ----------

test_that("B24: el parte registrado de una reserva se siembra en su eslabón y no gana fila propia", {
  parte <- list(operational_code = "R 1.2", intento = 1L,
                observed_students = 12, refusals = 2, duplicates = 1,
                effective_surveys = 9, applied_by = "Equipo B",
                application_status = "APLICADA")
  ap <- aulas_libro_hoja_aplicadas(.ce24_plan(), partes = list(parte))

  # Fila a fila con agendadas (el M1 de 2025): una fila por CADENA. Hoy la
  # reserva con parte gana una fila propia y el espejo se rompe.
  cods_b1 <- vapply(3:nrow(ap), function(r) {
    .ce24_celda(ap, r, .ce24_col_agenda("operational_code", 1L))
  }, character(1))
  expect_identical(cods_b1, c("CH 1", "CH 2"))

  # Y sus cifras viven en el bloque de SU eslabón (R 1.2 = bloque 3 de CH 1).
  expect_identical(.ce24_celda(ap, 3L, .ce24_col_parte("CANTIDAD DE ENCUESTAS APLICADAS", 3L)), "9")
  expect_identical(.ce24_celda(ap, 3L, .ce24_col_parte("APLICADOR", 3L)), "Equipo B")
})

# --- 4. ROJO: tecleado en REEMPLAZO 3, vuelve por el código de esa reserva ----

test_that("B24: un parte tecleado en el bloque REEMPLAZO 3 vuelve bajo el código de la reserva", {
  vals <- .ce24_values(aulas_libro_hoja_aplicadas(.ce24_plan()))
  # El equipo teclea el parte del eslabón R 1.3 en SU bloque (fila de CH 1).
  vals <- .ce24_teclear(vals, 3L, .ce24_col_parte("CANTIDAD DE ASISTENTES", 4L), "18")
  vals <- .ce24_teclear(vals, 3L, .ce24_col_parte("CANTIDAD DE ENCUESTAS APLICADAS", 4L), "15")
  vals <- .ce24_teclear(vals, 3L, .ce24_col_parte("STATUS DE APLICACIÓN", 4L), "APLICADA")

  partes <- aulas_libro_desde_valores(vals, "aplicadas")
  codigos <- vapply(partes, function(p) as.character(p$operational_code %||% ""), character(1))
  # POR CÓDIGO del eslabón: el código del bloque llega sembrado y se lee como
  # valor — no bajo el del titular vía herencia. Hoy el bloque 4 no existe y
  # el parte desaparece entero.
  expect_identical(codigos, "R 1.3")
  # Guardia del rojo literal: sin el parte no hay cifras que mirar y un
  # `partes[[1]]` aquí convertiría el fallo en un error de subíndice.
  if (length(partes) != 1L) return(invisible(NULL))
  expect_equal(as.numeric(partes[[1]]$observed_students), 18)
  expect_equal(as.numeric(partes[[1]]$effective_surveys), 15)
  expect_identical(as.character(partes[[1]]$application_status), "APLICADA")
})

# --- 5. VERDE-GUARDIA: la herencia A16 queda de red y nadie inventa partes ----

test_that("B24 guardia: un bloque con el código BORRADO hereda del titular (red A16)", {
  # El flujo normal usa el código propio (test de arriba); la herencia queda
  # SOLO para celdas borradas. Se borra el código del bloque 2 de CH 2 y se
  # teclea un parte: vuelve bajo CH 2. Verde hoy y verde tras el fix.
  vals <- .ce24_values(aulas_libro_hoja_aplicadas(.ce24_plan()))
  vals <- .ce24_teclear(vals, 4L, .ce24_col_agenda("operational_code", 2L), "")
  vals <- .ce24_teclear(vals, 4L, .ce24_col_parte("CANTIDAD DE ASISTENTES", 2L), "20")
  vals <- .ce24_teclear(vals, 4L, .ce24_col_parte("STATUS DE APLICACIÓN", 2L), "APLICADA")

  partes <- aulas_libro_desde_valores(vals, "aplicadas")
  codigos <- vapply(partes, function(p) as.character(p$operational_code %||% ""), character(1))
  expect_identical(codigos, "CH 2")
  expect_equal(as.numeric(partes[[1]]$observed_students), 20)
})

test_that("B24 guardia: un libro nuevo con códigos sembrados no inventa partes", {
  # La guarda de «cadena que nunca se aplicó» (sin estado y sin asistentes no
  # hay parte) tiene que sostener el modelo nuevo: sembrar la agenda del
  # eslabón en los bloques 2+ no puede fabricar partes fantasma.
  vals <- .ce24_values(aulas_libro_hoja_aplicadas(.ce24_plan()))
  expect_length(aulas_libro_desde_valores(vals, "aplicadas"), 0L)
})

# --- 6. el arrastre de Sheets: todos los eslabones, y el bloque b del bloque b -

test_that("B24: el arrastre cubre TODOS los eslabones de la hoja de campo", {
  # ROJO por el recorte: `.malar_bloques_arrastre` toma min(bloques de la hoja,
  # profundidad) y la hoja de hoy solo trae 3 — el REEMPLAZO 3 se queda sin
  # fórmula aunque agendadas tenga su bloque.
  vals <- .ce24_values(aulas_libro_hoja_aplicadas(.ce24_plan()))
  expect_identical(prosecnurapp:::.malar_bloques_arrastre(vals, .ce24_plan()),
                   .ce24_PROFUNDIDAD)
})

test_that("B24 guardia: el bloque b arrastra del bloque b de agendadas, no del titular", {
  # La respuesta a la investigación del contrato: `.malar_celdas_bloque` YA
  # referencia `1 + (b-1)*paso + j` — el bloque REEMPLAZO n enseña la agenda de
  # la reserva n. Se pinea para que el fix no lo pueda regresar a «todos copian
  # del titular». Aritmética desde la spec, letra con int2col.
  A <- .ce24_A()
  celdas <- prosecnurapp:::.malar_celdas_bloque("Aulas Agendadas", 4L, 3L)
  expect_length(celdas, 1L + A)
  # ID MATCH ancla la fila de la cadena…
  expect_identical(as.character(celdas[[1]]), "=TO_TEXT('Aulas Agendadas'!A3)")
  # …y el primer campo de agenda del bloque 4 vive 3 bloques más allá.
  letra <- openxlsx::int2col(1L + 3L * A + 1L)
  expect_identical(as.character(celdas[[2]]),
                   sprintf("=TO_TEXT('Aulas Agendadas'!%s3)", letra))
})

# --- 7. VERDE-GUARDIA: las hojas Extra (B14) siguen a un bloque ----------------

test_that("B24 guardia: la hoja de campo Extra sigue siendo un solo bloque", {
  hx <- aulas_libro_hoja_aplicadas_extra(.ce24_extras())
  expect_identical(ncol(hx), .ce24_ancho())
  expect_identical(as.character(hx[1, 1]), "EXTRA")
  expect_identical(.ce24_celda(hx, 3L, .ce24_col_agenda("operational_code", 1L)),
                   "EXTRA 1")
})

# --- 8. ROJO: la geometría derivada del xlsx recomputa con la profundidad -----

test_that("B24: bandas por eslabón y semáforo del xlsx llegan hasta el REEMPLAZO 3", {
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.ce24_plan(), libro)

  # La banda del bloque 4 lleva el color del eslabón 4 — el MISMO que ya pinta
  # agendadas para ese eslabón (test-carga-aulas-libro-color-eslabon.R pinea
  # las dos hojas a profundidad 3; aquí el eslabón que hoy NO existe en campo).
  esperado <- paste0("FF", toupper(sub("^#", "",
    aulas_libro_colores_eslabon(.ce24_PROFUNDIDAD)[[.ce24_PROFUNDIDAD]])))
  banda_ag <- relleno_de_celda(libro, "Aulas Agendadas",
                               1L + 3L * .ce24_A() + 2L, 1)
  expect_identical(banda_ag, esperado)
  banda_campo <- relleno_de_celda(libro, "Aulas Aplicadas (Campo)",
                                  3L * .ce24_ancho() + 3L, 1)
  expect_identical(banda_campo, esperado)

  # Y el semáforo de STATUS DE APLICACIÓN tiñe también el bloque 4: la columna
  # se deriva del ancho vigente, así que con el bloque presente recomputa sola.
  letra_status <- openxlsx::int2col(.ce24_col_parte("STATUS DE APLICACIÓN", 4L))
  expect_true(
    letra_status %in% columnas_con_formato_condicional(libro, "Aulas Aplicadas (Campo)"),
    info = sprintf("sin semáforo en la columna %s (STATUS DE APLICACIÓN del bloque 4)",
                   letra_status)
  )
})
