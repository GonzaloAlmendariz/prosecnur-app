# Contrato de las dos mejoras esteticas del plan automatico PPT (perfil ACNUR):
#   FIX 1 - grosor de barras agrupadas con pocas categorias (dicotomicas Si/No)
#   FIX 2 - divisores de seccion enriquecidos (titulo de seccion + acento)
# Ambas se verifican tambien re-renderizando el PPT real; aqui se fija el
# contrato numerico/estructural puro y deterministico.

test_that("FIX 1: pocas categorias llenan el panel sin exceder el grosor base", {
  # Base 0.82, piso virtual 7: sin correccion una dicotomica caeria al piso 0.42.
  expect_equal(.barras_agrupadas_grosor_eff(2, 0.82, 7), 0.62)
  expect_equal(.barras_agrupadas_grosor_eff(3, 0.82, 7), 0.67)
  expect_equal(.barras_agrupadas_grosor_eff(1, 0.82, 7), 0.57)

  # El perfil ACNUR usa grosor base 0.66: el piso de pocas categorias nunca lo
  # supera.
  expect_equal(.barras_agrupadas_grosor_eff(2, 0.66, 7), 0.62)
  expect_lte(.barras_agrupadas_grosor_eff(2, 0.5, 7), 0.5)
  expect_equal(.barras_agrupadas_grosor_eff(2, 0.5, 7), 0.5)
})

test_that("FIX 1: muchas categorias conservan el grosor previo", {
  # n = min_filas -> grosor completo; n entre 4 y min_filas -> rampa previa.
  expect_equal(.barras_agrupadas_grosor_eff(7, 0.82, 7), 0.82)
  expect_equal(.barras_agrupadas_grosor_eff(5, 0.82, 7), 0.82 * 5 / 7)
  expect_equal(.barras_agrupadas_grosor_eff(4, 0.82, 7), 0.82 * 4 / 7)
})

test_that("FIX 1: sin canvas o n invalido devuelve el grosor base", {
  expect_equal(.barras_agrupadas_grosor_eff(2, 0.82, 7, usar_canvas = FALSE), 0.82)
  expect_equal(.barras_agrupadas_grosor_eff(0, 0.82, 7), 0.82)
  # base invalido -> default 0.6; el piso de pocas categorias nunca lo supera.
  expect_equal(.barras_agrupadas_grosor_eff(2, NA, 7), 0.6)
})

test_that("FIX 2: enriquecer_presets rellena estilos de seccion ausentes", {
  base_in <- list(base = list(size_titulo_slide = 22.5, color_subtitulo = "#18375F",
                              color_titulo = "#1A1A1A"))
  out <- .enriquecer_presets(base_in)$base

  expect_equal(out$size_titulo_seccion, round(22.5 * 1.3, 1))
  expect_gt(out$size_titulo_seccion, 22.5)
  expect_true(isTRUE(out$bold_titulo_seccion))
  # Color de seccion derivado del secundario de marca (no repite el cuerpo).
  expect_equal(out$color_titulo_seccion, "#18375F")
})

test_that("FIX 2: enriquecer_presets respeta estilos de seccion explicitos", {
  base_in <- list(base = list(
    size_titulo_slide = 22.5, color_subtitulo = "#18375F",
    size_titulo_seccion = 40, color_titulo_seccion = "#000000",
    bold_titulo_seccion = FALSE
  ))
  out <- .enriquecer_presets(base_in)$base

  expect_equal(out$size_titulo_seccion, 40)
  expect_equal(out$color_titulo_seccion, "#000000")
  expect_false(out$bold_titulo_seccion)
})

test_that("FIX 2: sin color de subtitulo no se inventa color de seccion", {
  out <- .enriquecer_presets(list(base = list(size_titulo_slide = 24)))$base
  expect_null(out$color_titulo_seccion)
  expect_equal(out$size_titulo_seccion, round(24 * 1.3, 1))
})

test_that("FIX 2: el spec de titulo de seccion marca el ph_label de seccion", {
  spec <- .ppt_safe_section_title_spec(data.frame(), 13.33333, 7.5,
                                       list(type = "title", type_idx = NULL))
  expect_equal(spec$ph_label, "prosecnur:section:title")
  # Fallback dentro del lienzo (placeholder ACNUR fuera de canvas).
  expect_true(is.list(spec$loc))
  expect_gte(spec$loc$left, 0)
  expect_lte(spec$loc$left + spec$loc$width, 13.33333)
  expect_lte(spec$loc$top + spec$loc$height, 7.5)
})
