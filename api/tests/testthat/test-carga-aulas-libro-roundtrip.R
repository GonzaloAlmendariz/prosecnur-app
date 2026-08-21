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
       applied_by = "Equipo A", application_status = "APLICADA",
       # INCOHERENTE a proposito: 22 de 30 elegibles serian 0.733 y de 34
       # matriculados 0.647. Con un valor que no sale de ningun denominador de
       # la hoja, un generador que lo DERIVE en vez de devolverlo se cae.
       attendance_pct = 0.61),
  # Una reserva activada se aplica igual que un titular.
  list(operational_code = "R 4.1", intento = 1L, observed_students = 12,
       refusals = 1, duplicates = 0, effective_surveys = 9,
       applied_by = "Equipo B", application_status = "APLICADA",
       # Distinto del otro: una constante escrita por error tampoco pasa.
       attendance_pct = 0.38)
)

.rt_control <- function() list(
  # Valores que NO salen de ningun otro sitio del libro: si el generador los
  # derivara —de los matriculados, de los partes— en vez de devolverlos, no
  # darian estos numeros.
  list(operational_code = "CH 1", sent_total = 17, sent_vs_total = 0.5,
       # `VALIDADOR 1` es una CUENTA, no un nombre: en el estudio real llega
       # como entero y el lector lo lee como numero.
       validator_1 = 3, threshold_total = 21, valid_total = 1,
       women_n = 9, men_n = 8, quota_missing = 4,
       last_response_day = "2026-08-19")
)

.rt_vuelta <- function(plan = .rt_plan(), partes = .rt_partes(),
                       control = .rt_control()) {
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(plan, libro, partes = partes, control = control)
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

test_that("una fecha que Excel guardo como numero vuelve a ser fecha", {
  # **Defecto vivo, no una mejora.** Excel convierte solo lo que parece fecha:
  # en cuanto alguien escribe «11/08/2026» en la celda, el fichero guarda el
  # numero de serie. Medido con el propio generador: la misma hoja daba
  # «2026-08-11» escrita por la app y «46245» reescrita por Excel, y ese numero
  # viajaba tal cual al plan.
  plan <- list(
    list(operational_code = "CH 1", titular_operational_code = "CH 1",
         sample_role = "titular", faculty = "Derecho", course_name = "CURSO",
         eligible_n = 40, scheduled_date = "2026-08-11", sample_status = "AGENDADA")
  )
  path <- file.path(tempdir(), "roundtrip_fecha.xlsx")
  aulas_libro_generar(plan, path)

  # Lo que escribe la app: texto ISO.
  expect_equal(aulas_agendadas_leer(path)[[1]]$scheduled_date, "2026-08-11")

  # Lo que devuelve Excel: la misma celda como fecha de verdad.
  wb <- openxlsx::loadWorkbook(path)
  campos <- vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo, character(1))
  col <- 1L + which(campos == "scheduled_date")
  openxlsx::writeData(wb, "Aulas Agendadas", as.Date("2026-08-11"),
                      startCol = col, startRow = 2)
  otro <- file.path(tempdir(), "roundtrip_fecha2.xlsx")
  openxlsx::saveWorkbook(wb, otro, overwrite = TRUE)

  leido <- aulas_agendadas_leer(otro)[[1]]$scheduled_date
  expect_equal(leido, "2026-08-11")
  # El control: sin la conversion esto valdria "46245", que es lo que llegaba.
  expect_false(identical(leido, "46245"))
})

test_that("un numero que no es una fecha se queda como esta", {
  # El rango acota a 1954-2064. Un «25» —asistentes, intentos— no puede
  # convertirse en 1900-01-24 porque alguien lo puso en una columna de fecha.
  expect_equal(.caa_fecha("25"), "25")
  expect_equal(.caa_fecha("2026-08-11"), "2026-08-11")
  expect_equal(.caa_fecha(""), "")
  expect_equal(.caa_fecha("-"), "")
  # Un serial con hora: la parte entera es el dia.
  expect_equal(.caa_fecha("46245.75"), "2026-08-11")
})

test_that("las fechas se escriben como fechas y siguen releyendose", {
  # Una celda de texto con formato de fecha SIGUE siendo texto: Excel no la
  # ordena ni la filtra por rango, y «2026-8-9» se coloca antes que
  # «2026-08-11» porque compara letra a letra. Tipar la columna solo se puede
  # desde que el lector tolera el serial —antes la devolvia como «46245»—, asi
  # que las dos mitades se prueban juntas.
  plan <- list(
    list(operational_code = "CH 1", titular_operational_code = "CH 1",
         sample_role = "titular", faculty = "Derecho", course_name = "CURSO",
         eligible_n = 40, scheduled_date = "2026-08-11", sample_status = "AGENDADA"),
    list(operational_code = "CH 2", titular_operational_code = "CH 2",
         sample_role = "titular", faculty = "Gestión", course_name = "OTRO",
         eligible_n = 20, scheduled_date = "2026-08-09", sample_status = "AGENDADA")
  )
  path <- file.path(tempdir(), "roundtrip_tipos.xlsx")
  aulas_libro_generar(plan, path)

  # 1. La celda es un numero, no una cadena: es lo que permite ordenar.
  destino <- file.path(tempdir(), paste0("tipos_", as.integer(runif(1, 1, 1e6))))
  dir.create(destino)
  utils::unzip(path, exdir = destino)
  hojas <- openxlsx::getSheetNames(path)
  xml <- paste(readLines(file.path(destino, "xl", "worksheets",
                                   sprintf("sheet%d.xml", which(hojas == "Aulas Agendadas"))),
                         warn = FALSE), collapse = "")
  # El `formatCode` vive en `xl/styles.xml`, no en la hoja: lo que la hoja dice
  # es el TIPO de la celda, y es lo que decide si Excel puede ordenar. Una fecha
  # tipada sale como `t="n"` con el serial dentro; una de texto, como `t="s"`.
  celdas <- regmatches(xml, gregexpr('<c r="[A-Z]+[0-9]+"[^>]*>', xml))[[1]]
  numericas <- grep('t="n"', celdas, value = TRUE)
  expect_gt(length(numericas), 0)

  # 2. Y el viaje de vuelta sigue dando la fecha, no el serial.
  leido <- aulas_agendadas_leer(path)
  fechas <- vapply(leido, function(u) as.character(u$scheduled_date %||% ""), character(1))
  expect_true("2026-08-11" %in% fechas)
  expect_true("2026-08-09" %in% fechas)
  expect_false(any(grepl("^4[0-9]{4}$", fechas)))
})

test_that("el % de asistencia que puso el equipo vuelve al plan", {
  # Era la unica columna del parte que el generador dejaba en blanco, con un
  # comentario que decia que «la calcula la hoja del equipo con sus formulas»
  # —y el libro no llevaba formula ninguna—. El lector SI la leia, asi que
  # regenerar el libro de un estudio en marcha borraba el dato.
  v <- .rt_vuelta()
  pct <- setNames(
    vapply(v$partes, function(p) as.numeric(p$attendance_pct %||% NA), numeric(1)),
    .rt_campo(v$partes, "operational_code")
  )
  expect_equal(unname(pct[["CH 1"]]), 0.61)
  expect_equal(unname(pct[["R 4.1"]]), 0.38)
})

test_that("el control ya registrado NO se borra al regenerar", {
  # Se escribian SIETE de las 39 columnas y las demas salian en blanco «porque
  # las calcula el equipo». El lector las lee todas: regenerar el libro a mitad
  # de operativo borraba conteos, umbrales y cuotas. Medido en el estudio de
  # referencia: 102 de 152 filas las tenian llenas.
  v <- .rt_vuelta()
  codigos <- vapply(v$control, function(r) as.character(r$operational_code %||% ""), character(1))
  fila <- v$control[[which(codigos == "CH 1")[[1]]]]
  expect_equal(as.numeric(fila$sent_total), 17)
  expect_equal(as.numeric(fila$validator_1), 3)
  expect_equal(as.numeric(fila$threshold_total), 21)
  expect_equal(as.numeric(fila$quota_missing), 4)
  expect_identical(as.character(fila$last_response_day), "2026-08-19")
})

test_that("la identidad del aula la manda el PLAN, no el registro", {
  # El control se escribe DESPUES, asi que hay que comprobar que no pisa la
  # identidad: un registro con un nombre de curso viejo no debe ganarle al plan.
  v <- .rt_vuelta(control = list(list(operational_code = "CH 1",
                                      course_name = "NOMBRE VIEJO", sent_total = 17)))
  codigos <- vapply(v$control, function(r) as.character(r$operational_code %||% ""), character(1))
  fila <- v$control[[which(codigos == "CH 1")[[1]]]]
  expect_identical(as.character(fila$course_name), "Curso 1")
  expect_equal(as.numeric(fila$sent_total), 17)
})
