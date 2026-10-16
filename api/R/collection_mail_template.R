# collection_mail_template.R — la plantilla de correo de Material de campo
# (ADR 0110 §2, etapa E1f: «Correos: componer aquí, enviar en Mailchimp»).
#
# Un correo es un material de la familia «va al participante» con canal
# digital. La app lo COMPONE; el envío masivo se hace en Mailchimp (ADR 0046 no
# convierte el módulo en herramienta de emailing).
#
# Contrato `collection_mail_template/v1`:
#
#   schema, template_id, preset_id, revision, template_sha256,
#   subject, preheader,
#   theme  = { accent: "#rrggbb" },
#   header = { kind: "logos", logo_ids: [..], background: "dark"|"light" }
#          | { kind: "banner", image_ref: "<id>" },
#   images = { <image_id>: { alt, url? } },   # url pública opcional (https)
#   fields = [ { key, tag, label, fallback? } ],
#   blocks = [ { block_id, type, ... } ]      # registro CERRADO
#
# **Registro cerrado.** Solo existen los tipos de `.CMAIL_BLOCK_KEYS` y cada uno
# admite solo sus claves. El texto es texto: nunca HTML. La única marca es
# `**negrita**` y los campos `{{clave}}`. Un `<b>` o un `*|TAG|*` crudo se
# rechazan: el render es el único que escribe HTML y etiquetas de Mailchimp, y
# así el escape no depende de que el autor lo recuerde.
#
# **Campos de combinación.** `{{nombre}}` es reservado y siempre va a
# `*|FNAME|*`. Los campos del estudio declaran su etiqueta de Mailchimp: A-Z,
# 0-9 y `_`, de 1 a 10 caracteres (el tope de Mailchimp), y nunca una etiqueta
# reservada del sistema (EMAIL, FNAME, LNAME, ADDRESS, PHONE, UNSUB, LIST, MC_*).
#
# **Persistencia.** La plantilla (sin destinatarios) vive en
# `collection_state$mail_template` (singular, como `material_template`: una
# plantilla de correo activa por proyecto) con revisión optimista. Los
# destinatarios NO: ver collection_mail_recipients.R.

COLLECTION_MAIL_TEMPLATE_SCHEMA <- "collection_mail_template/v1"

.CMAIL_BLOCK_KEYS <- list(
  greeting     = c("text", "fallback"),
  paragraph    = c("text", "align"),
  button       = c("text", "url", "note"),
  callout      = c("title", "items", "variant"),
  list         = c("items", "ordered"),
  signature    = c("closing", "name", "lines", "url"),
  footer_legal = c("text", "address")
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
      "El texto no admite HTML. Usa **negrita** y {{campo}}; el formato lo pone la plantilla."
    )
  }
  if (grepl("*|", value, fixed = TRUE) || grepl("|*", value, fixed = TRUE)) {
    out[[length(out) + 1L]] <- .cmail_problem(
      path, "raw_merge_tag",
      "Las etiquetas de Mailchimp se escriben como {{campo}}; la app las traduce."
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
  t$schema <- COLLECTION_MAIL_TEMPLATE_SCHEMA
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
    b
  })
  if (is.null(t$images) || (is.list(t$images) && !length(t$images))) {
    t$images <- structure(list(), names = character(0))
  }
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

#' Valida una plantilla `collection_mail_template/v1` contra el registro cerrado.
#'
#' @param template lista.
#' @return list(ok, problems).
#' @keywords internal
collection_mail_template_validate <- function(template) {
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
  if (!is.list(fields)) {
    add(list(.cmail_problem("template.fields", "not_list", "fields debe ser una lista.")))
    fields <- list()
  }
  for (i in seq_along(fields)) {
    f <- fields[[i]]
    path <- sprintf("template.fields[%d]", i)
    if (!is.list(f)) { add(list(.cmail_problem(path, "not_object", "Cada campo es un objeto."))); next }
    for (k in setdiff(names(f), c("key", "tag", "label", "fallback"))) {
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
    add(.cmail_text_problems(f$label, paste0(path, ".label"), character(0), required = TRUE))
    add(.cmail_text_problems(f$fallback, paste0(path, ".fallback"), character(0)))
  }

  add(.cmail_text_problems(template$subject %||% "", "template.subject", keys))
  add(.cmail_text_problems(template$preheader %||% "", "template.preheader", keys))

  theme <- template$theme
  if (!is.null(theme)) {
    accent <- .cmail_one(theme$accent)
    if (!is.list(theme) || is.null(accent) || !grepl("^#[0-9a-fA-F]{6}$", accent)) {
      add(list(.cmail_problem("template.theme.accent", "bad_color", "El color de acento es #rrggbb.")))
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
    if (!.cmail_slug_ok(id)) add(list(.cmail_problem(path, "bad_id", "Id de imagen inválido.")))
    if (!is.list(img)) { add(list(.cmail_problem(path, "not_object", "Cada imagen es {alt, url}."))); next }
    for (k in setdiff(names(img), c("alt", "url"))) {
      add(list(.cmail_problem(paste0(path, ".", k), "unknown_key", sprintf("`%s` no pertenece a una imagen.", k))))
    }
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
          !all(vapply(ids, .cmail_slug_ok, logical(1)))) {
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
      if (!.cmail_slug_ok(.cmail_one(header$image_ref) %||% NA_character_)) {
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
      unlist(lapply(seq_along(items), function(j) {
        .cmail_text_problems(items[[j]], sprintf("%s.%s[%d]", path, field, j), keys, required = TRUE)
      }), recursive = FALSE)
    }
    switch(type,
      greeting = {
        add(.cmail_text_problems(b$text, paste0(path, ".text"), keys, required = TRUE))
        add(.cmail_text_problems(b$fallback, paste0(path, ".fallback"), character(0)))
        if (length(.cmail_tokens(.cmail_one(b$text) %||% "")) && is.null(.cmail_one(b$fallback))) {
          add(list(.cmail_problem(paste0(path, ".fallback"), "missing_fallback",
            "Un saludo con campo necesita su texto de respaldo para quien no tiene el dato.")))
        }
      },
      paragraph = {
        add(.cmail_text_problems(b$text, paste0(path, ".text"), keys, required = TRUE))
        if (!is.null(b$align) && !((.cmail_one(b$align) %||% "") %in% c("left", "justify", "center"))) {
          add(list(.cmail_problem(paste0(path, ".align"), "bad_align", "align es left, justify o center.")))
        }
      },
      button = {
        add(.cmail_text_problems(b$text, paste0(path, ".text"), keys, required = TRUE))
        add(.cmail_url_problems(b$url, paste0(path, ".url"), keys))
        if (!is.null(b$note)) add(list_problems("note", FALSE))
      },
      callout = {
        add(.cmail_text_problems(b$title, paste0(path, ".title"), keys))
        add(list_problems("items", TRUE))
        if (!is.null(b$variant) && !((.cmail_one(b$variant) %||% "") %in% c("box", "bar"))) {
          add(list(.cmail_problem(paste0(path, ".variant"), "bad_variant", "variant es box o bar.")))
        }
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
      }
    )
  }
  # Nada binario en lo que persiste (mismo guard que collection_state).
  add(.cc_security_problems(template, "template"))
  list(ok = length(p) == 0L, problems = p)
}

# ---- presets ------------------------------------------------------------------

.cmail_signature_pulso <- function() {
  list(
    block_id = "firma", type = "signature", closing = "Atentamente,",
    name = "Pulso PUCP",
    lines = list("Instituto de Analítica Social e Inteligencia Estratégica", "Pontificia Universidad Católica del Perú"),
    url = "https://pulso.pucp.edu.pe/"
  )
}

.cmail_footer_default <- function() {
  list(
    block_id = "pie", type = "footer_legal",
    text = "Recibe este correo porque forma parte de la población del estudio. Sus respuestas son confidenciales."
  )
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
      list(key = "enlace", tag = "ENLACE", label = "Enlace a la encuesta")
    ),
    blocks = list(
      list(block_id = "saludo", type = "greeting", text = "Estimado(a) {{nombre}}:", fallback = "Estimado(a) estudiante:"),
      list(block_id = "contexto", type = "paragraph", align = "justify",
           text = "Pulso PUCP, por encargo de **[unidad solicitante]**, viene desarrollando el estudio **[nombre del estudio]**, cuyo objetivo es [objetivo del estudio]."),
      list(block_id = "motivo", type = "paragraph", align = "justify",
           text = "La encuesta se aplicó en **aulas seleccionadas aleatoriamente**, entre ellas una en la que usted se encuentra matriculado(a) como estudiante de {{carrera}}. Al no haber sido posible registrar su respuesta en esa oportunidad, le invitamos a **completarla en línea**. Su participación es muy importante para que los resultados reflejen adecuadamente la opinión de los estudiantes."),
      list(block_id = "tiempo", type = "paragraph", align = "justify",
           text = "Le pedimos responder **con calma y sinceridad**. El cuestionario toma **aproximadamente diez minutos**."),
      list(block_id = "accion", type = "button", text = "Acceder a la encuesta", url = "{{enlace}}"),
      list(block_id = "importante", type = "callout", variant = "box", title = "Importante:",
           items = list(
             "La encuesta es **confidencial**. Se solicitará su código **únicamente para verificar su participación** y evitar respuestas duplicadas; la información se analizará solo de forma agregada.",
             "[Incentivo, si lo hay: por ejemplo, un sorteo entre quienes completen la encuesta.]",
             "Si ya respondió la encuesta en clase, **no es necesario volver a hacerlo**."
           )),
      list(block_id = "consultas", type = "paragraph", align = "justify",
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
      list(key = "enlace", tag = "ENLACE", label = "Enlace a la sesión")
    ),
    blocks = list(
      list(block_id = "saludo", type = "greeting", text = "Estimado(a) {{nombre}}:", fallback = "Estimado(a):"),
      list(block_id = "invitacion", type = "paragraph", align = "justify",
           text = "Reciba un cordial saludo. Desde el Instituto de Analítica Social e Inteligencia Estratégica (Pulso PUCP) tenemos el agrado de invitarlo(a) a la **capacitación del equipo de campo** del **[nombre del estudio]**, que desarrollamos conjuntamente con **[institución socia]**."),
      list(block_id = "relevancia", type = "paragraph", align = "justify",
           text = "[Por qué importa el estudio y qué evidencia busca generar.]"),
      list(block_id = "rol", type = "paragraph", align = "justify",
           text = "La manera en que se realice el trabajo de campo es **tan importante como sus resultados**. Por ello, **el rol del equipo es fundamental**: de su labor depende que el estudio llegue a las unidades seleccionadas y que sus resultados sean confiables."),
      list(block_id = "formato", type = "paragraph", align = "justify",
           text = "La capacitación se desarrollará **de manera virtual**, en **[número] sesiones de [duración]** cada una:"),
      list(block_id = "sesion-1", type = "callout", variant = "bar",
           title = "Primera sesión: [día], de [hora de inicio] a [hora de término]",
           items = list("[Temas de la primera sesión.]")),
      list(block_id = "sesion-2", type = "callout", variant = "bar",
           title = "Segunda sesión: [día], de [hora de inicio] a [hora de término]",
           items = list("[Temas de la segunda sesión.]")),
      list(block_id = "accion", type = "button", text = "Ingresar a la sesión", url = "{{enlace}}",
           note = list("ID de reunión: [ID]", "Código de acceso: [código]")),
      list(block_id = "confirmacion", type = "paragraph", align = "justify",
           text = "Su **participación y compromiso** son fundamentales para el éxito de este estudio. Agradeceremos **confirmar su asistencia** respondiendo a este correo."),
      .cmail_signature_pulso(),
      .cmail_footer_default()
    )
  )
}

.cmail_presets <- function() {
  list(
    recuperacion_estudiantes_v1 = .cmail_preset_recuperacion,
    invitacion_capacitacion_v1 = .cmail_preset_invitacion
  )
}

.cmail_builtin_template <- function() {
  .cmail_template_normalize(.cmail_preset_recuperacion())
}

.cmail_template_of <- function(state) {
  state$mail_template %||% .cmail_builtin_template()
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

#' Plantilla de correo activa.
#' @keywords internal
collection_mail_template_get <- function(sid) {
  state <- .collection_current(session_get(sid))
  list(
    ok = TRUE,
    state_revision = as.integer(state$state_revision),
    builtin = is.null(state$mail_template),
    template = .cmc_drop_nulls_deep(.cmail_template_of(state))
  )
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

#' Guarda la plantilla de correo con revisión optimista.
#' @keywords internal
collection_mail_template_put <- function(sid, template, expected_revision) {
  current <- .collection_current(session_get(sid))
  .collection_assert_revision(current, expected_revision)
  previous <- .cmail_template_of(current)
  candidate <- .cmail_template_or_stop(template)
  if (!is.null(current$mail_template) &&
      identical(.cmail_template_material(candidate), .cmail_template_material(previous))) {
    return(list(ok = TRUE, noop = TRUE, state_revision = as.integer(current$state_revision),
                template = .cmc_drop_nulls_deep(previous)))
  }
  candidate <- .cmail_template_normalize(candidate, revision = as.integer(previous$revision %||% 0L) + 1L)
  next_state <- current
  next_state$mail_template <- candidate
  next_state$state_revision <- as.integer(current$state_revision) + 1L
  .collection_store(sid, next_state)
  list(ok = TRUE, noop = FALSE, state_revision = next_state$state_revision,
       template = .cmc_drop_nulls_deep(candidate))
}
