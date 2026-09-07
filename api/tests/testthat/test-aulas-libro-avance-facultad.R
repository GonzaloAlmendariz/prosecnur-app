# =============================================================================
# El avance por facultad y sexo de la hoja «Avance de campo»
# (hasta A13a, 2026-08-31, «Cómo va el campo»; Gonzalo: «es AVANCE»)
# =============================================================================
#
# Encargo de Gonzalo: la tabla de avance al cliente se centra en «el reporte de
# avance por facultad por sexo a la muestra y la sobremuestra y la cantidad de
# aulas aplicadas». La hoja ya existía con el agregado del estudio; esto añade
# el corte que decide, porque la cuota es por facultad y por sexo y NO se
# compensa entre celdas (ADR 0079).

.lafac_aula <- function(id, fac, code, aplicada = TRUE, meta = 10) {
  list(classroom_id = id, operational_code = code, faculty = fac,
       label = paste("Aula", id), sample_role = "titular", wave = "M1",
       eligible_n = 30, expected_valid = meta,
       operational_status = if (aplicada) "aplicada" else "agendada")
}

.lafac_cuotas <- function(...) {
  facs <- list(...)
  list(schema = "monitoreo_aulas_design_targets_v1", facultades = facs)
}

.lafac_fac <- function(nombre, cuota, F = NULL, M = NULL) {
  list(facultad = nombre, faculty_key = .cm_criterios_fac_key(nombre),
       cuota = cuota, cuota_sexo = list(F = F, M = M), tau = 0.5)
}

test_that("sin cuotas del diseño el bloque no se inventa: devuelve NULL", {
  plan <- list(.lafac_aula("A1", "FAC1", "CH 1"))
  expect_null(prosecnurapp:::.calaf_avance_por_facultad(plan, cuotas = NULL))
  expect_null(prosecnurapp:::.calaf_avance_por_facultad(plan, cuotas = list(facultades = list())))
})

test_that("la muestra es la CUOTA del diseño y trae su reparto por sexo", {
  plan <- list(.lafac_aula("A1", "FAC1", "CH 1"), .lafac_aula("A2", "FAC1", "CH 2"))
  ef <- c(`CH 1` = 12, `CH 2` = 8)
  out <- prosecnurapp:::.calaf_avance_por_facultad(
    plan, efectivas = ef, cuotas = .lafac_cuotas(.lafac_fac("FAC1", 40, F = 22, M = 18)))
  expect_equal(nrow(out), 1L)
  expect_equal(out$Muestra, 40)
  expect_equal(out$`Muestra mujeres`, 22)
  expect_equal(out$`Muestra hombres`, 18)
  expect_equal(out$Conseguidas, 20)
  expect_equal(out$Avance, 0.5)
  expect_equal(out$Faltan, 20)
})

test_that("las aulas aplicadas se cuentan por operational_status, no por el parte", {
  # Medido el 2026-08-26: en un estudio real `application_status` llega vacío en
  # las 269 filas mientras `operational_status` marca 152 aplicadas.
  plan <- list(
    .lafac_aula("A1", "FAC1", "CH 1", aplicada = TRUE),
    .lafac_aula("A2", "FAC1", "CH 2", aplicada = FALSE),
    .lafac_aula("A3", "FAC1", "CH 3", aplicada = FALSE)
  )
  expect_true(all(vapply(plan, function(u) is.null(u$application_status), logical(1))))
  out <- prosecnurapp:::.calaf_avance_por_facultad(
    plan, efectivas = c(`CH 1` = 5), cuotas = .lafac_cuotas(.lafac_fac("FAC1", 20)))
  expect_equal(out$`Aulas aplicadas`, 1L)
  expect_equal(out$`Aulas del plan`, 3L)
})

test_that("el reparto por sexo de lo conseguido se atribuye por classroom_id", {
  # La primera versión mapeó por `operational_code` y las respuestas cayeron
  # todas en NA: son dos identificadores distintos del mismo aula, y el que
  # viaja en la respuesta es el del QR. En HSVG2026 pasó lo contrario —el QR
  # lleva el código operativo y el cruce sólo miraba `classroom_id`—, así que
  # desde el 2026-09-07 el reparto se apoya en
  # `monitoreo_aulas_efectivas_por_sexo()`, que resuelve las TRES claves.
  #
  # Y la variable de sexo se DECLARA: buscarla por nombre («sex», «sexo») era la
  # otra mitad del defecto, porque en ese estudio la columna es
  # `datos_demo/P2`.
  plan <- list(.lafac_aula("AULA-1", "FAC1", "CH 1"))
  resp <- data.frame(
    collectorID = rep("AULA-1", 6),
    sexo = c("Femenino", "Femenino", "Femenino", "Masculino", "Masculino", "Femenino"),
    stringsAsFactors = FALSE
  )
  out <- prosecnurapp:::.calaf_avance_por_facultad(
    plan, efectivas = c(`CH 1` = 6), cuotas = .lafac_cuotas(.lafac_fac("FAC1", 10, F = 6, M = 4)),
    responses = resp,
    cfg = list(source_mapping = list(collector_var = "collectorID", sex_var = "sexo")))
  expect_equal(out$`Conseguidas mujeres`, 4)
  expect_equal(out$`Conseguidas hombres`, 2)
})

test_that("la tabla NO compensa entre facultades y abre por la que más falta", {
  plan <- list(
    .lafac_aula("A1", "CORTA", "CH 1"),
    .lafac_aula("B1", "SOBRADA", "CH 2")
  )
  out <- prosecnurapp:::.calaf_avance_por_facultad(
    plan, efectivas = c(`CH 1` = 5, `CH 2` = 90),
    cuotas = .lafac_cuotas(.lafac_fac("CORTA", 50), .lafac_fac("SOBRADA", 10)))
  # La que peor va abre la tabla: es lo que se mira primero.
  expect_equal(out$Facultad[[1]], "CORTA")
  expect_equal(out$Faltan[[1]], 45)
  # Y el superávit de la otra no descuenta: `Faltan` se acota en 0, no negativo.
  expect_equal(out$Faltan[[2]], 0)
})

test_that("sin efectivas no se publica un cero: se declara NA", {
  # Un 0 conseguidas se leería como «no consiguió nada»; sin base de respuestas
  # lo cierto es que todavía no se sabe.
  plan <- list(.lafac_aula("A1", "FAC1", "CH 1"))
  out <- prosecnurapp:::.calaf_avance_por_facultad(
    plan, efectivas = NULL, cuotas = .lafac_cuotas(.lafac_fac("FAC1", 20)))
  expect_true(is.na(out$Conseguidas))
  expect_true(is.na(out$Avance))
})

# ---------------------------------------------------------------------------
# El techo con sobremuestra: la salvedad que caduco.
#
# Hasta el 2026-08-30 la cabecera del modulo decia que la sobremuestra «no
# viaja al libro», y era cierto. Dejo de serlo cuando `design_targets` paso a
# publicar `meta_diseno` y `meta_operativa`. Una salvedad correcta que caduca
# por un arreglo propio no avisa: por eso hay test.
# ---------------------------------------------------------------------------

test_that("el techo por facultad sale del ratio del diseño, no de un 1,5 supuesto", {
  unidades <- list(
    list(operational_code = "CH 1", faculty = "DERECHO", operational_status = "aplicada"),
    list(operational_code = "CH 2", faculty = "DERECHO", operational_status = "agendada")
  )
  cuotas <- list(
    meta_diseno = 100, meta_operativa = 250,   # ratio 2,5 y NO 1,5
    facultades = list(list(facultad = "DERECHO", faculty_key = "derecho", cuota = 40))
  )
  t <- prosecnurapp:::.calaf_avance_por_facultad(unidades, c(`CH 1` = 10, `CH 2` = 0), cuotas)
  expect_true("Techo con sobremuestra" %in% names(t))
  # 40 x 2,5 = 100. Con un 1,5 cableado saldria 60.
  expect_equal(t$`Techo con sobremuestra`[[1]], 100)
})

test_that("sin las dos cifras del diseño la columna queda en NA y no se inventa", {
  unidades <- list(list(operational_code = "CH 1", faculty = "DERECHO",
                        operational_status = "aplicada"))
  # Un estudio viejo: cuotas por facultad pero sin meta_diseno/meta_operativa.
  cuotas <- list(facultades = list(list(facultad = "DERECHO", faculty_key = "derecho", cuota = 40)))
  t <- prosecnurapp:::.calaf_avance_por_facultad(unidades, c(`CH 1` = 10), cuotas)
  expect_true(is.na(t$`Techo con sobremuestra`[[1]]))
})
