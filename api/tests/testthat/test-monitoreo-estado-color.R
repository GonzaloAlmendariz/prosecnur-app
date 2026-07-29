# El color de un estado telefonico persiste.
#
# `.monitoreo_operational_model()` reconstruye `state_rules` campo por
# campo: es una whitelist. Un campo que no se nombre ahi se pierde en silencio
# al guardar, y el usuario ve su color revertirse sin explicacion la proxima vez
# que abre el proyecto.
#
# El color no es decoracion: el usuario define uno por estado para poder
# distinguirlos en el apilado diario, y once categorias con colores casi
# iguales fue el problema original de la franja de estados.

test_that("el color declarado sobrevive a la normalizacion", {
  modelo <- .monitoreo_operational_model(list(
    state_rules = list(
      list(
        id = "efectivo",
        label = "Efectivo",
        final_state = "effective",
        priority = 1L,
        outcome_values = list("efectivo", "completa"),
        color = "#168a55"
      )
    )
  ))

  regla <- Filter(function(x) identical(x$id, "efectivo"), modelo$state_rules)[[1]]
  expect_identical(regla$color, "#168a55")
})

test_that("una regla sin color no inventa uno", {
  modelo <- .monitoreo_operational_model(list(
    state_rules = list(
      list(id = "rechazo", label = "Rechazo", final_state = "refusal", priority = 2L)
    )
  ))

  regla <- Filter(function(x) identical(x$id, "rechazo"), modelo$state_rules)[[1]]
  expect_identical(regla$color, "")
})

test_that("las reglas por defecto siguen completas y con color vacio", {
  modelo <- .monitoreo_operational_model(list())
  expect_gt(length(modelo$state_rules), 0L)
  for (regla in modelo$state_rules) {
    expect_true(all(c("id", "label", "final_state", "priority", "outcome_values", "stop_contact", "color") %in% names(regla)))
  }
})
