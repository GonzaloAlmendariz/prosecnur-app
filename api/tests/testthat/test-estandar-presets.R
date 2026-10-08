# ADR 0092 — un proyecto guardado con el estilo viejo migra solo al estándar, y
# el render lo avisa con nombre.

presets_viejos <- function() {
  list(
    base = list(size_nota_pie = 14L, size_titulo_slide = 24L, size_leyenda = 16L,
                size_texto_barras = 5.6, font_family = "Arial", color_titulo = "#123456",
                size_ejes = 16L),
    barras_apiladas = list(ancho_max_eje_y = 22)
  )
}

test_that("las claves del estándar se imponen sobre las guardadas en base", {
  p <- .std_imponer_base(presets_viejos())
  expect_equal(p$base$size_nota_pie, 10)
  expect_equal(p$base$size_leyenda, 12)
  expect_equal(p$base$size_titulo_slide, 24)
  expect_equal(p$base$size_texto_barras * 72.27 / 25.4, 14, tolerance = 0.02)
  # lo que el estándar no fija sigue siendo del proyecto (color = paleta del perfil)
  expect_equal(p$base$color_titulo, "#123456")
  expect_equal(p$base$size_ejes, 16L)
})

test_that("también se impone dentro de base$args, que es lo que hereda el motor", {
  v <- presets_viejos()
  v$base$args <- list(size_nota_pie = 14, size_leyenda = 16)
  p <- .std_imponer_base(v)
  expect_equal(p$base$args$size_nota_pie, 10)
  expect_equal(p$base$args$size_leyenda, 12)
})

test_that("el render avisa con nombre qué cambió, y calla si ya estaba conforme", {
  expect_message(.std_imponer_base(presets_viejos(), avisar = TRUE),
                 "size_nota_pie 14 → 10.*size_leyenda 16 → 12")
  conforme <- .std_imponer_base(presets_viejos())
  expect_silent(.std_imponer_base(conforme, avisar = TRUE))
})

test_that("la migración del normalizador y la del render dejan la base en el estándar", {
  m <- .graficos_migrar_defaults_fosiles(presets_viejos())
  expect_equal(m$base$size_nota_pie, .std_pt("base"))
  # la migración fósil previa sigue corriendo
  expect_equal(m$barras_apiladas$ancho_max_eje_y, 34)
  e <- suppressMessages(.enriquecer_presets(presets_viejos(), FALSE))
  expect_equal(e$base$size_nota_pie, .std_pt("base"))
  expect_equal(e$base$size_leyenda, .std_pt("leyenda"))
})
