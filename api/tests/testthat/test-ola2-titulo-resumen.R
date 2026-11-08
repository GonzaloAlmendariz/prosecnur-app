# Ola 2, R8-6 (Gonzalo: «nada de títulos generados»): una lámina de resumen sin título tomaba el enunciado de su primera
# variable como título (`.title_of_var(el$var)`): el título de UNA pregunta sobre una lámina de varias. Para los resúmenes
# (estilo «resumen», dumbbell con cruce, panorama, fortalezas, cobertura) el título queda vacío; los demás gráficos
# siguen tomando el enunciado de su pregunta.

.ola2_titulos <- function(pth) {
  cajas <- .ola2_cajas(pth, 1L)
  cajas$texto[cajas$y1 < 1.2]
}

test_that("R8-6: la divergente de resumen sin título no hereda el enunciado de su primera pregunta", {
  skip_if_not_installed("officer")
  fx <- .ola2_familias()
  pth <- .ola2_pptx(fx, list(p_slide_1_grafico(grafico = p_barras_divergentes(
    vars = c("doc$q19", "doc$q20"), n_negativas = 2, incluir_neutro = FALSE, overrides = list(estilo = "resumen")))))
  expect_false(any(c("El reglamento es pertinente", "El reglamento es claro") %in% .ola2_titulos(pth)))
})

test_that("R8-6: un gráfico de una pregunta sin título sigue tomando su enunciado", {
  skip_if_not_installed("officer")
  fx <- .ola2_familias()
  pth <- .ola2_pptx(fx, list(p_slide_1_grafico(grafico = p_barras_agrupadas(var = "doc$cat6"))))
  expect_true("Facultad" %in% .ola2_titulos(pth))
})

test_that("R8-6: qué elementos admiten título inferido", {
  expect_false(.plan_titulo_inferible(list(.element_type = "panorama")))
  expect_false(.plan_titulo_inferible(list(.element_type = "fortalezas")))
  expect_false(.plan_titulo_inferible(list(.element_type = "cobertura")))
  expect_false(.plan_titulo_inferible(list(.element_type = "dumbbell", cruce = "doc$sx")))
  expect_true(.plan_titulo_inferible(list(.element_type = "dumbbell", cruce = NULL)))
  expect_false(.plan_titulo_inferible(list(.element_type = "barras_divergentes", overrides = list(estilo = "resumen"))))
  expect_true(.plan_titulo_inferible(list(.element_type = "barras_agrupadas")))
})
