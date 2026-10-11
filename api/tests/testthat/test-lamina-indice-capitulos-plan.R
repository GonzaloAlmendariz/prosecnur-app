test_that("un índice sin capítulos toma los capítulos del informe, no la lámina de la plantilla", {
  plan <- list(
    list(.slide_type = "index", slots = list(title = "ÍNDICE")),
    list(.slide_type = "section", slots = list(title = "Perfil del encuestado")),
    list(.slide_type = "section", slots = list(title = "Detalle"), meta = list(nivel = "subcapitulo")),
    list(.slide_type = "p_grafico", slots = list(title = "x")),
    list(.slide_type = "section", title = "Gestión"),
    list(.slide_type = "section", slots = list(title = "  "))
  )
  caps <- .lam_indice_capitulos_del_plan(plan)
  expect_identical(caps, c("Perfil del encuestado", "Gestión"))
  expect_true(.lam_indice_cabe(caps))
  expect_identical(.lam_indice_capitulos_del_plan(list()), character(0))
})
