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
#' @return Lista de `{nombre, rol, x, y, w, h, pt_min, pt_max, lineas, recortado, grupo, pt_estandar}`. `grupo` es el
#'   nombre del grupo que la contiene (`NA` en primer nivel); `pt_estandar`, el cuerpo que pide el recetario
#'   (`.pf_pt_estandar`). Las medidas van en pulgadas con tres decimales; lo que no se puede
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
    # Interlineado real del párrafo: porcentaje (`spcPct`, 100000 = sencillo) o puntos fijos (`spcPts`).
    pct <- suppressWarnings(as.numeric(xml2::xml_attr(xml2::xml_find_first(p, "a:pPr/a:lnSpc/a:spcPct", ns), "val"))) / 100000
    pts <- suppressWarnings(as.numeric(xml2::xml_attr(xml2::xml_find_first(p, "a:pPr/a:lnSpc/a:spcPts", ns), "val"))) / 100
    list(texto = texto, tam = tam, negrita = negrita, interlineado = if (length(pct) && !is.na(pct)) pct else 1,
         interlineado_pt = if (length(pts) && !is.na(pts)) pts else NA_real_)
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
  # em), no el paso entre líneas: así una cifra de 19 pt en los 0.34 in de la dicotomía no sale «recortada». El paso es
  # el interlineado real del párrafo (1.2 em a sencillo, como `.lam_alto_tinta`).
  paso <- vapply(seq_along(pars), function(k) {
    p <- pars[[k]]; if (!is.na(p$interlineado_pt)) p$interlineado_pt else pt_par[k] * 1.2 * p$interlineado
  }, numeric(1))
  alto <- ins("tIns", 0.05) + (sum(lin * paso) - 0.08 * pt_par[length(pt_par)]) / 72
  exceso <- (alto - caja[4]) / (paso[which.max(paso)] / 72)               # en líneas
  out$recortado <- .pf_recortado(xml2::xml_attr(xml2::xml_find_first(h, "./*[1]/p:cNvPr", ns), "name"), out$lineas, exceso)
  out
}

#' ¿El texto se sale de su caja? Sólo se afirma cuando la medición es confiable
#'
#' Verificador de K11 sobre acrconta: 7 títulos de dos líneas y dos premisas se marcaban y el render no los recorta.
#' - El título del motor (`Titulo lamina`) admite dos líneas: así lo compone el recetario y así lo avisa
#'   `.lam_aviso_titulo`. Se recorta desde la tercera.
#' - En otro texto, la tinta medida (`.lam_lineas_tinta`) y la composición real pueden diferir en una línea: si lo que
#'   sobra es menos de una línea no se sabe (`NA`, la API escribe `null`); si cabe, `FALSE`; si sobra una línea o más,
#'   `TRUE`.
#' @param exceso Lo que el texto pasa del alto de su caja, en líneas (negativo si cabe).
#' @keywords internal
.pf_recortado <- function(nombre, lineas, exceso) {
  if (identical(nombre, "Titulo lamina")) return(lineas > 2L)
  if (exceso <= 0.01) return(FALSE)
  if (exceso < 1) return(NA)
  TRUE
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
  rol <- .pf_rol(nombre, tipo, h, grupo, grupo_rol, ns)
  list(nombre = nombre, rol = rol,
       x = xywh[1], y = xywh[2], w = xywh[3], h = xywh[4],
       pt_min = texto$pt_min, pt_max = texto$pt_max, lineas = texto$lineas, recortado = texto$recortado,
       grupo = grupo %||% NA_character_,
       pt_estandar = .pf_pt_estandar(nombre, rol, grupo, con_texto = !is.na(texto$pt_max)))
}

# ---- cuerpo que pide el recetario (A3, guías del visor) ----------------------
#
# `pt_estandar` es el cuerpo en pt que el recetario pide para ESA forma; el visor pinta en rojo el texto que se aparta
# (`fueraDeRecetario` en frontend/src/features/graficos/laminas/guias/modeloGuias.ts compara pt_min y pt_max contra él).
# Se resuelve por el nombre que el motor da a la pieza (`.lam_txt(..., nombre = )`) y el grupo `prosecnur:*` que la
# contiene, porque el rol no basta: un «cifra» de la escala va a `cifra` (14) y uno de la categórica a 16 o al cuerpo
# variable del rótulo; un `box:cifra` de la escala va a 14 en filas y a 28 en la lámina de una sola afirmación.
#
# Regla de la tabla: una entrada existe sólo si TODAS las llamadas del motor que escriben ese nombre en esos grupos usan
# el mismo token `.std_pt(...)` (auditado por grep sobre api/R/lamina_*.R, 2026-10-11). Si no hay token o hay variantes
# deliberadas del recetario, no hay entrada y sale `NA` (la API escribe `null`, el visor no compara):
#   - `pregunta` (escala): 20 pt literal en la afirmación sola, 13 (`pregunta`) en filas con Total.
#   - `box:cifra`/`box2:cifra` en la escala: 28 literal en la afirmación sola (lámina 97), 14 (`cifra`) en el resto.
#   - `Subtitulo lamina`: 12.5 literal, sin token.
#   - `cifra` en `prosecnur:grafico:categorica`/`mixta`: 16 literal o el cuerpo variable del rótulo (11/12).
#   - `leyenda:texto` del mapa: 11 literal; la leyenda de la ruta anterior (`prosecnur:leyenda:texto:k`) encoge
#     12 → 11 → 10 a propósito para caber (`.ppt_leyenda_plan`), así que tampoco tiene un cuerpo fijo.
# Desplazamiento de letra: el motor nativo no encoge la letra («si no cabe, la lámina se parte», lamina_piezas.R);
# `prosecnur.lam_desplazo` sólo baja la zona de datos (`.std_geom("zona_datos_y0")`), no cambia ningún cuerpo, así que
# la referencia es la misma con o sin narrativa. Por eso `pt_estandar` se lee del token, nunca del PPTX medido.

.PF_G_ESCALA <- c("prosecnur:grafico:escala", "prosecnur:grafico:multilista")
.PF_G_BARRA <- c(.PF_G_ESCALA, "prosecnur:grafico:paneles", "prosecnur:top_two_box")   # piezas de `.lam_barra_apilada`

#' Tabla nombre (+ grupos que lo contienen) → token de `ppt.tipografia`
#'
#' `grupos` es el vector de grupos donde la entrada vale; `grupo_patron` (regex perl) se usa cuando la lista exacta no
#' cabe. Es la única fuente de la correspondencia; agregar una entrada exige el mismo grep de la regla de arriba.
#' @keywords internal
.pf_tabla_pt_estandar <- function() {
  e <- function(nombres, token, grupos = NULL, grupo_patron = NULL) list(nombres = nombres, token = token, grupos = grupos, grupo_patron = grupo_patron)
  list(
    # cabecera y pie del compositor (lamina_compositor.R `.lam_titulo`, `.lam_pie`)
    e("Titulo lamina", "titulo", grupos = "prosecnur:titulo"),
    e("Antetitulo lamina", "antetitulo", grupos = "prosecnur:titulo"),
    e(c("Base lamina", "Folio lamina"), "base", grupos = "prosecnur:pie"),
    # narrativa (lamina_piezas.R `.lam_narrativa`, 15 = `narrativa`)
    e("narrativa:texto", "narrativa", grupos = "prosecnur:narrativa"),
    # bloque de escala (lamina_escala.R `.lam_bloque_escala`, `.lam_etiqueta_box`; multilista con `solo = FALSE`)
    e("premisa", "pregunta", grupos = .PF_G_ESCALA),
    e(c("premisa:n", "respuestas", "box:casos", "box2:casos"), "n", grupos = .PF_G_ESCALA),
    e("actor", "actor", grupos = .PF_G_ESCALA),
    e(c("box:rotulo", "box2:rotulo"), "rotulo_top_two_box", grupos = c(.PF_G_ESCALA, "prosecnur:grafico:paneles")),
    e(c("box:cifra", "box2:cifra"), "cifra", grupos = c("prosecnur:grafico:multilista", "prosecnur:grafico:paneles")),
    # barra apilada (lamina_escala.R `.lam_barra_apilada`): dentro a `cifra`, encima con guía a `cifra_fuera`
    e("cifra", "cifra", grupos = .PF_G_BARRA),
    e("cifra_fuera", "cifra_fuera", grupos = .PF_G_BARRA),
    # leyenda nativa (`.lam_leyenda`, `.lam_leyenda_panel`: 12 = `leyenda`); el mapa escribe 11 literal
    e("leyenda:texto", "leyenda", grupo_patron = "^prosecnur:(?!grafico:mapa)"),
    # multilista (lamina_multilista.R)
    e("bloque:titulo", "pregunta", grupos = "prosecnur:grafico:multilista"),
    e("bloque:subtitulo", "leyenda", grupos = "prosecnur:grafico:multilista"),
    # categórica y paneles
    e("n", "n", grupos = "prosecnur:grafico:categorica"),
    e("encabezado", "antetitulo", grupos = "prosecnur:grafico:categorica"),
    e("panel:base", "n", grupos = "prosecnur:grafico:paneles")
  )
}

# Roles con referencia cuando la forma no está en la tabla y va en primer nivel (ruta anterior): el título en el marcador
# `title` y la base en `prosecnur:slide_N:base`, con los presets `size_titulo_slide`/`size_nota_pie`, cuyos valores por
# defecto son `titulo`/`base` (estandar_presets.R). Dentro de un grupo el rol no basta (ver la tabla) y no se usa; la
# leyenda de primer nivel de la ruta anterior encoge a propósito y queda fuera.
.PF_PT_POR_ROL <- c(titulo = "titulo", antetitulo = "antetitulo", base = "base")

#' Cuerpo en pt que el recetario pide para una forma, o `NA` si no hay referencia honesta
#'
#' @param nombre `cNvPr name` de la forma.
#' @param rol Rol de `.pf_rol`.
#' @param grupo Nombre del grupo que la contiene, o `NULL`/`NA` en primer nivel.
#' @param con_texto ¿La forma lleva texto con cuerpo leído? Sin texto no hay letra que comparar.
#' @param tabla Tabla de `.pf_tabla_pt_estandar` (inyectable para los tests).
#' @keywords internal
.pf_pt_estandar <- function(nombre, rol, grupo, con_texto = TRUE, tabla = .pf_tabla_pt_estandar()) {
  if (!isTRUE(con_texto)) return(NA_real_)
  nombre <- as.character(nombre %||% "")[1]
  grupo <- as.character(grupo %||% NA_character_)[1]
  for (ent in tabla) {
    if (!nombre %in% ent$nombres) next
    vale <- if (!is.null(ent$grupo_patron)) !is.na(grupo) && grepl(ent$grupo_patron, grupo, perl = TRUE) else
      !is.na(grupo) && grupo %in% ent$grupos
    if (vale) return(as.numeric(.std_pt(ent$token)))
  }
  if (is.na(grupo) && isTRUE(rol %in% names(.PF_PT_POR_ROL))) {
    return(as.numeric(.std_pt(.PF_PT_POR_ROL[[rol]])))
  }
  NA_real_
}
