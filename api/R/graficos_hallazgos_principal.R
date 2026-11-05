# =============================================================================
# graficos_hallazgos_principal.R — la diferencia principal del resumen ejecutivo: una pastilla, con el nombre completo
# =============================================================================
#
# Revisión del PPT v7.25 de CCSS, lámina 58 (ítems 10 y 11). Gonzalo: «solo poner la principal diferencia» y «si tiene
# el alto y el ancho, ¿por qué resumir la etiqueta? Puede ir completa o en dos filas de forma elegante». En el resumen
# ejecutivo cada fila lleva UNA pastilla: el grupo que más se aleja del resto (con dos grupos, el que está por encima;
# el otro es su espejo y repetirlo no informa) y, en gris, la cifra del resto. La pastilla lleva el nombre completo del
# grupo (`texto`); el rótulo corto del estudio (`corto`) queda como respaldo para cuando el completo no cabe en dos
# líneas de su columna. Las cifras, la prueba y la regla no cambian: sólo cuál de las celdas ya evaluadas se muestra.

#' La comparación principal de un cruce que difiere: una sola parte y la cola «frente al N% del resto»
#'
#' @param d Celdas con diferencia del cruce elegido (de `.dif_evaluar`).
#' @param K Grupos probados en ese cruce.
#' @param cr El cruce.
#' @return `list(partes = list(list(texto, corto, dir, fragil)), cola, estado = "diferencia", cruce)`.
#' @keywords internal
.halla_comparacion_principal <- function(d, K, cr, cx) {
  # Con dos grupos, el que está sobre el resto (su espejo dice lo mismo); si sólo hay una celda, esa. Con más, el que
  # más se aleja. Ante un empate de tamaño, la marca firme (99%) antes que la frágil.
  orden <- order(if (K == 2L) d$dir != "up" else rep(FALSE, nrow(d)), d$fragil, -abs(d$valor))
  i <- orden[1]
  pct <- .tarjetas_pct(d$p[i])
  list(partes = list(list(texto = paste(d$etiqueta[i], pct), corto = paste(.dif_corto(d$etiqueta[i], cx$cortos), pct),
                          dir = d$dir[i], fragil = d$fragil[i])),
       cola = paste0("frente al ", .tarjetas_pct(d$p_resto[i]), " del resto"), estado = "diferencia", cruce = cr)
}


#' Las formas en que cabe el rótulo de una parte: el completo en una línea, el completo en dos y el corto
#' @return Lista de vectores de líneas, en ese orden de preferencia.
#' @keywords internal
.halla_res_rotulo_formas <- function(pa, w, pt, bold = TRUE) {
  formas <- list()
  for (s in unique(c(pa$texto, pa$corto %||% pa$texto))) {
    if (.lam_ancho_tinta(s, pt, bold) <= w) formas[[length(formas) + 1L]] <- s
    # Dos líneas equilibradas: el corte más angosto que deja dos líneas dentro de `w` (aunque quepa en una, para que
    # la cifra del resto entre al lado sin abreviar el nombre).
    a <- .lam_ancho_tinta(s, pt, bold)
    for (wl in seq(a / 2, min(w, a), length.out = 12L)) {
      lin <- .lam_tyc_envolver(s, wl, pt, bold)
      if (length(lin) == 2L && all(.lam_ancho_tinta(lin, pt, bold) <= w + 1e-6)) { formas[[length(formas) + 1L]] <- lin; break }
    }
  }
  formas
}

#' La diferencia principal en la lámina: una pastilla con el nombre completo (en una o dos líneas) y la cola en gris
#'
#' Prueba, en orden, el nombre completo en una línea, en dos y el corto, con la cola a la derecha; si la cola no entra
#' con ninguna, va la pastilla más completa que quepa y la cola se omite con aviso.
#' @return Ancho dibujado (in).
#' @keywords internal
.lam_halla_res_principal <- function(lz, comp, x, yc, w, pt = 9.5) {
  pa <- comp$partes[[1]]; suave <- .std_color("texto_suave")
  util <- .lam_halla_res_pastilla_util(w)
  formas <- .halla_res_rotulo_formas(pa, util, pt)
  wc <- if (is.null(comp$cola)) 0 else .lam_ancho_tinta(comp$cola, pt, TRUE)
  anchos <- vapply(formas, function(f) .lam_halla_res_pastilla(lz, 0, 0, f, pa$dir, pa$fragil, pt, dibujar = FALSE), 0)
  con_cola <- which(anchos + (if (wc > 0) 0.1 + wc else 0) <= w + 1e-6)
  elegida <- if (length(con_cola)) con_cola[1] else which(anchos <= w + 1e-6)[1]
  if (is.na(elegida)) { .dif_aviso("Resumen ejecutivo", "la pastilla «", pa$texto, "» no cabe en su columna; se omitió."); return(0) }
  wp <- .lam_halla_res_pastilla(lz, x, yc, formas[[elegida]], pa$dir, pa$fragil, pt)
  if (wc > 0 && length(con_cola)) {
    .lam_tyc_txt(lz, comp$cola, x + wp + 0.1, yc, wc + 0.04, pt, suave, bold = TRUE, nombre = "resumen_ejecutivo:resto")
    return(wp + 0.1 + wc)
  }
  if (wc > 0) .dif_aviso("Resumen ejecutivo", "la cifra del resto de «", pa$texto, "» no cabe junto a su pastilla; se omitió.")
  wp
}
