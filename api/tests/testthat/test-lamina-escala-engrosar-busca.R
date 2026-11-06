# Ítems 4–5 de checklist-arte-vs-conta: la barra engrosa lo que de verdad cabe, no `sobra / nb`.

test_that("devuelve el mayor engrosamiento que cabe, sin pasar el grosor holgado de la tabla", {
  tope <- .lam_grosor_holgado(4) - 0.44
  expect_equal(.lam_escala_engrosar_busca(0.44, 4, function(d) TRUE), tope, tolerance = 1e-9)
  expect_equal(.lam_escala_engrosar_busca(0.44, 4, function(d) d <= 0.05), 0.05, tolerance = 1e-9)
  expect_identical(.lam_escala_engrosar_busca(0.44, 4, function(d) FALSE), 0)
  expect_identical(.lam_escala_engrosar_busca(.lam_grosor_holgado(4) + 0.1, 4, function(d) TRUE), 0)
})
