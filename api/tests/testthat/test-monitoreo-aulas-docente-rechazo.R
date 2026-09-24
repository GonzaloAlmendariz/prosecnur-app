# Un docente que ya rechazó no se propone como refuerzo (Stefano, 2026-09-24:
# R 5.1, del mismo docente que rechazó CH 17).

.dr_u <- function(cod, rol = "titular", ...) {
  utils::modifyList(list(
    selection_run_id = "sel", operational_code = cod, titular_operational_code = cod,
    sample_role = rol, replacement_order = 0, classroom_id = cod, collection_unit_id = cod,
    faculty = "DERECHO", eligible_n = 40, expected_valid = 20, sample_status = "",
    operational_status = "", application_status = "", scheduled_date = "",
    sex_top_1 = "M", sex_top_1_n = 25, sex_top_2 = "F", sex_top_2_n = 15, teacher = ""
  ), list(...))
}

test_that("se reconoce al docente que rechazó, con o sin tildes y mayúsculas", {
  plan <- list(
    .dr_u("CH 17", sample_status = "RECHAZO", teacher = "VILLAVICENCIO VASQUEZ, JULIO ALBERTO"),
    .dr_u("CH 5", sample_status = "AGENDADA", teacher = "Pérez, Ana")
  )
  r <- monitoreo_aulas_docentes_que_rechazaron(plan)
  expect_identical(r, "VILLAVICENCIO VASQUEZ, JULIO ALBERTO")
  expect_true(.madr_docente_rechazo("Villavicencio Vásquez, Julio Alberto", r))
  expect_false(.madr_docente_rechazo("PEREZ, ANA", r))
  expect_false(.madr_docente_rechazo("", r))
})

test_that("marcarla a mano se permite, pero avisa", {
  plan <- list(
    .dr_u("CH 17", sample_status = "RECHAZO", teacher = "VILLAVICENCIO VASQUEZ, JULIO ALBERTO"),
    .dr_u("R 5.1", rol = "chain_reserve", titular_operational_code = "CH 5",
          sample_status = "SIN CONTACTAR", teacher = "VILLAVICENCIO VASQUEZ, JULIO ALBERTO"),
    .dr_u("R 2.1", rol = "chain_reserve", titular_operational_code = "CH 2",
          sample_status = "SIN CONTACTAR", teacher = "CASTILLO BARDALEZ, PAUL")
  )
  a <- monitoreo_aulas_marcar_refuerzo(plan, "R 5.1", para = "Nivel 9")
  expect_match(a$aviso, "ya rechazó")
  expect_match(monitoreo_aulas_marcar_refuerzo_texto(a), "ya rechazó")
  b <- monitoreo_aulas_marcar_refuerzo(plan, "R 2.1", para = "Nivel 9")
  expect_identical(b$aviso, "")
})

test_that("el banco por celda no propone aulas de un docente que ya rechazó", {
  plan <- list(
    .dr_u("CH 17", sample_status = "RECHAZO", teacher = "DOCENTE X"),
    .dr_u("EXTRA 1", rol = "extra_reserve_pool", teacher = "DOCENTE X"),
    .dr_u("EXTRA 2", rol = "extra_reserve_pool", teacher = "DOCENTE Y")
  )
  avance <- list(list(faculty_key = "DERECHO", facultad = "DERECHO", estado = "deficit_proyectado",
                      brecha = 10, faltan = 10, sexo = "F"))
  o <- tryCatch(monitoreo_aulas_reserva_por_celda(avance, plan), error = function(e) list())
  cods <- unlist(lapply(o, function(c1) vapply(c1$candidatos %||% list(), function(x) as.character(x[[1]]), "")))
  # No vacío: el otro extra sí sale, así que el filtro es el que saca al primero.
  expect_true("EXTRA 2" %in% cods)
  expect_false("EXTRA 1" %in% cods)
})
