# collection_mail_marks.R — las marcas de énfasis del texto del correo
# (`collection_mail_template/v2`, E1n: «el editor debe ser capaz de poner
# cursiva y negrita»).
#
# Regla (la misma que serializa el editor del front, serializarTexto.ts):
#   - `*cursiva*`, `**negrita**` y `***ambas***`, dentro de UNA línea;
#   - un asterisco abre si lo sigue algo que no es espacio y cierra si lo
#     precede algo que no es espacio (como CommonMark, sin la regla del 3);
#   - los pares se emparejan con una pila: el cierre busca la apertura más
#     cercana; dos o más de cada lado hacen negrita, uno hace cursiva. Así
#     `***a** b*` es `<em><strong>a</strong> b</em>` y el HTML siempre anida;
#   - un asterisco que no se empareja queda literal;
#   - `\*` es un asterisco literal: «5\*3» nunca abre cursiva. El importador
#     escapa todo asterisco literal del HTML de origen, así un «5*3 y 4*2»
#     importado no se vuelve cursiva al renderizar.
# El render escribe `<strong>` y `<em style="font-style:italic;">` (el estilo
# inline cubre los clientes que pierden la semántica de `<em>`). El texto plano
# (asunto, preheader, frases de la revisión) y SurveyMonkey salen sin marcas:
# `.cmail_marks_strip`.

.CMAIL_MARK_ESC <- "\u0006"
.CMAIL_EM_OPEN <- '<em style="font-style:italic;">'

# Corridas de asteriscos de una línea: list(start, len, open, close).
.cmail_marks_runs <- function(chars) {
  n <- length(chars)
  runs <- list()
  i <- 1L
  while (i <= n) {
    if (!identical(chars[[i]], "*")) { i <- i + 1L; next }
    j <- i
    while (j < n && identical(chars[[j + 1L]], "*")) j <- j + 1L
    before <- if (i > 1L) chars[[i - 1L]] else " "
    after <- if (j < n) chars[[j + 1L]] else " "
    runs[[length(runs) + 1L]] <- list(start = i, len = j - i + 1L,
                                      open = !grepl("^\\s$", after, perl = TRUE),
                                      close = !grepl("^\\s$", before, perl = TRUE))
    i <- j + 1L
  }
  runs
}

# Una línea -> segmentos con sus etiquetas. `tag(kind, closing)` escribe cada
# etiqueta («strong»/«em»); con `tag` que devuelve "" sale el texto plano.
.cmail_marks_line <- function(line, tag) {
  chars <- strsplit(line, "", fixed = TRUE)[[1]]
  if (!length(chars) || !("*" %in% chars)) return(line)
  runs <- .cmail_marks_runs(chars)
  left <- vapply(runs, `[[`, 0L, "len")
  # Etiquetas por corrida: las de apertura se escriben tras los asteriscos que
  # sobran (pegadas al texto) y las de cierre antes de los que sobran.
  opens <- rep(list(character(0)), length(runs))
  closes <- rep(list(character(0)), length(runs))
  active <- rep(TRUE, length(runs))
  for (k in seq_along(runs)) {
    if (!runs[[k]]$close) next
    o <- k - 1L
    while (left[[k]] > 0L && o >= 1L) {
      if (!runs[[o]]$open || !active[[o]] || left[[o]] == 0L) { o <- o - 1L; next }
      use <- if (left[[o]] >= 2L && left[[k]] >= 2L) 2L else 1L
      kind <- if (use == 2L) "strong" else "em"
      left[[o]] <- left[[o]] - use
      left[[k]] <- left[[k]] - use
      opens[[o]] <- c(tag(kind, FALSE), opens[[o]])
      closes[[k]] <- c(closes[[k]], tag(kind, TRUE))
      # Lo que quedó entre la apertura y el cierre ya no empareja (CommonMark).
      if (o + 1L <= k - 1L) active[(o + 1L):(k - 1L)] <- FALSE
      if (left[[o]] == 0L) o <- o - 1L
    }
  }
  out <- character(0)
  pos <- 1L
  for (k in seq_along(runs)) {
    r <- runs[[k]]
    if (r$start > pos) out <- c(out, chars[pos:(r$start - 1L)])
    out <- c(out, closes[[k]], rep("*", left[[k]]), opens[[k]])
    pos <- r$start + r$len
  }
  if (pos <= length(chars)) out <- c(out, chars[pos:length(chars)])
  paste(out, collapse = "")
}

.cmail_marks_apply <- function(text, tag) {
  text <- gsub("\\*", .CMAIL_MARK_ESC, as.character(text %||% ""), fixed = TRUE)
  lines <- strsplit(text, "\n", fixed = TRUE)[[1]]
  if (!length(lines)) lines <- ""
  out <- paste(vapply(lines, .cmail_marks_line, "", tag = tag, USE.NAMES = FALSE), collapse = "\n")
  if (endsWith(text, "\n")) out <- paste0(out, "\n")
  gsub(.CMAIL_MARK_ESC, "*", out, fixed = TRUE)
}

#' Marcas `*…*` / `**…**` / `***…***` -> `<em>` / `<strong>` (texto ya escapado).
#' @keywords internal
.cmail_marks_html <- function(text) {
  .cmail_marks_apply(text, function(kind, closing) {
    if (closing) sprintf("</%s>", kind) else if (identical(kind, "em")) .CMAIL_EM_OPEN else "<strong>"
  })
}

#' El texto sin marcas: los pares se quitan, `\*` vuelve a ser `*`.
#' @keywords internal
.cmail_marks_strip <- function(text) .cmail_marks_apply(text, function(kind, closing) "")

#' Escapa los asteriscos literales para que no se lean como marca.
#' @keywords internal
.cmail_marks_escape <- function(text) gsub("*", "\\*", as.character(text %||% ""), fixed = TRUE)
