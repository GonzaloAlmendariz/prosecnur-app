# Layout `poster_qr` para materiales de Recopiladores (ADR 0046).
#
# La ficha de aplicacion resuelve una unidad por hoja: quien aplica necesita
# horario, salon y un registro donde anotar. El afiche resuelve lo contrario:
# una sola pieza que se pega o se reparte, donde lo unico que importa es que el
# QR se escanee de lejos y que la co-marca del estudio sea visible. Por eso no
# hereda la geometria de `single_sheet` ni su vocabulario de bloques.

.cra_layout <- function() {
  list(
    # El QR se lee con la misma aritmetica que `collection_qr_matrix_from_png`:
    # lado en npc del ANCHO de pagina, centro en npc. No cambiar sin actualizar
    # la relectura, que es lo unico que prueba que el simbolo salio escaneable.
    qr_side = 0.58,
    qr_x = 0.50,
    qr_y = 0.443,
    x_left = 0.075,
    x_right = 0.925,
    y_brand = 0.905,
    y_brand_rule = 0.858,
    y_title = 0.800,
    title_size = 19,
    title_lineheight = 1.18,
    # Separacion minima entre el bloque de titulo y la bajada. El titulo crece
    # hasta tres lineas, asi que la bajada no puede vivir en una `y` fija: con
    # un titulo largo se le montaba encima.
    body_gap = 0.026,
    y_instructions = 0.205,
    y_link_label = 0.143,
    y_link = 0.119,
    link_size = 7.3,
    link_lineheight = 1.05
  )
}

.cra_draw_centered <- function(lines, y, gp, lineheight = 1.15, x = 0.5) {
  if (!length(lines)) return(invisible(NULL))
  gp$lineheight <- lineheight
  grid::grid.text(
    paste(lines, collapse = "\n"), x = x, y = y, just = c("center", "top"),
    default.units = "npc", gp = gp
  )
  invisible(NULL)
}

#' Dibuja la banda de logos de la careta respetando el aspecto de cada PNG.
#'
#' @param asset_ids ids declarados por la plantilla, en orden.
#' @param brand_assets mapa efimero id -> ruta PNG.
#' @param y centro vertical de la banda en npc.
#' @param max_height_mm alto maximo por logo.
#' @param align left, center o right.
#' @param geo geometria de pagina.
#' @return ids que no se pudieron dibujar.
#' @keywords internal
.cra_draw_brand_strip <- function(asset_ids, brand_assets, y, max_height_mm = 14,
                                  align = "center", geo = pulso_pdf_geo("portrait")) {
  ids <- as.character(unlist(asset_ids %||% list(), use.names = FALSE))
  if (!length(ids)) return(character(0))
  has_png <- requireNamespace("png", quietly = TRUE)
  h_npc <- (as.numeric(max_height_mm) / 25.4) / geo$page_h

  # Primera pasada: leer y medir. Un logo apaisado y uno cuadrado con el mismo
  # alto ocupan anchos distintos, asi que el reparto horizontal solo se puede
  # calcular cuando ya se conocen todos los aspectos.
  drawn <- list()
  missing <- character(0)
  for (id in ids) {
    path <- if (is.list(brand_assets)) brand_assets[[id]] else NULL
    img <- if (has_png && .cc_is_scalar_string(path) && file.exists(path)) {
      tryCatch(png::readPNG(path), error = function(e) NULL)
    } else {
      NULL
    }
    if (is.null(img)) {
      missing <- c(missing, id)
      next
    }
    aspect <- dim(img)[2] / dim(img)[1]
    drawn[[length(drawn) + 1L]] <- list(
      img = img,
      w_npc = h_npc * aspect * (geo$page_h / geo$page_w)
    )
  }
  if (!length(drawn)) return(missing)

  gap <- 0.030
  total_w <- sum(vapply(drawn, function(x) x$w_npc, numeric(1))) + gap * (length(drawn) - 1L)
  x0 <- switch(align,
    left = 0.075,
    right = 0.925 - total_w,
    0.5 - total_w / 2
  )
  cursor <- x0
  for (item in drawn) {
    grid::grid.raster(
      item$img, x = grid::unit(cursor, "npc"), y = grid::unit(y, "npc"),
      just = c("left", "center"), interpolate = TRUE,
      width = grid::unit(item$w_npc, "npc"), height = grid::unit(h_npc, "npc")
    )
    cursor <- cursor + item$w_npc + gap
  }
  missing
}

# El afiche tiene un solo anclaje real: el QR centrado, que no es un bloque
# reordenable (moverlo del centro es un problema de colision, no de orden).
# Todo lo demas SI responde al orden: un bloque que en `page$blocks` aparece
# ANTES del `access_qr` se apila hacia arriba desde el QR; uno que aparece
# DESPUES se apila hacia abajo. Asi "subir Instrucciones por encima del
# Titulo" en el editor de verdad pone las instrucciones arriba del QR.
.cra_flow_plan <- function(blocks, L, geo) {
  flow_types <- c("heading", "body", "divider", "instructions")
  items <- Filter(function(b) b$type %in% flow_types, blocks %||% list())
  qr_index <- which(vapply(blocks %||% list(), function(b) identical(b$type, "access_qr"), logical(1)))
  qr_pos <- if (length(qr_index)) qr_index[[1]] else Inf
  item_index <- which(vapply(blocks %||% list(), function(b) b$type %in% flow_types, logical(1)))

  gap <- 0.020
  link_h <- 0.075
  qr_half_h <- (L$qr_side * geo$page_w) / geo$page_h / 2
  qr_top <- L$qr_y + qr_half_h
  qr_bottom <- L$qr_y - qr_half_h

  block_h <- function(b) {
    if (b$type %in% c("heading", "body")) {
      n <- length(b$lines %||% list())
      if (n == 0L) return(0)
      size <- if (identical(b$type, "heading")) L$title_size else 11
      lh <- if (identical(b$type, "heading")) L$title_lineheight else 1.2
      return(n * (size * lh / 72) / geo$page_h + 0.014)
    }
    if (identical(b$type, "divider")) return(0.022)
    if (identical(b$type, "instructions")) {
      n <- length(b$lines %||% list())
      if (n == 0L) return(0)
      return(n * (11 * 1.2 / 72) / geo$page_h + 0.012)
    }
    0
  }

  above <- items[item_index < qr_pos]
  below <- items[item_index > qr_pos]
  plan <- list()
  # Techo y piso: si alguien apila muchos bloques a un solo lado del QR (poco
  # comun, pero el editor ya no lo impide) esto evita que el flujo escriba
  # sobre la regla de cabecera o el pie en vez de desbordar silenciosamente.
  ceiling_y <- L$y_brand_rule - 0.03
  floor_y <- 0.10

  cursor <- qr_top + gap
  for (b in rev(above)) {
    h <- block_h(b)
    top_edge <- min(cursor + h, ceiling_y)
    plan[[length(plan) + 1L]] <- list(block_id = b$block_id, type = b$type, y_bottom = cursor, height = top_edge - cursor)
    cursor <- top_edge + gap
  }

  cursor <- qr_bottom - gap
  link_after <- if (length(below)) below[[length(below)]]$block_id else NA_character_
  place_link <- function() {
    plan[[length(plan) + 1L]] <<- list(block_id = ".link", type = "link", y_top = max(cursor, floor_y), height = link_h)
    cursor <<- max(cursor, floor_y) - link_h - gap
  }
  for (b in below) {
    h <- block_h(b)
    y_top <- max(cursor, floor_y)
    plan[[length(plan) + 1L]] <- list(block_id = b$block_id, type = b$type, y_top = y_top, height = h)
    cursor <- y_top - h - gap
    if (identical(b$block_id, link_after)) place_link()
  }
  if (is.na(link_after)) place_link()

  list(items = plan)
}

#' Dibuja una pagina compilada con el layout `poster_qr`.
#'
#' @param page pagina de `collection_material_compile`.
#' @param page_no numero visible.
#' @param total_pages total visible.
#' @param brand_assets mapa efimero id -> ruta PNG de los logos de la careta.
#' @return lista con `warnings` y `links` (rectangulos clicables en npc).
#' @export
collection_material_draw_poster <- function(page, page_no = 1L, total_pages = 1L,
                                            brand_assets = list()) {
  tokens <- pulso_pdf_tokens()
  type <- pulso_pdf_type()
  geo <- pulso_pdf_geo(page$orientation %||% "portrait")
  L <- .cra_layout()
  brand <- .crf_block(page, "brand_strip")
  qr <- .crf_block(page, "access_qr")
  footer <- .crf_block(page, "footer")
  warnings <- list()

  grid::grid.newpage()
  grid::grid.rect(gp = grid::gpar(fill = "#ffffff", col = NA))

  if (!is.null(brand)) {
    missing <- .cra_draw_brand_strip(
      brand$assets, brand_assets, y = L$y_brand,
      max_height_mm = brand$max_height_mm %||% 14,
      align = as.character(brand$align %||% "center")[[1]], geo = geo
    )
    for (id in missing) {
      warnings[[length(warnings) + 1L]] <- list(
        code = "brand_asset_missing", page = page_no, asset_id = id
      )
    }
  }
  pulso_pdf_hairline(L$x_left, L$x_right, L$y_brand_rule, tokens = tokens)

  payload <- .crf_txt(qr$value, "")
  if (!is.null(qr)) {
    if (nzchar(payload)) {
      grid::pushViewport(.crf_qr_viewport(L$qr_x, L$qr_y, L$qr_side, geo))
      .crf_draw_qr_modules(collection_qr_matrix(
        payload,
        correction = qr$correction %||% "M",
        quiet_zone = qr$quiet_zone %||% 4L
      ))
      grid::popViewport()
    } else {
      # Los otros dos presets (ficha, ficha_campo) pasan por un helper
      # compartido que avisa `access_missing` para cualquier bloque
      # `access_qr` sin valor; el afiche dibuja su QR a mano -no hereda ese
      # helper- y se habia quedado sin el aviso pese a mostrar "Sin enlace"
      # en el PDF. Sin esto, nada programatico distinguia un afiche completo
      # de uno que salio sin QR.
      warnings[[length(warnings) + 1L]] <- list(
        code = "access_missing", page = page_no, block_id = qr$block_id
      )
      grid::pushViewport(.crf_qr_viewport(L$qr_x, L$qr_y, L$qr_side, geo))
      grid::grid.rect(gp = grid::gpar(fill = NA, col = tokens$rule, lwd = 0.7))
      grid::grid.text(
        "Sin enlace", gp = grid::gpar(col = tokens$faint, fontsize = type$body)
      )
      grid::popViewport()
    }
  }

  plan <- .cra_flow_plan(page$blocks, L, geo)
  links <- list()

  for (item in plan$items) {
    if (identical(item$type, "heading")) {
      block <- .crf_block(page, "heading")
      lines <- block$lines %||% .crf_wrap(page$project$name, 35L, 3L)
      y <- item$y_bottom %||% item$y_top
      just_top <- !is.null(item$y_top)
      .cra_draw_centered(
        lines, if (just_top) y else y + length(lines) * (L$title_size * L$title_lineheight / 72) / geo$page_h,
        grid::gpar(col = tokens$navy, fontsize = L$title_size, fontface = "bold"),
        lineheight = L$title_lineheight
      )
    } else if (identical(item$type, "body")) {
      block <- .crf_block(page, "body")
      lines <- block$lines %||% character(0)
      y <- item$y_bottom %||% item$y_top
      just_top <- !is.null(item$y_top)
      .cra_draw_centered(
        lines, if (just_top) y else y + length(lines) * (11 * 1.2 / 72) / geo$page_h,
        grid::gpar(col = tokens$soft, fontsize = 11), lineheight = 1.2
      )
    } else if (identical(item$type, "divider")) {
      y <- if (!is.null(item$y_top)) item$y_top - item$height * 0.5 else item$y_bottom + item$height * 0.5
      pulso_pdf_hairline(L$x_left, L$x_right, y, tokens = tokens)
    } else if (identical(item$type, "instructions")) {
      block <- .crf_block(page, "instructions")
      lines <- block$lines %||% .crf_wrap(block$value, 72L, 3L)
      y <- item$y_bottom %||% item$y_top
      just_top <- !is.null(item$y_top)
      .cra_draw_centered(
        lines, if (just_top) y else y + length(lines) * (11 * 1.2 / 72) / geo$page_h,
        grid::gpar(col = tokens$ink, fontsize = 11), lineheight = 1.2
      )
    } else if (identical(item$type, "link")) {
      grid::grid.text(
        "Enlace de la encuesta", x = 0.5, y = item$y_top, just = c("center", "top"),
        default.units = "npc", gp = grid::gpar(col = tokens$soft, fontsize = type$caption)
      )
      link_lines <- .crf_wrap(payload, width = 92L, max_lines = 3L)
      if (!length(link_lines)) link_lines <- "Pendiente de generar"
      link_y <- item$y_top - 0.024
      .cra_draw_centered(
        link_lines, link_y,
        grid::gpar(col = tokens$navy, fontsize = L$link_size), lineheight = L$link_lineheight
      )
      if (nzchar(payload)) {
        link_h <- length(link_lines) * (L$link_size * L$link_lineheight / 72) / geo$page_h
        links[[length(links) + 1L]] <- list(
          page = page_no, url = payload, kind = "printed_url",
          x0 = L$x_left, x1 = L$x_right,
          y0 = link_y - link_h, y1 = link_y + 0.006
        )
      }
    }
  }

  period <- .crf_txt(footer$value %||% page$project$period, "")
  pulso_pdf_footer(page_no, periodo = period, tokens = tokens, geo = geo)
  list(warnings = warnings, links = links)
}

#' Plantilla built-in del afiche de acceso con careta de logos.
#'
#' @param assets ids de logo de la careta, en orden de izquierda a derecha.
#' @param instructions copy bajo el QR; sin URLs (las lleva el propio QR).
#' @param align alineacion de la careta.
#' @param max_height_mm alto maximo de cada logo.
#' @return `collection_material_template/v1` determinista.
#' @export
collection_material_poster_template <- function(assets,
                                                instructions = "Escanea el codigo con la camara de tu celular para responder la encuesta.",
                                                align = "center",
                                                max_height_mm = 14) {
  template <- list(
    schema = COLLECTION_MATERIAL_TEMPLATE_SCHEMA,
    template_id = "template-afiche-acceso-a4-v1",
    revision = 1L,
    preset_id = "afiche_qr_a4_v1",
    material_kind = "access_poster",
    compatible_adapters = list("aulas_v1", "kobo_existing_v1", "manual_links_v1"),
    page = list(size = "A4", orientation = "portrait"),
    pages = list(list(
      page_id = "afiche",
      layout_preset = "poster_qr",
      blocks = list(
        list(
          block_id = "careta", type = "brand_strip", assets = as.list(assets),
          align = align, max_height_mm = max_height_mm
        ),
        list(block_id = "titulo", type = "heading", binding = "project.name", max_lines = 3L),
        list(block_id = "bajada", type = "body", binding = "unit.course_name", max_lines = 2L),
        list(
          block_id = "qr", type = "access_qr", binding = "access.qr_payload",
          required = TRUE, correction = "M", quiet_zone = 4L, min_size_mm = 60
        ),
        list(block_id = "indicaciones", type = "instructions", text = instructions, max_lines = 3L),
        list(block_id = "footer", type = "footer", binding = "project.period")
      )
    )),
    brand_ref = "project-brand",
    sensitivity_policy = "operational"
  )
  template$template_sha256 <- .cm_template_sha256(template)
  template
}
