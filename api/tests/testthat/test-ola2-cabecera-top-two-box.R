# Ola 2, G5 (captura «I. Cuatro gráficos con exclusión»): la cabecera de la columna Top Two Box salía «Top Two Box» en el
# gráfico de respaldo y «TOP TWO BOX» en el panel nativo vecino; y la del panel nativo salía 0.2 in por la derecha de su
# panel y arrancaba encima de la pregunta de 16 pt.
#
# Contrato: en la lámina la cabecera se escribe de una sola forma, la del estándar (G20, `.lam_rotulo_box`: «TOP TWO
# BOX»); ninguna sale del área de contenido y ninguna pisa una pregunta de panel (>= 0.02 in de aire vertical).

test_that("G5: una sola forma de la cabecera Top Two Box, dentro del panel y bajo su pregunta", {
  skip_if_not_installed("officer")
  pth <- .ola2_lamina_i()
  cajas <- .ola2_cajas(pth, 1L)
  cab <- cajas[toupper(cajas$texto) == "TOP TWO BOX", , drop = FALSE]
  expect_identical(nrow(cab), 2L)
  expect_identical(unique(cab$texto), "TOP TWO BOX")
  borde <- .std_geom("ancho") - .std_geom("margen_der")
  expect_true(all(cab$x1 <= borde + 1e-6))
  preg <- cajas[cajas$texto %in% c("El reglamento es pertinente", "El reglamento es claro"), , drop = FALSE]
  expect_identical(nrow(preg), 2L)
  malas <- character(0)
  for (i in seq_len(nrow(cab))) for (j in seq_len(nrow(preg))) {
    a <- cab[i, ]; b <- preg[j, ]
    if (min(a$x1, b$x1) - max(a$x0, b$x0) > 0 && .ola2_aire_y(a, b) < 0.02)
      malas <- c(malas, sprintf("cabecera en x=%.2f pisa «%s»: %.3f in de aire", a$x0, b$texto, .ola2_aire_y(a, b)))
  }
  expect_identical(malas, character(0))
})
