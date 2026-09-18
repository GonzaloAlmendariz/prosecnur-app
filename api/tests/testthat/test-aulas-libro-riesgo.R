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
    prosecnurapp:::.MALR_CABECERA_MARGEN %in% as.character(unlist(f$celdas))
  }, cabeceras)
  expect_gt(length(con_margen), 0L)
  cols <- prosecnurapp:::.malr_columnas_margen(filas)
  expect_gt(length(cols), 0L)
  # Cada fila marcada apunta a una celda que es NÚMERO, no texto.
  for (fila in names(cols)) {
    celda <- filas[[as.integer(fila)]]$celdas[[cols[[fila]]]]
    if (identical(as.character(celda), "")) next
    expect_true(is.numeric(celda) || !is.na(suppressWarnings(as.numeric(celda))),
                info = paste("la celda de margen de la fila", fila, "no es un número"))
  }
  # Y el patrón lleva el signo delante del positivo: sin eso, sobrar cinco y
  # faltar cinco se escriben igual.
  expect_match(prosecnurapp:::.MALR_NUMFMT_MARGEN, "^\\+")
})

test_that("el veredicto concuerda con su número en singular y en plural", {
  uno <- prosecnurapp:::.malr_veredicto(list(margen = 8, cuota = 10, logrado = 9,
                                             agendadas = 1, campo_cerrado = FALSE))
  expect_match(uno, "Le falta 1 persona", fixed = TRUE)
  expect_match(uno, "1 aula agendada", fixed = TRUE)
  expect_false(grepl("aula(s)", uno, fixed = TRUE))

  varios <- prosecnurapp:::.malr_veredicto(list(margen = 8, cuota = 10, logrado = 7,
                                                agendadas = 3, campo_cerrado = FALSE))
  expect_match(varios, "Le faltan 3 personas", fixed = TRUE)
  expect_match(varios, "3 aulas agendadas", fixed = TRUE)
})

test_that("una facultad sin nada que aplicar y por debajo de su cuota lo dice", {
  # El peor caso del operativo: no llega y ya no le queda de dónde sacarlo. El
  # veredicto tiene que decir las dos cosas, porque la acción —pedir refuerzo—
  # sale de la segunda.
  v <- prosecnurapp:::.malr_veredicto(list(margen = -12, cuota = 40, logrado = 28,
                                           agendadas = 0, campo_cerrado = TRUE))
  expect_match(v, "NO LLEGA", fixed = TRUE)
  expect_match(v, "ya no le queda nada por aplicar", fixed = TRUE)
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
  expect_true(any(grepl("meta de cada facultad sale de", notas, fixed = TRUE)))
})

test_that("sin ninguna facultad que medir la hoja no se produce y dice por qué", {
  o <- monitoreo_aulas_riesgo_facultades(list(), data.frame(), list(),
                                         hoy = as.Date("2026-09-18"))
  expect_false(isTRUE(o$ok))
  expect_match(o$motivo, "facultad")
  expect_null(aulas_libro_filas_riesgo(list(), data.frame(), list(),
                                       hoy = as.Date("2026-09-18")))
})
