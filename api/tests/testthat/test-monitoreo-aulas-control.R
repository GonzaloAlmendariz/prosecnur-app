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

# --- El veredicto del aula ----------------------------------------------------
# Gonzalo (2026-08-17): «aula efectiva» = llego al 70 % de asistentes elegibles
# Y al 70 % de alumnos elegibles. Los dos.

test_that("el veredicto de la hoja manda sobre la cuenta de la app", {
  # Si la hoja dice que NO cumple, la app no la asciende aunque las enviadas
  # superen el umbral: la formula es del equipo.
  fila <- list(operational_code = "CH 1", valid_total = 0,
               sent_total = 99, threshold_total = 21)
  expect_false(monitoreo_aulas_control_umbral(fila, "valid_total", "threshold_total"))
})

test_that("sin veredicto legible se decide con el umbral que la hoja calculo", {
  expect_true(monitoreo_aulas_control_umbral(
    list(sent_total = 25, threshold_population = 21), "valid_population", "threshold_population"))
  expect_false(monitoreo_aulas_control_umbral(
    list(sent_total = 18, threshold_population = 21), "valid_population", "threshold_population"))
  # Un umbral escrito como proporcion no es un numero de encuestas. Sin este
  # corte, 25 >= 0.7 daria «cumple» en todas las aulas del estudio.
  expect_true(is.na(monitoreo_aulas_control_umbral(
    list(sent_total = 25, threshold_population = 0.7), "valid_population", "threshold_population")))
})

test_that("el veredicto textual del equipo se entiende en sus formas", {
  for (si in list("SI", "Sí", "VÁLIDO", "cumple", TRUE, 1)) {
    expect_true(monitoreo_aulas_control_umbral(list(valid_total = si), "valid_total", "threshold_total"))
  }
  for (no in list("NO", "no cumple", FALSE, 0)) {
    expect_false(monitoreo_aulas_control_umbral(list(valid_total = no), "valid_total", "threshold_total"))
  }
})

.mac_cuatro <- function() list(
  list(operational_code = "A", valid_total = 1, valid_population = 1),
  list(operational_code = "B", valid_total = 1, valid_population = 0),
  list(operational_code = "C", valid_total = 0, valid_population = 0),
  # Nadie la evaluo. Acusarla de no llegar seria inventar el veredicto.
  list(operational_code = "D", sent_total = 25),
  # La rama contraria a B: llego al de matriculados y no al de asistentes.
  list(operational_code = "E", valid_total = 0, valid_population = 1)
)

# Por codigo y no por posicion: el publicador ORDENA, asi que indexar por
# posicion probaria el orden creyendo que prueba el veredicto —y al reves, un
# cambio de orden tumbaria un test que no habla de orden.
.mac_por_codigo <- function(pub) {
  stats::setNames(pub, vapply(pub, function(f) as.character(f$operational_code), character(1)))
}

test_that("efectiva exige los dos umbrales y no se resuelve a FALSE por falta de dato", {
  pub <- .mac_por_codigo(monitoreo_aulas_control_publicado(.mac_cuatro()))

  expect_true(pub[["A"]]$efectiva)
  expect_false(pub[["B"]]$efectiva)
  expect_false(pub[["C"]]$efectiva)
  expect_true(is.na(pub[["D"]]$efectiva))
  expect_false(pub[["E"]]$efectiva)
})

test_that("la tabla del control abre por donde queda decision, no por el orden de la hoja", {
  # El orden de entrada ya empieza por la efectiva y termina por las dos que
  # cumplen uno: si el publicador no ordenara, la tabla abriria por el aula que
  # no hay que revisar. El caso esta puesto para que «abre bien» no pueda ser
  # coincidencia del orden de entrada.
  pub <- monitoreo_aulas_control_publicado(.mac_cuatro())
  codigos <- vapply(pub, function(f) as.character(f$operational_code), character(1))

  # 1-2 cumplen uno · 3 sin evaluar · 4 no alcanza ninguno · 5 efectiva.
  expect_identical(codigos, c("B", "E", "D", "C", "A"))
})

test_that("las cuatro cuentas del veredicto son excluyentes y suman las aulas", {
  res <- monitoreo_aulas_control_resumen(.mac_cuatro())
  v <- res$veredicto

  expect_identical(v$efectivas, 1L)
  expect_identical(v$cumple_una, 2L)
  expect_identical(v$no_efectivas, 1L)
  expect_identical(v$indeterminadas, 1L)
  # El aserto que atrapa el doble conteo: si «cumple una» no se restara de las
  # no efectivas, la suma daria mas aulas de las que hay.
  expect_identical(v$efectivas + v$cumple_una + v$no_efectivas + v$indeterminadas, res$aulas)
})

test_that("el veredicto dice CUAL de los dos umbrales fallo", {
  # «Cumplen solo uno» valia igual para dos diagnosticos opuestos. B llego al de
  # asistentes y no al de matriculados —fue poca gente a clase—; E al reves. La
  # hoja lo sabia por aula y el resumen no lo decia.
  v <- monitoreo_aulas_control_resumen(.mac_cuatro())$veredicto

  expect_identical(v$solo_asistentes, 1L)
  expect_identical(v$solo_poblacion, 1L)
  # El desglose no puede decir mas ni menos aulas que el total del que sale.
  expect_identical(v$solo_asistentes + v$solo_poblacion, v$cumple_una)
})

test_that("un desglose que solo tiene una rama no la reparte con la otra", {
  # El control del aserto de arriba: con las dos ramas a 1 cada una, una
  # implementacion que contara «cumple una» en las DOS claves daria 1 y 1
  # igual. Aqui solo existe la rama de asistentes, asi que la otra tiene que
  # quedarse en cero.
  v <- monitoreo_aulas_control_resumen(list(
    list(operational_code = "B", valid_total = 1, valid_population = 0),
    list(operational_code = "B2", valid_total = 1, valid_population = 0)
  ))$veredicto

  expect_identical(v$solo_asistentes, 2L)
  expect_identical(v$solo_poblacion, 0L)
})

# --- El recibo del libro ------------------------------------------------------
# De que libro salen las cifras y que hojas trajo. Vivia en `monitoreo_aulas_libro`
# y era otra clave escrita y nunca leida: el aviso de la importacion lo decia una
# vez y desaparecia al recargar.

test_that("el recibo nombra las tres hojas y marca la que falto", {
  r <- monitoreo_aulas_libro_recibo(list(
    importado_en = "2026-08-17T09:30:00Z",
    hojas_ausentes = list("Base de control"),
    control_sin_nombre = as.list(seq_len(7L)),
    resumen = list(unidades = 196L)
  ))

  expect_length(r$hojas, 3L)
  vinieron <- vapply(r$hojas, function(h) h$vino, logical(1))
  expect_identical(sum(!vinieron), 1L)
  falta <- Filter(function(h) !h$vino, r$hojas)
  expect_identical(falta[[1]]$hoja, "Base de control")
  # El invariante del que depende el rotulo «N de 3 hojas» de la vista: si
  # `hojas_ausentes` y las marcadas discreparan, la tarjeta diria una cosa y
  # la lista mostraria otra.
  expect_identical(r$hojas_ausentes, sum(!vinieron))
  expect_identical(r$control_sin_nombre, 7L)
})

test_that("un estudio sin libro importado no finge tener uno", {
  # `NULL` y no una lista vacia de hojas: la vista distingue «nunca se importo»
  # de «se importo y no traia nada», y son situaciones distintas.
  expect_null(monitoreo_aulas_libro_recibo(NULL))
  expect_null(monitoreo_aulas_libro_recibo(list()))
})

test_that("el recibo viaja al payload del tablero", {
  d <- monitoreo_aulas_dashboard(
    list(list(classroom_id = "CH 1", operational_code = "CH 1", eligible_n = 30)),
    data.frame(),
    list(libro = list(importado_en = "2026-08-17T09:30:00Z", hojas_ausentes = list()))
  )

  expect_false(is.null(d$libro))
  expect_length(d$libro$hojas, 3L)
  expect_identical(d$libro$hojas_ausentes, 0L)
})

# El criterio del 70 % quedo desfasado y sus columnas ya no se escriben.
#
# Gonzalo, 2026-08-24: «en la base de control el 70P y 70T ya estan desfasados
# porque nosotros usamos un sistema de elegibles esperados para ver si el aula es
# valida: si llega a esa cuenta o no».
#
# Y no es solo un cambio de criterio: `threshold_total` y `threshold_population`
# estan marcadas `solo_lectura` en `BASE_CONTROL_CAMPOS`, asi que un libro
# generado por la app no las trae. Sin el fallback, un estudio de 2026 entero
# sale `efectiva = NA` y el panel declara «sin evaluar» las 2.616 filas.
test_that("las columnas del 70 % ya no se escriben en el libro", {
  escritos <- vapply(
    Filter(function(s) !isTRUE(s$solo_lectura), BASE_CONTROL_CAMPOS),
    function(s) s$campo, character(1)
  )
  expect_false("threshold_total" %in% escritos)
  expect_false("threshold_population" %in% escritos)
})

test_that("sin 70T/70P, el aula se juzga contra la meta que le puso el diseno", {
  fila <- list(
    operational_code = "CH 1", sent_total = 48,
    efectivas_esperadas = 42, efectivas_obtenidas = 48
  )
  pub <- monitoreo_aulas_control_publicado(list(fila))[[1]]
  expect_true(pub$efectiva)
  expect_equal(pub$criterio, "meta")
})

test_that("no alcanzar la meta es un veredicto, no un indeterminado", {
  fila <- list(
    operational_code = "CH 2", sent_total = 12,
    efectivas_esperadas = 40, efectivas_obtenidas = 12
  )
  pub <- monitoreo_aulas_control_publicado(list(fila))[[1]]
  expect_false(pub$efectiva)
  expect_equal(pub$criterio, "meta")
})

test_that("el 70 % manda cuando el libro viejo si lo trae", {
  # Un libro de 2025 con sus umbrales calculados: el veredicto del equipo es el
  # que vale, y la meta no lo pisa.
  fila <- list(
    operational_code = "CH 3", sent_total = 100,
    threshold_total = 80, threshold_population = 60,
    efectivas_esperadas = 500, efectivas_obtenidas = 100
  )
  pub <- monitoreo_aulas_control_publicado(list(fila))[[1]]
  expect_true(pub$efectiva)
  expect_equal(pub$criterio, "umbral70")
})

test_that("sin meta y sin umbrales sigue siendo indeterminado, no un FALSE", {
  # Acusar a un aula de no llegar cuando nadie la evaluo es peor que callarse.
  pub <- monitoreo_aulas_control_publicado(list(list(operational_code = "CH 4", sent_total = 10)))[[1]]
  expect_true(is.na(pub$efectiva))
  expect_equal(pub$criterio, "")
})

test_that("`elegibles_esperados` NO es la meta: lleva el padron entero", {
  # La columna del libro se rotula «ELEGIBLES ESPERADOS» y escribe `eligible_n`.
  # Medido: un aula con 36 elegibles y meta 17,3 recibe 36 en esa columna. Si se
  # usa como vara, un aula que consiguio 20 de las 17,3 que se le pedian sale
  # suspendida por no llegar a 36 — o sea, se exige el 100 % de asistencia
  # efectiva a todas las aulas.
  fila <- list(
    operational_code = "CH 5", efectivas_obtenidas = 20,
    eligible_n = 36, elegibles_esperados = 36,
    expected_valid = 17.3, efectivas_esperadas = 17.3
  )
  pub <- monitoreo_aulas_control_publicado(list(fila))[[1]]
  expect_true(pub$efectiva)
  expect_equal(pub$criterio, "meta")
})

test_that("`expected_valid` manda sobre `efectivas_esperadas`", {
  # `expected_valid` es lo que `monitoreo_aulas_universitarias` ya compuso por
  # fila; si difiere del crudo del plan, es porque esa capa lo resolvio.
  fila <- list(
    operational_code = "CH 6", efectivas_obtenidas = 30,
    expected_valid = 25, efectivas_esperadas = 45
  )
  pub <- monitoreo_aulas_control_publicado(list(fila))[[1]]
  expect_true(pub$efectiva)
})
