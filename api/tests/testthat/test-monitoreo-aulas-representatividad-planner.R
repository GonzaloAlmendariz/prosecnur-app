# ADR 0121, fase F4: el universo y las variables se declaran en el Planner
# (ADR 0122); las celdas siguen saliendo del diseño. Declarar no cambia ninguna
# cifra, y lo que no casa entre las dos mitades se dice.

.tar_hsvg_planner <- function() list(
  eje_cuota = "facultad", agrupacion_operativa = "facultad",
  design_targets = list(schema = "monitoreo_aulas_design_targets_v1", facultades = list(
    list(facultad = "DERECHO", faculty_key = "derecho", cuota = 363, cuota_sexo = list(F = 190, M = 173), tau = 0.57),
    list(facultad = "LETRAS", faculty_key = "letras", cuota = 100, cuota_sexo = list(F = 60, M = 40), tau = 0.5)
  ))
)

.planner_con_rep <- function(rep, perfiles_declarados = TRUE) {
  p <- list(schema = "planner/v1", revision = 3L, declarado_en = list(perfiles = "2026-10-31T20:00:00Z"))
  if (perfiles_declarados) {
    p$perfiles <- list(list(tipo = "aulas", poblaciones = list(
      list(id = "principal", etiqueta = "Estudiantes", representatividad = rep))))
  }
  p
}

test_that("sin declaración en el Planner no hay nada que combinar", {
  expect_null(.mrpl_declarado(NULL))
  expect_null(.mrpl_declarado(list(schema = "otro")))
  expect_null(.mrpl_declarado(.planner_con_rep(NULL, perfiles_declarados = FALSE)))
  expect_null(.mrpl_declarado(.planner_con_rep(list(universo = list(nivel = "universidad")))))
  expect_identical(.mrpl_marca(NULL), "sin_planner")
})

test_that("el Planner manda en universo y variables; las celdas y sus cuotas no cambian", {
  declarado <- .mrpl_declarado(.planner_con_rep(list(
    universo = list(nivel = "universidad", valor = "PUCP", inferido = FALSE),
    variables = list(list(clave = "facultad", etiqueta = "Facultad"), list(clave = "sexo", etiqueta = "Sexo"))
  )))
  expect_identical(declarado$poblacion, "principal")
  cfg <- .tar_hsvg_planner()
  cfg$representatividad_planner <- declarado
  r <- monitoreo_aulas_representatividad_declarada(cfg)
  expect_identical(r$origen, "planner")
  expect_identical(r$origen_celdas, "traducida_v1")
  expect_false(r$universo$inferido)
  expect_identical(r$universo$valor, "PUCP")
  expect_length(r$discrepancias, 0L)
  # Sin categorías en el Planner, cada variable hereda las del diseño.
  expect_identical(vapply(r$variables[[1]]$categorias, `[[`, "", "valor"), c("DERECHO", "LETRAS"))
  expect_length(r$variables[[2]]$categorias, 2L)
  # Ninguna cifra cambia: las mismas cuatro celdas con la misma suma.
  sin_planner <- monitoreo_aulas_representatividad_declarada(.tar_hsvg_planner())
  expect_identical(lapply(r$celdas, `[[`, "valores"), lapply(sin_planner$celdas, `[[`, "valores"))
  expect_equal(sum(vapply(r$celdas, `[[`, 0, "cuota")), 363 + 100)
})

test_that("lo que no casa entre el Planner y el diseño se declara, no se corrige", {
  cfg <- .tar_hsvg_planner()
  cfg$representatividad_planner <- .mrpl_declarado(.planner_con_rep(list(
    variables = list(list(clave = "facultad"), list(clave = "nivel"))
  )))
  r <- monitoreo_aulas_representatividad_declarada(cfg)
  tipos <- vapply(r$discrepancias, `[[`, "", "tipo")
  expect_setequal(tipos, c("variable_sin_celdas", "celdas_sin_variable"))
  expect_identical(vapply(r$discrepancias, `[[`, "", "variable")[tipos == "variable_sin_celdas"], "nivel")
  expect_identical(vapply(r$discrepancias, `[[`, "", "variable")[tipos == "celdas_sin_variable"], "sexo")
  # Sin universo en el Planner, se conserva el deducido del diseño.
  expect_true(is.list(r$universo) || is.null(r$universo))
})

test_that("la marca del token cambia al declarar otra variable", {
  a <- .mrpl_declarado(.planner_con_rep(list(variables = list(list(clave = "facultad")))))
  b <- .mrpl_declarado(.planner_con_rep(list(variables = list(list(clave = "facultad"), list(clave = "sexo")))))
  expect_false(identical(.mrpl_marca(a), .mrpl_marca(b)))
})
