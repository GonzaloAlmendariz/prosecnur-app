# collection_mail_template.R — la plantilla de correo de Material de campo
# (ADR 0110 §2, etapa E1f: «Correos: componer aquí, enviar en Mailchimp»).
#
# Un correo es un material de la familia «va al participante» con canal
# digital. La app lo COMPONE; el envío masivo se hace en Mailchimp (ADR 0046 no
# convierte el módulo en herramienta de emailing).
#
# Contrato `collection_mail_template/v2` (E1g; la lectura acepta v1 y la sube
# sin cambiar el contenido, en `.cmail_template_normalize`):
#
#   schema, template_id, preset_id, revision, template_sha256,
#   subject, preheader,
#   theme  = { accent: "#rrggbb", link?: "#rrggbb", band?: "acento"|"suave",
#              estilo?, page_bg?, button_bg?, button_text?, text_align?, onda?, onda_color? },
#            (las de E1n: collection_mail_campana.R)
#   header = { kind: "logos", logo_ids: [..], background: "dark"|"light" }
#          | { kind: "banner", image_ref: "<id>" },
#   images = { <image_id>: { alt, url? } },   # url pública opcional (https)
#   fields = [ { key, tag, label, fallback?, sm?, destino? } ],   # sm: etiqueta SurveyMonkey (E1j)
#   blocks = [ { block_id, type, ... } ]      # registro CERRADO
#   greeting.trato = { modo, columna?, masculino, femenino, respaldo, sm? }   # collection_mail_trato.R
#
# Estilos: solo las enumeraciones de collection_mail_styles.R (`size`, `tone`,
# `fill`, `level`, `style`, `variant`, `align`). Enlaces `[texto](url)` solo en
# las propiedades de `.CMAIL_LINK_PROPS`. Ids de imagen sin `_` (Mailchimp).
#
# **Registro cerrado.** Solo existen los tipos de `.CMAIL_BLOCK_KEYS` y cada uno
# admite solo sus claves. El texto es texto: nunca HTML. Las únicas marcas son
# `**negrita**`, `*cursiva*` y `***ambas***` (con `\*` para un asterisco
# literal; regla en collection_mail_marks.R) y los campos `{{clave}}`. Un `<b>` o un `*|TAG|*` crudo se
# rechazan: el render es el único que escribe HTML y etiquetas de Mailchimp, y
# así el escape no depende de que el autor lo recuerde.
#
# **Campos de combinación.** `{{nombre}}` es reservado y siempre va a
# `*|FNAME|*`. Los campos del estudio declaran su etiqueta de Mailchimp: A-Z,
# 0-9 y `_`, de 1 a 10 caracteres (el tope de Mailchimp), y nunca una etiqueta
# reservada del sistema (EMAIL, FNAME, LNAME, ADDRESS, PHONE, UNSUB, LIST, MC_*).
# Para SurveyMonkey (E1j) cada campo puede declarar `sm`: SurveyLink, LastName o
# CustomData1..50, única entre campos; `{{nombre}}` va siempre a [FirstName] y
# [Email] no se admite (sería un dato personal en el texto). Ninguna etiqueta de
# SurveyMonkey se escribe a mano en un texto (`raw_platform_tag`).
# `destino` (encuesta | otro) dice adónde lleva un campo de enlace: uno que NO
# es la encuesta (una sala virtual, un formulario aparte) no puede ser
# [SurveyLink] (`sm_destination_mismatch`): el correo llevaría a la persona a
# otro sitio que el que promete su texto (revisión metodológica E1jkl).
#
# **v2 ampliada sin cambio de esquema** (E1j): `fields[].sm` y `theme.band` son
# opcionales y se suman a la v2 porque la v2 aún no se publicó (ADR 0110).
#
# **Ids reservados.** Los `block_id` que empiezan con `__` son de la app (la
# apertura de un envío, `__apertura`): una plantilla del usuario no los usa.
#
# **Persistencia.** Cada plantilla (sin destinatarios) vive dentro de su campaña
# en `collection_state$mail_campaigns` (E1h, collection_mail_campaigns.R), con
# revisión optimista global; el `mail_template` singular de antes se migra al
# leer. Los destinatarios NO: ver collection_mail_recipients.R.

COLLECTION_MAIL_TEMPLATE_SCHEMA <- "collection_mail_template/v2"
COLLECTION_MAIL_TEMPLATE_SCHEMA_V1 <- "collection_mail_template/v1"

# `box`: estilo propio del bloque (collection_mail_box.R); el pie legal no lo admite.
.CMAIL_BLOCK_KEYS <- list(
  greeting     = c("text", "fallback", "trato", "box"),
  heading      = c("text", "level", "align", "box"),
  paragraph    = c("text", "align", "size", "tone", "box"),
  button       = c("text", "url", "note", "align", "size", "fill", "box"),
  callout      = c("title", "items", "variant", "box"),
  list         = c("items", "ordered", "box"),
  divider      = c("style", "size", "box"),
  image        = c("image_ref", "alt", "width", "align", "url", "bleed", "decorative", "box"),
  signature    = c("closing", "name", "lines", "url", "box"),
  footer_legal = c("text", "address"),
  # Piezas gráficas (E1o): collection_mail_piezas.R.
  band         = c("color", "height", "box"),
  ornament     = c("style", "color", "box"),
  icon_text    = c("icon", "text", "box"),
  two_images   = c("left", "right", "alt_left", "alt_right", "box"),
  # Secciones (GOAL editor profesional): collection_mail_destacado.R.
  feature      = c("eyebrow", "title", "text", "image_ref", "alt", "button_text", "url", "layout", "box")
)

.CMAIL_RESERVED_TAGS <- c("EMAIL", "FNAME", "LNAME", "ADDRESS", "PHONE", "UNSUB", "LIST")
.CMAIL_RESERVED_KEYS <- c("nombre", "email", "correo")
.CMAIL_MAX_BLOCKS <- 40L
.CMAIL_MAX_TEXT <- 4000L
.CMAIL_TOKEN_RE <- "\\{\\{\\s*([a-z][a-z0-9_]*)\\s*\\}\\}"
.CMAIL_DEFAULT_ACCENT <- "#0b1f54"

# ---- utilidades ---------------------------------------------------------------

.cmail_one <- function(x) {
  if (is.list(x) && length(x) == 1L && !is.list(x[[1]])) x <- x[[1]]
  if (!is.character(x) || length(x) != 1L || is.na(x)) return(NULL)
  x
}

.cmail_strings <- function(x) {
  if (is.null(x)) return(list())
  if (is.character(x)) return(as.list(x))
  if (!is.list(x)) return(NULL)
  ok <- vapply(x, function(v) is.character(v) && length(v) == 1L && !is.na(v), logical(1))
  if (!all(ok)) return(NULL)
  unname(lapply(x, function(v) v))
}

.cmail_problem <- function(path, code, detail) list(path = path, code = code, detail = detail)

.cmail_tokens <- function(text) {
  if (!is.character(text) || !length(text)) return(character(0))
  m <- regmatches(text, gregexpr(.CMAIL_TOKEN_RE, text, perl = TRUE))[[1]]
  unique(sub(.CMAIL_TOKEN_RE, "\\1", m, perl = TRUE))
}

.cmail_tag_ok <- function(tag) {
  is.character(tag) && length(tag) == 1L && !is.na(tag) &&
    grepl("^[A-Z0-9_]{1,10}$", tag) &&
    !(tag %in% .CMAIL_RESERVED_TAGS) && !startsWith(tag, "MC_")
}

.cmail_slug_ok <- function(x, max = 60L) {
  is.character(x) && length(x) == 1L && !is.na(x) &&
    grepl(sprintf("^[a-z0-9][a-z0-9_-]{0,%d}$", max - 1L), x)
}

# Un texto de usuario. Devuelve los problemas; `keys` son los campos declarados.
.cmail_text_problems <- function(text, path, keys, required = FALSE) {
  if (is.null(text)) {
    if (required) return(list(.cmail_problem(path, "missing_text", "Falta el texto.")))
    return(list())
  }
  value <- .cmail_one(text)
  if (is.null(value)) return(list(.cmail_problem(path, "not_text", "Debe ser un texto.")))
  out <- list()
  if (required && !nzchar(trimws(value))) {
    out[[length(out) + 1L]] <- .cmail_problem(path, "missing_text", "Falta el texto.")
  }
  if (nchar(value) > .CMAIL_MAX_TEXT) {
    out[[length(out) + 1L]] <- .cmail_problem(path, "text_too_long", sprintf("Supera %d caracteres.", .CMAIL_MAX_TEXT))
  }
  if (grepl("<\\s*/?\\s*[A-Za-z!?]", value, perl = TRUE) || grepl("&[A-Za-z#][A-Za-z0-9]*;", value, perl = TRUE)) {
    out[[length(out) + 1L]] <- .cmail_problem(
      path, "html_not_allowed",
      "El texto no admite HTML. Usa **negrita**, *cursiva* y {{campo}}; el formato lo pone la plantilla."
    )
  }
  if (grepl("*|", value, fixed = TRUE) || grepl("|*", value, fixed = TRUE)) {
    out[[length(out) + 1L]] <- .cmail_problem(
      path, "raw_merge_tag",
      "Las etiquetas de Mailchimp se escriben como {{campo}}; la app las traduce."
    )
  }
  if (grepl(.CMAIL_PLATFORM_TAG_RE, value, perl = TRUE)) {
    out[[length(out) + 1L]] <- .cmail_problem(
      path, "raw_platform_tag",
      "Las etiquetas de SurveyMonkey ([SurveyLink], [FirstName]…) se escriben como {{campo}}; la app las traduce."
    )
  }
  rest <- gsub(.CMAIL_TOKEN_RE, "", value, perl = TRUE)
  if (grepl("{{", rest, fixed = TRUE) || grepl("}}", rest, fixed = TRUE)) {
    out[[length(out) + 1L]] <- .cmail_problem(path, "bad_token", "Un campo se escribe {{clave}} en minúsculas.")
  }
  unknown <- setdiff(.cmail_tokens(value), c("nombre", keys))
  for (k in unknown) {
    out[[length(out) + 1L]] <- .cmail_problem(path, "unknown_field", sprintf("{{%s}} no es un campo declarado.", k))
  }
  out
}

# Enlace: http(s)/mailto literal, con campos opcionales, o un campo solo.
.cmail_url_problems <- function(url, path, keys, required = TRUE) {
  value <- .cmail_one(url)
  if (is.null(value) || !nzchar(trimws(value))) {
    if (!required && is.null(url)) return(list())
    return(list(.cmail_problem(path, "missing_url", "Falta el enlace.")))
  }
  out <- .cmail_text_problems(value, path, keys)
  only_token <- grepl(sprintf("^\\s*%s\\s*$", .CMAIL_TOKEN_RE), value, perl = TRUE)
  literal <- gsub(.CMAIL_TOKEN_RE, "x", value, perl = TRUE)
  if (!only_token) {
    if (!grepl("^(https?://|mailto:)[^\\s\"'<>]+$", literal, perl = TRUE)) {
      out[[length(out) + 1L]] <- .cmail_problem(
        path, "bad_url", "El enlace debe empezar con https://, http:// o mailto:, o ser un campo como {{enlace}}."
      )
    }
  }
  out
}

# ---- normalización ------------------------------------------------------------

.cmail_template_normalize <- function(template, revision = NULL) {
  if (!is.list(template)) return(template)
  t <- template
  # v1 sube a v2 sin tocar el contenido; otro esquema queda tal cual y lo
  # rechaza la validación (`bad_schema`).
  if (is.null(t$schema) || identical(t$schema, COLLECTION_MAIL_TEMPLATE_SCHEMA_V1)) t$schema <- COLLECTION_MAIL_TEMPLATE_SCHEMA
  if (!is.null(revision)) t$revision <- as.integer(revision)
  t$revision <- as.integer(.cmail_one(as.character(t$revision %||% 1L)) %||% 1L)
  if (is.list(t$header)) {
    if (!is.null(t$header$logo_ids)) t$header$logo_ids <- .cmail_strings(t$header$logo_ids) %||% t$header$logo_ids
  }
  t$fields <- if (is.null(t$fields)) list() else unname(t$fields)
  t$blocks <- if (is.null(t$blocks)) list() else unname(t$blocks)
  t$blocks <- lapply(t$blocks, function(b) {
    if (!is.list(b)) return(b)
    for (k in c("items", "lines", "note")) {
      if (!is.null(b[[k]])) b[[k]] <- .cmail_strings(b[[k]]) %||% b[[k]]
    }
    if (!is.null(b$ordered)) b$ordered <- isTRUE(unlist(b$ordered))
    # Saludo por sexo (collection_mail_trato.R): las palabras que falten, las de siempre.
    if (identical(b$type, "greeting") && !is.null(b$trato)) b$trato <- .cmail_trato_normalize(b$trato)
    for (k in c("bleed", "decorative")) {
      if (!is.null(b[[k]]) && length(unlist(b[[k]])) == 1L && is.logical(unlist(b[[k]]))) b[[k]] <- isTRUE(unlist(b[[k]]))
    }
    if (!is.null(b$width) && length(unlist(b$width)) == 1L && is.numeric(unlist(b$width))) {
      w <- unlist(b$width)
      if (!is.na(w) && w == round(w)) b$width <- as.integer(w)
    }
    b
  })
  if (is.null(t$images) || (is.list(t$images) && !length(t$images))) {
    t$images <- structure(list(), names = character(0))
  }
  t$images <- .cmail_trae_logos_normalize(t$images)
  t <- .cmc_drop_nulls_deep(t)
  t$template_sha256 <- NULL
  t$template_sha256 <- collection_fingerprint(t)
  t
}

# Lo que define el correo, sin revisión ni huella: para detectar un PUT sin cambios.
.cmail_template_material <- function(t) {
  t$revision <- NULL
  t$template_sha256 <- NULL
  t
}

# ---- validación ---------------------------------------------------------------

#' Valida una plantilla `collection_mail_template/v2` contra el registro cerrado.
#'
#' @param template lista.
#' @param allow_reserved_ids admite `block_id` que empiezan con `__` (solo la
#'   plantilla efectiva de un envío, collection_mail_sends.R).
#' @return list(ok, problems).
#' @keywords internal
collection_mail_template_validate <- function(template, allow_reserved_ids = FALSE) {
  if (!is.list(template)) {
    return(list(ok = FALSE, problems = list(.cmail_problem("template", "not_object", "La plantilla debe ser un objeto."))))
  }
  p <- list()
  add <- function(x) p <<- c(p, x)
  if (!identical(template$schema, COLLECTION_MAIL_TEMPLATE_SCHEMA)) {
    add(list(.cmail_problem("template.schema", "bad_schema", sprintf("Se esperaba '%s'.", COLLECTION_MAIL_TEMPLATE_SCHEMA))))
  }
  known_top <- c("schema", "template_id", "preset_id", "title", "revision", "template_sha256",
                 "subject", "preheader", "theme", "header", "images", "fields", "blocks")
  for (k in setdiff(names(template), known_top)) {
    add(list(.cmail_problem(paste0("template.", k), "unknown_key", sprintf("`%s` no pertenece al contrato.", k))))
  }
  if (!.cmail_slug_ok(.cmail_one(template$template_id) %||% NA_character_)) {
    add(list(.cmail_problem("template.template_id", "bad_id", "template_id debe ser un id en minúsculas.")))
  }

  # Campos del estudio.
  fields <- template$fields %||% list()
  keys <- character(0)
  tags <- character(0)
  sms <- character(0)
  if (!is.list(fields)) {
    add(list(.cmail_problem("template.fields", "not_list", "fields debe ser una lista.")))
    fields <- list()
  }
  for (i in seq_along(fields)) {
    f <- fields[[i]]
    path <- sprintf("template.fields[%d]", i)
    if (!is.list(f)) { add(list(.cmail_problem(path, "not_object", "Cada campo es un objeto."))); next }
    for (k in setdiff(names(f), c("key", "tag", "label", "fallback", "sm", "destino"))) {
      add(list(.cmail_problem(paste0(path, ".", k), "unknown_key", sprintf("`%s` no pertenece a un campo.", k))))
    }
    key <- .cmail_one(f$key)
    tag <- .cmail_one(f$tag)
    if (is.null(key) || !grepl("^[a-z][a-z0-9_]{0,29}$", key)) {
      add(list(.cmail_problem(paste0(path, ".key"), "bad_key", "La clave va en minúsculas: a-z, 0-9 y _.")))
    } else if (key %in% .CMAIL_RESERVED_KEYS) {
      add(list(.cmail_problem(paste0(path, ".key"), "reserved_key", sprintf("{{%s}} es reservado.", key))))
    } else if (key %in% keys) {
      add(list(.cmail_problem(paste0(path, ".key"), "duplicate_key", sprintf("{{%s}} está repetido.", key))))
    } else {
      keys <- c(keys, key)
    }
    if (is.null(tag) || !grepl("^[A-Z0-9_]{1,10}$", tag)) {
      add(list(.cmail_problem(paste0(path, ".tag"), "bad_tag",
        "La etiqueta de Mailchimp usa A-Z, 0-9 y _, de 1 a 10 caracteres.")))
    } else if (!.cmail_tag_ok(tag)) {
      add(list(.cmail_problem(paste0(path, ".tag"), "reserved_tag", sprintf("*|%s|* es una etiqueta reservada de Mailchimp.", tag))))
    } else if (tag %in% tags) {
      add(list(.cmail_problem(paste0(path, ".tag"), "duplicate_tag", sprintf("*|%s|* está repetida.", tag))))
    } else {
      tags <- c(tags, tag)
    }
    if (!is.null(f$sm)) {
      sm <- .cmail_one(f$sm)
      if (is.null(sm) || !grepl(.CMAIL_SM_FIELD_RE, sm)) {
        add(list(.cmail_problem(paste0(path, ".sm"), "bad_sm",
          "La etiqueta de SurveyMonkey es SurveyLink, LastName o CustomData1 a CustomData50.")))
      } else if (identical(sm, "SurveyLink") && identical(.cmail_one(f$destino), "otro")) {
        add(list(.cmail_problem(paste0(path, ".sm"), "sm_destination_mismatch",
          "Este enlace no lleva a la encuesta: no puede ser [SurveyLink]. Si el correo no lleva a la encuesta, SurveyMonkey no es su plataforma.")))
      } else if (sm %in% sms) {
        add(list(.cmail_problem(paste0(path, ".sm"), "duplicate_sm", sprintf("[%s] está repetida.", sm))))
      } else {
        sms <- c(sms, sm)
      }
    }
    if (!is.null(f$destino) && !(.cmail_one(f$destino) %||% "") %in% c("encuesta", "otro")) {
      add(list(.cmail_problem(paste0(path, ".destino"), "bad_destino", "destino es encuesta u otro.")))
    }
    add(.cmail_text_problems(f$label, paste0(path, ".label"), character(0), required = TRUE))
    add(.cmail_text_problems(f$fallback, paste0(path, ".fallback"), character(0)))
  }

  add(.cmail_text_problems(template$subject %||% "", "template.subject", keys))
  add(.cmail_text_problems(template$preheader %||% "", "template.preheader", keys))
  add(.cmail_link_problems(template$subject, "template.subject", keys, FALSE))
  add(.cmail_link_problems(template$preheader, "template.preheader", keys, FALSE))

  theme <- template$theme
  if (!is.null(theme)) {
    accent <- .cmail_one(theme$accent)
    if (!is.list(theme) || is.null(accent) || !grepl("^#[0-9a-fA-F]{6}$", accent)) {
      add(list(.cmail_problem("template.theme.accent", "bad_color", "El color de acento es #rrggbb.")))
    }
    if (is.list(theme)) {
      for (k in setdiff(names(theme), .CMAIL_THEME_KEYS)) {
        add(list(.cmail_problem(paste0("template.theme.", k), "unknown_key", sprintf("`%s` no pertenece al tema.", k))))
      }
      if (!is.null(theme$link) && !grepl("^#[0-9a-fA-F]{6}$", .cmail_one(theme$link) %||% "")) {
        add(list(.cmail_problem("template.theme.link", "bad_color", "El color de enlace es #rrggbb.")))
      }
      if (!is.null(theme$band) && !(.cmail_one(theme$band) %||% "") %in% c("acento", "suave")) {
        add(list(.cmail_problem("template.theme.band", "bad_band", "La franja de cierre es acento o suave.")))
      }
      # Estilo, alineación y onda (E1n): collection_mail_campana.R.
      add(.cmail_theme_style_problems(theme))
    }
  }

  images <- template$images %||% list()
  if (!is.list(images)) {
    add(list(.cmail_problem("template.images", "not_object", "images es un mapa id -> {alt, url}.")))
    images <- list()
  }
  for (id in names(images)) {
    img <- images[[id]]
    path <- paste0("template.images.", id)
    if (!.cmail_image_id_ok(id)) add(list(.cmail_problem(path, "bad_id", "Id de imagen: a-z, 0-9 y guiones (sin _).")))
    if (!is.list(img)) { add(list(.cmail_problem(path, "not_object", "Cada imagen es {alt, url}."))); next }
    for (k in setdiff(names(img), c("alt", "url", "trae_logos"))) {
      add(list(.cmail_problem(paste0(path, ".", k), "unknown_key", sprintf("`%s` no pertenece a una imagen.", k))))
    }
    # El banner trae los logos (collection_mail_trae_logos.R).
    add(.cmail_trae_logos_problems(img, path))
    add(.cmail_text_problems(img$alt, paste0(path, ".alt"), character(0)))
    if (!is.null(img$url)) {
      u <- .cmail_one(img$url)
      if (is.null(u) || !grepl("^https://[^\\s\"'<>]+$", u, perl = TRUE)) {
        add(list(.cmail_problem(paste0(path, ".url"), "bad_image_url",
          "La URL de una imagen alojada empieza con https:// (nunca data:).")))
      }
    }
  }

  header <- template$header
  if (!is.list(header)) {
    add(list(.cmail_problem("template.header", "missing_header", "Falta la cabecera.")))
  } else {
    kind <- .cmail_one(header$kind)
    if (identical(kind, "logos")) {
      for (k in setdiff(names(header), c("kind", "logo_ids", "background"))) {
        add(list(.cmail_problem(paste0("template.header.", k), "unknown_key", sprintf("`%s` no pertenece a la cabecera.", k))))
      }
      ids <- .cmail_strings(header$logo_ids)
      if (is.null(ids) || !length(ids) || length(ids) > 6L ||
          !all(vapply(ids, .cmail_image_id_ok, logical(1)))) {
        add(list(.cmail_problem("template.header.logo_ids", "bad_logos", "La franja lleva de 1 a 6 logos del proyecto.")))
      }
      bg <- .cmail_one(header$background %||% "light")
      if (is.null(bg) || !(bg %in% c("dark", "light"))) {
        add(list(.cmail_problem("template.header.background", "bad_background", "El fondo es dark o light.")))
      }
    } else if (identical(kind, "banner")) {
      for (k in setdiff(names(header), c("kind", "image_ref"))) {
        add(list(.cmail_problem(paste0("template.header.", k), "unknown_key", sprintf("`%s` no pertenece a la cabecera.", k))))
      }
      if (!.cmail_image_id_ok(.cmail_one(header$image_ref) %||% NA_character_)) {
        add(list(.cmail_problem("template.header.image_ref", "bad_image_ref", "El banner nombra una imagen del proyecto.")))
      }
    } else {
      add(list(.cmail_problem("template.header.kind", "bad_header_kind", "La cabecera es logos o banner.")))
    }
  }

  blocks <- template$blocks %||% list()
  if (!is.list(blocks) || !length(blocks)) {
    add(list(.cmail_problem("template.blocks", "no_blocks", "El correo necesita al menos un bloque.")))
    blocks <- list()
  }
  if (length(blocks) > .CMAIL_MAX_BLOCKS) {
    add(list(.cmail_problem("template.blocks", "too_many_blocks", sprintf("Máximo %d bloques.", .CMAIL_MAX_BLOCKS))))
  }
  ids <- character(0)
  for (i in seq_along(blocks)) {
    b <- blocks[[i]]
    path <- sprintf("template.blocks[%d]", i)
    if (!is.list(b)) { add(list(.cmail_problem(path, "not_object", "Cada bloque es un objeto."))); next }
    type <- .cmail_one(b$type)
    if (is.null(type) || !(type %in% names(.CMAIL_BLOCK_KEYS))) {
      add(list(.cmail_problem(paste0(path, ".type"), "unknown_block_type",
        sprintf("Tipo de bloque fuera del registro. Use: %s.", paste(names(.CMAIL_BLOCK_KEYS), collapse = ", ")))))
      next
    }
    bid <- .cmail_one(b$block_id)
    if (is.null(bid) || !grepl("^[a-z0-9_-]{1,40}$", bid)) {
      add(list(.cmail_problem(paste0(path, ".block_id"), "bad_block_id", "block_id en minúsculas, hasta 40 caracteres.")))
    } else if (startsWith(bid, "__") && !isTRUE(allow_reserved_ids)) {
      add(list(.cmail_problem(paste0(path, ".block_id"), "reserved_block_id",
        "Los block_id que empiezan con __ son de la app (p. ej. la apertura de un envío).")))
    } else if (bid %in% ids) {
      add(list(.cmail_problem(paste0(path, ".block_id"), "duplicate_block_id", sprintf("block_id '%s' repetido.", bid))))
    } else {
      ids <- c(ids, bid)
    }
    for (k in setdiff(names(b), c("block_id", "type", .CMAIL_BLOCK_KEYS[[type]]))) {
      add(list(.cmail_problem(paste0(path, ".", k), "unknown_key", sprintf("`%s` no pertenece al bloque %s.", k, type))))
    }
    list_problems <- function(field, required) {
      items <- .cmail_strings(b[[field]])
      if (is.null(items)) return(list(.cmail_problem(paste0(path, ".", field), "not_list", "Debe ser una lista de textos.")))
      if (required && !length(items)) return(list(.cmail_problem(paste0(path, ".", field), "empty_list", "La lista necesita al menos un elemento.")))
      allowed <- .cmail_link_allowed(type, field)
      unlist(lapply(seq_along(items), function(j) {
        p <- sprintf("%s.%s[%d]", path, field, j)
        c(.cmail_text_problems(items[[j]], p, keys, required = TRUE), .cmail_link_problems(items[[j]], p, keys, allowed))
      }), recursive = FALSE)
    }
    # Enlaces del texto: válidos donde se permiten, prohibidos en el resto.
    for (k in intersect(names(b), c("text", "title", "fallback", "closing", "name", "address", "alt", "alt_left", "alt_right",
                                    "eyebrow", "button_text"))) {
      add(.cmail_link_problems(b[[k]], paste0(path, ".", k), keys, .cmail_link_allowed(type, k)))
    }
    add(.cmail_style_problems(b, type, path))
    if (!is.null(b$box)) add(.cmail_box_problems(b$box, paste0(path, ".box")))
    switch(type,
      greeting = {
        add(.cmail_text_problems(b$text, paste0(path, ".text"), keys, required = TRUE))
        add(.cmail_text_problems(b$fallback, paste0(path, ".fallback"), character(0)))
        if (length(.cmail_tokens(.cmail_one(b$text) %||% "")) && is.null(.cmail_one(b$fallback))) {
          add(list(.cmail_problem(paste0(path, ".fallback"), "missing_fallback",
            "Un saludo con campo necesita su texto de respaldo para quien no tiene el dato.")))
        }
        if (!is.null(b$trato)) add(.cmail_trato_problems(b$trato, paste0(path, ".trato"), fields))
      },
      paragraph = add(.cmail_text_problems(b$text, paste0(path, ".text"), keys, required = TRUE)),
      heading = add(.cmail_text_problems(b$text, paste0(path, ".text"), keys, required = TRUE)),
      divider = NULL,
      image = add(.cmail_image_block_problems(b, path, keys)),
      button = {
        add(.cmail_text_problems(b$text, paste0(path, ".text"), keys, required = TRUE))
        add(.cmail_url_problems(b$url, paste0(path, ".url"), keys))
        if (!is.null(b$note)) add(list_problems("note", FALSE))
      },
      callout = {
        add(.cmail_text_problems(b$title, paste0(path, ".title"), keys))
        add(list_problems("items", TRUE))
      },
      list = {
        add(list_problems("items", TRUE))
        if (!is.null(b$ordered) && !is.logical(unlist(b$ordered))) {
          add(list(.cmail_problem(paste0(path, ".ordered"), "bad_flag", "ordered es verdadero o falso.")))
        }
      },
      signature = {
        add(.cmail_text_problems(b$closing, paste0(path, ".closing"), keys))
        add(.cmail_text_problems(b$name, paste0(path, ".name"), keys, required = TRUE))
        if (!is.null(b$lines)) add(list_problems("lines", FALSE))
        if (!is.null(b$url)) add(.cmail_url_problems(b$url, paste0(path, ".url"), keys))
      },
      footer_legal = {
        add(.cmail_text_problems(b$text, paste0(path, ".text"), keys))
        add(.cmail_text_problems(b$address, paste0(path, ".address"), keys))
      },
      feature = add(.cmail_feature_problems(b, path, keys)),
      add(.cmail_piezas_problems(b, type, path, keys))
    )
  }
  # Nada binario en lo que persiste (mismo guard que collection_state).
  add(.cc_security_problems(template, "template"))
  list(ok = length(p) == 0L, problems = p)
}

# Bloque image (§B): imagen del proyecto con alt obligatorio y sin campos,
# ancho de 40 a 600, alineación cerrada, sangre lógica y enlace opcional.
# `decorative: true` (E1o) es lo único que admite alt vacío: la imagen sale con
# alt="" y la revisión no la cuenta en `images_alt`.
.cmail_image_block_problems <- function(b, path, keys) {
  out <- list()
  push <- function(code, prop, detail) out[[length(out) + 1L]] <<- .cmail_problem(paste0(path, ".", prop), code, detail)
  if (!.cmail_image_id_ok(.cmail_one(b$image_ref) %||% NA_character_)) {
    push("bad_image_ref", "image_ref", "La imagen nombra un archivo del proyecto: a-z, 0-9 y guiones (sin _).")
  }
  alt <- .cmail_one(b$alt)
  decorative <- isTRUE(unlist(b$decorative))
  if (!is.null(b$decorative) && (length(unlist(b$decorative)) != 1L || !is.logical(unlist(b$decorative)))) {
    push("bad_flag", "decorative", "decorative es verdadero o falso.")
  }
  alt_empty <- is.null(alt) || !nzchar(trimws(alt))
  if (alt_empty && decorative) {
    # Decorativa: alt vacío permitido (y no hay texto que revisar).
    NULL
  } else if (alt_empty) {
    push("missing_alt", "alt", "Toda imagen lleva texto alternativo: es lo que se lee con las imágenes bloqueadas.")
  } else {
    out <- c(out, .cmail_text_problems(alt, paste0(path, ".alt"), character(0)))
    if (length(.cmail_tokens(alt))) push("alt_has_field", "alt", "El texto alternativo no admite {{campos}}.")
  }
  if (!is.null(b$width)) {
    w <- unlist(b$width)
    if (length(w) != 1L || !is.numeric(w) || is.na(w) || w != round(w) || w < 40 || w > 600) {
      push("bad_width", "width", "width es un entero de 40 a 600 (px).")
    }
  }
  if (!is.null(b$bleed) && (length(unlist(b$bleed)) != 1L || !is.logical(unlist(b$bleed)))) {
    push("bad_flag", "bleed", "bleed es verdadero o falso.")
  }
  if (!is.null(b$url)) out <- c(out, .cmail_url_problems(b$url, paste0(path, ".url"), keys, required = FALSE))
  out
}

# ---- presets ------------------------------------------------------------------

# Saludo por sexo sin columna hasta que se declare: sale «Estimado(a)» (como
# antes) y la revisión pide la columna (collection_mail_trato.R).
.cmail_trato_preset <- function() c(list(modo = "por_sexo"), .CMAIL_TRATO_DEFAULTS)

.cmail_signature_pulso <- function() {
  list(
    block_id = "firma", type = "signature", closing = "Atentamente,",
    name = "Pulso PUCP",
    lines = list("Instituto de Analítica Social e Inteligencia Estratégica", "Pontificia Universidad Católica del Perú"),
    url = "https://pulso.pucp.edu.pe/"
  )
}

# Sin texto propio (decisión 2026-10-21: «quítala»): el pie lleva solo lo que
# exige la plataforma, la dirección y la baja, que el render pone siempre.
.cmail_footer_default <- function() {
  list(block_id = "pie", type = "footer_legal")
}

# Desde el correo de recuperación de CCSS Perfil 2026 (vista_previa_correo.png):
# cabecera oscura con logos, saludo, tres párrafos, botón, recuadro «Importante»
# y firma institucional. Los textos entre corchetes son para completar.
.cmail_preset_recuperacion <- function() {
  list(
    schema = COLLECTION_MAIL_TEMPLATE_SCHEMA,
    template_id = "correo-recuperacion",
    preset_id = "recuperacion_estudiantes_v1",
    title = "Recuperación de estudiantes",
    revision = 1L,
    subject = "[Nombre del estudio]: invitación a participar",
    preheader = "Su respuesta no quedó registrada en clase. Puede completarla en línea en unos diez minutos.",
    theme = list(accent = .CMAIL_DEFAULT_ACCENT),
    header = list(kind = "logos", logo_ids = list("logo-cliente", "pulso"), background = "dark"),
    images = list(
      `logo-cliente` = list(alt = "[Unidad solicitante]"),
      pulso = list(alt = "Pulso PUCP")
    ),
    fields = list(
      list(key = "carrera", tag = "CARRERA", label = "Carrera", fallback = "su carrera"),
      list(key = "codigo", tag = "CODIGO", label = "Código"),
      list(key = "enlace", tag = "ENLACE", label = "Enlace a la encuesta", sm = "SurveyLink", destino = "encuesta")
    ),
    blocks = list(
      list(block_id = "saludo", type = "greeting", text = "Estimado(a) {{nombre}}:", fallback = "Estimado(a) estudiante:",
           trato = .cmail_trato_preset()),
      list(block_id = "contexto", type = "paragraph",
           text = "Pulso PUCP, por encargo de **[unidad solicitante]**, viene desarrollando el estudio **[nombre del estudio]**, cuyo objetivo es [objetivo del estudio]."),
      list(block_id = "motivo", type = "paragraph",
           text = "La encuesta se aplicó en **aulas seleccionadas aleatoriamente**, entre ellas una en la que usted se encuentra matriculado(a) como estudiante de {{carrera}}. Al no haber sido posible registrar su respuesta en esa oportunidad, le invitamos a **completarla en línea**. Su participación es muy importante para que los resultados reflejen adecuadamente la opinión de los estudiantes."),
      list(block_id = "tiempo", type = "paragraph",
           text = "Le pedimos responder **con calma y sinceridad**. El cuestionario toma **aproximadamente diez minutos**."),
      list(block_id = "accion", type = "button", text = "Acceder a la encuesta", url = "{{enlace}}"),
      list(block_id = "importante", type = "callout", variant = "box", title = "Importante:",
           items = list(
             "La encuesta es **confidencial**. Se solicitará su código **únicamente para verificar su participación** y evitar respuestas duplicadas; la información se analizará solo de forma agregada.",
             "[Incentivo, si lo hay: por ejemplo, un sorteo entre quienes completen la encuesta.]",
             "Si ya respondió la encuesta en clase, **no es necesario volver a hacerlo**."
           )),
      list(block_id = "consultas", type = "paragraph",
           text = "Para cualquier consulta sobre el estudio, puede responder directamente a este correo."),
      .cmail_signature_pulso(),
      .cmail_footer_default()
    )
  )
}

# Desde la invitación a la capacitación de coordinadores (vista_previa_invitacion.png):
# cabecera clara con franja de logos, saludo, párrafos, dos franjas de sesión,
# botón a la sala virtual con sus datos de acceso y firma.
.cmail_preset_invitacion <- function() {
  list(
    schema = COLLECTION_MAIL_TEMPLATE_SCHEMA,
    template_id = "correo-invitacion",
    preset_id = "invitacion_capacitacion_v1",
    title = "Invitación a capacitación",
    revision = 1L,
    subject = "Invitación a la capacitación del equipo de campo. [Nombre del estudio]",
    preheader = "Dos sesiones virtuales para preparar el trabajo de campo. Confirme su asistencia respondiendo este correo.",
    theme = list(accent = .CMAIL_DEFAULT_ACCENT),
    header = list(kind = "logos", logo_ids = list("logo-cliente", "pulso"), background = "light"),
    images = list(
      `logo-cliente` = list(alt = "[Institución socia]"),
      pulso = list(alt = "Pulso PUCP")
    ),
    fields = list(
      # Sin `sm`: el enlace es a la sala virtual, no a una encuesta; mandarlo
      # como [SurveyLink] llevaría a la persona a otro sitio (E1j).
      list(key = "enlace", tag = "ENLACE", label = "Enlace a la sesión", destino = "otro")
    ),
    blocks = list(
      list(block_id = "saludo", type = "greeting", text = "Estimado(a) {{nombre}}:", fallback = "Estimado(a):",
           trato = .cmail_trato_preset()),
      list(block_id = "invitacion", type = "paragraph",
           text = "Reciba un cordial saludo. Desde el Instituto de Analítica Social e Inteligencia Estratégica (Pulso PUCP) tenemos el agrado de invitarlo(a) a la **capacitación del equipo de campo** del **[nombre del estudio]**, que desarrollamos conjuntamente con **[institución socia]**."),
      list(block_id = "relevancia", type = "paragraph",
           text = "[Por qué importa el estudio y qué evidencia busca generar.]"),
      list(block_id = "rol", type = "paragraph",
           text = "La manera en que se realice el trabajo de campo es **tan importante como sus resultados**. Por ello, **el rol del equipo es fundamental**: de su labor depende que el estudio llegue a las unidades seleccionadas y que sus resultados sean confiables."),
      list(block_id = "formato", type = "paragraph",
           text = "La capacitación se desarrollará **de manera virtual**, en **[número] sesiones de [duración]** cada una:"),
      list(block_id = "sesion-1", type = "callout", variant = "bar",
           title = "Primera sesión: [día], de [hora de inicio] a [hora de término]",
           items = list("[Temas de la primera sesión.]")),
      list(block_id = "sesion-2", type = "callout", variant = "bar",
           title = "Segunda sesión: [día], de [hora de inicio] a [hora de término]",
           items = list("[Temas de la segunda sesión.]")),
      list(block_id = "accion", type = "button", text = "Ingresar a la sesión", url = "{{enlace}}",
           note = list("ID de reunión: [ID]", "Código de acceso: [código]")),
      list(block_id = "confirmacion", type = "paragraph",
           text = "Su **participación y compromiso** son fundamentales para el éxito de este estudio. Agradeceremos **confirmar su asistencia** respondiendo a este correo."),
      .cmail_signature_pulso(),
      .cmail_footer_default()
    )
  )
}

# Desde las invitaciones reales de Acreditación (Arte y Diseño, Formación General
# 2026; Contabilidad, reacreditación): la invitación más común. Cabecera clara
# de logos (sin banner: el preset no trae imagen), saludo, tres párrafos (quién
# y para qué, por qué y cuánto toma, hasta cuándo), botón, «Importante» y firma.
# Registro de «usted», como los originales. Sin `align`: los párrafos siguen al
# estilo (justificado en sobrio); sin colores propios: el acento por defecto.
.cmail_preset_invitacion_encuesta <- function() {
  list(
    schema = COLLECTION_MAIL_TEMPLATE_SCHEMA,
    template_id = "correo-invitacion-encuesta",
    preset_id = "invitacion_encuesta_v1",
    title = "Invitación a encuesta",
    revision = 1L,
    subject = "[Nombre del estudio]: le invitamos a responder la encuesta",
    preheader = "Su opinión es importante para [unidad solicitante]. La encuesta toma unos [15] minutos.",
    theme = list(accent = .CMAIL_DEFAULT_ACCENT),
    header = list(kind = "logos", logo_ids = list("logo-cliente", "pulso"), background = "light"),
    images = list(
      `logo-cliente` = list(alt = "[Unidad solicitante]"),
      pulso = list(alt = "Pulso PUCP")
    ),
    fields = list(
      list(key = "enlace", tag = "ENLACE", label = "Enlace a la encuesta", sm = "SurveyLink", destino = "encuesta")
    ),
    blocks = list(
      list(block_id = "saludo", type = "greeting", text = "Estimado(a) {{nombre}}:", fallback = "Estimado(a):",
           trato = .cmail_trato_preset()),
      list(block_id = "contexto", type = "paragraph",
           text = "La **[unidad solicitante] de la Pontificia Universidad Católica del Perú** y el **Instituto de Analítica Social e Inteligencia Estratégica - PULSO PUCP** vienen realizando un *estudio de opinión* en el marco de [proceso del estudio, por ejemplo: la acreditación de la carrera], con la finalidad de [objetivo del estudio]."),
      list(block_id = "motivo", type = "paragraph",
           text = "Por ello, le invitamos a responder la siguiente encuesta, que tomará **aproximadamente [15] minutos**, para conocer su percepción acerca de [temas de la encuesta]. Agradecemos mucho su valioso aporte dentro de este proceso."),
      list(block_id = "plazo", type = "paragraph",
           text = "Puede participar hasta el **[fecha límite]**."),
      list(block_id = "accion", type = "button", text = "Empezar aquí", url = "{{enlace}}"),
      list(block_id = "importante", type = "callout", variant = "box", title = "Importante:",
           items = list(
             "La ruta de acceso a la encuesta es **única y personal**; por favor, no la reenvíe ni la comparta.",
             "Se aconseja que, una vez iniciada la encuesta, **la complete en su totalidad**.",
             "La información que brinde es **confidencial** y se analizará solo de forma agregada."
           )),
      list(block_id = "firma", type = "signature", closing = "Saludos cordiales,",
           name = "PULSO PUCP",
           lines = list("Instituto de Analítica Social e Inteligencia Estratégica"),
           url = "https://pulso.pucp.edu.pe/"),
      .cmail_footer_default()
    )
  )
}

# El orden es el de «Empieza desde» en el editor: la invitación a encuesta, la
# más común, va primero.
.cmail_presets <- function() {
  list(
    invitacion_encuesta_v1 = .cmail_preset_invitacion_encuesta,
    recuperacion_estudiantes_v1 = .cmail_preset_recuperacion,
    invitacion_capacitacion_v1 = .cmail_preset_invitacion
  )
}

.cmail_builtin_template <- function() {
  .cmail_template_normalize(.cmail_preset_recuperacion())
}

# Plantilla de una campaña. La guardada se vuelve a validar al leerla: un
# state.rds de otra versión o editado a mano no llega al render sin pasar el
# contrato. `strict = FALSE` la devuelve igual con sus problemas (para que GET
# la muestre y PUT la pueda reemplazar).
.cmail_campaign_template_checked <- function(campaign, strict = TRUE) {
  stored <- campaign$template
  valid <- collection_mail_template_validate(stored)
  if (!isTRUE(valid$ok)) {
    if (!strict) return(structure(stored, problems = valid$problems))
    stop_api(
      409, "E_COLLECTION_MAIL_TEMPLATE_STORED_INVALID",
      "La plantilla de correo guardada no cumple collection_mail_template/v1; ábrela en el editor y vuelve a guardarla.",
      details = list(problems = valid$problems, campaign_id = campaign$campaign_id)
    )
  }
  stored
}

# Plantilla de la campaña pedida (sin campaign_id: ver .cmail_campaign_pick).
.cmail_template_of <- function(state, strict = TRUE, campaign_id = NULL) {
  .cmail_campaign_template_checked(.cmail_campaign_pick(state, campaign_id)$campaign, strict = strict)
}

# ---- API ----------------------------------------------------------------------

#' Presets de correo built-in (ADR 0110 §2).
#' @keywords internal
collection_mail_presets_get <- function(sid) {
  session_get(sid)
  presets <- .cmail_presets()
  list(
    ok = TRUE,
    schema = COLLECTION_MAIL_TEMPLATE_SCHEMA,
    reserved_tags = as.list(c(.CMAIL_RESERVED_TAGS, "MC_*")),
    block_types = as.list(names(.CMAIL_BLOCK_KEYS)),
    presets = unname(lapply(names(presets), function(id) {
      t <- .cmail_template_normalize(presets[[id]]())
      list(preset_id = id, title = t$title, template = .cmc_drop_nulls_deep(t))
    }))
  )
}

#' Plantilla de correo de una campaña.
#' @keywords internal
collection_mail_template_get <- function(sid, campaign_id = NULL) {
  session <- session_get(sid)
  state <- .collection_current(session)
  pick <- .cmail_campaign_for(session, state, campaign_id)
  tpl <- .cmail_campaign_template_checked(pick$campaign, strict = FALSE)
  problems <- attr(tpl, "problems")
  attr(tpl, "problems") <- NULL
  out <- list(
    ok = TRUE,
    state_revision = as.integer(state$state_revision),
    campaign_id = pick$campaign$campaign_id,
    builtin = isTRUE(pick$virtual),
    # E1j/E1k: la plataforma y los envíos completos (asunto, apertura) del editor.
    platform = .cmail_platform_of(pick$campaign),
    sends = .cmail_sends_of(pick$campaign),
    template = .cmc_drop_nulls_deep(tpl)
  )
  if (length(problems)) out$stored_problems <- problems
  out
}

.cmail_template_or_stop <- function(template) {
  if (!is.list(template)) {
    stop_api(422, "E_COLLECTION_MAIL_TEMPLATE_INVALID", "template debe ser un objeto collection_mail_template/v1.")
  }
  candidate <- .cmail_template_normalize(template)
  valid <- collection_mail_template_validate(candidate)
  if (!isTRUE(valid$ok)) {
    stop_api(
      422, "E_COLLECTION_MAIL_TEMPLATE_INVALID", "La plantilla no cumple collection_mail_template/v1.",
      details = list(problems = valid$problems)
    )
  }
  candidate
}

#' Guarda la plantilla de una campaña (y sus envíos) con revisión optimista.
#'
#' Sin campañas crea `correo-1`; con la migración pendiente, la persiste.
#' `template_id` se fuerza a `campaign_id` (de ahí sale el nombre del ZIP).
#' Plantilla y envíos se guardan juntos: UNA subida de `state_revision`;
#' `template.revision` sube solo si cambió la plantilla y `noop` exige que no
#' haya cambiado ninguno de los dos (E1k). Sin `template` se conservan la
#' guardada y se actualizan solo los envíos. `import_id` (E1l) registra de qué
#' HTML importado sale la plantilla.
#' @keywords internal
collection_mail_template_put <- function(sid, template, expected_revision, campaign_id = NULL,
                                         sends = NULL, import_id = NULL) {
  session <- session_get(sid)
  current <- .collection_current(session)
  .collection_assert_revision(current, expected_revision)
  pick <- .cmail_campaign_for(session, current, campaign_id)
  campaign <- pick$campaign
  previous <- .cmail_campaign_template_checked(campaign, strict = FALSE)
  attr(previous, "problems") <- NULL
  if (is.null(template) && !is.null(sends)) template <- .cmail_campaign_template_checked(campaign)
  if (is.list(template)) template$template_id <- campaign$campaign_id
  candidate <- .cmail_template_or_stop(template)
  imported <- if (!is.null(import_id)) .cmail_import_lookup(sid, import_id) else NULL
  prev_sends <- .cmail_sends_of(campaign)
  sv <- .cmail_sends_or_stop(sends %||% prev_sends, candidate, prev_sends, .cmail_send_seq(campaign))
  template_same <- !isTRUE(pick$virtual) &&
    identical(.cmail_template_material(candidate), .cmail_template_material(previous))
  sends_same <- identical(sv$sends, prev_sends)
  if (template_same && sends_same && is.null(imported)) {
    return(list(ok = TRUE, noop = TRUE, state_revision = as.integer(current$state_revision),
                campaign_id = campaign$campaign_id, template = .cmc_drop_nulls_deep(previous),
                sends = prev_sends, send_warnings = sv$warnings))
  }
  if (!template_same) {
    revision <- if (isTRUE(pick$virtual)) 1L else as.integer(previous$revision %||% 0L) + 1L
    candidate <- .cmail_template_normalize(candidate, revision = revision)
    if (isTRUE(pick$virtual)) campaign$name <- substr(.cmail_one(candidate$title) %||% "Correo", 1L, 80L)
    campaign$template <- candidate
  } else {
    candidate <- previous
  }
  campaign$sends <- sv$sends
  if (sv$seq > 0L) campaign$send_seq <- sv$seq
  if (!is.null(imported)) campaign$imported_from <- imported
  next_state <- .cmail_campaigns_commit(sid, current, .cmail_campaigns_upsert(pick$set$campaigns, campaign))
  list(ok = TRUE, noop = FALSE, state_revision = next_state$state_revision,
       campaign_id = campaign$campaign_id, template = .cmc_drop_nulls_deep(candidate),
       sends = sv$sends, send_warnings = sv$warnings)
}
