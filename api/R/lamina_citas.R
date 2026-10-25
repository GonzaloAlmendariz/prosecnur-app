# =============================================================================
# lamina_citas.R — la lámina nativa de citas representativas (TXT-4, plan-texto-abierto-ccss-2026-10-24)
# =============================================================================
#
# Estándar Pulso, minimalista: título del recetario, una columna de 3 a 5 citas con comillas tipográficas grandes en
# el acento de marca (coral), el texto en azul de 16 a 14 pt (baja de a medio punto sólo si no cabe), una línea fina
# entre citas y «Base: N comentarios con contenido» al pie. Sin atribución. Si ni a 14 pt caben, la cita más larga se
# corta con «[…]» en límite de palabra y se avisa; la letra no baja de 14.
#
# Dibuja las citas aprobadas (`citas_aprobadas`). Sin aprobadas es un BORRADOR y la lámina lo dice arriba a la derecha
# («Citas sin aprobar · borrador»), con la marca de revisión bajo la cita que nombra a alguien: un borrador no se
# entrega por descuido.
#
# Se engancha al motor sin crecer `reporte_plan_ppt.R`: la rama SLIDE_1 llama a `.lam_citas_aplica()` y
# `.lam_citas_slide_1_nativa()`, que atienden la espec `citas` y delegan todo lo demás en el compositor de siempre.

#' ¿La lámina se compone con piezas nativas? Las citas, siempre (salvo `meta$motor_nativo = FALSE`); lo demás, el compositor
#' @keywords internal
.lam_citas_aplica <- function(p, slide = NULL) {
  espec <- if (inherits(p, "ggplot")) attr(p, "pulso_espec") else NULL
  if (identical(espec$tipo, "citas")) return(!identical((slide$meta %||% list())$motor_nativo, FALSE))
  .lam_compositor_aplica(p, slide)
}

#' La rama `slide_1` del motor en nativo: las citas aquí, el resto en `.lam_slide_1_nativa()` (misma firma)
#' @keywords internal
.lam_citas_slide_1_nativa <- function(doc, p, slide, titulo, subtitulo, el_plot, presets, layout, master, antetitulo,
                                      base_auto, nota_de, sin_base = FALSE, sin_pie = FALSE, por_lamina = function(doc) doc,
                                      titulo_de_var = NULL) {
  espec <- if (inherits(p, "ggplot")) attr(p, "pulso_espec") else NULL
  if (!identical(espec$tipo, "citas")) {
    return(.lam_slide_1_nativa(doc, p, slide, titulo, subtitulo, el_plot, presets, layout, master, antetitulo, base_auto,
                               nota_de, sin_base, sin_pie, por_lamina, titulo_de_var))
  }
  slots <- slide$slots %||% list()
  como_texto <- function(x) {
    v <- if (inherits(x, "ppt_element_text")) x$text else if (is.character(x)) x else NULL
    if (is.null(v) || !length(v) || is.na(v[1]) || !nzchar(trimws(v[1]))) NULL else trimws(as.character(v)[1])
  }
  base <- if (isTRUE(sin_base)) NULL else como_texto(slots$base) %||% .lam_citas_base(espec$base)
  pie <- if (isTRUE(sin_pie)) NULL else como_texto(slots$footer)
  .lam_laminas_citas(doc, espec, titulo = como_texto(titulo) %||% "", ante = como_texto(antetitulo),
                     base = .lam_unir_base(base, pie), folio = length(doc) + 1L, sub = como_texto(subtitulo),
                     layout = layout, master = master, por_lamina = por_lamina)$doc
}

#' «Base: 62 comentarios con contenido»
#' @keywords internal
.lam_citas_base <- function(n) {
  n <- suppressWarnings(as.integer(n)[1])
  if (is.na(n)) return(NULL)
  sprintf("Base: %s %s", format(n, big.mark = ","), if (n == 1L) "comentario con contenido" else "comentarios con contenido")
}

# Geometría de la columna de citas, en pulgadas: comillas a la izquierda, texto a su derecha.
.LAM_CITAS <- list(comillas_w = 0.7, sangria = 0.75, comillas_pt = 54, pt = c(16, 15.5, 15, 14.5, 14), gap_min = 0.32,
                   gap_max = 0.6, revision_h = 0.28)

#' Tamaño de letra y textos que caben en `alto`: de 16 a 14 pt; si ni así, se corta la más larga con «[…]»
#' @return Lista `pt`, `textos`, `altos` y `cortadas` (cuántas se cortaron).
#' @keywords internal
.lam_citas_medir <- function(textos, ancho, alto, extra = rep(0, length(textos))) {
  G <- .LAM_CITAS; k <- length(textos)
  total <- function(tx, pt) {
    # Las líneas con la tinta real de Arial (corte por palabra, como PowerPoint): la cuenta por caracteres daba dos
    # líneas a una cita de una y dejaba el hueco debajo.
    h <- unname(.lam_lineas_tinta(tx, ancho, pt)) * pt * 1.2 / 72 + 0.1 + extra
    list(h = unname(h), suma = sum(h) + G$gap_min * max(0L, k - 1L))
  }
  for (pt in G$pt) {
    m <- total(textos, pt)
    if (m$suma <= alto) return(list(pt = pt, textos = textos, altos = m$h, cortadas = 0L))
  }
  pt <- min(G$pt); cortadas <- integer(0)
  repeat {
    m <- total(textos, pt)
    if (m$suma <= alto || all(nchar(textos) <= 60L)) break
    i <- which.max(nchar(textos))
    textos[i] <- .citas_cortar(sub(paste0(" \\Q", .CITAS_ELISION, "\\E$"), "", textos[i]), nchar(textos[i]) - 20L)
    cortadas <- union(cortadas, i)
  }
  list(pt = pt, textos = textos, altos = m$h, cortadas = length(cortadas))
}

#' Lámina de citas representativas
#'
#' @param espec Espec `citas` de `graficar_citas()`.
#' @return Lista con `doc` y `partes`.
#' @keywords internal
.lam_laminas_citas <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                               layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  G <- .LAM_CITAS; g_ <- .std_geom
  ml <- g_("margen_izq"); W <- g_("ancho"); mr <- g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  azul <- .std_color("azul"); coral <- .std_color("coral")
  x_txt <- ml + G$sangria; w_txt <- W - mr - x_txt
  citas <- espec$citas %||% data.frame(texto = character(), revision = character())
  textos <- as.character(citas$texto); k <- length(textos)
  borrador <- isTRUE(espec$borrador)
  revision <- if (borrador && "revision" %in% names(citas)) as.character(citas$revision) else rep("", k)
  revision[is.na(revision)] <- ""
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  .lam_txt(lz, "Comentarios textuales, sin atribución", ml, yt - 0.32, 6, 0.26, 10, .std_color("texto_suave"), bold = TRUE,
           nombre = "citas:encabezado")
  if (borrador) {
    wb <- 2.9; xb <- W - mr - wb
    .lam_caja(lz, xb, yt - 0.36, wb, 0.3, .std_color("fondo_destacado"), nombre = "citas:borrador:fondo")
    .lam_txt(lz, "Citas sin aprobar · borrador", xb, yt - 0.36, wb, 0.3, 10, coral, bold = TRUE, align = "center",
             nombre = "citas:borrador")
  }
  if (!k) {
    .lam_txt(lz, "No hay comentarios con contenido de 40 a 280 caracteres para citar.", ml, yt + 0.2, W - ml - mr, 0.4, 14,
             .std_color("texto_suave"), nombre = "citas:vacio")
  } else {
    alto <- yf - (yt + 0.1)
    extra <- ifelse(nzchar(revision), G$revision_h, 0)
    m <- .lam_citas_medir(textos, w_txt, alto, extra)
    if (m$cortadas > 0L) .pulso_aviso(sprintf("%d %s no %s en la lámina a 14 pt: se %s con «[…]».", m$cortadas,
                                              if (m$cortadas == 1L) "cita" else "citas", if (m$cortadas == 1L) "cabía" else "cabían",
                                              if (m$cortadas == 1L) "cortó" else "cortaron"))
    gap <- if (k > 1L) min(G$gap_max, max(G$gap_min, (alto - sum(m$altos)) / (k - 1L))) else 0
    y <- yt + 0.1 + max(0, (alto - sum(m$altos) - gap * (k - 1L)) / 2)   # el bloque se centra en la zona de datos
    for (i in seq_len(k)) {
      h_txt <- m$altos[i] - extra[i]
      .lam_txt(lz, "“", ml - 0.06, y - 0.27, G$comillas_w, 0.9, G$comillas_pt, coral, bold = TRUE, nombre = "citas:comillas")
      .lam_txt(lz, m$textos[i], x_txt, y, w_txt, h_txt, m$pt, azul, nombre = "citas:texto")
      if (nzchar(revision[i])) .lam_txt(lz, revision[i], x_txt, y + h_txt - 0.04, w_txt, G$revision_h, 9.5, coral,
                                        nombre = "citas:revision")
      y <- y + m$altos[i]
      if (i < k) {
        .lam_linea(lz, x_txt + 0.1, y + gap / 2, W - mr, y + gap / 2, .std_color("filete"), pt = 0.75, nombre = "citas:separador")
        y <- y + gap
      }
    }
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:citas")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}
