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
    # **0.42, y el limite ahora es el papel y no el verificador.**
    #
    # Durante tres ticks el QR no pudo pasar de 0.34 porque el verificador de QR
    # del QA leia un modulo cambiado, y se descartaron cinco hipotesis buscando
    # la causa en el lector, en el marco, en el antialiasing y en el borde de la
    # pagina. Estaba en otro sitio: **el bloque del nombre del curso se envolvia
    # a 38 caracteres fijos** mientras el resto del flujo respeta un
    # `right_edge` que se acorta a la altura del QR. Con el codigo pequeño
    # sobraba sitio; al agrandarlo, el texto se metia POR DEBAJO del QR y
    # ensuciaba sus modulos de la izquierda —el verificador fallaba en las
    # columnas 1 y 3, que es exactamente por donde entraba—.
    #
    # Arreglado eso, el lector lee limpio en 0.42, 0.46, 0.50 y 0.54.
    #
    # **Y el QR dejo de compartir fila con los datos.** Mientras la ficha ponia
    # el codigo en una columna y el curso, el horario, el aula y el docente en
    # la de al lado, el ancho del QR era lo que sobrara de la banda: 8,8 cm, y
    # cada centimetro que ganaba se lo quitaba al nombre del docente. Ahora el
    # QR ocupa el ancho entero y los datos van debajo, en filas de dos campos.
    # `qr_full_width` es lo que el planificador de flujo mira para arrancar
    # DEBAJO del simbolo en vez de a su izquierda.
    qr_full_width = TRUE,
    qr_side = 0.46,
    qr_x = 0.50,
    qr_y = 0.705,
    x_left = 0.075,
    x_right = 0.925,
    y_title = 0.868,
    y_rows_top = 0.775,
    # `row_step` es el paso MAXIMO, no el fijo: las filas reparten la banda que
    # les toca en vez de amontonarse arriba y dejar el hueco abajo. `row_step_min`
    # es lo mas apretado que se admite antes de recortar filas.
    row_step = 0.048,
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
  # Con careta el QR es menor, y no por gusto: la banda de logos se lleva 0.066
  # de alto y el flujo de abajo es el mismo —cinco campos, enlace, aviso y un
  # registro de nueve casillas—. Medido, a 0.46 el grid se quedaba en dos
  # renglones y «Docente» y «Estudiantes» se caian de la hoja.
  base$qr_side <- 0.36
  base$qr_y <- 0.802 - (0.36 * 8.27 / 11.69) / 2
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

#' Lado del viewport donde se dibuja la matriz ENTERA del QR.
#'
#' `qr_side` es el sitio que el layout le reserva al simbolo. La matriz que
#' devuelve `collection_qr_matrix` no es solo el simbolo: trae cuatro modulos
#' blancos de zona de silencio por lado. Dibujada tal cual dentro de `qr_side`,
#' esos ocho modulos se comen el borde —con 41 modulos utiles, el 16% del lado—
#' y el simbolo visible ocupa el 84% de su hueco.
#'
#' La zona de silencio tiene que existir, pero no tiene por que ser sitio
#' RESERVADO: la ficha es blanca alrededor del QR, asi que la silencia igual si
#' se derrama sobre ella. Este lado amplia el viewport lo justo para que el
#' simbolo util llene `qr_side` exacto y el blanco caiga fuera.
#'
#' La usan el dibujante Y el relector del PNG. Que sea una sola cuenta no es
#' aseo: un verificador que asume por su cuenta donde esta el simbolo lee el
#' sitio equivocado y da verde sin mirar —ya paso con `branded`—.
#'
#' @param qr_side lado reservado por el layout, en npc de ancho.
#' @param n modulos por lado de la matriz completa.
#' @param quiet_zone modulos de silencio por lado incluidos en la matriz.
#' @keywords internal
.crf_qr_lado_total <- function(qr_side, n, quiet_zone = 4L, max_total = Inf) {
  n <- as.integer(n[[1]]); qz <- as.integer(quiet_zone[[1]])
  util <- n - 2L * qz
  if (is.na(util) || util < 1L) return(min(qr_side, max_total))
  # El tope existe porque el derrame tiene un limite fisico: la hoja. Medido en
  # `field_form`, cuyo QR ya ocupaba casi el ancho util, la matriz ampliada
  # llegaba a 0.949 de ancho y a 0.987 de alto —fuera del papel—, y un QR
  # recortado por el borde no se escanea. Cuando toca el tope, el simbolo deja
  # de medir `qr_side` y mide lo que quepa; sigue siendo mas de lo que media
  # cuando la zona de silencio iba dentro del hueco.
  min(qr_side * n / util, max_total)
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
    # El codigo operativo —«CH 1», «R 1.2»— con el nombre del aula de respaldo:
    # una ficha sin titulo seria peor que una titulada con el nombre academico.
    operational_code = .crf_txt(
      dims$legacy_ref %||% unit$operational_code,
      .crf_txt(unit$label, "Unidad de aplicacion")
    ),
    label = .crf_txt(unit$label, "Unidad de aplicacion"),
    role = .crf_role_label(
      unit$role, replacement_for,
      dims$replacement_order %||% unit$replacement_order
    ),
    # La CLAVE del rol, ademas de la frase. `role` sale ya redactado —«Reemplazo
    # 2»— porque es lo que se imprime, y quien tiene que AGRUPAR por rol
    # necesita el termino canonico: leerlo del texto obligaria a parsear una
    # frase que existe para leerse, no para compararse.
    role_key = tolower(gsub("[ -]+", "_", trimws(as.character(unit$role %||% "")[1]))),
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
    "unit.operational_code" = context$unit$operational_code,
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

# Convierte el ORDEN de los bloques de contenido en posiciones verticales
# reales, en vez de que cada tipo tenga una `y` fija en `.crf_layout()`.
# Antes reordenar en el editor no cambiaba nada en el PDF (era cosmetico);
# esto mide cuanto ocupa cada bloque presente y los apila de arriba a abajo
# en el orden en que aparecen en `page$blocks`. Separado de dibujar para que
# se pueda probar sin abrir un device grid.
#
# El QR se queda anclado arriba a la derecha -no es parte del flujo: moverlo
# libremente exige evitar colisiones en dos ejes, un problema distinto al que
# pide este cambio-. Los bloques cuya banda cae dentro de su altura usan el
# ancho angosto ya usado por el grid (`row_right`); mas abajo, ancho completo.
# El enlace tampoco es un bloque del catalogo -no aparece en el editor, no se
# puede reordenar- asi que se ancla justo debajo del ultimo `field_grid` (o
# del `body` si no hay grid) para que la hoja siga leyendose de arriba a abajo
# pase lo que pase con el orden de los demas bloques.
.crf_flow_plan <- function(blocks, L, type, geo, payload = "") {
  flow_types <- c("body", "field_grid", "divider", "instructions", "application_log")
  items <- Filter(function(b) b$type %in% flow_types, blocks %||% list())
  gap <- 0.018
  # **El enlace pide lo que ocupa, no un alto de catalogo.**
  #
  # 0.085 era el sitio de tres lineas de URL, y el dibujante de mas abajo ya
  # calculaba el alto REAL a partir de las lineas que salen. Con una URL corta
  # sobraban dos lineas de blanco… que no quedaban debajo del enlace, sino que
  # se le restaban al grid de datos: con el QR grande, «Docente» y «Estudiantes»
  # se caian de la ficha por 0,004 npc mientras ese aire seguia reservado.
  link_size <- max(6.5, type$code - 0.5)
  n_link <- length(.crf_wrap(payload, width = .crf_flow_chars(L$x_right, L$x_left, 92L), max_lines = 3L))
  link_h <- 0.045 + max(1L, n_link) * (link_size * 1.05 / 72) / geo$page_h + 0.006
  ancho <- isTRUE(L$qr_full_width)
  # Simbolo mas su zona de silencio, en el caso peor. El simbolo mide `qr_side`
  # exacto; la zona de silencio se derrama fuera y mide cuatro modulos por lado,
  # asi que en npc vale `4 * qr_side / modulos_utiles`: cuantos MENOS modulos,
  # mas ancha. El minimo que devuelve `qrcode` son 25, de donde sale el
  # `8/25`. El texto no puede invadirla —dejaria de silenciar—, asi que el flujo
  # arranca por debajo de ella y no del borde del simbolo. Usar el caso peor y
  # no el payload de turno mantiene el sitio del texto FIJO: si no, la ficha se
  # recompondria segun lo larga que sea la URL.
  qr_outer_h <- (L$qr_side * (1 + 8 / 25) * geo$page_w) / geo$page_h
  qr_bottom <- L$qr_y - qr_outer_h / 2
  # Con el QR a todo el ancho no hay banda a su izquierda que repartir: el flujo
  # entero empieza debajo y usa la hoja completa.
  row_right <- if (ancho) L$x_right else min(L$x_right, L$qr_x - L$qr_side * 0.60 - 0.02)
  flow_top <- if (ancho) qr_bottom - gap else L$y_title
  flow_floor <- L$y_log_floor

  fixed_h <- function(b) {
    if (identical(b$type, "body")) {
      n <- length(b$lines %||% list())
      if (n == 0L) return(0)
      return(n * (type$section * 1.15 / 72) / geo$page_h + 0.012)
    }
    if (identical(b$type, "divider")) return(0.020)
    if (identical(b$type, "instructions")) {
      n <- length(b$lines %||% list())
      if (n == 0L) return(0)
      return(n * (type$body * 1.12 / 72) / geo$page_h + 0.010)
    }
    0
  }
  nat_h <- function(b) {
    if (identical(b$type, "field_grid")) {
      # Renglones, no campos: emparejados son la mitad, y pedir sitio para todos
      # dejaria media banda muerta debajo del ultimo.
      n <- length(.crf_emparejar(b$rows %||% list()))
      return(if (n > 1L) (n - 1L) * L$row_step else L$row_step * 0.6)
    }
    if (identical(b$type, "application_log")) {
      n <- as.integer(b$rows %||% 3L)
      return(if (n > 1L) (n - 1L) * L$log_row_step else L$log_row_step * 0.6)
    }
    0
  }

  n_items <- length(items)
  gap_total <- if (n_items > 1L) (n_items - 1L) * gap else 0
  fixed_total <- sum(vapply(items, fixed_h, numeric(1)))
  # `+ gap` aparte del enlace: `place_link()` siempre deja su propio gap de
  # salida (ver mas abajo), y ese gap no es uno de los `n_items - 1` que ya
  # cuenta `gap_total`. Sin este termino el presupuesto quedaba corto en
  # exactamente un gap y el registro de aplicacion se pasaba del piso de la
  # pagina, escribiendo encima del pie -medido con un render real, no a ojo.
  available <- max(0, (flow_top - flow_floor) - fixed_total - gap_total - link_h - gap)

  # **Se probó separar el grid del registro y NO se aplicó.**
  #
  # Los dos bloques elásticos se reparten el hueco en proporción a su alto
  # natural, así que con una hoja A4 para seis campos el `field_grid` estira sus
  # filas hasta 488 px: entre «Rol · Titular» y «Horario · 08:00-10:00» quedan
  # casi cien px de nada, con el QR compacto al lado. Medido sobre el PNG de una
  # ficha real.
  #
  # Dejar que el grid tome su alto natural y que el registro absorba el sobrante
  # lo compacta… y rompe `test-collection-render-ficha.R:271`, que defiende justo
  # lo contrario: «pocas filas reparten la banda en vez de dejar el hueco abajo».
  # Son dos criterios estéticos en tensión —campos apretados con aire al final,
  # o campos repartidos sin hueco— y el vigente está fijado con su test. No se
  # cambia sin que lo decida quien mira la ficha impresa.
  elastic <- Filter(function(b) b$type %in% c("field_grid", "application_log"), items)
  nat_sum <- sum(vapply(elastic, nat_h, numeric(1)))
  elastic_h <- list()
  for (b in elastic) {
    share <- if (nat_sum > 0) available * nat_h(b) / nat_sum else available / length(elastic)
    elastic_h[[b$block_id]] <- max(0, share)
  }

  grid_ids <- vapply(Filter(function(b) identical(b$type, "field_grid"), items), function(b) b$block_id, character(1))
  body_ids <- vapply(Filter(function(b) identical(b$type, "body"), items), function(b) b$block_id, character(1))
  link_after <- if (length(grid_ids)) grid_ids[[length(grid_ids)]] else if (length(body_ids)) body_ids[[1]] else NA_character_

  plan <- list()
  cursor <- flow_top
  place_link <- function() {
    right_edge <- if (cursor > qr_bottom) row_right else L$x_right
    plan[[length(plan) + 1L]] <<- list(
      block_id = ".link", type = "link", y_top = cursor, height = link_h, right_edge = right_edge
    )
    cursor <<- cursor - link_h - gap
  }
  if (is.na(link_after)) place_link()
  for (b in items) {
    h <- if (b$type %in% c("field_grid", "application_log")) elastic_h[[b$block_id]] %||% 0 else fixed_h(b)
    right_edge <- if (cursor > qr_bottom) row_right else L$x_right
    plan[[length(plan) + 1L]] <- list(
      block_id = b$block_id, type = b$type, y_top = cursor, height = h, right_edge = right_edge
    )
    cursor <- cursor - h - gap
    if (!is.na(link_after) && identical(b$block_id, link_after)) place_link()
  }
  list(items = plan, row_right = row_right, qr_bottom = qr_bottom)
}

# Ancho de linea proporcional al espacio real disponible. Los bloques de texto
# libre (`instructions`, el enlace) se calibraron a mano contra el ancho
# completo de la hoja; si el orden los deja en la banda angosta junto al QR
# hay que encoger el wrap en la misma proporcion o el texto invade el simbolo.
#' Agrupa los campos de la ficha en renglones de uno o dos.
#'
#' Emparejar por posicion —1 con 2, 3 con 4— es lo que hace el registro de
#' aplicacion, y ahi funciona porque todas sus casillas van vacias y miden lo
#' mismo. Aqui los campos traen valor, y «CHINCHAYAN BARRETO, RUTH ZARAGOZA»
#' son 33 caracteres: en media hoja se parte en dos lineas y el renglon de al
#' lado se queda con «53» y un palmo de blanco. Peor que no emparejar.
#'
#' Asi que empareja por ANCHO: dos campos comparten renglon solo si los dos
#' caben holgados en su mitad. El umbral son los caracteres que entran en media
#' hoja a cuerpo normal, con margen para no rozar la casilla vecina.
#'
#' @param rows lista de campos con `label` y `value`.
#' @param corto ancho maximo, en caracteres, de un valor que admite compañia.
#' @return lista de renglones; cada uno con uno o dos campos.
#' @keywords internal
.crf_emparejar <- function(rows, corto = 20L) {
  rows <- rows %||% list()
  cabe <- function(f) {
    # Un campo en blanco es una casilla para rellenar a mano: ocupa lo que le
    # den, asi que siempre admite compañia.
    if (isTRUE(f$blank)) return(TRUE)
    txt <- paste(as.character(f$lines %||% f$value %||% ""), collapse = " ")
    nchar(txt, type = "chars") <= corto
  }
  out <- list(); i <- 1L
  while (i <= length(rows)) {
    if (i < length(rows) && cabe(rows[[i]]) && cabe(rows[[i + 1L]])) {
      out[[length(out) + 1L]] <- list(rows[[i]], rows[[i + 1L]]); i <- i + 2L
    } else {
      out[[length(out) + 1L]] <- list(rows[[i]]); i <- i + 1L
    }
  }
  out
}

.crf_flow_chars <- function(right_edge, x_left, full_chars, full_span = 0.85) {
  span <- max(0.05, right_edge - x_left)
  max(14L, as.integer(round(full_chars * span / full_span)))
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
  qr <- .crf_block(page, "access_qr")
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
    # **Ni marco ni margen: el sitio del QR es del QR.**
    #
    # Habia DOS margenes sumandose sobre el mismo simbolo. Uno visible —un marco
    # blanco un 6% mayor con su filete— y otro que no se veia: la zona de
    # silencio viaja DENTRO de la matriz, cuatro modulos por lado, que con 41
    # modulos utiles son el 16% del lado. Entre los dos, el codigo ocupaba el
    # 79% de su hueco y el resto era aire con un borde dibujado alrededor.
    #
    # El filete no delimitaba nada que la hoja no delimite ya, y la zona de
    # silencio la da el blanco del papel. Fuera los dos: el simbolo llena su
    # sitio y crece un 26% de lado, un 59% de area, sin robarle un milimetro a
    # los datos. Esta ficha se escanea desde el fondo de un aula.
    payload <- .crf_txt(qr$value, "")
    if (nzchar(payload)) {
      qz <- qr$quiet_zone %||% 4L
      mm <- collection_qr_matrix(payload, correction = qr$correction %||% "M", quiet_zone = qz)
      grid::pushViewport(.crf_qr_viewport(
        L$qr_x, L$qr_y, .crf_qr_lado_total(L$qr_side, nrow(mm), qz, L$x_right - L$x_left), geo
      ))
      .crf_draw_qr_modules(mm)
      grid::popViewport()
    } else {
      grid::grid.text(
        "Sin enlace", x = L$qr_x, y = L$qr_y,
        gp = grid::gpar(col = tokens$faint, fontsize = type$body), default.units = "npc"
      )
    }
  }

  plan <- .crf_flow_plan(page$blocks, L, type, geo, payload = .crf_txt(page$access$qr_payload, ""))
  links <- list()
  payload <- .crf_txt(page$access$qr_payload, "")

  for (item in plan$items) {
    if (identical(item$type, "body")) {
      block <- .crf_block(page, "body")
      # **El ancho de envuelto sale del sitio que le toca, no de un 38 fijo.**
      #
      # Todos los bloques del flujo reciben un `right_edge` que se acorta cuando
      # caen a la altura del QR —`if (cursor > qr_bottom) row_right`—; este se
      # envolvia a 38 caracteres pasara lo que pasara. Con el QR pequeño no se
      # notaba porque 38 caracteres cabian de sobra; al agrandarlo, `row_right`
      # baja y el nombre del curso segui midiendo lo mismo: se metia DEBAJO del
      # codigo.
      #
      # Medido el 2026-08-23 con el payload largo del worker y `qr_side = 0.42`:
      # el verificador leia mal los modulos de las columnas 1 y 3 —el borde
      # IZQUIERDO del QR, justo por donde entra el texto—. Cinco hipotesis
      # anteriores fallaron por buscar la causa en el lector, en el marco o en
      # el borde de la pagina; estaba en quien dibuja al lado.
      chars <- .crf_flow_chars(item$right_edge, L$x_left, 38L)
      .crf_draw_lines(
        .crf_wrap(page$unit$course_name, chars, 3L),
        L$x_left, item$y_top, grid::gpar(col = tokens$navy, fontsize = type$section, fontface = "bold")
      )
    } else if (identical(item$type, "divider")) {
      pulso_pdf_hairline(L$x_left, item$right_edge, item$y_top - item$height * 0.5, tokens = tokens)
    } else if (identical(item$type, "field_grid")) {
      fields <- .crf_block(page, "field_grid")
      rows <- fields$rows %||% list()
      row_right <- item$right_edge
      band <- item$height
      # Capacidad real de la banda que le toco por orden. Una fila de mas no
      # se "aprieta" indefinidamente: por debajo de `row_step_min` se recorta
      # y se avisa, igual que antes.
      # **Dos campos por renglon, igual que el registro de mas abajo.**
      #
      # «Horario» son cuatro digitos y «Estudiantes» dos: puestos uno debajo de
      # otro gastaban un renglon entero cada uno para tres caracteres. Ahora los
      # renglones son pares y el que sobra —un numero impar de campos— cierra
      # solo a todo el ancho, que es donde va bien un nombre de docente largo.
      pares <- .crf_emparejar(rows)
      max_rows <- max(1L, as.integer(floor(band / L$row_step_min)) + 1L)
      if (length(pares) > max_rows) {
        warnings[[length(warnings) + 1L]] <- list(
          code = "field_grid_overflow", page = page_no,
          rows = length(rows), visible_rows = max_rows * 2L
        )
        pares <- pares[seq_len(max_rows)]
      }
      row_step <- if (length(pares) > 1L) min(L$row_step, band / (length(pares) - 1L)) else 0
      medio <- L$x_left + (row_right - L$x_left) / 2
      for (i in seq_along(pares)) {
        y <- item$y_top - (i - 1L) * row_step
        par_i <- pares[[i]]
        # Un campo solo en su renglon se queda con la hoja entera; dos la parten.
        arranques <- if (length(par_i) < 2L) L$x_left else c(L$x_left, medio + 0.012)
        topes <- if (length(par_i) < 2L) row_right else c(medio - 0.012, row_right)
        for (k in seq_along(par_i)) {
          campo <- par_i[[k]]
          grid::grid.text(
            .crf_txt(campo$label, "Dato"), x = arranques[[k]], y = y,
            just = "left", default.units = "npc",
            gp = grid::gpar(col = tokens$soft, fontsize = type$caption)
          )
          if (isTRUE(campo$blank)) {
            pulso_pdf_hairline(arranques[[k]] + L$label_w, topes[[k]], y - 0.004, tokens = tokens, lwd = 0.5)
            next
          }
          # El wrap se calibra al hueco real de la casilla, no a un 31 fijo: en
          # media hoja caben ~24 caracteres y en la hoja entera ~55.
          ancho_valor <- max(0.05, topes[[k]] - arranques[[k]] - L$label_w)
          .crf_draw_lines(
            campo$lines %||% .crf_wrap(campo$value, .crf_flow_chars(ancho_valor + L$x_left, L$x_left, 55L), 2L),
            arranques[[k]] + L$label_w, y + 0.008,
            grid::gpar(col = tokens$ink, fontsize = type$body), lineheight = 1.05
          )
        }
      }
    } else if (identical(item$type, "instructions")) {
      block <- .crf_block(page, "instructions")
      chars <- .crf_flow_chars(item$right_edge, L$x_left, 75L)
      lines <- if (identical(item$right_edge, L$x_right)) {
        block$lines %||% .crf_wrap(block$value, chars, 4L)
      } else {
        .crf_wrap(block$value, chars, block$max_lines %||% 4L)
      }
      .crf_draw_lines(
        lines, L$x_left, item$y_top,
        grid::gpar(col = tokens$soft, fontsize = type$body), lineheight = 1.12
      )
    } else if (identical(item$type, "application_log")) {
      log_block <- .crf_block(page, "application_log")
      rows_n <- as.integer(log_block$rows %||% 3L)
      grid::grid.text(
        .crf_txt(log_block$text, "Registro de aplicacion"), x = L$x_left, y = item$y_top,
        just = "left", default.units = "npc",
        gp = grid::gpar(col = tokens$navy, fontsize = type$caption, fontface = "bold")
      )
      y0 <- item$y_top - 0.028
      etiquetas <- as.character(unlist(log_block$labels %||% list(), use.names = FALSE))
      banda_log <- max(0, item$height - 0.028)
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
        # **Dos casillas por renglon cuando la etiqueta trae « | ».**
        #
        # El papel se llena a mano y las cantidades ocupan tres digitos: una
        # linea de doce centimetros para escribir «34» desperdicia el renglon,
        # y los renglones son el recurso escaso —el bloque admite seis—. Es lo
        # que ya hacia el generador anterior: «RECHAZOS: ___   N° DE MENORES:
        # ___» en la misma linea.
        partes <- if (con_etiqueta) trimws(strsplit(etiqueta, "|", fixed = TRUE)[[1]]) else ""
        partes <- partes[nzchar(partes)]
        if (length(partes) < 2L) {
          grid::grid.text(
            if (con_etiqueta) etiqueta else sprintf("%d", i),
            x = L$x_left, y = y, just = "left", default.units = "npc",
            gp = grid::gpar(col = if (con_etiqueta) tokens$soft else tokens$faint, fontsize = type$caption)
          )
          inicio <- if (con_etiqueta) L$x_left + L$log_label_w else L$x_left + 0.03
          pulso_pdf_hairline(inicio, item$right_edge, y - 0.006, tokens = tokens, lwd = 0.5)
        } else {
          medio <- L$x_left + (item$right_edge - L$x_left) / 2
          # La segunda columna arranca con un respiro para que las dos casillas
          # no se lean como una sola linea partida.
          arranques <- c(L$x_left, medio + 0.012)
          topes <- c(medio - 0.012, item$right_edge)
          for (k in seq_len(min(2L, length(partes)))) {
            grid::grid.text(
              partes[[k]], x = arranques[[k]], y = y, just = "left", default.units = "npc",
              gp = grid::gpar(col = tokens$soft, fontsize = type$caption)
            )
            pulso_pdf_hairline(
              arranques[[k]] + L$log_label_w * 0.72, topes[[k]], y - 0.006,
              tokens = tokens, lwd = 0.5
            )
          }
        }
      }
    } else if (identical(item$type, "link")) {
      # `item$y_top` es el punto mas alto que ocupa el bloque -igual que
      # cualquier otro item del flujo-, asi que todo se ancla HACIA ABAJO de
      # el. La version vieja dibujaba la regla y la etiqueta ARRIBA de su
      # anclaje (`y_link + 0.045`); eso invadia la banda del bloque anterior
      # en cuanto el anclaje dejo de ser una `y` fija con aire regalado encima.
      pulso_pdf_hairline(L$x_left, item$right_edge, item$y_top, tokens = tokens)
      grid::grid.text(
        "Enlace de la encuesta", x = L$x_left, y = item$y_top - 0.023,
        just = "left", default.units = "npc",
        gp = grid::gpar(col = tokens$soft, fontsize = type$caption)
      )
      link_size <- max(6.5, type$code - 0.5)
      chars <- .crf_flow_chars(item$right_edge, L$x_left, 92L)
      link_lines <- .crf_wrap(payload, width = chars, max_lines = 3L)
      if (!length(link_lines)) link_lines <- "Pendiente de generar"
      text_top <- item$y_top - 0.045
      .crf_draw_lines(
        link_lines, L$x_left, text_top,
        grid::gpar(col = tokens$navy, fontsize = link_size), lineheight = 1.05
      )
      if (nzchar(payload)) {
        link_h <- length(link_lines) * (link_size * 1.05 / 72) / geo$page_h
        links[[length(links) + 1L]] <- list(
          page = page_no, url = payload, kind = "printed_url",
          x0 = L$x_left, x1 = item$right_edge,
          y0 = text_top - link_h, y1 = text_top + 0.006
        )
      }
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
#' @param quiet_zone modulos de silencio por lado con los que se dibujo, para
#'   reconstruir el mismo lado que uso el dibujante.
#' @param layout_preset layout con el que se dibujo la pagina; decide donde
#'   buscar el simbolo. Releer un afiche con la geometria de la ficha devuelve
#'   ruido blanco, no un fallo, asi que el preset es parte de la pregunta.
#' @return matriz logica.
#' @export
collection_qr_matrix_from_png <- function(png_path, n, dpi = 150,
                                          layout_preset = c("single_sheet", "poster_qr", "field_form"),
                                          branded = FALSE, quiet_zone = 4L) {
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
  # El mismo lado que usa el dibujante, por la misma funcion. Antes esta linea
  # decia `L$qr_side * px_w` por su cuenta, y valia mientras la matriz entera
  # llenaba el hueco reservado; desde que la zona de silencio se derrama fuera,
  # asumirlo aqui leeria el simbolo desplazado.
  side_px <- .crf_qr_lado_total(L$qr_side, n, quiet_zone, L$x_right - L$x_left) * px_w
  cx <- L$qr_x * px_w
  cy <- (1 - L$qr_y) * px_h
  x0 <- cx - side_px / 2
  y0 <- cy - side_px / 2
  cell <- side_px / n
  out <- matrix(FALSE, nrow = n, ncol = n)
  # **Se promedia el nucleo del modulo, no se pincha un pixel.**
  #
  # Muestrear un solo punto hace que el bit lo decida un pixel, y ese pixel
  # puede caer en el borde suavizado que deja el antialiasing del device. Con
  # un QR de 149 modulos el modulo mide ~7 px, asi que medio pixel de deriva
  # basta para leer negro donde hay blanco: es lo que hacia que el mismo QR
  # leyera limpio dibujado aislado y con un modulo cambiado dentro de la ficha.
  #
  # El nucleo es el 50% central de la celda: deja fuera el borde y sigue siendo
  # un area, no un punto, aunque el modulo baje a tres pixeles.
  radio <- max(0, (cell * 0.25) - 0.5)
  for (r in seq_len(n)) {
    for (c in seq_len(n)) {
      cxm <- x0 + (c - 0.5) * cell
      cym <- y0 + (r - 0.5) * cell
      xs <- unique(pmax(1L, pmin(px_w, round(c(cxm - radio, cxm, cxm + radio)))))
      ys <- unique(pmax(1L, pmin(px_h, round(c(cym - radio, cym, cym + radio)))))
      out[r, c] <- mean(grey[ys, xs, drop = FALSE]) < 0.5
    }
  }
  out
}
