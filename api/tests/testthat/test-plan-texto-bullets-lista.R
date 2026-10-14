test_that("las viñetas que llegan como arreglo JSON (lista de textos) se aceptan", {
  # Así las guarda el editor: `["Primer punto", "Segundo"]` se lee como lista.
  out <- .ppt_norm_text_lines(bullets = list("Primer punto.", "Segundo punto."))
  expect_identical(out, "• Primer punto.\n• Segundo punto.")
  expect_identical(.ppt_norm_text_lines(texto = list("Una línea"), bullets = list()), "Una línea")
  # Algo que no es un texto simple sigue siendo un error de especificación.
  expect_error(.ppt_norm_text_lines(bullets = list(list(a = 1))), class = "pulso_plan_spec_error")
})

test_that("«Preguntas por grupos» con las preguntas como arreglo JSON (lista sin nombres) arma la lámina", {
  el <- p_barras_multiapiladas(modo = "var_cruce", vars = list("est$g1", "est$g2", "est$g3"), cruces = "est$sexo")
  expect_identical(el$vars, c("est$g1", "est$g2", "est$g3"))
  # Una lista con nombres sigue siendo una lista de temas.
  el2 <- p_barras_multiapiladas(modo = "var_cruce", vars = list(Clima = c("est$g1", "doc$g1")))
  expect_identical(names(el2$vars), "Clima")
})
