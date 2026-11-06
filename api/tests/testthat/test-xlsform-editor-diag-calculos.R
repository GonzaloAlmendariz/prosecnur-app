# Mata: avisar «Fórmula no se pudo interpretar» por aritmética válida (int(${r} * 5)), callar una referencia
# inexistente dentro de un if(...) y dejar pasar un paréntesis o unas comillas sin cerrar.

wb_con_calculos <- function(calculos) {
  filas <- c(
    list(list("integer", "edad", "Edad", "")),
    lapply(seq_along(calculos), function(i) list("calculate", sprintf("c%d", i), "", calculos[[i]]))
  )
  list(
    survey = list(columns = list("type", "name", "label", "calculation"), rows = filas),
    choices = list(columns = list("list_name", "name", "label"), rows = list()),
    settings = list(columns = list("form_title"), rows = list(list("Prueba")))
  )
}

titulos <- function(diags) vapply(diags, function(d) d$title %||% "", character(1))

test_that("la aritmética de un sorteo no se marca como fórmula ininterpretable", {
  wb <- wb_con_calculos(list(
    "once(random())",
    "if(int(${c1} * 5) = 0, 'a', if(int(${c1} * 5) = 1, 'b', 'c'))",
    "${edad} div 2 + ${edad} mod 3"
  ))
  t <- titulos(.xlsform_editor_validate_workbook(wb))
  expect_false(any(grepl("no se pudo interpretar", t)))
  expect_false(any(grepl("incompleta|inexistente", t)))
})

test_that("una referencia inexistente dentro de un if se avisa", {
  t <- titulos(.xlsform_editor_validate_workbook(wb_con_calculos(list("if(${nadie} = 1, 'a', 'b')"))))
  expect_true(any(grepl("inexistente: \"nadie\"", t, fixed = TRUE)))
})

test_that("paréntesis o comillas sin cerrar se avisan como fórmula incompleta", {
  expect_identical(.xlsform_calculo_desbalance("if(${a} = 1, 'x', 'y'"), "deja un paréntesis sin cerrar")
  expect_identical(.xlsform_calculo_desbalance("concat('a, ${b})"), "deja unas comillas sin cerrar")
  expect_identical(.xlsform_calculo_desbalance("int(${a}))"), "cierra un paréntesis que no se abrió")
  expect_null(.xlsform_calculo_desbalance("concat('(', ${a}, ')')"))
  t <- titulos(.xlsform_editor_validate_workbook(wb_con_calculos(list("int(${edad} * 2"))))
  expect_true("Fórmula incompleta" %in% t)
})
