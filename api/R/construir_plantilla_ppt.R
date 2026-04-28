# ============================================================================
# p_construir_plantilla(): genera una plantilla .pptx compatible con
# `reporte_ppt_plan()` reutilizando los layouts de una plantilla base
# (por defecto `plantilla_16_9.pptx` interna) y tomando el estilo
# de un .pptx de referencia.
# ============================================================================

.ppt_template_ns <- function() {
  c(
    a = "http://schemas.openxmlformats.org/drawingml/2006/main",
    p = "http://schemas.openxmlformats.org/presentationml/2006/main",
    r = "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    rel = "http://schemas.openxmlformats.org/package/2006/relationships"
  )
}

.ppt_read_fragment <- function(xml_txt) {
  ns <- .ppt_template_ns()
  wrapper <- sprintf(
    '<root xmlns:a="%s" xmlns:p="%s" xmlns:r="%s" xmlns:rel="%s">%s</root>',
    ns[["a"]],
    ns[["p"]],
    ns[["r"]],
    ns[["rel"]],
    xml_txt
  )

  doc <- xml2::read_xml(wrapper)
  xml2::xml_find_first(doc, "./*")
}

.ppt_clone_node <- function(node) {
  .ppt_read_fragment(as.character(node))
}

.ppt_default <- function(x, y) {
  if (is.null(x) || !length(x) || (length(x) == 1L && is.na(x))) y else x
}

.ppt_rels_path <- function(xml_path) {
  file.path(dirname(xml_path), "_rels", paste0(basename(xml_path), ".rels"))
}

.ppt_read_rels <- function(path, must_exist = FALSE) {
  if (file.exists(path)) {
    return(xml2::read_xml(path))
  }

  if (isTRUE(must_exist)) {
    stop("No existe el archivo de relaciones requerido: ", path, call. = FALSE)
  }

  xml2::read_xml(
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'
  )
}

.ppt_replace_or_add_node <- function(doc_base, doc_ref, xpath, parent_xpath, ns, transform = NULL) {
  node_ref <- xml2::xml_find_first(doc_ref, xpath, ns)
  if (inherits(node_ref, "xml_missing")) {
    stop("No se encontro el nodo requerido en la referencia: ", xpath, call. = FALSE)
  }

  node_new <- .ppt_clone_node(node_ref)
  if (!is.null(transform)) {
    node_new <- transform(node_new)
    if (is.null(node_new)) return(invisible(doc_base))
  }

  node_base <- xml2::xml_find_first(doc_base, xpath, ns)
  if (inherits(node_base, "xml_missing")) {
    parent <- xml2::xml_find_first(doc_base, parent_xpath, ns)
    if (inherits(parent, "xml_missing")) {
      stop("No se encontro el nodo padre requerido en la base: ", parent_xpath, call. = FALSE)
    }
    xml2::xml_add_child(parent, node_new)
  } else {
    xml2::xml_replace(node_base, node_new)
  }

  invisible(doc_base)
}

.ppt_next_rel_id <- function(rel_doc, ns) {
  rels <- xml2::xml_find_all(rel_doc, ".//rel:Relationship", ns)
  ids <- xml2::xml_attr(rels, "Id")
  nums <- suppressWarnings(as.integer(sub("^rId", "", ids)))
  next_num <- max(c(0L, nums[!is.na(nums)]), na.rm = TRUE) + 1L
  paste0("rId", next_num)
}

.ppt_extract_rel_ids <- function(xml_txt) {
  hits <- regmatches(
    xml_txt,
    gregexpr('r:(?:embed|link|id)="[^"]+"', xml_txt, perl = TRUE)
  )[[1]]

  if (!length(hits)) {
    return(character(0))
  }

  unique(sub('^r:(?:embed|link|id)="([^"]+)"$', "\\1", hits, perl = TRUE))
}

.ppt_rel_is_multimedia <- function(type, target) {
  nz <- function(x, y = "") if (is.null(x) || is.na(x) || !nzchar(x)) y else x
  multimedia_ext <- c("mp4", "m4v", "mov", "wmv", "avi", "mp3", "wav")
  ext <- tolower(tools::file_ext(nz(target)))

  grepl("(video|audio|media)", nz(type), ignore.case = TRUE) ||
    ext %in% multimedia_ext
}

.ppt_unique_media_target <- function(work_base, basename_target) {
  media_dir <- file.path(work_base, "ppt", "media")
  if (!dir.exists(media_dir)) dir.create(media_dir, recursive = TRUE)

  ext <- tools::file_ext(basename_target)
  stem <- if (nzchar(ext)) {
    sub(paste0("\\.", ext, "$"), "", basename_target, ignore.case = TRUE)
  } else {
    basename_target
  }

  candidate <- if (nzchar(ext)) {
    paste0("copied_master_", stem, ".", ext)
  } else {
    paste0("copied_master_", stem)
  }

  i <- 1L
  while (file.exists(file.path(media_dir, candidate))) {
    candidate <- if (nzchar(ext)) {
      paste0("copied_master_", stem, "_", i, ".", ext)
    } else {
      paste0("copied_master_", stem, "_", i)
    }
    i <- i + 1L
  }

  list(
    abs = file.path(media_dir, candidate),
    rel = file.path("..", "media", candidate)
  )
}

.ppt_copy_rel_target <- function(
    old_id,
    ref_rels_doc,
    base_rels_doc,
    ref_source_dir,
    work_base,
    ns,
    cache,
    mensajes = TRUE
) {
  cache_key <- paste0("rel__", old_id)
  if (exists(cache_key, envir = cache, inherits = FALSE)) {
    return(get(cache_key, envir = cache, inherits = FALSE))
  }

  rel_xpath <- sprintf(".//rel:Relationship[@Id='%s']", old_id)
  rel_node <- xml2::xml_find_first(ref_rels_doc, rel_xpath, ns)
  if (inherits(rel_node, "xml_missing")) {
    stop(
      "No se pudo resolver la relacion `", old_id,
      "` en el master de la referencia.",
      call. = FALSE
    )
  }

  rel_type <- xml2::xml_attr(rel_node, "Type")
  rel_target <- xml2::xml_attr(rel_node, "Target")
  rel_target_mode <- xml2::xml_attr(rel_node, "TargetMode")

  if (!is.na(rel_target_mode) && nzchar(rel_target_mode)) {
    stop(
      "La referencia usa relaciones externas en el master (`", old_id,
      "`). Esto no esta soportado en `modo = \"estilo_estatico\"`.",
      call. = FALSE
    )
  }

  if (.ppt_rel_is_multimedia(rel_type, rel_target)) {
    if (isTRUE(mensajes)) {
      message(
        "Ignorando recurso multimedia del master de referencia: ",
        basename(rel_target)
      )
    }
    assign(cache_key, NA_character_, envir = cache)
    return(NA_character_)
  }

  src_abs <- normalizePath(file.path(ref_source_dir, rel_target), mustWork = FALSE)
  if (!file.exists(src_abs)) {
    stop(
      "No existe el recurso del master de referencia asociado a `", old_id,
      "`: ", rel_target,
      call. = FALSE
    )
  }

  dest <- .ppt_unique_media_target(work_base, basename(rel_target))
  ok_copy <- file.copy(src_abs, dest$abs, overwrite = FALSE, copy.mode = TRUE)
  if (!isTRUE(ok_copy)) {
    stop("No se pudo copiar el recurso del master: ", basename(rel_target), call. = FALSE)
  }

  new_id <- .ppt_next_rel_id(base_rels_doc, ns)
  rel_txt <- sprintf(
    '<Relationship xmlns="%s" Id="%s" Type="%s" Target="%s"/>',
    ns[["rel"]],
    new_id,
    rel_type,
    dest$rel
  )
  xml2::xml_add_child(xml2::xml_root(base_rels_doc), xml2::read_xml(rel_txt))

  assign(cache_key, new_id, envir = cache)
  new_id
}

.ppt_prepare_node_for_copy <- function(
    node,
    ref_rels_doc,
    base_rels_doc,
    ref_source_dir,
    work_base,
    ns,
    cache,
    mensajes = TRUE
) {
  txt <- as.character(node)
  rel_ids <- .ppt_extract_rel_ids(txt)
  if (!length(rel_ids)) {
    return(.ppt_read_fragment(txt))
  }

  replacements <- setNames(vector("list", length(rel_ids)), rel_ids)

  for (old_id in rel_ids) {
    new_id <- .ppt_copy_rel_target(
      old_id = old_id,
      ref_rels_doc = ref_rels_doc,
      base_rels_doc = base_rels_doc,
      ref_source_dir = ref_source_dir,
      work_base = work_base,
      ns = ns,
      cache = cache,
      mensajes = mensajes
    )

    if (is.na(new_id)) {
      return(NULL)
    }

    replacements[[old_id]] <- new_id
  }

  for (old_id in names(replacements)) {
    new_id <- replacements[[old_id]]
    txt <- gsub(
      paste0('r:embed="', old_id, '"'),
      paste0('r:embed="', new_id, '"'),
      txt,
      fixed = TRUE
    )
    txt <- gsub(
      paste0('r:link="', old_id, '"'),
      paste0('r:link="', new_id, '"'),
      txt,
      fixed = TRUE
    )
    txt <- gsub(
      paste0('r:id="', old_id, '"'),
      paste0('r:id="', new_id, '"'),
      txt,
      fixed = TRUE
    )
  }

  .ppt_read_fragment(txt)
}

.ppt_node_has_placeholder <- function(node, ns) {
  !inherits(xml2::xml_find_first(node, ".//p:ph", ns), "xml_missing")
}

.ppt_remove_static_sp_tree_nodes <- function(doc, ns) {
  sp_tree <- xml2::xml_find_first(doc, ".//p:cSld/p:spTree", ns)
  if (inherits(sp_tree, "xml_missing")) {
    stop("No se encontro `<p:spTree>` en el XML de PowerPoint.", call. = FALSE)
  }

  children <- xml2::xml_children(sp_tree)
  if (!length(children)) return(invisible(doc))

  names_local <- xml2::xml_name(children)
  removable <- children[
    !names_local %in% c("nvGrpSpPr", "grpSpPr") &
      !vapply(children, .ppt_node_has_placeholder, logical(1), ns = ns)
  ]

  if (length(removable)) {
    xml2::xml_remove(removable)
  }

  invisible(doc)
}

.ppt_copy_master_static_nodes <- function(
    base_master_doc,
    ref_master_doc,
    base_rels_doc,
    ref_rels_doc,
    ref_master_dir,
    work_base,
    ns,
    mensajes = TRUE
) {
  sp_tree_base <- xml2::xml_find_first(base_master_doc, ".//p:cSld/p:spTree", ns)
  sp_tree_ref <- xml2::xml_find_first(ref_master_doc, ".//p:cSld/p:spTree", ns)

  if (inherits(sp_tree_base, "xml_missing") || inherits(sp_tree_ref, "xml_missing")) {
    stop("No se pudo localizar `<p:spTree>` en alguno de los masters.", call. = FALSE)
  }

  cache <- new.env(parent = emptyenv())
  ref_children <- xml2::xml_children(sp_tree_ref)
  names_local <- xml2::xml_name(ref_children)

  static_nodes <- ref_children[
    !names_local %in% c("nvGrpSpPr", "grpSpPr") &
      !vapply(ref_children, .ppt_node_has_placeholder, logical(1), ns = ns)
  ]

  for (node in static_nodes) {
    prepared <- .ppt_prepare_node_for_copy(
      node = node,
      ref_rels_doc = ref_rels_doc,
      base_rels_doc = base_rels_doc,
      ref_source_dir = ref_master_dir,
      work_base = work_base,
      ns = ns,
      cache = cache,
      mensajes = mensajes
    )
    if (is.null(prepared)) next
    xml2::xml_add_child(sp_tree_base, prepared)
  }

  invisible(base_master_doc)
}

.ppt_find_layout_path_by_name <- function(workdir, layout_name) {
  layout_dir <- file.path(workdir, "ppt", "slideLayouts")
  files <- list.files(
    layout_dir,
    pattern = "^slideLayout[0-9]+\\.xml$",
    full.names = TRUE
  )
  if (!length(files)) return(NA_character_)

  ns <- .ppt_template_ns()
  matches <- vapply(files, function(path) {
    doc <- xml2::read_xml(path)
    nm <- xml2::xml_attr(xml2::xml_find_first(doc, ".//p:cSld", ns), "name")
    isTRUE(identical(nm, layout_name))
  }, logical(1))

  hit <- files[matches]
  if (!length(hit)) return(NA_character_)
  hit[[1]]
}

.ppt_copy_layout_background <- function(
    base_layout_path,
    ref_layout_path,
    work_base,
    ns,
    mensajes = TRUE
) {
  if (is.na(base_layout_path) || is.na(ref_layout_path)) {
    return(invisible(FALSE))
  }

  base_doc <- xml2::read_xml(base_layout_path)
  ref_doc  <- xml2::read_xml(ref_layout_path)

  ref_bg <- xml2::xml_find_first(ref_doc, ".//p:cSld/p:bg", ns)
  if (inherits(ref_bg, "xml_missing")) {
    return(invisible(FALSE))
  }

  base_rels_path <- .ppt_rels_path(base_layout_path)
  ref_rels_path  <- .ppt_rels_path(ref_layout_path)
  ref_rels_doc   <- .ppt_read_rels(ref_rels_path, must_exist = FALSE)
  base_rels_doc  <- .ppt_read_rels(base_rels_path, must_exist = FALSE)

  .ppt_replace_or_add_node(
    doc_base = base_doc,
    doc_ref = ref_doc,
    xpath = ".//p:cSld/p:bg",
    parent_xpath = ".//p:cSld",
    ns = ns,
    transform = function(node) {
      .ppt_prepare_node_for_copy(
        node = node,
        ref_rels_doc = ref_rels_doc,
        base_rels_doc = base_rels_doc,
        ref_source_dir = dirname(ref_layout_path),
        work_base = work_base,
        ns = ns,
        cache = new.env(parent = emptyenv()),
        mensajes = mensajes
      )
    }
  )

  xml2::write_xml(base_doc, base_layout_path, options = c("as_xml", "format"))
  xml2::write_xml(base_rels_doc, base_rels_path, options = c("as_xml", "format"))
  invisible(TRUE)
}

.ppt_copy_or_remove_node <- function(
    doc_base,
    doc_ref,
    xpath,
    parent_xpath,
    ns,
    transform = NULL
) {
  node_base <- xml2::xml_find_first(doc_base, xpath, ns)
  node_ref <- xml2::xml_find_first(doc_ref, xpath, ns)

  if (inherits(node_ref, "xml_missing")) {
    if (!inherits(node_base, "xml_missing")) {
      xml2::xml_remove(node_base)
    }
    return(invisible(doc_base))
  }

  node_new <- .ppt_clone_node(node_ref)
  if (!is.null(transform)) {
    node_new <- transform(node_new)
    if (is.null(node_new)) {
      if (!inherits(node_base, "xml_missing")) xml2::xml_remove(node_base)
      return(invisible(doc_base))
    }
  }

  if (inherits(node_base, "xml_missing")) {
    parent <- xml2::xml_find_first(doc_base, parent_xpath, ns)
    if (inherits(parent, "xml_missing")) {
      stop("No se encontro el nodo padre requerido en la base: ", parent_xpath, call. = FALSE)
    }
    xml2::xml_add_child(parent, node_new)
  } else {
    xml2::xml_replace(node_base, node_new)
  }

  invisible(doc_base)
}

.ppt_copy_layout_static_nodes <- function(
    base_layout_doc,
    ref_layout_doc,
    base_rels_doc,
    ref_rels_doc,
    ref_layout_dir,
    work_base,
    ns,
    mensajes = TRUE
) {
  sp_tree_base <- xml2::xml_find_first(base_layout_doc, ".//p:cSld/p:spTree", ns)
  sp_tree_ref <- xml2::xml_find_first(ref_layout_doc, ".//p:cSld/p:spTree", ns)

  if (inherits(sp_tree_base, "xml_missing") || inherits(sp_tree_ref, "xml_missing")) {
    stop("No se pudo localizar `<p:spTree>` en alguno de los layouts.", call. = FALSE)
  }

  cache <- new.env(parent = emptyenv())
  ref_children <- xml2::xml_children(sp_tree_ref)
  names_local <- xml2::xml_name(ref_children)

  static_nodes <- ref_children[
    !names_local %in% c("nvGrpSpPr", "grpSpPr") &
      !vapply(ref_children, .ppt_node_has_placeholder, logical(1), ns = ns)
  ]

  for (node in static_nodes) {
    prepared <- .ppt_prepare_node_for_copy(
      node = node,
      ref_rels_doc = ref_rels_doc,
      base_rels_doc = base_rels_doc,
      ref_source_dir = ref_layout_dir,
      work_base = work_base,
      ns = ns,
      cache = cache,
      mensajes = mensajes
    )
    if (is.null(prepared)) next
    xml2::xml_add_child(sp_tree_base, prepared)
  }

  invisible(base_layout_doc)
}

.ppt_placeholder_type_norm <- function(node, ns) {
  ph <- xml2::xml_find_first(node, ".//p:ph", ns)
  if (inherits(ph, "xml_missing")) return(NA_character_)
  type <- xml2::xml_attr(ph, "type")
  if (is.na(type) || !nzchar(type)) return("body")
  type
}

.ppt_placeholder_nodes <- function(doc, ns) {
  sp_tree <- xml2::xml_find_first(doc, ".//p:cSld/p:spTree", ns)
  if (inherits(sp_tree, "xml_missing")) return(list())
  children <- xml2::xml_children(sp_tree)
  keep <- vapply(children, .ppt_node_has_placeholder, logical(1), ns = ns)
  as.list(children[keep])
}

.ppt_find_placeholder_node <- function(doc, spec, ns) {
  nodes <- .ppt_placeholder_nodes(doc, ns)
  if (!length(nodes)) return(xml2::xml_missing())

  types <- vapply(nodes, .ppt_placeholder_type_norm, character(1), ns = ns)
  want_types <- as.character(spec$type)
  hits <- which(types %in% want_types)
  if (!length(hits)) return(xml2::xml_missing())

  type_idx <- spec$type_idx
  if (is.null(type_idx) || is.na(type_idx)) {
    return(nodes[[hits[[1]]]])
  }

  type_idx <- suppressWarnings(as.integer(type_idx)[1])
  if (!is.finite(type_idx) || is.na(type_idx) || type_idx < 1L || type_idx > length(hits)) {
    return(xml2::xml_missing())
  }

  nodes[[hits[[type_idx]]]]
}

.ppt_node_geom <- function(node, ns) {
  xfrm <- xml2::xml_find_first(node, ".//a:xfrm", ns)
  if (inherits(xfrm, "xml_missing")) return(NULL)

  off <- xml2::xml_find_first(xfrm, "./a:off", ns)
  ext <- xml2::xml_find_first(xfrm, "./a:ext", ns)
  if (inherits(off, "xml_missing") || inherits(ext, "xml_missing")) return(NULL)

  list(
    x = as.character(xml2::xml_attr(off, "x")),
    y = as.character(xml2::xml_attr(off, "y")),
    cx = as.character(xml2::xml_attr(ext, "cx")),
    cy = as.character(xml2::xml_attr(ext, "cy"))
  )
}

.ppt_set_node_geom <- function(node, geom, ns) {
  xfrm <- xml2::xml_find_first(node, ".//a:xfrm", ns)
  if (inherits(xfrm, "xml_missing")) {
    stop("No se encontro `<a:xfrm>` en el placeholder a adaptar.", call. = FALSE)
  }

  off <- xml2::xml_find_first(xfrm, "./a:off", ns)
  ext <- xml2::xml_find_first(xfrm, "./a:ext", ns)
  if (inherits(off, "xml_missing") || inherits(ext, "xml_missing")) {
    stop("No se encontraron `<a:off>`/`<a:ext>` en el placeholder a adaptar.", call. = FALSE)
  }

  xml2::xml_set_attr(off, "x", as.character(geom$x))
  xml2::xml_set_attr(off, "y", as.character(geom$y))
  xml2::xml_set_attr(ext, "cx", as.character(geom$cx))
  xml2::xml_set_attr(ext, "cy", as.character(geom$cy))
  invisible(node)
}

.ppt_set_placeholder_label <- function(node, label, ns) {
  if (is.null(label) || !nzchar(label)) return(invisible(node))
  c_nvpr <- xml2::xml_find_first(node, ".//p:cNvPr", ns)
  if (!inherits(c_nvpr, "xml_missing")) {
    xml2::xml_set_attr(c_nvpr, "name", label)
  }
  invisible(node)
}

.ppt_copy_placeholder_style <- function(base_node, ref_node, ns) {
  if (xml2::xml_name(base_node) != "sp" || xml2::xml_name(ref_node) != "sp") {
    return(invisible(base_node))
  }

  for (xpath in c("./p:spPr", "./p:txBody")) {
    ref_child <- xml2::xml_find_first(ref_node, xpath, ns)
    if (inherits(ref_child, "xml_missing")) next
    base_child <- xml2::xml_find_first(base_node, xpath, ns)
    child_new <- .ppt_clone_node(ref_child)
    if (inherits(base_child, "xml_missing")) {
      xml2::xml_add_child(base_node, child_new)
    } else {
      xml2::xml_replace(base_child, child_new)
    }
  }

  invisible(base_node)
}

.ppt_hidden_geom <- function(slide_size) {
  list(
    x = as.character(as.integer(slide_size$cx + 200000L)),
    y = as.character(as.integer(slide_size$cy + 200000L)),
    cx = "1",
    cy = "1"
  )
}

.ppt_layout_size <- function(workdir) {
  ns <- .ppt_template_ns()
  presentation_path <- file.path(workdir, "ppt", "presentation.xml")
  doc <- xml2::read_xml(presentation_path)
  sld_sz <- xml2::xml_find_first(doc, ".//p:sldSz", ns)
  list(
    cx = suppressWarnings(as.integer(xml2::xml_attr(sld_sz, "cx"))),
    cy = suppressWarnings(as.integer(xml2::xml_attr(sld_sz, "cy")))
  )
}

.ppt_contract_entry_for_layout <- function(layout_name) {
  contract <- get(".PPT_CONTRACT", envir = asNamespace("prosecnur"))
  make_entry <- function(contract_key, overrides = list()) {
    if (!contract_key %in% names(contract)) return(NULL)
    out <- contract[[contract_key]]
    out$layout <- layout_name
    out$.contract_key <- contract_key

    for (slot_name in names(overrides)) {
      out$slots[[slot_name]] <- utils::modifyList(
        .ppt_default(out$slots[[slot_name]], list()),
        overrides[[slot_name]]
      )
    }

    out
  }

  switch(
    layout_name,
    "Section Header" = make_entry("section"),
    "Title Slide" = make_entry("title_slide", list(
      title = list(type = "ctrTitle", type_idx = 1L),
      subtitle = list(type = "subTitle", type_idx = 1L),
      date = list(type = "dt", type_idx = 1L),
      subtexto = list(type = "body", type_idx = 1L)
    )),
    "Indice" = make_entry("indice"),
    "Objetivos_Secciones" = make_entry("objetivo_icono", list(
      title = list(type = "title", type_idx = 1L),
      icon = list(type = "body", type_idx = 1L),
      text = list(type = "body", type_idx = 2L)
    )),
    "Graficos" = make_entry("slide_1", list(
      title = list(type = "title", type_idx = 1L),
      plot = list(type = "pic", type_idx = 1L),
      base = list(type = "body", type_idx = 1L),
      right = list(type = "body", type_idx = 2L)
    )),
    "Graficos2" = make_entry("slide_1", list(
      title = list(type = "title", type_idx = 1L),
      plot = list(type = "pic", type_idx = 1L),
      base = list(type = "body", type_idx = 1L),
      right = list(type = "body", type_idx = 2L)
    )),
    "Graficos_unabarra" = make_entry("slide_1", list(
      title = list(type = "title", type_idx = 1L),
      plot = list(type = "pic", type_idx = 1L),
      base = list(type = "body", type_idx = 1L),
      right = list(type = "body", type_idx = 2L)
    )),
    "Graficos_2columnas" = make_entry("slide_2", list(
      title = list(type = "title", type_idx = 1L),
      left = list(type = "pic", type_idx = 2L),
      right = list(type = "pic", type_idx = 1L),
      base = list(type = "body", type_idx = 1L),
      right_text = list(type = "body", type_idx = 2L)
    )),
    "4_paneles" = make_entry("paneles_4", list(
      title = list(type = "title", type_idx = 1L),
      up_left = list(type = "pic", type_idx = 1L),
      up_right = list(type = "pic", type_idx = 3L),
      bottom_left = list(type = "pic", type_idx = 2L),
      bottom_right = list(type = "pic", type_idx = 4L),
      base = list(type = "body", type_idx = 1L),
      footer = list(type = "body", type_idx = 2L)
    )),
    "1_Grafico_narrativo" = make_entry("slide_1_narrativo", list(
      title = list(type = "title", type_idx = 1L),
      text = list(type = "body", type_idx = 3L),
      plot = list(type = "pic", type_idx = 1L),
      base = list(type = "body", type_idx = 1L),
      footer = list(type = "body", type_idx = 2L)
    )),
    "1_Graficos_2columnas_narrativo" = make_entry("slide_2_narrativo", list(
      title = list(type = "title", type_idx = 1L),
      text = list(type = "body", type_idx = 3L),
      left = list(type = "pic", type_idx = 1L),
      right = list(type = "pic", type_idx = 2L),
      base = list(type = "body", type_idx = 1L),
      footer = list(type = "body", type_idx = 2L)
    )),
    "right_grafico_texto" = make_entry("text_r", list(
      title = list(type = "title", type_idx = 1L),
      plot = list(type = "pic", type_idx = 1L),
      text = list(type = "body", type_idx = 3L),
      base = list(type = "body", type_idx = 1L),
      footer = list(type = "body", type_idx = 2L)
    )),
    "left_grafico_texto" = make_entry("text_l", list(
      title = list(type = "title", type_idx = 1L),
      plot = list(type = "pic", type_idx = 1L),
      text = list(type = "body", type_idx = 3L),
      base = list(type = "body", type_idx = 1L),
      footer = list(type = "body", type_idx = 2L)
    )),
    "right_2graficos_texto" = make_entry("text_r2", list(
      title = list(type = "title", type_idx = 1L),
      plot1 = list(type = "pic", type_idx = 1L),
      plot2 = list(type = "pic", type_idx = 2L),
      text = list(type = "body", type_idx = 3L),
      base = list(type = "body", type_idx = 1L),
      footer = list(type = "body", type_idx = 2L)
    )),
    "left_2graficos_texto" = make_entry("text_l2", list(
      title = list(type = "title", type_idx = 1L),
      plot1 = list(type = "pic", type_idx = 1L),
      plot2 = list(type = "pic", type_idx = 2L),
      text = list(type = "body", type_idx = 3L),
      base = list(type = "body", type_idx = 1L),
      footer = list(type = "body", type_idx = 2L)
    )),
    "poblacion_2" = make_entry("poblacion_2", list(
      title = list(type = "title", type_idx = 1L),
      left = list(type = "body", type_idx = 1L),
      right = list(type = "body", type_idx = 2L),
      icon = list(type = "body", type_idx = 3L)
    )),
    "poblacion_4" = make_entry("poblacion_4", list(
      title = list(type = "title", type_idx = 1L),
      up_left = list(type = "pic", type_idx = 1L),
      up_right = list(type = "pic", type_idx = 3L),
      bottom_left = list(type = "pic", type_idx = 2L),
      bottom_right = list(type = "pic", type_idx = 4L),
      base = list(type = "body", type_idx = 1L),
      icon = list(type = "body", type_idx = 2L)
    )),
    "poblacion_5" = make_entry("poblacion_5", list(
      title = list(type = "title", type_idx = 1L),
      pic1 = list(type = "pic", type_idx = 1L),
      pic2 = list(type = "pic", type_idx = 2L),
      pic3 = list(type = "pic", type_idx = 3L),
      pic4 = list(type = "pic", type_idx = 4L),
      pic5 = list(type = "pic", type_idx = 5L),
      footer = list(type = "body", type_idx = 1L),
      icon = list(type = "body", type_idx = 2L)
    )),
    "poblacion_6" = make_entry("poblacion_6", list(
      title = list(type = "title", type_idx = 1L),
      pic1 = list(type = "pic", type_idx = 1L),
      pic2 = list(type = "pic", type_idx = 2L),
      pic3 = list(type = "pic", type_idx = 3L),
      pic4 = list(type = "pic", type_idx = 4L),
      pic5 = list(type = "pic", type_idx = 5L),
      pic6 = list(type = "pic", type_idx = 6L),
      footer = list(type = "body", type_idx = 1L),
      icon = list(type = "body", type_idx = 2L)
    )),
    NULL
  )
}

.ppt_geom_union <- function(geoms) {
  geoms <- Filter(Negate(is.null), geoms)
  if (!length(geoms)) return(NULL)
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

.ppt_mirror_geom <- function(geom, slide_size) {
  if (is.null(geom)) return(NULL)
  x <- as.numeric(geom$x)
  cx <- as.numeric(geom$cx)
  list(
    x = as.character(as.integer(slide_size$cx - x - cx)),
    y = as.character(as.integer(as.numeric(geom$y))),
    cx = as.character(as.integer(cx)),
    cy = as.character(as.integer(as.numeric(geom$cy)))
  )
}

.ppt_split_geom_cols <- function(geom, which_col, cols = 2L, gap = 160000L) {
  if (is.null(geom)) return(NULL)
  x <- as.numeric(geom$x)
  y <- as.numeric(geom$y)
  cx <- as.numeric(geom$cx)
  cy <- as.numeric(geom$cy)
  cols <- as.integer(cols)
  which_col <- as.integer(which_col)
  width <- (cx - gap * (cols - 1L)) / cols
  list(
    x = as.character(as.integer(x + (which_col - 1L) * (width + gap))),
    y = as.character(as.integer(y)),
    cx = as.character(as.integer(width)),
    cy = as.character(as.integer(cy))
  )
}

.ppt_split_geom_grid <- function(geom, index, cols, rows, gap_x = 160000L, gap_y = 160000L) {
  if (is.null(geom)) return(NULL)
  x <- as.numeric(geom$x)
  y <- as.numeric(geom$y)
  cx <- as.numeric(geom$cx)
  cy <- as.numeric(geom$cy)
  idx <- as.integer(index) - 1L
  col_i <- idx %% as.integer(cols)
  row_i <- idx %/% as.integer(cols)
  width <- (cx - gap_x * (cols - 1L)) / cols
  height <- (cy - gap_y * (rows - 1L)) / rows
  list(
    x = as.character(as.integer(x + col_i * (width + gap_x))),
    y = as.character(as.integer(y + row_i * (height + gap_y))),
    cx = as.character(as.integer(width)),
    cy = as.character(as.integer(height))
  )
}

.ppt_top_band_geom <- function(geom, ratio = 0.18, gap = 120000L) {
  if (is.null(geom)) return(NULL)
  x <- as.numeric(geom$x)
  y <- as.numeric(geom$y)
  cx <- as.numeric(geom$cx)
  cy <- as.numeric(geom$cy)
  height <- cy * ratio
  list(
    x = as.character(as.integer(x)),
    y = as.character(as.integer(y)),
    cx = as.character(as.integer(cx)),
    cy = as.character(as.integer(height))
  )
}

.ppt_bottom_body_geom <- function(geom, ratio_top = 0.22, gap = 120000L) {
  if (is.null(geom)) return(NULL)
  x <- as.numeric(geom$x)
  y <- as.numeric(geom$y)
  cx <- as.numeric(geom$cx)
  cy <- as.numeric(geom$cy)
  top_h <- cy * ratio_top
  list(
    x = as.character(as.integer(x)),
    y = as.character(as.integer(y + top_h + gap)),
    cx = as.character(as.integer(cx)),
    cy = as.character(as.integer(max(1, cy - top_h - gap)))
  )
}

.ppt_ref_placeholder_geom <- function(ref_doc, type, type_idx, ns) {
  ref_node <- .ppt_find_placeholder_node(
    ref_doc,
    list(type = type, type_idx = type_idx),
    ns
  )
  if (inherits(ref_node, "xml_missing")) return(NULL)
  .ppt_node_geom(ref_node, ns)
}

.ppt_rule_geom <- function(ref_doc, spec, ns, slide_size) {
  if (is.null(spec)) return(NULL)
  mode <- spec$mode
  if (identical(mode, "hidden")) return(.ppt_hidden_geom(slide_size))

  if (identical(mode, "ref")) {
    return(.ppt_ref_placeholder_geom(ref_doc, spec$type, spec$type_idx, ns))
  }

  if (identical(mode, "ref_union")) {
    geoms <- lapply(spec$refs, function(ref_spec) {
      .ppt_rule_geom(ref_doc, utils::modifyList(ref_spec, list(mode = "ref")), ns, slide_size)
    })
    return(.ppt_geom_union(geoms))
  }

  if (identical(mode, "split_body_cols")) {
    body <- .ppt_ref_placeholder_geom(ref_doc, "body", .ppt_default(spec$body_idx, 1L), ns)
    return(.ppt_split_geom_cols(
      body,
      which_col = spec$which,
      cols = .ppt_default(spec$cols, 2L),
      gap = .ppt_default(spec$gap, 160000L)
    ))
  }

  if (identical(mode, "split_body_grid")) {
    body <- .ppt_ref_placeholder_geom(ref_doc, "body", .ppt_default(spec$body_idx, 1L), ns)
    return(.ppt_split_geom_grid(
      body,
      index = spec$index,
      cols = spec$cols,
      rows = spec$rows,
      gap_x = .ppt_default(spec$gap_x, 160000L),
      gap_y = .ppt_default(spec$gap_y, 160000L)
    ))
  }

  if (identical(mode, "body_top_band")) {
    body <- .ppt_ref_placeholder_geom(ref_doc, "body", .ppt_default(spec$body_idx, 1L), ns)
    return(.ppt_top_band_geom(
      body,
      ratio = .ppt_default(spec$ratio, 0.18),
      gap = .ppt_default(spec$gap, 120000L)
    ))
  }

  if (identical(mode, "body_bottom_cols")) {
    body <- .ppt_ref_placeholder_geom(ref_doc, "body", .ppt_default(spec$body_idx, 1L), ns)
    body_bottom <- .ppt_bottom_body_geom(
      body,
      ratio_top = .ppt_default(spec$ratio_top, 0.22),
      gap = .ppt_default(spec$gap, 120000L)
    )
    return(.ppt_split_geom_cols(
      body_bottom,
      which_col = spec$which,
      cols = .ppt_default(spec$cols, 2L),
      gap = .ppt_default(spec$gap_x, 160000L)
    ))
  }

  if (identical(mode, "mirror")) {
    geom <- .ppt_rule_geom(ref_doc, spec$source, ns, slide_size)
    return(.ppt_mirror_geom(geom, slide_size))
  }

  NULL
}

.ppt_ref_layout_candidates <- function(layout_name) {
  switch(
    layout_name,
    "Title Slide" = c("Title slide 5", "1_Title slide 5", "Title Slide"),
    "Section Header" = c("Transition slide 1", "1_Transition slide 1", "Section Header"),
    "Graficos" = c("Text slide 1", "1_Text slide 1", "Standard text slide", "1_Standard text slide", "Graficos"),
    "Graficos2" = c("Text slide 1", "1_Text slide 1", "Standard text slide", "1_Standard text slide", "Graficos2"),
    "Graficos_unabarra" = c("Text slide 1", "1_Text slide 1", "Standard text slide", "1_Standard text slide", "Graficos_unabarra"),
    "Graficos_2columnas" = c("Text slide two columns", "1_Text slide two columns", "Graficos_2columnas"),
    "4_paneles" = c("Text slide 1", "1_Text slide 1", "Standard text slide", "1_Standard text slide", "4_paneles"),
    "1_Grafico_narrativo" = c("Project description", "1_Project description", "1_Grafico_narrativo"),
    "1_Graficos_2columnas_narrativo" = c("Text slide two columns", "1_Text slide two columns", "Project description", "1_Project description", "1_Graficos_2columnas_narrativo"),
    "right_grafico_texto" = c("Project description", "1_Project description", "right_grafico_texto"),
    "left_grafico_texto" = c("Project description", "1_Project description", "left_grafico_texto"),
    "right_2graficos_texto" = c("Project description", "1_Project description", "right_2graficos_texto"),
    "left_2graficos_texto" = c("Project description", "1_Project description", "left_2graficos_texto"),
    "Objetivos_Secciones" = c("Project description", "1_Project description", "Objetivos_Secciones"),
    "General Objective" = c("Project description", "1_Project description", "General Objective"),
    "Comparison" = c("Project description", "1_Project description", "Comparison"),
    "poblacion_2" = c("Text slide 1", "1_Text slide 1", "Standard text slide", "1_Standard text slide", "poblacion_2"),
    "poblacion_4" = c("Text slide 1", "1_Text slide 1", "Standard text slide", "1_Standard text slide", "poblacion_4"),
    "poblacion_5" = c("Text slide 1", "1_Text slide 1", "Standard text slide", "1_Standard text slide", "poblacion_5"),
    "poblacion_6" = c("Text slide 1", "1_Text slide 1", "Standard text slide", "1_Standard text slide", "poblacion_6"),
    "Title and Content" = c("Text slide 1", "1_Text slide 1", "Standard text slide", "1_Standard text slide", "Title and Content"),
    "1_ubicacion1" = c("Text slide 1", "1_Text slide 1", "Standard text slide", "1_Standard text slide", "1_ubicacion1"),
    "Indice" = c("Text slide 1", "1_Text slide 1", "Standard text slide", "1_Standard text slide", "Indice"),
    c(layout_name)
  )
}

.ppt_layout_slot_rules <- function(layout_name) {
  switch(
    layout_name,
    "Title Slide" = list(
      title = list(mode = "ref", type = "ctrTitle", type_idx = 1L),
      subtitle = list(mode = "ref", type = "subTitle", type_idx = 1L),
      date = list(mode = "ref", type = "body", type_idx = 2L),
      subtexto = list(mode = "ref", type = "body", type_idx = 1L)
    ),
    "Section Header" = list(
      title = list(mode = "ref", type = "ctrTitle", type_idx = 1L)
    ),
    "Graficos" = list(
      title = list(mode = "ref", type = "title", type_idx = 1L),
      plot = list(mode = "ref", type = "body", type_idx = 1L),
      base = list(mode = "hidden"),
      right = list(mode = "hidden")
    ),
    "Graficos2" = list(
      title = list(mode = "ref", type = "title", type_idx = 1L),
      plot = list(mode = "ref", type = "body", type_idx = 1L),
      base = list(mode = "hidden"),
      right = list(mode = "hidden")
    ),
    "Graficos_unabarra" = list(
      title = list(mode = "ref", type = "title", type_idx = 1L),
      plot = list(mode = "ref", type = "body", type_idx = 1L),
      base = list(mode = "hidden"),
      right = list(mode = "hidden")
    ),
    "Graficos_2columnas" = list(
      title = list(mode = "ref", type = "title", type_idx = 1L),
      left = list(mode = "split_body_cols", which = 1L, cols = 2L),
      right = list(mode = "split_body_cols", which = 2L, cols = 2L),
      base = list(mode = "hidden"),
      right_text = list(mode = "hidden")
    ),
    "1_Grafico_narrativo" = list(
      title = list(mode = "ref", type = "title", type_idx = 1L),
      text = list(mode = "ref", type = "body", type_idx = 1L),
      plot = list(
        mode = "ref_union",
        refs = list(
          list(type = "pic", type_idx = 1L),
          list(type = "pic", type_idx = 2L)
        )
      ),
      base = list(mode = "hidden"),
      footer = list(mode = "hidden")
    ),
    "1_Graficos_2columnas_narrativo" = list(
      title = list(mode = "ref", type = "title", type_idx = 1L),
      text = list(mode = "body_top_band", ratio = 0.20),
      left = list(mode = "body_bottom_cols", which = 1L, cols = 2L, ratio_top = 0.24),
      right = list(mode = "body_bottom_cols", which = 2L, cols = 2L, ratio_top = 0.24),
      base = list(mode = "hidden"),
      footer = list(mode = "hidden")
    ),
    "right_grafico_texto" = list(
      title = list(mode = "ref", type = "title", type_idx = 1L),
      text = list(mode = "ref", type = "body", type_idx = 1L),
      plot = list(mode = "ref", type = "pic", type_idx = 1L),
      base = list(mode = "hidden"),
      footer = list(mode = "hidden")
    ),
    "left_grafico_texto" = list(
      title = list(mode = "ref", type = "title", type_idx = 1L),
      text = list(mode = "mirror", source = list(mode = "ref", type = "body", type_idx = 1L)),
      plot = list(mode = "mirror", source = list(mode = "ref", type = "pic", type_idx = 1L)),
      base = list(mode = "hidden"),
      footer = list(mode = "hidden")
    ),
    "right_2graficos_texto" = list(
      title = list(mode = "ref", type = "title", type_idx = 1L),
      text = list(mode = "ref", type = "body", type_idx = 1L),
      plot1 = list(mode = "ref", type = "pic", type_idx = 1L),
      plot2 = list(mode = "ref", type = "pic", type_idx = 2L),
      base = list(mode = "hidden"),
      footer = list(mode = "hidden")
    ),
    "left_2graficos_texto" = list(
      title = list(mode = "ref", type = "title", type_idx = 1L),
      text = list(mode = "mirror", source = list(mode = "ref", type = "body", type_idx = 1L)),
      plot1 = list(mode = "mirror", source = list(mode = "ref", type = "pic", type_idx = 1L)),
      plot2 = list(mode = "mirror", source = list(mode = "ref", type = "pic", type_idx = 2L)),
      base = list(mode = "hidden"),
      footer = list(mode = "hidden")
    ),
    "Objetivos_Secciones" = list(
      title = list(mode = "ref", type = "title", type_idx = 1L),
      text = list(mode = "ref", type = "body", type_idx = 1L),
      icon = list(mode = "ref", type = "pic", type_idx = 1L)
    ),
    "poblacion_2" = list(
      title = list(mode = "ref", type = "title", type_idx = 1L),
      left = list(mode = "split_body_cols", which = 1L, cols = 2L),
      right = list(mode = "split_body_cols", which = 2L, cols = 2L),
      icon = list(mode = "hidden")
    ),
    "poblacion_4" = list(
      title = list(mode = "ref", type = "title", type_idx = 1L),
      up_left = list(mode = "split_body_grid", index = 1L, cols = 2L, rows = 2L),
      up_right = list(mode = "split_body_grid", index = 2L, cols = 2L, rows = 2L),
      bottom_left = list(mode = "split_body_grid", index = 3L, cols = 2L, rows = 2L),
      bottom_right = list(mode = "split_body_grid", index = 4L, cols = 2L, rows = 2L),
      base = list(mode = "hidden"),
      icon = list(mode = "hidden")
    ),
    "poblacion_5" = list(
      title = list(mode = "ref", type = "title", type_idx = 1L),
      pic1 = list(mode = "split_body_grid", index = 1L, cols = 3L, rows = 2L),
      pic2 = list(mode = "split_body_grid", index = 2L, cols = 3L, rows = 2L),
      pic3 = list(mode = "split_body_grid", index = 3L, cols = 3L, rows = 2L),
      pic4 = list(mode = "split_body_grid", index = 4L, cols = 3L, rows = 2L),
      pic5 = list(mode = "split_body_grid", index = 5L, cols = 3L, rows = 2L),
      footer = list(mode = "hidden"),
      icon = list(mode = "hidden")
    ),
    "poblacion_6" = list(
      title = list(mode = "ref", type = "title", type_idx = 1L),
      pic1 = list(mode = "split_body_grid", index = 1L, cols = 3L, rows = 2L),
      pic2 = list(mode = "split_body_grid", index = 2L, cols = 3L, rows = 2L),
      pic3 = list(mode = "split_body_grid", index = 3L, cols = 3L, rows = 2L),
      pic4 = list(mode = "split_body_grid", index = 4L, cols = 3L, rows = 2L),
      pic5 = list(mode = "split_body_grid", index = 5L, cols = 3L, rows = 2L),
      pic6 = list(mode = "split_body_grid", index = 6L, cols = 3L, rows = 2L),
      footer = list(mode = "hidden"),
      icon = list(mode = "hidden")
    ),
    "Title and Content" = list(
      title = list(mode = "ref", type = "title", type_idx = 1L),
      body = list(mode = "ref", type = "body", type_idx = 1L)
    ),
    "1_ubicacion1" = list(
      title = list(mode = "ref", type = "title", type_idx = 1L),
      body = list(mode = "ref", type = "body", type_idx = 1L)
    ),
    "Indice" = list(),
    "4_paneles" = list(
      title = list(mode = "ref", type = "title", type_idx = 1L),
      up_left = list(mode = "split_body_grid", index = 1L, cols = 2L, rows = 2L),
      up_right = list(mode = "split_body_grid", index = 2L, cols = 2L, rows = 2L),
      bottom_left = list(mode = "split_body_grid", index = 3L, cols = 2L, rows = 2L),
      bottom_right = list(mode = "split_body_grid", index = 4L, cols = 2L, rows = 2L),
      base = list(mode = "hidden"),
      footer = list(mode = "hidden")
    ),
    list()
  )
}

.ppt_apply_layout_adaptation <- function(
    base_layout_path,
    ref_layout_path,
    layout_name,
    work_base,
    slide_size,
    ns,
    mensajes = TRUE
) {
  contract_entry <- .ppt_contract_entry_for_layout(layout_name)

  base_doc <- xml2::read_xml(base_layout_path)
  ref_doc <- xml2::read_xml(ref_layout_path)

  base_rels_path <- .ppt_rels_path(base_layout_path)
  ref_rels_path <- .ppt_rels_path(ref_layout_path)
  base_rels_doc <- .ppt_read_rels(base_rels_path, must_exist = FALSE)
  ref_rels_doc <- .ppt_read_rels(ref_rels_path, must_exist = FALSE)

  .ppt_copy_or_remove_node(
    doc_base = base_doc,
    doc_ref = ref_doc,
    xpath = ".//p:cSld/p:bg",
    parent_xpath = ".//p:cSld",
    ns = ns,
    transform = function(node) {
      .ppt_prepare_node_for_copy(
        node = node,
        ref_rels_doc = ref_rels_doc,
        base_rels_doc = base_rels_doc,
        ref_source_dir = dirname(ref_layout_path),
        work_base = work_base,
        ns = ns,
        cache = new.env(parent = emptyenv()),
        mensajes = mensajes
      )
    }
  )

  .ppt_copy_or_remove_node(
    doc_base = base_doc,
    doc_ref = ref_doc,
    xpath = ".//p:clrMapOvr",
    parent_xpath = ".//p:sldLayout",
    ns = ns
  )

  .ppt_copy_or_remove_node(
    doc_base = base_doc,
    doc_ref = ref_doc,
    xpath = ".//p:hf",
    parent_xpath = ".//p:sldLayout",
    ns = ns
  )

  .ppt_remove_static_sp_tree_nodes(base_doc, ns)
  .ppt_copy_layout_static_nodes(
    base_layout_doc = base_doc,
    ref_layout_doc = ref_doc,
    base_rels_doc = base_rels_doc,
    ref_rels_doc = ref_rels_doc,
    ref_layout_dir = dirname(ref_layout_path),
    work_base = work_base,
    ns = ns,
    mensajes = mensajes
  )

  slot_rules <- .ppt_layout_slot_rules(layout_name)
  if (!is.null(contract_entry) && length(contract_entry$slots)) {
    for (slot_name in names(contract_entry$slots)) {
      spec <- contract_entry$slots[[slot_name]]
      base_node <- .ppt_find_placeholder_node(base_doc, spec, ns)
      if (inherits(base_node, "xml_missing")) next

      rule <- .ppt_default(slot_rules[[slot_name]], list(mode = "hidden"))
      geom <- .ppt_rule_geom(ref_doc, rule, ns, slide_size)
      if (is.null(geom)) geom <- .ppt_hidden_geom(slide_size)

      .ppt_set_node_geom(base_node, geom, ns)
      .ppt_set_placeholder_label(base_node, spec$ph_label, ns)

      if (!is.null(rule) && identical(rule$mode, "ref")) {
        ref_node <- .ppt_find_placeholder_node(
          ref_doc,
          list(type = rule$type, type_idx = rule$type_idx),
          ns
        )
        if (!inherits(ref_node, "xml_missing")) {
          .ppt_copy_placeholder_style(base_node, ref_node, ns)
        }
      }
    }
  }

  xml2::write_xml(base_doc, base_layout_path, options = c("as_xml", "format"))
  xml2::write_xml(base_rels_doc, base_rels_path, options = c("as_xml", "format"))
  invisible(TRUE)
}

.ppt_validate_ratio_16_9 <- function(workdir, etiqueta) {
  ns <- .ppt_template_ns()
  presentation_path <- file.path(workdir, "ppt", "presentation.xml")
  if (!file.exists(presentation_path)) {
    stop("No existe `ppt/presentation.xml` en ", etiqueta, ".", call. = FALSE)
  }

  doc <- xml2::read_xml(presentation_path)
  sld_sz <- xml2::xml_find_first(doc, ".//p:sldSz", ns)
  if (inherits(sld_sz, "xml_missing")) {
    stop("No se encontro `<p:sldSz>` en ", etiqueta, ".", call. = FALSE)
  }

  cx <- suppressWarnings(as.numeric(xml2::xml_attr(sld_sz, "cx")))
  cy <- suppressWarnings(as.numeric(xml2::xml_attr(sld_sz, "cy")))
  ratio <- cx / cy

  if (!is.finite(ratio) || abs(ratio - (16 / 9)) > 0.01) {
    stop(
      etiqueta, " no es 16:9. Se esperaba una presentacion widescreen.",
      call. = FALSE
    )
  }

  invisible(list(cx = cx, cy = cy, ratio = ratio))
}

.ppt_detect_reference_exclusions <- function(work_ref, mensajes = TRUE) {
  if (!isTRUE(mensajes)) return(invisible(NULL))

  media_dir <- file.path(work_ref, "ppt", "media")
  if (dir.exists(media_dir)) {
    media_files <- list.files(media_dir, full.names = FALSE)
    multimedia <- media_files[tolower(tools::file_ext(media_files)) %in%
      c("mp4", "m4v", "mov", "wmv", "avi", "mp3", "wav")]
    if (length(multimedia)) {
      message(
        "Se detectaron recursos multimedia en la referencia y se ignoraran en ",
        "`modo = \"estilo_estatico\"`: ",
        paste(multimedia, collapse = ", ")
      )
    }
  }

  ns <- .ppt_template_ns()
  layouts_dir <- file.path(work_ref, "ppt", "slideLayouts")
  if (!dir.exists(layouts_dir)) return(invisible(NULL))

  layout_files <- list.files(
    layouts_dir,
    pattern = "^slideLayout[0-9]+\\.xml$",
    full.names = TRUE
  )
  if (!length(layout_files)) return(invisible(NULL))

  layout_names <- vapply(layout_files, function(path) {
    doc <- xml2::read_xml(path)
    node <- xml2::xml_find_first(doc, ".//p:cSld", ns)
    out <- xml2::xml_attr(node, "name")
    if (is.null(out) || !length(out)) NA_character_ else out
  }, character(1))

  animated <- unique(stats::na.omit(layout_names[grepl("anim", layout_names, ignore.case = TRUE)]))
  if (length(animated)) {
    message(
      "Se detectaron layouts animados en la referencia y no se copiaran: ",
      paste(animated, collapse = ", ")
    )
  }

  invisible(NULL)
}

#' Construir una plantilla PPT compatible con `reporte_ppt_plan()` a partir
#' de un .pptx de referencia
#'
#' Toma una plantilla **base** (por defecto la plantilla interna
#' `plantilla_16_9.pptx` del paquete, que contiene todos los layouts
#' requeridos por [reporte_ppt_plan()]) y la adapta a partir de un `.pptx`
#' de **referencia**.
#'
#' En `modo = "reskin"` (default), la funcion reemplaza la paleta de
#' colores (`<a:clrScheme>`) y/o la tipografia (`<a:fontScheme>`) del
#' theme principal.
#'
#' En `modo = "estilo_estatico"`, la funcion actua como un adaptador fiel:
#' conserva los nombres de layouts requeridos por el paquete, pero adapta
#' cada familia de layout a partir del `.pptx` de referencia, copiando
#' `fmtScheme`, fondo y estilos maestros, branding estatico y la
#' composicion visual de layouts equivalentes (titulo, cuerpo, imagenes,
#' footer y shapes estaticos). Los placeholders extra que necesita el
#' paquete se mantienen como soporte tecnico sin alterar la linea grafica.
#'
#' No modifica la plantilla interna del paquete: opera sobre una copia
#' temporal y la escribe en `destino`.
#'
#' @section Uso posterior:
#' La plantilla generada se consume pasandosela a [reporte_ppt_plan()]
#' via el argumento `template_pptx`, o fijandola globalmente con
#' `options(prosecnur.template_pptx = "ruta/plantilla_generada.pptx")`.
#'
#' @param referencia Ruta a un `.pptx` cuyo estilo se quiere copiar.
#' @param destino Ruta de salida del `.pptx` generado.
#' @param base Ruta a la plantilla base cuyos layouts se conservan.
#'   Si es `NULL` (default) se usa la plantilla interna
#'   `inst/plantillas/plantilla_16_9.pptx` del paquete.
#' @param modo Modo de construccion. `"reskin"` (default) solo copia
#'   colores y tipografias del theme. `"estilo_estatico"` conserva
#'   los layouts del paquete, pero los adapta por familias para heredar
#'   del `.pptx` de referencia su geometria visual, fondos, tipografia,
#'   branding estatico y composicion de placeholders.
#' @param copiar_colores Logico. Si `TRUE` (default) reemplaza
#'   `<a:clrScheme>` de `ppt/theme/theme1.xml` de la base con el de la
#'   referencia.
#' @param copiar_tipografias Logico. Si `TRUE` (default) reemplaza
#'   `<a:fontScheme>` de `ppt/theme/theme1.xml` de la base con el de la
#'   referencia.
#' @param sobrescribir Logico. Si `FALSE` (default) y `destino` ya
#'   existe, la funcion falla. Usar `TRUE` para reemplazar el archivo
#'   existente.
#' @param mensajes Logico. Si `TRUE` (default) imprime mensajes de
#'   progreso y exclusiones (por ejemplo, multimedia ignorado).
#'
#' @return (Invisible) la ruta absoluta del `.pptx` generado.
#'
#' @examples
#' \dontrun{
#' # Modo simple: copiar solo colores y tipografias
#' p_construir_plantilla(
#'   referencia = "inst/plantillas/referencia_BGT.pptx",
#'   destino    = "inst/plantillas/plantilla_BGT_simple.pptx"
#' )
#'
#' # Modo completo: adaptar fielmente la linea grafica del PPT de referencia
#' p_construir_plantilla(
#'   referencia = "inst/plantillas/referencia_BGT.pptx",
#'   destino    = "inst/plantillas/plantilla_BGT_estatica.pptx",
#'   modo       = "estilo_estatico"
#' )
#' }
#'
#' @export
p_construir_plantilla <- function(
    referencia,
    destino,
    base               = NULL,
    modo               = c("reskin", "estilo_estatico"),
    copiar_colores     = TRUE,
    copiar_tipografias = TRUE,
    sobrescribir       = FALSE,
    mensajes           = TRUE
) {
  `%||%` <- function(x, y) if (!is.null(x)) x else y

  if (missing(referencia) || !is.character(referencia) || length(referencia) != 1) {
    stop("`referencia` debe ser una ruta (character) a un .pptx.", call. = FALSE)
  }
  if (!file.exists(referencia)) {
    stop("No existe `referencia`: ", referencia, call. = FALSE)
  }
  if (!grepl("\\.pptx$", referencia, ignore.case = TRUE)) {
    stop("`referencia` debe terminar en .pptx", call. = FALSE)
  }

  if (missing(destino) || !is.character(destino) || length(destino) != 1) {
    stop("`destino` debe ser una ruta (character) de salida .pptx.", call. = FALSE)
  }
  if (!grepl("\\.pptx$", destino, ignore.case = TRUE)) {
    stop("`destino` debe terminar en .pptx", call. = FALSE)
  }
  if (file.exists(destino) && !isTRUE(sobrescribir)) {
    stop(
      "`destino` ya existe. Use `sobrescribir = TRUE` para reemplazar: ",
      destino,
      call. = FALSE
    )
  }

  if (is.null(base)) {
    # Buscar primero en el paquete actual `prosecnurapp`, luego en el
    # legacy `prosecnur`, y finalmente en el repo dev via PULSO_REPO_ROOT.
    base <- system.file("plantillas/plantilla_16_9.pptx", package = "prosecnurapp")
    if (!nzchar(base) || !file.exists(base)) {
      base <- system.file("plantillas/plantilla_16_9.pptx", package = "prosecnur")
    }
    if (!nzchar(base) || !file.exists(base)) {
      repo_root <- Sys.getenv("PULSO_REPO_ROOT", "")
      if (nzchar(repo_root)) {
        candidate <- file.path(repo_root, "api", "inst", "plantillas", "plantilla_16_9.pptx")
        if (file.exists(candidate)) base <- candidate
      }
    }
    if (!nzchar(base) || !file.exists(base)) {
      stop(
        "No se encontro la plantilla interna `inst/plantillas/plantilla_16_9.pptx`. ",
        "Pase una ruta explicita en `base=`.",
        call. = FALSE
      )
    }
  } else {
    if (!is.character(base) || length(base) != 1) {
      stop("`base` debe ser NULL o una ruta (character) a un .pptx.", call. = FALSE)
    }
    if (!file.exists(base)) {
      stop("No existe `base`: ", base, call. = FALSE)
    }
  }

  modo <- match.arg(modo)
  if (identical(modo, "reskin") &&
      !isTRUE(copiar_colores) &&
      !isTRUE(copiar_tipografias)) {
    stop(
      "Debe copiar al menos colores o tipografias cuando `modo = \"reskin\"`.",
      call. = FALSE
    )
  }

  if (!requireNamespace("xml2", quietly = TRUE)) {
    stop(
      "Se requiere el paquete `xml2`. Instalar con install.packages(\"xml2\").",
      call. = FALSE
    )
  }
  if (!requireNamespace("zip", quietly = TRUE)) {
    stop(
      "Se requiere el paquete `zip`. Instalar con install.packages(\"zip\").",
      call. = FALSE
    )
  }

  msg <- function(...) if (isTRUE(mensajes)) message(...)
  ns <- .ppt_template_ns()

  work_base <- tempfile("prosecnur_base_")
  work_ref  <- tempfile("prosecnur_ref_")
  dir.create(work_base, recursive = TRUE)
  dir.create(work_ref, recursive = TRUE)
  on.exit({
    unlink(work_base, recursive = TRUE, force = TRUE)
    unlink(work_ref, recursive = TRUE, force = TRUE)
  }, add = TRUE)

  msg("Descomprimiendo plantilla base...")
  utils::unzip(base, exdir = work_base)
  msg("Descomprimiendo PPT de referencia...")
  utils::unzip(referencia, exdir = work_ref)

  if (identical(modo, "estilo_estatico")) {
    .ppt_validate_ratio_16_9(work_ref, "La referencia")
    .ppt_detect_reference_exclusions(work_ref, mensajes = mensajes)
  }

  theme_base <- file.path(work_base, "ppt", "theme", "theme1.xml")
  theme_ref  <- file.path(work_ref,  "ppt", "theme", "theme1.xml")
  if (!file.exists(theme_base)) {
    stop("La plantilla base no contiene `ppt/theme/theme1.xml`.", call. = FALSE)
  }
  if (!file.exists(theme_ref)) {
    stop("El PPT de referencia no contiene `ppt/theme/theme1.xml`.", call. = FALSE)
  }

  doc_theme_base <- xml2::read_xml(theme_base)
  doc_theme_ref  <- xml2::read_xml(theme_ref)

  reemplazar_theme_node <- function(tag) {
    xpath <- paste0(".//a:themeElements/a:", tag)
    node_ref <- xml2::xml_find_first(doc_theme_ref, xpath, ns)
    if (inherits(node_ref, "xml_missing")) {
      stop("La referencia no tiene <a:", tag, "> en `theme1.xml`.", call. = FALSE)
    }

    node_base <- xml2::xml_find_first(doc_theme_base, xpath, ns)
    node_new <- .ppt_clone_node(node_ref)
    if (inherits(node_base, "xml_missing")) {
      theme_elements <- xml2::xml_find_first(doc_theme_base, ".//a:themeElements", ns)
      if (inherits(theme_elements, "xml_missing")) {
        stop("La base no tiene `<a:themeElements>` en `theme1.xml`.", call. = FALSE)
      }
      xml2::xml_add_child(theme_elements, node_new)
    } else {
      xml2::xml_replace(node_base, node_new)
    }
  }

  if (isTRUE(copiar_colores)) {
    msg("Copiando paleta de colores (<a:clrScheme>)...")
    reemplazar_theme_node("clrScheme")
  }
  if (isTRUE(copiar_tipografias)) {
    msg("Copiando tipografias (<a:fontScheme>)...")
    reemplazar_theme_node("fontScheme")
  }
  if (identical(modo, "estilo_estatico")) {
    msg("Copiando formato del theme (<a:fmtScheme>)...")
    reemplazar_theme_node("fmtScheme")
  }

  if (identical(modo, "estilo_estatico")) {
    base_masters <- list.files(
      file.path(work_base, "ppt", "slideMasters"),
      pattern = "^slideMaster[0-9]+\\.xml$",
      full.names = TRUE
    )
    ref_masters <- list.files(
      file.path(work_ref, "ppt", "slideMasters"),
      pattern = "^slideMaster[0-9]+\\.xml$",
      full.names = TRUE
    )

    if (!length(base_masters)) {
      stop("La plantilla base no contiene slide masters.", call. = FALSE)
    }
    if (!length(ref_masters)) {
      stop("La referencia no contiene slide masters.", call. = FALSE)
    }
    if (length(ref_masters) > 1L) {
      msg("La referencia contiene varios masters; se usara solo el primero: ", basename(ref_masters[[1]]))
    }

    master_base_path <- base_masters[[1]]
    master_ref_path  <- ref_masters[[1]]

    master_base_rels_path <- .ppt_rels_path(master_base_path)
    master_ref_rels_path  <- .ppt_rels_path(master_ref_path)
    if (!file.exists(master_ref_rels_path)) {
      stop(
        "La referencia no contiene el archivo de relaciones del master: ",
        master_ref_rels_path,
        call. = FALSE
      )
    }

    doc_master_base <- xml2::read_xml(master_base_path)
    doc_master_ref  <- xml2::read_xml(master_ref_path)
    doc_master_base_rels <- .ppt_read_rels(master_base_rels_path, must_exist = FALSE)
    doc_master_ref_rels  <- .ppt_read_rels(master_ref_rels_path, must_exist = TRUE)

    .ppt_replace_or_add_node(
      doc_base = doc_master_base,
      doc_ref = doc_master_ref,
      xpath = ".//p:cSld/p:bg",
      parent_xpath = ".//p:cSld",
      ns = ns,
      transform = function(node) {
        .ppt_prepare_node_for_copy(
          node = node,
          ref_rels_doc = doc_master_ref_rels,
          base_rels_doc = doc_master_base_rels,
          ref_source_dir = dirname(master_ref_path),
          work_base = work_base,
          ns = ns,
          cache = new.env(parent = emptyenv()),
          mensajes = mensajes
        )
      }
    )

    .ppt_replace_or_add_node(
      doc_base = doc_master_base,
      doc_ref = doc_master_ref,
      xpath = ".//p:txStyles",
      parent_xpath = ".//p:sldMaster",
      ns = ns
    )

    msg("Actualizando master base con fondo, estilos y branding estatico...")
    .ppt_remove_static_sp_tree_nodes(doc_master_base, ns)

    .ppt_copy_master_static_nodes(
      base_master_doc = doc_master_base,
      ref_master_doc = doc_master_ref,
      base_rels_doc = doc_master_base_rels,
      ref_rels_doc = doc_master_ref_rels,
      ref_master_dir = dirname(master_ref_path),
      work_base = work_base,
      ns = ns,
      mensajes = mensajes
    )

    slide_size <- .ppt_layout_size(work_base)
    base_layout_files <- list.files(
      file.path(work_base, "ppt", "slideLayouts"),
      pattern = "^slideLayout[0-9]+\\.xml$",
      full.names = TRUE
    )

    for (base_layout_path in base_layout_files) {
      base_layout_doc <- xml2::read_xml(base_layout_path)
      layout_name <- xml2::xml_attr(
        xml2::xml_find_first(base_layout_doc, ".//p:cSld", ns),
        "name"
      )
      if (is.na(layout_name) || !nzchar(layout_name)) next

      ref_layout_path <- NA_character_
      for (candidate in .ppt_ref_layout_candidates(layout_name)) {
        hit <- .ppt_find_layout_path_by_name(work_ref, candidate)
        if (!is.na(hit)) {
          ref_layout_path <- hit
          if (!identical(candidate, layout_name)) {
            msg("Adaptando layout `", layout_name, "` desde `", candidate, "`...")
          } else {
            msg("Actualizando layout `", layout_name, "` con su homologo de referencia...")
          }
          break
        }
      }

      if (is.na(ref_layout_path)) {
        msg("Sin layout de referencia compatible para `", layout_name, "`; se conserva la geometria base.")
        next
      }

      .ppt_apply_layout_adaptation(
        base_layout_path = base_layout_path,
        ref_layout_path = ref_layout_path,
        layout_name = layout_name,
        work_base = work_base,
        slide_size = slide_size,
        ns = ns,
        mensajes = mensajes
      )
    }

    xml2::write_xml(doc_master_base, master_base_path, options = c("as_xml", "format"))
    xml2::write_xml(doc_master_base_rels, master_base_rels_path, options = c("as_xml", "format"))
  }

  xml2::write_xml(doc_theme_base, theme_base, options = c("as_xml", "format"))

  destino_abs <- normalizePath(destino, mustWork = FALSE)
  dir_destino <- dirname(destino_abs)
  if (!dir.exists(dir_destino)) dir.create(dir_destino, recursive = TRUE)
  if (file.exists(destino_abs)) file.remove(destino_abs)

  archivos <- list.files(
    work_base,
    recursive = TRUE,
    all.files = TRUE,
    include.dirs = FALSE,
    no.. = TRUE
  )
  ct_idx <- which(archivos == "[Content_Types].xml")
  if (length(ct_idx) == 1L) {
    archivos <- c(archivos[ct_idx], archivos[-ct_idx])
  }

  msg("Empaquetando ", destino_abs, " ...")
  zip::zip(
    zipfile = destino_abs,
    files = archivos,
    root = work_base,
    recurse = FALSE,
    include_directories = FALSE
  )

  msg("Plantilla generada: ", destino_abs)
  invisible(destino_abs)
}
