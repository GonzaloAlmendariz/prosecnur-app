# =============================================================================
# lamina_rotulo_resumen.R — el rótulo largo de una lámina de resumen (ADR 0135, oleada 5)
# =============================================================================
#
# Prueba con Arte (2026-11-07): el contraste de 13 pares, las fortalezas y la escala del resumen tienen por rótulo el
# enunciado entero de la pregunta («La dotación de recursos (infraestructura, instalaciones, laboratorios, …) es
# suficiente para atender las demandas de formación de los(as) estudiantes.»). La lámina nativa exigía dos líneas como
# mucho y caía a la imagen ggplot, que con esos rótulos salía rota: el rótulo ocupaba todo el ancho, el panel quedaba
# en negativo y rvg pintaba un rectángulo del color de un grupo sobre toda la lámina.
#
# Regla de las láminas de resumen:
#   1. Si el estudio declara el rótulo corto de la pregunta, va ése (`overrides$etiquetas_vars` de la lámina, el mismo
#      canal del recetario; `plan$rotulos_cortos` ya llega aplicado al instrumento por graficos_inclusivo.R). E4: si la
#      lámina no lo declara, el que la pregunta tiene en otro gráfico del plan (graficos_nombres_cortos_plan.R).
#   2. Si no, el rótulo va entero en hasta tres líneas; si aun así no cabe, la tercera termina en «…». El rótulo
#      completo sigue en la interfaz (el conteo de la regla lo devuelve entero).
#   3. El dibujo de respaldo usa la misma regla con el ancho fijo de la columna de rótulos: nunca invade el panel.
#   4. Con rótulos largos la letra baja de a medio punto hasta `.LAM_ROTULO_PT_PISO` (10,5 pt, el piso del estándar;
#      decisión del 2026-11-07, ADR 0135) y no más: por debajo de ese piso se recorta con «…».

#' Piso de la letra de los rótulos de las láminas de resumen (pt): el contraste y la escala no bajan de aquí
#' @keywords internal
.LAM_ROTULO_PT_PISO <- 10.5

#' Letras que prueba una lámina de resumen para sus rótulos, de la suya hasta el piso, de a medio punto
#' @param desde Letra de la lámina (pt).
#' @keywords internal
.lam_rotulo_pasos_pt <- function(desde) {
  if (desde <= .LAM_ROTULO_PT_PISO) return(.LAM_ROTULO_PT_PISO)
  unique(c(seq(desde, .LAM_ROTULO_PT_PISO, by = -0.5), .LAM_ROTULO_PT_PISO))
}

#' Cuánto de su ancho útil puede ocupar una línea sin que el visor arriesgue partirla (fracción)
#'
#' Medido el 2026-11-09 con Arial a 10.5 pt en cuadros de `.lam_txt` (15 líneas reales de Arte, de 2 a 3.6 in):
#' LibreOffice y PowerPoint dejan en una línea un texto cuya tinta (systemfonts) pasa hasta un 3 % el ancho útil
#' (`w - 0.22`) y lo parten desde un 5 %. Una línea por debajo del 99 % de ese ancho no está en riesgo.
#' @keywords internal
.LAM_ROTULO_BORDE <- 0.99

#' Ancho útil con el que se compone un rótulo: el del cuadro, o con 5 % de holgura si alguna línea queda en el borde
#'
#' @param w Ancho del cuadro de texto (in). @param size Letra (pt).
#' @keywords internal
.lam_rotulo_util <- function(s, w, size, bold = FALSE) {
  util <- max(0.3, w - 0.2 - 0.02)
  lin <- .lam_tyc_envolver(s, util, size, bold)
  borde <- any(.lam_ancho_tinta(lin, size, bold) > util * .LAM_ROTULO_BORDE)
  if (borde) max(0.3, util * 0.95) else util
}

#' Rótulo partido en a lo sumo `max_lineas` líneas sobre el ancho de un cuadro de texto, la última con «…» si no cabe
#'
#' El ancho útil es el de `.lam_lineas_tinta` (cuadro menos márgenes internos), así que lo que aquí cabe en tres líneas
#' PowerPoint también lo compone en tres.
#' @param w Ancho del cuadro de texto (in). @param size Letra (pt).
#' @return `list(lineas, texto, recortado)`: `texto` es el rótulo para el cuadro (las líneas unidas por espacio).
#' @keywords internal
.lam_rotulo_recortar <- function(s, w, size, max_lineas = 3L, bold = FALSE) {
  s <- trimws(as.character(s %||% "")[1]); if (is.na(s)) s <- ""
  # P15 (Arte, 2026-11-09): se mide con el ancho útil del cuadro (`.lam_rotulo_util`) y la holgura del 5 % sólo se usa si
  # alguna línea queda pegada al borde. Con la holgura siempre, un rótulo de una línea se contaba en dos y su fila crecía.
  util <- .lam_rotulo_util(s, w, size, bold)
  lin <- .lam_tyc_envolver(s, util, size, bold)
  if (length(lin) <= max_lineas) return(list(lineas = lin, texto = s, recortado = FALSE))
  # Recortado, el texto se vuelve a componer en el cuadro: con 10 % más de holgura la última línea no pasa a una cuarta
  # aunque el visor parta antes.
  util <- util * 0.9
  lin <- .lam_tyc_envolver(s, util, size, bold)
  # El público al final («… (DOC)», «… (Docentes)») identifica la fila: se recorta el enunciado y el sufijo se conserva.
  sufijo <- regmatches(s, regexpr(" \\([^()]{1,24}\\)$", s))
  if (length(sufijo) && nzchar(sufijo)) {
    cuerpo <- .lam_tyc_envolver(substr(s, 1L, nchar(s) - nchar(sufijo)), util, size, bold)
    if (length(cuerpo) >= max_lineas) {
      resto <- paste(cuerpo[max_lineas:length(cuerpo)], collapse = " ")
      w_suf <- .lam_ancho_tinta(sufijo, size, bold)
      ultima <- paste0(.lam_dif_recortar(resto, max(0.3, util - w_suf), size, bold)$texto, sufijo)
      lin <- c(cuerpo[seq_len(max_lineas - 1L)], ultima)
      return(list(lineas = lin, texto = paste(lin, collapse = " "), recortado = TRUE))
    }
  }
  resto <- paste(lin[max_lineas:length(lin)], collapse = " ")
  ultima <- .lam_dif_recortar(resto, util, size, bold)$texto
  lin <- c(lin[seq_len(max_lineas - 1L)], ultima)
  list(lineas = lin, texto = paste(lin, collapse = " "), recortado = TRUE)
}

#' Aviso de los rótulos recortados de una lámina (sin nombrar la serie: dice qué hacer)
#' @keywords internal
.lam_rotulos_aviso <- function(n_recortados, max_lineas = 3L) {
  if (n_recortados > 0L) {
    en <- c("una línea", "dos líneas", "tres líneas")[max(1L, min(3L, as.integer(max_lineas)))]
    .pulso_aviso(sprintf("%d %s no %s en %s y se %s con «…»; decláralos en el nombre corto de la pregunta.",
                         n_recortados, if (n_recortados == 1L) "rótulo" else "rótulos", if (n_recortados == 1L) "cabe" else "caben", en,
                         if (n_recortados == 1L) "recortó" else "recortaron"))
  }
  invisible(n_recortados)
}

#' Rótulos para el eje de un dibujo de respaldo: partidos con «\\n» en `ancho_in` y a lo sumo `max_lineas` líneas
#' @keywords internal
.gg_rotulos_resumen <- function(rotulos, ancho_in = 4, size = 10, max_lineas = 3L) {
  vapply(as.character(rotulos), function(r) paste(.lam_rotulo_recortar(r, ancho_in + 0.22, size, max_lineas)$lineas, collapse = "\n"),
         "", USE.NAMES = FALSE)
}

#' Líneas que admite el respaldo según cuántas filas lleva (alto útil de ~4.2 in a 10 pt)
#' @keywords internal
.gg_rotulos_max_lineas <- function(n_filas, alto = 4.2, size = 10) {
  as.integer(max(1L, min(3L, floor(alto / max(1L, n_filas) / (size * 1.2 / 72)))))
}

#' Rótulo corto de una pregunta de resumen: el declarado para alguna de sus refs, o el que trae
#'
#' @param refs Refs `base$variable` del tema (las dos de un par entre públicos, una en los demás).
#' @param largo Rótulo del instrumento.
#' @keywords internal
.resumen_rotulo_corto <- function(refs, largo) {
  for (r in as.character(unlist(refs))) {
    p <- .graficos_ref_parts(r)
    m <- .plan_etiquetas_cortas_vigentes(if (nzchar(p$source %||% "")) p$source else NULL)
    corto <- if (length(m)) m[[p$name]] else NULL
    if (!is.null(corto) && nzchar(trimws(corto))) return(trimws(as.character(corto)[1]))
  }
  # E4: el nombre corto que la pregunta tiene en otro gráfico del plan, si el rótulo de aquí es el del instrumento
  # (un rótulo escrito en este gráfico manda; graficos_nombres_cortos_plan.R).
  if (.resumen_es_enunciado(refs, largo)) {
    for (r in as.character(unlist(refs))) { corto <- .nombre_corto_del_plan(r); if (!is.null(corto)) return(corto) }
  }
  largo
}

#' Los nombres de los temas de un resumen con sus rótulos cortos (únicos)
#' @param temas Lista nombrada tema -> refs.
#' @keywords internal
.resumen_temas_cortos <- function(temas) {
  if (!length(temas) || is.null(names(temas))) return(temas)
  nm <- vapply(seq_along(temas), function(i) .resumen_rotulo_corto(temas[[i]], names(temas)[i]), "")
  stats::setNames(temas, make.unique(nm, sep = " "))
}
