# «REFUERZO AGENDADO»: agendada para todo, y refuerzo (C) para siempre.
# Gonzalo, 2026-09-24: «sería bueno tenerla como agendada como refuerzo».

.rag_u <- function(cod, rol = "titular", ...) {
  utils::modifyList(list(
    selection_run_id = "sel", operational_code = cod, titular_operational_code = cod,
    sample_role = rol, replacement_order = 0, classroom_id = cod, collection_unit_id = cod,
    faculty = "DERECHO", eligible_n = 40, expected_valid = 20, sample_status = "",
    operational_status = "", application_status = "", scheduled_date = "",
    sex_top_1 = "M", sex_top_1_n = 25, sex_top_2 = "F", sex_top_2_n = 15
  ), list(...))
}

test_that("el estado se reconoce con sus dos grafías y es propio, no «sin contactar»", {
  expect_identical(monitoreo_aulas_estado_muestra("REFUERZO AGENDADO"), "refuerzo_agendado")
  expect_identical(monitoreo_aulas_estado_muestra("Refuerzo agendada"), "refuerzo_agendado")
  expect_identical(monitoreo_aulas_estado_muestra("refuerzo_agendado"), "refuerzo_agendado")
  expect_true("refuerzo_agendado" %in% monitoreo_aulas_estados_muestra())
})

test_that("cuenta como AGENDADA en los predicados compartidos", {
  expect_true(.maau_agendada("REFUERZO AGENDADO", ""))
  expect_true(.maau_con_fecha("REFUERZO AGENDADO", ""))
  expect_true("refuerzo_agendado" %in% .madm_AGENDADOS)
})

test_that("el desplegable lo ofrece y la hoja lo pinta de morado", {
  expect_true("REFUERZO AGENDADO" %in% AULAS_LIBRO_STATUS_MUESTRA_BASE)
  reglas <- vapply(.mafs_REGLAS_STATUS_MUESTRA, function(r) r$texto, character(1))
  expect_true("REFUERZO AGENDADO" %in% reglas)
  # Antes que «AGENDADA»: gana el índice menor.
  expect_lt(match("REFUERZO AGENDADO", reglas), match("AGENDADA", reglas))
})

test_that("regenerar el libro lo escribe con su forma, no con guiones bajos", {
  expect_identical(.calg_status_excel("refuerzo_agendado"), "REFUERZO AGENDADO")
})

test_that("tecleado en el libro sin marca de la app, se sella como refuerzo DECLARADO", {
  plan <- list(
    .rag_u("CH 30", operational_status = "aplicada", effective_surveys = 14),
    .rag_u("R 30.1", rol = "chain_reserve", titular_operational_code = "CH 30",
           replacement_order = 1, sample_status = "REFUERZO AGENDADO",
           scheduled_date = "2026-09-25")
  )
  s <- monitoreo_aulas_sellar_procedencia(plan, ahora = "2026-09-24T12:00:00Z",
                                          hoy = as.Date("2026-09-24"))
  expect_equal(s$selladas, 1)
  expect_identical(s$plan[[2]]$activation_origin, "refuerzo")
  o <- monitoreo_aulas_refuerzos(s$plan, data.frame(), list(), hoy = as.Date("2026-09-24"))
  a <- Filter(function(x) identical(x$codigo, "R 30.1"), o$activadas)[[1]]
  expect_identical(a$caso, "C")
  expect_identical(a$procedencia_fuente, "declarada")
})

test_that("los operativos que empezaron sin la categoría no pierden nada (2026-09-24)", {
  # HSVG y CCSS salieron a campo antes de «REFUERZO AGENDADO»: sus refuerzos
  # agendados dicen «AGENDADA» a secas. Tienen que seguir contando como agendados
  # y como refuerzo (C) por su sello, sin exigir el estado nuevo.
  plan <- list(
    .rag_u("CH 40", operational_status = "aplicada", effective_surveys = 14),
    .rag_u("R 40.1", rol = "chain_reserve", titular_operational_code = "CH 40",
           replacement_order = 1, sample_status = "AGENDADA",
           scheduled_date = "2026-09-25", activation_origin = "refuerzo",
           activated_for = "Nivel 9")
  )
  expect_true(.maau_agendada("AGENDADA", ""))
  s <- monitoreo_aulas_sellar_procedencia(plan, hoy = as.Date("2026-09-24"))
  expect_equal(s$selladas, 0)
  o <- monitoreo_aulas_refuerzos(plan, data.frame(), list(), hoy = as.Date("2026-09-24"))
  a <- Filter(function(x) identical(x$codigo, "R 40.1"), o$activadas)[[1]]
  expect_identical(a$caso, "C")
  expect_identical(a$procedencia_fuente, "declarada")
})
