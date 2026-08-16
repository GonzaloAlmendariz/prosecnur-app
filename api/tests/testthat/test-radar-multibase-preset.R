# El preset del proyecto tiene que llegar al radar multibase.
#
# No llegaba, y el fallo era invisible: `graficar_radar()` se invoca con
# `do.call` sobre el preset ya fusionado, y ese preset arrastra el estilo base
# —`preservar_tamanos_texto`, `size_texto_barras`…— que es de los graficadores
# de barras. Una sola clave ajena aborta la llamada con «unused arguments», y el
# despachador la reintenta SIN preset, así que la lámina salía igual pero con
# los defectos del graficador. Ninguna de las catorce claves `tabla_*` que el
# proyecto declara tenía efecto, y no había error que mirar.

test_that("las claves ajenas al radar no abortan la llamada", {
  fml <- names(formals(graficar_radar))
  ajenas <- c("preservar_tamanos_texto", "size_texto_barras",
              "size_titulo_slide", "size_cuerpo_slide")
  # Si alguna dejara de ser ajena, el filtro sobra y este test lo dirá.
  expect_false(any(ajenas %in% fml))
})

test_that("el cuerpo de la tabla sale del preset y no de un literal", {
  # Estuvo escrito a mano —un 9 fijo en el `ttheme`—, así que subirlo en el
  # proyecto no movía un punto.
  fml <- names(formals(.radar_mb_componer))
  expect_true("texto_pt" %in% fml)
  expect_identical(eval(formals(.radar_mb_componer)$texto_pt), .RADAR_MB_TEXTO_PT)
})

test_that("el defecto sigue siendo el de antes cuando nadie declara", {
  # Cambiar de literal a configurable no puede cambiar lo que ve un proyecto
  # que no declara nada.
  expect_equal(.RADAR_MB_TEXTO_PT, 9)
})
