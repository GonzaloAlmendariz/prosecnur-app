# Filtro de efectiva con más de un criterio.
#
# El contrato admitía uno solo, así que un estudio que exige consentimiento Y
# encuesta terminada tenía que elegir cuál de las dos condiciones comprobaba.

test_that("un filtro con un solo criterio se sigue leyendo igual", {
  filtro <- list(enabled = TRUE, variable = "Intro/Consent", values = list("Yes"))
  criterios <- .monitoreo_effective_criteria(filtro)

  expect_length(criterios, 1L)
  expect_identical(criterios[[1]]$variable, "Intro/Consent")
  expect_identical(criterios[[1]]$values, list("Yes"))
})

test_that("los criterios adicionales se leen de `filters`", {
  filtro <- list(
    enabled = TRUE,
    variable = "Intro/Consent",
    values = list("Yes"),
    filters = list(
      list(variable = "Intro/Consent", values = list("Yes")),
      list(variable = "Fin/Completo", values = list("Si"))
    )
  )
  criterios <- .monitoreo_effective_criteria(filtro)

  # El primero no se cuenta dos veces por estar también en `filters`.
  expect_length(criterios, 2L)
  expect_identical(vapply(criterios, function(x) x$variable, character(1)),
                   c("Intro/Consent", "Fin/Completo"))
})

test_that("un criterio sin variable o sin valores no cuenta", {
  expect_length(.monitoreo_effective_criteria(list(variable = "", values = list("Yes"))), 0L)
  expect_length(.monitoreo_effective_criteria(list(variable = "P1", values = list())), 0L)
  expect_length(.monitoreo_effective_criteria(list(variable = "P1", values = list(""))), 0L)
})

test_that("el bloque normalizado conserva el primer criterio en `variable`", {
  # Es lo que sostiene la compatibilidad: quien solo lee `variable`/`values`
  # —el PDF telefónico, los proyectos guardados antes— sigue leyendo algo cierto.
  bloque <- .monitoreo_effective_filter_block(list(
    variable = "Intro/Consent",
    values = list("Yes"),
    filters = list(list(variable = "Fin/Completo", values = list("Si")))
  ))

  expect_identical(bloque$variable, "Intro/Consent")
  expect_identical(bloque$values, list("Yes"))
  expect_length(bloque$filters, 2L)
  expect_true(bloque$enabled)
})

test_that("sin nada declarado el filtro queda apagado", {
  bloque <- .monitoreo_effective_filter_block(list())
  expect_false(bloque$enabled)
  expect_identical(bloque$variable, "")
  expect_length(bloque$filters, 0L)
})

test_that("la máscara exige TODOS los criterios", {
  df <- data.frame(
    `Intro/Consent` = c("Yes", "Yes", "No", "Yes"),
    `Fin/Completo` = c("Si", "No", "Si", "Si"),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  criterios <- .monitoreo_effective_criteria(list(
    variable = "Intro/Consent",
    values = list("Yes"),
    filters = list(list(variable = "Fin/Completo", values = list("Si")))
  ))

  # Solo las filas 1 y 4 cumplen las dos condiciones.
  expect_identical(
    .monitoreo_effective_criteria_mask(df, criterios),
    c(TRUE, FALSE, FALSE, TRUE)
  )
})

test_that("dentro de un criterio los valores son alternativas", {
  df <- data.frame(Consent = c("Yes", "Sí", "No"), stringsAsFactors = FALSE)
  criterios <- .monitoreo_effective_criteria(list(variable = "Consent", values = list("Yes", "Sí")))

  expect_identical(
    .monitoreo_effective_criteria_mask(df, criterios),
    c(TRUE, TRUE, FALSE)
  )
})

test_that("una variable que no está en el corte descarta todo", {
  # La definición existe y el corte no la cumple: no se puede dar por efectiva
  # una respuesta cuya condición no se pudo comprobar.
  df <- data.frame(Consent = c("Yes", "Yes"), stringsAsFactors = FALSE)
  criterios <- .monitoreo_effective_criteria(list(variable = "NoExiste", values = list("Yes")))

  expect_identical(.monitoreo_effective_criteria_mask(df, criterios), c(FALSE, FALSE))
})

test_that("sin criterios no se descarta nada", {
  df <- data.frame(Consent = c("Yes", "No"), stringsAsFactors = FALSE)
  expect_identical(.monitoreo_effective_criteria_mask(df, list()), c(TRUE, TRUE))
})

test_that("la máscara del reporte aplica los dos criterios y el filtro de prueba", {
  df <- data.frame(
    `Intro/Consent` = c("Yes", "Yes", "Yes", "No"),
    `Fin/Completo` = c("Si", "No", "Si", "Si"),
    `Intro/testreal` = c("real", "real", "test", "real"),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  profile <- list(
    family = "telefonico",
    platform_effective_filter = list(
      enabled = TRUE,
      variable = "Intro/Consent",
      values = list("Yes"),
      filters = list(list(variable = "Fin/Completo", values = list("Si")))
    ),
    platform_test_filter = list(
      enabled = TRUE,
      variable = "Intro/testreal",
      values = list("test"),
      real_values = list("real")
    )
  )

  # Fila 1: cumple ambos y es real. Fila 2: no terminó. Fila 3: es prueba.
  # Fila 4: no consintió.
  expect_identical(
    .monitoreo_report_effective_filter_mask(df, profile),
    c(TRUE, FALSE, FALSE, FALSE)
  )
})
