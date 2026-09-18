# «Facultades en riesgo»: la hoja que dice si cada facultad llega a su meta.
#
# Los contratos de aquí son los tres que la hacen fiable y que se rompen desde
# OTRO archivo: que sus fechas hablen de las mismas aulas que su conteo, que el
# margen conserve su signo y que el veredicto concuerde con su número.

.riesgo_unidad <- function(codigo, facultad, ...) {
  base <- list(
    selection_run_id = "sel_test", operational_code = codigo,
    titular_operational_code = codigo, sample_role = "titular",
    replacement_order = 0, classroom_id = codigo, collection_unit_id = codigo,
    faculty = facultad, eligible_n = 40, expected_valid = 20,
    sample_status = "", operational_status = "", application_status = "",
    scheduled_date = "", efectividad_tau = 0.5
  )
  utils::modifyList(base, list(...))
}

.riesgo_cfg <- function(...) {
  utils::modifyList(list(
    schema = "monitoreo_aulas_universitarias_v1", enabled = TRUE,
    design_targets = list(
      schema = "monitoreo_aulas_design_targets_v1", source = "test",
      facultades = list(
        list(facultad = "DERECHO", cuota = 40),
        list(facultad = "EDUCACION", cuota = 10)
      )
    )
  ), list(...))
}

test_that("las fechas de la hoja hablan de las mismas aulas que su conteo de agendadas", {
  # Tres aulas de Derecho en los tres estados que el motor distingue: una
  # aplicada, una con cita futura y una con cita vencida. Sólo la segunda es
  # aforo agendado, y su fecha es la que la hoja debe publicar.
  plan <- list(
    .riesgo_unidad("CH 1", "DERECHO", operational_status = "aplicada",
                   scheduled_date = "2026-09-10"),
    .riesgo_unidad("CH 2", "DERECHO", sample_status = "agendada",
                   scheduled_date = "2026-09-25"),
    .riesgo_unidad("CH 3", "DERECHO", sample_status = "agendada",
                   scheduled_date = "2026-09-05")
  )
  o <- monitoreo_aulas_riesgo_facultades(plan, data.frame(), .riesgo_cfg(),
                                         hoy = as.Date("2026-09-18"))
  expect_true(isTRUE(o$ok))
  fila <- Filter(function(f) identical(f$facultad, "DERECHO"), o$facultades)[[1]]
  # El contrato: tantas fechas como aulas dice tener agendadas.
  expect_identical(length(fila$codigos_pendientes), as.integer(fila$agendadas))
  expect_identical(fila$codigos_pendientes, "CH 2")
  expect_identical(fila$proxima_cita, "2026-09-25")
  # Y la vencida se cuenta aparte: ni aforo ni «sin agendar».
  expect_equal(fila$vencidas, 1)
})

test_that("una cita vencida no entra como aforo agendado", {
  plan <- list(.riesgo_unidad("CH 9", "DERECHO", sample_status = "agendada",
                              scheduled_date = "2026-09-01"))
  o <- monitoreo_aulas_riesgo_facultades(plan, data.frame(), .riesgo_cfg(),
                                         hoy = as.Date("2026-09-18"))
  fila <- Filter(function(f) identical(f$facultad, "DERECHO"), o$facultades)[[1]]
  expect_equal(fila$agendadas, 0)
  expect_identical(fila$proxima_cita, "")
  expect_length(fila$codigos_pendientes, 0L)
})

test_that("el margen viaja como número y su columna lleva el numFmt con signo", {
  # `.alp_celdas()` tipa como número toda celda que parsee como tal, así que un
  # «+5» escrito en el texto volvería 5 y el signo se perdería. Lo que lo pinta
  # es el numFmt, y el ancla que lo coloca es la cabecera: si alguien la
  # renombra sin tocar las dos salidas, la columna se queda sin signo y en
  # silencio. Este test es ese ancla.
  plan <- list(
    .riesgo_unidad("CH 1", "DERECHO", operational_status = "aplicada"),
    .riesgo_unidad("CH 2", "DERECHO", sample_status = "agendada",
                   scheduled_date = "2026-09-25")
  )
  filas <- aulas_libro_filas_riesgo(plan, data.frame(), .riesgo_cfg(),
                                    hoy = as.Date("2026-09-18"))
  expect_false(is.null(filas))
  cabeceras <- Filter(function(f) identical(f$tipo, "cabecera"), filas)
  con_margen <- Filter(function(f) {
    any(startsWith(as.character(unlist(f$celdas)), prosecnurapp:::.MALR_CABECERA_MARGEN))
  }, cabeceras)
  expect_gt(length(con_margen), 0L)
  cols <- prosecnurapp:::.malr_columnas_margen(filas)
  expect_gt(length(cols), 0L)
  # Cada fila marcada apunta a celdas que son NÚMERO, no texto. Son VARIAS por
  # fila: el margen por el aula y el margen por lo declarado.
  for (fila in names(cols)) {
    for (col in cols[[fila]]) {
      celda <- filas[[as.integer(fila)]]$celdas[[col]]
      if (identical(as.character(celda), "")) next
      expect_true(is.numeric(celda) || !is.na(suppressWarnings(as.numeric(celda))),
                  info = paste("la celda de margen de la fila", fila, "no es un número"))
    }
  }
  # El bloque de cuotas tiene DOS columnas de margen; quedarse con la primera
  # dejaba la de «por lo declarado» sin signo.
  expect_true(any(vapply(cols, function(x) length(x) >= 2L, logical(1))))
  # Y el patrón lleva el signo delante del positivo: sin eso, sobrar cinco y
  # faltar cinco se escriben igual.
  expect_match(prosecnurapp:::.MALR_NUMFMT_MARGEN, "^\\+")
})

test_that("la hoja no redacta veredictos: da los datos y una etiqueta", {
  # Gonzalo, 2026-09-18: «el veredicto no lo das tú, porque suena a AI slop.
  # Sino tú proporcionas los datos». La versión anterior escribía una frase por
  # fila —«Le falta 1 persona y la espera de 1 aula agendada»— que no decía nada
  # que las columnas no dijeran ya. Este test es lo que impide que vuelva.
  plan <- list(
    .riesgo_unidad("CH 1", "DERECHO", operational_status = "aplicada"),
    .riesgo_unidad("CH 2", "DERECHO", sample_status = "agendada",
                   scheduled_date = "2026-09-25")
  )
  filas <- aulas_libro_filas_riesgo(plan, data.frame(), .riesgo_cfg(),
                                    hoy = as.Date("2026-09-18"))
  cabeceras <- unlist(lapply(Filter(function(f) identical(f$tipo, "cabecera"), filas),
                             function(f) as.character(unlist(f$celdas))))
  expect_false("VEREDICTO" %in% cabeceras)
  expect_false("LECTURA" %in% cabeceras)
  expect_true(prosecnurapp:::.MALR_CABECERA_SEMAFORO %in% cabeceras)
  # Y ninguna celda de dato lleva una frase: la más larga es el semáforo o una
  # lista de códigos, nunca una oración con verbo conjugado.
  datos <- unlist(lapply(Filter(function(f) identical(f$tipo, "dato"), filas),
                         function(f) as.character(unlist(f$celdas))))
  expect_false(any(grepl("\\ble falta|\\ble faltan|espera de|Cerrada, con", datos,
                         ignore.case = TRUE)))
})

test_that("el desglose principal es por facultad Y sexo, cada cuota por separado", {
  # Dictado 2026-09-18: «el desglose debe ser por facultad y sexo de forma
  # independiente». Las cuotas del diseño son por celda; agregarlas escondía que
  # una facultad cerrara su total con una de sus dos celdas corta.
  plan <- list(
    .riesgo_unidad("CH 1", "DERECHO", operational_status = "aplicada"),
    .riesgo_unidad("CH 2", "DERECHO", sample_status = "agendada",
                   scheduled_date = "2026-09-25")
  )
  filas <- aulas_libro_filas_riesgo(plan, data.frame(), .riesgo_cfg(),
                                    hoy = as.Date("2026-09-18"))
  bloques <- vapply(Filter(function(f) identical(f$tipo, "bloque"), filas),
                    function(f) as.character(unlist(f$celdas))[[1L]], character(1))
  expect_identical(bloques[[1L]], prosecnurapp:::.MALR_BLOQUES[[1L]])
  expect_match(bloques[[1L]], "FACULTAD Y SEXO")
  # La PRIMERA cabecera —la del bloque que manda— lleva SEXO como segunda
  # columna. Que exista un bloque por sexo más abajo no basta: el desglose
  # principal es el que se lee.
  primera <- as.character(unlist(
    Filter(function(f) identical(f$tipo, "cabecera"), filas)[[1L]]$celdas))
  expect_identical(primera[[1L]], "FACULTAD")
  expect_identical(primera[[2L]], "SEXO")
})

test_that("una cuota ya cumplida no se marca en riesgo aunque su margen sea chico", {
  # Lo recogido no se devuelve. Confundir «margen chico» con «peligro» ponía en
  # la lista a Contables y Educación, que habían cerrado hacía días.
  expect_identical(prosecnurapp:::.malr_peldano(cuota = 10, logrado = 14, margen = 4),
                   "cerrada")
  # Y el reverso: falta gente y ya no queda nada que aplicar es el peor caso.
  expect_identical(
    prosecnurapp:::.malr_peldano(cuota = 40, logrado = 28, margen = 5,
                                 campo_cerrado = TRUE),
    "no_llega")
  expect_identical(prosecnurapp:::.malr_peldano(cuota = 40, logrado = 28, margen = -3),
                   "no_llega")
  # La probabilidad baja manda sobre el margen positivo.
  expect_identical(prosecnurapp:::.malr_peldano(cuota = 13, logrado = 10, margen = 1,
                                                prob = 0.74),
                   "filo")
  # Y no llegar POR LO DECLARADO también es estar en el filo.
  expect_identical(prosecnurapp:::.malr_peldano(cuota = 13, logrado = 10, margen = 30,
                                                prob = 1, margen_declarado = -2),
                   "filo")
})

test_that("cada peldaño del semáforo tiene texto Y color, y los dos salen de la misma tabla", {
  # Un color sin palabra se pierde al imprimir en blanco y negro y para quien no
  # distingue el rojo del verde; una palabra sin color no se ve de un vistazo.
  for (k in names(prosecnurapp:::.MALR_SEMAFORO)) {
    x <- prosecnurapp:::.MALR_SEMAFORO[[k]]
    expect_true(nzchar(x$texto), info = k)
    expect_match(x$fondo, "^#[0-9A-Fa-f]{6}$", info = k)
    expect_match(x$tinta, "^#[0-9A-Fa-f]{6}$", info = k)
  }
  # El texto de la hoja sale de esa misma tabla, no de un literal suelto.
  expect_identical(prosecnurapp:::.malr_semaforo_texto("no_llega"), "NO LLEGA")
})

test_that("la hoja declara de DÓNDE sale la cuota contra la que juzga", {
  # Medido el 2026-09-18: sin `design_targets` el motor NO se queda sin cuota —
  # cae al `expected_valid` del propio plan, así que una facultad con 40
  # elegibles sale con meta 20—. La primera versión de este test daba por
  # supuesto que sin diseño no había con qué juzgar y esperaba una hoja
  # ausente; el motor devolvía una meta derivada y el test lo destapó.
  #
  # El riesgo entonces no es la hoja vacía: es una hoja que dice «llega» contra
  # una meta que el estudio nunca fijó. Por eso la nota de cabecera nombra la
  # fuente, y este test es lo que impide que deje de nombrarla.
  plan <- list(.riesgo_unidad("CH 1", "DERECHO"))
  o <- monitoreo_aulas_riesgo_facultades(plan, data.frame(), list(),
                                         hoy = as.Date("2026-09-18"))
  expect_true(isTRUE(o$ok))
  fila <- Filter(function(f) identical(f$facultad, "DERECHO"), o$facultades)[[1]]
  expect_equal(fila$cuota, 20)
  expect_true(nzchar(o$fuente_cuota))

  filas <- aulas_libro_filas_riesgo(plan, data.frame(), list(),
                                    hoy = as.Date("2026-09-18"))
  notas <- vapply(Filter(function(f) identical(f$tipo, "nota"), filas),
                  function(f) paste(as.character(unlist(f$celdas)), collapse = " "),
                  character(1))
  expect_true(any(grepl("Meta tomada de", notas, fixed = TRUE)))
})

test_that("sin ninguna facultad que medir la hoja no se produce y dice por qué", {
  o <- monitoreo_aulas_riesgo_facultades(list(), data.frame(), list(),
                                         hoy = as.Date("2026-09-18"))
  expect_false(isTRUE(o$ok))
  expect_match(o$motivo, "facultad")
  expect_null(aulas_libro_filas_riesgo(list(), data.frame(), list(),
                                       hoy = as.Date("2026-09-18")))
})
