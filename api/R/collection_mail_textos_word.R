# collection_mail_textos_word.R — «Textos en Word»: los asuntos, las vistas previas
# y los cuerpos de los correos en un .docx para que el cliente los valide
# (loop editor de correos, L13; Acreditación Institucional 2028: el Word para la
# DAA se armó fuera de la app).
#
# Por cada campaña elegida, un título «N. Nombre» y tres partes, con los nombres
# de Gonzalo y sin numerar los recordatorios:
# - Primer correo: asunto, vista previa y el cuerpo entero.
# - Recordatorios: una tabla con el asunto, la vista previa y la apertura de cada
#   uno, en orden, y el cuerpo común con la apertura marcada donde va.
# - Último recordatorio: asunto, vista previa, apertura y el cuerpo entero.
#
# El texto sale de la plantilla efectiva de cada envío (datos de la campaña y
# apertura ya escritos). Los campos por persona quedan como [Nombre]; el saludo
# por sexo, como «Estimado/Estimada [Nombre]:». Sin datos personales: el archivo
# es `internal`, como la vista para revisión.

.CMAIL_TEXTOS_MAX <- 10L
.CMAIL_TEXTOS_APERTURA <- "[Apertura del recordatorio]"

#' Texto plano de un campo del correo: los campos como [Etiqueta], sin marcas.
#' @keywords internal
.cmail_texto_plano <- function(x, tpl) {
  x <- .cmail_one(x)
  if (is.null(x)) return(NULL)
  rotulo <- function(key) {
    f <- Filter(function(f) identical(.cmail_one(f$key), key), tpl$fields %||% list())
    .cmail_one(if (length(f)) f[[1]]$label else NULL) %||% key
  }
  m <- gregexpr(.CMAIL_TOKEN_RE, x, perl = TRUE)
  toks <- regmatches(x, m)[[1]]
  if (length(toks)) {
    regmatches(x, m) <- list(vapply(toks, function(t) {
      sprintf("[%s]", rotulo(sub(.CMAIL_TOKEN_RE, "\\1", t, perl = TRUE)))
    }, "", USE.NAMES = FALSE))
  }
  x <- gsub("\\[([^]]+)\\]\\((?:mailto:|https?://)[^)]*\\)", "\\1", x, perl = TRUE)
  x <- gsub("\\*\\*|__", "", x)
  x <- trimws(x)
  if (nzchar(x)) x else NULL
}

#' El saludo como se escribe en el Word: con trato por sexo, las dos palabras.
#' @keywords internal
.cmail_textos_saludo <- function(b, tpl) {
  txt <- .cmail_texto_plano(b$text, tpl)
  trato <- b$trato
  if (is.null(txt) || !is.list(trato) || !identical(.cmail_one(trato$modo), "por_sexo")) return(txt)
  m <- .cmail_one(trato$masculino); f <- .cmail_one(trato$femenino); r <- .cmail_one(trato$respaldo)
  if (is.null(m) || is.null(f) || is.null(r) || !grepl(r, txt, fixed = TRUE)) return(txt)
  sub(r, paste0(m, "/", f), txt, fixed = TRUE)
}

#' Las líneas de texto de un bloque, en el orden en que se leen.
#' @keywords internal
.cmail_textos_bloque <- function(b, tpl) {
  p <- function(x) .cmail_texto_plano(x, tpl)
  par <- function(k, v) { v <- p(v); if (is.null(v)) NULL else paste0(k, ": ", v) }
  entradas <- function(sep = ": ") unlist(lapply(b$entries %||% list(), function(e) {
    t <- p(e$title); x <- p(e$text)
    if (!is.null(t) && !is.null(x)) paste0(t, sep, x) else t %||% x
  }))
  items <- function(xs) unlist(lapply(xs %||% list(), function(i) { v <- p(i); if (is.null(v)) NULL else paste0("- ", v) }))
  out <- switch(.cmail_one(b$type) %||% "",
    greeting = .cmail_textos_saludo(b, tpl),
    heading = p(b$text),
    paragraph = p(b$text),
    button = par("Botón", b$text),
    callout = c(p(b$title), items(b$items)),
    list = items(b$items),
    icon_text = p(b$text),
    signature = c(p(b$closing), p(b$name), unlist(lapply(b$lines %||% list(), p)), p(sub("^https?://", "", .cmail_one(b$url) %||% ""))),
    feature = c(p(b$eyebrow), p(b$title), p(b$text), par("Botón", b$button_text)),
    deadline = c(p(b$eyebrow), p(b$title), p(b$text), par("Botón", b$button_text)),
    steps = c(p(b$title), entradas()),
    benefits = c(p(b$title), entradas()),
    faq = c(p(b$title), entradas("\n")),
    quote = c(p(b$text), p(b$name), p(b$role)),
    contact = c(p(b$eyebrow), p(b$name), p(b$role), p(b$text), p(b$email), p(b$phone)),
    NULL)
  Filter(Negate(is.null), as.list(out))
}

#' Asunto, vista previa, apertura y cuerpo de un envío, ya escritos.
#' @keywords internal
.cmail_textos_envio <- function(campaign, tpl, send) {
  ef <- .cmail_template_for_send(tpl, send)
  apertura <- NULL
  cuerpo <- list()
  for (b in ef$blocks %||% list()) {
    lineas <- .cmail_textos_bloque(b, ef)
    if (identical(.cmail_one(b$block_id), .CMAIL_OPENING_ID)) {
      apertura <- if (length(lineas)) lineas[[1]] else NULL
      cuerpo <- c(cuerpo, list(.CMAIL_TEXTOS_APERTURA))
    } else {
      cuerpo <- c(cuerpo, lineas)
    }
  }
  list(asunto = .cmail_texto_plano(ef$subject, ef) %||% "", vista = .cmail_texto_plano(ef$preheader, ef) %||% "",
       apertura = apertura, cuerpo = cuerpo)
}

#' Los textos de una campaña en sus tres partes (L13).
#' @keywords internal
.cmail_textos_campana <- function(campaign) {
  tpl <- .cmail_campaign_template_checked(campaign, strict = FALSE)
  attr(tpl, "problems") <- NULL
  sends <- .cmail_sends_of(campaign)
  kind <- function(s) .cmail_one(s$kind) %||% "invitacion"
  inv <- Filter(function(s) identical(kind(s), "invitacion"), sends)
  recs <- Filter(function(s) identical(kind(s), "recordatorio"), sends)
  primero <- .cmail_textos_envio(campaign, tpl, if (length(inv)) inv[[1]] else NULL)
  ultimo <- if (length(recs) >= 2L) .cmail_textos_envio(campaign, tpl, recs[[length(recs)]]) else NULL
  medios <- if (length(recs) >= 2L) recs[-length(recs)] else recs
  list(nombre = .cmail_one(campaign$name) %||% .cmail_one(campaign$campaign_id),
       primero = primero, recordatorios = lapply(medios, function(s) .cmail_textos_envio(campaign, tpl, s)),
       ultimo = ultimo)
}

# ---- el .docx -------------------------------------------------------------------

.cmail_textos_tabla <- function(doc, cabecera, filas) {
  df <- as.data.frame(do.call(rbind, lapply(filas, function(f) unlist(f, use.names = FALSE))), stringsAsFactors = FALSE)
  names(df) <- cabecera
  ft <- flextable::flextable(df)
  ft <- flextable::font(ft, fontname = "Arial", part = "all")
  ft <- flextable::fontsize(ft, size = 10, part = "all")
  ft <- flextable::bold(ft, part = "header")
  ft <- flextable::bg(ft, bg = "#e8eef7", part = "header")
  ft <- flextable::valign(ft, valign = "top", part = "body")
  # La apertura es el texto largo: lleva la columna ancha.
  anchos <- if (length(cabecera) == 3L) c(1.75, 1.75, 2.8) else c(3.15, 3.15)
  ft <- flextable::width(ft, j = seq_along(cabecera), width = anchos)
  ft <- flextable::border_outer(ft, border = officer::fp_border(color = "#b7c3d6"))
  ft <- flextable::border_inner(ft, border = officer::fp_border(color = "#d6dde8"))
  flextable::body_add_flextable(doc, ft, align = "left")
}

.cmail_textos_cuerpo <- function(doc, lineas) {
  doc <- officer::body_add_fpar(doc, officer::fpar(officer::ftext("CUERPO DEL CORREO",
    officer::fp_text(font.family = "Arial", font.size = 9, bold = TRUE, color = "#5b6b82")),
    fp_p = officer::fp_par(padding.top = 12, padding.bottom = 4)))
  for (l in lineas) {
    marca <- identical(l, .CMAIL_TEXTOS_APERTURA)
    doc <- officer::body_add_fpar(doc, officer::fpar(officer::ftext(l, officer::fp_text(
      font.family = "Arial", font.size = 11, italic = marca, color = if (marca) "#5b6b82" else "#22262e")),
      fp_p = officer::fp_par(text.align = "left", padding.bottom = 6)))
  }
  doc
}

#' El .docx con los textos de las campañas.
#' @keywords internal
.cmail_textos_docx <- function(titulo, campanas, path) {
  doc <- officer::read_docx()
  estilo <- function(t, size, bold = TRUE, color = "#022051") officer::fpar(officer::ftext(t,
    officer::fp_text(font.family = "Arial", font.size = size, bold = bold, color = color)))
  doc <- officer::body_add_fpar(doc, estilo(titulo, 18))
  doc <- officer::body_add_fpar(doc, estilo("Textos de los correos de invitación y recordatorio", 12, FALSE, "#5b6b82"))
  for (k in seq_along(campanas)) {
    cp <- campanas[[k]]
    # Los estilos de título de Word ya numeran («1. Profesores», «1.1. Primer correo»).
    doc <- officer::body_add_par(doc, cp$nombre, style = "heading 1")
    doc <- officer::body_add_par(doc, "Primer correo", style = "heading 2")
    doc <- .cmail_textos_tabla(doc, c("Asunto", "Vista previa"), list(list(cp$primero$asunto, cp$primero$vista)))
    doc <- .cmail_textos_cuerpo(doc, Filter(function(l) !identical(l, .CMAIL_TEXTOS_APERTURA), cp$primero$cuerpo))
    if (length(cp$recordatorios)) {
      doc <- officer::body_add_par(doc, "Recordatorios", style = "heading 2")
      doc <- .cmail_textos_tabla(doc, c("Asunto", "Vista previa", "Apertura"),
        lapply(cp$recordatorios, function(r) list(r$asunto, r$vista, r$apertura %||% "")))
      doc <- .cmail_textos_cuerpo(doc, cp$recordatorios[[1]]$cuerpo)
    }
    if (!is.null(cp$ultimo)) {
      doc <- officer::body_add_par(doc, "Último recordatorio", style = "heading 2")
      doc <- .cmail_textos_tabla(doc, c("Asunto", "Vista previa", "Apertura"),
        list(list(cp$ultimo$asunto, cp$ultimo$vista, cp$ultimo$apertura %||% "")))
      u <- cp$ultimo$cuerpo
      u[vapply(u, identical, NA, .CMAIL_TEXTOS_APERTURA)] <- list(cp$ultimo$apertura %||% .CMAIL_TEXTOS_APERTURA)
      doc <- .cmail_textos_cuerpo(doc, u)
    }
  }
  print(doc, target = path)
  invisible(path)
}

#' Arma «Textos en Word» de las campañas pedidas y lo deja para descargar.
#' @param campaign_ids ids de campaña (1 a 10), en el orden del documento.
#' @keywords internal
collection_mail_textos_word <- function(sid, campaign_ids, titulo = NULL) {
  session <- session_get(sid)
  ids <- as.character(unlist(campaign_ids %||% list(), use.names = FALSE))
  if (!length(ids) || length(ids) > .CMAIL_TEXTOS_MAX) {
    stop_api(422, "E_COLLECTION_MAIL_TEXTOS", sprintf("Elige de 1 a %d campañas.", .CMAIL_TEXTOS_MAX))
  }
  todas <- .cmail_campaigns_of(.collection_current(session))$campaigns
  por_id <- setNames(todas, vapply(todas, function(c) as.character(c$campaign_id), ""))
  faltan <- setdiff(ids, names(por_id))
  if (length(faltan)) {
    stop_api(422, "E_COLLECTION_MAIL_TEXTOS", sprintf("No existe la campaña %s.", paste(faltan, collapse = ", ")))
  }
  titulo <- .cmail_one(titulo) %||% "Textos de los correos"
  campanas <- lapply(ids, function(id) .cmail_textos_campana(por_id[[id]]))
  dir.create(file.path(session$dir, "downloads"), recursive = TRUE, showWarnings = FALSE)
  nombre <- paste0(.cmail_campaign_slug(titulo), ".docx")
  path <- file.path(session$dir, "downloads", paste0(uuid::UUIDgenerate(), "__", nombre))
  .cmail_textos_docx(titulo, campanas, path)
  file <- .cmail_register_artifact(sid, path, "mail_textos", nombre, "textos",
                                   "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "internal")
  list(ok = TRUE, file = file, campaigns = as.list(ids))
}
