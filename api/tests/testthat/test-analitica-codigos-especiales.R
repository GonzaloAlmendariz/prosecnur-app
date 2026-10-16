# Códigos especiales sugeridos desde los instrumentos del estudio (2026-10-16).

.ce_inst <- function(list_name, name, label) {
  list(choices = data.frame(list_name = list_name, name = name, label = label, stringsAsFactors = FALSE))
}

test_that("sugiere los códigos especiales del instrumento con su etiqueta real", {
  i24 <- .ce_inst(c("sn", "sn", "sn", "gen", "gen"), c("1", "2", "99", "88", "99"),
                  c("Sí", "No", "No sé / Prefiero no decir", "Otro", "No sé / Prefiero no decir"))
  i26 <- .ce_inst(c("p4", "p4", "p4", "anio"), c("97", "98", "1", "2020"),
                  c("No especifica", "Ninguno", "Heterosexual", "2020"))
  out <- analitica_codigos_especiales(list(i24, i26))
  expect_identical(vapply(out, `[[`, "", "codigo"), c("88", "97", "98", "99"))
  por <- stats::setNames(out, vapply(out, `[[`, "", "codigo"))
  expect_identical(por[["97"]]$etiqueta, "No especifica")
  expect_identical(por[["99"]]$etiqueta, "No sé / Prefiero no decir")
  expect_identical(por[["99"]]$n_listas, 2L)
  # Un año o una categoría sustantiva no son especiales.
  expect_false(any(c("1", "2020") %in% names(por)))
})

test_that("negativos sí, decimales y vacíos no; sin instrumentos, lista vacía", {
  out <- analitica_codigos_especiales(list(.ce_inst(c("a", "a", "a"), c("-99", "98.5", NA), c("No responde", "x", "y"))))
  expect_identical(vapply(out, `[[`, "", "codigo"), "-99")
  expect_identical(analitica_codigos_especiales(list()), list())
  expect_identical(analitica_codigos_especiales(list(list(choices = NULL))), list())
})
