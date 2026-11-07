# Cobertura y participación: casos, padrón, tasa de respuesta y meta por público (ADR 0135, punto 6)
# =====================================================================
#
# PROBLEMA. La lámina de metodología del resumen ejecutivo responde «¿a cuántos llegamos y cumplimos la meta?»: por
# público, los casos, el padrón, la tasa de respuesta y la meta de la propuesta. Se armaba a mano.
#
# DISEÑO (página 2 del resumen de Arte y Diseño FG 2026). A la izquierda, por público, la cifra grande de casos en el
# color del público, el público en negrita y «de 327» debajo; a la derecha, dos barras por público: «Tasa de respuesta»
# (azul del estándar) y «Meta de la propuesta» (gris), con la cifra al extremo y la leyenda arriba. Las filas extra
# manuales («34 egresados(as) en 4 grupos focales») van en la columna izquierda, sin barra.
#
# Reglas que esta especificación fija:
#   - Los casos son las filas de cada base tras los filtros, sin ponderar.
#   - La tasa es casos sobre padrón. Sin padrón declarado (o con casos por encima del padrón) no hay tasa: la lámina
#     muestra sólo la cifra y no inventa un denominador. El padrón no se infiere: lo declara el analista
#     (`universos`, el mismo formato que el contraste) o lo confirma de la propuesta de Cálculo de muestra o Monitoreo.
#   - La meta se declara en porcentaje del padrón («Docentes: 60%») o en casos («Docentes: 74»); en casos se lleva a
#     porcentaje con el padrón y, sin padrón, no se dibuja y se avisa.

.COBERTURA_LEYENDA <- c(tasa = "Tasa de respuesta", meta = "Meta de la propuesta")

#' Metas por público desde una lista o un texto «Docentes: 60%; Administrativos: 90%» (o «Docentes: 74», en casos)
#'
#' @return Lista nombrada por clave comparable de `list(valor, unidad)` con `unidad` `"porcentaje"` o `"casos"`, o
#'   `NULL`. Un número suelto en una lista son casos; con «%» es porcentaje.
#' @keywords internal
.cobertura_metas <- function(metas) {
  if (is.null(metas) || !length(metas)) return(NULL)
  if (is.character(metas) && length(metas) == 1L && is.null(names(metas))) {
    partes <- trimws(strsplit(metas, "[;\n]")[[1]]); partes <- partes[nzchar(partes)]
    kv <- regmatches(partes, regexec("^(.+?)\\s*[:=]\\s*([0-9][0-9.,]*\\s*%?)\\s*$", partes))
    ok <- lengths(kv) == 3L
    if (!any(ok)) return(NULL)
    metas <- stats::setNames(as.list(vapply(kv[ok], `[[`, "", 3L)), trimws(vapply(kv[ok], `[[`, "", 2L)))
  }
  m <- as.list(unlist(metas))
  nm <- .contraste_clave(names(m) %||% rep("", length(m)))
  out <- list()
  for (i in seq_along(m)) {
    v <- trimws(as.character(m[[i]]))
    pct <- grepl("%\\s*$", v)
    num <- suppressWarnings(as.numeric(gsub(",", ".", gsub("[%[:space:]]", "", v))))
    if (!nzchar(nm[i]) || !is.finite(num) || num < 0) next
    out[[nm[i]]] <- list(valor = num, unidad = if (pct) "porcentaje" else "casos")
  }
  if (length(out)) out else NULL
}

#' Filas extra de la columna izquierda: lista de `{cifra, rotulo, detalle}` o texto «34 | egresados(as) | en 4 grupos»
#' @return `data.frame(cifra, rotulo, detalle)` (puede tener cero filas).
#' @keywords internal
.cobertura_extras <- function(extras) {
  vacio <- data.frame(cifra = character(0), rotulo = character(0), detalle = character(0), stringsAsFactors = FALSE)
  if (is.null(extras) || !length(extras)) return(vacio)
  if (is.character(extras)) {
    lineas <- trimws(unlist(strsplit(extras, "\n", fixed = TRUE))); lineas <- lineas[nzchar(lineas)]
    extras <- lapply(strsplit(lineas, "|", fixed = TRUE), function(p) {
      p <- trimws(p); list(cifra = p[1], rotulo = if (length(p) >= 2L) p[2] else "", detalle = if (length(p) >= 3L) p[3] else "")
    })
  }
  if (is.data.frame(extras)) extras <- lapply(seq_len(nrow(extras)), function(i) as.list(extras[i, , drop = FALSE]))
  campo <- function(x, nm) { v <- x[[nm]]; v <- if (is.null(v) || !length(v)) "" else as.character(unlist(v))[1]; if (is.na(v)) "" else trimws(v) }
  filas <- lapply(extras, function(x) if (is.list(x)) data.frame(cifra = campo(x, "cifra"), rotulo = campo(x, "rotulo"),
                                                               detalle = campo(x, "detalle"), stringsAsFactors = FALSE))
  filas <- Filter(function(f) !is.null(f) && nzchar(f$cifra), filas)
  if (!length(filas)) return(vacio)
  do.call(rbind, filas)
}

#' Especificación de cobertura y participación (`cobertura/1`)
#'
#' @param publicos Nombres de los públicos (uno por base), en su orden.
#' @param casos Casos de cada público (filas tras los filtros, sin ponderar).
#' @param universos Padrón por público (texto o lista, como el contraste); `NULL` sin padrón.
#' @param metas Meta por público en porcentaje o casos (`.cobertura_metas`).
#' @param extras Filas extra de la columna izquierda (`.cobertura_extras`).
#' @return Lista `cobertura/1` con `publicos` (un data.frame: publico, rotulo, casos, padron, tasa, meta, sus textos y
#'   el color), `extras`, `colores` de las barras, `leyenda` y `avisos`.
#' @keywords internal
.espec_cobertura <- function(publicos, casos, universos = NULL, metas = NULL, extras = NULL, decimales = 0L, colores = NULL) {
  publicos <- as.character(publicos); casos <- suppressWarnings(as.numeric(casos))
  if (length(publicos) != length(casos)) stop("Cobertura: cada público necesita sus casos.", call. = FALSE)
  ex <- .cobertura_extras(extras)
  if (!length(publicos) && !nrow(ex)) stop("Cobertura: no hay públicos ni filas que mostrar.", call. = FALSE)
  dec <- suppressWarnings(as.integer(decimales)[1]); if (!is.finite(dec) || dec < 0L) dec <- 0L
  clave <- .contraste_clave(publicos)
  u <- .contraste_universos(universos)
  padron <- if (is.null(u)) rep(NA_real_, length(publicos)) else unname(u[clave])
  m <- .cobertura_metas(metas)
  avisos <- character(0)
  sobre <- is.finite(padron) & is.finite(casos) & casos > padron
  if (any(sobre)) {
    avisos <- c(avisos, sprintf("%s tiene más casos que su padrón (%s de %s): no se calcula su tasa.", publicos[sobre],
                                .dumbbell_fmt_casos(casos[sobre]), .dumbbell_fmt_casos(padron[sobre])))
  }
  tasa <- ifelse(is.finite(padron) & padron > 0 & is.finite(casos) & !sobre, 100 * casos / padron, NA_real_)
  meta <- vapply(seq_along(publicos), function(i) {
    mi <- m[[clave[i]]]
    if (is.null(mi)) return(NA_real_)
    if (identical(mi$unidad, "porcentaje")) return(mi$valor)
    if (is.finite(padron[i]) && padron[i] > 0) return(100 * mi$valor / padron[i])
    avisos <<- c(avisos, sprintf("La meta de %s está en casos y no tiene padrón: no se dibuja.", publicos[i]))
    NA_real_
  }, 0)
  pct <- function(v) ifelse(is.finite(v), paste0(.pulso_fmt_half_up(v, dec), "%"), "")
  col_pub <- if (length(publicos)) .contraste_colores(publicos, colores) else character(0)
  tabla <- data.frame(
    publico = publicos, rotulo = tolower(publicos), casos = casos,
    texto_casos = vapply(casos, function(x) if (is.finite(x)) .dumbbell_fmt_casos(x) else "—", ""),
    padron = padron, texto_padron = ifelse(is.finite(padron), paste("de", vapply(padron, .dumbbell_fmt_casos, "")), ""),
    tasa = tasa, texto_tasa = pct(tasa), meta = meta, texto_meta = pct(meta), color = col_pub,
    stringsAsFactors = FALSE
  )
  hay <- c(tasa = any(is.finite(tasa)), meta = any(is.finite(meta)))
  list(version = "cobertura/1", tipo = "cobertura",
       publicos = tabla, extras = ex,
       colores = c(tasa = .std_color("azul"), meta = .std_color("tarjeta_total")),
       leyenda = .COBERTURA_LEYENDA[hay], con_barras = any(hay),
       avisos = unique(avisos), decimales = dec)
}

#' Cobertura y participación por público
#'
#' Dibujo de respaldo (ggplot) de la lámina nativa `lamina_cobertura.R`, con la misma especificación.
#'
#' @param data Data frame con una fila por público: `publico` y `casos`.
#' @param universos Padrón por público («Docentes: 123; Estudiantes: 327»).
#' @param metas Meta por público en porcentaje («Docentes: 60%») o casos («Docentes: 74»).
#' @param extras Filas extra sin barra: lista de `{cifra, rotulo, detalle}`.
#' @family graficador
#' @export
graficar_cobertura <- function(
    data,
    var_publico = "publico",
    var_casos = "casos",
    universos = NULL,
    metas = NULL,
    extras = NULL,
    valores_decimales = 0L,
    colores_grupos = NULL,
    titulo = NULL,
    subtitulo = NULL,
    nota_pie = NULL,
    font_family = "Arial"
) {
  if (!is.data.frame(data)) stop("`data` debe ser un data frame.", call. = FALSE)
  for (col in c(var_publico, var_casos)) if (nrow(data) && !col %in% names(data)) stop("La columna `", col, "` no existe en `data`.", call. = FALSE)
  espec <- .espec_cobertura(if (nrow(data)) data[[var_publico]] else character(0), if (nrow(data)) data[[var_casos]] else numeric(0),
                            universos, metas, extras, valores_decimales, colores_grupos)
  pb <- espec$publicos
  filas <- rbind(
    data.frame(etiqueta = sprintf("%s %s %s", pb$texto_casos, pb$rotulo, pb$texto_padron), color = pb$color, stringsAsFactors = FALSE),
    if (nrow(espec$extras)) data.frame(etiqueta = trimws(paste(espec$extras$cifra, espec$extras$rotulo, espec$extras$detalle)),
                                       color = .std_color("azul"), stringsAsFactors = FALSE)
  )
  filas$y <- rev(seq_len(nrow(filas)))
  barras <- do.call(rbind, lapply(names(espec$leyenda), function(k) {
    v <- pb[[k]]; ok <- is.finite(v)
    if (!any(ok)) return(NULL)
    data.frame(serie = espec$leyenda[[k]], y = filas$y[seq_len(nrow(pb))][ok] + if (identical(k, "tasa")) 0.17 else -0.17,
               valor = v[ok], texto = pb[[paste0("texto_", k)]][ok], stringsAsFactors = FALSE)
  }))
  p <- ggplot2::ggplot() +
    ggplot2::geom_text(data = filas, ggplot2::aes(x = -4, y = .data$y, label = .data$etiqueta, colour = .data$color),
                       hjust = 1, size = 3.6, fontface = "bold", family = font_family) +
    ggplot2::scale_colour_identity()
  if (!is.null(barras) && nrow(barras)) {
    p <- p +
      ggplot2::geom_tile(data = barras, ggplot2::aes(x = .data$valor / 2, y = .data$y, width = .data$valor, height = 0.3, fill = .data$serie)) +
      ggplot2::geom_text(data = barras, ggplot2::aes(x = .data$valor + 1, y = .data$y, label = .data$texto), hjust = 0, size = 3,
                         colour = .std_color("texto_suave"), family = font_family) +
      ggplot2::scale_fill_manual(values = stats::setNames(unname(espec$colores[names(espec$leyenda)]), unname(espec$leyenda)), name = NULL)
  }
  p <- p +
    ggplot2::scale_x_continuous(limits = c(-70, 112), breaks = NULL, expand = c(0, 0)) +
    ggplot2::scale_y_continuous(breaks = NULL, limits = c(0.4, nrow(filas) + 0.6)) +
    ggplot2::labs(title = titulo, subtitle = subtitulo, caption = nota_pie, x = NULL, y = NULL) +
    ggplot2::theme_minimal(base_family = font_family) +
    ggplot2::theme(panel.grid = ggplot2::element_blank(), legend.position = "top",
                   plot.background = ggplot2::element_rect(fill = NA, colour = NA))
  attr(p, "pulso_espec") <- espec
  p
}
