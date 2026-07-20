source("setup-load-all.R")

.ppt_test_layout_props <- function(path, layout) {
  doc <- officer::read_pptx(path)
  info <- officer::layout_summary(doc)
  master <- info$master[match(layout, info$layout)]
  officer::layout_properties(doc, layout = layout, master = master)
}

test_that("pies PPT se resuelven por geometria en ambas plantillas", {
  paths <- c(
    file.path("..", "..", "inst", "plantillas", "plantilla_16_9.pptx"),
    file.path("..", "..", "inst", "plantillas", "plantilla_acnur_16_9.pptx")
  )

  for (path in paths) {
    props <- .ppt_test_layout_props(path, "Graficos2")
    slots <- .ppt_bottom_text_specs(props, slide_width = 13.33333, slide_height = 7.5)

    expect_true(is.list(slots$base$loc))
    expect_true(is.list(slots$right$loc))
    expect_lt(slots$base$loc$left, slots$right$loc$left)
    expect_lt(slots$base$loc$left + slots$base$loc$width, slots$right$loc$left)
    expect_gt(slots$right$loc$left, 8)
  }
})

test_that("portada ACNUR declara el fondo antes del arbol de formas", {
  path <- file.path("..", "..", "inst", "plantillas", "plantilla_acnur_16_9.pptx")
  td <- tempfile("acnur_template_")
  dir.create(td)
  utils::unzip(path, exdir = td)
  ns <- c(
    p = "http://schemas.openxmlformats.org/presentationml/2006/main",
    a = "http://schemas.openxmlformats.org/drawingml/2006/main"
  )
  layout_files <- list.files(
    file.path(td, "ppt", "slideLayouts"),
    pattern = "^slideLayout[0-9]+\\.xml$",
    full.names = TRUE
  )
  layout_names <- vapply(layout_files, function(candidate) {
    xml <- xml2::read_xml(candidate)
    xml2::xml_attr(xml2::xml_find_first(xml, ".//p:cSld", ns), "name")
  }, character(1))
  layout_path <- layout_files[match("Title Slide", layout_names)]
  xml <- xml2::read_xml(layout_path)
  children <- xml2::xml_name(xml2::xml_children(xml2::xml_find_first(xml, ".//p:cSld", ns)))
  scheme <- xml2::xml_attr(xml2::xml_find_first(xml, ".//p:cSld/p:bg//a:schemeClr", ns), "val")
  theme <- xml2::read_xml(file.path(td, "ppt", "theme", "theme1.xml"))
  accent <- xml2::xml_attr(
    xml2::xml_find_first(theme, ".//a:clrScheme/a:accent1/a:srgbClr", ns),
    "val"
  )

  expect_lt(match("bg", children), match("spTree", children))
  expect_equal(scheme, "accent1")
  expect_equal(accent, "0072BC")
})

test_that("plantilla ACNUR no hereda un segundo logo en la esquina superior", {
  path <- file.path("..", "..", "inst", "plantillas", "plantilla_acnur_16_9.pptx")
  td <- tempfile("acnur_template_branding_")
  dir.create(td)
  utils::unzip(path, exdir = td)
  ns <- c(
    p = "http://schemas.openxmlformats.org/presentationml/2006/main",
    a = "http://schemas.openxmlformats.org/drawingml/2006/main"
  )
  presentation <- xml2::read_xml(file.path(td, "ppt", "presentation.xml"))
  slide_size <- xml2::xml_find_first(presentation, ".//p:sldSz", ns)
  width <- as.numeric(xml2::xml_attr(slide_size, "cx"))
  height <- as.numeric(xml2::xml_attr(slide_size, "cy"))
  layout_files <- list.files(
    file.path(td, "ppt", "slideLayouts"),
    pattern = "^slideLayout[0-9]+\\.xml$",
    full.names = TRUE
  )
  layout_names <- vapply(layout_files, function(candidate) {
    xml <- xml2::read_xml(candidate)
    xml2::xml_attr(xml2::xml_find_first(xml, ".//p:cSld", ns), "name")
  }, character(1))
  layout_path <- layout_files[match("Graficos2", layout_names)]
  xml <- xml2::read_xml(layout_path)
  pics <- xml2::xml_find_all(xml, ".//p:cSld/p:spTree//p:pic", ns)
  is_top_right <- vapply(pics, function(pic) {
    off <- xml2::xml_find_first(pic, ".//a:xfrm/a:off", ns)
    x <- as.numeric(xml2::xml_attr(off, "x"))
    y <- as.numeric(xml2::xml_attr(off, "y"))
    is.finite(x) && is.finite(y) && x >= width * 0.75 && y <= height * 0.20
  }, logical(1))

  expect_false(any(is_top_right))
})

test_that("titulo de seccion usa fallback solo si el placeholder esta fuera del lienzo", {
  general <- .ppt_test_layout_props(
    file.path("..", "..", "inst", "plantillas", "plantilla_16_9.pptx"),
    "Section Header"
  )
  acnur <- .ppt_test_layout_props(
    file.path("..", "..", "inst", "plantillas", "plantilla_acnur_16_9.pptx"),
    "Section Header"
  )
  spec <- list(type = "title", type_idx = 1L, ph_label = "prosecnur:section:title")

  general_safe <- .ppt_safe_section_title_spec(general, 13.33333, 7.5, spec)
  acnur_safe <- .ppt_safe_section_title_spec(acnur, 13.33333, 7.5, spec)

  expect_null(general_safe$loc)
  expect_true(is.list(acnur_safe$loc))
  expect_gte(acnur_safe$loc$left, 0)
  expect_lte(acnur_safe$loc$left + acnur_safe$loc$width, 13.33333)
  expect_lte(acnur_safe$loc$top + acnur_safe$loc$height, 7.5)
})

test_that("un footer configurado puede ubicarse despues del logo PULSO", {
  spec <- list(
    type = "body",
    type_idx = 2L,
    ph_label = "prosecnur:slide_1:right",
    loc = list(left = 8.17, top = 6.93, width = 4.69, height = 0.44)
  )
  configured <- .ppt_configured_source_spec(spec, list(
    source_footer_left = 2.15,
    source_footer_top = 6.96,
    source_footer_width = 4.00,
    source_footer_height = 0.28,
    source_footer_align = "left"
  ))

  expect_equal(configured$loc, list(left = 2.15, top = 6.96, width = 4.00, height = 0.28))
  expect_equal(configured$align, "left")
  expect_gt(configured$loc$left, 2.0)
  expect_lt(configured$loc$left + configured$loc$width, 6.5)
})

test_that("aviso de opcion multiple reserva una sola franja compacta", {
  compact <- .ppt_multiple_choice_notice_overrides(list(
    size_subtitulo = 12,
    canvas_h_header_in = 1.22,
    encabezado_separacion_in = 0.72
  ))

  expect_equal(compact$subtitulo, "Pregunta de opción múltiple")
  expect_equal(compact$face_subtitulo, "bold")
  expect_lte(compact$size_subtitulo, 10.5)
  expect_lte(compact$canvas_h_header_in, 0.38)
  expect_equal(compact$encabezado_separacion_in, 0)
})

test_that("perfil ACNUR da contraste a las categorias y compacta el aviso", {
  profile <- .PPT_STYLE_PROFILES$acnur_kobo_cruncher_plus$presets

  expect_equal(profile$base$color_ejes, .ACNUR_PPT_COLORS$text)
  expect_equal(profile$base$size_titulo_slide, 24)
  expect_equal(profile$base$size_ejes, 16)
  expect_equal(profile$base$size_texto_barras * (72.27 / 25.4), 16, tolerance = 0.05)
  expect_true(isTRUE(profile$base$partner_logo_cover))
  expect_equal(profile$base$partner_logo_cover_variant, "white")
  expect_equal(profile$base$partner_logo_cover_top, 6.75)
  expect_lt(
    profile$base$partner_logo_cover_left +
      profile$base$partner_logo_cover_height * 1078 / 423,
    profile$base$source_footer_left
  )
  expect_true(isTRUE(profile$barras_agrupadas$usar_canvas))
  expect_true(isTRUE(profile$barras_agrupadas$preservar_tamanos_texto))
  expect_true(isTRUE(profile$barras_agrupadas$canvas_w_adaptativo))
  expect_equal(profile$barras_agrupadas$canvas_w_extra, 0)
  expect_equal(profile$barras_agrupadas$canvas_h_toprow_in, 0)
  expect_lte(profile$barras_agrupadas$canvas_h_header_in, 0.34)
  expect_gte(profile$barras_agrupadas$alto_por_categoria, 0.40)
  expect_equal(profile$barras_agrupadas$grosor_barras, 0.66)
})

test_that("catalogo PULSO conserva geometria y alfa en navy blanco y negro", {
  skip_if_not_installed("png")
  root <- file.path("..", "..", "inst", "ppt_assets", "brand", "pulso-pucp")
  source <- file.path("..", "..", "inst", "hojas_ruta", "assets", "logo_pulso.png")
  paths <- file.path(root, c("navy.png", "white.png", "black.png"))

  expect_true(all(file.exists(paths)))
  source_img <- png::readPNG(source)
  variants <- lapply(paths, png::readPNG)
  expect_true(all(vapply(variants, function(img) identical(dim(img), dim(source_img)), logical(1))))
  expect_true(all(vapply(variants, function(img) {
    isTRUE(all.equal(img[, , 4], source_img[, , 4], tolerance = 0))
  }, logical(1))))

  visible <- source_img[, , 4] > 0
  visible_rgb <- rep(visible, 3)
  expect_equal(variants[[1L]][, , 1:3][visible_rgb], source_img[, , 1:3][visible_rgb], tolerance = 1 / 255)
  expect_true(all(variants[[2L]][, , 1:3][visible_rgb] == 1))
  expect_true(all(variants[[3L]][, , 1:3][visible_rgb] == 0))
})
