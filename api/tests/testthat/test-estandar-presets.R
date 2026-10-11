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
                 "tamaño de la base 14 → 10.*tamaño de la leyenda 16 → 12")
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

test_that("la regla de cifras chicas se impone por tipo y se avisa", {
  v <- list(barras_apiladas = list(args = list(etiquetas_arriba_si_no_caben = FALSE)),
            multi_apiladas = list(etiquetas_arriba_si_no_caben = FALSE))
  expect_message(p <- .std_imponer_base(v, avisar = TRUE), "cifras que no caben en su barra en barras apiladas")
  expect_true(p$barras_apiladas$args$etiquetas_arriba_si_no_caben)
  expect_true(p$multi_apiladas$etiquetas_arriba_si_no_caben)
  # sin base, la imposición por tipo no inventa una base
  expect_null(p$base)
})

test_that("los valores de fábrica viejos del histograma y del radar migran, los propios se respetan", {
  p <- list(histograma = list(bins = 8L, ancho_bin = list()),
            radar_tabla = list(limites = list(0L, 1L), mostrar_niveles = FALSE))
  expect_message(out <- .std_imponer_base(p, avisar = TRUE), "histograma con una barra por valor")
  expect_null(out$histograma$bins)
  expect_null(out$radar_tabla$limites)
  expect_true(out$radar_tabla$mostrar_niveles)
  propios <- list(histograma = list(bins = 5L), radar_tabla = list(limites = c(0.5, 1)))
  out2 <- .std_imponer_base(propios)
  expect_equal(out2$histograma$bins, 5L)
  expect_equal(out2$radar_tabla$limites, c(0.5, 1))
})

test_that("el coral de fábrica del extremo negativo de una paleta Likert migra al salmón del recetario (ADR 0093)", {
  p <- list(
    lst_a = list("Totalmente en Desacuerdo" = "#CA5651", "En desacuerdo" = "#FFD965", "De acuerdo" = "#ADD493",
                 "Totalmente de acuerdo" = "#70AD47", "SIN INF" = "#BFBFBF"),
    lst_cliente = list("Muy malo" = "#CA5651", "Malo" = "#123456", "Bueno" = "#654321"),
    lst_si_no = list("Sí" = "#081F5C", "No" = "#9DC3E6"))
  m <- .std_migrar_paletas(p)
  expect_identical(m$cambios, "lst_a")
  expect_identical(m$paletas$lst_a[["Totalmente en Desacuerdo"]], .std_paleta("likert")[1])
  expect_identical(m$paletas$lst_cliente, p$lst_cliente)   # paleta propia: se respeta
  expect_identical(m$paletas$lst_si_no, p$lst_si_no)
  # el normalizador de la configuración la aplica
  expect_identical(unname(unlist(.graficos_normalize_paletas(p)$lst_a))[1], toupper(.std_paleta("likert")[1]))
})
