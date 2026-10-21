# collection_mail_campana.R — estilo del correo: «sobrio» (tarjeta blanca sobre
# página gris, el render aprobado) y «campaña» (E1n: fondo de color a todo el
# ancho, columna de 600 px sin tarjeta, botón píldora y onda opcional al pie),
# más la alineación del texto, que vale para los dos.
#
# Tema (`collection_mail_template/v2`, ampliado sin cambio de esquema como
# `theme.band`; claves cerradas en `.CMAIL_THEME_KEYS`):
#   estilo      "sobrio" | "campana"              ausente = "sobrio"
#   page_bg     "#rrggbb"  solo campaña; defecto el acento
#   button_bg   "#rrggbb"  solo campaña; defecto #f9d53e (amarillo de la casa)
#   button_text "#rrggbb"  solo campaña; defecto el de más contraste entre #0b1f3a y #ffffff
#   text_align  "justify" | "left" | "center"     ambos estilos; defecto "justify"
#   onda        "ninguna" | "pie"                 solo campaña; defecto "ninguna"
#   onda_color  "#rrggbb"  solo campaña; defecto button_bg
# Las claves de campaña se aceptan con estilo sobrio (cambiar de estilo no las
# borra) y no tienen efecto.
#
# Campaña. Sin tarjeta: el cuerpo va sobre `page_bg`. El texto es blanco o el
# grafito de la casa, el de más contraste con `page_bg`; los enlaces del
# cuerpo, del color del texto y subrayados. El texto atenuado (tono suave,
# notas, firma y pie) es la mezcla más tenue del texto con el fondo que aún
# llega a 4,5:1. Recuadros: no hay rgba fiable en correo, así que el panel es un
# tono sólido (`page_bg` con 10 % del texto). Botón píldora (999px) bulletproof.
# Firma y pie centrados; el saludo y los títulos, centrados solo con
# `text_align = "center"`. La franja de cierre de la tarjeta no existe en
# campaña (no hay tarjeta): la reemplaza la onda, si se pide.
#
# Onda. PNG generado de 1200 × 80 (SVG no lo pintan los clientes): `page_bg`
# arriba, `onda_color` bajo una curva suave, con antialias. Va en el ZIP
# importable como una imagen más (`onda-pie.png`, ruta relativa) y en la vista
# previa incrustada. SurveyMonkey no aloja imágenes del HTML personalizado y la
# onda no tiene URL pública: ahí sale una banda sólida de `onda_color` de 24 px.
#
# Justificado. Párrafos, recuadros y listas van `text-align:justify` con
# `text-justify:inter-word` (salvo `align` explícito del bloque). En columnas
# angostas el justificado abre ríos: en teléfono (`max-width:480px`, el corte de
# Mailchimp y de la app de Gmail) una regla del `<head>` los baja a la izquierda
# por la clase `cmail-justify`. Saludo, botón, firma y pie nunca se justifican.
#
# Modo oscuro: no se fuerzan colores con media queries; el cliente invierte.

.CMAIL_ESTILOS <- c("sobrio", "campana")
.CMAIL_TEXT_ALIGNS <- c("justify", "left", "center")
.CMAIL_ONDAS <- c("ninguna", "pie")
.CMAIL_THEME_KEYS <- c("accent", "link", "band", "estilo", "page_bg", "button_bg", "button_text",
                       "text_align", "onda", "onda_color")
.CMAIL_CAMPANA_BUTTON_BG <- "#f9d53e"
.CMAIL_CAMPANA_BUTTON_INKS <- c("#0b1f3a", "#ffffff")
.CMAIL_CAMPANA_PANEL_MIX <- 0.10
.CMAIL_CAMPANA_BORDER_MIX <- 0.30
.CMAIL_CONTRAST_MIN <- 4.5
.CMAIL_CONTRAST_UI <- 3
.CMAIL_JUSTIFY_CLASS <- "cmail-justify"
.CMAIL_ONDA_ID <- "onda-pie"
.CMAIL_ONDA_W <- 1200L
.CMAIL_ONDA_H <- 80L
.CMAIL_ONDA_BAND_PX <- 24L
# Destino de los chequeos que se arreglan en Identidad (no son un bloque).
.CMAIL_IDENTITY_TARGET <- "__identidad"

.cmail_hex_ok <- function(x) is.character(x) && length(x) == 1L && !is.na(x) && grepl("^#[0-9a-fA-F]{6}$", x)

# ---- validación ---------------------------------------------------------------

#' Problemas de las claves de estilo del tema (las de acento, enlace y franja
#' las valida collection_mail_template.R).
#' @keywords internal
.cmail_theme_style_problems <- function(theme) {
  out <- list()
  add <- function(key, code, msg) out[[length(out) + 1L]] <<- .cmail_problem(paste0("template.theme.", key), code, msg)
  enum <- function(key, values, code, msg) {
    if (is.null(theme[[key]])) return(invisible())
    v <- .cmail_one(theme[[key]])
    if (is.null(v) || !(v %in% values)) add(key, code, msg)
  }
  enum("estilo", .CMAIL_ESTILOS, "bad_estilo", "El estilo del correo es sobrio o campana.")
  enum("text_align", .CMAIL_TEXT_ALIGNS, "bad_text_align", "La alineación del texto es justify, left o center.")
  enum("onda", .CMAIL_ONDAS, "bad_onda", "La onda es ninguna o pie.")
  for (k in c("page_bg", "button_bg", "button_text", "onda_color")) {
    if (!is.null(theme[[k]]) && !.cmail_hex_ok(.cmail_one(theme[[k]]))) add(k, "bad_color", sprintf("%s es #rrggbb.", k))
  }
  out
}

# ---- paleta -------------------------------------------------------------------

.cmail_mix <- function(fg, bg, w) .cmail_hex(as.integer(round(.cmail_rgb(fg) * w + .cmail_rgb(bg) * (1 - w))))

# El candidato de más contraste con `bg` (empate: el primero).
.cmail_best_ink <- function(bg, candidates) {
  ratios <- vapply(candidates, function(c) .cmail_contrast(c, bg), numeric(1))
  candidates[[which.max(ratios)]]
}

# La mezcla más tenue de `ink` con `bg` que llega a `min`; si ni la tinta pura
# llega, la tinta pura (el chequeo lo marca).
.cmail_soft_ink <- function(ink, bg, min = .CMAIL_CONTRAST_MIN) {
  for (w in seq(0.70, 0.95, by = 0.05)) {
    c <- .cmail_mix(ink, bg, w)
    if (.cmail_contrast(c, bg) >= min) return(c)
  }
  tolower(ink)
}

.cmail_theme_value <- function(theme, key, allowed = NULL) {
  v <- .cmail_one(theme[[key]])
  if (is.null(v) || (!is.null(allowed) && !(v %in% allowed))) return(NULL)
  if (is.null(allowed) && !.cmail_hex_ok(v)) return(NULL)
  if (is.null(allowed)) tolower(v) else v
}

#' Colores y alineaciones que usa el render. En sobrio son las constantes de
#' siempre (paridad); en campaña se calculan del tema.
#' @keywords internal
.cmail_theme_palette <- function(template, accent, link) {
  theme <- template$theme %||% list()
  estilo <- .cmail_theme_value(theme, "estilo", .CMAIL_ESTILOS) %||% "sobrio"
  text_align <- .cmail_theme_value(theme, "text_align", .CMAIL_TEXT_ALIGNS) %||% "justify"
  base <- list(
    estilo = estilo, campana = identical(estilo, "campana"), text_align = text_align,
    list_align = if (identical(text_align, "justify")) "justify" else "left",
    heading_align = if (identical(text_align, "center")) "center" else "left",
    greeting_align = "left", signature_align = "left"
  )
  if (!base$campana) {
    return(c(base, list(
      page_bg = .CMAIL_PAGE_BG, text = .CMAIL_TEXT_COLOR, muted = .CMAIL_MUTED, border = .CMAIL_BORDER,
      footer = .CMAIL_FOOTER_TEXT, link = link,
      panel_box = .cmail_tint(accent), panel_bar = "#f5f6f9", panel_tint = .cmail_tint(accent),
      bar = accent, callout_title = accent,
      button_bg = accent, button_fg = "#ffffff", button_radius = "6px",
      outline_bg = "#ffffff", outline_fg = accent, outline_border = accent,
      onda = "ninguna"
    )))
  }
  page_bg <- .cmail_theme_value(theme, "page_bg") %||% tolower(accent)
  text <- .cmail_best_ink(page_bg, c("#ffffff", .CMAIL_TEXT_COLOR))
  button_bg <- .cmail_theme_value(theme, "button_bg") %||% .CMAIL_CAMPANA_BUTTON_BG
  panel <- .cmail_mix(text, page_bg, .CMAIL_CAMPANA_PANEL_MIX)
  base$greeting_align <- if (identical(text_align, "center")) "center" else "left"
  base$signature_align <- "center"
  c(base, list(
    page_bg = page_bg, text = text, muted = .cmail_soft_ink(text, page_bg),
    border = .cmail_mix(text, page_bg, .CMAIL_CAMPANA_BORDER_MIX),
    footer = .cmail_soft_ink(text, page_bg), link = text,
    panel_box = panel, panel_bar = panel, panel_tint = panel,
    bar = button_bg, callout_title = text,
    button_bg = button_bg,
    button_fg = .cmail_theme_value(theme, "button_text") %||% .cmail_best_ink(button_bg, .CMAIL_CAMPANA_BUTTON_INKS),
    button_radius = "999px",
    outline_bg = page_bg, outline_fg = text, outline_border = button_bg,
    onda = .cmail_theme_value(theme, "onda", .CMAIL_ONDAS) %||% "ninguna",
    onda_color = .cmail_theme_value(theme, "onda_color") %||% button_bg
  ))
}

# `text-align` de una celda de texto; el justificado lleva su clase para que el
# teléfono lo baje a la izquierda.
.cmail_align_css <- function(align) {
  if (identical(align, "justify")) {
    return(list(attr = sprintf(' class="%s"', .CMAIL_JUSTIFY_CLASS), css = "text-align:justify;text-justify:inter-word;"))
  }
  list(attr = "", css = sprintf("text-align:%s;", align))
}

# Regla del `<head>`: solo si el cuerpo justifica algo.
.cmail_justify_style <- function(body) {
  if (!grepl(sprintf('class="%s"', .CMAIL_JUSTIFY_CLASS), body, fixed = TRUE)) return("")
  sprintf('<style type="text/css">@media only screen and (max-width:480px){.%s{text-align:left !important;}}</style>',
          .CMAIL_JUSTIFY_CLASS)
}

# ---- onda ---------------------------------------------------------------------

#' PNG de la onda (1200 × 80). Determinista por sus dos colores: se guarda en
#' una caché temporal del proceso y se reutiliza.
#' @keywords internal
.cmail_onda_png <- function(page_bg, onda_color) {
  dir <- file.path(tempdir(), "prosecnur-cmail-onda")
  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  path <- file.path(dir, sprintf("onda-%s-%s.png", sub("^#", "", tolower(page_bg)), sub("^#", "", tolower(onda_color))))
  if (file.exists(path)) return(path)
  w <- .CMAIL_ONDA_W; h <- .CMAIL_ONDA_H
  x <- (seq_len(w) - 0.5) / w
  # Curva: dos crestas suaves, entre 22 y 58 px desde arriba.
  edge <- 40 + 14 * sin(2 * pi * x * 1.5 + 0.9) + 4 * sin(2 * pi * x * 3.2)
  rows <- matrix(seq_len(h) - 1, nrow = h, ncol = w)
  cover <- pmin(1, pmax(0, rows + 1 - matrix(edge, nrow = h, ncol = w, byrow = TRUE)))
  top <- .cmail_rgb(page_bg) / 255
  bottom <- .cmail_rgb(onda_color) / 255
  img <- array(0, dim = c(h, w, 3L))
  for (ch in 1:3) img[, , ch] <- top[[ch]] * (1 - cover) + bottom[[ch]] * cover
  tmp <- tempfile("onda-", tmpdir = dir, fileext = ".png")
  png::writePNG(img, tmp)
  file.rename(tmp, path)
  path
}

#' La onda como imagen resuelta (la usa `.cmail_images_resolve`), o NULL si el
#' tema no la pide. `generated = TRUE`: no es del autor, no lleva alt ni URL.
#' @keywords internal
.cmail_onda_image <- function(template) {
  pal <- .cmail_theme_palette(template, .cmail_one(template$theme$accent) %||% .CMAIL_DEFAULT_ACCENT, NULL)
  if (!isTRUE(pal$campana) || !identical(pal$onda, "pie")) return(NULL)
  path <- .cmail_onda_png(pal$page_bg, pal$onda_color)
  list(id = .CMAIL_ONDA_ID, path = path, type = "png",
       size = list(width = .CMAIL_ONDA_W, height = .CMAIL_ONDA_H),
       bytes = as.numeric(file.info(path)$size), url = NULL, alt = "",
       export_name = paste0(.CMAIL_ONDA_ID, ".png"), generated = TRUE)
}

# Fila de la onda, a todo el ancho de la página. Imagen en Mailchimp y en la
# vista previa; banda sólida en SurveyMonkey o si la imagen no está.
.cmail_onda_html <- function(ctx) {
  pal <- ctx$pal
  if (!isTRUE(pal$campana) || !identical(pal$onda, "pie")) return("")
  img <- ctx$images[[.CMAIL_ONDA_ID]]
  src <- if (!is.null(img) && !identical(ctx$dialect, "surveymonkey")) .cmail_image_src(img, ctx)
  if (is.null(src) || !nzchar(src)) {
    return(sprintf('<tr><td bgcolor="%s" style="background-color:%s;height:%dpx;line-height:%dpx;font-size:0;">&nbsp;</td></tr>',
                   pal$onda_color, pal$onda_color, .CMAIL_ONDA_BAND_PX, .CMAIL_ONDA_BAND_PX))
  }
  sprintf('<tr><td style="padding:0;line-height:0;font-size:0;"><img src="%s" width="%d" alt="" style="display:block;border:0;outline:none;text-decoration:none;width:100%%;height:auto;"></td></tr>',
          .cmail_esc(src), .CMAIL_WIDTH)
}

# ---- revisión -------------------------------------------------------------------

.cmail_identity_target <- function(prop) .cmail_target(.CMAIL_IDENTITY_TARGET, prop)

#' Chequeos de contraste del estilo campaña (nada con estilo sobrio).
#' `campana_text_contrast`, `campana_button_contrast`, `campana_footer_contrast`.
#' @keywords internal
.cmail_campana_checks <- function(tpl, push) {
  accent <- .cmail_one(tpl$theme$accent) %||% .CMAIL_DEFAULT_ACCENT
  pal <- .cmail_theme_palette(tpl, accent, accent)
  if (!isTRUE(pal$campana)) return(push)
  r2 <- function(x) round(x, 2)
  fmt <- function(x) formatC(x, format = "f", digits = 2, decimal.mark = ",")

  has_callout <- any(vapply(tpl$blocks %||% list(), function(b) identical(b$type, "callout"), NA))
  text_ratio <- r2(min(.cmail_contrast(pal$text, pal$page_bg), if (has_callout) .cmail_contrast(pal$text, pal$panel_box) else Inf))
  push(if (text_ratio < .CMAIL_CONTRAST_MIN) {
    .cmail_check("campana_text_contrast", "error", text_ratio,
                 sprintf("El texto sobre el fondo %s tiene contraste %s:1 (mínimo 4,5:1): ni blanco ni grafito se leen bien sobre un tono medio. Elige en Identidad un fondo de página más oscuro o más claro.",
                         pal$page_bg, fmt(text_ratio)),
                 targets = list(.cmail_identity_target("page_bg")))
  } else {
    .cmail_check("campana_text_contrast", "ok", text_ratio,
                 sprintf("El texto %s sobre el fondo %s se lee bien: %s:1.", pal$text, pal$page_bg, fmt(text_ratio)))
  })

  buttons <- Filter(function(b) identical(b$type, "button"), tpl$blocks %||% list())
  if (length(buttons)) {
    btn_targets <- c(list(.cmail_identity_target("button_bg")),
                     lapply(buttons, function(b) .cmail_target(as.character(b$block_id))))
    ink <- r2(.cmail_contrast(pal$button_fg, pal$button_bg))
    edge <- r2(.cmail_contrast(pal$button_bg, pal$page_bg))
    push(if (ink < .CMAIL_CONTRAST_MIN) {
      .cmail_check("campana_button_contrast", "error", ink,
                   sprintf("El texto del botón (%s) sobre su relleno %s tiene contraste %s:1 (mínimo 4,5:1). En Identidad elige otro relleno o deja el color del texto en automático.",
                           pal$button_fg, pal$button_bg, fmt(ink)),
                   targets = btn_targets)
    } else if (edge < .CMAIL_CONTRAST_UI) {
      .cmail_check("campana_button_contrast", "warning", edge,
                   sprintf("El botón %s se distingue poco del fondo %s (%s:1; se recomienda 3:1): elige en Identidad un relleno que resalte sobre la página.",
                           pal$button_bg, pal$page_bg, fmt(edge)),
                   targets = btn_targets)
    } else {
      .cmail_check("campana_button_contrast", "ok", ink,
                   sprintf("El botón se lee (%s:1) y resalta sobre la página (%s:1).", fmt(ink), fmt(edge)))
    }
    )
  }

  foot <- r2(.cmail_contrast(pal$footer, pal$page_bg))
  push(if (foot < .CMAIL_CONTRAST_MIN) {
    .cmail_check("campana_footer_contrast", "error", foot,
                 sprintf("El pie legal sobre el fondo %s tiene contraste %s:1 (mínimo 4,5:1): la dirección y la baja deben leerse. Elige en Identidad un fondo de página más oscuro o más claro.",
                         pal$page_bg, fmt(foot)),
                 targets = list(.cmail_identity_target("page_bg")))
  } else {
    .cmail_check("campana_footer_contrast", "ok", foot, sprintf("El pie legal se lee sobre el fondo: %s:1.", fmt(foot)))
  })
  push
}
