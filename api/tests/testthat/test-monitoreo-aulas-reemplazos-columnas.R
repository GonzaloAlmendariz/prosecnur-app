# `reemplazos` salia con las 104 columnas del plan seguido: 1 173 filas por
# ~3 590 bytes = 4 109 KB de un payload de 10 331, medido sobre HSVG26ULT2 el
# 2026-09-08. Y no es una lista aparte: sus 1 173 codigos estan TODOS en
# `agenda`, y las filas son identicas campo por campo salvo `motivo`. Cuatro
# megabytes duplicados para llevar una columna de texto.
#
# El comentario de `brechas` —el hermano de este contrato— ya lo habia visto:
# «tanto como el plan entero, que ademas ya viaja dos veces». Se quedo en el
# diagnostico.
#
# Este test fija el contrato en las dos direcciones, igual que el de brechas: que
# no vuelva a engordar, y que no adelgace por debajo de lo que sus consumidores
# piden.

.mrc_plan <- function() {
  titular <- list(
    operational_code = "CH 1", classroom_id = "A-1", label = "Curso 1",
    faculty = "Derecho", wave = "M1", sample_role = "titular",
    titular_operational_code = "CH 1", operational_sequence = 1,
    operational_status = "reemplazada", sample_status = "reemplazada",
    replacement_reason = "el docente no autorizo",
    eligible_n = 30, expected_valid = 30,
    # Ruido que el plan lleva y ningun consumidor de reemplazos mira.
    teacher = "Docente", teacher_email = "d@x.pe", teacher_phone = "999",
    sex_top_1 = "F", sex_top_1_n = 18, sex_top_2 = "M", sex_top_2_n = 12,
    link = "https://ejemplo/x", selection_run_id = "run-1", program = "Derecho"
  )
  reserva <- utils::modifyList(titular, list(
    operational_code = "R 1.1", classroom_id = "A-2", label = "Curso 2",
    wave = "M2", sample_role = "chain_reserve", replacement_for = "CH 1",
    replacement_order = 1, operational_sequence = 2,
    operational_status = "agendada", sample_status = "agendada",
    replacement_reason = NULL, activation_reason = "entra por CH 1"
  ))
  list(titular, reserva)
}

test_that("reemplazos viaja solo con las columnas que alguien consume", {
  plan <- .mrc_plan()
  d <- monitoreo_aulas_dashboard(plan, data.frame(), list(enabled = TRUE))

  expect_gt(length(d$reemplazos), 0)
  cols <- names(d$reemplazos[[1]])
  expect_setequal(cols, intersect(REEMPLAZOS_COLUMNAS_PUBLICADAS, cols))

  # Lo que pide la tabla de Consultas (`preferredColumns`).
  for (campo in c("operational_code", "faculty", "replacement_for",
                  "replacement_order", "sample_status", "sample_role", "motivo")) {
    expect_true(campo %in% cols, info = campo)
  }
  # Lo que pide `reemplazosEnOrdenDeCadena` para ordenar por cadena.
  for (campo in c("operational_sequence", "titular_operational_code", "label")) {
    expect_true(campo %in% cols, info = campo)
  }
  # Y el ruido del plan NO viaja.
  for (campo in c("teacher_email", "teacher_phone", "sex_top_1", "link",
                  "selection_run_id", "program", "eligible_n")) {
    expect_false(campo %in% cols, info = campo)
  }
})

test_that("`motivo` se calcula ANTES del recorte y sigue llegando", {
  # Es la unica columna que esta lista aporta sobre `agenda`: si el recorte se
  # hiciera antes de calcularla, `reemplazos` seria un duplicado exacto y sin
  # ninguna razon de existir.
  d <- monitoreo_aulas_dashboard(.mrc_plan(), data.frame(), list(enabled = TRUE))
  motivos <- vapply(d$reemplazos, function(f) as.character(f$motivo %||% ""), character(1))
  expect_true(any(nzchar(motivos)))
})

test_that("la agenda no repite el parrafo metodologico en cada fila", {
  # 893 KB de los 4 865 de `agenda` eran la MISMA cadena en las 1 392 filas
  # —`calc_muestra_aulas_demo.R:497` la escribe una vez para la seleccion
  # entera—, medido sobre HSVG26ULT2 el 2026-09-08.
  #
  # Y no se ve: la tabla descarta las columnas constantes
  # (`columnasSinConstantesInertes`) y esta no sobrevive a esa regla. Ningun
  # consumidor de Monitoreo la lee.
  plan <- lapply(1:3, function(i) list(
    operational_code = sprintf("CH %d", i), classroom_id = sprintf("A-%d", i),
    label = sprintf("Curso %d", i), faculty = "Derecho", wave = "M1",
    sample_role = "titular", operational_status = "agendada",
    eligible_n = 30, expected_valid = 30,
    methodological_warning = paste(rep("un parrafo largo que se repite", 20), collapse = " | ")
  ))
  d <- monitoreo_aulas_dashboard(plan, data.frame(), list(enabled = TRUE))

  expect_gt(length(d$agenda), 0)
  for (fila in d$agenda) {
    expect_false("methodological_warning" %in% names(fila))
  }
  # Y lo que la agenda SI tiene que llevar sigue estando.
  expect_true(all(c("operational_code", "faculty", "wave") %in% names(d$agenda[[1]])))
})
