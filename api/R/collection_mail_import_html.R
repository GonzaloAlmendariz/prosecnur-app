# collection_mail_import_html.R — importar un correo HTML existente y
# convertirlo en bloques de `collection_mail_template/v2` (ADR 0110, etapa E1l).
#
# **Importar no escribe.** `POST mail-template/import-html` devuelve una
# plantilla validada, el informe de lo que se descartó y la plataforma
# detectada. Para guardarla se usa `POST mail-campaigns {template, import_id}` o
# `PUT mail-template {template, import_id}`, que la revalidan entera. El HTML
# crudo NUNCA se guarda: ni en el estado, ni en el `.pulso`, ni en disco. De la
# importación solo queda, en memoria del proceso y por sesión (hasta 5), su
# huella, la fecha, la plataforma detectada y el informe enmascarado; con
# `import_id`, eso pasa a `campaign.imported_from`.
#
# **Parser** (libxml2 vía xml2): `read_html` sobre los BYTES (nunca una ruta ni
# una URL), sin red (`NONET`) y sin `HUGE`. Límites: 512 KB, 5.000 elementos y
# 64 niveles. Se descartan script, style, noscript, iframe, object, embed,
# form, input, button, svg, math, template, los comentarios (incluidos los
# condicionales de Outlook) y lo oculto (salvo el preheader). De los atributos
# solo se leen href, src, alt y width; de los estilos, dos valores validados: el
# color de fondo hexadecimal del botón o del separador (→ `theme.accent`) y
# `text-align: justify|center`. Nunca se copia CSS: el formato lo pone la
# plantilla.
#
# **Sin pérdida de texto.** Lo que no se reconoce entra como párrafo con su
# texto y un ítem `unrecognized` en el informe; lo descartado se informa con un
# extracto. Un test exige que toda palabra visible del cuerpo aparezca en un
# bloque, en el informe o en el vocabulario del pie de la plataforma.

.CMAIL_IMPORT_HTML_MAX_BYTES <- 512L * 1024L
.CMAIL_IMPORT_HTML_MAX_NODES <- 5000L
.CMAIL_IMPORT_HTML_MAX_DEPTH <- 64L
.CMAIL_IMPORTS_KEEP <- 5L
.CMAIL_IMPORT_REPORT_MAX <- 50L
.CMAIL_IMPORT_EXCERPT_MAX <- 160L
.CMAIL_IH_DROP <- c("script", "style", "noscript", "iframe", "object", "embed", "form", "input", "button",
                    "svg", "math", "template", "canvas", "select", "textarea")
.CMAIL_IH_INLINE <- c("a", "strong", "b", "em", "i", "s", "strike", "del", "ins", "span", "br", "font", "u", "small", "sup", "sub", "label",
                      "abbr", "code", "mark", "s", "strike", "big", "cite", "q", "wbr", "time", "img")
.CMAIL_IH_HEADINGS <- paste0("h", 1:6)
.CMAIL_IH_SM_TAG_RE <- "\\[(SurveyLink|OptOutLink|PrivacyLink|FooterLink|RemoveLink|FirstQuestion|FirstName|LastName|Email|CustomData[0-9]{1,2})\\]"
.CMAIL_IH_MC_TAG_RE <- "\\*\\|[A-Za-z0-9_:]+\\|\\*"
.CMAIL_IH_GREETING_RE <- "^(\\*\\*)?\\s*(Estimad|Querid|Hola|Se\u00f1or|Buen[oa]s|Apreciad|Distinguid)"
.CMAIL_IH_CLOSING_RE <- "^(\\*\\*)?\\s*(Saludos|Atentamente|Cordialmente|Gracias|Muchas gracias|Un saludo|Con aprecio|Reciba un cordial)"
.CMAIL_IH_FOOTER_RE <- "(?i)(opt[- ]?out|unsub|darse de baja|dejar de recibir|privacidad|privacy)"

# Frases del pie estándar de cada plataforma: se quitan del texto del pie.
.CMAIL_IH_FOOTER_PHRASES <- c(
  "Si desea darse de baja de esta encuesta, haga clic aqu\u00ed.",
  "Si desea darse de baja de esta encuesta, haga clic aqu\u00ed",
  "Dejar de recibir estos correos", "Privacidad", "Unsubscribe", "Opt out", "Opt-out",
  "Privacy", "Darse de baja"
)

# ---- caché de importaciones (memoria del proceso, por sesión) -----------------

.cmail_imports_env <- new.env(parent = emptyenv())

.cmail_import_remember <- function(sid, entry) {
  # Higiene: las sesiones que ya no existen se olvidan.
  for (k in ls(.cmail_imports_env)) if (is.null(.session_env[[k]])) rm(list = k, envir = .cmail_imports_env)
  cur <- if (exists(sid, envir = .cmail_imports_env, inherits = FALSE)) get(sid, envir = .cmail_imports_env) else list()
  cur[[entry$import_id]] <- entry
  if (length(cur) > .CMAIL_IMPORTS_KEEP) cur <- utils::tail(cur, .CMAIL_IMPORTS_KEEP)
  assign(sid, cur, envir = .cmail_imports_env)
  invisible(entry)
}

#' `imported_from` de una importación reciente de la sesión.
#' @keywords internal
.cmail_import_lookup <- function(sid, import_id) {
  id <- .cmail_one(as.list(import_id))
  cur <- if (exists(sid, envir = .cmail_imports_env, inherits = FALSE)) get(sid, envir = .cmail_imports_env) else list()
  entry <- if (!is.null(id)) cur[[id]] else NULL
  if (is.null(entry)) {
    stop_api(422, "E_COLLECTION_MAIL_IMPORT_HTML_INVALID",
             "import_id no corresponde a una importación reciente de esta sesión; vuelve a importar el HTML.")
  }
  list(sha256 = entry$sha256, imported_at = entry$imported_at, platform_detected = entry$platform_detected,
       report = entry$report)
}

# ---- utilidades ---------------------------------------------------------------

.cmail_ih_ws <- function(x) {
  x <- gsub("[\u00a0\u2007\u202f]", " ", x)
  x <- gsub("[\u034f\u200b\u200c\u200d\u2060\ufeff\u00ad]", "", x)
  gsub("[ \t\r\n\f]+", " ", x)
}

.cmail_ih_style <- function(node) {
  s <- xml2::xml_attr(node, "style")
  if (is.na(s)) "" else tolower(s)
}

.cmail_ih_classes <- function(node) {
  c <- xml2::xml_attr(node, "class")
  if (is.na(c)) character(0) else strsplit(tolower(trimws(c)), "\\s+")[[1]]
}

.cmail_ih_hex <- function(x) {
  if (is.null(x) || is.na(x)) return(NULL)
  m <- regmatches(x, regexpr("#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\\b", x))
  if (!length(m)) return(NULL)
  h <- tolower(sub("^#", "", m))
  if (nchar(h) == 3L) h <- paste(rep(strsplit(h, "")[[1]], each = 2L), collapse = "")
  paste0("#", h)
}

.cmail_ih_decl <- function(style, prop) {
  m <- regmatches(style, regexpr(sprintf("(^|;)\\s*%s\\s*:[^;]*", prop), style, perl = TRUE))
  if (!length(m)) return(NULL)
  trimws(sub("^.*?:", "", m, perl = TRUE))
}

.cmail_ih_selector <- function(node) {
  parts <- character(0)
  n <- node
  for (i in 1:4) {
    if (inherits(n, "xml_missing") || !identical(xml2::xml_type(n), "element")) break
    nm <- xml2::xml_name(n)
    if (nm %in% c("html", "document")) break
    cls <- .cmail_ih_classes(n)
    parts <- c(paste0(nm, if (length(cls)) paste0(".", cls[[1]]) else ""), parts)
    if (nm %in% c("body", "head")) break
    n <- xml2::xml_parent(n)
  }
  paste(parts, collapse = " > ")
}

.cmail_ih_slug <- function(x, max = 40L) {
  s <- stringi::stri_trans_general(tolower(as.character(x %||% "")), "Latin-ASCII")
  s <- gsub("[^a-z0-9]+", "-", s)
  s <- gsub("^-+|-+$", "", s)
  s <- gsub("-+$", "", substr(s, 1L, max))
  if (!nzchar(s) || !grepl("^[a-z0-9]", s)) NULL else s
}

# ---- informe ------------------------------------------------------------------

.cmail_ih_new_ctx <- function() {
  ctx <- new.env(parent = emptyenv())
  ctx$report <- list()
  ctx$discarded <- character(0)
  ctx$dropped_empty <- 0L
  ctx$fields <- list()
  ctx$images <- list()
  ctx$image_list <- list()
  ctx$accent <- NULL
  ctx$css_align <- list()
  ctx$em_reported <- FALSE
  ctx$platform_labels <- character(0)
  ctx$escaped_reported <- FALSE
  ctx
}

.cmail_ih_report <- function(ctx, code, reason, node = NULL, excerpt = NULL, selector = NULL, block_id = NULL) {
  ex <- excerpt %||% if (!is.null(node)) .cmail_ih_ws(xml2::xml_text(node)) else ""
  ex <- trimws(ex)
  if (nchar(ex) > .CMAIL_IMPORT_EXCERPT_MAX) ex <- paste0(substr(ex, 1L, .CMAIL_IMPORT_EXCERPT_MAX - 1L), "\u2026")
  ctx$report[[length(ctx$report) + 1L]] <- list(
    code = code,
    selector = selector %||% if (!is.null(node)) .cmail_ih_selector(node) else NULL,
    excerpt = .cmail_mask_pii(ex),
    reason = reason,
    block_id = block_id
  )
  invisible(NULL)
}

# ---- campos de las plataformas ------------------------------------------------

.cmail_ih_field <- function(ctx, key, tag, label, sm = NULL, destino = NULL) {
  if (is.null(ctx$fields[[key]])) {
    ctx$fields[[key]] <- .cmc_drop_nulls_deep(list(key = key, tag = tag, label = label, sm = sm, destino = destino))
  }
  key
}

# Una etiqueta de plataforma -> clave de campo de la plantilla (o "" si se quita).
.cmail_ih_token <- function(ctx, tag, node = NULL) {
  sm <- regmatches(tag, regexec("^\\[([A-Za-z0-9]+)\\]$", tag))[[1]]
  if (length(sm) == 2L) {
    name <- sm[[2]]
    if (identical(name, "FirstName")) return("nombre")
    if (identical(name, "LastName")) return(.cmail_ih_field(ctx, "apellido", "APELLIDO", "Apellido", "LastName"))
    if (identical(name, "SurveyLink")) return(.cmail_ih_field(ctx, "enlace", "ENLACE", "Enlace a la encuesta", "SurveyLink", "encuesta"))
    if (grepl("^CustomData[0-9]+$", name)) {
      n <- as.integer(sub("^CustomData", "", name))
      if (n >= 1L && n <= 50L) {
        return(.cmail_ih_field(ctx, sprintf("dato_%d", n), sprintf("DATO%d", n), sprintf("Dato %d", n), name))
      }
    }
    if (identical(name, "Email")) {
      .cmail_ih_report(ctx, "email_tag_removed", "[Email] se quitó: un correo en el texto es un dato personal.", node,
                       excerpt = tag)
    }
    return("")
  }
  mc <- regmatches(tag, regexec("^\\*\\|([A-Za-z0-9_:]+)\\|\\*$", tag))[[1]]
  if (length(mc) == 2L) {
    t <- toupper(mc[[2]])
    if (identical(t, "FNAME")) return("nombre")
    if (identical(t, "LNAME")) return(.cmail_ih_field(ctx, "apellido", "APELLIDO", "Apellido", "LastName"))
    if (grepl(":", t, fixed = TRUE) || t %in% c("UNSUB", "EMAIL", "ADDRESS", "PHONE") || startsWith(t, "MC_")) {
      if (identical(t, "EMAIL")) {
        .cmail_ih_report(ctx, "email_tag_removed", "*|EMAIL|* se quitó: un correo en el texto es un dato personal.", node,
                         excerpt = tag)
      }
      return("")
    }
    key <- tolower(gsub("[^A-Za-z0-9_]", "", t))
    if (!grepl("^[a-z]", key)) key <- paste0("c_", key)
    key <- substr(key, 1L, 30L)
    if (key %in% .CMAIL_RESERVED_KEYS) key <- paste0(key, "_1")
    tag_ok <- if (.cmail_tag_ok(t)) t else substr(gsub("[^A-Z0-9_]", "", toupper(key)), 1L, 10L)
    # Sin `sm` ni `destino`: en Mailchimp no se sabe si *|ENLACE|* es la encuesta.
    return(.cmail_ih_field(ctx, key, tag_ok, key))
  }
  ""
}

# Reemplaza en un texto las etiquetas de plataforma por marcadores
# \u0001clave\u0002 (los convierte en {{clave}} `.cmail_ih_finish`, después de
# neutralizar las llaves literales del autor). Los condicionales de Mailchimp
# `*|IF:T|*X*|ELSE:|*Y*|END:IF|*` se quedan con X (el respaldo lo lee el saludo).
.cmail_ih_tags_in <- function(ctx, text, node = NULL) {
  # Campo con respaldo: *|IF:T|**|T|**|ELSE:|*Y*|END:IF|* -> el campo T lleva fallback Y.
  fb <- regmatches(text, gregexpr("\\*\\|IF:([A-Za-z0-9_]+)\\|\\*\\*\\|\\1\\|\\*\\*\\|ELSE:\\|\\*(.*?)\\*\\|END:IF\\|\\*", text, perl = TRUE))[[1]]
  for (h in fb) {
    parts <- regmatches(h, regexec("^\\*\\|IF:([A-Za-z0-9_]+)\\|\\*.*?\\*\\|ELSE:\\|\\*(.*?)\\*\\|END:IF\\|\\*$", h, perl = TRUE))[[1]]
    if (length(parts) != 3L || identical(toupper(parts[[2]]), "FNAME")) next
    key <- .cmail_ih_token(ctx, sprintf("*|%s|*", parts[[2]]), node)
    fallback <- trimws(.cmail_ih_ws(parts[[3]]))
    if (nzchar(key) && nzchar(fallback) && !is.null(ctx$fields[[key]]) && is.null(ctx$fields[[key]]$fallback) &&
        !grepl("[{}*|<>&\\[\\]\u0004\u0006]", fallback)) {
      ctx$fields[[key]]$fallback <- fallback
    }
  }
  text <- .cmail_ih_flatten_conditionals(ctx, text, node)
  for (re in c(.CMAIL_IH_SM_TAG_RE, .CMAIL_IH_MC_TAG_RE)) {
    m <- gregexpr(re, text, perl = TRUE)
    hits <- regmatches(text, m)[[1]]
    if (!length(hits)) next
    regmatches(text, m) <- list(vapply(hits, function(h) {
      k <- .cmail_ih_token(ctx, h, node)
      if (nzchar(k)) paste0("\u0001", k, "\u0002") else ""
    }, ""))
  }
  text
}

# Condicionales de Mailchimp. La plantilla no los tiene: queda la PRIMERA rama
# para todos y se informa `conditional_flattened` con las dos ramas (revisión
# metodológica E1jkl, casos B y C), salvo los dos que la plantilla sí
# representa: el saludo con *|IF:FNAME|* (texto + respaldo) y el campo con
# respaldo *|IF:T|**|T|**|ELSE:|*Y*|END:IF|*. IFNOT nunca concatena sus ramas.
.CMAIL_IH_COND_RE <- "(?s)\\*\\|(IF|IFNOT):([A-Za-z0-9_]+)\\|\\*(.*?)(?:\\*\\|ELSE:\\|\\*(.*?))?\\*\\|END:IF\\|\\*"

.cmail_ih_flatten_conditionals <- function(ctx, text, node = NULL) {
  m <- gregexpr(.CMAIL_IH_COND_RE, text, perl = TRUE)
  hits <- regmatches(text, m)[[1]]
  if (!length(hits)) return(text)
  plain <- function(x) trimws(gsub("\u0006", "*", gsub("[\u0001\u0002\u0004]|\\*\\*", "", .cmail_ih_ws(x))))
  regmatches(text, m) <- list(vapply(hits, function(h) {
    p <- regmatches(h, regexec(.CMAIL_IH_COND_RE, h, perl = TRUE))[[1]]
    op <- p[[2]]; tag <- toupper(p[[3]]); then <- p[[4]]; other <- if (length(p) >= 5L) p[[5]] else ""
    represented <- identical(op, "IF") && (identical(tag, "FNAME") || identical(trimws(then), sprintf("*|%s|*", tag)))
    if (!represented) {
      cond <- if (identical(op, "IF")) sprintf("Si %s", tag) else sprintf("Si NO %s", tag)
      .cmail_ih_report(ctx, "conditional_flattened",
        "La plantilla no tiene condicionales: la primera rama quedó para todos y la otra se descartó. Si la otra rama era para otro grupo, va en otro envío o en otra campaña.",
        node, excerpt = sprintf("%s: «%s»%s", cond, plain(then), if (nzchar(other)) sprintf(" / si no: «%s»", plain(other)) else ""))
    }
    then
  }, ""))
  text
}

# ---- texto en línea -----------------------------------------------------------

.cmail_ih_bold_style <- function(node) {
  st <- .cmail_ih_style(node)
  w <- .cmail_ih_decl(st, "font-weight")
  !is.null(w) && grepl("bold|bolder|[6-9]00", w)
}

.cmail_ih_italic_style <- function(node) {
  f <- .cmail_ih_decl(.cmail_ih_style(node), "font-style")
  !is.null(f) && grepl("italic|oblique", f)
}

# Envuelve un texto en una marca (`**` negrita; \u0004 la cursiva, que
# `.cmail_ih_finish` vuelve `*`), sin espacios dentro y línea por línea: la
# marca no cruza saltos (collection_mail_marks.R).
.cmail_ih_wrap <- function(inner, mark) {
  if (!nzchar(trimws(inner))) return(inner)
  lead <- sub("^(\\s*).*$", "\\1", inner)
  tail <- sub("^.*?(\\s*)$", "\\1", inner, perl = TRUE)
  body <- gsub("\\s*\n\\s*", paste0(mark, "\n", mark), trimws(inner))
  paste0(lead, mark, body, mark, tail)
}

# URL de un href: http(s)/mailto o una etiqueta de plataforma. NULL si no sirve.
.cmail_ih_href <- function(ctx, node) {
  href <- trimws(xml2::xml_attr(node, "href"))
  if (is.na(href) || !nzchar(href) || identical(href, "#")) return(NULL)
  if (grepl("^\\s*(javascript|data|vbscript):", href, ignore.case = TRUE)) {
    .cmail_ih_report(ctx, "unsafe_link_discarded", "Se quitó un enlace javascript:, data: o vbscript:; queda el texto.", node,
                     excerpt = substr(href, 1L, 60L))
    return(NULL)
  }
  if (grepl(sprintf("^(%s|%s)$", .CMAIL_IH_SM_TAG_RE, .CMAIL_IH_MC_TAG_RE), href, perl = TRUE)) {
    k <- .cmail_ih_token(ctx, href, node)
    if (nzchar(k)) return(paste0("\u0001", k, "\u0002"))
    label <- trimws(.cmail_ih_ws(xml2::xml_text(node)))
    if (nzchar(label)) ctx$platform_labels <- unique(c(ctx$platform_labels, label))
    footer_tag <- grepl("OptOutLink|PrivacyLink|FooterLink|RemoveLink|UNSUB|LIST:", href)
    .cmail_ih_report(ctx, "platform_link_removed",
      if (footer_tag) "Es un enlace de la plataforma: el pie del correo lo vuelve a poner; aquí quedó solo su texto."
      else "Es un enlace de la plataforma sin equivalente en la plantilla: se quitó y quedó solo su texto.",
      node, excerpt = sprintf("%s -> %s", label, href))
    return("")
  }
  if (grepl("^(https?://|mailto:)", href, ignore.case = TRUE)) {
    return(.cmail_ih_tags_in(ctx, gsub("[\\s\"'<>()]", "", href, perl = TRUE), node))
  }
  NULL
}

.cmail_ih_inline <- function(ctx, node, links = TRUE) {
  type <- xml2::xml_type(node)
  if (identical(type, "text") || identical(type, "cdata")) {
    # Un asterisco literal del autor se escapa (\u0006 -> `\*` al cerrar) para
    # que «5*3» no se lea como cursiva; los de una etiqueta *|TAG|* se quedan.
    return(gsub("(?<!\\|)\\*(?!\\|)", "\u0006", .cmail_ih_ws(xml2::xml_text(node)), perl = TRUE))
  }
  if (!identical(type, "element")) return("")
  nm <- xml2::xml_name(node)
  if (identical(nm, "br")) return("\n")
  if (identical(nm, "img")) return("")
  inner <- paste(vapply(xml2::xml_contents(node), function(n) .cmail_ih_inline(ctx, n, links), ""), collapse = "")
  # Cursiva (E1n): <em>, <i> o font-style:italic pasan a *…*; en un enlace va
  # dentro de la etiqueta del enlace.
  italic <- nm %in% c("em", "i") || .cmail_ih_italic_style(node)
  if (italic) inner <- .cmail_ih_wrap(inner, "\u0004")
  if (nm %in% c("strong", "b") || .cmail_ih_bold_style(node)) return(.cmail_ih_wrap(inner, "**"))
  if (italic && !identical(nm, "a")) return(inner)
  if (nm %in% c("s", "strike", "del") && nzchar(trimws(inner))) {
    .cmail_ih_report(ctx, "strike_plain",
      "El tachado queda como texto normal y se lee igual que el resto: revisa si ese texto debía borrarse.", node)
  }
  if (identical(nm, "a")) {
    url <- .cmail_ih_href(ctx, node)
    label <- trimws(inner)
    if (!is.null(url) && nzchar(url) && nzchar(label) && isTRUE(links)) {
      label <- gsub("[\\[\\]\n]", " ", label)
      return(sprintf("[%s](%s)", label, url))
    }
    return(inner)
  }
  inner
}

# Cierra un texto: neutraliza lo que la plantilla no admite, vuelve los
# marcadores {{campo}} y limpia negritas y espacios.
.cmail_ih_finish <- function(ctx, text, node = NULL) {
  text <- .cmail_ih_tags_in(ctx, text, node)
  # Llaves y etiquetas literales del autor (dispararían bad_token / raw_merge_tag).
  text <- gsub("\\{\\{", "{ {", text)
  text <- gsub("\\}\\}", "} }", text)
  # Un «*|» o «|*» literal se separa y su asterisco queda escapado.
  text <- gsub("*|", "\u0006 |", text, fixed = TRUE)
  text <- gsub("|*", "| \u0006", text, fixed = TRUE)
  esc <- grepl("<\\s*/?\\s*[A-Za-z!?]", text, perl = TRUE) || grepl("&[A-Za-z#][A-Za-z0-9]*;", text, perl = TRUE)
  if (esc) {
    # «<» + letra no basta separarlo con un espacio (el contrato lo leería igual
    # como HTML): se cambia por «‹». La entidad sí se separa: «& nbsp;».
    text <- gsub("<(\\s*/?\\s*[A-Za-z!?])", "\u2039\\1", text, perl = TRUE)
    text <- gsub("&([A-Za-z#][A-Za-z0-9]*;)", "& \\1", text, perl = TRUE)
    if (!isTRUE(ctx$escaped_reported)) {
      ctx$escaped_reported <- TRUE
      .cmail_ih_report(ctx, "text_escaped", "Un «<» o una entidad literal se separó con un espacio para que no se lea como HTML.", node)
    }
  }
  text <- gsub("\u0001([a-z][a-z0-9_]*)\u0002", "{{\\1}}", text, perl = TRUE)
  text <- gsub("[\u0001\u0002]", "", text)
  lines <- strsplit(text, "\n", fixed = TRUE)[[1]]
  lines <- vapply(lines, function(l) {
    l <- gsub("\\*\\*\\*\\*", "", l)
    l <- gsub("\\*\\*\\s*\\*\\*", " ", l)
    # Cursiva vacía fuera; dos seguidas, una sola.
    l <- gsub("\u0004\u0004", "", l, fixed = TRUE)
    l <- gsub("\u0004\\s+\u0004", " ", l, perl = TRUE)
    l <- gsub("[ ]+", " ", l)
    trimws(l)
  }, "", USE.NAMES = FALSE)
  lines <- gsub("\u0006", "\\*", gsub("\u0004", "*", lines, fixed = TRUE), fixed = TRUE)
  # Sin líneas vacías al borde ni dobles.
  lines <- lines[cumsum(nzchar(lines)) > 0]
  while (length(lines) && !nzchar(lines[[length(lines)]])) lines <- lines[-length(lines)]
  paste(lines, collapse = "\n")
}

.cmail_ih_text <- function(ctx, nodes, links = TRUE) {
  raw <- paste(vapply(nodes, function(n) .cmail_ih_inline(ctx, n, links), ""), collapse = "")
  .cmail_ih_finish(ctx, raw, if (length(nodes)) nodes[[1]] else NULL)
}

.cmail_ih_strip_links <- function(text, ctx = NULL, where = NULL) {
  if (!is.null(ctx)) {
    for (l in unlist(lapply(text, .cmail_links), recursive = FALSE)) {
      .cmail_ih_report(ctx, "link_discarded",
        sprintf("%s no admite enlaces: quedó el texto y se perdió la URL; ponla en un párrafo si hace falta.", where %||% "Este texto"),
        excerpt = sprintf("%s -> %s", l$label, gsub("[\u0001\u0002]", "", l$url)))
    }
  }
  gsub(.CMAIL_LINK_RE, "\\1", text, perl = TRUE)
}
.cmail_ih_unbold <- function(text) trimws(gsub("**", "", text, fixed = TRUE))
.cmail_ih_all_bold <- function(text) grepl("^\\*\\*[^*]+\\*\\*$", trimws(text))

# ---- estilos (dos valores validados) ------------------------------------------

# Reglas simples de un <style>: selector -> declaraciones (minúsculas).
.cmail_ih_css_rules <- function(css) {
  css <- gsub("/\\*.*?\\*/", "", css, perl = TRUE)
  m <- regmatches(css, gregexpr("[^{}]+\\{[^{}]*\\}", css, perl = TRUE))[[1]]
  lapply(m, function(r) {
    sel <- trimws(sub("\\{.*$", "", r))
    decl <- tolower(sub("\\}$", "", sub("^[^{]*\\{", "", r)))
    list(selectors = trimws(strsplit(sel, ",", fixed = TRUE)[[1]]), decl = decl)
  })
}

.cmail_ih_read_styles <- function(ctx, doc) {
  styles <- xml2::xml_find_all(doc, "//style")
  for (st in styles) {
    css <- xml2::xml_text(st)
    rules <- .cmail_ih_css_rules(css)
    hover <- FALSE
    for (r in rules) {
      for (sel in r$selectors) {
        if (grepl(":hover|:focus|:active", sel)) { hover <- TRUE; next }
        cls <- regmatches(sel, regexec("^\\.([A-Za-z0-9_-]+)$", sel))[[1]]
        if (length(cls) == 2L) {
          al <- .cmail_ih_decl(r$decl, "text-align")
          if (!is.null(al) && grepl("justify|center", al)) {
            ctx$css_align[[tolower(cls[[2]])]] <- if (grepl("justify", al)) "justify" else "center"
          }
        }
        if (is.null(ctx$accent) && grepl("button|btn|cta", sel, ignore.case = TRUE) && !grepl(":", sel)) {
          ctx$accent <- .cmail_ih_hex(.cmail_ih_decl(r$decl, "background-color") %||% .cmail_ih_decl(r$decl, "background"))
        }
      }
    }
    for (r in rules) for (sel in r$selectors) {
      cls <- regmatches(sel, regexec("^\\.([A-Za-z0-9_-]+)$", sel))[[1]]
      if (length(cls) == 2L && grepl("separator|divider|separador|line", cls[[2]], ignore.case = TRUE)) {
        ctx$css_separator[[tolower(cls[[2]])]] <- r$decl
      }
    }
    .cmail_ih_report(ctx, "style_discarded",
                     "Los estilos los pone la plantilla; se leyó solo el color del botón y la alineación.",
                     node = st, excerpt = .cmail_ih_ws(css), selector = if (identical(xml2::xml_name(xml2::xml_parent(st)), "head")) "head > style" else NULL)
    if (hover) {
      .cmail_ih_report(ctx, "hover_ignored", "Los estados :hover no existen en un correo; se ignoraron.",
                       node = st, excerpt = paste(unlist(lapply(rules, function(r) Filter(function(s) grepl(":hover|:focus|:active", s), r$selectors))), collapse = ", "),
                       selector = "head > style")
    }
    ctx$discarded <- unique(c(ctx$discarded, "style"))
  }
}

.cmail_ih_align <- function(ctx, node) {
  n <- node
  for (i in 1:8) {
    if (inherits(n, "xml_missing") || !identical(xml2::xml_type(n), "element")) break
    al <- .cmail_ih_decl(.cmail_ih_style(n), "text-align")
    if (!is.null(al)) {
      if (grepl("justify", al)) return("justify")
      if (grepl("center", al)) return("center")
      return(NULL)
    }
    for (c in .cmail_ih_classes(n)) if (!is.null(ctx$css_align[[c]])) return(ctx$css_align[[c]])
    if (xml2::xml_name(n) %in% c("body", "table")) break
    n <- xml2::xml_parent(n)
  }
  NULL
}

# Color de fondo (inline o bgcolor) de un nodo o de sus ancestros cercanos.
.cmail_ih_bg <- function(node, up = 3L) {
  n <- node
  for (i in seq_len(up)) {
    if (inherits(n, "xml_missing") || !identical(xml2::xml_type(n), "element")) break
    h <- .cmail_ih_hex(.cmail_ih_decl(.cmail_ih_style(n), "background-color") %||% .cmail_ih_decl(.cmail_ih_style(n), "background"))
    if (!is.null(h)) return(h)
    n <- xml2::xml_parent(n)
  }
  NULL
}

# ---- linealización ------------------------------------------------------------

.cmail_ih_hidden <- function(node) {
  st <- .cmail_ih_style(node)
  grepl("display\\s*:\\s*none", st) || grepl("visibility\\s*:\\s*hidden", st) ||
    grepl("max-height\\s*:\\s*0", st) && grepl("overflow\\s*:\\s*hidden", st)
}

# Separador: hr, o un elemento sin texto con borde, clase separator/divider o
# un fondo con alto (la franja de cierre). Devuelve list(px, color) o NULL.
.cmail_ih_separator <- function(ctx, node) {
  nm <- xml2::xml_name(node)
  if (identical(nm, "hr")) return(list(px = 1L, color = NULL))
  if (!(nm %in% c("div", "td", "p", "span", "tr", "table", "center"))) return(NULL)
  txt <- trimws(.cmail_ih_ws(xml2::xml_text(node)))
  if (nzchar(txt)) return(NULL)
  if (length(xml2::xml_find_all(node, ".//img"))) return(NULL)
  st <- .cmail_ih_style(node)
  cls <- .cmail_ih_classes(node)
  for (c in cls) {
    d <- ctx$css_separator[[c]]
    if (!is.null(d)) st <- paste(st, d, sep = ";")
  }
  border <- .cmail_ih_decl(st, "border-top") %||% .cmail_ih_decl(st, "border-bottom") %||% .cmail_ih_decl(st, "border")
  bg <- .cmail_ih_hex(.cmail_ih_decl(st, "background-color") %||% .cmail_ih_decl(st, "background"))
  height <- .cmail_ih_decl(st, "height")
  px_of <- function(x) { v <- suppressWarnings(as.integer(sub("^\\D*(\\d+)px.*$", "\\1", x %||% ""))); if (length(v) && !is.na(v)) v else NA_integer_ }
  if (!is.null(border) && !grepl("none", border)) {
    return(list(px = .cmail_ih_na(px_of(border), 1L), color = .cmail_ih_hex(border)))
  }
  if (!is.null(bg) && !is.null(height)) return(list(px = .cmail_ih_na(px_of(height), 1L), color = bg))
  if (any(grepl("separator|divider|separador", cls))) return(list(px = 1L, color = bg))
  NULL
}

.cmail_ih_na <- function(a, b) if (length(a) && !is.na(a[[1]])) a else b

# Una fila de tabla con dos o más celdas con contenido.
.cmail_ih_multicol <- function(node) {
  if (!identical(xml2::xml_name(node), "table")) return(FALSE)
  rows <- xml2::xml_find_all(node, "./tr | ./tbody/tr | ./thead/tr")
  any(vapply(rows, function(r) {
    cells <- xml2::xml_find_all(r, "./td | ./th")
    sum(vapply(cells, function(c) nzchar(trimws(.cmail_ih_ws(xml2::xml_text(c)))) || length(xml2::xml_find_all(c, ".//img")) > 0L, NA)) >= 2L
  }, NA))
}

# Fila de varias columnas que solo trae imágenes (una franja de logos).
.cmail_ih_image_row <- function(node) {
  txt <- trimws(.cmail_ih_ws(xml2::xml_text(node)))
  !nzchar(txt) && length(xml2::xml_find_all(node, ".//img")) > 0L
}

.cmail_ih_push <- function(ctx, seg) {
  ctx$segs[[length(ctx$segs) + 1L]] <- seg
}

.cmail_ih_flush <- function(ctx, run, container) {
  run <- Filter(function(n) {
    t <- xml2::xml_type(n)
    !(t %in% c("text", "cdata")) || nzchar(trimws(.cmail_ih_ws(xml2::xml_text(n))))
  }, run)
  if (!length(run)) return(invisible(NULL))
  # Imágenes sueltas dentro del texto: salen como imagen aparte.
  elems <- Filter(function(n) identical(xml2::xml_type(n), "element"), run)
  for (n in elems) {
    imgs <- if (identical(xml2::xml_name(n), "img")) list(n) else xml2::xml_find_all(n, ".//img")
    for (im in imgs) .cmail_ih_push(ctx, list(kind = "img", node = im, link = .cmail_ih_img_link(ctx, im)))
  }
  texts <- Filter(function(n) !(identical(xml2::xml_type(n), "element") && identical(xml2::xml_name(n), "img")), run)
  if (!length(texts)) return(invisible(NULL))
  only <- Filter(function(n) identical(xml2::xml_type(n), "element") && !identical(xml2::xml_name(n), "br"), texts)
  if (length(texts) == 1L && length(only) == 1L && identical(xml2::xml_name(only[[1]]), "a")) {
    .cmail_ih_push(ctx, list(kind = "a_alone", node = only[[1]], container = container))
    return(invisible(NULL))
  }
  text <- .cmail_ih_text(ctx, texts)
  if (!nzchar(text)) return(invisible(NULL))
  ctx$seen_text <- TRUE
  .cmail_ih_push(ctx, list(kind = "text", text = text, node = texts[[1]], container = container, nodes = texts,
                           align = .cmail_ih_align(ctx, .cmail_ih_elem_or_parent(texts[[1]]))))
}

.cmail_ih_elem_or_parent <- function(n) if (identical(xml2::xml_type(n), "element")) n else xml2::xml_parent(n)

.cmail_ih_img_link <- function(ctx, img) {
  a <- xml2::xml_find_first(img, "./ancestor::a[1]")
  if (inherits(a, "xml_missing")) return(NULL)
  .cmail_ih_href(ctx, a)
}

.cmail_ih_walk <- function(ctx, node) {
  run <- list()
  container <- node
  for (child in xml2::xml_contents(node)) {
    type <- xml2::xml_type(child)
    if (type %in% c("text", "cdata")) { run[[length(run) + 1L]] <- child; next }
    if (!identical(type, "element")) next
    nm <- xml2::xml_name(child)
    if (nm %in% .CMAIL_IH_INLINE && !identical(nm, "img") && !.cmail_ih_hidden(child)) {
      run[[length(run) + 1L]] <- child
      next
    }
    .cmail_ih_flush(ctx, run, container); run <- list()
    .cmail_ih_block(ctx, child, container)
  }
  .cmail_ih_flush(ctx, run, container)
}

.cmail_ih_block <- function(ctx, node, container) {
  nm <- xml2::xml_name(node)
  if (.cmail_ih_hidden(node)) {
    txt <- trimws(.cmail_ih_ws(xml2::xml_text(node)))
    if (is.null(ctx$preheader) && !isTRUE(ctx$seen_text) && nzchar(txt)) {
      ctx$preheader <- .cmail_ih_finish(ctx, txt, node)
    } else if (nzchar(txt)) {
      .cmail_ih_report(ctx, "hidden_discarded", "Había texto oculto (display:none): un correo no debe esconder contenido.", node)
    }
    return(invisible(NULL))
  }
  sep <- .cmail_ih_separator(ctx, node)
  if (!is.null(sep)) { .cmail_ih_push(ctx, list(kind = "sep", px = sep$px, color = sep$color, node = node)); return(invisible(NULL)) }
  if (identical(nm, "img")) { .cmail_ih_push(ctx, list(kind = "img", node = node, link = .cmail_ih_img_link(ctx, node))); return(invisible(NULL)) }
  if (nm %in% .CMAIL_IH_HEADINGS) {
    text <- .cmail_ih_text(ctx, list(node), links = FALSE)
    if (nzchar(text)) { ctx$seen_text <- TRUE; .cmail_ih_push(ctx, list(kind = "heading", level = nm, text = text, node = node,
                                                                  align = .cmail_ih_align(ctx, node))) }
    return(invisible(NULL))
  }
  if (nm %in% c("ul", "ol")) {
    items <- vapply(xml2::xml_find_all(node, "./li"), function(li) .cmail_ih_text(ctx, list(li)), "")
    items <- items[nzchar(items)]
    if (length(items)) { ctx$seen_text <- TRUE; .cmail_ih_push(ctx, list(kind = "list", ordered = identical(nm, "ol"), items = items, node = node)) }
    return(invisible(NULL))
  }
  if (identical(nm, "p")) {
    kids <- Filter(function(n) identical(xml2::xml_type(n), "element"), xml2::xml_contents(node))
    has_text <- nzchar(trimws(.cmail_ih_ws(xml2::xml_text(node))))
    if (!has_text && length(xml2::xml_find_all(node, ".//img"))) {
      for (im in xml2::xml_find_all(node, ".//img")) .cmail_ih_push(ctx, list(kind = "img", node = im, link = .cmail_ih_img_link(ctx, im)))
      return(invisible(NULL))
    }
    if (length(kids) == 1L && identical(xml2::xml_name(kids[[1]]), "a") &&
        identical(trimws(.cmail_ih_ws(xml2::xml_text(node))), trimws(.cmail_ih_ws(xml2::xml_text(kids[[1]]))))) {
      ctx$seen_text <- TRUE
      .cmail_ih_push(ctx, list(kind = "a_alone", node = kids[[1]], container = container))
      return(invisible(NULL))
    }
    text <- .cmail_ih_text(ctx, xml2::xml_contents(node))
    if (nzchar(text)) {
      ctx$seen_text <- TRUE
      .cmail_ih_push(ctx, list(kind = "text", text = text, node = node, container = container, para = TRUE,
                               align = .cmail_ih_align(ctx, node)))
    } else {
      ctx$dropped_empty <- ctx$dropped_empty + 1L
    }
    return(invisible(NULL))
  }
  if (nm %in% .CMAIL_IH_DROP) {
    .cmail_ih_report(ctx, "element_discarded", sprintf("Se descartó <%s>: un correo no lo admite.", nm), node)
    ctx$discarded <- unique(c(ctx$discarded, nm))
    return(invisible(NULL))
  }
  if (identical(nm, "table") && .cmail_ih_multicol(node)) {
    if (.cmail_ih_image_row(node)) {
      for (im in xml2::xml_find_all(node, ".//img")) .cmail_ih_push(ctx, list(kind = "img", node = im, link = .cmail_ih_img_link(ctx, im)))
      return(invisible(NULL))
    }
    text <- .cmail_ih_cells_text(ctx, node)
    if (nzchar(text)) {
      ctx$seen_text <- TRUE
      .cmail_ih_push(ctx, list(kind = "unrecognized", text = text, node = node,
                               reason = "Una tabla de varias columnas no tiene bloque propio; su texto quedó como párrafo."))
    }
    return(invisible(NULL))
  }
  # Celda con fondo o borde a la izquierda que abre con una línea en negrita:
  # un recuadro (franja o tinte).
  if (nm %in% c("td", "div") && !length(xml2::xml_find_all(node, ".//td | .//div | .//p | .//table | .//ul | .//ol"))) {
    st <- .cmail_ih_style(node)
    tinted <- !is.null(.cmail_ih_hex(.cmail_ih_decl(st, "background-color")))
    barred <- !is.null(.cmail_ih_decl(st, "border-left"))
    if (tinted || barred) {
      text <- .cmail_ih_text(ctx, xml2::xml_contents(node))
      lines <- strsplit(text, "\n", fixed = TRUE)[[1]]
      if (length(lines) >= 2L && .cmail_ih_all_bold(lines[[1]])) {
        ctx$seen_text <- TRUE
        .cmail_ih_push(ctx, list(kind = "callout_cell", title = .cmail_ih_unbold(lines[[1]]), items = lines[-1],
                                 variant = if (barred) "bar" else "tinte", node = node))
        return(invisible(NULL))
      }
    }
  }
  known <- c("div", "td", "th", "tr", "tbody", "thead", "tfoot", "table", "center", "section", "article", "main",
             "header", "footer", "body", "blockquote", "figure", "figcaption", "nav", "aside", "address", "li", "dl", "dd", "dt", "pre")
  if (!(nm %in% known)) {
    text <- .cmail_ih_text(ctx, list(node))
    if (nzchar(text)) {
      ctx$seen_text <- TRUE
      .cmail_ih_push(ctx, list(kind = "unrecognized", text = text, node = node,
                               reason = sprintf("<%s> no tiene bloque propio; su texto quedó como párrafo.", nm)))
    }
    return(invisible(NULL))
  }
  .cmail_ih_walk(ctx, node)
}

.cmail_ih_cells_text <- function(ctx, table) {
  cells <- xml2::xml_find_all(table, ".//td | .//th")
  leaf <- Filter(function(c) !length(xml2::xml_find_all(c, ".//td | .//th")), cells)
  parts <- vapply(leaf, function(c) .cmail_ih_text(ctx, xml2::xml_contents(c)), "")
  paste(parts[nzchar(parts)], collapse = "\n")
}

# ---- clasificación ------------------------------------------------------------

.cmail_ih_image <- function(ctx, node) {
  src <- trimws(xml2::xml_attr(node, "src"))
  if (is.na(src)) src <- ""
  alt <- trimws(.cmail_ih_ws(.cmail_ih_na(xml2::xml_attr(node, "alt"), "")))
  width <- suppressWarnings(as.integer(sub("px$", "", .cmail_ih_na(xml2::xml_attr(node, "width"), ""))))
  base <- if (nzchar(src) && !grepl("^data:", src, ignore.case = TRUE)) sub("\\?.*$", "", basename(src)) else ""
  base <- sub("\\.[A-Za-z0-9]+$", "", base)
  id <- .cmail_ih_slug(base, 60L) %||% .cmail_ih_slug(alt, 60L) %||% "imagen"
  taken <- names(ctx$images)
  if (id %in% taken) {
    k <- 2L
    while (paste0(substr(id, 1L, 57L), "-", k) %in% taken) k <- k + 1L
    id <- paste0(substr(id, 1L, 57L), "-", k)
  }
  url <- if (grepl("^https://", src)) gsub("[\\s\"'<>]", "", src, perl = TRUE) else NULL
  if (grepl("^http://", src)) {
    .cmail_ih_report(ctx, "image_http", "La imagen usa http:// (no seguro); súbela o dale una URL https.", node, excerpt = src)
  } else if (is.null(url)) {
    .cmail_ih_report(ctx, "image_needs_upload",
                     if (grepl("^data:", src, ignore.case = TRUE)) "La imagen venía incrustada (data:): súbela al proyecto o dale una URL https."
                     else "La imagen no tiene URL https pública: súbela al proyecto o dale una URL https.",
                     node, excerpt = if (grepl("^data:", src, ignore.case = TRUE)) "data:…" else src)
  }
  alt_txt <- .cmail_ih_finish(ctx, .cmail_ih_strip_links(alt))
  alt_txt <- gsub("\\{\\{[^}]*\\}\\}", "", alt_txt)
  ctx$images[[id]] <- .cmc_drop_nulls_deep(list(alt = alt_txt, url = url))
  ctx$image_list[[length(ctx$image_list) + 1L]] <- .cmc_drop_nulls_deep(list(
    id = id, url = url, alt = alt_txt, status = if (is.null(url)) "needs_upload" else "url"))
  list(id = id, width = if (length(width) && !is.na(width)) width else NULL, name = base, alt = alt_txt)
}

# Enlace del pie de la plataforma (baja, privacidad, pie).
.cmail_ih_footer_link <- function(a) {
  href <- .cmail_ih_na(xml2::xml_attr(a, "href"), "")
  grepl("^(\\[(OptOutLink|PrivacyLink|FooterLink|RemoveLink)\\]|\\*\\|(UNSUB|LIST:[A-Z0-9_]+)\\|\\*)$", trimws(href))
}

.cmail_ih_alt_missing <- function(ctx, node, im, block_id) {
  .cmail_ih_report(ctx, "image_alt_missing",
    sprintf("La imagen no tiene texto alternativo: quedó «%s»; escribe qué dice.", .CMAIL_ALT_MARKER),
    node, excerpt = ctx$images[[im$id]]$url %||% im$id, block_id = block_id)
}

.cmail_ih_is_button <- function(ctx, a, container) {
  if (.cmail_ih_footer_link(a)) return(FALSE)
  cls <- .cmail_ih_classes(a)
  st <- .cmail_ih_style(a)
  href <- .cmail_ih_na(xml2::xml_attr(a, "href"), "")
  any(grepl("button|btn|cta|boton", cls)) ||
    !is.null(.cmail_ih_hex(.cmail_ih_decl(st, "background-color") %||% .cmail_ih_decl(st, "background"))) ||
    (grepl("padding", st) && grepl("inline-block|block", st)) ||
    grepl("^\\[SurveyLink\\]$", href) || grepl("^\\*\\|[A-Z0-9_]+\\|\\*$", href)
}

# Saludo: texto corto que abre como saludo (o lleva el nombre) y cierra en , o :.
.cmail_ih_greeting <- function(text) {
  if (grepl("\n", text, fixed = TRUE) || nchar(text) > 120L) return(FALSE)
  plain <- .cmail_ih_unbold(.cmail_ih_strip_links(text))
  grepl("[,:]$", plain) && (grepl(.CMAIL_IH_GREETING_RE, text, perl = TRUE) || grepl("{{nombre}}", text, fixed = TRUE))
}

# «Estimado(a)», «Estimado/a», «Querida(o)»…: la palabra inclusiva del saludo
# pasa a trato por sexo SIN columna (collection_mail_trato.R): sigue diciendo el
# texto original (el respaldo) hasta que se declare la columna, y se informa.
.CMAIL_IH_TRATO_RE <- "(Estimad|Querid|Apreciad|Distinguid)([oa])\\s*(?:\\(\\s*([oa])\\s*\\)|/\\s*([oa]))"

.cmail_ih_trato <- function(ctx, text) {
  m <- regmatches(text, regexec(.CMAIL_IH_TRATO_RE, text, perl = TRUE))[[1]]
  if (length(m) < 5L) return(NULL)
  other <- if (nzchar(m[[4]])) m[[4]] else m[[5]]
  if (identical(other, m[[3]])) return(NULL)
  tr <- list(modo = "por_sexo", masculino = paste0(m[[2]], "o"), femenino = paste0(m[[2]], "a"), respaldo = m[[1]])
  .cmail_ih_report(ctx, "greeting_trato_detected",
    sprintf("El saludo «%s» quedó como trato por sexo: declara la columna de sexo de la lista para que diga «%s» o «%s»; mientras tanto dice «%s» a todos.",
            tr$respaldo, tr$masculino, tr$femenino, tr$respaldo),
    excerpt = tr$respaldo, block_id = "saludo")
  tr
}

.cmail_ih_greeting_fallback <- function(text) {
  fb <- gsub("\\s*\\{\\{nombre\\}\\}\\s*", " ", text)
  fb <- gsub("\\s+([,:.;])", "\\1", fb)
  fb <- gsub("\\*\\*\\s+", "**", fb)
  fb <- gsub("\\s+\\*\\*", "**", fb)
  trimws(gsub("\\s+", " ", fb))
}

# Corta un texto largo en el borde de una oración.
.cmail_ih_split_long <- function(text, max = .CMAIL_MAX_TEXT) {
  out <- character(0)
  while (nchar(text) > max) {
    head <- substr(text, 1L, max)
    cut <- max(gregexpr("[.!?]\\s", head, perl = TRUE)[[1]])
    if (cut < 1L) cut <- max(gregexpr("\\s", head, perl = TRUE)[[1]])
    if (cut < 1L) cut <- max - 1L
    out <- c(out, trimws(substr(text, 1L, cut)))
    text <- trimws(substr(text, cut + 1L, nchar(text)))
  }
  c(out, text)
}

.cmail_ih_classify <- function(ctx) {
  segs <- ctx$segs %||% list()
  blocks <- list()
  header <- NULL
  counters <- list()
  next_id <- function(base) {
    counters[[base]] <<- (counters[[base]] %||% 0L) + 1L
    if (counters[[base]] == 1L && base %in% c("saludo", "boton", "firma", "pie")) return(base)
    sprintf("%s-%d", base, counters[[base]])
  }
  used_ids <- character(0)
  uniq <- function(id) {
    id <- substr(id, 1L, 40L)
    if (!(id %in% used_ids)) { used_ids <<- c(used_ids, id); return(id) }
    k <- 2L
    while (paste0(substr(id, 1L, 37L), "-", k) %in% used_ids) k <- k + 1L
    id <- paste0(substr(id, 1L, 37L), "-", k)
    used_ids <<- c(used_ids, id)
    id
  }
  add <- function(b) {
    b$block_id <- uniq(b$block_id)
    blocks[[length(blocks) + 1L]] <<- b
    b$block_id
  }

  # Cabecera: imágenes antes de todo texto.
  i <- 1L
  lead <- list()
  while (i <= length(segs) && segs[[i]]$kind %in% c("img", "sep")) {
    if (identical(segs[[i]]$kind, "img")) lead[[length(lead) + 1L]] <- segs[[i]]
    i <- i + 1L
  }
  if (length(lead)) {
    first <- .cmail_ih_image(ctx, lead[[1]]$node)
    in_header <- !inherits(xml2::xml_find_first(lead[[1]]$node,
      "./ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' header ') or contains(@class, 'banner')][1]"), "xml_missing")
    big <- (!is.null(first$width) && first$width >= 480L) || grepl("-(9[6-9][0-9]|1[0-9]{3})$", first$name) ||
      grepl("banner|cabecera|encabezado", first$name, ignore.case = TRUE) || (length(lead) == 1L && in_header)
    if (big) {
      header <- list(kind = "banner", image_ref = first$id)
      rest <- lead[-1]
    } else {
      ids <- first$id
      rest <- list()
      for (s in lead[-1]) {
        if (length(ids) < 6L) ids <- c(ids, .cmail_ih_image(ctx, s$node)$id) else rest[[length(rest) + 1L]] <- s
      }
      header <- list(kind = "logos", logo_ids = as.list(ids))
    }
    # Sin alt no se inventa uno: queda vacío, se informa y la revisión (images_alt) lo marca.
    for (id in unlist(c(header$image_ref, header$logo_ids))) {
      if (!nzchar(ctx$images[[id]]$alt %||% "")) {
        .cmail_ih_report(ctx, "image_alt_missing",
          "La imagen no tiene texto alternativo: escribe qué dice (es lo que se lee con las imágenes bloqueadas).",
          lead[[1]]$node, excerpt = ctx$images[[id]]$url %||% id, block_id = "__cabecera")
      }
    }
    for (s in rest) {
      im <- .cmail_ih_image(ctx, s$node)
      add(.cmc_drop_nulls_deep(list(block_id = next_id("imagen"), type = "image", image_ref = im$id,
                                    alt = if (nzchar(im$alt)) im$alt else .CMAIL_ALT_MARKER,
                                    width = if (!is.null(im$width)) max(40L, min(600L, im$width)), url = s$link)))
      if (!nzchar(im$alt)) .cmail_ih_alt_missing(ctx, s$node, im, blocks[[length(blocks)]]$block_id)
    }
  } else {
    ctx$images[["logo"]] <- list(alt = "Logo")
    ctx$image_list[[length(ctx$image_list) + 1L]] <- list(id = "logo", alt = "Logo", status = "needs_upload")
    header <- list(kind = "logos", logo_ids = list("logo"))
    .cmail_ih_report(ctx, "header_missing", "El correo no traía cabecera con imagen: se dejó un logo por subir.", excerpt = "")
  }
  segs <- if (i <= length(segs)) segs[i:length(segs)] else list()

  # Pie: lo que sigue al último separador (si trae texto) o lleva baja/privacidad.
  seps <- which(vapply(segs, function(s) identical(s$kind, "sep"), NA))
  footer_from <- NA_integer_
  if (length(seps)) {
    last <- max(seps)
    after <- if (last < length(segs)) segs[(last + 1L):length(segs)] else list()
    if (length(after) && all(vapply(after, function(s) s$kind %in% c("text", "a_alone", "unrecognized"), NA))) footer_from <- last + 1L
  }
  if (is.na(footer_from)) {
    for (k in rev(seq_along(segs))) {
      s <- segs[[k]]
      footer_like <- (identical(s$kind, "text") && grepl(.CMAIL_IH_FOOTER_RE, s$text, perl = TRUE)) ||
        (identical(s$kind, "a_alone") && .cmail_ih_footer_link(s$node))
      if (footer_like) footer_from <- k else break
    }
    if (!is.na(footer_from)) {
      for (s in Filter(function(x) identical(x$kind, "text"), segs[footer_from:length(segs)])) {
        .cmail_ih_report(ctx, "moved_to_footer",
          "Este párrafo menciona la baja o la privacidad y pasó al pie legal (letra pequeña, al final). Si era parte del mensaje, devuélvelo al cuerpo.",
          s$node, excerpt = s$text)
      }
    }
  }
  footer_segs <- if (!is.na(footer_from)) segs[footer_from:length(segs)] else list()
  body <- if (!is.na(footer_from)) segs[seq_len(footer_from - 1L)] else segs

  # Franja de cierre: el último separador antes del pie no es bloque.
  band <- NULL
  if (length(body) && identical(body[[length(body)]]$kind, "sep")) {
    band <- body[[length(body)]]
    body <- body[-length(body)]
  }

  greeted <- FALSE
  last_button <- NULL
  k <- 1L
  while (k <= length(body)) {
    s <- body[[k]]
    nxt <- if (k < length(body)) body[[k + 1L]] else NULL
    kind <- s$kind
    if (identical(kind, "sep")) {
      size <- if (isTRUE(s$px >= 12L)) "l" else if (isTRUE(s$px >= 4L)) "m" else "s"
      add(list(block_id = next_id("separador"), type = "divider", style = "linea", size = size))
    } else if (identical(kind, "img")) {
      im <- .cmail_ih_image(ctx, s$node)
      add(.cmc_drop_nulls_deep(list(block_id = next_id("imagen"), type = "image", image_ref = im$id,
                                    alt = if (nzchar(im$alt)) im$alt else .CMAIL_ALT_MARKER,
                                    width = if (!is.null(im$width)) max(40L, min(600L, im$width)), url = s$link)))
      if (!nzchar(im$alt)) .cmail_ih_alt_missing(ctx, s$node, im, blocks[[length(blocks)]]$block_id)
    } else if (identical(kind, "heading")) {
      add(.cmc_drop_nulls_deep(list(block_id = next_id("titulo"), type = "heading", text = .cmail_ih_strip_links(s$text, ctx, "Un título"),
                                    level = if (s$level %in% c("h1", "h2")) "titulo" else "subtitulo",
                                    align = if (identical(s$align, "center")) "center")))
    } else if (identical(kind, "list")) {
      add(list(block_id = next_id("lista"), type = "list", items = as.list(s$items), ordered = isTRUE(s$ordered)))
    } else if (identical(kind, "callout_cell")) {
      add(list(block_id = .cmail_ih_slug(s$title) %||% next_id("recuadro"), type = "callout", variant = s$variant,
               title = .cmail_ih_strip_links(s$title) , items = as.list(s$items)))
    } else if (identical(kind, "a_alone") && .cmail_ih_is_button(ctx, s$node, s$container)) {
      url <- .cmail_ih_href(ctx, s$node)
      text <- .cmail_ih_unbold(.cmail_ih_strip_links(.cmail_ih_text(ctx, xml2::xml_contents(s$node), links = FALSE)))
      if (is.null(url) || !nzchar(url)) {
        add(list(block_id = next_id("parrafo"), type = "paragraph", text = text))
        .cmail_ih_report(ctx, "button_without_link", "El botón no tenía un enlace válido: quedó como párrafo.", s$node,
                         block_id = blocks[[length(blocks)]]$block_id)
      } else {
        url <- .cmail_ih_finish(ctx, url)
        id <- add(list(block_id = next_id("boton"), type = "button", text = if (nzchar(text)) text else "Abrir", url = url))
        if (!is.null(.cmail_ih_bg(s$node)) && is.null(ctx$accent)) ctx$accent <- .cmail_ih_bg(s$node)
        last_button <- list(index = length(blocks), node = s$node)
      }
    } else {
      text <- if (identical(kind, "a_alone")) .cmail_ih_text(ctx, list(s$node)) else s$text
      # Nota del botón (bloque bulletproof): texto en la misma celda que la tabla del botón.
      if (!is.null(last_button) && identical(kind, "text") && length(blocks) == last_button$index &&
          isTRUE(.cmail_ih_note_of(last_button$node, s$container))) {
        b <- blocks[[last_button$index]]
        b$note <- as.list(c(unlist(b$note), .cmail_ih_strip_links(strsplit(.cmail_ih_unbold(text), "\n", fixed = TRUE)[[1]], ctx, "La nota del botón")))
        blocks[[last_button$index]] <- b
        k <- k + 1L
        next
      }
      if (!greeted && !length(Filter(function(b) b$type %in% c("paragraph", "callout", "list", "button"), blocks)) &&
          identical(kind, "text") && .cmail_ih_greeting(text)) {
        greeted <- TRUE
        t <- .cmail_ih_strip_links(text, ctx, "El saludo")
        fb <- if (grepl("{{nombre}}", t, fixed = TRUE)) .cmail_ih_greeting_fallback(t) else NULL
        # El respaldo de Mailchimp (*|IF:FNAME|*…*|ELSE:|*Y*|END:IF|*) manda sobre el derivado.
        mc_fb <- s$mc_fallback
        add(.cmc_drop_nulls_deep(list(block_id = "saludo", type = "greeting", text = t, fallback = mc_fb %||% fb,
                                      trato = .cmail_ih_trato(ctx, t))))
      } else if (identical(kind, "text") && .cmail_ih_all_bold(text) && nchar(.cmail_ih_unbold(text)) <= 60L &&
                 grepl(":$", .cmail_ih_unbold(text)) && !is.null(nxt) && identical(nxt$kind, "list")) {
        title <- .cmail_ih_unbold(.cmail_ih_strip_links(text))
        add(list(block_id = .cmail_ih_slug(title) %||% next_id("recuadro"), type = "callout", variant = "box",
                 title = title, items = as.list(nxt$items)))
        k <- k + 2L
        next
      } else if (identical(kind, "text") && grepl(.CMAIL_IH_CLOSING_RE, text, perl = TRUE) && nchar(text) <= 80L &&
                 !grepl("\n", text, fixed = TRUE) && !is.null(nxt) && identical(nxt$kind, "text") && grepl("\n", nxt$text, fixed = TRUE)) {
        lines <- strsplit(nxt$text, "\n", fixed = TRUE)[[1]]
        url <- NULL
        tail_line <- lines[[length(lines)]]
        lm <- regmatches(tail_line, regexec(sprintf("^%s$", .CMAIL_LINK_RE), tail_line, perl = TRUE))[[1]]
        # La web de la firma: el texto del enlace es la URL o su dominio sin
        # https:// ni barra final (así la escribe el render desde 2026-10-21).
        bare <- function(u) sub("/$", "", sub("^https?://(www\\.)?", "", u))
        if (length(lm) == 3L && (identical(lm[[2]], lm[[3]]) || identical(lm[[2]], bare(lm[[3]])))) {
          url <- lm[[3]]; lines <- lines[-length(lines)]
        }
        add(.cmc_drop_nulls_deep(list(block_id = "firma", type = "signature", closing = .cmail_ih_strip_links(text, ctx, "La despedida"),
                                      name = .cmail_ih_unbold(.cmail_ih_strip_links(lines[[1]], ctx, "El nombre de la firma")),
                                      lines = if (length(lines) > 1L) as.list(lines[-1]), url = url)))
        k <- k + 2L
        next
      } else {
        for (part in .cmail_ih_split_long(text)) {
          id <- add(.cmc_drop_nulls_deep(list(block_id = next_id("parrafo"), type = "paragraph", text = part,
                                              align = if (!is.null(s$align) && s$align %in% c("justify", "center")) s$align)))
        }
        if (identical(kind, "unrecognized")) {
          .cmail_ih_report(ctx, "unrecognized", s$reason, s$node, block_id = blocks[[length(blocks)]]$block_id)
        }
      }
    }
    k <- k + 1L
  }

  # Pie: el texto que queda al quitar el vocabulario de la plataforma.
  removed <- character(0)
  footer_text <- paste(vapply(footer_segs, function(s) {
    t <- if (identical(s$kind, "a_alone")) .cmail_ih_text(ctx, list(s$node)) else s$text %||% ""
    clean <- .cmail_ih_footer_clean(t, ctx$platform_labels)
    removed <<- c(removed, attr(clean, "removed"))
    as.character(clean)
  }, ""), collapse = "\n")
  if (length(removed)) {
    .cmail_ih_report(ctx, "platform_footer_removed",
      "Es el texto estándar del pie de la plataforma: la plantilla pone el pie de la plataforma de la campaña.",
      excerpt = paste(unique(removed), collapse = " | "), selector = "footer")
  }
  footer_text <- trimws(gsub("\n+", "\n", footer_text))
  add(.cmc_drop_nulls_deep(list(block_id = "pie", type = "footer_legal",
                                text = if (nzchar(footer_text)) footer_text)))
  list(blocks = blocks, header = header, band = band)
}

# ¿Es `container` la celda que envuelve la tabla del botón (botón «bulletproof»)?
# Entonces el texto que le sigue en esa celda es la nota del botón.
.cmail_ih_note_of <- function(button, container) {
  if (is.null(button) || is.null(container)) return(FALSE)
  bp <- xml2::xml_path(button)
  cp <- xml2::xml_path(container)
  if (!startsWith(bp, paste0(cp, "/"))) return(FALSE)
  grepl("/table", substr(bp, nchar(cp) + 1L, nchar(bp)), fixed = TRUE)
}

# Pie: se quitan SOLO las frases estándar de la plataforma y los textos de sus
# enlaces, y solo cuando son una línea entera o un tramo entero entre «|». Un
# enlace https propio (p. ej. la política de privacidad de la institución) se
# conserva como [texto](url): el pie lo admite.
.cmail_ih_footer_clean <- function(t, labels = character(0)) {
  norm <- function(x) tolower(sub("[.:]$", "", trimws(x)))
  std <- unique(norm(c(.CMAIL_IH_FOOTER_PHRASES, labels)))
  keep <- character(0)
  removed <- character(0)
  for (l in strsplit(t, "\n", fixed = TRUE)[[1]]) {
    parts <- trimws(strsplit(l, "\\s*[|\u00b7\u2022]\\s*", perl = TRUE)[[1]])
    parts <- parts[nzchar(gsub("[.\\s]", "", parts, perl = TRUE))]
    drop <- norm(parts) %in% std
    removed <- c(removed, parts[drop])
    parts <- parts[!drop]
    if (length(parts)) keep <- c(keep, paste(parts, collapse = " | "))
  }
  structure(paste(keep, collapse = "\n"), removed = removed)
}

# ---- entrada ------------------------------------------------------------------

.cmail_ih_decode <- function(raw, ctx) {
  if (length(raw) >= 3L && identical(raw[1:3], as.raw(c(0xef, 0xbb, 0xbf)))) raw <- raw[-(1:3)]
  txt <- rawToChar(raw)
  Encoding(txt) <- "UTF-8"
  if (!validUTF8(txt)) {
    txt2 <- iconv(rawToChar(raw), from = "windows-1252", to = "UTF-8")
    if (is.na(txt2)) {
      stop_api(422, "E_COLLECTION_MAIL_IMPORT_HTML_INVALID", "El HTML no está en UTF-8 ni en windows-1252.")
    }
    .cmail_ih_report(ctx, "encoding_windows1252", "El archivo no era UTF-8; se leyó como windows-1252. Revisa tildes y eñes.",
                     excerpt = "")
    txt <- txt2
  }
  txt
}

# Etiquetas de cada plataforma en el documento (sin comentarios ni scripts).
.cmail_ih_detect <- function(text) {
  sm <- lengths(regmatches(text, gregexpr(.CMAIL_IH_SM_TAG_RE, text, perl = TRUE)))
  mc <- lengths(regmatches(text, gregexpr(.CMAIL_IH_MC_TAG_RE, text, perl = TRUE)))
  list(surveymonkey = as.integer(sm), mailchimp = as.integer(mc))
}

# Respaldo del saludo en Mailchimp: *|IF:FNAME|*X*|ELSE:|*Y*|END:IF|*.
.cmail_ih_mc_greeting_fallback <- function(ctx, doc) {
  txt <- xml2::xml_text(xml2::xml_find_first(doc, "//body"))
  m <- regmatches(txt, regexec("\\*\\|IF:FNAME\\|\\*(.*?)\\*\\|ELSE:\\|\\*(.*?)\\*\\|END:IF\\|\\*", txt, perl = TRUE))[[1]]
  if (length(m) != 3L) return(NULL)
  m[[3]]
}

#' Convierte un HTML de correo en una plantilla `collection_mail_template/v2`.
#'
#' Pura: no toca la sesión. Devuelve list(template, report, images, stats,
#' platform_detected, platform_evidence).
#' @keywords internal
.cmail_import_html_parse <- function(raw, file_name = NULL, subject = NULL) {
  ctx <- .cmail_ih_new_ctx()
  ctx$css_separator <- list()
  if (length(raw) > .CMAIL_IMPORT_HTML_MAX_BYTES) {
    stop_api(413, "E_COLLECTION_MAIL_IMPORT_HTML_TOO_LARGE", "El HTML supera 512 KB.",
             details = list(size_bytes = length(raw)))
  }
  text <- .cmail_ih_decode(raw, ctx)
  # El trato que escribe la app (*|IF:SALUDO|**|SALUDO|**|ELSE:|*X*|END:IF|*) vuelve a ser X:
  # el saludo lo reconoce como trato por sexo (sin columna: la columna no viaja en el HTML).
  text <- gsub(sprintf("\\*\\|IF:%s\\|\\*\\*\\|%s\\|\\*\\*\\|ELSE:\\|\\*(.*?)\\*\\|END:IF\\|\\*", .CMAIL_TRATO_TAG, .CMAIL_TRATO_TAG),
               "\\1", text, perl = TRUE)
  if (!nzchar(trimws(text))) stop_api(422, "E_COLLECTION_MAIL_IMPORT_HTML_INVALID", "El HTML está vacío.")
  doc <- tryCatch(
    xml2::read_html(charToRaw(enc2utf8(text)), encoding = "UTF-8",
                    options = c("RECOVER", "NOERROR", "NOWARNING", "NONET", "NOBLANKS")),
    error = function(e) NULL
  )
  if (is.null(doc)) stop_api(422, "E_COLLECTION_MAIL_IMPORT_HTML_INVALID", "No se pudo leer el HTML.")
  n_nodes <- length(xml2::xml_find_all(doc, "//*"))
  if (n_nodes > .CMAIL_IMPORT_HTML_MAX_NODES) {
    stop_api(422, "E_COLLECTION_MAIL_IMPORT_HTML_INVALID",
             sprintf("El HTML tiene %d elementos (máximo %d).", n_nodes, .CMAIL_IMPORT_HTML_MAX_NODES),
             details = list(reason = "too_many_nodes", nodes = n_nodes))
  }
  deep <- xml2::xml_find_first(doc, sprintf("//*[count(ancestor::*) >= %d]", .CMAIL_IMPORT_HTML_MAX_DEPTH))
  if (!inherits(deep, "xml_missing")) {
    stop_api(422, "E_COLLECTION_MAIL_IMPORT_HTML_INVALID",
             sprintf("El HTML anida más de %d niveles.", .CMAIL_IMPORT_HTML_MAX_DEPTH),
             details = list(reason = "too_deep"))
  }

  comments <- xml2::xml_find_all(doc, "//comment()")
  if (length(comments)) {
    .cmail_ih_report(ctx, "comments_discarded",
                     sprintf("Se quitaron %d comentarios (incluidos los condicionales de Outlook).", length(comments)),
                     excerpt = paste(vapply(utils::head(comments, 3L), function(c) .cmail_ih_ws(xml2::xml_text(c)), ""), collapse = " · "),
                     selector = "comment()")
    xml2::xml_remove(comments)
  }
  .cmail_ih_read_styles(ctx, doc)
  title_node <- xml2::xml_find_first(doc, "//head/title")
  title <- if (!inherits(title_node, "xml_missing")) trimws(.cmail_ih_ws(xml2::xml_text(title_node))) else ""
  if (!inherits(title_node, "xml_missing")) ctx$discarded <- unique(c(ctx$discarded, "title"))
  # Atributos de evento (onclick…): se informan; nunca se leen.
  for (node in xml2::xml_find_all(doc, "//*[@*[starts-with(name(), 'on')]]")) {
    names_on <- grep("^on", names(xml2::xml_attrs(node)), value = TRUE)
    .cmail_ih_report(ctx, "event_handler_discarded",
                     sprintf("Se ignoró %s: un correo no ejecuta código.", paste(names_on, collapse = ", ")), node)
  }
  for (nm in setdiff(.CMAIL_IH_DROP, "style")) {
    nodes <- xml2::xml_find_all(doc, sprintf("//%s", nm))
    for (n in nodes) {
      .cmail_ih_report(ctx, "element_discarded", sprintf("Se descartó <%s>: un correo no lo admite.", nm), n,
                       excerpt = if (nm %in% c("script")) "" else NULL)
      ctx$discarded <- unique(c(ctx$discarded, nm))
    }
    xml2::xml_remove(nodes)
  }
  xml2::xml_remove(xml2::xml_find_all(doc, "//style"))
  body <- xml2::xml_find_first(doc, "//body")
  if (inherits(body, "xml_missing")) stop_api(422, "E_COLLECTION_MAIL_IMPORT_HTML_INVALID", "El HTML no tiene cuerpo.")
  # Texto y valores de atributo (el serializador escapa los href: %5BSurveyLink%5D).
  attr_vals <- unlist(lapply(xml2::xml_find_all(body, ".//*[@href or @src or @alt]"), function(n) {
    unname(unlist(xml2::xml_attrs(n)[c("href", "src", "alt")]))
  }), use.names = FALSE)
  evidence <- .cmail_ih_detect(paste(c(xml2::xml_text(body), attr_vals[!is.na(attr_vals)]), collapse = " "))
  platform <- if (evidence$surveymonkey > evidence$mailchimp) "surveymonkey" else if (evidence$mailchimp > 0L) "mailchimp" else NULL
  if (evidence$surveymonkey > 0L && evidence$mailchimp > 0L) {
    .cmail_ih_report(ctx, "platform_mixed",
                     sprintf("El HTML mezcla etiquetas de SurveyMonkey (%d) y de Mailchimp (%d); se tradujeron las dos.",
                             evidence$surveymonkey, evidence$mailchimp), excerpt = "")
  }
  mc_fb <- .cmail_ih_mc_greeting_fallback(ctx, doc)

  ctx$segs <- list()
  ctx$seen_text <- FALSE
  .cmail_ih_walk(ctx, body)
  if (!is.null(mc_fb)) {
    for (j in seq_along(ctx$segs)) if (identical(ctx$segs[[j]]$kind, "text")) {
      ctx$segs[[j]]$mc_fallback <- .cmail_ih_finish(ctx, .cmail_ih_ws(mc_fb)); break
    }
  }
  cl <- .cmail_ih_classify(ctx)
  blocks <- cl$blocks
  # Tope de bloques: se juntan párrafos consecutivos.
  while (length(blocks) > .CMAIL_MAX_BLOCKS) {
    types <- vapply(blocks, `[[`, "", "type")
    pair <- which(types[-length(types)] == "paragraph" & types[-1] == "paragraph")
    if (!length(pair)) break
    j <- pair[[1]]
    merged <- paste(blocks[[j]]$text, blocks[[j + 1L]]$text, sep = "\n\n")
    if (nchar(merged) > .CMAIL_MAX_TEXT) { if (length(pair) == 1L) break; j <- pair[[2]]; merged <- paste(blocks[[j]]$text, blocks[[j + 1L]]$text, sep = "\n\n") }
    blocks[[j]]$text <- merged
    blocks <- blocks[-(j + 1L)]
  }
  if (length(blocks) > .CMAIL_MAX_BLOCKS) {
    stop_api(422, "E_COLLECTION_MAIL_IMPORT_HTML_INVALID",
             sprintf("El correo da %d bloques y la plantilla admite %d.", length(blocks), .CMAIL_MAX_BLOCKS),
             details = list(reason = "too_many_blocks", blocks = length(blocks)))
  }

  accent <- ctx$accent %||% .CMAIL_DEFAULT_ACCENT
  theme <- list(accent = accent)
  if (!is.null(cl$band)) {
    theme$band <- if (!is.null(cl$band$color) && identical(cl$band$color, accent)) "acento" else "suave"
  }
  subj <- trimws(.cmail_ih_ws(.cmail_one(as.list(subject %||% list(""))) %||% ""))
  if (!nzchar(subj)) {
    .cmail_ih_report(ctx, "subject_missing", "El HTML no trae el asunto: escríbelo antes de exportar.", excerpt = "")
  }
  tid <- .cmail_ih_slug(sub("\\.[A-Za-z0-9]+$", "", basename(.cmail_one(as.list(file_name %||% list(""))) %||% ""))) %||% "correo-importado"
  fields <- unname(ctx$fields)
  template <- .cmc_drop_nulls_deep(list(
    schema = COLLECTION_MAIL_TEMPLATE_SCHEMA,
    template_id = tid,
    title = if (nzchar(title)) substr(title, 1L, 200L),
    revision = 1L,
    subject = .cmail_ih_finish(ctx, subj),
    preheader = ctx$preheader %||% "",
    theme = theme,
    header = cl$header,
    images = ctx$images,
    fields = fields,
    blocks = blocks
  ))
  if (!length(template$images)) template$images <- structure(list(), names = character(0))
  if (!length(template$fields)) template$fields <- list()
  template <- .cmail_ih_repair(ctx, template)
  list(
    template = template,
    report = utils::head(.cmail_ih_report_unique(ctx$report), .CMAIL_IMPORT_REPORT_MAX),
    images = ctx$image_list,
    stats = list(blocks = length(template$blocks), dropped_empty = as.integer(ctx$dropped_empty),
                 discarded = as.list(ctx$discarded)),
    platform_detected = platform,
    platform_evidence = evidence
  )
}

# Un mismo nodo se lee más de una vez (texto en línea, botón, pie): un ítem por
# código, selector y extracto.
.cmail_ih_report_unique <- function(report) {
  items <- lapply(report, .cmc_drop_nulls_deep)
  key <- vapply(items, function(x) paste(x$code, x$selector %||% "", x$excerpt %||% "", x$block_id %||% "", sep = "\u001f"), "")
  items[!duplicated(key)]
}

# Normaliza y valida. Lo que no pase se degrada a párrafo de texto plano (y se
# informa): la salida es SIEMPRE una plantilla válida.
.cmail_ih_repair <- function(ctx, template) {
  for (attempt in 1:4) {
    t <- .cmail_template_normalize(template)
    v <- collection_mail_template_validate(t)
    if (isTRUE(v$ok)) return(t)
    fixed <- FALSE
    for (p in v$problems) {
      m <- regmatches(p$path, regexec("^template\\.blocks\\[([0-9]+)\\]", p$path))[[1]]
      if (length(m) == 2L) {
        j <- as.integer(m[[2]])
        b <- template$blocks[[j]]
        if (is.null(b)) next
        plain <- paste(unlist(b[setdiff(names(b), c(.CMAIL_NON_TEXT_KEYS, "url"))], use.names = FALSE), collapse = "\n")
        plain <- gsub("[{}*|<>&\\[\\]]", " ", plain)
        plain <- trimws(gsub("[ ]+", " ", plain))
        .cmail_ih_report(ctx, "block_degraded", sprintf("El bloque no cumplía el contrato (%s) y quedó como párrafo.", p$code),
                         excerpt = plain, block_id = b$block_id)
        template$blocks[[j]] <- if (identical(b$type, "footer_legal")) list(block_id = b$block_id, type = "footer_legal")
                                else list(block_id = b$block_id, type = "paragraph", text = if (nzchar(plain)) substr(plain, 1L, .CMAIL_MAX_TEXT) else "\u2014")
        fixed <- TRUE
      } else if (grepl("^template\\.(subject|preheader|title)", p$path)) {
        k <- sub("^template\\.([a-z]+).*$", "\\1", p$path)
        .cmail_ih_report(ctx, "text_degraded", sprintf("%s no cumplía el contrato (%s) y se vació.", k, p$code),
                         excerpt = as.character(template[[k]] %||% ""))
        template[[k]] <- if (identical(k, "title")) NULL else ""
        fixed <- TRUE
      }
    }
    if (!fixed) break
  }
  stop_api(422, "E_COLLECTION_MAIL_IMPORT_HTML_INVALID", "El HTML no se pudo convertir en una plantilla válida.",
           details = list(problems = v$problems))
}

#' Importa un HTML de correo (lectura pura: no escribe el estado).
#' @keywords internal
collection_mail_import_html <- function(sid, html = NULL, file_name = NULL, subject = NULL, raw = NULL) {
  session_get(sid)
  if (is.null(raw)) {
    value <- .cmail_one(as.list(html %||% list(NA_character_)))
    if (is.null(value) || !nzchar(trimws(value))) {
      stop_api(422, "E_COLLECTION_MAIL_IMPORT_HTML_INVALID", "Falta el HTML (html en JSON o file en multipart).")
    }
    raw <- charToRaw(enc2utf8(value))
  }
  if (length(raw) > .CMAIL_IMPORT_HTML_MAX_BYTES) {
    stop_api(413, "E_COLLECTION_MAIL_IMPORT_HTML_TOO_LARGE", "El HTML supera 512 KB.",
             details = list(size_bytes = length(raw)))
  }
  parsed <- .cmail_import_html_parse(raw, file_name = file_name, subject = subject)
  sha <- paste0("sha256:", tolower(digest::digest(raw, algo = "sha256", serialize = FALSE)))
  import_id <- paste0("imp-", substr(gsub("-", "", uuid::UUIDgenerate()), 1L, 12L))
  .cmail_import_remember(sid, list(
    import_id = import_id, sha256 = sha, imported_at = .collection_now_iso(),
    platform_detected = parsed$platform_detected %||% "desconocida", report = parsed$report
  ))
  .cmc_drop_nulls_deep(list(
    ok = TRUE,
    import_id = import_id,
    sha256 = sha,
    bytes = length(raw),
    platform_detected = parsed$platform_detected,
    platform_evidence = parsed$platform_evidence,
    template = parsed$template,
    report = parsed$report,
    images = parsed$images,
    stats = parsed$stats
  ))
}

# Lectura del pedido: JSON {html, file_name, subject} o multipart con `file`
# (y `subject` opcional). Vive aquí para que el router sea forma HTTP + llamada.
.cmail_import_html_request <- function(req) {
  ctype <- req$HTTP_CONTENT_TYPE %||% req$CONTENT_TYPE %||% ""
  if (grepl("multipart/form-data", ctype, fixed = TRUE)) {
    parts <- tryCatch(parse_multipart_upload(req), error = function(e) NULL)
    part <- if (is.list(parts)) parts$file else NULL
    if (!is.list(part) || !is.raw(part$value)) {
      stop_api(422, "E_COLLECTION_MAIL_IMPORT_HTML_INVALID", "Falta el campo file en el multipart.")
    }
    return(list(raw = part$value, file_name = part$filename %||% "correo.html",
                subject = .cmail_part_text(parts$subject)))
  }
  body <- .collection_parse_body(req)
  list(html = body$html, file_name = body$file_name, subject = body$subject)
}
