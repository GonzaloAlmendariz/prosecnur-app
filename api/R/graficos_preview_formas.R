# =============================================================================
# graficos_preview_formas.R — las formas de cada parte de la vista previa, para las guías del visor (K11, plan F6 §8)
# =============================================================================
#
# El visor del editor dibuja guías por capas (ranuras del estándar, cajas de texto, cifras) encima del PNG de la lámina.
# Adivinarlas desde la imagen no sirve: aquí se leen del mini-PPTX que ya armó `/api/graficos/preview-slide`, con el
# mismo lector de partes (`.pptx_slide_paths`, `.pptx_leer_parte` de graficos_preview_lamina.R). Sólo descomprime XML y
# mide texto con systemfonts (`.lam_lineas_tinta`, la misma regla de corte que usa el motor): no rasteriza nada.
#
# Se listan las formas de primer nivel de la lámina y, dentro de los grupos, las que llevan texto o imagen: un segmento
# de barra o un filete no necesita guía, y una lámina de escala trae decenas. Las medidas van en pulgadas; lo que no se
# puede leer o medir sale `NA`, que la API escribe `null` (nunca un cero inventado).

.PF_EMU <- 914400

#' Ranuras del estándar del tipo de lámina, en la forma de `GET /api/graficos/estandar`
#'
#' @return Lista de `{rol, x, y, w, h}`; vacía si el tipo no está en el estándar (láminas de estructura).
#' @keywords internal
.preview_ranuras_estandar <- function(tipo) {
  tipo <- as.character(tipo %||% "")[1]
  for (t in .std_valor("ppt", "tipos_lamina")) {
    if (identical(t$id, tipo)) return(lapply(t$ranuras, .graficos_estandar_ranura))
  }
  list()
}

#' Agrega `formas` a cada parte y `ranuras_estandar` a la respuesta, sólo si el cliente lo pidió
#'
#' @param respuesta Respuesta de la vista previa (con `partes = list(n, partes)`).
#' @param pptx_path Mini-PPTX de la vista previa.
#' @param tipo Tipo de la lámina (`p_slide_1_grafico`…).
#' @param pedir `preview_formas` del body; con `FALSE` la respuesta vuelve intacta.
#' @keywords internal
.preview_con_formas <- function(respuesta, pptx_path, tipo, pedir = FALSE) {
  if (!isTRUE(pedir)) return(respuesta)
  slides <- .pptx_slide_paths(pptx_path)
  partes <- respuesta$partes$partes %||% list()
  for (k in seq_along(partes)) {
    partes[[k]]$formas <- if (k <= length(slides)) .preview_formas_lamina(pptx_path, slides[[k]]) else list()
  }
  respuesta$partes$partes <- partes
  respuesta$ranuras_estandar <- .preview_ranuras_estandar(tipo)
  respuesta
}

#' Formas de una lámina del PPTX
#'
#' @param slide_path Ruta interna (`ppt/slides/slideN.xml`).
#' @return Lista de formas (ver `.preview_formas_de_xml`); vacía si la lámina no se puede leer.
#' @keywords internal
.preview_formas_lamina <- function(pptx_path, slide_path) {
  doc <- tryCatch(xml2::read_xml(.pptx_leer_parte(pptx_path, slide_path)), error = function(e) NULL)
  if (is.null(doc)) return(list())
  .preview_formas_de_xml(doc, layout = .preview_formas_layout(pptx_path, slide_path))
}

#' Layout de una lámina (para los marcadores que heredan su caja)
#' @keywords internal
.preview_formas_layout <- function(pptx_path, slide_path) {
  tryCatch({
    rels_path <- sub("^(.*)/([^/]+)$", "\\1/_rels/\\2.rels", slide_path)
    rels <- .pptx_leer_parte(pptx_path, rels_path)
    m <- regmatches(rels, regexpr('Target="[^"]*slideLayouts/[^"]+"', rels))
    if (!length(m)) return(NULL)
    destino <- sub('^Target="(?:\\.\\./)?(.*)"$', "ppt/\\1", m, perl = TRUE)
    xml2::read_xml(.pptx_leer_parte(pptx_path, destino))
  }, error = function(e) NULL)
}

#' Formas de una lámina ya leída
#'
#' @param doc `xml_document` de la lámina.
#' @param layout `xml_document` de su layout, o `NULL`.
#' @return Lista de `{nombre, rol, x, y, w, h, pt_min, pt_max, lineas, recortado, grupo}`. `grupo` es el nombre del
#'   grupo que la contiene (`NA` en primer nivel). Las medidas van en pulgadas con tres decimales; lo que no se puede
#'   leer o medir es `NA`.
#' @keywords internal
.preview_formas_de_xml <- function(doc, layout = NULL) {
  ns <- xml2::xml_ns(doc)
  arbol <- xml2::xml_find_first(doc, "//p:cSld/p:spTree", ns)
  if (inherits(arbol, "xml_missing")) return(list())
  out <- list()
  recorrer <- function(nodo, tr, grupo, grupo_rol) {
    for (h in xml2::xml_children(nodo)) {
      tipo <- xml2::xml_name(h)
      if (!tipo %in% c("sp", "grpSp", "pic", "graphicFrame", "cxnSp")) next
      forma <- .pf_forma(h, tipo, tr, grupo, grupo_rol, layout, ns)
      if (is.null(grupo) || tipo %in% c("pic", "graphicFrame") || .pf_tiene_texto(h)) {
        out[[length(out) + 1L]] <<- forma
      }
      if (tipo == "grpSp") recorrer(h, .pf_tr_grupo(h, tr, ns), forma$nombre, forma$rol)
    }
  }
  recorrer(arbol, c(ax = 0, bx = 1, ay = 0, by = 1), NULL, NULL)
  out
}

# ---- geometría --------------------------------------------------------------

#' Transformación hijo → lámina de un grupo, compuesta con la del grupo que lo contiene
#'
#' Un punto del espacio hijo `x` cae en el padre en `off + (x - chOff) * ext / chExt` (DrawingML 20.1.7.6); se compone
#' con la del padre. Con `chExt` cero (lo que escribe el grupo raíz) la escala es 1.
#' @keywords internal
.pf_tr_grupo <- function(g, tr, ns) {
  xf <- xml2::xml_find_first(g, "p:grpSpPr/a:xfrm", ns)
  if (inherits(xf, "xml_missing")) return(tr)
  v <- function(ruta, attr) { n <- suppressWarnings(as.numeric(xml2::xml_attr(xml2::xml_find_first(xf, ruta, ns), attr))); if (length(n) && !is.na(n)) n else 0 }
  ox <- v("a:off", "x"); oy <- v("a:off", "y"); ex <- v("a:ext", "cx"); ey <- v("a:ext", "cy")
  cx <- v("a:chOff", "x"); cy <- v("a:chOff", "y"); cex <- v("a:chExt", "cx"); cey <- v("a:chExt", "cy")
  sx <- if (cex > 0) ex / cex else 1; sy <- if (cey > 0) ey / cey else 1
  c(ax = unname(tr["ax"] + tr["bx"] * (ox - cx * sx)), bx = unname(tr["bx"] * sx),
    ay = unname(tr["ay"] + tr["by"] * (oy - cy * sy)), by = unname(tr["by"] * sy))
}

#' Caja propia de una forma en EMU de su espacio (`c(x, y, w, h)`), o `NULL` si no la declara
#' @keywords internal
.pf_xfrm <- function(h, tipo, ns) {
  ruta <- switch(tipo, grpSp = "p:grpSpPr/a:xfrm", graphicFrame = "p:xfrm", "p:spPr/a:xfrm")
  xf <- xml2::xml_find_first(h, ruta, ns)
  if (inherits(xf, "xml_missing")) return(NULL)
  off <- xml2::xml_find_first(xf, "a:off", ns); ext <- xml2::xml_find_first(xf, "a:ext", ns)
  if (inherits(off, "xml_missing") || inherits(ext, "xml_missing")) return(NULL)
  v <- suppressWarnings(as.numeric(c(xml2::xml_attr(off, "x"), xml2::xml_attr(off, "y"), xml2::xml_attr(ext, "cx"), xml2::xml_attr(ext, "cy"))))
  if (anyNA(v)) NULL else v
}

#' Caja de un marcador sin `xfrm` propio: la del marcador del layout con el mismo `idx` o `type`
#' @keywords internal
.pf_xfrm_layout <- function(h, layout, ns) {
  if (is.null(layout)) return(NULL)
  ph <- xml2::xml_find_first(h, "./*[1]/p:nvPr/p:ph", ns)
  if (inherits(ph, "xml_missing")) return(NULL)
  lns <- xml2::xml_ns(layout)
  idx <- xml2::xml_attr(ph, "idx"); tipo <- xml2::xml_attr(ph, "type")
  sel <- if (!is.na(idx)) sprintf("//p:sp[p:nvSpPr/p:nvPr/p:ph[@idx='%s']]", idx) else
    sprintf("//p:sp[p:nvSpPr/p:nvPr/p:ph[@type='%s']]", if (is.na(tipo)) "body" else tipo)
  sp <- xml2::xml_find_first(layout, sel, lns)
  if (inherits(sp, "xml_missing")) return(NULL)
  .pf_xfrm(sp, "sp", lns)
}

# ---- texto ------------------------------------------------------------------

#' ¿La forma (o algo dentro de ella) lleva texto visible?
#' @keywords internal
.pf_tiene_texto <- function(h) {
  t <- xml2::xml_text(xml2::xml_find_all(h, ".//*[local-name()='t']"))
  any(nzchar(trimws(t)))
}

#' Párrafos de un cuadro de texto: texto, cuerpo mayor y menor en pt y si hay negrita
#'
#' El cuerpo es `a:rPr@sz`; un tramo sin `sz` hereda el `defRPr` del `lstStyle` de la misma forma. Si tampoco está ahí
#' (un marcador que lo hereda del layout) queda `NA`.
#' @keywords internal
.pf_parrafos <- function(tx, ns) {
  defecto <- suppressWarnings(as.numeric(xml2::xml_attr(xml2::xml_find_first(tx, "a:lstStyle/a:lvl1pPr/a:defRPr", ns), "sz"))) / 100
  lapply(xml2::xml_find_all(tx, "a:p", ns), function(p) {
    texto <- ""; tam <- numeric(); negrita <- FALSE
    for (n in xml2::xml_children(p)) {
      nm <- xml2::xml_name(n)
      if (nm == "br") { texto <- paste0(texto, "\n"); next }
      if (!nm %in% c("r", "fld")) next
      t <- xml2::xml_text(xml2::xml_find_first(n, "a:t", ns))
      if (is.na(t)) t <- ""
      texto <- paste0(texto, t)
      if (!nzchar(trimws(t))) next
      rpr <- xml2::xml_find_first(n, "a:rPr", ns)
      sz <- suppressWarnings(as.numeric(xml2::xml_attr(rpr, "sz"))) / 100
      tam <- c(tam, if (length(sz) && !is.na(sz)) sz else defecto)
      negrita <- negrita || identical(xml2::xml_attr(rpr, "b"), "1")
    }
    list(texto = texto, tam = tam, negrita = negrita)
  })
}

#' Cuerpo, líneas y recorte de un cuadro de texto
#'
#' Las líneas se componen como el motor (`.lam_lineas_tinta`: corte por palabras sobre la tinta de Arial) en el ancho
#' útil de la caja; cada línea mide `pt * 1.2 / 72` in, como en `.lam_alto_tinta`, y el texto se sale si el inset de arriba
#' más sus líneas pasan el alto de la caja. `recortado` sólo se afirma cuando se
#' puede medir: caja con ancho y alto, todos los tramos con cuerpo conocido, `wrap="square"`, texto horizontal y sin
#' autoajuste (PowerPoint encoge con `normAutofit` y agranda la caja con `spAutoFit`); en otro caso es `NA`.
#' @keywords internal
.pf_texto <- function(h, caja, ns) {
  vacio <- list(pt_min = NA, pt_max = NA, lineas = NA, recortado = NA)
  tx <- xml2::xml_find_first(h, "p:txBody", ns)
  if (inherits(tx, "xml_missing")) return(vacio)
  pars <- .pf_parrafos(tx, ns)
  con_texto <- vapply(pars, function(p) nzchar(trimws(p$texto)), logical(1))
  if (!any(con_texto)) return(vacio)
  tam <- unlist(lapply(pars, `[[`, "tam"))
  conocidos <- tam[!is.na(tam)]
  out <- list(pt_min = if (length(conocidos)) min(conocidos) else NA, pt_max = if (length(conocidos)) max(conocidos) else NA,
              lineas = NA, recortado = NA)
  # Hasta el último párrafo con texto: los vacíos del final no ocupan nada visible.
  pars <- pars[seq_len(max(which(con_texto)))]
  explicitas <- sum(vapply(pars, function(p) 1L + lengths(regmatches(p$texto, gregexpr("\n", p$texto, fixed = TRUE))), integer(1)))
  body <- xml2::xml_find_first(tx, "a:bodyPr", ns)
  ins <- function(a, def) { v <- suppressWarnings(as.numeric(xml2::xml_attr(body, a))); if (length(v) && !is.na(v)) v / .PF_EMU else def }
  wrap <- xml2::xml_attr(body, "wrap"); vert <- xml2::xml_attr(body, "vert")
  horizontal <- is.na(vert) || identical(vert, "horz")
  medible <- !is.null(caja) && caja[3] > 0 && horizontal && !anyNA(tam) && length(tam) &&
    all(vapply(pars, function(p) length(p$tam) > 0 || !nzchar(trimws(p$texto)), logical(1)))
  if (!medible || identical(wrap, "none")) { out$lineas <- as.integer(explicitas); return(out) }
  util <- caja[3] - ins("lIns", 0.1) - ins("rIns", 0.1) + 0.2          # `.lam_lineas_tinta` descuenta el inset estándar
  pt_par <- vapply(pars, function(p) if (length(p$tam)) max(p$tam) else max(tam), numeric(1))
  lin <- vapply(seq_along(pars), function(k) as.integer(.lam_lineas_tinta(pars[[k]]$texto, util, pt_par[k], pars[[k]]$negrita)), integer(1))
  out$lineas <- as.integer(sum(lin))
  autoajuste <- !inherits(xml2::xml_find_first(body, "a:normAutofit|a:spAutoFit", ns), "xml_missing")
  marcador <- !inherits(xml2::xml_find_first(h, "./*[1]/p:nvPr/p:ph", ns), "xml_missing")
  sin_ajuste_explicito <- inherits(xml2::xml_find_first(body, "a:noAutofit", ns), "xml_missing")
  if (autoajuste || (marcador && sin_ajuste_explicito) || caja[4] <= 0) return(out)
  # El inset de arriba empuja el texto; el de abajo es aire que la tinta puede ocupar sin salirse de la caja (una cifra
  # de 14 pt en su caja de 0.30 in del motor no se recorta). La última línea ocupa el alto de la fuente (Arial, ~1.12
  # em), no el paso de 1.2 entre líneas: así una cifra de 19 pt en los 0.34 in de la dicotomía no sale «recortada».
  alto <- ins("tIns", 0.05) + (sum(lin * pt_par * 1.2) - 0.08 * pt_par[length(pt_par)]) / 72
  out$recortado <- alto > caja[4] + 0.01
  out
}

# ---- rol --------------------------------------------------------------------

#' Rol de una forma, derivado de su nombre (`cNvPr name`) y de su tipo
#'
#' El motor nativo nombra sus piezas (`Titulo lamina`, `cifra`, `box:cifra`, `leyenda:texto`, `Base lamina`…) y agrupa
#' el gráfico como `prosecnur:grafico:<tipo>`; la ruta anterior deja el título en el marcador `title`, la base en
#' `prosecnur:slide_1:base` y el gráfico como imagen o como grupo DML sin nombre del motor. Un título dentro de un
#' gráfico (`bloque:titulo` de la multilista) es texto, no el título de la lámina.
#' @keywords internal
.pf_rol <- function(nombre, tipo, h, grupo, grupo_rol, ns) {
  n <- tolower(nombre %||% "")
  ph <- xml2::xml_attr(xml2::xml_find_first(h, "./*[1]/p:nvPr/p:ph", ns), "type")
  en_cabecera <- is.null(grupo) || identical(grupo_rol, "titulo")
  if (grepl("antetitulo", n, fixed = TRUE)) return("antetitulo")
  if (isTRUE(ph %in% c("title", "ctrTitle")) || n %in% c("titulo lamina", "prosecnur:titulo") ||
      (en_cabecera && grepl("(^|:)titulo$", n))) return("titulo")
  if (grepl("(^|[: ])base( |:|$)", n) || grepl("^base lamina$", n)) return("base")
  if (grepl("folio|(^|:)pie$|^pie lamina$|(^|:)nota$", n)) return("pie")
  if (grepl("leyenda", n, fixed = TRUE)) return("leyenda")
  if (grepl("icono", n, fixed = TRUE)) return("icono")
  if (grepl("cifra", n, fixed = TRUE)) return("cifra")
  if (startsWith(n, "prosecnur:grafico") || tipo %in% c("pic", "graphicFrame")) return("grafico")
  if (startsWith(n, "prosecnur:") && grepl(":", sub("^prosecnur:", "", n), fixed = TRUE) &&
      !sub("^prosecnur:([^:]+).*$", "\\1", n) %in% .PREVIEW_GRUPOS_ESTRUCTURA) return("grafico")
  if (tipo == "grpSp" && is.null(grupo)) return("grafico")
  if (.pf_tiene_texto(h)) return("texto")
  "otro"
}

#' Una forma con su caja resuelta en la lámina, su rol y su texto medido
#' @keywords internal
.pf_forma <- function(h, tipo, tr, grupo, grupo_rol, layout, ns) {
  nombre <- xml2::xml_attr(xml2::xml_find_first(h, "./*[1]/p:cNvPr", ns), "name")
  if (is.na(nombre)) nombre <- ""
  propia <- .pf_xfrm(h, tipo, ns) %||% (if (tipo == "sp") .pf_xfrm_layout(h, layout, ns) else NULL)
  caja <- if (is.null(propia)) NULL else c((tr["ax"] + tr["bx"] * propia[1]) / .PF_EMU, (tr["ay"] + tr["by"] * propia[2]) / .PF_EMU,
                                           tr["bx"] * propia[3] / .PF_EMU, tr["by"] * propia[4] / .PF_EMU)
  caja <- if (is.null(caja)) NULL else round(unname(caja), 3)
  xywh <- if (is.null(caja)) rep(NA_real_, 4) else caja
  texto <- if (tipo == "sp") .pf_texto(h, caja, ns) else list(pt_min = NA, pt_max = NA, lineas = NA, recortado = NA)
  list(nombre = nombre, rol = .pf_rol(nombre, tipo, h, grupo, grupo_rol, ns),
       x = xywh[1], y = xywh[2], w = xywh[3], h = xywh[4],
       pt_min = texto$pt_min, pt_max = texto$pt_max, lineas = texto$lineas, recortado = texto$recortado,
       grupo = grupo %||% NA_character_)
}
