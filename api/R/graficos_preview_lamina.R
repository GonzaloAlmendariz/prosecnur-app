# Vista previa de una lámina: sus partes y si salió nativa (F6.0b; inventario F6, parte C).
#
# El endpoint `/api/graficos/preview-slide` arma un mini-PPTX con el mismo motor del export y rasterizaba sólo la lámina 1:
# una escala que se parte traía su «(cont.)» dentro del archivo y nadie la veía, y la respuesta no decía si la lámina había
# salido con formas nativas o por la ruta anterior (imagen). Gonzalo, 2026-10-09: «comprueba que la app pueda realmente
# mostrar la lamina tal cual como lo publicitas». Aquí se lee el mini-PPTX ya armado —barato: sólo descomprimir el XML— y
# se rasterizan todas sus partes con una sola conversión a PDF.

#' Láminas de un PPTX, en el orden de la presentación
#'
#' @return Vector con las rutas internas (`ppt/slides/slideN.xml`) en el orden de `presentation.xml`; si ese orden no se
#'   puede leer, en orden numérico.
#' @keywords internal
.pptx_slide_paths <- function(pptx_path) {
  nombres <- tryCatch(utils::unzip(pptx_path, list = TRUE)$Name, error = function(e) character())
  slides <- grep("^ppt/slides/slide[0-9]+\\.xml$", nombres, value = TRUE)
  if (!length(slides)) return(character())
  numericas <- slides[order(as.integer(sub("^ppt/slides/slide([0-9]+)\\.xml$", "\\1", slides)))]
  orden <- tryCatch({
    pres <- .pptx_leer_parte(pptx_path, "ppt/presentation.xml")
    rels <- .pptx_leer_parte(pptx_path, "ppt/_rels/presentation.xml.rels")
    ids <- regmatches(pres, gregexpr('<p:sldId [^>]*r:id="[^"]+"', pres))[[1]]
    ids <- sub('.*r:id="([^"]+)".*', "\\1", ids)
    destino <- vapply(ids, function(id) {
      m <- regmatches(rels, regexpr(sprintf('<Relationship [^>]*Id="%s"[^>]*>', id), rels))
      if (!length(m)) return(NA_character_)
      paste0("ppt/", sub('.*Target="([^"]+)".*', "\\1", m))
    }, character(1))
    destino[!is.na(destino) & destino %in% slides]
  }, error = function(e) character())
  if (length(orden) == length(slides)) unname(orden) else numericas
}

#' Lee una parte del zip como texto UTF-8
#' @keywords internal
.pptx_leer_parte <- function(pptx_path, parte) {
  con <- unz(pptx_path, parte, encoding = "UTF-8")
  on.exit(close(con), add = TRUE)
  paste(readLines(con, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
}

#' Cómo salió una lámina: con formas nativas, por la ruta anterior (imagen) o sin gráfico
#'
#' El motor nativo agrupa lo que dibuja en formas nombradas `prosecnur:*` (`prosecnur:titulo`, `prosecnur:grafico:escala`,
#' `prosecnur:pie`). La ruta anterior pega el gráfico como imagen (`<p:pic>`) y no deja esos nombres. Una lámina sin
#' ninguno de los dos (texto, una portada de la plantilla) no tiene gráfico que juzgar.
#' @return «nativa», «ruta_anterior» o «sin_grafico».
#' @keywords internal
.pptx_lamina_estado <- function(xml) {
  if (grepl('name="prosecnur:', xml, fixed = TRUE)) return("nativa")
  if (grepl("<p:pic>", xml, fixed = TRUE) || grepl("<p:pic ", xml, fixed = TRUE)) return("ruta_anterior")
  "sin_grafico"
}

#' Título visible de una lámina (el primer texto del grupo de título, o el primer texto)
#' @keywords internal
.pptx_lamina_titulo <- function(xml) {
  bloque <- regmatches(xml, regexpr('name="prosecnur:titulo".*?</p:grpSp>', xml, perl = TRUE))
  fuente <- if (length(bloque) && nzchar(bloque)) bloque else xml
  textos <- regmatches(fuente, gregexpr("<a:t>([^<]*)</a:t>", fuente))[[1]]
  textos <- trimws(sub("^<a:t>(.*)</a:t>$", "\\1", textos))
  textos <- textos[nzchar(textos)]
  if (!length(textos)) return("")
  # El antetítulo va antes que el título en el grupo; el título es el texto más largo de los dos primeros.
  candidatos <- utils::head(textos, 2L)
  candidatos[[which.max(nchar(candidatos))]]
}

#' Partes de la lámina que salió en el mini-PPTX de la vista previa
#'
#' @return `list(n, partes)`, con una entrada por lámina: `indice`, `titulo`, `estado` y `continuacion` (si su título
#'   lleva «(cont.)»). `n = 0` si el archivo no se puede leer.
#' @keywords internal
.preview_partes <- function(pptx_path) {
  slides <- .pptx_slide_paths(pptx_path)
  partes <- lapply(seq_along(slides), function(i) {
    xml <- tryCatch(.pptx_leer_parte(pptx_path, slides[[i]]), error = function(e) "")
    titulo <- .pptx_lamina_titulo(xml)
    list(indice = i, titulo = titulo, estado = .pptx_lamina_estado(xml),
         continuacion = grepl("(cont.)", titulo, fixed = TRUE))
  })
  list(n = length(partes), partes = partes)
}

#' Rasteriza todas las partes del mini-PPTX (hasta `max_partes`)
#'
#' Con LibreOffice convierte una sola vez a PDF y rasteriza cada página; con el renderer de artefactos, lámina por
#' lámina. La parte 1 es la misma que devolvía `.render_pptx_slide_preview`.
#' @return Lista de payloads (`png_base64`, `width`, `height`, `renderer`), uno por parte rasterizada; vacía si no hay
#'   renderer o falla.
#' @keywords internal
.render_pptx_preview_partes <- function(pptx_path, n_partes, preview_quality = "quick", max_partes = 6L) {
  preview_quality <- if (identical(tolower(as.character(preview_quality %||% "quick")), "normal")) "normal" else "quick"
  dpi <- if (preview_quality == "quick") 160L else 220L
  timeout <- if (preview_quality == "quick") 12L else 30L
  n <- min(as.integer(n_partes %||% 1L), as.integer(max_partes))
  if (is.na(n) || n < 1L) n <- 1L
  tmpdir <- tempfile("pptx_preview_partes_")
  dir.create(tmpdir, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(tmpdir, recursive = TRUE, force = TRUE), add = TRUE)

  if (.artifact_renderer_configured()) {
    out <- lapply(seq_len(n), function(i) .render_pptx_slide_png_artifact(pptx_path, tmpdir, slide_index = i, timeout = timeout, scale = max(1, dpi / 96)))
    if (!is.null(out[[1]])) return(Filter(Negate(is.null), out))
  }
  pdf_path <- .pptx_to_pdf_soffice(pptx_path, tmpdir, timeout = timeout + 4L * (n - 1L))
  if (is.null(pdf_path)) return(list())
  Filter(Negate(is.null), lapply(seq_len(n), function(i) .pdf_page_to_png(pdf_path, tmpdir, "soffice", page = i, dpi = dpi, timeout = timeout)))
}
