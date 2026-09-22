# =============================================================================
# Las cinco tablas de «Avance de campo» llegan a la APP
# =============================================================================
#
# Gonzalo, 2026-09-08: «es que se supone que estas tablas se generan desde la
# app, siendo que la app tiene toda esta info y la puede plasmar en una tabla,
# sheets interno».
#
# El motor ya existía —`aulas_libro_indicadores()`— y tenía tres destinos, los
# tres fuera de la pantalla: el xlsx del libro, la pestaña de Google Sheets y el
# PDF de avance. Lo que esta suite sujeta es el cuarto: que la pantalla reciba
# los MISMOS números y el MISMO contrato de formato, para que la app y la hoja
# no puedan decir dos cosas distintas.

.maat_plan <- function() list(
  list(operational_code = "CH 1", classroom_id = "A1", sample_role = "titular",
       faculty = "Letras", eligible_n = 40, expected_valid = 24,
       scheduled_time = "10:00", scheduled_date = "2026-09-07"),
  list(operational_code = "CH 2", classroom_id = "A2", sample_role = "titular",
       faculty = "Derecho", eligible_n = 40, expected_valid = 24,
       scheduled_time = "19:30", scheduled_date = "2026-09-08")
)

.maat_respuestas <- function() data.frame(
  collectorID = c(rep("CH 1", 12), rep("CH 2", 8)),
  `_submission_time` = c(rep("2026-09-07T10:30:00", 12), rep("2026-09-08T19:40:00", 8)),
  P2 = rep(c("1", "2"), 10),
  check.names = FALSE, stringsAsFactors = FALSE
)

.maat_cfg <- function() list(aulas_universitarias = list(
  enabled = TRUE, plan = .maat_plan(),
  design_targets = list(
    meta_diseno = 100, meta_operativa = 150,
    facultades = list(
      list(facultad = "Letras", cuota = 60, cuota_sexo = list(F = 30, M = 30)),
      list(facultad = "Derecho", cuota = 40, cuota_sexo = list(F = 20, M = 20))
    )
  ),
  source_mapping = list(collector_var = "collectorID", sex_var = "P2",
                        sex_female_values = list("1"), sex_male_values = list("2"))
))

.maat_sesion <- function() {
  sid <- session_create()
  session_set(sid, "monitoreo_config", .maat_cfg())
  session_set(sid, "monitoreo_snapshot",
              list(data = .maat_respuestas(), synced_at = "2026-09-08T19:16:22Z"))
  sid
}

.maat_de <- function(res, clave) {
  i <- which(vapply(res$tablas, function(t) identical(t$clave, clave), logical(1)))
  expect_length(i, 1L)
  res$tablas[[i[[1]]]]
}

test_that("viajan las CINCO tablas, con la cabecera del vocabulario", {
  res <- monitoreo_aulas_avance_tablas(.maat_sesion())
  expect_true(isTRUE(res$ok))
  expect_identical(vapply(res$tablas, function(t) t$clave, character(1)),
                   names(AULAS_AVANCE_CABECERAS))
  for (clave in names(AULAS_AVANCE_CABECERAS)) {
    t <- .maat_de(res, clave)
    expect_identical(as.character(unlist(t$cabecera)), AULAS_AVANCE_CABECERAS[[clave]],
                     info = sprintf("cabecera de «%s»", clave))
    expect_identical(t$titulo, unname(AULAS_AVANCE_TITULOS[[clave]]))
  }
})

test_that("los números de la pantalla son los MISMOS que los de la hoja", {
  # Si esta igualdad se rompe, el equipo ve una cifra en la app y otra en el
  # Sheets sin nada que diga cuál creer. Las dos salen de la misma llamada a
  # `aulas_libro_indicadores()`; el test lo sujeta comparando contra el modelo.
  sid <- .maat_sesion()
  res <- monitoreo_aulas_avance_tablas(sid)
  cfg <- session_get(sid)$monitoreo_config$aulas_universitarias
  plan <- cfg$plan
  ef <- monitoreo_aulas_efectivas_por_aula(plan, .maat_respuestas(), cfg)
  ind <- aulas_libro_indicadores(
    plan, efectivas = ef, responses = .maat_respuestas(),
    validas = .monitoreo_aulas_valid_response(.maat_respuestas(), cfg),
    cuotas = cfg$design_targets, cfg = cfg)

  fac <- .maat_de(res, "facultad")
  cabecera <- as.character(unlist(fac$cabecera))
  for (i in seq_len(nrow(ind$facultades))) {
    for (j in seq_along(cabecera)) {
      esperado <- ind$facultades[[j]][[i]]
      obtenido <- fac$filas[[i]][[j]]
      if (is.character(esperado)) {
        expect_identical(obtenido, esperado)
      } else if (is.finite(suppressWarnings(as.numeric(esperado)))) {
        expect_equal(obtenido, as.numeric(esperado),
                     info = sprintf("fila %d, «%s»", i, cabecera[[j]]))
      } else {
        # Una celda sin dato viaja como `NA`, que en JSON es `null`.
        expect_true(is.na(obtenido), info = sprintf("fila %d, «%s»", i, cabecera[[j]]))
      }
    }
  }
})

test_that("el contrato de formato viaja con los datos, no lo decide la pantalla", {
  # El front podría decidir por su cuenta qué columna es porcentaje y cuál se
  # pinta, y entonces habría dos respuestas a la misma pregunta. Ya pasó con
  # «Diferencia», que es encuestas en una tabla y puntos porcentuales en otra.
  res <- monitoreo_aulas_avance_tablas(.maat_sesion())

  rend <- .maat_de(res, "rendimiento")
  cab <- as.character(unlist(rend$cabecera))
  tipo <- function(t, rotulo) as.character(unlist(t$tipos))[[which(as.character(unlist(t$cabecera)) == rotulo)]]
  sem <- function(t, rotulo) as.character(unlist(t$semaforos))[[which(as.character(unlist(t$cabecera)) == rotulo)]]
  expect_identical(tipo(rend, "Diferencia de tasa"), "porcentaje")
  expect_identical(tipo(rend, "Diferencia de efectivas"), "numero")
  expect_identical(sem(rend, "Diferencia de tasa"), "diferencia")

  diario <- .maat_de(res, "diario")
  expect_identical(tipo(diario, "Diferencia de efectivas"), "numero")
  expect_identical(tipo(diario, "Diferencia de tasa"), "porcentaje")
  expect_identical(sem(diario, "Faltantes para la meta"), "meta_muestra")

  fac <- .maat_de(res, "facultad")
  expect_identical(tipo(fac, "Avance muestra"), "porcentaje")
  expect_identical(sem(fac, "Avance muestra"), "deposito")
  expect_identical(sem(fac, "Faltantes sobremuestra"), "meta_sobremuestra")
  expect_identical(sem(fac, "Facultad"), "")
})

test_that("«Avance general» viaja declarada como traspuesta, con su tipo por fila", {
  # Es la única tabla con una fila por concepto: su naturaleza se decide por
  # FILA. Viaja dicho para que la pantalla no tenga que saberlo.
  g <- .maat_de(monitoreo_aulas_avance_tablas(.maat_sesion()), "general")
  expect_true(isTRUE(g$traspuesta))
  etiquetas <- vapply(g$filas, function(f) as.character(f[[1]]), character(1))
  expect_identical(etiquetas, AULAS_AVANCE_FILAS_GENERAL)
  tipos <- as.character(unlist(g$tipos_fila))
  sem <- as.character(unlist(g$semaforos_fila))
  expect_identical(tipos[[which(etiquetas == "Avance muestra")]], "porcentaje")
  expect_identical(tipos[[which(etiquetas == "Efectivas")]], "numero")
  expect_identical(sem[[which(etiquetas == "Avance sobremuestra")]], "deposito")
  expect_identical(sem[[which(etiquetas == "Faltantes para la muestra")]], "meta_muestra")
  # Y las tres filas de aulas no tienen sexo: sus celdas de hombres y mujeres
  # viajan como `null`, no como cero.
  aulas <- g$filas[[which(etiquetas == "Aulas planificadas originalmente")]]
  expect_identical(aulas[[2]], 2)
  expect_true(is.na(aulas[[3]]))
  expect_true(is.na(aulas[[4]]))
})

test_that("la portada trae el corte PELADO, y la tabla por facultad su fila Total", {
  # El corte es el día y nada más: el sufijo «· datos de plataforma actualizados
  # a las HH:MM · escrito con N aulas con parte de campo» se retiró con las
  # notas didácticas (Gonzalo, 2026-09-22). La hora de sincronización sigue
  # viajando aparte, en `res$actualizado`, para quien la quiera.
  res <- monitoreo_aulas_avance_tablas(.maat_sesion())
  expect_match(res$corte, "^Al [0-9]{2}/[0-9]{2}/[0-9]{4}$")
  expect_match(res$titular, "^Efectivas sobre la cuota:")
  fac <- .maat_de(res, "facultad")
  expect_identical(as.character(fac$total[[1]]), "Total")
  # Y la tabla no lleva ninguna nota: ni la de arriba ni la del pie, que ya no
  # existe como campo del bloque.
  expect_identical(fac$nota %||% "", "")
  expect_null(fac$nota_pie)
})

test_that("sin plan no se devuelve una tabla vacía: se dice por qué", {
  sid <- session_create()
  session_set(sid, "monitoreo_config", list(aulas_universitarias = list(enabled = TRUE)))
  expect_error(monitoreo_aulas_avance_tablas(sid), class = "api_error")
})

test_that("sin respuestas sincronizadas las tablas callan en vez de inventar ceros", {
  sid <- session_create()
  session_set(sid, "monitoreo_config", .maat_cfg())
  res <- monitoreo_aulas_avance_tablas(sid)
  expect_true(isTRUE(res$ok))
  # El avance diario no existe sin respuestas, y lo declara con su motivo.
  diario <- .maat_de(res, "diario")
  expect_length(diario$filas, 0L)
  expect_true(nzchar(diario$vacio))
  # Y la tabla por facultad sale, porque la cuota se sabe del diseño; sus
  # efectivas van en `null`, que no es cero.
  fac <- .maat_de(res, "facultad")
  expect_gt(length(fac$filas), 0L)
  cab <- as.character(unlist(fac$cabecera))
  expect_true(is.na(fac$filas[[1]][[which(cab == "Efectivas")]]))
})

test_that("una celda sin dato cruza como `null`, no como objeto vacío", {
  # **El pin va sobre el JSON, no sobre el valor de R.** La primera versión
  # devolvía `NULL` para la celda sin dato, que en R es el vacío natural y en el
  # test pasaba; `jsonlite` serializa un `NULL` dentro de una lista como OBJETO
  # VACÍO, así que la celda cruzaba como `{}` y la pantalla escribía
  # «[object Object]» en las tres filas de aulas de «Avance general». El valor
  # de R estaba bien: lo que estaba roto era la frontera, y sólo se veía
  # mirándola.
  res <- monitoreo_aulas_avance_tablas(.maat_sesion())
  crudo <- as.character(jsonlite::toJSON(res, auto_unbox = TRUE))
  expect_false(grepl("{}", crudo, fixed = TRUE),
               info = "hay una celda serializada como objeto vacío")
  expect_true(grepl("null", crudo, fixed = TRUE),
              info = "ninguna celda sin dato viaja como null")

  # Y en la fila donde se vio: las tres de aulas no tienen sexo.
  parsed <- jsonlite::fromJSON(crudo, simplifyVector = FALSE)
  general <- Filter(function(t) identical(t$clave, "general"), parsed$tablas)[[1]]
  fila <- Filter(function(f) identical(f[[1]], "Aulas planificadas originalmente"), general$filas)[[1]]
  expect_true(is.numeric(fila[[2]]))
  expect_null(fila[[3]])
  expect_null(fila[[4]])
})
