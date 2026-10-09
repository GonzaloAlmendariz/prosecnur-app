# =============================================================================
# «Traer respuestas» no borra el marco al devolver la config recortada
# =============================================================================
#
# CCSS Perfil 2026-II, 2026-09-23: tras el primer «Traer respuestas» del día,
# `category_profiles` pasó de 58 filas a un entero, el plan de la config a 0
# filas y «A quién se está alcanzando» publicó «216 de 0 de la población».

.mrm_config <- function() list(
  plan = list(list(classroom_id = "A", operational_code = "CH 1", label = "a", wave = "M1",
                   sample_role = "titular", orden = 1)),
  quotas = list(strata = list(),
                category_profiles = data.frame(role = "sex", raw = "F", count = 400L),
                sex_by_faculty = data.frame(faculty = "X", sex = "F", n = 1L),
                profile_distributions = data.frame(a = 1)),
  representativity = list(profile_distributions = data.frame(a = 1), metrics = data.frame(m = 1))
)

test_that("la config que devuelve la pantalla no borra las tablas del marco ni el plan", {
  anterior <- .mrm_config()
  recortada <- monitoreo_aulas_estado_payload(anterior)
  expect_null(recortada[["quotas"]][["category_profiles"]])
  expect_null(recortada[["plan"]])
  # Tal como la manda la pantalla: por JSON, con las tablas vueltas listas.
  por_json <- jsonlite::fromJSON(jsonlite::toJSON(recortada, auto_unbox = TRUE), simplifyVector = FALSE)
  out <- .monitoreo_aulas_restaurar_marco(por_json, anterior)
  expect_identical(out$quotas, anterior$quotas)
  expect_identical(out$representativity, anterior$representativity)
  expect_identical(out$plan, anterior$plan)
})

test_that("un marco NUEVO que sí trae sus tablas reemplaza al anterior", {
  anterior <- .mrm_config()
  nuevo <- anterior
  nuevo$quotas$category_profiles <- data.frame(role = "sex", raw = "M", count = 9L)
  out <- .monitoreo_aulas_restaurar_marco(nuevo, anterior)
  expect_identical(out$quotas$category_profiles$raw, "M")
})

test_that("pasa por el normalizador: la población sobrevive al merge del sync", {
  anterior <- .mrm_config()
  por_json <- jsonlite::fromJSON(jsonlite::toJSON(monitoreo_aulas_estado_payload(anterior), auto_unbox = TRUE),
                                 simplifyVector = FALSE)
  out <- monitoreo_aulas_normalize_config(por_json, previous = anterior)
  expect_true(is.data.frame(out$quotas$category_profiles))
  expect_identical(nrow(out$quotas$category_profiles), 1L)
})

test_that("un proyecto YA guardado sin el marco lo recupera del marco y la selección de Cálculo", {
  # CCSS, 2026-09-23 12:12: guardado después del recorte, sin config anterior
  # de la que restaurar; «257 de 0 de la población» en la app y en el Sheets.
  anterior <- .mrm_config()
  roto <- monitoreo_aulas_estado_payload(anterior)
  frame <- list(category_profiles = anterior$quotas$category_profiles,
                population_cross_profiles = anterior$quotas$sex_by_faculty)
  selection <- list(diagnostics = list(profile_distributions = anterior$quotas$profile_distributions),
                    representativity = anterior$representativity)
  out <- .monitoreo_aulas_reponer_marco_de_calc(roto, frame, selection)
  expect_identical(out[["quotas"]][["category_profiles"]], anterior$quotas$category_profiles)
  expect_identical(out[["quotas"]][["sex_by_faculty"]], anterior$quotas$sex_by_faculty)
  expect_identical(out[["representativity"]], anterior$representativity)
  expect_true("quotas$category_profiles" %in% attr(out, "repuesto"))
  # Uno sano no se toca.
  sano <- .monitoreo_aulas_reponer_marco_de_calc(anterior, frame, selection)
  expect_length(attr(sano, "repuesto"), 0L)
})
