# **Publicar entiende los cambios manuales de la hoja de los aplicadores.**
#
# Dictado de Gonzalo (2026-09-09): «el sheets de distribución lo arma la app
# pero en el camino puede haber cambios manuales con respecto a quién recibe
# qué, y la app debe ser robusta en entender esos cambios».
#
# Lo que se sujeta aquí: publicar LEE esa hoja antes de rehacer «Asignación de
# aplicadores», adopta lo que esté escrito, y NO escribe en ella. Y cuando no
# puede leerla, publica igual y dice por qué no adoptó.

.mapa_cab <- function() as.list(prosecnurapp:::.alpa_CABECERA)

.mapa_fila <- function(quien, cod, dia = "Lunes", fecha = "07/09") {
  as.list(c(quien, dia, fecha, "09:30", "09:45", "10:00 a 10:30", cod,
            "A101", "Ciencias", "Cálculo", "Docente Uno", "POR APLICAR"))
}

.mapa_plan <- function() list(
  list(operational_code = "CH 1", classroom_id = "aula_1", sample_role = "titular",
       sample_status = "agendada", faculty = "Ciencias", course_name = "Cálculo",
       teacher = "Docente Uno", scheduled_venue = "A101",
       scheduled_date = "2026-09-07", scheduled_time = "10:00", eligible_n = 40,
       expected_valid = 20),
  list(operational_code = "CH 2", classroom_id = "aula_2", sample_role = "titular",
       sample_status = "agendada", faculty = "Ciencias", course_name = "Álgebra",
       teacher = "Docente Dos", scheduled_venue = "A102",
       scheduled_date = "2026-09-07", scheduled_time = "12:00", eligible_n = 40,
       expected_valid = 20)
)

# La disponibilidad ES la lista de personas: sin envoltorio `personas`.
.mapa_sesion <- function() list(
  monitoreo_aulas_disponibilidad = list(
    list(nombre = "Ana Prueba"), list(nombre = "Otro Aplicador")
  )
)

test_that("adopta lo que el coordinador escribió a mano, tal cual", {
  mock <- .sheets_api_mock()
  mock$seed("Semana 1", values = c(list(.mapa_cab()), list(
    .mapa_fila("Otro Aplicador", "CH 1"), .mapa_fila("Ana Prueba", "CH 2"))))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  out <- prosecnurapp:::.malp_adoptar_distribucion(
    list(distribucion_sheets = list(spreadsheet_id = "sheet_dist")),
    .mapa_plan(), .mapa_sesion())
  expect_true(out$ok)
  expect_equal(out$hoja, "Semana 1")
  expect_equal(out$fijadas[["CH 1"]], aulas_nombre_aplicador("Otro Aplicador"))
  expect_equal(out$fijadas[["CH 2"]], aulas_nombre_aplicador("Ana Prueba"))
  expect_length(out$aplicadores_desconocidos, 0L)
  # **Leer no es tocar**: ni un solo request de escritura sobre esa hoja.
  expect_length(Filter(function(c) !identical(c$method, "GET"), mock$env$calls), 0L)
})

test_that("el roster sale de la lista de personas, no de un campo `personas`", {
  # El mutante que importa, y que se vio en vivo: preguntarle a la
  # disponibilidad por `$personas` devuelve NULL, el roster queda vacío y la
  # adopción cae a 5 de 86 con todos los nombres «no reconocidos». Aquí sería 0
  # de 2, que es la misma avería a escala de test.
  expect_equal(prosecnurapp:::.malp_roster(.mapa_sesion()),
               c(aulas_nombre_aplicador("Ana Prueba"),
                 aulas_nombre_aplicador("Otro Aplicador")))
  expect_length(prosecnurapp:::.malp_roster(list()), 0L)
})

test_that("un nombre que no es del equipo se declara y no se adopta a ciegas", {
  mock <- .sheets_api_mock()
  mock$seed("Semana 1", values = c(list(.mapa_cab()), list(
    .mapa_fila("Persona Que No Existe", "CH 1"))))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  out <- prosecnurapp:::.malp_adoptar_distribucion(
    list(distribucion_sheets = list(spreadsheet_id = "sheet_dist")),
    .mapa_plan(), .mapa_sesion())
  expect_true(out$ok)
  expect_true(length(out$aplicadores_desconocidos) >= 1L)
})

test_that("sin destino recordado no adopta, y lo dice: no es un fallo", {
  # Hay estudios de aulas que no reparten aplicadores. Un `motivo` vacío haría
  # indistinguible «no había hoja» de «no se miró».
  out <- prosecnurapp:::.malp_adoptar_distribucion(list(), .mapa_plan(), .mapa_sesion())
  expect_false(out$ok)
  expect_true(out$omitida)
  expect_equal(out$motivo, "sin_destino")
  expect_length(out$fijadas, 0L)
})

test_that("si la hoja no se deja leer, publicar NO se cae: se declara el error", {
  # Un Sheets con permisos caídos no puede impedir que el operativo publique su
  # libro. Es la misma regla que ya gobierna la lectura previa del libro.
  testthat::local_mocked_bindings(
    .monitoreo_google_api = function(...) stop("403 sin permiso"))
  out <- prosecnurapp:::.malp_adoptar_distribucion(
    list(distribucion_sheets = list(spreadsheet_id = "sheet_dist")),
    .mapa_plan(), .mapa_sesion())
  expect_false(out$ok)
  expect_equal(out$motivo, "error")
  expect_match(out$error, "403")
  expect_length(out$fijadas, 0L)
})

test_that("una hoja con sólo cabecera no adopta nada y lo dice", {
  mock <- .sheets_api_mock()
  mock$seed("Semana 1", values = list(.mapa_cab()))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  out <- prosecnurapp:::.malp_adoptar_distribucion(
    list(distribucion_sheets = list(spreadsheet_id = "sheet_dist")),
    .mapa_plan(), .mapa_sesion())
  expect_equal(out$motivo, "hoja_vacia")
  expect_length(out$fijadas, 0L)
})

test_that("adoptar cambia el reparto: lo escrito manda sobre el sorteo", {
  # La prueba de que esto sirve para algo. El mismo plan repartido con y sin
  # las fijaciones de la hoja tiene que dar resultados distintos, y el CON
  # tiene que coincidir con lo que la hoja dice.
  plan <- .mapa_plan()
  disp <- list(list(nombre = "Ana Prueba"), list(nombre = "Otro Aplicador"))
  fijadas <- list("CH 1" = aulas_nombre_aplicador("Otro Aplicador"))
  con <- monitoreo_aulas_reparto(plan, disp, fijadas = fijadas, semilla = 0L)
  quien <- function(r, cod) {
    for (d in (r$dias %||% list())) for (x in (d$asignaciones %||% list()))
      if (identical(trimws(as.character(x$codigo)), cod))
        return(aulas_nombre_aplicador(x$aplicador))
    ""
  }
  expect_equal(quien(con, "CH 1"), aulas_nombre_aplicador("Otro Aplicador"))
})

# --- la asignación no se reescribe a ciegas ----------------------------------
#
# «Asignación de aplicadores» es de la app y se rehace entera en cada
# publicación, pero la verdad de quién va a qué aula vive en el Sheets de los
# veintidós. Si la app no pudo adoptar esa hoja y tampoco tiene fijaciones, lo
# que publicaría es un sorteo NUEVO: el 2026-09-09 eso dejó 38 de 85 aulas con
# dos aplicadores distintos entre las dos hojas. Dejar la de ayer es
# estrictamente mejor que publicar una que sabemos que puede mentir.

test_that("sin adoptar y sin fijaciones, una asignación QUE YA EXISTE no se toca", {
  expect_false(prosecnurapp:::.malp_publica_asignacion(list(), FALSE, TRUE))
})

test_that("la PRIMERA vez sí se siembra: una hoja que no existe no contradice a nadie", {
  expect_true(prosecnurapp:::.malp_publica_asignacion(list(), FALSE, FALSE))
})

test_that("con la hoja adoptada se reescribe, que es lo normal", {
  expect_true(prosecnurapp:::.malp_publica_asignacion(list(), TRUE, TRUE))
})

test_that("con fijaciones guardadas también, aunque hoy no se adoptara", {
  # Las fijaciones SON el respaldo: el sorteo ya no puede moverlas, así que lo
  # que se publica no puede contradecir lo comunicado.
  expect_true(prosecnurapp:::.malp_publica_asignacion(
    list(reparto_fijado = list(`CH 1` = "Ana Prueba")), FALSE, TRUE))
})
