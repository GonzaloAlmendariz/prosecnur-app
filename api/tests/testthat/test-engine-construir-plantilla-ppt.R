norm_xml <- function(x) {
  out <- as.character(x)
  out <- gsub('xmlns(:[A-Za-z0-9_]+)?="[^"]+"', "", out)
  out <- gsub("[[:space:]]+", "", out)
  out
}

`%||%` <- function(x, y) if (is.null(x) || !length(x) || all(is.na(x))) y else x

pkg_file <- function(...) {
  testthat::test_path("..", "..", ...)
}

ppt_ns <- function() {
  c(
    a = "http://schemas.openxmlformats.org/drawingml/2006/main",
    p = "http://schemas.openxmlformats.org/presentationml/2006/main"
  )
}

unzip_pptx <- function(path) {
  td <- tempfile("pptx_")
  dir.create(td)
  utils::unzip(path, exdir = td)
  td
}

layout_files_by_name <- function(root_dir) {
  ns <- ppt_ns()
  files <- list.files(
    file.path(root_dir, "ppt", "slideLayouts"),
    pattern = "^slideLayout[0-9]+\\.xml$",
    full.names = TRUE
  )

  setNames(
    files,
    vapply(files, function(path) {
      doc <- xml2::read_xml(path)
      xml2::xml_attr(xml2::xml_find_first(doc, ".//p:cSld", ns), "name") %||% basename(path)
    }, character(1))
  )
}

theme_node_xml <- function(pptx, tag) {
  td <- unzip_pptx(pptx)
  ns <- c(a = "http://schemas.openxmlformats.org/drawingml/2006/main")
  doc <- xml2::read_xml(file.path(td, "ppt", "theme", "theme1.xml"))
  node <- xml2::xml_find_first(doc, paste0(".//a:themeElements/a:", tag), ns)
  norm_xml(node)
}

master_node_xml <- function(pptx, xpath) {
  td <- unzip_pptx(pptx)
  ns <- c(
    a = "http://schemas.openxmlformats.org/drawingml/2006/main",
    p = "http://schemas.openxmlformats.org/presentationml/2006/main"
  )
  doc <- xml2::read_xml(file.path(td, "ppt", "slideMasters", "slideMaster1.xml"))
  node <- xml2::xml_find_first(doc, xpath, ns)
  norm_xml(node)
}

layout_names <- function(pptx) {
  names(layout_files_by_name(unzip_pptx(pptx)))
}

layout_placeholder_table <- function(pptx, layout_name) {
  ns <- ppt_ns()
  td <- unzip_pptx(pptx)
  path <- layout_files_by_name(td)[[layout_name]]
  if (is.null(path) || is.na(path)) {
    stop("No existe el layout: ", layout_name, call. = FALSE)
  }

  doc <- xml2::read_xml(path)
  nodes <- xml2::xml_find_all(doc, ".//p:cSld/p:spTree/*[.//p:ph]", ns)
  if (!length(nodes)) return(data.frame())

  counters <- new.env(parent = emptyenv())
  rows <- vector("list", length(nodes))

  for (i in seq_along(nodes)) {
    node <- nodes[[i]]
    ph <- xml2::xml_find_first(node, ".//p:ph", ns)
    typ <- xml2::xml_attr(ph, "type")
    if (is.na(typ) || !nzchar(typ)) typ <- "body"
    current_count <- if (exists(typ, envir = counters, inherits = FALSE)) {
      get(typ, envir = counters, inherits = FALSE)
    } else {
      0L
    }
    assign(typ, current_count + 1L, envir = counters)

    c_nvpr <- xml2::xml_find_first(node, ".//p:cNvPr", ns)
    off <- xml2::xml_find_first(node, ".//a:xfrm/a:off", ns)
    ext <- xml2::xml_find_first(node, ".//a:xfrm/a:ext", ns)

    rows[[i]] <- data.frame(
      name = xml2::xml_attr(c_nvpr, "name") %||% "",
      ph_type = typ,
      type_order = get(typ, envir = counters, inherits = FALSE),
      x = xml2::xml_attr(off, "x") %||% "",
      y = xml2::xml_attr(off, "y") %||% "",
      cx = xml2::xml_attr(ext, "cx") %||% "",
      cy = xml2::xml_attr(ext, "cy") %||% "",
      stringsAsFactors = FALSE
    )
  }

  do.call(rbind, rows)
}

layout_static_names <- function(pptx, layout_name) {
  ns <- ppt_ns()
  td <- unzip_pptx(pptx)
  path <- layout_files_by_name(td)[[layout_name]]
  doc <- xml2::read_xml(path)
  nodes <- xml2::xml_find_all(
    doc,
    ".//p:cSld/p:spTree/*[not(self::p:nvGrpSpPr or self::p:grpSpPr)][not(.//p:ph)]",
    ns
  )
  vapply(nodes, function(node) {
    c_nvpr <- xml2::xml_find_first(node, ".//p:cNvPr", ns)
    xml2::xml_attr(c_nvpr, "name") %||% ""
  }, character(1))
}

geom_by_label <- function(tbl, label) {
  row <- tbl[tbl$name == label, , drop = FALSE]
  stopifnot(nrow(row) == 1L)
  as.list(row[1, c("x", "y", "cx", "cy")])
}

geom_by_type <- function(tbl, ph_type, type_order = 1L) {
  row <- tbl[tbl$ph_type == ph_type & tbl$type_order == type_order, , drop = FALSE]
  stopifnot(nrow(row) == 1L)
  as.list(row[1, c("x", "y", "cx", "cy")])
}

geom_union <- function(...) {
  geoms <- list(...)
  xs <- vapply(geoms, function(g) as.numeric(g$x), numeric(1))
  ys <- vapply(geoms, function(g) as.numeric(g$y), numeric(1))
  x2 <- vapply(geoms, function(g) as.numeric(g$x) + as.numeric(g$cx), numeric(1))
  y2 <- vapply(geoms, function(g) as.numeric(g$y) + as.numeric(g$cy), numeric(1))
  list(
    x = as.character(as.integer(min(xs))),
    y = as.character(as.integer(min(ys))),
    cx = as.character(as.integer(max(x2) - min(xs))),
    cy = as.character(as.integer(max(y2) - min(ys)))
  )
}

split_cols <- function(geom, which_col, cols = 2L, gap = 160000L) {
  width <- (as.numeric(geom$cx) - gap * (cols - 1L)) / cols
  list(
    x = as.character(as.integer(as.numeric(geom$x) + (which_col - 1L) * (width + gap))),
    y = as.character(as.integer(as.numeric(geom$y))),
    cx = as.character(as.integer(width)),
    cy = as.character(as.integer(as.numeric(geom$cy)))
  )
}

repack_pptx <- function(root_dir, out_path) {
  files <- list.files(
    root_dir,
    recursive = TRUE,
    all.files = TRUE,
    include.dirs = FALSE,
    no.. = TRUE
  )
  ct_idx <- which(files == "[Content_Types].xml")
  if (length(ct_idx) == 1L) {
    files <- c(files[ct_idx], files[-ct_idx])
  }
  zip::zip(
    zipfile = out_path,
    files = files,
    root = root_dir,
    recurse = FALSE,
    include_directories = FALSE
  )
}

set_layout_name <- function(root_dir, from_name, to_name) {
  ns <- ppt_ns()
  path <- layout_files_by_name(root_dir)[[from_name]]
  doc <- xml2::read_xml(path)
  xml2::xml_set_attr(xml2::xml_find_first(doc, ".//p:cSld", ns), "name", to_name)
  xml2::write_xml(doc, path, options = c("as_xml", "format"))
}

set_layout_placeholder_geom <- function(root_dir, layout_name, ph_type, type_order, geom) {
  ns <- ppt_ns()
  path <- layout_files_by_name(root_dir)[[layout_name]]
  doc <- xml2::read_xml(path)
  nodes <- xml2::xml_find_all(doc, ".//p:cSld/p:spTree/*[.//p:ph]", ns)

  hits <- list()
  for (node in nodes) {
    ph <- xml2::xml_find_first(node, ".//p:ph", ns)
    typ <- xml2::xml_attr(ph, "type")
    if (is.na(typ) || !nzchar(typ)) typ <- "body"
    if (identical(typ, ph_type)) hits[[length(hits) + 1L]] <- node
  }

  target <- hits[[type_order]]
  xfrm <- xml2::xml_find_first(target, ".//a:xfrm", ns)
  off <- xml2::xml_find_first(xfrm, "./a:off", ns)
  ext <- xml2::xml_find_first(xfrm, "./a:ext", ns)
  xml2::xml_set_attr(off, "x", geom$x)
  xml2::xml_set_attr(off, "y", geom$y)
  xml2::xml_set_attr(ext, "cx", geom$cx)
  xml2::xml_set_attr(ext, "cy", geom$cy)
  xml2::write_xml(doc, path, options = c("as_xml", "format"))
}

set_layout_background <- function(root_dir, layout_name, fill) {
  ns <- ppt_ns()
  path <- layout_files_by_name(root_dir)[[layout_name]]
  doc <- xml2::read_xml(path)
  c_sld <- xml2::xml_find_first(doc, ".//p:cSld", ns)
  bg <- xml2::xml_find_first(doc, ".//p:cSld/p:bg", ns)
  bg_txt <- paste0(
    '<p:bg xmlns:p="', ns[["p"]], '" xmlns:a="', ns[["a"]], '">',
    '<p:bgPr><a:solidFill><a:srgbClr val="', fill, '"/></a:solidFill><a:effectLst/></p:bgPr>',
    "</p:bg>"
  )
  bg_new <- xml2::read_xml(bg_txt)
  if (inherits(bg, "xml_missing")) {
    xml2::xml_add_child(c_sld, bg_new)
  } else {
    xml2::xml_replace(bg, bg_new)
  }
  xml2::write_xml(doc, path, options = c("as_xml", "format"))
}

add_layout_static_shape <- function(root_dir, layout_name, shape_name, fill, geom) {
  ns <- ppt_ns()
  path <- layout_files_by_name(root_dir)[[layout_name]]
  doc <- xml2::read_xml(path)
  sp_tree <- xml2::xml_find_first(doc, ".//p:cSld/p:spTree", ns)
  shp_txt <- paste0(
    '<p:sp xmlns:p="', ns[["p"]], '" xmlns:a="', ns[["a"]], '">',
    '<p:nvSpPr><p:cNvPr id="9901" name="', shape_name, '"/>',
    '<p:cNvSpPr/><p:nvPr/></p:nvSpPr>',
    '<p:spPr><a:xfrm><a:off x="', geom$x, '" y="', geom$y, '"/>',
    '<a:ext cx="', geom$cx, '" cy="', geom$cy, '"/></a:xfrm>',
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>',
    '<a:solidFill><a:srgbClr val="', fill, '"/></a:solidFill>',
    '<a:ln><a:noFill/></a:ln></p:spPr></p:sp>'
  )
  xml2::xml_add_child(sp_tree, xml2::read_xml(shp_txt))
  xml2::write_xml(doc, path, options = c("as_xml", "format"))
}

make_synthetic_reference <- function(base_pptx, style_static = FALSE, giz_layouts = FALSE) {
  td <- unzip_pptx(base_pptx)
  ns <- ppt_ns()

  theme_path <- file.path(td, "ppt", "theme", "theme1.xml")
  theme_doc <- xml2::read_xml(theme_path)

  accent1 <- xml2::xml_find_first(theme_doc, ".//a:themeElements/a:clrScheme/a:accent1/a:srgbClr", ns)
  xml2::xml_set_attr(accent1, "val", "123456")
  xml2::xml_set_attr(xml2::xml_find_first(theme_doc, ".//a:themeElements/a:clrScheme", ns), "name", "TestColors")

  major_font <- xml2::xml_find_first(theme_doc, ".//a:themeElements/a:fontScheme/a:majorFont/a:latin", ns)
  minor_font <- xml2::xml_find_first(theme_doc, ".//a:themeElements/a:fontScheme/a:minorFont/a:latin", ns)
  xml2::xml_set_attr(major_font, "typeface", "Courier New")
  xml2::xml_set_attr(minor_font, "typeface", "Calibri")
  xml2::xml_set_attr(xml2::xml_find_first(theme_doc, ".//a:themeElements/a:fontScheme", ns), "name", "TestFonts")

  fmt <- xml2::xml_find_first(theme_doc, ".//a:themeElements/a:fmtScheme", ns)
  xml2::xml_set_attr(fmt, "name", "TestFmt")
  line_node <- xml2::xml_find_first(fmt, ".//a:lnStyleLst/a:ln[1]", ns)
  xml2::xml_set_attr(line_node, "w", "77777")
  xml2::write_xml(theme_doc, theme_path, options = c("as_xml", "format"))

  if (isTRUE(style_static)) {
    master_path <- file.path(td, "ppt", "slideMasters", "slideMaster1.xml")
    master_doc <- xml2::read_xml(master_path)

    bg <- xml2::xml_find_first(master_doc, ".//p:cSld/p:bg", ns)
    bg_txt <- paste0(
      '<p:bg xmlns:p="', ns[["p"]], '" xmlns:a="', ns[["a"]], '">',
      '<p:bgPr><a:solidFill><a:srgbClr val="ABCDEF"/></a:solidFill><a:effectLst/></p:bgPr>',
      "</p:bg>"
    )
    xml2::xml_replace(bg, xml2::read_xml(bg_txt))

    title_rpr <- xml2::xml_find_first(master_doc, ".//p:txStyles/p:titleStyle//a:defRPr[1]", ns)
    xml2::xml_set_attr(title_rpr, "sz", "4200")

    sp_tree <- xml2::xml_find_first(master_doc, ".//p:cSld/p:spTree", ns)
    brand_txt <- paste0(
      '<p:sp xmlns:p="', ns[["p"]], '" xmlns:a="', ns[["a"]], '">',
      '<p:nvSpPr><p:cNvPr id="9999" name="Synthetic Brand Block"/>',
      '<p:cNvSpPr/><p:nvPr/></p:nvSpPr>',
      '<p:spPr><a:xfrm><a:off x="11800000" y="150000"/><a:ext cx="400000" cy="400000"/></a:xfrm>',
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>',
      '<a:solidFill><a:srgbClr val="C80F0F"/></a:solidFill>',
      '<a:ln><a:noFill/></a:ln></p:spPr></p:sp>'
    )
    xml2::xml_add_child(sp_tree, xml2::read_xml(brand_txt))
    xml2::write_xml(master_doc, master_path, options = c("as_xml", "format"))
  }

  if (isTRUE(giz_layouts)) {
    set_layout_name(td, "Title Slide", "Title slide 5")
    set_layout_name(td, "Section Header", "Transition slide 1")
    set_layout_name(td, "Title and Content", "Text slide 1")
    set_layout_name(td, "1_ubicacion1", "Text slide two columns")
    set_layout_name(td, "right_2graficos_texto", "Project description")

    set_layout_placeholder_geom(td, "Title slide 5", "ctrTitle", 1L, list(
      x = "800000", y = "600000", cx = "6800000", cy = "900000"
    ))
    set_layout_placeholder_geom(td, "Title slide 5", "subTitle", 1L, list(
      x = "800000", y = "1800000", cx = "5600000", cy = "600000"
    ))
    set_layout_placeholder_geom(td, "Title slide 5", "dt", 1L, list(
      x = "800000", y = "6100000", cx = "2200000", cy = "300000"
    ))
    set_layout_placeholder_geom(td, "Title slide 5", "body", 1L, list(
      x = "800000", y = "6500000", cx = "5000000", cy = "300000"
    ))

    set_layout_placeholder_geom(td, "Transition slide 1", "title", 1L, list(
      x = "900000", y = "3000000", cx = "9000000", cy = "900000"
    ))
    add_layout_static_shape(
      td,
      "Transition slide 1",
      "Synthetic Section Stripe",
      "FFD54F",
      list(x = "0", y = "6200000", cx = "12192000", cy = "180000")
    )

    set_layout_background(td, "Text slide 1", "F3F6F8")
    set_layout_placeholder_geom(td, "Text slide 1", "title", 1L, list(
      x = "1000000", y = "700000", cx = "9000000", cy = "850000"
    ))
    set_layout_placeholder_geom(td, "Text slide 1", "body", 1L, list(
      x = "1000000", y = "2100000", cx = "9200000", cy = "3200000"
    ))
    add_layout_static_shape(
      td,
      "Text slide 1",
      "Synthetic Layout Stripe",
      "D32F2F",
      list(x = "1000000", y = "1700000", cx = "9200000", cy = "90000")
    )

    set_layout_background(td, "Text slide two columns", "FAFAFA")
    set_layout_placeholder_geom(td, "Text slide two columns", "title", 1L, list(
      x = "900000", y = "650000", cx = "9300000", cy = "800000"
    ))
    set_layout_placeholder_geom(td, "Text slide two columns", "body", 1L, list(
      x = "900000", y = "2100000", cx = "9400000", cy = "3100000"
    ))
    set_layout_placeholder_geom(td, "Text slide two columns", "body", 2L, list(
      x = "11800000", y = "6900000", cx = "1", cy = "1"
    ))
    add_layout_static_shape(
      td,
      "Text slide two columns",
      "Synthetic Two Col Stripe",
      "0097A7",
      list(x = "900000", y = "1700000", cx = "9400000", cy = "90000")
    )

    set_layout_background(td, "Project description", "FFF8E1")
    set_layout_placeholder_geom(td, "Project description", "title", 1L, list(
      x = "800000", y = "650000", cx = "9800000", cy = "850000"
    ))
    set_layout_placeholder_geom(td, "Project description", "body", 1L, list(
      x = "6700000", y = "2200000", cx = "4200000", cy = "2300000"
    ))
    set_layout_placeholder_geom(td, "Project description", "body", 2L, list(
      x = "800000", y = "6400000", cx = "3000000", cy = "250000"
    ))
    set_layout_placeholder_geom(td, "Project description", "body", 3L, list(
      x = "7000000", y = "6400000", cx = "3000000", cy = "250000"
    ))
    set_layout_placeholder_geom(td, "Project description", "pic", 1L, list(
      x = "1000000", y = "2200000", cx = "2300000", cy = "2200000"
    ))
    set_layout_placeholder_geom(td, "Project description", "pic", 2L, list(
      x = "3500000", y = "2200000", cx = "2300000", cy = "2200000"
    ))
    add_layout_static_shape(
      td,
      "Project description",
      "Synthetic Project Accent",
      "7B1FA2",
      list(x = "11100000", y = "500000", cx = "300000", cy = "5400000")
    )
  }

  out <- tempfile(fileext = ".pptx")
  repack_pptx(td, out)
  out
}

test_that("modo reskin conserva fmtScheme y actualiza clr/font", {
  base_pptx <- pkg_file("inst", "plantillas", "plantilla_16_9.pptx")
  ref_pptx <- make_synthetic_reference(base_pptx, style_static = FALSE)
  out_pptx <- tempfile(fileext = ".pptx")

  p_construir_plantilla(
    referencia = ref_pptx,
    destino = out_pptx,
    base = base_pptx,
    modo = "reskin",
    sobrescribir = TRUE,
    mensajes = FALSE
  )

  expect_identical(theme_node_xml(out_pptx, "clrScheme"), theme_node_xml(ref_pptx, "clrScheme"))
  expect_identical(theme_node_xml(out_pptx, "fontScheme"), theme_node_xml(ref_pptx, "fontScheme"))
  expect_identical(theme_node_xml(out_pptx, "fmtScheme"), theme_node_xml(base_pptx, "fmtScheme"))
})

test_that("modo estilo_estatico adapta layouts por familias y preserva nombres base", {
  base_pptx <- pkg_file("inst", "plantillas", "plantilla_16_9.pptx")
  ref_pptx <- make_synthetic_reference(base_pptx, style_static = TRUE, giz_layouts = TRUE)
  out_pptx <- tempfile(fileext = ".pptx")

  p_construir_plantilla(
    referencia = ref_pptx,
    destino = out_pptx,
    base = base_pptx,
    modo = "estilo_estatico",
    sobrescribir = TRUE,
    mensajes = FALSE
  )

  expect_identical(theme_node_xml(out_pptx, "clrScheme"), theme_node_xml(ref_pptx, "clrScheme"))
  expect_identical(theme_node_xml(out_pptx, "fontScheme"), theme_node_xml(ref_pptx, "fontScheme"))
  expect_identical(theme_node_xml(out_pptx, "fmtScheme"), theme_node_xml(ref_pptx, "fmtScheme"))
  expect_identical(master_node_xml(out_pptx, ".//p:cSld/p:bg"), master_node_xml(ref_pptx, ".//p:cSld/p:bg"))
  expect_identical(master_node_xml(out_pptx, ".//p:txStyles"), master_node_xml(ref_pptx, ".//p:txStyles"))
  expect_match(master_node_xml(out_pptx, ".//p:cSld/p:spTree"), "SyntheticBrandBlock")

  out_layouts <- layout_names(out_pptx)
  expect_true(all(c("Title Slide", "Graficos", "Graficos_2columnas", "1_Grafico_narrativo") %in% out_layouts))
  expect_false(any(c("Title slide 5", "Text slide 1", "Project description") %in% out_layouts))

  ref_text <- layout_placeholder_table(ref_pptx, "Text slide 1")
  out_graficos <- layout_placeholder_table(out_pptx, "Graficos")
  expect_equal(
    geom_by_label(out_graficos, "prosecnur:slide_1:title"),
    geom_by_type(ref_text, "title", 1L)
  )
  expect_equal(
    geom_by_label(out_graficos, "prosecnur:slide_1:plot"),
    geom_by_type(ref_text, "body", 1L)
  )
  expect_true("Synthetic Layout Stripe" %in% layout_static_names(out_pptx, "Graficos"))

  ref_two_cols <- layout_placeholder_table(ref_pptx, "Text slide two columns")
  out_two_cols <- layout_placeholder_table(out_pptx, "Graficos_2columnas")
  expected_body <- geom_by_type(ref_two_cols, "body", 1L)
  expect_equal(
    geom_by_label(out_two_cols, "prosecnur:slide_2:left"),
    split_cols(expected_body, 1L)
  )
  expect_equal(
    geom_by_label(out_two_cols, "prosecnur:slide_2:right"),
    split_cols(expected_body, 2L)
  )

  ref_project <- layout_placeholder_table(ref_pptx, "Project description")
  out_narr <- layout_placeholder_table(out_pptx, "1_Grafico_narrativo")
  expect_equal(
    geom_by_label(out_narr, "prosecnur:slide_1_narrativo:text"),
    geom_by_type(ref_project, "body", 1L)
  )
  expect_equal(
    geom_by_label(out_narr, "prosecnur:slide_1_narrativo:plot"),
    geom_union(
      geom_by_type(ref_project, "pic", 1L),
      geom_by_type(ref_project, "pic", 2L)
    )
  )
  expect_true("Synthetic Project Accent" %in% layout_static_names(out_pptx, "1_Grafico_narrativo"))

  ref_title <- layout_placeholder_table(ref_pptx, "Title slide 5")
  out_title <- layout_placeholder_table(out_pptx, "Title Slide")
  expect_equal(
    geom_by_label(out_title, "prosecnur:title_slide:title"),
    geom_by_type(ref_title, "ctrTitle", 1L)
  )
  expect_equal(
    geom_by_label(out_title, "prosecnur:title_slide:subtitle"),
    geom_by_type(ref_title, "subTitle", 1L)
  )
})

test_that("modo estilo_estatico renderiza slides con contrato semantico", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")
  skip_if_not_installed("ggplot2")

  base_pptx <- pkg_file("inst", "plantillas", "plantilla_16_9.pptx")
  ref_pptx <- make_synthetic_reference(base_pptx, style_static = TRUE, giz_layouts = TRUE)
  out_tpl <- tempfile(fileext = ".pptx")

  p_construir_plantilla(
    referencia = ref_pptx,
    destino = out_tpl,
    base = base_pptx,
    modo = "estilo_estatico",
    sobrescribir = TRUE,
    mensajes = FALSE
  )

  dat <- data.frame(x = 1)
  inst <- list(
    survey = data.frame(
      name = "x",
      type = "integer",
      list_name = NA_character_,
      stringsAsFactors = FALSE
    ),
    choices = NULL,
    orders_list = NULL
  )

  g1 <- p_ggplot_raw(
    ggplot2::ggplot(data.frame(x = c("A", "B"), y = c(1, 2)), ggplot2::aes(x, y)) +
      ggplot2::geom_col(fill = "#C80F0F") +
      ggplot2::theme_minimal()
  )
  g2 <- p_ggplot_raw(
    ggplot2::ggplot(data.frame(x = 1:3, y = c(2, 3, 1)), ggplot2::aes(x, y)) +
      ggplot2::geom_line(color = "#123456", linewidth = 1.1) +
      ggplot2::geom_point(color = "#123456") +
      ggplot2::theme_minimal()
  )
  icono <- p_ggplot_raw(
    ggplot2::ggplot(data.frame(x = 1, y = 1), ggplot2::aes(x, y)) +
      ggplot2::geom_point(size = 8, color = "#0097A7") +
      ggplot2::theme_void()
  )

  plan <- list(
    diapo_001 = p_slide_portada("Titulo de prueba", subtitulo = "Subtitulo"),
    diapo_002 = p_slide_seccion("Seccion metodologica"),
    diapo_003 = p_slide_1_grafico(g1, titulo = "Grafico simple"),
    diapo_004 = p_slide_2_graficos(g1, g2, titulo = "Dos graficos"),
    diapo_005 = p_slide_1_grafico_narrativo(g1, texto = "Bloque narrativo", titulo = "Narrativo"),
    diapo_006 = p_slide_grafico_texto_derecha(g1, texto = "Texto de apoyo", titulo = "Grafico y texto"),
    diapo_007 = p_slide_objetivo_icono(icono, texto = "Objetivo principal", titulo = "Objetivo")
  )
  out_report <- tempfile(fileext = ".pptx")

  expect_no_error(
    reporte_ppt_plan(
      data = dat,
      instrumento = inst,
      plan = plan,
      presets = p_presets(),
      path_ppt = out_report,
      template_pptx = out_tpl,
      mensajes_progreso = FALSE
    )
  )
  expect_true(file.exists(out_report))
})

test_that("modo estilo_estatico con PPT GIZ real genera plantilla renderizable", {
  skip_if_not(file.exists("/Users/gonzaloalmendariz/Documents/Pulso/GIZ/Presentación BGT Realidades.pptx"))
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")
  skip_if_not_installed("ggplot2")

  giz_ref <- "/Users/gonzaloalmendariz/Documents/Pulso/GIZ/Presentación BGT Realidades.pptx"
  base_pptx <- pkg_file("inst", "plantillas", "plantilla_16_9.pptx")
  out_tpl <- tempfile(fileext = ".pptx")

  expect_message(
    p_construir_plantilla(
      referencia = giz_ref,
      destino = out_tpl,
      base = base_pptx,
      modo = "estilo_estatico",
      sobrescribir = TRUE,
      mensajes = TRUE
    ),
    "multimedia|animados"
  )

  doc <- officer::read_pptx(out_tpl)
  size <- officer::slide_size(doc)
  expect_equal(size$width, 13.33333, tolerance = 1e-4)
  expect_equal(size$height, 7.5, tolerance = 1e-4)

  required_layouts <- c(
    "Title Slide",
    "Section Header",
    "Graficos",
    "Graficos_2columnas",
    "1_Grafico_narrativo",
    "right_grafico_texto",
    "Objetivos_Secciones"
  )
  expect_true(all(required_layouts %in% officer::layout_summary(doc)$layout))

  expect_identical(theme_node_xml(out_tpl, "fmtScheme"), theme_node_xml(giz_ref, "fmtScheme"))
  expect_identical(master_node_xml(out_tpl, ".//p:cSld/p:bg"), master_node_xml(giz_ref, ".//p:cSld/p:bg"))
  expect_identical(master_node_xml(out_tpl, ".//p:txStyles"), master_node_xml(giz_ref, ".//p:txStyles"))

  graficos_tbl <- layout_placeholder_table(out_tpl, "Graficos")
  expect_true("prosecnur:slide_1:plot" %in% graficos_tbl$name)

  dat <- data.frame(x = 1)
  inst <- list(
    survey = data.frame(
      name = "x",
      type = "integer",
      list_name = NA_character_,
      stringsAsFactors = FALSE
    ),
    choices = NULL,
    orders_list = NULL
  )

  g1 <- p_ggplot_raw(
    ggplot2::ggplot(data.frame(x = c("A", "B"), y = c(1, 2)), ggplot2::aes(x, y)) +
      ggplot2::geom_col(fill = "#C80F0F") +
      ggplot2::theme_minimal()
  )
  icono <- p_ggplot_raw(
    ggplot2::ggplot(data.frame(x = 1, y = 1), ggplot2::aes(x, y)) +
      ggplot2::geom_point(size = 8, color = "#0097A7") +
      ggplot2::theme_void()
  )

  plan <- list(
    diapo_001 = p_slide_portada("Titulo de prueba"),
    diapo_002 = p_slide_seccion("Seccion GIZ"),
    diapo_003 = p_slide_1_grafico(g1, titulo = "Grafico"),
    diapo_004 = p_slide_1_grafico_narrativo(g1, texto = "Texto narrativo", titulo = "Narrativo"),
    diapo_005 = p_slide_objetivo_icono(icono, texto = "Objetivo", titulo = "Objetivo")
  )
  out_report <- tempfile(fileext = ".pptx")

  expect_no_error(
    reporte_ppt_plan(
      data = dat,
      instrumento = inst,
      plan = plan,
      presets = p_presets(),
      path_ppt = out_report,
      template_pptx = out_tpl,
      mensajes_progreso = FALSE
    )
  )
  expect_true(file.exists(out_report))
})
