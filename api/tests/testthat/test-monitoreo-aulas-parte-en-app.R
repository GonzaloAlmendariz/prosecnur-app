# El registro de campo hecho EN LA APP tiene que llegar a la hoja de campo.
#
# El defecto: el registro en-app escribe al plan (`POST /api/monitoreo/aulas/agenda`
# -> `monitoreo_aulas_update_agenda` -> `monitoreo_aulas_plan`), pero la hoja
# «Aulas Aplicadas (Campo)» del libro se llena desde
# `monitoreo_aulas_partes_campo`, cuyo UNICO escritor era importar un libro
# (`carga_aulas_libro.R`). Un estudio operado 100 % en la app generaba la hoja
# de campo EN BLANCO: el parte existia en el plan y el libro no lo decia.
#
# El contrato que se fija aqui vive en `monitoreo_aulas_parte_en_app.R`:
# - `monitoreo_aulas_parte_de_update(fila)`: de un update devuelve SOLO los
#   campos de parte, con nombres canonicos y los mismos alias que traduce
#   `monitoreo_aulas_update_agenda`. El CERO es dato; sin parte, lista vacia.
# - `monitoreo_aulas_partes_upsert(partes, updates, plan)`: PATCH sobre el parte
#   existente (codigo operativo + intento 1) o parte nuevo; resuelve el codigo
#   desde el plan cuando el update solo trae `classroom_id`/`collection_unit_id`.
# - `AULAS_LIBRO_CAMPOS_PROPIOS` deja de declarar el bloque de parte muerto:
#   cuatro de esos nombres (`attendees`, `applied_surveys`, `application_date`,
#   `field_notes`) no los emite NINGUN lector.

.pea_plan <- function() list(
  # La forma de las unidades copia la de `test-carga-aulas-libro-roundtrip.R`.
  list(classroom_id = "A-01", operational_code = "CH 1", label = "Aula 101",
       course_name = "Curso 1", teacher = "Docente 1", faculty = "Ciencias",
       sample_role = "titular", wave = "M1", orden = 1,
       eligible_n = 30, enrolled_total = 34, expected_valid = 20),
  list(classroom_id = "A-02", operational_code = "CH 2", label = "Aula 102",
       course_name = "Curso 2", teacher = "Docente 2", faculty = "Letras",
       sample_role = "titular", wave = "M1", orden = 2,
       eligible_n = 28, enrolled_total = 31, expected_valid = 18)
)

# Un registro en-app tipico: lo que la superficie de campo manda al plan.
.pea_update_parte <- function() list(
  operational_code = "CH 1",
  observed_students = 25, refusals = 2, duplicates = 1, effective_surveys = 22,
  applied_by = "Aplicador X", actual_room = "B203",
  applied_at = "2026-09-08", field_note = "ok"
)

# La columna de un titulo, buscada en la FILA 2 de cabecera: la hoja de campo
# lleva dos filas (grupo y campo) y el lector toma los titulos de la segunda.
.pea_col <- function(hoja, titulo) {
  campos <- as.character(unlist(hoja[2, ], use.names = FALSE))
  i <- which(campos == titulo)
  if (!length(i)) stop(sprintf("La hoja no tiene la columna «%s».", titulo))
  i[[1]]
}

.pea_celda <- function(hoja, fila, titulo) {
  as.character(hoja[fila, .pea_col(hoja, titulo)])
}

test_that("un parte registrado EN LA APP llega a la hoja de campo del libro", {
  # El flujo completo del estudio sin Excel: registrar en la app, derivar el
  # parte, generar la hoja. Antes el parte moria en el plan y la hoja salia
  # en blanco.
  updates <- list(.pea_update_parte())
  plan2 <- monitoreo_aulas_update_agenda(.pea_plan(), updates)
  partes <- monitoreo_aulas_partes_upsert(list(), updates, plan2)
  hoja <- aulas_libro_hoja_aplicadas(plan2, intentos = 3, partes = partes)

  cursos <- as.character(hoja[[.pea_col(hoja, "CURSO-HORARIO")]])
  fila <- which(cursos == "CH 1")[[1]]
  expect_identical(.pea_celda(hoja, fila, "CANTIDAD DE ASISTENTES"), "25")
  expect_identical(.pea_celda(hoja, fila, "CANTIDAD DE ENCUESTAS APLICADAS"), "22")
  expect_identical(.pea_celda(hoja, fila, "APLICADOR"), "Aplicador X")

  # Y los alias que `monitoreo_aulas_update_agenda` traduce, el extractor los
  # traduce igual: son la MISMA superficie de entrada, no dos vocabularios.
  parte <- monitoreo_aulas_parte_de_update(list(
    operational_code = "CH 1", applied_date = "2026-09-08",
    aplicador = "Aplicador X", observaciones = "ok"))
  expect_identical(as.character(parte$applied_at), "2026-09-08")
  expect_identical(as.character(parte$applied_by), "Aplicador X")
  expect_identical(as.character(parte$field_note), "ok")
})

test_that("el upsert es un PATCH: no borra lo que el libro importado ya sabia", {
  # Un parte que entro por Excel viene con claves castellanas. Un registro
  # en-app posterior solo trae lo suyo: pisar el parte entero perderia
  # `asistentes` y `hora`, que el update no menciona.
  plan <- monitoreo_aulas_normalize_plan(.pea_plan())
  partes_libro <- list(list(operational_code = "CH 1", intento = 1L,
                            asistentes = 25, hora = "10:00"))
  upd <- list(list(operational_code = "CH 1", refusals = 3))
  partes <- monitoreo_aulas_partes_upsert(partes_libro, upd, plan)
  expect_length(partes, 1L)
  p <- partes[[1]]
  expect_identical(as.numeric(p$asistentes), 25)
  expect_identical(as.character(p$hora), "10:00")
  expect_identical(as.numeric(p$refusals), 3)
})

test_that("el CERO es dato: refusals = 0 se conserva en el parte", {
  # `0` rechazos es un hecho de campo, no una ausencia. Un filtro por
  # «truthiness» lo descartaria y el parte diria que no se pregunto.
  plan <- monitoreo_aulas_normalize_plan(.pea_plan())
  upd <- list(list(operational_code = "CH 1", refusals = 0))
  partes <- monitoreo_aulas_partes_upsert(list(), upd, plan)
  expect_length(partes, 1L)
  expect_true("refusals" %in% names(partes[[1]]))
  expect_identical(as.numeric(partes[[1]]$refusals), 0)

  parte <- monitoreo_aulas_parte_de_update(list(operational_code = "CH 1", refusals = 0))
  expect_true("refusals" %in% names(parte))
  expect_identical(as.numeric(parte$refusals), 0)
})

test_that("un update sin campos de parte NI crea NI toca partes", {
  # Agendar no es aplicar: mover una fecha o un estado no puede fabricar un
  # parte fantasma ni modificar el que ya existe. `application_status` solo se
  # toma de `operational_status` cuando el update trae ademas >= 1 campo de
  # parte, asi que este update —solo agenda— no cuenta como parte.
  plan <- monitoreo_aulas_normalize_plan(.pea_plan())
  previo <- list(list(operational_code = "CH 1", intento = 1L, asistentes = 25))
  upd <- list(list(operational_code = "CH 1", sample_status = "agendada",
                   operational_status = "agendada", scheduled_date = "2026-09-10"))
  expect_identical(monitoreo_aulas_partes_upsert(previo, upd, plan), previo)
  expect_length(monitoreo_aulas_partes_upsert(list(), upd, plan), 0L)
  expect_length(monitoreo_aulas_parte_de_update(upd[[1]]) %||% list(), 0L)
})

test_that("AULAS_LIBRO_CAMPOS_PROPIOS ya no declara el bloque muerto del parte", {
  # A2: el bloque «Parte de campo» de la constante no lo emitia ningun lector
  # —el de agenda no emite campos de parte, y cuatro nombres no los emite
  # NADIE—. Un campo declarado que nadie produce es una promesa muerta.
  muertos <- c("attendees", "applied_surveys", "application_date", "field_notes")
  expect_false(any(muertos %in% AULAS_LIBRO_CAMPOS_PROPIOS))
  canonicos <- c("observed_students", "effective_surveys", "actual_room",
                 "field_note", "application_status", "refusals", "duplicates")
  expect_false(any(canonicos %in% AULAS_LIBRO_CAMPOS_PROPIOS))
  # Los campos de agenda siguen siendo del libro: la poda es SOLO del parte.
  expect_true(all(c("label", "sample_status", "scheduled_date", "link", "notes")
                  %in% AULAS_LIBRO_CAMPOS_PROPIOS))
})

test_that("un update con solo classroom_id resuelve su codigo operativo en el plan", {
  # La superficie de registro puede llegar con el identificador interno del
  # aula, no con el codigo operativo. El parte se archiva por codigo —es la
  # clave de la hoja de campo—, asi que el upsert lo resuelve en el plan.
  # A-02 y no A-01: caer por defecto en la primera fila del plan tambien
  # daria un codigo, pero el equivocado.
  plan <- monitoreo_aulas_normalize_plan(.pea_plan())
  upd <- list(list(classroom_id = "A-02", observed_students = 12))
  partes <- monitoreo_aulas_partes_upsert(list(), upd, plan)
  expect_length(partes, 1L)
  expect_identical(as.character(partes[[1]]$operational_code), "CH 2")
  expect_identical(as.numeric(partes[[1]]$observed_students), 12)
})

# --- La HORA REAL de aplicación entra al parte (A12, 2026-09-03) ---
#
# «Sí me sirve, es una referencia histórica también» (Gonzalo). Hasta hoy la
# columna «HORA DE APLICACIÓN» quedaba vacía para todo registro hecho en la
# app: el papel la pedía, el lector del excel la leía y el vocabulario ya la
# conocía (alias, control, reconciliación), pero `.PARTE_APP_CAMPOS` archivaba
# ocho campos y ese no estaba.
#
# NO se pide dos veces: el formulario captura UN momento y ese momento alimenta
# las dos columnas —fecha a `applied_at`, hora a `applied_time`—, que es la
# respuesta a la pregunta abierta de A12.

test_that("la hora explícita del update se archiva en el parte", {
  parte <- monitoreo_aulas_parte_de_update(list(
    observed_students = 30, hora_aplicacion = "11:30"
  ))
  expect_identical(parte$applied_time, "11:30")

  # También por su nombre canónico.
  expect_identical(
    monitoreo_aulas_parte_de_update(list(refusals = 2, applied_time = "09:05"))$applied_time,
    "09:05"
  )
})

test_that("un momento con hora alimenta las DOS columnas sin teclearlo dos veces", {
  parte <- monitoreo_aulas_parte_de_update(list(
    observed_students = 28, applied_at = "2026-09-10 11:30"
  ))
  # La fecha queda limpia de hora y la hora viaja aparte: dos columnas, un
  # solo dato tecleado.
  expect_identical(parte$applied_at, "2026-09-10")
  expect_identical(parte$applied_time, "11:30")
})

test_that("una fecha sin hora no inventa una hora", {
  parte <- monitoreo_aulas_parte_de_update(list(
    observed_students = 28, applied_at = "2026-09-10"
  ))
  expect_identical(parte$applied_at, "2026-09-10")
  expect_null(parte$applied_time)
})

test_that("la hora tecleada gana sobre la derivada del momento", {
  # Si el equipo corrige la hora a mano, esa manda: la derivación es un
  # atajo, no una autoridad.
  parte <- monitoreo_aulas_parte_de_update(list(
    observed_students = 28, applied_at = "2026-09-10 11:30", hora_aplicacion = "12:15"
  ))
  expect_identical(parte$applied_time, "12:15")
  expect_identical(parte$applied_at, "2026-09-10")
})

test_that("un update de pura agenda con hora NO fabrica un parte", {
  # El invariante de siempre: agendar no es aplicar. Una hora suelta sin
  # ningún campo de parte no convierte una agenda en un registro de campo.
  expect_identical(
    monitoreo_aulas_parte_de_update(list(scheduled_time = "11:00", hora_aplicacion = "11:30")),
    list()
  )
})
