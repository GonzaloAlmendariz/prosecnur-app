# Compilador grid unico para materiales de Recopiladores (ADR 0046).
#
# PDF final y PNG autoritativo llaman al mismo `collection_material_draw_page`.
# Solo cambia el device; no se rasteriza el PDF ni se usa ImageMagick.

# Anclajes verticales de la ficha, en npc de alto de pagina.
#
# Medido sobre el PNG autoritativo, 6 de 20 bandas horizontales salian sin una
# gota de tinta: el 30% de la hoja. Estaban en dos sitios, no repartidas —una
# franja bajo la regla de cabecera y otra sobre el pie—, mientras el grid de
# datos vivia al limite de su capacidad. Cerrar esas dos franjas le devuelve
# filas al grid sin apretar nada.
#
# Los anclajes de abajo (instrucciones, registro) vivian hardcodeados dentro
# del dibujante, asi que mover el cuerpo no los movia y el aire se acumulaba
# justo donde ya sobraba.
.crf_layout <- function(branded = FALSE) {
  base <- list(
    qr_side = 0.34,
    qr_x = 0.72,
    qr_y = 0.685,
    x_left = 0.075,
    x_right = 0.925,
    y_title = 0.868,
    y_rows_top = 0.775,
    # `row_step` es el paso MAXIMO, no el fijo: las filas reparten la banda que
    # les toca en vez de amontonarse arriba y dejar el hueco abajo. `row_step_min`
    # es lo mas apretado que se admite antes de recortar filas.
    row_step = 0.075,
    row_step_min = 0.045,
    y_link = 0.330,
    y_instructions = 0.262,
    y_log_title = 0.196,
    y_log_rows = 0.168,
    log_row_step = 0.032,
    log_row_step_min = 0.020,
    # Suelo del registro: por debajo empieza el pie. `application_log` admite
    # hasta 6 renglones por contrato y la banda no da para seis al paso comodo,
    # asi que reparte igual que el grid en vez de escribir sobre el logo.
    y_log_floor = 0.075,
    log_label_w = 0.30,
    label_w = 0.13,
    # Cabecera propia del kit Pulso cuando no hay careta encima.
    y_brand = NA_real_,
    y_header = 0.968,
    y_header_sub = 0.952,
    y_header_rule = 0.918
  )
  if (!branded) return(base)
  # Con careta la cabecera baja ~0.066 para dejarle su banda, y el cuerpo baja
  # con ella. Antes el cuerpo se quedaba quieto —"entre la regla y el titulo ya
  # habia aire suficiente"—, que es precisamente como la version sin careta
  # termino con una franja muerta: ese aire era el hueco.
  base$y_brand <- 0.950
  base$y_header <- 0.898
  base$y_header_sub <- 0.882
  base$y_header_rule <- 0.852
  base$y_title <- 0.802
  base$y_rows_top <- 0.712
  base$qr_y <- 0.622
  base
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

# `titular` y `chain_reserve` son claves del motor, no espanol. Impresas en una
# hoja que alguien lee parado en la puerta de un aula no dicen nada, y confundir
# una ficha de reemplazo con una de titular cuesta una aplicacion entera. El
# plan conserva la clave canonica; lo que se imprime es la frase.
.crf_role_label <- function(role, replacement_for = "", orden = NULL) {
  key <- tolower(gsub("[ -]+", "_", trimws(as.character(role %||% "")[1])))
  target <- trimws(as.character(replacement_for %||% "")[1])
  base <- switch(
    key,
    titular = "Titular",
    chain_reserve = "Reemplazo",
    reserva = "Reemplazo",
    extra_reserve_pool = "Reserva adicional",
    # Un rol que no conocemos se imprime tal cual: inventarle una etiqueta
    # seria peor que mostrar la clave.
    trimws(as.character(role %||% "")[1])
  )
  if (!identical(base, "Reemplazo")) return(base)
  # El ORDEN distingue un eslabon de otro. Con cadenas de uno o dos no hacia
  # falta, pero desde que el candado por facultad las deja llegar a 11, seis
  # fichas de la misma cadena decian exactamente lo mismo —«Reemplazo de
  # AULA-01»— y quien las tiene en la mano no sabia cual entra primero.
  n <- suppressWarnings(as.integer(orden %||% NA))
  pos <- if (length(n) == 1L && is.finite(n) && n > 0L) sprintf(" %d", n) else ""
  if (nzchar(target)) paste0("Reemplazo", pos, " de ", target) else paste0("Reemplazo", pos)
}

.crf_unit_context <- function(unit) {
  dims <- unit$dimensions %||% list()
  scheduling <- unit$scheduling %||% list()
  replacement_for <- .crf_txt(dims$replacement_for %||% unit$replacement_for, "")
  list(
    unit_id = .crf_txt(unit$unit_id, ""),
    label = .crf_txt(unit$label, "Unidad de aplicacion"),
    role = .crf_role_label(
      unit$role, replacement_for,
      dims$replacement_order %||% unit$replacement_order
    ),
    replacement_for = replacement_for,
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
    "unit.replacement_for" = context$unit$replacement_for,
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
  if (identical(block$type, "form_lines")) {
    out$rows <- lapply(block$rows %||% list(), function(row) {
      cells <- lapply(row$fields %||% list(), function(cell) {
        if (!.cc_is_scalar_string(cell$binding)) return(cell)
        c(cell, list(value = .crf_binding_value(cell$binding, context)))
      })
      list(fields = cells)
    })
  }
  if (identical(block$type, "field_grid")) {
    out$rows <- lapply(block$fields %||% list(), function(field) {
      if (is.character(field)) field <- list(label = field, binding = field)
      if (isTRUE(field$blank)) {
        return(list(label = field$label, binding = NULL, value = "", lines = character(0), blank = TRUE))
      }
      value <- .crf_binding_value(field$binding, context)
      lines <- .crf_wrap(value, width = 31L, max_lines = 2L)
      list(label = field$label %||% field$binding, binding = field$binding, value = value,
           lines = lines, blank = FALSE)
    })
    for (row in out$rows) {
      if (isTRUE(row$blank)) next
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
    payload <- .collection_access_url(binding, sensitivity, deployment$target$provider, deployment$target$return_url)
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

#' Dibuja una pagina ya compilada, despachando por layout.
#'
#' @param page pagina de `collection_material_compile`.
#' @param page_no numero visible.
#' @param total_pages total visible.
#' @param brand_assets mapa efimero id -> ruta PNG para layouts con careta.
#' @return lista con `warnings` y `links` declarados por el layout.
#' @export
collection_material_draw_page <- function(page, page_no = 1L, total_pages = 1L,
                                          brand_assets = list()) {
  if (identical(page$layout_preset, "poster_qr")) {
    return(collection_material_draw_poster(page, page_no, total_pages, brand_assets))
  }
  if (identical(page$layout_preset, "field_form")) {
    return(collection_material_draw_field_form(page, page_no, total_pages, brand_assets))
  }
  collection_material_draw_sheet(page, page_no, total_pages, brand_assets)
}

# Pildora navy arriba a la derecha: marca la hoja como piloto, reemplazo o
# segunda visita sin robarle sitio al titulo.
.crf_draw_status_tag <- function(text, L, tokens, geo) {
  if (!nzchar(text)) return(invisible(NULL))
  ty <- pulso_pdf_type()
  pad <- 0.011
  half_w <- (nchar(text, type = "width") * ty$caption * 0.62 / 72) / geo$page_w / 2 + pad
  half_h <- (ty$caption * 1.9 / 72) / geo$page_h / 2
  cx <- L$x_right - half_w
  cy <- L$y_header + 0.006
  grid::grid.roundrect(
    x = cx, y = cy, width = half_w * 2, height = half_h * 2, r = grid::unit(2, "pt"),
    default.units = "npc", gp = grid::gpar(fill = tokens$navy, col = NA)
  )
  grid::grid.text(
    text, x = cx, y = cy, default.units = "npc",
    gp = grid::gpar(col = "#ffffff", fontsize = ty$caption, fontface = "bold")
  )
  invisible(NULL)
}

#' Dibuja una pagina con el layout `single_sheet` (ficha de aplicacion).
#'
#' @param page pagina de `collection_material_compile`.
#' @param page_no numero visible.
#' @param total_pages total visible.
#' @param brand_assets mapa efimero id -> ruta PNG si la ficha lleva careta.
#' @return lista con `warnings` y `links`.
#' @export
collection_material_draw_sheet <- function(page, page_no = 1L, total_pages = 1L,
                                           brand_assets = list()) {
  tokens <- pulso_pdf_tokens()
  type <- pulso_pdf_type()
  geo <- pulso_pdf_geo(page$orientation %||% "portrait")
  brand <- .crf_block(page, "brand_strip")
  L <- .crf_layout(branded = !is.null(brand))
  heading <- .crf_block(page, "heading")
  body <- .crf_block(page, "body")
  qr <- .crf_block(page, "access_qr")
  fields <- .crf_block(page, "field_grid")
  instructions <- .crf_block(page, "instructions")
  log_block <- .crf_block(page, "application_log")
  footer <- .crf_block(page, "footer")
  tag <- .crf_block(page, "status_tag")
  warnings <- list()

  grid::grid.newpage()
  grid::grid.rect(gp = grid::gpar(fill = "#ffffff", col = NA))
  if (!is.null(brand)) {
    for (id in .cra_draw_brand_strip(
      brand$assets, brand_assets, y = L$y_brand,
      max_height_mm = brand$max_height_mm %||% 13,
      align = as.character(brand$align %||% "left")[[1]], geo = geo
    )) {
      warnings[[length(warnings) + 1L]] <- list(
        code = "brand_asset_missing", page = page_no, asset_id = id
      )
    }
  }
  pulso_pdf_header(
    titulo = .crf_txt(heading$value %||% page$unit$label, "Unidad de aplicacion"),
    subtitulo = .crf_txt(page$unit$faculty %||% page$project$name, ""),
    tokens = tokens, geo = geo,
    y_titulo = L$y_header, y_subtitulo = L$y_header_sub, y_regla = L$y_header_rule
  )
  if (!is.null(tag)) {
    .crf_draw_status_tag(.crf_txt(tag$value %||% tag$text, ""), L, tokens, geo)
  }

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
  # El grid vive a la izquierda del QR, asi que una fila no puede invadir su
  # columna: el ancho util termina donde empieza el recuadro del simbolo.
  row_right <- min(L$x_right, L$qr_x - L$qr_side * 0.60 - 0.02)
  # Capacidad real de la banda: por debajo empieza el bloque del enlace. Una
  # fila de mas no se "aprieta" indefinidamente, pisa el enlace, asi que por
  # debajo de `row_step_min` se recorta y se avisa.
  band <- L$y_rows_top - (L$y_link + 0.055)
  max_rows <- max(1L, as.integer(floor(band / L$row_step_min)) + 1L)
  if (length(rows) > max_rows) {
    warnings[[length(warnings) + 1L]] <- list(
      code = "field_grid_overflow", page = page_no,
      rows = length(rows), visible_rows = max_rows
    )
    rows <- rows[seq_len(max_rows)]
  }
  # Pocas filas no se apelotonan arriba dejando un hueco antes del enlace: se
  # reparten la banda hasta el paso maximo. Medido sobre el PNG, ese hueco era
  # la franja muerta mas grande de la hoja.
  row_step <- if (length(rows) > 1L) min(L$row_step, band / (length(rows) - 1L)) else 0
  for (i in seq_along(rows)) {
    y <- L$y_rows_top - (i - 1L) * row_step
    grid::grid.text(
      .crf_txt(rows[[i]]$label, "Dato"), x = L$x_left, y = y,
      just = "left", default.units = "npc",
      gp = grid::gpar(col = tokens$soft, fontsize = type$caption)
    )
    if (isTRUE(rows[[i]]$blank)) {
      pulso_pdf_hairline(L$x_left + L$label_w, row_right, y - 0.004, tokens = tokens, lwd = 0.5)
      next
    }
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
  payload <- .crf_txt(page$access$qr_payload, "")
  link_size <- max(6.5, type$code - 0.5)
  link_lines <- .crf_wrap(payload, width = 92L, max_lines = 3L)
  if (!length(link_lines)) link_lines <- "Pendiente de generar"
  .crf_draw_lines(
    link_lines, L$x_left, L$y_link,
    grid::gpar(col = tokens$navy, fontsize = link_size), lineheight = 1.05
  )
  links <- list()
  if (nzchar(payload)) {
    link_h <- length(link_lines) * (link_size * 1.05 / 72) / geo$page_h
    links[[1]] <- list(
      page = page_no, url = payload, kind = "printed_url",
      x0 = L$x_left, x1 = L$x_right,
      y0 = L$y_link - link_h, y1 = L$y_link + 0.006
    )
  }

  if (!is.null(instructions)) {
    .crf_draw_lines(
      instructions$lines %||% .crf_wrap(instructions$value, 75L, 4L),
      L$x_left, L$y_instructions, grid::gpar(col = tokens$soft, fontsize = type$body), lineheight = 1.12
    )
  }

  if (!is.null(log_block)) {
    rows_n <- as.integer(log_block$rows %||% 3L)
    grid::grid.text(
      .crf_txt(log_block$text, "Registro de aplicacion"), x = L$x_left, y = L$y_log_title,
      just = "left", default.units = "npc",
      gp = grid::gpar(col = tokens$navy, fontsize = type$caption, fontface = "bold")
    )
    y0 <- L$y_log_rows
    etiquetas <- as.character(unlist(log_block$labels %||% list(), use.names = FALSE))
    banda_log <- L$y_log_rows - L$y_log_floor
    max_log <- max(1L, as.integer(floor(banda_log / L$log_row_step_min)) + 1L)
    if (rows_n > max_log) {
      warnings[[length(warnings) + 1L]] <- list(
        code = "application_log_overflow", page = page_no,
        rows = rows_n, visible_rows = max_log
      )
      rows_n <- max_log
    }
    log_step <- if (rows_n > 1L) min(L$log_row_step, banda_log / (rows_n - 1L)) else 0
    for (i in seq_len(rows_n)) {
      y <- y0 - (i - 1L) * log_step
      # Con etiqueta, la linea dice que anotar y empieza donde termina el texto.
      # Sin ella cae al ordinal de siempre, que no compromete a nada.
      etiqueta <- if (i <= length(etiquetas)) etiquetas[[i]] else ""
      con_etiqueta <- nzchar(etiqueta)
      grid::grid.text(
        if (con_etiqueta) etiqueta else sprintf("%d", i),
        x = L$x_left, y = y, just = "left", default.units = "npc",
        gp = grid::gpar(col = if (con_etiqueta) tokens$soft else tokens$faint, fontsize = type$caption)
      )
      inicio <- if (con_etiqueta) L$x_left + L$log_label_w else L$x_left + 0.03
      pulso_pdf_hairline(inicio, L$x_right, y - 0.006, tokens = tokens, lwd = 0.5)
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
  list(warnings = warnings, links = links)
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
#' @param brand_assets mapa efimero id -> ruta PNG de los logos de la careta.
#'   Vive solo aqui, no en la instancia ni en el layout compilado: una ruta
#'   absoluta dentro del `layout_fingerprint` lo volveria distinto en cada
#'   maquina y el fingerprint dejaria de comparar lo que dice comparar.
#' @return metadatos estructurales del render.
#' @export
collection_material_render_compiled <- function(compiled, path, device = c("pdf", "png"),
                                                page = 1L, dpi = 150,
                                                brand_assets = list()) {
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
  draw_warnings <- list()
  links <- list()
  for (position in seq_along(selected)) {
    index <- selected[[position]]
    drawn <- collection_material_draw_page(
      compiled$pages[[index]], index, length(compiled$pages), brand_assets
    )
    draw_warnings <- c(draw_warnings, drawn$warnings %||% list())
    # `position`, no `index`: en PNG se emite una sola pagina y el PDF de una
    # seleccion parcial renumera desde 1. La anotacion tiene que caer en la
    # pagina del archivo, no en la del layout.
    links <- c(links, lapply(drawn$links %||% list(), function(link) {
      link$page <- position
      link
    }))
  }
  grDevices::dev.off()
  device_open <- FALSE
  if (identical(device, "pdf") && length(links)) {
    pulso_pdf_add_link_annotations(path, links)
  }
  list(
    path = path,
    device = device,
    page_count = as.integer(length(selected)),
    page_map = compiled$page_map[selected],
    layout_fingerprint = compiled$layout_fingerprint,
    # Se devuelven los rectangulos declarados para que el llamante pueda
    # comprobar que el material salio con enlace y no solo con el QR dibujado.
    links = links,
    warnings = c(compiled$warnings, draw_warnings)
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
#' @param layout_preset layout con el que se dibujo la pagina; decide donde
#'   buscar el simbolo. Releer un afiche con la geometria de la ficha devuelve
#'   ruido blanco, no un fallo, asi que el preset es parte de la pregunta.
#' @return matriz logica.
#' @export
collection_qr_matrix_from_png <- function(png_path, n, dpi = 150,
                                          layout_preset = c("single_sheet", "poster_qr", "field_form"),
                                          branded = FALSE) {
  if (!requireNamespace("png", quietly = TRUE)) {
    stop("Se necesita el paquete 'png' para releer la matriz del QR.", call. = FALSE)
  }
  layout_preset <- match.arg(layout_preset)
  img <- png::readPNG(png_path)
  grey <- if (length(dim(img)) == 3L) img[, , 1] else img
  # `branded` no es opcional por gusto: con careta el cuerpo entero baja, y el
  # QR con el. Este lector pedia siempre la geometria SIN careta, asi que leia
  # el sitio equivocado de una ficha con logos; no se notaba solo porque ambas
  # variantes coincidian en `qr_y` por casualidad. Un verificador que asume
  # donde esta lo que verifica da verde sin mirar.
  L <- switch(
    layout_preset,
    poster_qr = .cra_layout(),
    field_form = .cfc_layout(),
    .crf_layout(branded = isTRUE(branded))
  )
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
