source("setup-load-all.R")
source("test-lamina-bloque-titulo.R", local = TRUE)

# CCSS Perfil 2026 (láminas 28 y 34): en barras agrupadas con cruces y `mostrar_significancia` la nota de las letras iba en el marcador
# derecho del pie y la leyenda del gráfico (que llega hasta el borde inferior del cajón) se montaba sobre ella. La nota se escribe
# ahora sobre «Base:» y el gráfico cede ese alto.

test_that("la nota de significancia no se monta sobre la leyenda ni sobre «Base:» en la agrupada con cruces", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg"); skip_if_not_installed("stringr")
  c <- .bt_cajas(.bt_render(.bt_agrupada()))
  nota <- c[c$nombre == "Nota significancia", ]; base <- c[c$nombre == "Base lamina", ]
  expect_equal(nrow(nota), 1L, info = paste(c$nombre, collapse = " | "))
  expect_match(nota$texto, "Las letras marcan al grupo superado")
  expect_lte(nota$y + nota$h, base$y + 1e-6)
  graf <- c[grepl("^tx[0-9]+$", c$nombre) & nzchar(c$texto), ]
  expect_gt(nrow(graf), 0)
  expect_true(all(graf$y + graf$h <= nota$y + 0.03), info = paste(graf$texto[graf$y + graf$h > nota$y + 0.03], collapse = ", "))
  # y la nota no se repite en el marcador del pie
  expect_equal(sum(grepl("Las letras marcan", c$texto)), 1L)
})
