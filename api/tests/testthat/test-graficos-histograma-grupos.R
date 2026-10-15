# G1 (checklist-histograma-serie-antetitulo-2026-10-14.md): el histograma por grupos sale con el dibujo del mazo de
# Ing. Civil por defecto, y lo que declara la lámina sigue mandando.

test_that("con grupo, el histograma trae cifras en la cima, composición en el subtítulo y sin eje Y", {
  el <- p_histograma("edad", grupo = "sexo")
  ov <- el$overrides
  expect_identical(ov$posicion_etiquetas, "cima")
  expect_identical(ov$etiqueta_cima_formato, "dos_lineas")
  expect_true(ov$mostrar_resumen_grupos_subtitulo)
  expect_false(ov$mostrar_eje_y)
  expect_false(ov$mostrar_bins_vacios)
})

test_that("lo declarado en la lámina gana al estilo por grupos", {
  el <- p_histograma("edad", grupo = "sexo", overrides = list(mostrar_eje_y = TRUE, posicion_etiquetas = "segmento"))
  expect_true(el$overrides$mostrar_eje_y)
  expect_identical(el$overrides$posicion_etiquetas, "segmento")
})

test_that("sin grupo, el histograma no recibe el estilo por grupos", {
  expect_null(p_histograma("edad")$overrides$posicion_etiquetas)
})
