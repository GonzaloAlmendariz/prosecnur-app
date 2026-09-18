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
  # **El libro devuelve el vocabulario del EXCEL, y el motor lo normaliza.**
  # Desde que el libro escribe lo que su propio desplegable ofrece —«AGENDADA»,
  # «EN RESERVA 1»— la relectura devuelve eso, no la forma interna. No rompe
  # nada porque `monitoreo_aulas_estado_muestra()` reconoce las dos, y se
  # comprueban las dos mitades: que vuelve el valor del Excel y que el motor
  # lo entiende.
  expect_identical(unname(estados[["CH 1"]]), "AGENDADA")
  expect_identical(unname(estados[["CH 4"]]), "REEMPLAZADA")
  # B13b: la posicion en cadena la dice el codigo (R 4.1); la siembra escribe
  # el estado inicial tecleable, no el derivado.
  expect_identical(unname(estados[["R 4.1"]]), "SIN CONTACTAR")
  expect_identical(monitoreo_aulas_estado_muestra(estados[["CH 1"]]), "agendada")
  expect_identical(monitoreo_aulas_estado_muestra(estados[["CH 4"]]), "reemplazada")
  expect_identical(monitoreo_aulas_estado_muestra(estados[["R 4.1"]]), "sin_contactar")
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
  # **LA celda de la fecha, no «alguna celda numerica de la hoja».** Ese aserto
  # dejo de vigilar nada el dia que los conteos —matriculados, elegibles,
  # intentos— tambien se empezaron a tipar: cualquiera de ellos lo satisfacia.
  campos <- vapply(AULAS_AGENDADAS_BLOQUE, function(sp) sp$campo, character(1))
  col_fecha <- 1L + which(campos == "scheduled_date")
  expect_identical(tipo_de_celda(path, "Aulas Agendadas", col_fecha, 2), "n")

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
  # `threshold_total` ya no se escribe —es `solo_lectura`, existe para releer
  # libros viejos— asi que no vuelve. Lo que sustituye a esa columna si:
  expect_equal(as.numeric(fila$sent_total), 17)
  # `quota_missing` dejó de escribirse el 2026-09-08 —«cada aula consigue lo que
  # se consigue, no hay que volver a ir»— así que ya no vuelve del libro. Lo que
  # sustituye a esa columna sí:
  expect_equal(as.numeric(fila$validator_1), 3)
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

# --- El barrido: NINGUN campo que el lector conoce puede perderse -----------
#
# Los tres defectos de esta serie —`% ASISTENCIA`, las 32 columnas del control,
# y antes las columnas de la persona— eran el mismo: una columna que el lector
# LEE y el generador no escribia. Se encontraron de uno en uno y mirando.
#
# Este test los habria cazado a los tres sin buscarlos, y caza el siguiente: da
# un valor UNICO a cada campo de cada spec, regenera, reimporta y exige que
# vuelvan todos. Si mañana una spec gana un campo y el generador no lo escribe,
# salta solo.

.rt_campos_de <- function(spec) vapply(spec, function(s) s$campo, character(1))

.rt_unico <- function(cs, desde) {
  v <- as.list(seq_along(cs) + desde)
  names(v) <- cs
  v
}

.rt_barrido <- function() {
  ag <- .rt_campos_de(AULAS_AGENDADAS_BLOQUE)
  ap <- .rt_campos_de(AULAS_APLICADAS_CAMPO)
  ct <- .rt_campos_de(BASE_CONTROL_CAMPOS)
  u <- .rt_unico(ag, 100)
  u$operational_code <- "CH 1"; u$sample_role <- "titular"; u$classroom_id <- "A-01"
  pt <- .rt_unico(ap, 300); pt$operational_code <- "CH 1"; pt$intento <- 1L
  # **El aula tiene que estar APLICADA para que su fila de control exista.**
  # Desde el 2026-09-07 la «Base de control» sólo escribe el aula aplicada o con
  # respuestas: el criterio de «tiene control tecleado por el equipo» se retiró
  # cuando la app pasó a escribir ese bloque entero desde la plataforma. Sin
  # esto el barrido se quedaba sin fila de control que comparar.
  pt$estado <- "APLICADA"
  pt$application_status <- "APLICADA"
  ct1 <- .rt_unico(ct, 500); ct1$operational_code <- "CH 1"
  libro <- withr::local_tempfile(fileext = ".xlsx", .local_envir = parent.frame())
  aulas_libro_generar(list(u), libro, partes = list(pt), control = list(ct1))
  v <- aulas_libro_importar(libro)
  list(ag = ag, ap = ap, ct = ct, u = u, pt = pt, ct1 = ct1,
       plan = v$plan[[1]], parte = (v$partes %||% list())[[1]] %||% list(),
       control = (v$control %||% list())[[1]] %||% list())
}

.rt_perdidos <- function(esperado, obtenido, cs) {
  Filter(function(k) {
    o <- obtenido[[k]]
    is.null(o) || is.na(o) || !nzchar(as.character(o)) ||
      as.character(o) != as.character(esperado[[k]])
  }, cs)
}

test_that("los 11 campos del parte de campo vuelven todos", {
  b <- .rt_barrido()
  expect_identical(.rt_perdidos(b$pt, b$parte, b$ap), character(0))
})

test_that("los campos del agendamiento vuelven, salvo el alias declarado", {
  b <- .rt_barrido()
  perdidos <- .rt_perdidos(b$u, b$plan, b$ag)
  # `notes` es el UNICO: la columna «OBSERVACIONES» entra por el campo `notes`
  # y el lector la guarda como `replacement_note`. El dato NO se pierde —cambia
  # de nombre en el viaje—, y esa asimetria es la que engaño al barrido con el
  # que se encontro esto. Queda fijada aqui para que se vea, no escondida.
  # `aula_utilizada` tampoco vuelve, y es correcto que no vuelva: la ESCRIBE la
  # app desde la decisión operativa del plan (`replacement_for`) en cada
  # generación, así que releerla sería darle al libro autoridad sobre un dato
  # que no es suyo. Lo tecleado a mano sí se respeta —`aulas_libro_anotar_
  # aula_utilizada` no pisa una celda con contenido—, pero vive en el libro, no
  # de vuelta en el plan.
  # `program` estuvo aqui un rato: la columna CARRERA se escribia y el lector la
  # mapeaba, pero la lista cerrada que arma la fila de plan no la emitia, asi
  # que el dato moria en el viaje. Es la MISMA lista que ya se trago
  # `teacher_phone`. Este barrido la cazo en el acto, que es para lo que existe.
  expect_identical(perdidos, c("aula_utilizada", "notes"))
  expect_identical(as.character(b$plan$replacement_note), as.character(b$u$notes))
})

test_that("los campos de control vuelven, salvo la identidad que manda el plan", {
  b <- .rt_barrido()
  perdidos <- .rt_perdidos(b$ct1, b$control, b$ct)
  # Estos cinco no vuelven con el valor del REGISTRO porque el plan es su
  # fuente y no se deja pisar. No es perdida: es la regla, y si algun dia deja
  # de cumplirse este test lo dice.
  # Los DIEZ `solo_lectura` se suman a la lista: la hoja ya no los escribe, y
  # eso es deliberado —salian como columnas vacias—. Siguen en la spec para que
  # un libro viejo que las traiga se lea entero, que es lo que comprueba
  # `test-carga-aulas-libro-control-esperado.R`.
  #
  # Los cuatro últimos entraron el 2026-09-07: `short_*`/`long_*` eran la
  # partición por DURACIÓN de 2025 —«cortas y largas ya no existe, es efectivas
  # y no efectivas»—, `efectivas_pct_esperado` era `esperadas / elegibles`, la
  # misma cifra que «TASA DEL AULA», y `elegibles_esperados` era `eligible_n`
  # repetido. Una columna que repite a su vecina no informa, confunde.
  #
  # `attendance_pct` se suma porque la calcula la APP desde el parte
  # (`asistentes / elegibles`) y por tanto no la pisa el registro, igual que las
  # siete de agenda y campo de abajo.
  # Los SIETE de agenda y campo se suman por el mismo motivo, y su presencia
  # aqui es la señal de que la Base de control ya los escribe: hasta el
  # 2026-08-31 salian VACIOS —«base de control necesita saber lo que las otras
  # dos saben», y no lo sabia—, asi que ni siquiera llegaban a esta lista. Su
  # fuente es el plan y el parte, y el registro no los pisa.
  expect_setequal(perdidos,
                  c("wave", "course_name", "room", "enrolled_total", "eligible_n",
                    "elegibles_esperados",
                    "threshold_total", "threshold_population",
                    "valid_total", "valid_population",
                    "efectivas_pct_esperado", "attendance_pct",
                    "short_total", "short_vs_total", "long_total", "long_vs_total",
                    # Del barrido del 2026-09-08: los tres que la app escribe
                    # (la facultad del plan y las dos cuentas del parte) y los
                    # tres que dejaron de escribirse (la cuota por aula, que
                    # mide lo que ya no se puede corregir, y el horario
                    # normalizado, que repetía a HORA).
                    "faculty", "declared_surveys", "refusals",
                    "quota_pct", "quota_missing", "schedule_norm",
                    "scheduled_date", "scheduled_time",
                    "applied_by", "applied_date", "applied_time",
                    "application_status", "observed_students"))
  expect_identical(as.character(b$control$course_name),
                   as.character(b$u$course_name))
})

test_that("el control de una RESERVA activada no se pierde al regenerar", {
  # La hoja se escribia solo con titulares, asi que una reserva de cadena que ya
  # se aplico —tiene parte y tiene control— perdia su fila. Medido en el estudio
  # de trabajo: de 152 filas de control, 22 eran de reservas y no volvian.
  v <- .rt_vuelta(control = list(
    list(operational_code = "CH 1", sent_total = 17),
    list(operational_code = "R 4.1", sent_total = 9, women_n = 4)
  ))
  codigos <- vapply(v$control, function(r) as.character(r$operational_code %||% ""), character(1))
  expect_true("R 4.1" %in% codigos)
  fila <- v$control[[which(codigos == "R 4.1")[[1]]]]
  expect_equal(as.numeric(fila$sent_total), 9)
  expect_equal(as.numeric(fila$women_n), 4)
  # El control: el titular sigue estando, no se cambio una cosa por otra.
  expect_true("CH 1" %in% codigos)
})

test_that("un titular sin control ni aplicar YA NO ocupa fila en el control", {
  # **Al revés que hasta el 2026-09-07.** La hoja ofrecía la fila de todo
  # titular «para que la llenen», y el primer día de campo eso se vio por lo que
  # es: 174 filas para una sola aula aplicada. Gonzalo: «muestra todos los CH
  # cuando solo deberían ser los que ya se aplicaron».
  #
  # Lo que NO cambió, y por eso sigue comprobándose aquí: el aula que ya tiene
  # control registrado vuelve siempre, aunque no esté aplicada. Sin esa mitad,
  # regenerar el libro a mitad de operativo borraba el control ya escrito.
  v <- .rt_vuelta(control = list(list(operational_code = "CH 1", sent_total = 17)))
  codigos <- vapply(v$control, function(r) as.character(r$operational_code %||% ""), character(1))
  expect_false("CH 4" %in% codigos)
  expect_true("CH 1" %in% codigos)
})

# --- El barrido de FILAS: ninguna unidad con registro se queda fuera ---------
#
# Complemento del barrido de campos. Aquel prueba con UNA unidad y cubre que no
# se pierda ninguna COLUMNA; este cubre que no se pierda ninguna FILA. Son dos
# coberturas distintas y el defecto de las reservas con control se coló entre
# las dos: ninguna columna faltaba, faltaban 22 filas.

.rt_plan_tres_roles <- function() list(
  list(classroom_id = "A-1", operational_code = "CH 1", course_name = "C1",
       faculty = "Letras", sample_role = "titular", eligible_n = 30,
       enrolled_total = 34, expected_valid = 20),
  list(classroom_id = "A-2", operational_code = "CH 2", course_name = "C2",
       faculty = "Letras", sample_role = "titular", eligible_n = 28,
       enrolled_total = 31, expected_valid = 18),
  list(classroom_id = "A-3", operational_code = "R 2.1", course_name = "C3",
       faculty = "Letras", sample_role = "chain_reserve",
       titular_operational_code = "CH 2", replacement_for = "CH 2",
       replacement_order = 1, eligible_n = 26, enrolled_total = 29,
       expected_valid = 17),
  # Un extra activado es cabeza de su propia cadena: lleva su propio codigo
  # como `titular_operational_code`, la misma convencion que los titulares.
  # Sin el, `E_AULAS_LIBRO_SIN_CADENAS` lo rechaza en cuanto trae parte
  # (contrato de test-monitoreo-aulas-libro-estructura.R).
  list(classroom_id = "A-4", operational_code = "X 1", course_name = "C4",
       faculty = "Letras", sample_role = "extra_reserve_pool",
       titular_operational_code = "X 1",
       eligible_n = 24, enrolled_total = 27, expected_valid = 15)
)

test_that("vuelve el control de CUALQUIER unidad que lo tenga, sea del rol que sea", {
  # Una reserva activada y un extra del banco activado se aplican igual que un
  # titular: si tienen control, el libro tiene que devolverlo. Escribir solo
  # titulares costo 22 filas en el estudio de trabajo.
  v <- .rt_vuelta(
    plan = .rt_plan_tres_roles(),
    # **Con parte APLICADA**: desde el 2026-09-07 la hoja sólo escribe el aula
    # aplicada o con respuestas, así que un control suelto sobre un aula que
    # nadie aplicó ya no basta para que la fila exista. Lo que este test sujeta
    # sigue siendo lo suyo —que el rol de muestreo no decida si el control
    # vuelve—, y para eso las tres se aplican.
    partes = list(
      list(operational_code = "CH 1", estado = "APLICADA", intento = 1L),
      list(operational_code = "R 2.1", estado = "APLICADA", intento = 1L),
      list(operational_code = "X 1", estado = "APLICADA", intento = 1L)
    ),
    control = list(
      list(operational_code = "CH 1", validator_1 = 11),
      list(operational_code = "R 2.1", validator_1 = 22),
      list(operational_code = "X 1", validator_1 = 33)
    )
  )
  codigos <- vapply(v$control, function(r) as.character(r$operational_code %||% ""), character(1))
  # Por `validator_1` y no por `sent_total`: las enviadas las escribe ahora la
  # app desde la plataforma y pisarían el valor del registro. El filtro de
  # validación sólo se llena cuando el estudio declara su criterio, así que en
  # este barrido sin respuestas conserva lo tecleado, que es lo que aquí se mide.
  valores <- setNames(
    vapply(v$control, function(r) as.numeric(r$validator_1 %||% NA), numeric(1)),
    codigos
  )
  # Los tres, con SU valor: si el generador los repartiera mal, los numeros
  # 11/22/33 saldrian cruzados.
  expect_equal(unname(valores[["CH 1"]]), 11)
  expect_equal(unname(valores[["R 2.1"]]), 22)
  expect_equal(unname(valores[["X 1"]]), 33)
})

test_that("vuelve el parte de CUALQUIER unidad que lo tenga", {
  # La hoja de campo ya lo hacia bien desde antes; este test lo fija para que no
  # se pierda al reves de como se perdio en la Base de control.
  v <- .rt_vuelta(
    plan = .rt_plan_tres_roles(),
    partes = list(
      list(operational_code = "CH 1", intento = 1L, observed_students = 21,
           effective_surveys = 19, application_status = "APLICADA"),
      list(operational_code = "R 2.1", intento = 1L, observed_students = 14,
           effective_surveys = 12, application_status = "APLICADA"),
      list(operational_code = "X 1", intento = 1L, observed_students = 9,
           effective_surveys = 8, application_status = "APLICADA")
    ),
    control = list()
  )
  codigos <- vapply(v$partes, function(r) as.character(r$operational_code %||% ""), character(1))
  efectivas <- setNames(
    vapply(v$partes, function(r) as.numeric(r$effective_surveys %||% NA), numeric(1)),
    codigos
  )
  expect_equal(unname(efectivas[["CH 1"]]), 19)
  expect_equal(unname(efectivas[["R 2.1"]]), 12)
  expect_equal(unname(efectivas[["X 1"]]), 8)
})

test_that("una columna con datos y sin cabecera se REPORTA al importar", {
  # El lector cuenta las columnas de «Base de control» que traen dato y cuya
  # cabecera no las bautiza, y el aviso de la app las nombra: en el estudio de
  # trabajo son siete. Su propio comentario cuenta que esto ya fallo una vez
  # —«decia 0 columnas sin nombre en una hoja que tiene siete»— y aun asi el
  # mutante que renombraba el campo sobrevivia: `aulas_libro_importar()` leia
  # NULL y reportaba cero para siempre.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.rt_plan(), libro, control = list(
    list(operational_code = "CH 1", sent_total = 17)
  ))

  # Se añade a mano lo que hace el equipo en su Excel: una columna de trabajo
  # con datos y sin titulo.
  wb <- openxlsx::loadWorkbook(libro)
  extra <- length(BASE_CONTROL_CAMPOS) + 2L
  openxlsx::writeData(wb, "Base de control", "apunte suelto",
                      startCol = extra, startRow = 3, colNames = FALSE)
  openxlsx::saveWorkbook(wb, libro, overwrite = TRUE)

  out <- aulas_libro_importar(libro)
  expect_gt(length(out$control_sin_nombre), 0L)
  expect_true(extra %in% unlist(out$control_sin_nombre))
})

test_that("un libro sin columnas sueltas no inventa ninguna", {
  # El control del anterior: si el lector marcara como «sin nombre» cualquier
  # columna vacia, un libro recien generado —39 columnas, casi todas en blanco
  # porque las llena el equipo— daria una lista enorme y el aviso perderia todo
  # su valor.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.rt_plan(), libro, control = list(
    list(operational_code = "CH 1", sent_total = 17)
  ))
  out <- aulas_libro_importar(libro)
  expect_length(out$control_sin_nombre, 0L)
})

test_that("un libro de antes de A13a —hoja «Cómo va el campo»— sigue importando", {
  # A13a (2026-08-31) renombró la hoja de indicadores a «Avance de campo»
  # (Gonzalo: «es AVANCE»). El libro es efímero por sesión, pero un .xlsx
  # guardado antes del rename puede vivir en el disco del equipo:
  # `aulas_libro_importar()` lee las TRES hojas de datos por nombre e ignora
  # las que no conoce, así que el nombre viejo ni rompe el import ni pierde
  # ninguna de las tres.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.rt_plan(), libro, partes = .rt_partes(),
                      control = .rt_control())
  wb <- openxlsx::loadWorkbook(libro)
  openxlsx::renameWorksheet(wb, "Avance de campo", "Cómo va el campo")
  openxlsx::saveWorkbook(wb, libro, overwrite = TRUE)
  viejo <- aulas_libro_importar(libro)
  nuevo <- .rt_vuelta()
  expect_length(viejo$hojas_ausentes, 0L)
  expect_identical(length(viejo$plan), length(nuevo$plan))
  expect_identical(length(viejo$partes), length(nuevo$partes))
  expect_identical(length(viejo$control), length(nuevo$control))
})

# **«POR APLICAR» no es un parte de campo.**
#
# Dictado 2026-09-04: «todas actualmente ahora deberían tener por default en
# status de aplicación: POR APLICAR». Sembrarlo en todas las filas hacía que el
# lector viera estado en todas y devolviera un parte por cada aula: un libro
# recién generado, sin una sola visita, se releía con el avance completo.
test_that("un libro recién generado no devuelve partes aunque el estado esté sembrado", {
  plan <- list(
    list(operational_code = "CH 1", classroom_id = "a1", sample_role = "titular",
         titular_operational_code = "CH 1", faculty = "Derecho", course_name = "C",
         teacher = "D", eligible_n = 30, scheduled_date = "2026-09-07",
         scheduled_time = "10:00", operational_status = "agendada")
  )
  destino <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(plan, destino)

  # La celda SÍ trae el estado inicial…
  celdas <- openxlsx::read.xlsx(destino, sheet = "Aulas Aplicadas (Campo)",
                                colNames = FALSE, skipEmptyRows = FALSE)
  expect_match(paste(unlist(lapply(celdas, as.character)), collapse = " | "),
               "POR APLICAR", fixed = TRUE)
  # …y aun así no hay ni un parte que leer: nadie ha visitado nada.
  expect_length(aulas_aplicadas_leer(destino), 0L)
})
