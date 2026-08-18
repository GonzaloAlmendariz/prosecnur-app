# El libro va y vuelve sin perder el operativo.
#
# La vara V12 del GOAL decia «generar y reimportar cierra el circulo sin perder
# la cadena ni los enlaces», y eso se cumplia. Lo que no se media era el trabajo
# del EQUIPO: el generador escribia las columnas de la persona siempre en
# blanco, asi que regenerar el libro de un estudio en marcha borraba los estados
# de agendamiento, el ciclo de contacto y los partes de campo ya registrados.
#
# Un libro NUEVO sigue saliendo con esas columnas vacias: no hay nada que
# devolver. La diferencia esta en el libro de un estudio que ya arranco.

.rt_plan <- function() list(
  list(classroom_id = "A-01", operational_code = "CH 1", label = "Aula 101",
       course_name = "Curso 1", teacher = "Docente 1", faculty = "Ciencias",
       sample_role = "titular", wave = "M1", orden = 1,
       eligible_n = 30, enrolled_total = 34, expected_valid = 20,
       sample_status = "agendada", contact_medium = "Correo",
       contact_attempts = 2, scheduled_date = "2026-08-20",
       link = "https://ee.kobotoolbox.org/x/abc?d[collectorID]=CH%201"),
  list(classroom_id = "A-04", operational_code = "CH 4", label = "Aula 104",
       course_name = "Curso 4", teacher = "Docente 4", faculty = "Letras",
       sample_role = "titular", wave = "M1", orden = 4,
       eligible_n = 25, enrolled_total = 28, expected_valid = 18,
       sample_status = "reemplazada", contact_attempts = 3),
  list(classroom_id = "A-06", operational_code = "R 4.1", label = "Aula 106",
       course_name = "Curso 6", teacher = "Docente 6", faculty = "Letras",
       sample_role = "chain_reserve", replacement_for = "CH 4",
       # Ver `test-carga-aulas-libro-generar.R`: los dos campos viajan juntos.
       titular_operational_code = "CH 4", wave = "M1",
       orden = 6, eligible_n = 22, enrolled_total = 24, expected_valid = 16,
       sample_status = "en_reserva", contact_attempts = 1,
       # El lector de «Aulas Agendadas» guarda la columna OBSERVACIONES aqui.
       replacement_note = "El docente pidio reprogramar")
)

.rt_partes <- function() list(
  list(operational_code = "CH 1", intento = 1L, observed_students = 22,
       refusals = 1, duplicates = 1, effective_surveys = 20,
       applied_by = "Equipo A", application_status = "APLICADA"),
  # Una reserva activada se aplica igual que un titular.
  list(operational_code = "R 4.1", intento = 1L, observed_students = 12,
       refusals = 1, duplicates = 0, effective_surveys = 9,
       applied_by = "Equipo B", application_status = "APLICADA")
)

.rt_vuelta <- function(plan = .rt_plan(), partes = .rt_partes()) {
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(plan, libro, partes = partes)
  aulas_libro_importar(libro)
}

.rt_campo <- function(filas, k) {
  vapply(filas, function(r) as.character(r[[k]] %||% ""), character(1))
}

test_that("el plan vuelve entero: unidades, cadena y enlaces", {
  v <- .rt_vuelta()
  expect_identical(sort(.rt_campo(v$plan, "operational_code")), c("CH 1", "CH 4", "R 4.1"))
  reemplaza <- .rt_campo(v$plan, "replacement_for")
  expect_identical(reemplaza[.rt_campo(v$plan, "operational_code") == "R 4.1"], "CH 4")
  enlaces <- .rt_campo(v$plan, "link")
  expect_true(any(grepl("collectorID", enlaces, fixed = TRUE)))
})

test_that("el agendamiento ya registrado NO se borra al regenerar", {
  v <- .rt_vuelta()
  codigos <- .rt_campo(v$plan, "operational_code")
  estados <- setNames(.rt_campo(v$plan, "sample_status"), codigos)
  intentos <- setNames(.rt_campo(v$plan, "contact_attempts"), codigos)

  # El control: escribiendo "" en estas columnas —como hacia antes— los tres
  # estados salen vacios y este bloque entero se cae.
  expect_identical(unname(estados[["CH 1"]]), "agendada")
  expect_identical(unname(estados[["CH 4"]]), "reemplazada")
  expect_identical(unname(estados[["R 4.1"]]), "en_reserva")
  expect_identical(unname(intentos[["CH 1"]]), "2")
  expect_identical(unname(intentos[["CH 4"]]), "3")
})

test_that("los partes de campo vuelven, incluido el de una reserva", {
  v <- .rt_vuelta()
  expect_length(v$partes, 2L)
  por_codigo <- setNames(v$partes, vapply(v$partes, function(p) as.character(p$operational_code), character(1)))

  # El control de la reserva: filtrando la hoja por `sample_role == "titular"`
  # —como hacia antes— este parte no existe. En el estudio de 2025, 26 de los
  # 196 partes son de reservas.
  expect_true("R 4.1" %in% names(por_codigo))
  r <- por_codigo[["R 4.1"]]
  expect_identical(as.numeric(r$observed_students), 12)
  expect_identical(as.numeric(r$effective_surveys), 9)
  expect_identical(as.character(r$applied_by), "Equipo B")

  t1 <- por_codigo[["CH 1"]]
  expect_identical(as.numeric(t1$refusals), 1)
  expect_identical(as.numeric(t1$duplicates), 1)
})

test_that("un libro nuevo sigue saliendo con las columnas de la persona vacias", {
  # La decision original era correcta para un estudio que arranca: rellenarlas
  # seria inventar campo. Lo que estaba mal era aplicarla tambien al estudio en
  # marcha.
  plan <- lapply(.rt_plan(), function(u) {
    for (k in c("sample_status", "contact_medium", "contact_attempts", "scheduled_date")) u[[k]] <- NULL
    u
  })
  v <- .rt_vuelta(plan = plan, partes = list())
  expect_true(all(!nzchar(.rt_campo(v$plan, "sample_status"))))
  expect_length(v$partes, 0L)
  # Pero la identidad del plan sigue completa.
  expect_identical(sort(.rt_campo(v$plan, "operational_code")), c("CH 1", "CH 4", "R 4.1"))
})

test_that("las observaciones del agendamiento sobreviven al round-trip", {
  # El lector guarda la columna OBSERVACIONES en `replacement_note` y el
  # generador leia `notes`: 190 observaciones del estudio de 2025 se perdian en
  # cada regeneracion. El control: leyendo solo `notes`, esto sale vacio.
  v <- .rt_vuelta()
  notas <- .rt_campo(v$plan, "replacement_note")
  codigos <- .rt_campo(v$plan, "operational_code")
  expect_identical(unname(setNames(notas, codigos)[["R 4.1"]]), "El docente pidio reprogramar")
})
