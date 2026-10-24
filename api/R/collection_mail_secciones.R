# collection_mail_secciones.R — el resto del catálogo de secciones (GOAL editor
# de correos profesional, L6; maquetas aprobadas SecPasos, SecFecha,
# SecBeneficios, SecCita, SecPreguntas y SecContacto).
#
#   steps    { title?, entries[1..6]{title, text?}, layout?, image_ref?, alt?, crop?, box? }
#   deadline { eyebrow?, title, text?, button_text?, url?, box? }
#   benefits { title?, entries[2..4]{title, text?, icon?}, box? }
#   quote    { text, name, role?, image_ref?, alt?, crop?, box? }
#   faq      { title?, entries[1..8]{title, text}, box? }
#   contact  { eyebrow?, name, role?, text?, email?, phone?, image_ref?, alt?, crop?, box? }
#
# **Ranuras compartidas.** Todas las secciones nombran igual lo que significa lo
# mismo (`title`, `text`, `eyebrow`, `entries`, `name`, `role`, `image_ref`,
# `alt`, `crop`, `button_text`, `url`): así «Cambiar por» (L8) pasa el contenido
# de una a otra sin traducirlo. Una entrada (`entries`) es {title, text, icon?}:
# un paso, un beneficio o una pregunta con su respuesta.
#
# **Sin acordeones ni fondos de imagen.** En un correo todo va abierto (las
# preguntas se leen enteras) y la fecha límite es una franja de color: con
# `box` (nace con el acento) se lee igual en Outlook, que no pinta fondos de
# imagen.
#
# **Guardado (L8).** «Cambiar por» pasa el contenido de ranura a ranura; lo
# que el destino no tiene queda en `guardado`, un objeto que el render ignora
# (y la revisión no lee: sus campos no cuentan como usados) y que el editor
# devuelve al regresar a la sección anterior. Sólo se valida su forma.
#
# **Fotos.** Pasos lleva una foto arriba (2:1 sin recorte declarado), Cita y
# Contacto un retrato de 96 px (1:1) redondo. El recorte es el de
# collection_mail_recorte.R; las esquinas redondas son CSS (Outlook las deja
# cuadradas hasta que se horneen, L13). Sin foto, Contacto muestra las iniciales.
#
# **Teléfono.** Los beneficios llevan la clase apilable (`.CMAIL_STACK_CLASS`):
# bajo 480 px se ponen uno debajo de otro. Los pasos a lo ancho se quedan a lo
# ancho también en el celular (pedido de Gonzalo, 2026-10-24): son cortos y su
# orden se lee de izquierda a derecha.

.CMAIL_SECTION_TYPES <- c("steps", "deadline", "benefits", "quote", "faq", "contact")
# Secciones que pueden llevar una foto con `image_ref` (y su recorte).
.CMAIL_PHOTO_TYPES <- c("feature", "steps", "quote", "contact")
.CMAIL_ENTRY_KEYS <- c("title", "text", "icon")
.CMAIL_ENTRIES_RANGE <- list(steps = c(1L, 6L), benefits = c(2L, 4L), faq = c(1L, 8L))
.CMAIL_PORTRAIT_PX <- 96L
.CMAIL_SECTION_PAD <- "8px 48px 20px 48px"
.CMAIL_EMAIL_RE <- "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"

# ---- validación ---------------------------------------------------------------

.CMAIL_GUARDADO_MAX_KEYS <- 40L

#' Lo guardado de una sección: un objeto con nombres, de tamaño acotado. Su
#' contenido no se valida (no se muestra); lo binario lo frena el guard común.
#' @keywords internal
.cmail_guardado_problems <- function(g, path) {
  if (!is.list(g) || (length(g) && is.null(names(g))) || any(!nzchar(names(g)))) {
    return(list(.cmail_problem(path, "bad_guardado", "guardado es un objeto con nombres.")))
  }
  if (length(g) > .CMAIL_GUARDADO_MAX_KEYS) {
    return(list(.cmail_problem(path, "bad_guardado", sprintf("guardado admite hasta %d claves.", .CMAIL_GUARDADO_MAX_KEYS))))
  }
  list()
}

.cmail_entries_of <- function(b) {
  e <- b$entries
  if (is.null(e) || !is.list(e)) return(list())
  Filter(is.list, e)
}

.cmail_entries_problems <- function(b, type, path, keys) {
  rango <- .CMAIL_ENTRIES_RANGE[[type]]
  e <- b$entries
  if (is.null(e) || !is.list(e) || (length(e) && !is.null(names(e)))) {
    return(list(.cmail_problem(paste0(path, ".entries"), "bad_entries", "entries es una lista de {title, text}.")))
  }
  out <- list()
  add <- function(x) out <<- c(out, x)
  if (length(e) < rango[[1]] || length(e) > rango[[2]]) {
    add(list(.cmail_problem(paste0(path, ".entries"), "entries_count",
                            sprintf("Esta sección lleva de %d a %d elementos.", rango[[1]], rango[[2]]))))
  }
  for (j in seq_along(e)) {
    p <- sprintf("%s.entries[%d]", path, j)
    x <- e[[j]]
    if (!is.list(x) || is.null(names(x))) {
      add(list(.cmail_problem(p, "bad_entry", "Cada elemento es {title, text}.")))
      next
    }
    for (k in setdiff(names(x), .CMAIL_ENTRY_KEYS)) {
      add(list(.cmail_problem(paste0(p, ".", k), "unknown_key", sprintf("`%s` no pertenece a un elemento.", k))))
    }
    add(.cmail_text_problems(x$title, paste0(p, ".title"), keys, required = TRUE))
    add(.cmail_link_problems(x$title, paste0(p, ".title"), keys, FALSE))
    # El texto es opcional en todas: una pregunta sin respuesta sale sola (así
    # «Cambiar por» desde Beneficios o Pasos no frena la vista previa).
    add(.cmail_text_problems(x$text, paste0(p, ".text"), keys))
    add(.cmail_link_problems(x$text, paste0(p, ".text"), keys, TRUE))
    if (!is.null(x$icon)) {
      icon <- .cmail_one(x$icon)
      if (!identical(type, "benefits")) {
        add(list(.cmail_problem(paste0(p, ".icon"), "unknown_key", "Sólo un beneficio lleva ícono.")))
      } else if (is.null(icon) || !(icon %in% .CMAIL_ICONS)) {
        add(list(.cmail_problem(paste0(p, ".icon"), "bad_icon", sprintf("El ícono es uno de: %s.", paste(.CMAIL_ICONS, collapse = ", ")))))
      }
    }
  }
  out
}

# Foto opcional de una sección: id válido, alt obligatorio y recorte.
.cmail_photo_problems <- function(b, path) {
  out <- list()
  if (!is.null(b$image_ref)) {
    if (!.cmail_image_id_ok(.cmail_one(b$image_ref) %||% NA_character_)) {
      out <- c(out, list(.cmail_problem(paste0(path, ".image_ref"), "bad_image_ref",
                                        "La imagen nombra un archivo del proyecto: a-z, 0-9 y guiones (sin _).")))
    }
    out <- c(out, .cmail_alt_problems(b$alt, paste0(path, ".alt")))
  }
  if (!is.null(b$crop)) out <- c(out, .cmail_crop_problems(b$crop, paste0(path, ".crop")))
  out
}

# Botón opcional: con texto pide su enlace; un enlace sin texto no se ve.
.cmail_section_button_problems <- function(b, path, keys) {
  button <- .cmail_one(b$button_text)
  if (!is.null(button) && nzchar(trimws(button))) {
    return(c(.cmail_text_problems(button, paste0(path, ".button_text"), keys), .cmail_url_problems(b$url, paste0(path, ".url"), keys)))
  }
  if (!is.null(b$url)) return(list(.cmail_problem(paste0(path, ".button_text"), "missing_button_text", "Un enlace necesita el texto de su botón.")))
  list()
}

#' Problemas de las secciones del catálogo (L6). Los enums (`layout` de Pasos)
#' los valida `.cmail_style_problems`; los enlaces de `text`, `title`… el bucle
#' común de collection_mail_template.R.
#' @keywords internal
.cmail_section_problems <- function(b, type, path, keys) {
  out <- list()
  add <- function(x) out <<- c(out, x)
  txt <- function(k, required = FALSE) add(.cmail_text_problems(b[[k]], paste0(path, ".", k), keys, required = required))
  switch(type,
    steps = { txt("title"); add(.cmail_entries_problems(b, type, path, keys)); add(.cmail_photo_problems(b, path)) },
    benefits = { txt("title"); add(.cmail_entries_problems(b, type, path, keys)) },
    faq = { txt("title"); add(.cmail_entries_problems(b, type, path, keys)) },
    deadline = { txt("eyebrow"); txt("title", TRUE); txt("text"); add(.cmail_section_button_problems(b, path, keys)) },
    quote = { txt("text", TRUE); txt("name", TRUE); txt("role"); add(.cmail_photo_problems(b, path)) },
    contact = {
      txt("eyebrow"); txt("name", TRUE); txt("role"); txt("text"); txt("phone")
      txt("email")
      email <- .cmail_one(b$email)
      # Un dato por llenar («[correo@dominio]») no es un correo mal escrito: lo cuenta la revisión de pendientes.
      por_llenar <- grepl("^\\[[^]]*\\]$", trimws(email %||% ""))
      if (!is.null(email) && nzchar(trimws(email)) && !por_llenar && !length(.cmail_tokens(email)) && !grepl(.CMAIL_EMAIL_RE, trimws(email), perl = TRUE)) {
        add(list(.cmail_problem(paste0(path, ".email"), "bad_email", "El correo de contacto tiene la forma nombre@dominio.")))
      }
      add(.cmail_photo_problems(b, path))
    }
  )
  out
}

# ---- fotos --------------------------------------------------------------------

# Ancho mostrado de la foto de una sección (para el render y la nitidez).
.cmail_photo_shown <- function(b, img, width = .CMAIL_WIDTH) {
  type <- .cmail_one(b$type) %||% ""
  if (identical(type, "feature")) return(.cmail_feature_shown(b, img, width))
  slot <- if (type %in% c("quote", "contact")) .CMAIL_PORTRAIT_PX else .cmail_text_col(width %||% .CMAIL_WIDTH)
  if (!.cmail_size_ok(img$size)) return(slot)
  as.integer(min(slot, as.integer(img$size$width)))
}

# La foto de una sección: la recortada (collection_mail_recorte.R) a su ancho,
# o el hueco de vista previa con su proporción. `round` la deja circular.
.cmail_section_photo <- function(b, ctx, round = FALSE) {
  id <- as.character(.cmail_one(b$image_ref) %||% "")
  elegida <- .cmail_feature_img(b, ctx)
  img <- elegida$img
  alt <- .cmail_one(b$alt) %||% ""
  size <- if (.cmail_size_ok(img$size)) img$size
          else if (!is.null(elegida$crop)) list(width = elegida$crop$r, height = 1)
          else list(width = 1, height = 1)
  fit <- .cmail_fit(size, .cmail_photo_shown(b, img, ctx$width))
  src <- .cmail_image_src(img, ctx)
  if (is.null(src)) return(.cmail_preview_hole(fit$width, fit$height, if (nzchar(alt)) alt else id, margin = ""))
  original <- if (isTRUE(ctx$marks) && !is.null(img$cropped_from)) ctx$images[[img$cropped_from]] else NULL
  osrc <- if (!is.null(original)) .cmail_image_src(original, ctx) else NULL
  sprintf('<img src="%s" width="%d" height="%d" alt="%s"%s%s style="display:block;width:%dpx;max-width:100%%;height:auto;border:0;outline:none;text-decoration:none;border-radius:%s;">',
          .cmail_esc(src), fit$width, fit$height, .cmail_esc(alt), .cmail_prop(ctx, "alt"),
          if (!is.null(osrc)) sprintf(' data-pulso-original="%s"', .cmail_esc(osrc)) else "",
          fit$width, if (round) "50%" else "8px")
}

.cmail_has_photo <- function(b) {
  id <- .cmail_one(b$image_ref)
  !is.null(id) && nzchar(id)
}

# ---- piezas de texto -------------------------------------------------------------

.cmail_sec_p <- function(text, ctx, prop, css, links = FALSE) {
  if (is.null(.cmail_one(text)) || !nzchar(trimws(.cmail_one(text)))) return("")
  sprintf('<p style="margin:0;font-family:%s;%s"%s>%s</p>', .CMAIL_FONT, css, .cmail_prop(ctx, prop), .cmail_inline(text, ctx, links = links))
}

.cmail_sec_title <- function(b, ctx, align = "left", margin = "0 0 18px 0") {
  t <- .cmail_one(b$title)
  if (is.null(t) || !nzchar(trimws(t))) return("")
  sprintf('<tr><td style="padding:%s;text-align:%s;"><p style="margin:0;font-family:%s;font-size:22px;line-height:28px;font-weight:bold;color:%s;"%s>%s</p></td></tr>',
          margin, align, .CMAIL_FONT, ctx$pal$callout_title, .cmail_prop(ctx, "title"), .cmail_inline(t, ctx))
}

.cmail_sec_eyebrow <- function(b, ctx, color = ctx$pal$callout_title) {
  .cmail_sec_p(b$eyebrow, ctx, "eyebrow", sprintf("font-size:12px;line-height:16px;letter-spacing:1.4px;text-transform:uppercase;font-weight:bold;color:%s;", color))
}

.cmail_entry_title <- function(x, ctx, j) {
  .cmail_sec_p(x$title, ctx, sprintf("entries.%d.title", j - 1L), sprintf("font-size:16px;line-height:22px;font-weight:bold;color:%s;", ctx$pal$callout_title))
}

.cmail_entry_text <- function(x, ctx, j, size = 14L) {
  .cmail_sec_p(x$text, ctx, sprintf("entries.%d.text", j - 1L), sprintf("padding-top:6px;font-size:%dpx;line-height:%dpx;color:%s;", size, round(size * 1.55), ctx$pal$text), links = TRUE)
}

# Número de un paso: círculo del color del botón (Outlook lo deja cuadrado).
.cmail_step_badge <- function(n, ctx) {
  pal <- ctx$pal
  sprintf('<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="32" height="32" align="center" valign="middle" bgcolor="%s" style="width:32px;height:32px;background-color:%s;border-radius:16px;font-family:%s;font-size:15px;line-height:32px;font-weight:bold;color:%s;mso-line-height-rule:exactly;">%d</td></tr></table>',
          pal$button_bg, pal$button_bg, .CMAIL_FONT, pal$button_fg, n)
}

# Columnas iguales; con `stack`, se apilan en teléfono.
.cmail_sec_columns <- function(cells, ctx, gap = 20L, stack = TRUE) {
  n <- length(cells)
  col <- .cmail_text_col(ctx$width %||% .CMAIL_WIDTH)
  w <- as.integer((col - gap * (n - 1L)) %/% n)
  tds <- vapply(seq_len(n), function(i) {
    pad <- if (i < n) sprintf("0 %dpx 0 0", gap) else "0"
    sprintf('<td%s width="%d" valign="top" style="width:%dpx;padding:%s;vertical-align:top;">%s</td>',
            if (stack) sprintf(' class="%s"', .CMAIL_STACK_CLASS) else "", w + if (i < n) gap else 0L, w, pad, cells[[i]])
  }, "")
  sprintf('<tr><td><table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0"><tr>%s</tr></table></td></tr>',
          paste(tds, collapse = ""))
}

# ---- render -------------------------------------------------------------------

.cmail_block_steps <- function(b, ctx) {
  e <- .cmail_entries_of(b)
  photo <- if (.cmail_has_photo(b)) sprintf('<tr><td style="padding:0 0 20px 0;line-height:0;font-size:0;">%s</td></tr>', .cmail_section_photo(b, ctx)) else ""
  # Más de tres pasos no caben a lo ancho: van en lista.
  lista <- identical(.cmail_style(b, "layout", "columnas"), "lista") || length(e) > 3L
  body <- if (lista) {
    paste(vapply(seq_along(e), function(j) {
      sprintf('<tr><td style="padding:0 0 %dpx 0;"><table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0"><tr><td width="48" valign="top" style="width:48px;vertical-align:top;">%s</td><td valign="top" style="vertical-align:top;padding-top:5px;">%s%s</td></tr></table></td></tr>',
              if (j < length(e)) 16L else 0L, .cmail_step_badge(j, ctx), .cmail_entry_title(e[[j]], ctx, j), .cmail_entry_text(e[[j]], ctx, j))
    }, ""), collapse = "")
  } else {
    .cmail_sec_columns(lapply(seq_along(e), function(j) {
      paste0('<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 0 10px 0;">',
             .cmail_step_badge(j, ctx), '</td></tr></table>', .cmail_entry_title(e[[j]], ctx, j), .cmail_entry_text(e[[j]], ctx, j))
    }), ctx, gap = 16L, stack = FALSE)
  }
  .cmail_column_table(paste0(photo, .cmail_sec_title(b, ctx), body), padding = .CMAIL_SECTION_PAD)
}

.cmail_block_benefits <- function(b, ctx) {
  e <- .cmail_entries_of(b)
  pal <- ctx$pal
  cells <- lapply(seq_along(e), function(j) {
    icon <- .cmail_one(e[[j]]$icon)
    icon_html <- ""
    if (!is.null(icon) && icon %in% .CMAIL_ICONS) {
      img <- .cmail_ctx_generated(ctx, .cmail_icon_id(icon, pal$bar), function() .cmail_icon_png(icon, pal$bar))
      src <- .cmail_image_src(img, ctx)
      # SurveyMonkey sin URL del ícono: se omite, el texto queda (como icon_text).
      if (!is.null(src) && nzchar(src)) icon_html <- sprintf(
        '<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td width="56" height="56" align="center" valign="middle" bgcolor="%s" style="width:56px;height:56px;background-color:%s;border-radius:14px;"><img src="%s" width="28" height="28" alt="" style="display:block;width:28px;height:28px;border:0;outline:none;text-decoration:none;"></td></tr></table><div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>',
        pal$panel_tint, pal$panel_tint, .cmail_esc(src))
    }
    sprintf('<div style="text-align:center;">%s%s%s</div>', icon_html, .cmail_entry_title(e[[j]], ctx, j), .cmail_entry_text(e[[j]], ctx, j))
  })
  .cmail_column_table(paste0(.cmail_sec_title(b, ctx, align = "center", margin = "0 0 22px 0"), .cmail_sec_columns(cells, ctx)),
                      padding = .CMAIL_SECTION_PAD)
}

.cmail_block_faq <- function(b, ctx) {
  e <- .cmail_entries_of(b)
  pal <- ctx$pal
  rows <- paste(vapply(seq_along(e), function(j) {
    sprintf('<tr><td style="padding:14px 0 14px 0;border-top:1px solid %s;">%s%s</td></tr>',
            pal$border, .cmail_entry_title(e[[j]], ctx, j), .cmail_entry_text(e[[j]], ctx, j, size = 15L))
  }, ""), collapse = "")
  .cmail_column_table(paste0(.cmail_sec_title(b, ctx, margin = "0 0 8px 0"), rows), padding = .CMAIL_SECTION_PAD)
}

.cmail_block_deadline <- function(b, ctx) {
  pal <- ctx$pal
  inner <- paste0(
    .cmail_sec_eyebrow(b, ctx, color = pal$muted),
    .cmail_sec_p(b$title, ctx, "title", sprintf("padding-top:8px;font-size:32px;line-height:38px;font-weight:bold;color:%s;", pal$callout_title)),
    .cmail_sec_p(b$text, ctx, "text", sprintf("padding-top:10px;font-size:15px;line-height:22px;color:%s;", pal$text)),
    if (nzchar(trimws(.cmail_one(b$button_text) %||% ""))) sprintf('<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:16px auto 0 auto;"><tr><td>%s</td></tr></table>',
                                                                     sub('style="margin-top:6px;"', "", .cmail_feature_button(b, ctx), fixed = TRUE)) else ""
  )
  .cmail_column_table(sprintf('<tr><td align="center" style="padding:16px 0 12px 0;text-align:center;">%s</td></tr>', inner), padding = .CMAIL_SECTION_PAD)
}

.cmail_sec_who <- function(b, ctx, name_size = 15L) {
  paste0(
    .cmail_sec_p(b$name, ctx, "name", sprintf("font-size:%dpx;line-height:%dpx;font-weight:bold;color:%s;", name_size, name_size + 6L, ctx$pal$callout_title)),
    .cmail_sec_p(b$role, ctx, "role", sprintf("padding-top:2px;font-size:13px;line-height:19px;color:%s;", ctx$pal$muted))
  )
}

.cmail_block_quote <- function(b, ctx) {
  pal <- ctx$pal
  text <- paste0(
    sprintf('<p style="margin:0;font-family:Georgia,\'Times New Roman\',serif;font-size:60px;line-height:44px;height:36px;color:%s;">&ldquo;</p>', pal$bar),
    # La segunda font-family (serif) pisa la del correo.
    .cmail_sec_p(b$text, ctx, "text", sprintf("font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:30px;color:%s;", pal$callout_title)),
    '<div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>',
    .cmail_sec_who(b, ctx)
  )
  if (!.cmail_has_photo(b)) return(.cmail_column_table(sprintf('<tr><td style="padding:12px 0 8px 0;">%s</td></tr>', text), padding = .CMAIL_SECTION_PAD))
  row <- sprintf('<tr><td><table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0"><tr><td class="%s" width="%d" valign="top" style="width:%dpx;padding:12px 24px 0 0;vertical-align:top;line-height:0;font-size:0;">%s</td><td class="%s" valign="top" style="vertical-align:top;padding-top:12px;">%s</td></tr></table></td></tr>',
                 .CMAIL_STACK_CLASS, .CMAIL_PORTRAIT_PX + 24L, .CMAIL_PORTRAIT_PX, .cmail_section_photo(b, ctx, round = TRUE),
                 .CMAIL_STACK_CLASS, text)
  .cmail_column_table(row, padding = .CMAIL_SECTION_PAD)
}

# Iniciales para Contacto sin foto: las dos primeras palabras; con un campo, nada.
.cmail_initials <- function(name) {
  name <- .cmail_one(name) %||% ""
  if (length(.cmail_tokens(name)) || !nzchar(trimws(name))) return("")
  # Sólo letras: un dato por llenar («[Quién responde]») no deja un corchete en el círculo.
  words <- strsplit(trimws(gsub("(*UCP)[^\\p{L}\\s]", "", enc2utf8(name), perl = TRUE)), "\\s+")[[1]]
  words <- words[nzchar(words)]
  toupper(paste(substr(utils::head(words, 2L), 1L, 1L), collapse = ""))
}

.cmail_block_contact <- function(b, ctx) {
  pal <- ctx$pal
  email <- trimws(.cmail_one(b$email) %||% "")
  lines <- paste0(
    if (nzchar(email)) sprintf('<a href="mailto:%s" style="color:%s;font-weight:bold;text-decoration:underline;"%s>%s</a>',
                               .cmail_esc(email), ctx$link %||% pal$callout_title, .cmail_prop(ctx, "email"), .cmail_inline(email, ctx)) else "",
    if (nzchar(email) && nzchar(trimws(.cmail_one(b$phone) %||% ""))) "<br>" else "",
    if (nzchar(trimws(.cmail_one(b$phone) %||% ""))) sprintf('<span%s>%s</span>', .cmail_prop(ctx, "phone"), .cmail_inline(b$phone, ctx)) else ""
  )
  text <- paste0(
    .cmail_sec_eyebrow(b, ctx),
    if (nzchar(trimws(.cmail_one(b$eyebrow) %||% ""))) '<div style="height:6px;line-height:6px;font-size:0;">&nbsp;</div>' else "",
    .cmail_sec_who(b, ctx, name_size = 19L),
    if (nzchar(lines)) sprintf('<p style="margin:0;padding-top:8px;font-family:%s;font-size:15px;line-height:23px;color:%s;">%s</p>', .CMAIL_FONT, pal$text, lines) else "",
    .cmail_sec_p(b$text, ctx, "text", sprintf("padding-top:4px;font-size:14px;line-height:21px;color:%s;", pal$muted), links = TRUE)
  )
  px <- .CMAIL_PORTRAIT_PX
  portrait <- if (.cmail_has_photo(b)) .cmail_section_photo(b, ctx, round = TRUE) else {
    ini <- .cmail_initials(b$name)
    if (!nzchar(ini)) "" else sprintf(
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="%d" height="%d" align="center" valign="middle" bgcolor="%s" style="width:%dpx;height:%dpx;background-color:%s;border-radius:%dpx;font-family:%s;font-size:32px;line-height:%dpx;font-weight:bold;color:%s;mso-line-height-rule:exactly;">%s</td></tr></table>',
      px, px, pal$button_bg, px, px, pal$button_bg, px %/% 2L, .CMAIL_FONT, px, pal$button_fg, .cmail_esc(ini))
  }
  row <- if (!nzchar(portrait)) sprintf('<tr><td style="padding:8px 0;">%s</td></tr>', text) else sprintf(
    '<tr><td><table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0"><tr><td class="%s" width="%d" valign="middle" style="width:%dpx;padding:8px 24px 8px 0;vertical-align:middle;line-height:0;font-size:0;">%s</td><td class="%s" valign="middle" style="vertical-align:middle;padding:8px 0;">%s</td></tr></table></td></tr>',
    .CMAIL_STACK_CLASS, px + 24L, px, portrait, .CMAIL_STACK_CLASS, text)
  .cmail_column_table(row, padding = .CMAIL_SECTION_PAD)
}

#' Render de una sección del catálogo (L6).
#' @keywords internal
.cmail_block_section <- function(b, type, ctx) {
  switch(type,
    steps = .cmail_block_steps(b, ctx),
    deadline = .cmail_block_deadline(b, ctx),
    benefits = .cmail_block_benefits(b, ctx),
    quote = .cmail_block_quote(b, ctx),
    faq = .cmail_block_faq(b, ctx),
    contact = .cmail_block_contact(b, ctx),
    ""
  )
}
