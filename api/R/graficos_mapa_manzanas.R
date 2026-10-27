# =============================================================================
# graficos_mapa_manzanas.R — el distrito con sus zonas y manzanas aplicadas (lámina 106; ADR 0093)
# =============================================================================
#
# recetario_m3e.R:244-265: todas las manzanas del distrito, la aplicada en azul oscuro, las demás de una zona aplicada en
# azul medio y las de fuera de la muestra en blanco; encima, el contorno de las zonas y, más grueso, el de las zonas
# aplicadas; en el panel, dos cifras (zonas y manzanas aplicadas).
#
# El plan guarda sólo los códigos de las manzanas (el avance por manzana de Monitoreo territorial); la geometría se lee
# de la cartografía del paquete al dibujar, como hace Hojas de ruta: un distrito trae miles de manzanas y no viajan en el
# JSON del plan.

#' Manzanas aplicadas y visitadas de un distrito, desde el avance por manzana del operativo
#' @return Lista `aplicadas` y `visitadas` (códigos de manzana) o `NULL` si el estudio no registra avance por manzana.
#' @keywords internal
.graficos_manzanas_contexto <- function(reports, ubigeo) {
  progress <- .graficos_records_df((reports$advance %||% list())$block_progress %||% reports$block_progress)
  if (!nrow(progress)) return(NULL)
  id_col <- .graficos_first_col(progress, c("id_manzana", "block_id", "advance_block_id"))
  ub_col <- .graficos_first_col(progress, c("ubigeo", "advance_block_ubigeo", "district_code"))
  if (!nzchar(id_col) || !nzchar(ub_col)) return(NULL)
  en <- .graficos_ubigeo6(progress[[ub_col]]) == .graficos_ubigeo6(ubigeo)
  ids <- trimws(as.character(progress[[id_col]]))
  limpio <- function(m) { x <- unique(ids[en & m]); x[!is.na(x) & nzchar(x)] }
  list(aplicadas = limpio(.graficos_fieldwork_activity_mask(progress, "effective")),
       visitadas = limpio(.graficos_fieldwork_activity_mask(progress, "visited")))
}

#' Capas de la 106: manzanas del distrito por estado y contornos de zona
#'
#' @param contexto Contexto del mapa de distrito (trae `ubigeo`, `zones` con `effective` y `manzanas`).
#' @return Lista `capas`, `cifra` (las manzanas) y `leyenda`, o `NULL` sin avance por manzana o sin cartografía.
#' @keywords internal
.espec_mapa_manzanas <- function(contexto) {
  mz <- contexto$manzanas
  ubigeo <- .mapa_chr1(contexto$ubigeo, "")
  if (!is.list(mz) || !length(mz$aplicadas) || !nzchar(ubigeo)) return(NULL)
  feats <- tryCatch(.hojas_ruta_pdf_block_features_for_ubigeo(ubigeo), error = function(e) list())
  if (!length(feats)) return(NULL)
  zonas_ap <- unique(vapply(Filter(function(z) isTRUE(z$effective), contexto$zones %||% list()), function(z) .mapa_chr1(z$zona, ""), ""))
  azul <- .std_color("azul"); medio <- .std_color("mapa_medio")
  filas <- list()
  for (k in seq_along(feats)) {
    f <- feats[[k]]; aplicada <- f$id %in% mz$aplicadas; zona_aplicada <- .mapa_chr1(f$zona, "") %in% zonas_ap
    fill <- if (aplicada) azul else if (zona_aplicada) medio else "#FFFFFF"
    anillos <- .graficos_rings_payload(f$rings)
    for (j in seq_along(anillos)) {
      filas[[length(filas) + 1L]] <- .mapa_ring_df(anillos[[j]], group = paste(f$id, j, sep = "-"), zona = .mapa_chr1(f$zona, ""),
                                                   status = if (aplicada) "efectiva" else "no_intervenido", ubigeo = ubigeo, distrito = "")
      filas[[length(filas)]]$fill <- fill
    }
  }
  filas <- Filter(function(d) is.data.frame(d) && nrow(d) >= 3L, filas)
  if (!length(filas)) return(NULL)
  manz <- do.call(rbind, filas)
  zonas <- .mapa_context_polygons(contexto)
  zonas$fill <- NA_character_
  ap <- zonas[zonas$zona %in% zonas_ap, , drop = FALSE]
  n_ap <- sum(vapply(feats, function(f) f$id %in% mz$aplicadas, TRUE))
  n_en <- sum(vapply(feats, function(f) .mapa_chr1(f$zona, "") %in% zonas_ap, TRUE))
  list(capas = list(list(datos = manz, borde = "#D5DBE5", grosor = 0.08),
                    list(datos = zonas, borde = .std_color("tenue"), grosor = 0.2, sin_relleno = TRUE),
                    list(datos = ap, borde = azul, grosor = 0.55, sin_relleno = TRUE)),
       caja = c(xmin = min(manz$x), xmax = max(manz$x), ymin = min(manz$y), ymax = max(manz$y)),
       cifra = list(valor = format(n_ap, big.mark = ","), rotulo = if (n_ap == 1) "manzana aplicada" else "manzanas aplicadas",
                    detalle = sprintf("de %s manzanas en esas zonas", format(n_en, big.mark = ","))),
       leyenda = list(titulo = "Manzanas", rotulos = c("Manzana aplicada", "Otra manzana de una zona aplicada", "Fuera de la muestra"),
                      colores = c(azul, medio, "#FFFFFF")))
}
