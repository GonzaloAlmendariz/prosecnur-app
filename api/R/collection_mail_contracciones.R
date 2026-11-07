# collection_mail_contracciones.R — aviso «de el» / «a el» en el texto que se
# envía (loop editor de correos, L16).
#
# Con los datos de la campaña (L6) una frase como «la experiencia de {{grupo}}»
# con grupo = «el personal administrativo» sale «de el personal»: en
# Acreditación 2026 llegó así a la vista previa de un recordatorio. Se revisa el
# texto ya escrito (datos reemplazados, apertura del envío incluida) en el
# asunto, la vista previa y cada campo de texto de los bloques. Sólo «el» en
# minúscula: «de El Comercio» es un nombre propio y «de él» lleva tilde.

.CMAIL_CONTRACCION_RE <- "(^|[^[:alnum:]])([Dd]e|[Aa]) el([^[:alnum:]]|$)"
.CMAIL_CONTRACCION_PROPS <- c("text", "title", "closing", "fallback", "button_text", "name", "label")

.cmail_contraccion_en <- function(x) {
  x <- .cmail_one(x)
  !is.null(x) && grepl(.CMAIL_CONTRACCION_RE, x, perl = TRUE)
}

#' Los sitios del correo efectivo donde aparece «de el» o «a el».
#' @keywords internal
.cmail_contracciones <- function(tpl) {
  t <- .cmail_constants_apply(tpl)
  hits <- list()
  for (k in c("subject", "preheader")) if (.cmail_contraccion_en(t[[k]])) hits[[length(hits) + 1L]] <- list(block_id = NULL, prop = k)
  for (b in t$blocks %||% list()) {
    id <- .cmail_one(b$block_id)
    for (p in .CMAIL_CONTRACCION_PROPS) if (.cmail_contraccion_en(b[[p]])) hits[[length(hits) + 1L]] <- list(block_id = id, prop = p)
    for (e in b$entries %||% list()) for (p in c("title", "text")) {
      if (.cmail_contraccion_en(e[[p]])) hits[[length(hits) + 1L]] <- list(block_id = id, prop = "entries")
    }
    for (l in b$lines %||% list()) if (.cmail_contraccion_en(l)) hits[[length(hits) + 1L]] <- list(block_id = id, prop = "lines")
  }
  hits
}

#' Aviso `contraction`: «de el» y «a el» se escriben «del» y «al».
#' @keywords internal
.cmail_contraction_check <- function(tpl) {
  hits <- .cmail_contracciones(tpl)
  if (!length(hits)) return(.cmail_check("contraction", "ok", 0L, "Sin «de el» ni «a el»."))
  # Con los nombres del editor, nunca el id interno del bloque.
  nombre <- function(h) {
    if (identical(h$prop, "subject")) return("el asunto")
    if (identical(h$prop, "preheader")) return("la vista previa")
    if (identical(h$block_id, .CMAIL_OPENING_ID)) return("la apertura del envío")
    "el cuerpo"
  }
  donde <- unique(vapply(hits, nombre, ""))
  donde <- if (length(donde) > 1L) paste(paste(donde[-length(donde)], collapse = ", "), "y", donde[length(donde)]) else donde
  .cmail_check("contraction", "warning", length(hits),
    sprintf("Dice «de el» o «a el» en %s: se escribe «del» y «al».", donde),
    targets = lapply(Filter(function(h) !is.null(h$block_id), hits), function(h) .cmail_target(h$block_id, h$prop)))
}
