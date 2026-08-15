# Anotaciones /Link sobre un PDF ya emitido por grDevices::pdf().
#
# El device de R dibuja glifos, no hipervinculos: no hay forma de pedirle una
# anotacion desde grid. La via de casa sigue siendo pdf()+grid, asi que el
# enlace se agrega despues, por actualizacion incremental (PDF 32000-1, 7.5.6):
# se anexan los objetos nuevos, una seccion xref propia y un trailer con /Prev
# apuntando al xref anterior. No se reescribe ni un byte de lo ya emitido, que
# es lo que hace este paso seguro sobre cualquier PDF del repo.
#
# Requisito: PDF con tabla xref clasica (la que emite R). Si el archivo trae
# xref streams u object streams, la funcion se abstiene y lo dice.

# El PDF trae streams comprimidos con bytes nulos, asi que no se puede pasar el
# archivo entero por rawToChar: se busca sobre el vector raw y solo se convierte
# a texto la region ASCII que interesa.
.ppl_find <- function(raw, pattern, fixed = FALSE) {
  hits <- grepRaw(pattern, raw, fixed = fixed, all = TRUE)
  if (!length(hits)) integer(0) else as.integer(hits)
}

.ppl_slice <- function(raw, from, to) {
  from <- max(1L, as.integer(from))
  to <- min(length(raw), as.integer(to))
  if (to < from) return("")
  chunk <- raw[from:to]
  # Todo lo que no sea ASCII imprimible pasa a espacio: la sintaxis que se
  # parsea (dicts, trailer, xref) es ASCII, y sustituir byte a byte conserva
  # las posiciones, que es lo unico que no se puede perder.
  codes <- as.integer(chunk)
  chunk[codes < 9L | codes > 126L] <- as.raw(32L)
  rawToChar(chunk)
}

.ppl_escape_uri <- function(url) {
  out <- gsub("\\", "\\\\", as.character(url)[1], fixed = TRUE)
  out <- gsub("(", "\\(", out, fixed = TRUE)
  gsub(")", "\\)", out, fixed = TRUE)
}

.ppl_num <- function(x) formatC(as.numeric(x), format = "f", digits = 2)

#' Agrega anotaciones de hipervinculo a un PDF ya renderizado.
#'
#' @param path PDF a modificar en el sitio.
#' @param links lista de `list(page, x0, y0, x1, y1, url)`. Las coordenadas van
#'   en npc (0-1) con el origen abajo-izquierda, igual que grid, de modo que el
#'   llamante declare el rectangulo con los mismos numeros con que dibujo.
#' @return invisible: numero de anotaciones escritas.
#' @export
pulso_pdf_add_link_annotations <- function(path, links) {
  links <- Filter(function(l) is.list(l) && nzchar(as.character(l$url %||% "")[1]), links %||% list())
  if (!length(links)) return(invisible(0L))
  if (!file.exists(path)) {
    stop_internal(sprintf("pulso_pdf_add_link_annotations: no existe el PDF a enlazar: %s", path))
  }

  raw <- readBin(path, "raw", n = file.info(path)$size)
  total <- length(raw)

  starts <- .ppl_find(raw, "startxref", fixed = TRUE)
  trailers <- .ppl_find(raw, "trailer", fixed = TRUE)
  if (!length(starts) || !length(trailers)) {
    warning("El PDF no trae xref clasica; no se agregaron hipervinculos.", call. = FALSE)
    return(invisible(0L))
  }
  start_pos <- starts[[length(starts)]]
  trailer_pos <- trailers[[length(trailers)]]
  # `(?s)` es obligatorio: el trailer viene partido en varias lineas y sin el
  # flag PCRE no cruza el salto, `sub` devuelve el texto intacto y los campos
  # salen NA o basura en vez de fallar de frente.
  prev_xref <- suppressWarnings(as.integer(
    sub("(?s)^\\s*startxref\\s+(\\d+).*$", "\\1", .ppl_slice(raw, start_pos, total), perl = TRUE)
  ))
  trailer <- .ppl_slice(raw, trailer_pos, start_pos - 1L)
  root <- sub("(?s)^.*/Root\\s+(\\d+)\\s+0\\s+R.*$", "\\1", trailer, perl = TRUE)
  info <- if (grepl("/Info", trailer, fixed = TRUE)) {
    sub("(?s)^.*/Info\\s+(\\d+)\\s+0\\s+R.*$", "\\1", trailer, perl = TRUE)
  } else {
    ""
  }
  size_obj <- suppressWarnings(as.integer(sub("(?s)^.*/Size\\s+(\\d+).*$", "\\1", trailer, perl = TRUE)))
  if (is.na(prev_xref) || is.na(size_obj) || !nzchar(root)) {
    warning("No se pudo leer el trailer del PDF; no se agregaron hipervinculos.", call. = FALSE)
    return(invisible(0L))
  }

  # Orden de paginas: el que declara /Kids, no el orden fisico de los objetos.
  pages_at <- .ppl_find(raw, "/Type\\s*/Pages")
  pages_dict <- if (length(pages_at)) .ppl_slice(raw, pages_at[[1]], pages_at[[1]] + 8192L) else ""
  pages_dict <- sub("(?s)>>.*$", ">>", pages_dict, perl = TRUE)
  kids <- regmatches(pages_dict, regexpr("/Kids\\s*\\[[^]]*\\]", pages_dict, perl = TRUE))
  page_objs <- if (length(kids)) {
    as.integer(regmatches(kids, gregexpr("\\d+(?=\\s+0\\s+R)", kids, perl = TRUE))[[1]])
  } else {
    integer(0)
  }
  if (!length(page_objs)) {
    warning("No se encontraron paginas en el PDF; no se agregaron hipervinculos.", call. = FALSE)
    return(invisible(0L))
  }

  box <- regmatches(pages_dict, regexpr("/MediaBox\\s*\\[[^]]*\\]", pages_dict, perl = TRUE))
  dims <- if (length(box)) {
    as.numeric(regmatches(box, gregexpr("-?[0-9.]+", box))[[1]])
  } else {
    numeric(0)
  }
  if (length(dims) < 4L) {
    warning("El PDF no declara MediaBox; no se agregaron hipervinculos.", call. = FALSE)
    return(invisible(0L))
  }
  page_w <- dims[[3]] - dims[[1]]
  page_h <- dims[[4]] - dims[[2]]

  by_page <- split(links, vapply(links, function(l) as.integer(l$page %||% 1L), integer(1)))
  next_obj <- size_obj
  additions <- list()
  new_offsets <- list()
  appended <- if (identical(raw[[total]], as.raw(10L))) "" else "\n"
  cursor <- total + nchar(appended, type = "bytes")

  written <- 0L
  for (page_key in names(by_page)) {
    page_index <- as.integer(page_key)
    if (is.na(page_index) || page_index < 1L || page_index > length(page_objs)) next
    obj_num <- page_objs[[page_index]]
    at <- .ppl_find(raw, sprintf("(^|[^0-9])%d\\s+0\\s+obj", obj_num))
    if (!length(at)) next
    chunk <- .ppl_slice(raw, at[[1]], at[[1]] + 4096L)
    body <- sub(
      sprintf("(?s)^[^0-9]*%d\\s+0\\s+obj\\s*(.*?)\\s*endobj.*$", obj_num), "\\1", chunk, perl = TRUE
    )
    if (!grepl(">>\\s*$", body) || grepl("/Annots", body, fixed = TRUE)) next

    annot_refs <- character(0)
    for (link in by_page[[page_key]]) {
      next_obj <- next_obj + 1L
      annot <- sprintf(
        paste0(
          "%d 0 obj\n<< /Type /Annot /Subtype /Link /Rect [%s %s %s %s] ",
          "/Border [0 0 0] /F 4 /A << /S /URI /URI (%s) >> >>\nendobj\n"
        ),
        next_obj,
        .ppl_num(dims[[1]] + link$x0 * page_w), .ppl_num(dims[[2]] + link$y0 * page_h),
        .ppl_num(dims[[1]] + link$x1 * page_w), .ppl_num(dims[[2]] + link$y1 * page_h),
        .ppl_escape_uri(link$url)
      )
      new_offsets[[as.character(next_obj)]] <- cursor
      cursor <- cursor + nchar(annot, type = "bytes")
      additions[[length(additions) + 1L]] <- annot
      annot_refs <- c(annot_refs, sprintf("%d 0 R", next_obj))
      written <- written + 1L
    }
    if (!length(annot_refs)) next

    patched <- sub(
      ">>\\s*$", sprintf("/Annots [ %s ] >>", paste(annot_refs, collapse = " ")), body, perl = TRUE
    )
    page_obj <- sprintf("%d 0 obj\n%s\nendobj\n", obj_num, patched)
    new_offsets[[as.character(obj_num)]] <- cursor
    cursor <- cursor + nchar(page_obj, type = "bytes")
    additions[[length(additions) + 1L]] <- page_obj
  }
  if (!written) return(invisible(0L))

  nums <- sort(as.integer(names(new_offsets)))
  sections <- character(0)
  run <- integer(0)
  flush_run <- function(run) {
    if (!length(run)) return(character(0))
    entries <- vapply(run, function(n) {
      sprintf("%010d 00000 n \n", as.integer(new_offsets[[as.character(n)]]))
    }, character(1))
    paste0(sprintf("%d %d\n", run[[1]], length(run)), paste(entries, collapse = ""))
  }
  for (n in nums) {
    if (length(run) && n != run[[length(run)]] + 1L) {
      sections <- c(sections, flush_run(run))
      run <- integer(0)
    }
    run <- c(run, n)
  }
  sections <- c(sections, flush_run(run))

  body_txt <- paste0(appended, paste(unlist(additions), collapse = ""))
  # `cursor` venia acumulando el offset absoluto de cada objeto anexado, asi que
  # al terminar apunta justo donde arranca la seccion xref nueva.
  xref_offset <- cursor
  xref <- paste0(
    "xref\n", paste(sections, collapse = ""),
    "trailer\n<< /Size ", max(nums) + 1L,
    if (nzchar(info)) paste0(" /Info ", info, " 0 R") else "",
    " /Root ", root, " 0 R /Prev ", prev_xref, " >>\n",
    "startxref\n", xref_offset, "\n%%EOF\n"
  )

  con <- file(path, open = "ab")
  on.exit(close(con), add = TRUE)
  writeBin(charToRaw(paste0(body_txt, xref)), con, useBytes = TRUE)
  invisible(written)
}
