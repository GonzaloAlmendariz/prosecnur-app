# «Base de control», la tercera hoja, tiene que LLEGAR a la vista.
#
# El lector existia desde el 2026-08-16 y la cola daba el punto por hecho, pero
# se habia cerrado en el lector: las filas entraban a `monitoreo_aulas_control` y
# no las consumia nadie. El unico test que las mencionaba comprobaba que la
# CLAVE estuviera en la sesion —lo decia en su propio nombre— y eso pasa igual
# con el dato muerto. Estos asertos miran el payload, que es donde la app lo lee.

test_that("el publicador distingue el aula sin controles de la que tiene el control en cero", {
  filas <- list(
    list(operational_code = "CH 1", sent_total = 25, last_response_day = "2026-08-11",
         women_n = 15, men_n = 10, schedule_range = "EN RANGO"),
    # Misma aula del libro, con los controles todavia sin llenar: no es un aula
    # que salga mal, es un aula que nadie ha revisado.
    list(operational_code = "CH 2", enrolled_total = 35),
    # El control en CERO si es una medida: el grupo cuenta como lleno.
    list(operational_code = "CH 3", sent_total = 0)
  )
  pub <- monitoreo_aulas_control_publicado(filas)

  expect_length(pub, 3L)
  expect_setequal(unlist(pub[[1]]$grupos_con_dato), c("cuenta", "duracion", "cuotas", "horario"))
  expect_length(unlist(pub[[2]]$grupos_con_dato), 0L)
  # Si `.mac_con_dato` tratara el 0 como ausencia —el error facil—, este aserto
  # cae: un 0 enviadas es un hallazgo, no una casilla vacia.
  expect_identical(unlist(pub[[3]]$grupos_con_dato), "cuenta")
})

test_that("los grupos de identidad no inflan la cobertura del control", {
  # `curso` y `campo` los escribe el generador del libro, asi que vienen llenos
  # siempre. Contarlos daria una cobertura del control de calidad que no existe.
  res <- monitoreo_aulas_control_resumen(list(
    list(operational_code = "CH 1", wave = "M1", course_name = "Curso",
         applied_by = "Equipo A", application_status = "APLICADA")
  ))

  expect_identical(res$aulas, 1L)
  expect_setequal(vapply(res$grupos, function(g) g$clave, character(1)),
                  c("cuenta", "duracion", "cuotas", "horario"))
  expect_true(all(vapply(res$grupos, function(g) g$aulas_con_dato, integer(1)) == 0L))
})

test_that("el control del libro viaja al payload del tablero", {
  plan <- list(list(
    classroom_id = "CH 1", operational_code = "CH 1", faculty = "Ciencias",
    eligible_n = 30, expected_valid = 20, sample_role = "titular",
    sample_status = "AGENDADA"
  ))
  cfg <- list(control = list(
    list(operational_code = "CH 1", classroom_id = "CH 1",
         sent_total = 25, sent_vs_population = 0.83, threshold_population = 21,
         women_n = 15, men_n = 10)
  ))
  d <- monitoreo_aulas_dashboard(plan, data.frame(), cfg)

  # El aserto que fallaba antes de cablearlo: sin la linea del motor el bloque
  # no existe, y sin la de `carga_aulas_libro` la config llega vacia.
  expect_length(d$control_calidad, 1L)
  expect_identical(d$control_calidad[[1]]$operational_code, "CH 1")
  expect_identical(d$control_calidad[[1]]$sent_total, 25)
  expect_identical(d$control_calidad_resumen$aulas, 1L)
  cuenta <- Filter(function(g) identical(g$clave, "cuenta"), d$control_calidad_resumen$grupos)
  expect_identical(cuenta[[1]]$aulas_con_dato, 1L)
})

test_that("un libro sin la hoja de control publica el bloque vacio, no lo omite", {
  # La vista necesita poder decir «este libro no trae control» (C3). Un bloque
  # ausente y uno vacio se leen distinto desde el frontend.
  d <- monitoreo_aulas_dashboard(
    list(list(classroom_id = "CH 1", operational_code = "CH 1", eligible_n = 30)),
    data.frame(), list()
  )

  expect_true("control_calidad" %in% names(d))
  expect_length(d$control_calidad, 0L)
  expect_identical(d$control_calidad_resumen$aulas, 0L)
})

test_that("la importacion deja el control donde el tablero lo busca", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  path <- withr::local_tempfile(fileext = ".xlsx")
  unidades <- list(list(
    operational_code = "CH 1", classroom_id = "CH 1", wave = "M1",
    course_name = "Curso 1", label = "Lun 08:00", schedule = "Lun 08:00",
    faculty = "Ciencias", level = "Pregrado", enrolled_total = 40, eligible_n = 30,
    sample_status = "AGENDADA", sample_role = "titular", replacement_order = 0,
    replacement_for = ""
  ))
  aulas_libro_generar(unidades, path)
  session_set(sid, "monitoreo_config", list(aulas_universitarias = list(enabled = TRUE)))
  aulas_libro_importar_en_sesion(sid, path)

  cfg <- session_get(sid)$monitoreo_config$aulas_universitarias
  # Sin la linea de `carga_aulas_libro.R` esta clave no existe y el tablero
  # publica cero aulas aunque el libro traiga la hoja entera.
  expect_length(cfg$control, 1L)
  expect_identical(cfg$control[[1]]$operational_code, "CH 1")
})
