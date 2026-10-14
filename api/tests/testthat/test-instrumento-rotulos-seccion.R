test_that("el rótulo de una sección es el título del grupo, no su clave interna", {
  survey <- data.frame(
    type  = c("begin_group", "select_one si_no", "end_group", "begin_group", "text", "end_group", "begin_group", "integer", "end_group"),
    name  = c("Pag2", "p2", "", "Pag3", "p7", "", "pag9", "p9", ""),
    label = c("Datos generales (p2-p6)", "¿Sexo?", "", "<b>Propósitos de la PUCP</b>", "¿Conoce?", "", "", "Edad", ""),
    stringsAsFactors = FALSE
  )
  mapa <- .inst_rotulos_de_grupo(survey)
  expect_identical(unname(mapa[c("Pag2", "Pag3", "pag9")]), c("Datos generales (p2-p6)", "Propósitos de la PUCP", "pag9"))
  expect_identical(.inst_rotulo_seccion(c("Pag2", "Pag3", "otra", NA, ""), mapa),
                   c("Datos generales (p2-p6)", "Propósitos de la PUCP", "otra", NA, ""))
  expect_identical(.inst_rotulos_de_grupo(NULL), character(0))
})
