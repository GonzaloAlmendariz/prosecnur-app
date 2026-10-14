# F3 de checklist-poblacion-y-filtro-2026-10-14: la dependencia se propone desde el `relevant` del formulario.

inst_relevant <- function() {
  list(
    survey = data.frame(
      type = c("select_one sit", "select_one si_no", "integer", "select_one si_no"),
      name = c("situacion", "relacion", "ingreso", "mixta"),
      label = c("Situación laboral", "¿Trabajo relacionado?", "Ingreso", "Mixta"),
      relevant = c("", "selected(${situacion}, '1') or selected(${situacion}, '2') or selected(${situacion}, '3')",
                   "${situacion} = '1'", "selected(${situacion}, '1') and ${relacion} = '1'"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c(rep("sit", 4), "si_no", "si_no"),
      name = c("1", "2", "3", "4", "1", "2"),
      label = c("Dependiente", "Independiente", "Ambas", "No trabaja", "Sí", "No"),
      stringsAsFactors = FALSE
    )
  )
}

test_that("una condición simple con `or` propone la pregunta filtro y los rótulos de lo que habilita", {
  inst <- inst_relevant()
  h <- .relevant_habilitada_por(inst$survey$relevant[2], inst$survey, inst$choices)
  expect_equal(h$var, "situacion")
  expect_equal(h$codigos, c("1", "2", "3"))
  expect_equal(h$rotulos, c("Dependiente", "Independiente", "Ambas"))
  h2 <- .relevant_habilitada_por("${situacion} = '1'", inst$survey, inst$choices)
  expect_equal(h2$rotulos, "Dependiente")
})

test_that("lo que no es una condición simple no se propone", {
  expect_null(.relevant_habilitada_por("selected(${a}, '1') and ${b} = '1'"))
  expect_null(.relevant_habilitada_por("${a} = '1' or ${b} = '1'"))
  expect_null(.relevant_habilitada_por("not(selected(${a}, '1'))"))
  expect_null(.relevant_habilitada_por("${edad} > 18"))
  expect_null(.relevant_habilitada_por("${a} != '1'"))
  expect_null(.relevant_habilitada_por(""))
  expect_null(.relevant_habilitada_por(NA))
})

test_that("cada variable del editor publica quién la habilita", {
  inst <- inst_relevant()
  vs <- .graficos_extract_vars_from_inst(inst, data = data.frame(situacion = "1", relacion = "1", ingreso = 1, mixta = "1"))
  por <- setNames(lapply(vs, function(v) v$habilitada_por), vapply(vs, function(v) v$name, ""))
  expect_null(por$situacion)
  expect_equal(por$relacion$var, "situacion")
  expect_equal(por$ingreso$rotulos, "Dependiente")
  expect_null(por$mixta)
})
