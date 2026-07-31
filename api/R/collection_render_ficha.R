# Compilador grid unico para materiales de Recopiladores (ADR 0046).
#
# PDF final y PNG autoritativo llaman al mismo `collection_material_draw_page`.
# Solo cambia el device; no se rasteriza el PDF ni se usa ImageMagick.

.crf_layout <- function() {
  list(
    qr_side = 0.34,
    qr_x = 0.72,
    qr_y = 0.62,
    x_left = 0.075,
    x_right = 0.925,
    y_title = 0.80,
    y_rows_top = 0.69,
    row_step = 0.053,
    y_link = 0.365,
    label_w = 0.13
  )
}

.crf_txt <- function(value, fallback = "Por confirmar") {
  v <- if (is.null(value) || !length(value)) "" else trimws(as.character(value)[1])
  if (!nzchar(v) || is.na(v)) fallback else v
}

.crf_wrap <- function(value, width = 48L, max_lines = NULL) {
  text <- .crf_txt(value, "")
  if (!nzchar(text)) return(character(0))
  paragraphs <- strsplit(gsub("\r", "", text, fixed = TRUE), "\n", fixed = TRUE)[[1]]
  lines <- unlist(lapply(paragraphs, function(paragraph) {
    wrapped <- base::strwrap(paragraph, width = width, simplify = TRUE)
    if (!length(wrapped)) wrapped <- ""
    # strwrap no corta URLs/palabras sin espacios. Dividirlas evita que grid
    # dibuje fuera de la safe area sin tocar el payload que alimenta el QR.
    unlist(lapply(wrapped, function(line) {
      if (nchar(line, type = "width") <= width) return(line)
      starts <- seq.int(1L, nchar(line), by = width)
      substring(line, starts, pmin(starts + width - 1L, nchar(line)))
    }), use.names = FALSE)
  }), use.names = FALSE)
  if (!is.null(max_lines) && length(lines) > max_lines) {
    lines <- lines[seq_len(max_lines)]
    last <- lines[[max_lines]]
    lines[[max_lines]] <- paste0(substr(last, 1L, max(1L, width - 3L)), "...")
  }
  lines
}

#' Matriz logica de un QR generado en el backend R.
#'
#' @param link payload a codificar.
#' @param correction nivel L, M, Q o H.
#' @param quiet_zone modulos blancos alrededor del simbolo (minimo 4).
#' @return matriz logica, incluida la quiet zone de `qrcode`.
#' @export
collection_qr_matrix <- function(link, correction = "M", quiet_zone = 4L) {
  link <- .crf_txt(link, "")
  if (!nzchar(link)) {
    stop("No hay enlace que codificar: un QR sin enlace no identifica nada.", call. = FALSE)
  }
  correction <- match.arg(as.character(correction)[[1]], c("L", "M", "Q", "H"))
  quiet_zone <- as.integer(quiet_zone[[1]])
  if (is.na(quiet_zone) || quiet_zone < 4L || quiet_zone > 12L) {
    stop("quiet_zone debe estar entre 4 y 12 modulos.", call. = FALSE)
  }
  raw <- qrcode::qr_code(link, ecl = correction)
  raw <- matrix(as.logical(raw), nrow = nrow(raw), ncol = ncol(raw))
  # qrcode 0.3.0 agrega exactamente tres modulos blancos por lado. El ADR
  # exige al menos cuatro, asi que reemplazamos esa quiet zone sin inferir el
  # borde desde modulos oscuros (una fila valida del simbolo puede ser blanca).
  core <- raw[4L:(nrow(raw) - 3L), 4L:(ncol(raw) - 3L), drop = FALSE]
  out <- matrix(FALSE, nrow = nrow(core) + 2L * quiet_zone, ncol = ncol(core) + 2L * quiet_zone)
  rows <- quiet_zone + seq_len(nrow(core))
  cols <- quiet_zone + seq_len(ncol(core))
  out[rows, cols] <- core
  out
}

.crf_qr_viewport <- function(x, y, side_npc, geo = pulso_pdf_geo("portrait")) {
  side <- grid::unit(side_npc * geo$page_w, "inches")
  grid::viewport(x = x, y = y, width = side, height = side, default.units = "npc")
}

.crf_draw_qr_modules <- function(m) {
  n <- nrow(m)
  cell <- 1 / n
  idx <- which(m, arr.ind = TRUE)
  if (!nrow(idx)) return(invisible(NULL))
  grid::grid.rect(
    x = (idx[, "col"] - 0.5) * cell,
    y = 1 - (idx[, "row"] - 0.5) * cell,
    width = cell, height = cell, default.units = "npc",
    gp = grid::gpar(fill = "#000000", col = NA)
  )
}

.crf_named_access <- function(resolved_access) {
  if (is.null(resolved_access)) return(list())
  if (!is.list(resolved_access)) return(list())
  if (!is.null(names(resolved_access)) && all(nzchar(names(resolved_access)))) return(resolved_access)
  out <- list()
  for (row in resolved_access) {
    if (!is.list(row) || !.cc_is_scalar_string(row$access_id)) next
    out[[row$access_id]] <- row$qr_payload %||% row$url %||% ""
  }
  out
}

.crf_unit_context <- function(unit) {
  dims <- unit$dimensions %||% list()
  scheduling <- unit$scheduling %||% list()
  list(
    unit_id = .crf_txt(unit$unit_id, ""),
    label = .crf_txt(unit$label, "Unidad de aplicacion"),
    role = .crf_txt(unit$role, ""),
    group = .crf_txt(unit$group, ""),
    faculty = .crf_txt(dims$faculty %||% unit$faculty, ""),
    course_name = .crf_txt(
      dims$course_name %||% dims$course %||% dims$course_id %||% unit$course_name,
      .crf_txt(unit$label, "Curso sin nombre")
    ),
    schedule = .crf_txt(dims$schedule %||% scheduling$schedule %||% unit$schedule),
    venue = .crf_txt(dims$venue %||% unit$venue),
    teacher = .crf_txt(dims$teacher %||% unit$teacher),
    sample_label = .crf_txt(unit$group %||% dims$sample_label, "Seleccion"),
    eligible_n = .crf_txt(dims$eligible_n %||% unit$eligible_n, "Sin dato")
  )
}

.crf_binding_value <- function(binding, context) {
  switch(binding,
    "project.name" = context$project$name,
    "project.period" = context$project$period,
    "deployment.deployment_id" = context$deployment$deployment_id,
    "deployment.provider" = context$deployment$provider,
    "unit.unit_id" = context$unit$unit_id,
    "unit.label" = context$unit$label,
    "unit.role" = context$unit$role,
    "unit.group" = context$unit$group,
    "unit.faculty" = context$unit$faculty,
    "unit.course_name" = context$unit$course_name,
    "unit.schedule" = context$unit$schedule,
    "unit.venue" = context$unit$venue,
    "unit.teacher" = context$unit$teacher,
    "unit.sample_label" = context$unit$sample_label,
    "unit.eligible_n" = context$unit$eligible_n,
    "access.access_id" = context$access$access_id,
    "access.logical_collector_id" = context$access$logical_collector_id,
    "access.qr_payload" = context$access$qr_payload,
    ""
  )
}

.crf_compile_block <- function(block, context, page_index, unit_id) {
  out <- block
  out$value <- if (.cc_is_scalar_string(block$binding)) {
    .crf_binding_value(block$binding, context)
  } else {
    block$text %||% ""
  }
  warnings <- list()
  if (block$type %in% c("heading", "body", "instructions")) {
    max_lines <- as.integer(block$max_lines %||% switch(block$type, heading = 2L, body = 3L, 4L))
    width <- switch(block$type, heading = 35L, body = 42L, 72L)
    all_lines <- .crf_wrap(out$value, width = width)
    out$lines <- .crf_wrap(out$value, width = width, max_lines = max_lines)
    if (length(all_lines) > max_lines) {
      warnings[[length(warnings) + 1L]] <- list(
        code = "text_truncated", page = page_index, unit_id = unit_id,
        block_id = block$block_id, lines = length(all_lines), visible_lines = max_lines
      )
    }
  }
  if (identical(block$type, "field_grid")) {
    out$rows <- lapply(block$fields %||% list(), function(field) {
      if (is.character(field)) field <- list(label = field, binding = field)
      value <- .crf_binding_value(field$binding, context)
      lines <- .crf_wrap(value, width = 31L, max_lines = 2L)
      list(label = field$label %||% field$binding, binding = field$binding, value = value, lines = lines)
    })
    for (row in out$rows) {
      if (length(.crf_wrap(row$value, width = 31L)) > 2L) {
        warnings[[length(warnings) + 1L]] <- list(
          code = "field_truncated", page = page_index, unit_id = unit_id, binding = row$binding
        )
      }
    }
  }
  if (identical(block$type, "access_qr") && !nzchar(.crf_txt(out$value, ""))) {
    warnings[[length(warnings) + 1L]] <- list(
      code = "access_missing", page = page_index, unit_id = unit_id,
      block_id = block$block_id
    )
  }
  list(block = out, warnings = warnings)
}

.crf_access_for_unit <- function(unit_id, deployment, instance, resolved_access) {
  refs <- as.character(unlist(instance$access_refs %||% list(), use.names = FALSE))
  candidates <- Filter(function(binding) {
    is.list(binding) && identical(binding$unit_id, unit_id) && binding$access_id %in% refs
  }, deployment$bindings %||% list())
  binding <- if (length(candidates)) candidates[[1]] else list()
  access_id <- .crf_txt(binding$access_id, "")
  payload <- .crf_txt(resolved_access[[access_id]], "")
  if (!nzchar(payload) && is.list(binding)) {
    sensitivity <- as.character(deployment$sensitivity$access_urls %||% "restricted")[[1]]
    payload <- .collection_access_url(binding, sensitivity)
  }
  list(
    access_id = access_id,
    logical_collector_id = .crf_txt(binding$logical_collector_id, ""),
    qr_payload = payload
  )
}

#' Compila una instancia en paginas cerradas para el renderer grid.
#'
#' @param template plantilla validada.
#' @param instance instancia validada.
#' @param project snapshot no sensible del proyecto.
#' @param plan collection_plan/v1.
#' @param deployment collection_deployment/v1.
#' @param resolved_access mapa efimero access_id -> URL para accesos restricted.
#' @return plan de paginas, warnings, page_map y layout_fingerprint.
#' @export
collection_material_compile <- function(template, instance, project, plan, deployment,
                                        resolved_access = list()) {
  template_result <- collection_material_template_validate(template)
  if (!isTRUE(template_result$ok)) {
    stop("Plantilla de material invalida: ", paste(collection_contract_problem_lines(template_result), collapse = "; "), call. = FALSE)
  }
  instance_result <- collection_material_instance_validate(instance)
  if (!isTRUE(instance_result$ok)) {
    stop("Instancia de material invalida: ", paste(collection_contract_problem_lines(instance_result), collapse = "; "), call. = FALSE)
  }
  resolved <- .crf_named_access(resolved_access)
  selected_units <- as.character(unlist(instance$unit_refs %||% list(), use.names = FALSE))
  units <- Filter(function(unit) is.list(unit) && unit$unit_id %in% selected_units, plan$units %||% list())
  unit_by_id <- setNames(units, vapply(units, function(unit) unit$unit_id, character(1)))
  pages <- list()
  page_map <- list()
  warnings <- instance$warnings %||% list()
  for (unit_id in selected_units) {
    unit <- unit_by_id[[unit_id]]
    if (is.null(unit)) {
      warnings[[length(warnings) + 1L]] <- list(code = "unit_missing", unit_id = unit_id)
      next
    }
    access <- .crf_access_for_unit(unit_id, deployment, instance, resolved)
    context <- list(
      project = list(
        name = .crf_txt(project$name, "Proyecto Pulso"),
        period = .crf_txt(project$period, "")
      ),
      deployment = list(
        deployment_id = .crf_txt(deployment$deployment_id, ""),
        provider = .crf_txt(deployment$target$provider, "")
      ),
      unit = .crf_unit_context(unit),
      access = access
    )
    for (page_spec in template$pages) {
      page_number <- length(pages) + 1L
      compiled_blocks <- list()
      for (block in page_spec$blocks) {
        compiled <- .crf_compile_block(block, context, page_number, unit_id)
        compiled_blocks[[length(compiled_blocks) + 1L]] <- compiled$block
        warnings <- c(warnings, compiled$warnings)
      }
      pages[[page_number]] <- list(
        page_id = page_spec$page_id,
        layout_preset = page_spec$layout_preset,
        orientation = template$page$orientation,
        unit = context$unit,
        access = access,
        project = context$project,
        deployment = context$deployment,
        blocks = compiled_blocks,
        overflow = FALSE
      )
      page_map[[page_number]] <- list(
        page = as.integer(page_number),
        unit_id = unit_id,
        access_id = if (nzchar(access$access_id)) access$access_id else NULL
      )
    }
  }
  if (!length(pages)) stop("La instancia no produjo paginas renderizables.", call. = FALSE)
  layout_material <- list(
    template_sha256 = template$template_sha256,
    instance_fingerprint = instance$instance_fingerprint,
    pages = pages,
    page_map = page_map
  )
  list(
    schema = "collection_material_layout/v1",
    pages = pages,
    page_count = as.integer(length(pages)),
    page_map = page_map,
    warnings = warnings,
    layout_fingerprint = collection_fingerprint(layout_material)
  )
}

.crf_block <- function(page, type) {
  hits <- Filter(function(block) identical(block$type, type), page$blocks %||% list())
  if (length(hits)) hits[[1]] else NULL
}

.crf_draw_lines <- function(lines, x, y, gp, lineheight = 1.15, just = c("left", "top")) {
  if (!length(lines)) return(invisible(NULL))
  gp$lineheight <- lineheight
  grid::grid.text(
    paste(lines, collapse = "\n"), x = x, y = y, just = just,
    default.units = "npc", gp = gp
  )
  invisible(NULL)
}

#' Dibuja una pagina ya compilada. Es el unico cuerpo grid del material.
#'
#' @param page pagina de `collection_material_compile`.
#' @param page_no numero visible.
#' @param total_pages total visible.
#' @return invisible TRUE.
#' @export
collection_material_draw_page <- function(page, page_no = 1L, total_pages = 1L) {
  tokens <- pulso_pdf_tokens()
  type <- pulso_pdf_type()
  geo <- pulso_pdf_geo(page$orientation %||% "portrait")
  L <- .crf_layout()
  heading <- .crf_block(page, "heading")
  body <- .crf_block(page, "body")
  qr <- .crf_block(page, "access_qr")
  fields <- .crf_block(page, "field_grid")
  instructions <- .crf_block(page, "instructions")
  log_block <- .crf_block(page, "application_log")
  footer <- .crf_block(page, "footer")

  grid::grid.newpage()
  grid::grid.rect(gp = grid::gpar(fill = "#ffffff", col = NA))
  pulso_pdf_header(
    titulo = .crf_txt(heading$value %||% page$unit$label, "Unidad de aplicacion"),
    subtitulo = .crf_txt(page$unit$faculty %||% page$project$name, ""),
    tokens = tokens, geo = geo
  )

  if (!is.null(qr)) {
    grid::pushViewport(.crf_qr_viewport(L$qr_x, L$qr_y, L$qr_side * 1.20, geo))
    grid::grid.rect(gp = grid::gpar(fill = "#ffffff", col = tokens$rule, lwd = 0.7))
    grid::popViewport()
    payload <- .crf_txt(qr$value, "")
    if (nzchar(payload)) {
      grid::pushViewport(.crf_qr_viewport(L$qr_x, L$qr_y, L$qr_side, geo))
      .crf_draw_qr_modules(collection_qr_matrix(
        payload,
        correction = qr$correction %||% "M",
        quiet_zone = qr$quiet_zone %||% 4L
      ))
      grid::popViewport()
    } else {
      grid::grid.text(
        "Sin enlace", x = L$qr_x, y = L$qr_y,
        gp = grid::gpar(col = tokens$faint, fontsize = type$body), default.units = "npc"
      )
    }
  }

  .crf_draw_lines(
    body$lines %||% .crf_wrap(page$unit$course_name, 38L, 3L),
    L$x_left, L$y_title, grid::gpar(col = tokens$navy, fontsize = type$section, fontface = "bold")
  )

  rows <- fields$rows %||% list()
  for (i in seq_along(rows)) {
    y <- L$y_rows_top - (i - 1L) * L$row_step
    grid::grid.text(
      .crf_txt(rows[[i]]$label, "Dato"), x = L$x_left, y = y,
      just = "left", default.units = "npc",
      gp = grid::gpar(col = tokens$soft, fontsize = type$caption)
    )
    .crf_draw_lines(
      rows[[i]]$lines %||% .crf_wrap(rows[[i]]$value, 31L, 2L),
      L$x_left + L$label_w, y + 0.008,
      grid::gpar(col = tokens$ink, fontsize = type$body), lineheight = 1.05
    )
  }

  pulso_pdf_hairline(L$x_left, L$x_right, L$y_link + 0.045, tokens = tokens)
  grid::grid.text(
    "Enlace de la encuesta", x = L$x_left, y = L$y_link + 0.022,
    just = "left", default.units = "npc",
    gp = grid::gpar(col = tokens$soft, fontsize = type$caption)
  )
  link_lines <- .crf_wrap(page$access$qr_payload, width = 92L, max_lines = 3L)
  if (!length(link_lines)) link_lines <- "Pendiente de generar"
  .crf_draw_lines(
    link_lines, L$x_left, L$y_link,
    grid::gpar(col = tokens$ink, fontsize = max(6.5, type$code - 0.5)), lineheight = 1.05
  )

  if (!is.null(instructions)) {
    .crf_draw_lines(
      instructions$lines %||% .crf_wrap(instructions$value, 75L, 4L),
      L$x_left, 0.295, grid::gpar(col = tokens$soft, fontsize = type$body), lineheight = 1.12
    )
  }

  if (!is.null(log_block)) {
    rows_n <- as.integer(log_block$rows %||% 3L)
    grid::grid.text(
      .crf_txt(log_block$text, "Registro de aplicacion"), x = L$x_left, y = 0.225,
      just = "left", default.units = "npc",
      gp = grid::gpar(col = tokens$navy, fontsize = type$caption, fontface = "bold")
    )
    y0 <- 0.195
    for (i in seq_len(rows_n)) {
      y <- y0 - (i - 1L) * 0.032
      grid::grid.text(sprintf("%d", i), x = L$x_left, y = y, just = "left", default.units = "npc",
                      gp = grid::gpar(col = tokens$faint, fontsize = type$caption))
      pulso_pdf_hairline(L$x_left + 0.03, L$x_right, y - 0.006, tokens = tokens, lwd = 0.5)
    }
  }

  period <- .crf_txt(footer$value %||% page$project$period, "")
  pulso_pdf_footer(page_no, periodo = period, tokens = tokens, geo = geo)
  if (total_pages > 1L) {
    grid::grid.text(
      sprintf("%d / %d", page_no, total_pages), x = 0.88, y = 0.038,
      just = "right", default.units = "npc",
      gp = grid::gpar(col = tokens$faint, fontsize = type$caption)
    )
  }
  invisible(TRUE)
}

.crf_open_device <- function(path, device, orientation, dpi) {
  geo <- pulso_pdf_geo(orientation)
  if (identical(device, "pdf")) {
    grDevices::pdf(path, width = geo$page_w, height = geo$page_h, onefile = TRUE)
  } else {
    if (!isTRUE(capabilities("png"))) {
      stop("Este R no tiene device PNG; la preview autoritativa no se puede rasterizar.", call. = FALSE)
    }
    grDevices::png(
      path, width = round(geo$page_w * dpi), height = round(geo$page_h * dpi),
      res = dpi, type = "cairo-png", bg = "white"
    )
  }
  invisible(TRUE)
}

#' Renderiza un layout compilado a PDF o una pagina seleccionada a PNG.
#'
#' @param compiled salida de `collection_material_compile`.
#' @param path archivo de salida.
#' @param device pdf o png.
#' @param page pagina seleccionada para PNG.
#' @param dpi resolucion PNG.
#' @return metadatos estructurales del render.
#' @export
collection_material_render_compiled <- function(compiled, path, device = c("pdf", "png"),
                                                page = 1L, dpi = 150) {
  device <- match.arg(device)
  selected <- if (identical(device, "png")) {
    index <- suppressWarnings(as.integer(page[[1]]))
    if (is.na(index) || index < 1L || index > length(compiled$pages)) {
      stop("La pagina de preview no existe.", call. = FALSE)
    }
    index
  } else {
    seq_along(compiled$pages)
  }
  orientation <- compiled$pages[[selected[[1]]]]$orientation %||% "portrait"
  .crf_open_device(path, device, orientation, dpi)
  device_open <- TRUE
  on.exit(if (device_open) grDevices::dev.off(), add = TRUE)
  for (index in selected) {
    collection_material_draw_page(compiled$pages[[index]], index, length(compiled$pages))
  }
  grDevices::dev.off()
  device_open <- FALSE
  list(
    path = path,
    device = device,
    page_count = as.integer(length(selected)),
    page_map = compiled$page_map[selected],
    layout_fingerprint = compiled$layout_fingerprint,
    warnings = compiled$warnings
  )
}

.crf_compiled_from_ficha <- function(ficha) {
  template <- collection_material_builtin_template()
  link <- .crf_txt(ficha$link, "")
  plan <- list(units = list(list(
    unit_id = "unit-ficha",
    label = .crf_txt(ficha$unit_label, "Curso-horario"),
    role = "titular",
    group = .crf_txt(ficha$sample_label, "Seleccion"),
    dimensions = list(
      faculty = .crf_txt(ficha$faculty, ""),
      course_name = .crf_txt(ficha$course_name, "Curso sin nombre"),
      schedule = .crf_txt(ficha$schedule),
      venue = .crf_txt(ficha$venue),
      teacher = .crf_txt(ficha$teacher),
      eligible_n = .crf_txt(ficha$eligible_n, "Sin dato")
    )
  )))
  deployment <- list(
    deployment_id = "deployment-ficha",
    target = list(provider = "manual"),
    sensitivity = list(access_urls = "operational"),
    bindings = list(list(
      access_id = "access-ficha", logical_collector_id = "logical-ficha",
      unit_id = "unit-ficha", access_kind = "manual_handoff",
      access_ref = link, status = if (nzchar(link)) "ready" else "missing"
    ))
  )
  deployment_fp <- collection_fingerprint(deployment)
  access_fp <- collection_fingerprint(deployment$bindings)
  instance <- list(
    schema = COLLECTION_MATERIAL_INSTANCE_SCHEMA,
    instance_id = "material-ficha",
    template_ref = list(template_id = template$template_id, revision = 1L, sha256 = template$template_sha256),
    deployment_id = deployment$deployment_id,
    deployment_fingerprint = deployment_fp,
    access_fingerprint = access_fp,
    unit_refs = list("unit-ficha"),
    access_refs = list("access-ficha"),
    locale = "es-PE", status = "ready", sensitivity = "operational", warnings = list()
  )
  instance$instance_fingerprint <- .cm_instance_fingerprint(
    template$template_sha256, deployment_fp, access_fp, "unit-ficha", "access-ficha"
  )
  collection_material_compile(
    template, instance,
    project = list(name = "Pulso PUCP", period = .crf_txt(ficha$period, "")),
    plan = plan, deployment = deployment
  )
}

#' Compatibilidad del spike: renderiza una ficha plana por el compilador V1.
#'
#' @param ficha lista plana legacy.
#' @param path archivo de salida.
#' @param device pdf o png.
#' @param dpi resolucion PNG.
#' @return metadatos del render.
#' @export
collection_render_ficha <- function(ficha, path, device = c("pdf", "png"), dpi = 150) {
  device <- match.arg(device)
  compiled <- .crf_compiled_from_ficha(ficha)
  invisible(collection_material_render_compiled(compiled, path, device = device, dpi = dpi))
}

#' Render legacy con checksum sin prefijo, preservado para pruebas del spike.
#'
#' @inheritParams collection_render_ficha
#' @return path, device, sha256 y bytes.
#' @export
collection_render_ficha_receipt <- function(ficha, path, device = c("pdf", "png"), dpi = 150) {
  device <- match.arg(device)
  collection_render_ficha(ficha, path, device = device, dpi = dpi)
  list(
    path = path,
    device = device,
    sha256 = digest::digest(file = path, algo = "sha256"),
    bytes = file.info(path)$size
  )
}

#' Relee los modulos del QR desde el PNG emitido por el renderer.
#'
#' @param png_path ruta PNG.
#' @param n modulos por lado.
#' @param dpi resolucion usada.
#' @return matriz logica.
#' @export
collection_qr_matrix_from_png <- function(png_path, n, dpi = 150) {
  if (!requireNamespace("png", quietly = TRUE)) {
    stop("Se necesita el paquete 'png' para releer la matriz del QR.", call. = FALSE)
  }
  img <- png::readPNG(png_path)
  grey <- if (length(dim(img)) == 3L) img[, , 1] else img
  L <- .crf_layout()
  px_w <- ncol(grey)
  px_h <- nrow(grey)
  side_px <- L$qr_side * px_w
  cx <- L$qr_x * px_w
  cy <- (1 - L$qr_y) * px_h
  x0 <- cx - side_px / 2
  y0 <- cy - side_px / 2
  cell <- side_px / n
  out <- matrix(FALSE, nrow = n, ncol = n)
  for (r in seq_len(n)) {
    for (c in seq_len(n)) {
      px <- max(1L, min(px_w, round(x0 + (c - 0.5) * cell)))
      py <- max(1L, min(px_h, round(y0 + (r - 0.5) * cell)))
      out[r, c] <- grey[py, px] < 0.5
    }
  }
  out
}
