# Layout `field_form`: la ficha de papel que el aplicador lleva al aula.
#
# Reproduce la hoja que el equipo ya usaba en campo: el QR ocupa la mayor parte
# de la pagina — tiene que escanearse rapido, muchas veces, en un aula — y
# debajo va un formulario de lineas en mayusculas que se llena a mano.
#
# La diferencia de fondo con `single_sheet` no es estetica: alli los datos
# vienen impresos desde el plan; aqui casi ninguno existe antes de entrar al
# aula, asi que este layout no tiene grid de etiqueta/valor ni imprime el
# enlace. La UNICA excepcion deliberada es el total de alumnos matriculados
# (`campo(..., binding = "unit.eligible_n")` en
# `collection_material_field_form_rows()`): ese dato SI lo conoce el plan
# antes de imprimir, asi que se imprime en vez de dejarlo para copiar a mano.
# El resto sigue siendo espacio en blanco bien pautado.

.cfc_layout <- function() {
  list(
    qr_side = 0.68,
    qr_x = 0.50,
    qr_y = 0.669,
    x_left = 0.075,
    x_right = 0.925,
    y_brand = 0.955,
    # El titulo va centrado DEBAJO del QR: es el id del colector, o sea el
    # nombre de esta ficha concreta, y se lee junto al simbolo que lo codifica.
    y_title = 0.392,
    title_size = 16,
    form_top = 0.335,
    # 0.029, no 0.036: la hoja crecio de 7 a 9 renglones (matriculados y
    # observaciones nuevos) y el alto disponible (form_top-form_floor) no
    # cambio. Medido contra el PNG real, no solo la aritmetica: verificar con
    # `.cfx_grey()`/`test-collection-ficha-campo.R` si se vuelve a tocar.
    form_step = 0.029,
    form_floor = 0.100,
    label_size = 8.6,
    gap = 0.008,
    # El enlace impreso al pie no es decoracion: es el unico camino a la
    # encuesta cuando el QR no escanea — hoja mal impresa, manchada o doblada.
    # Una ficha cuyo unico portador del enlace es la imagen del QR es papel
    # muerto en cuanto esa imagen falla.
    y_link = 0.092,
    # 9 pt medidos, no elegidos a ojo: a este cuerpo la URL entera ocupa 0.743
    # de los 0.850 npc disponibles y no se parte en dos lineas. Es el respaldo
    # que alguien va a teclear a mano, asi que tiene que leerse.
    link_size = 9
  )
}

# Ancho real de un texto con su gpar, medido por el device en vez de estimado
# por conteo de caracteres: las etiquetas del formulario tienen largos muy
# distintos ("DOCENTE:" vs "N° DE ENCUESTAS APLICADAS:") y una estimacion
# desalinea todas las lineas del renglon.
.cfc_text_width <- function(text, gp) {
  grid::pushViewport(grid::viewport(gp = gp))
  on.exit(grid::popViewport(), add = TRUE)
  grid::convertWidth(grid::stringWidth(text), "npc", valueOnly = TRUE)
}

#' Dibuja el bloque de renglones para llenar a mano.
#'
#' @param rows renglones compilados; cada uno con `fields` de `label` y `span`.
#' @param L layout de la ficha de campo.
#' @param tokens paleta Pulso.
#' @return lista de warnings.
#' @keywords internal
.cfc_draw_form <- function(rows, L, tokens) {
  warnings <- list()
  width <- L$x_right - L$x_left
  gp <- grid::gpar(col = tokens$ink, fontsize = L$label_size, fontface = "bold")

  capacity <- max(1L, as.integer(floor((L$form_top - L$form_floor) / L$form_step)) + 1L)
  if (length(rows) > capacity) {
    warnings[[length(warnings) + 1L]] <- list(
      code = "form_lines_overflow", rows = length(rows), visible_rows = capacity
    )
    rows <- rows[seq_len(capacity)]
  }

  for (i in seq_along(rows)) {
    y <- L$form_top - (i - 1L) * L$form_step
    cells <- rows[[i]]$fields %||% list()
    cursor <- L$x_left
    for (cell in cells) {
      label <- toupper(.crf_txt(cell$label, ""))
      span <- as.numeric(cell$span %||% (1 / length(cells))) * width
      grid::grid.text(
        label, x = cursor, y = y, just = c("left", "bottom"),
        default.units = "npc", gp = gp
      )
      valor <- .crf_txt(cell$value, "")
      if (nzchar(valor)) {
        # Un dato que el plan YA conoce (ej. matriculados) se imprime en vez de
        # dejarse en blanco: copiarlo a mano es un paso de mas que puede fallar.
        # Sin raya -no es un campo para llenar- y en peso normal para
        # distinguirlo visualmente de la etiqueta en negrita.
        grid::grid.text(
          valor, x = cursor + .cfc_text_width(label, gp) + L$gap, y = y,
          just = c("left", "bottom"), default.units = "npc",
          gp = grid::gpar(col = tokens$ink, fontsize = L$label_size, fontface = "plain")
        )
      } else {
        rule_from <- cursor + .cfc_text_width(label, gp) + L$gap
        rule_to <- cursor + span - L$gap
        if (rule_to > rule_from) {
          grid::grid.lines(
            x = grid::unit(c(rule_from, rule_to), "npc"),
            y = grid::unit(y - 0.004, "npc"),
            gp = grid::gpar(col = tokens$ink, lwd = 0.7)
          )
        } else {
          # La etiqueta se comio su propio renglon: no hay donde escribir. Se
          # avisa en vez de dibujar una raya de un milimetro que nadie puede usar.
          warnings[[length(warnings) + 1L]] <- list(
            code = "form_field_no_room", label = label, row = i
          )
        }
      }
      cursor <- cursor + span
    }
  }
  warnings
}

#' Dibuja una pagina compilada con el layout `field_form`.
#'
#' @param page pagina de `collection_material_compile`.
#' @param page_no numero visible.
#' @param total_pages total visible.
#' @param brand_assets mapa efimero id -> ruta PNG de los logos de la careta.
#' @return lista con `warnings` y `links`.
#' @export
collection_material_draw_field_form <- function(page, page_no = 1L, total_pages = 1L,
                                                brand_assets = list()) {
  tokens <- pulso_pdf_tokens()
  type <- pulso_pdf_type()
  geo <- pulso_pdf_geo(page$orientation %||% "portrait")
  L <- .cfc_layout()
  brand <- .crf_block(page, "brand_strip")
  heading <- .crf_block(page, "heading")
  qr <- .crf_block(page, "access_qr")
  form <- .crf_block(page, "form_lines")
  footer <- .crf_block(page, "footer")
  warnings <- list()

  grid::grid.newpage()
  grid::grid.rect(gp = grid::gpar(fill = "#ffffff", col = NA))

  if (!is.null(brand)) {
    for (id in .cra_draw_brand_strip(
      brand$assets, brand_assets, y = L$y_brand,
      max_height_mm = brand$max_height_mm %||% 11,
      align = as.character(brand$align %||% "center")[[1]], geo = geo
    )) {
      warnings[[length(warnings) + 1L]] <- list(
        code = "brand_asset_missing", page = page_no, asset_id = id
      )
    }
  }

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
      grid::pushViewport(.crf_qr_viewport(L$qr_x, L$qr_y, L$qr_side, geo))
      grid::grid.rect(gp = grid::gpar(fill = NA, col = tokens$rule, lwd = 0.7))
      grid::grid.text("Sin enlace", gp = grid::gpar(col = tokens$faint, fontsize = type$body))
      grid::popViewport()
    }
  }

  if (!is.null(heading)) {
    titulo <- .crf_txt(heading$value, "")
    if (!nzchar(titulo)) {
      # El titulo es el id del colector. Si el acceso no lo trae, la hoja no
      # sabe como se llama: se cae al rotulo de la unidad y se avisa, en vez de
      # imprimir un hueco centrado bajo el QR.
      titulo <- .crf_txt(page$unit$label, "")
      warnings[[length(warnings) + 1L]] <- list(
        code = "sheet_title_missing", page = page_no
      )
    }
    .cra_draw_centered(
      .crf_wrap(titulo, 40L, 2L), L$y_title,
      grid::gpar(col = tokens$navy, fontsize = L$title_size, fontface = "bold"),
      lineheight = 1.15
    )
  }

  if (!is.null(form)) {
    for (w in .cfc_draw_form(form$rows %||% list(), L, tokens)) {
      w$page <- page_no
      warnings[[length(warnings) + 1L]] <- w
    }
  }

  links <- list()
  if (nzchar(payload)) {
    link_lines <- .crf_wrap(payload, width = 108L, max_lines = 2L)
    .cra_draw_centered(
      link_lines, L$y_link,
      grid::gpar(col = tokens$navy, fontsize = L$link_size), lineheight = 1.05
    )
    link_h <- length(link_lines) * (L$link_size * 1.05 / 72) / geo$page_h
    links[[1]] <- list(
      page = page_no, url = payload, kind = "printed_url",
      x0 = L$x_left, x1 = L$x_right,
      y0 = L$y_link - link_h, y1 = L$y_link + 0.006
    )
    # El QR tambien se clickea: en un PDF que viaja por WhatsApp o correo nadie
    # va a apuntar la camara a su propia pantalla.
    half_h <- (L$qr_side * geo$page_w / geo$page_h) / 2
    links[[2]] <- list(
      page = page_no, url = payload, kind = "qr_area",
      x0 = L$qr_x - L$qr_side / 2, x1 = L$qr_x + L$qr_side / 2,
      y0 = L$qr_y - half_h, y1 = L$qr_y + half_h
    )
  } else {
    warnings[[length(warnings) + 1L]] <- list(code = "access_missing", page = page_no)
  }

  # El centro del pie lleva el nombre del estudio: el periodo ya no identifica
  # nada util en una hoja que se reparte suelta por aula.
  pulso_pdf_footer(
    page_no, periodo = .crf_txt(footer$value %||% page$project$name, ""),
    tokens = tokens, geo = geo
  )
  list(warnings = warnings, links = links)
}

#' Renglones por defecto de la ficha de campo, calcados de la hoja en uso.
#'
#' @return lista de renglones para el bloque `form_lines`.
#' @export
collection_material_field_form_rows <- function() {
  fila <- function(...) list(fields = list(...))
  campo <- function(label, span, binding = NULL) list(label = label, span = span, binding = binding)
  list(
    fila(campo("Facultad", 0.55), campo("Pabellón y aula:", 0.45)),
    fila(campo("Curso:", 0.45), campo("Horario del curso:", 0.55)),
    fila(campo("Docente:", 1)),
    # Unico campo impreso, no en blanco: el plan YA sabe cuantos alumnos
    # matriculados tiene la unidad (`unit.eligible_n`) antes de imprimir la
    # ficha, asi que copiarlo a mano seria un paso de mas que puede fallar.
    # Ver la nota de `.cfc_layout()` sobre por que esta es la unica excepcion.
    fila(campo("N° de alumnos matriculados:", 1, binding = "unit.eligible_n")),
    fila(
      campo("N° de alumnos en aula", 0.28), campo("Hombres:", 0.20),
      campo("Mujeres:", 0.20), campo("Menores de edad:", 0.32)
    ),
    # Los cuatro numeros que el cuadre del parte comprueba —asistentes menos
    # rechazos menos duplicados igual efectivas— en una sola fila. El papel no
    # pedia los dos ultimos, asi que quien aplica en el aula no anotaba lo que
    # despues hay que meter en el Excel y en la app.
    fila(
      campo("N° de encuestas aplicadas:", 0.34), campo("Rechazos:", 0.18),
      campo("Ya respondieron:", 0.26), campo("Efectivas:", 0.22)
    ),
    fila(campo("Aplicador/a", 1)),
    fila(campo("Fecha:", 0.45), campo("Hora de aplicación:", 0.55)),
    # Espacio libre para lo que ninguna casilla previo: la hoja del equipo en
    # papel ya lo tenia y el formulario digital no.
    fila(campo("Observaciones:", 1))
  )
}

#' Plantilla built-in de la ficha de campo con QR grande.
#'
#' @param assets ids de logo de la careta; `NULL` para una hoja sin co-marca.
#' @param rows renglones del formulario; por defecto los de la hoja en uso.
#' @param title_binding que se imprime como titulo bajo el QR. Por defecto la
#'   etiqueta legible de la unidad (`unit.label`, campo obligatorio en
#'   `collection_plan/v1` para cualquier origen), que es como se llama cada
#'   ficha; `NULL` la deja sin titulo.
#'
#'   ANTES el default era `access.logical_collector_id`: para el origen
#'   legacy de aulas ese campo nunca lo pone nadie, asi que caia en el hash
#'   generado por `.collection_stable_id("logical", unit_id)` -algo como
#'   "logical-unit-aulas-aula-01-fd6e0ab1ee-4cd233a0cb"-, impreso como el
#'   elemento mas grande de la hoja que un encuestador sostiene en el aula.
#'   Los tests viejos no lo veian porque su fixture siempre ponia un
#'   `logical_collector_id` legible a mano.
#' @return `collection_material_template/v1` determinista.
#' @export
collection_material_field_sheet_template <- function(assets = NULL, rows = NULL,
                                                     title_binding = "unit.label") {
  blocks <- list()
  if (!is.null(assets)) {
    blocks <- c(blocks, list(list(
      block_id = "careta", type = "brand_strip", assets = as.list(assets),
      align = "center", max_height_mm = 11
    )))
  }
  if (!is.null(title_binding)) {
    blocks <- c(blocks, list(list(
      block_id = "titulo", type = "heading", binding = title_binding, max_lines = 2L
    )))
  }
  blocks <- c(blocks, list(
    list(
      block_id = "qr", type = "access_qr", binding = "access.qr_payload",
      required = TRUE, correction = "M", quiet_zone = 4L, min_size_mm = 70
    ),
    list(block_id = "registro", type = "form_lines", rows = rows %||% collection_material_field_form_rows()),
    list(block_id = "footer", type = "footer", binding = "project.name")
  ))
  template <- list(
    schema = COLLECTION_MATERIAL_TEMPLATE_SCHEMA,
    template_id = "template-ficha-campo-qr-a4-v1",
    revision = 1L,
    preset_id = "ficha_campo_qr_a4_v1",
    material_kind = "application_sheet",
    compatible_adapters = list("aulas_v1", "kobo_existing_v1", "manual_links_v1"),
    page = list(size = "A4", orientation = "portrait"),
    pages = list(list(page_id = "ficha", layout_preset = "field_form", blocks = blocks)),
    brand_ref = "project-brand",
    sensitivity_policy = "operational"
  )
  template$template_sha256 <- .cm_template_sha256(template)
  template
}
