# Ola 2, R8-11 (qa_r7/EX_apilada_excluido.png): en una apilada con cruce, cuando `excluir_grupos` deja un solo grupo, la
# lámina trataba la fila única como «la afirmación de un público» y la rotulaba con el público («Docentes») en vez del
# grupo que quedó («Tiempo parcial por asignaturas (TPA)»). Un cruce de un nivel se rotula con ese nivel.

test_that("R8-11: la apilada con cruce de un solo grupo se rotula con el grupo, no con el público", {
  skip_if_not_installed("officer")
  fx <- .ola2_familias()
  t2 <- list(top2box_labels = c("De acuerdo", "Totalmente de acuerdo"))
  pth <- .ola2_pptx(fx, list(p_slide_1_grafico(titulo = "Un grupo", grafico = p_barras_apiladas(
    var = "doc$q19", cruces = "doc$ded", overrides = t2, excluir_grupos = list("Tiempo completo (TC)")))))
  cajas <- .ola2_cajas(pth, 1L)
  expect_true("Tiempo parcial por asignaturas (TPA)" %in% cajas$texto)
  expect_false(any(cajas$texto %in% c("Doc", "Docentes")))
})
