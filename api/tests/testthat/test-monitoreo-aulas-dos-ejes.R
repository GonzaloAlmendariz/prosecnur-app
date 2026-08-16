# Los dos ejes de estado de un aula.
#
# El modelo tenia un solo `operational_status` que mezclaba dos cosas distintas:
# como se consiguio el aula (agendamiento) y como fue la aplicacion. En el
# estudio real son columnas separadas y una fila puede estar REEMPLAZADA en
# muestra y APLICADA en campo.

test_that("EN RESERVA 1 y EN RESERVA 2 son el mismo estado", {
  # El numero es la profundidad de la cadena y ya vive en `replacement_order`.
  # Duplicarlo aqui crearia tantas categorias como eslabones tenga el estudio.
  expect_identical(monitoreo_aulas_estado_muestra("EN RESERVA 1"), "en_reserva")
  expect_identical(monitoreo_aulas_estado_muestra("EN RESERVA 2"), "en_reserva")
  expect_identical(monitoreo_aulas_estado_muestra("EN RESERVA 7"), "en_reserva")
})

test_that("el vocabulario de agendamiento cubre lo que trae el estudio real", {
  observado <- c("AGENDADA", "REAGENDADA", "EN RESERVA 1", "EN RESERVA 2", "REEMPLAZADA")
  claves <- vapply(observado, monitoreo_aulas_estado_muestra, character(1))
  expect_true(all(claves %in% monitoreo_aulas_estados_muestra()))
  # Lo vacio es "sin contactar", que es informacion: 782 de 1012 unidades del
  # estudio de 2025 son cadena que nunca se llego a llamar.
  expect_identical(monitoreo_aulas_estado_muestra(""), "sin_contactar")
  expect_identical(monitoreo_aulas_estado_muestra("lo que sea"), "sin_contactar")
})

test_that("un aula puede estar reemplazada en muestra y aplicada en campo", {
  plan <- list(list(
    classroom_id = "A-01", operational_code = "CH 1", label = "Aula", wave = "M1",
    sample_role = "titular", orden = 1, eligible_n = 30,
    sample_status = "REEMPLAZADA", application_status = "APLICADA",
    operational_status = "planificada"
  ))
  f <- monitoreo_aulas_normalize_plan(plan)[[1]]

  # El control: con un solo campo, uno de los dos se perdia.
  expect_identical(as.character(f$sample_status), "reemplazada")
  expect_identical(as.character(f$application_status), "aplicada")
  expect_identical(as.character(f$operational_status), "planificada")
})

test_that("el ciclo de contacto llega al plan normalizado", {
  plan <- list(list(
    classroom_id = "A-01", operational_code = "CH 1", label = "Aula", wave = "M1",
    sample_role = "titular", orden = 1, eligible_n = 30,
    contact_medium = "Llamada", contact_date = "2025-09-02", contact_attempts = 6
  ))
  f <- monitoreo_aulas_normalize_plan(plan)[[1]]

  # Sin esto no se puede decir POR QUE un aula sigue sin agendar.
  expect_identical(as.character(f$contact_medium), "Llamada")
  expect_equal(as.numeric(f$contact_attempts), 6)
})

test_that("el parte trae duplicados, efectivas y el aula real", {
  plan <- list(list(
    classroom_id = "A-01", operational_code = "CH 1", label = "Aula", wave = "M1",
    sample_role = "titular", orden = 1, eligible_n = 30,
    duplicates = 3, effective_surveys = 23, actual_room = "J309"
  ))
  f <- monitoreo_aulas_normalize_plan(plan)[[1]]

  expect_equal(as.numeric(f$duplicates), 3)
  # `effective_surveys` es el numero que manda; no es "encuestas aplicadas".
  expect_equal(as.numeric(f$effective_surveys), 23)
  # El aula donde se aplico puede no ser la planificada.
  expect_identical(as.character(f$actual_room), "J309")
})

test_that("los campos nuevos no multiplican el plan", {
  # El defecto del n^2 vivia en defaults vectoriales; los nuevos son escalares.
  fila <- function(i) list(classroom_id = sprintf("A-%02d", i), operational_code = sprintf("CH %d", i),
                           label = "x", wave = "M1", sample_role = "titular", orden = i, eligible_n = 30)
  for (n in c(1L, 3L, 7L)) {
    expect_length(monitoreo_aulas_normalize_plan(lapply(seq_len(n), fila)), n)
  }
})
