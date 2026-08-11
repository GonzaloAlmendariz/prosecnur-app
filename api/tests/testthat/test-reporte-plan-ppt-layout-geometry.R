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

test_that("el fallback del titulo de seccion queda emparejado con el acento del layout", {
  # GUARD DE REGRESION. La geometria del fallback (0.082 / 0.335 / 0.26) NO es
  # arbitraria: el layout trae una barra de acento y el titulo se ubica a su
  # derecha y centrado sobre ella. "Alinear" este left con el margen de las
  # laminas de contenido (0.88 cm) hace que el acento parta la primera letra.
  acnur <- file.path("..", "..", "inst", "plantillas", "plantilla_acnur_16_9.pptx")
  td <- tempfile("acnur_acento_")
  dir.create(td)
  utils::unzip(acnur, exdir = td)
  ns <- c(
    p = "http://schemas.openxmlformats.org/presentationml/2006/main",
    a = "http://schemas.openxmlformats.org/drawingml/2006/main"
  )
  layout_files <- list.files(file.path(td, "ppt", "slideLayouts"),
                             pattern = "^slideLayout[0-9]+\\.xml$", full.names = TRUE)
  layout_names <- vapply(layout_files, function(candidate) {
    xml2::xml_attr(xml2::xml_find_first(xml2::read_xml(candidate), ".//p:cSld", ns), "name")
  }, character(1))
  xml <- xml2::read_xml(layout_files[match("Section Header", layout_names)])
  accent <- xml2::xml_find_first(
    xml, ".//p:sp[.//p:cNvPr[@name='prosecnur:section:accent']]", ns
  )
  expect_false(inherits(accent, "xml_missing"))
  off <- xml2::xml_find_first(accent, ".//a:xfrm/a:off", ns)
  ext <- xml2::xml_find_first(accent, ".//a:xfrm/a:ext", ns)
  emu_in <- 914400
  accent_left <- as.numeric(xml2::xml_attr(off, "x")) / emu_in
  accent_right <- accent_left + as.numeric(xml2::xml_attr(ext, "cx")) / emu_in
  accent_center_y <- (as.numeric(xml2::xml_attr(off, "y")) +
                        as.numeric(xml2::xml_attr(ext, "cy")) / 2) / emu_in

  spec <- list(type = "title", type_idx = 1L, ph_label = "prosecnur:section:title")
  safe <- .ppt_safe_section_title_spec(
    .ppt_test_layout_props(acnur, "Section Header"), 13.33333, 7.5, spec
  )

  # El titulo arranca DESPUES del acento, no encima ni a su izquierda.
  expect_gt(safe$loc$left, accent_right)
  # Y su caja esta centrada a la misma altura que el acento.
  expect_equal(safe$loc$top + safe$loc$height / 2, accent_center_y, tolerance = 1e-3)
  # El texto se ancla al centro de esa caja; si no, se despega hacia arriba.
  expect_equal(safe$anchor, "ctr")
})

test_that("una plantilla con Section Header usable conserva su geometria propia", {
  general <- .ppt_test_layout_props(
    file.path("..", "..", "inst", "plantillas", "plantilla_16_9.pptx"),
    "Section Header"
  )
  spec <- list(type = "title", type_idx = 1L, ph_label = "prosecnur:section:title")

  safe <- .ppt_safe_section_title_spec(general, 13.33333, 7.5, spec)

  expect_null(safe$loc)
  # Sin fallback tampoco forzamos anclaje: manda el placeholder de la plantilla.
  expect_null(safe$anchor)
})

test_that(".ppt_section_title_size respeta el valor explicito y deriva del titulo de slide", {
  # Un valor explicito del perfil o del analista siempre manda.
  expect_equal(.ppt_section_title_size(30, 24), 30)
  # Derivado: mismo redondeo que aplicaba la capa router.
  expect_equal(.ppt_section_title_size(NULL, 22.5), 29.2)
  expect_equal(.ppt_section_title_size(NA_real_, 22.5), 29.2)
  # Un valor presente pero invalido tampoco gana: se trata como "no configurado".
  expect_equal(.ppt_section_title_size(0, 22.5), 29.2)
  expect_equal(.ppt_section_title_size("", 22.5), 29.2)
  # Sin nada utilizable devuelve NA para que el llamador aplique su default.
  expect_true(is.na(.ppt_section_title_size(NULL, NULL)))
  expect_true(is.na(.ppt_section_title_size(NULL, 0)))
  expect_true(is.na(.ppt_section_title_size("", "")))
})

test_that("router y motor derivan el mismo cuerpo para el titulo de seccion", {
  # Si estas dos capas divergen, el mismo proyecto exporta tamanos distintos
  # segun entre por el router (/api/graficos/ppt) o directo (preview, Word).
  for (size_slide in c(18, 22.5, 24, 30)) {
    enriched <- .enriquecer_presets(list(base = list(size_titulo_slide = size_slide)))
    expect_equal(
      enriched$base$size_titulo_seccion,
      .ppt_section_title_size(NULL, size_slide)
    )
  }

  # Un size_titulo_seccion explicito sobrevive al enriquecido.
  explicit <- .enriquecer_presets(
    list(base = list(size_titulo_slide = 24, size_titulo_seccion = 30))
  )
  expect_equal(explicit$base$size_titulo_seccion, 30)

  # Sin ningun size no se inventa uno.
  empty <- .enriquecer_presets(list(base = list()))
  expect_null(empty$base$size_titulo_seccion)
})

test_that("el titulo de seccion no depende de cuantas laminas lo preceden", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")
  skip_if_not_installed("flextable")

  template <- file.path("..", "..", "inst", "plantillas", "plantilla_acnur_16_9.pptx")
  dat <- data.frame(x = rep(c("Si", "No"), 20), stringsAsFactors = FALSE)
  inst <- list(
    survey = data.frame(
      name = "x", type = "select_one l", label = "P", list_name = "l",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = "l", name = c("Si", "No"), label = c("Si", "No"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )
  presets <- p_presets(base = list(size_titulo_slide = 22.5))
  seccion <- p_slide_seccion("Acceso al Espacio de Proteccion")
  ficha <- p_slide_tabla_tecnica(
    titulo = "Ficha tecnica",
    filas = data.frame(Campo = "Universo", Valor = "Adultos", stringsAsFactors = FALSE)
  )

  medir <- function(plan) {
    out <- tempfile(fileext = ".pptx")
    reporte_ppt_plan(
      data = dat, instrumento = inst, plan = plan, presets = presets,
      path_ppt = out, template_pptx = template, mensajes_progreso = FALSE
    )
    td <- tempfile("seccion_")
    dir.create(td)
    utils::unzip(out, exdir = td)
    ns <- c(
      p = "http://schemas.openxmlformats.org/presentationml/2006/main",
      a = "http://schemas.openxmlformats.org/drawingml/2006/main"
    )
    slides <- list.files(file.path(td, "ppt", "slides"), pattern = "^slide[0-9]+\\.xml$",
                         full.names = TRUE)
    for (path in slides) {
      xml <- xml2::read_xml(path)
      node <- xml2::xml_find_first(
        xml, ".//p:sp[.//p:cNvPr[@name='prosecnur:section:title']]", ns
      )
      if (inherits(node, "xml_missing")) next
      off <- xml2::xml_find_first(node, ".//p:spPr/a:xfrm/a:off", ns)
      ext <- xml2::xml_find_first(node, ".//p:spPr/a:xfrm/a:ext", ns)
      sz <- xml2::xml_attr(xml2::xml_find_first(node, ".//a:rPr[@sz]", ns), "sz")
      anchor <- xml2::xml_attr(xml2::xml_find_first(node, ".//a:bodyPr", ns), "anchor")
      return(list(
        left = as.numeric(xml2::xml_attr(off, "x")) / 914400,
        center_y = (as.numeric(xml2::xml_attr(off, "y")) +
                      as.numeric(xml2::xml_attr(ext, "cy")) / 2) / 914400,
        sz = sz,
        anchor = anchor
      ))
    }
    NULL
  }

  con_ficha <- medir(list(a = p_slide_portada("T"), b = ficha, c = seccion))
  sin_ficha <- medir(list(a = p_slide_portada("T"), c = seccion))

  expect_false(is.null(con_ficha))
  expect_false(is.null(sin_ficha))
  expect_equal(con_ficha$sz, sin_ficha$sz)
  expect_equal(con_ficha$left, sin_ficha$left)
  expect_equal(con_ficha$anchor, sin_ficha$anchor)

  # Y el cuerpo es el derivado de size_titulo_slide, no un default heredado.
  expect_equal(as.integer(con_ficha$sz), 2920L)

  # officer emite un `<a:bodyPr/>` vacio; sin el parche el texto se anclaria
  # arriba y el titulo se despegaria del acento del layout.
  expect_equal(con_ficha$anchor, "ctr")

  # La caja sigue centrada sobre el acento del layout (8.858 cm en 16:9).
  expect_equal(con_ficha$center_y, 8.858 / 2.54, tolerance = 1e-3)
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
  # Italica y no negrita (36d6cea4): es una acotacion sobre la pregunta, no un
  # segundo titulo compitiendo con el primero.
  expect_equal(compact$face_subtitulo, "italic")
  expect_lte(compact$size_subtitulo, 10.5)
  # El encabezado aloja DOS textos y necesita alto para los dos: con 0.34 salian
  # superpuestos. La franja sigue siendo compacta, con el alto que hace falta.
  expect_equal(compact$canvas_h_header_in, 0.52)
  # La separacion ya no se fuerza a cero: el piso lo impone el graficador, asi
  # que el override conserva lo que le entra.
  expect_equal(compact$encabezado_separacion_in, 0.72)
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
