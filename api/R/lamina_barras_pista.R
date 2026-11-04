# =============================================================================
# lamina_barras_pista.R — la pista gris hasta el 100% de las barras horizontales de una serie
# =============================================================================
#
# Revisión del PPT v7.11 de CCSS (lámina 9, «Nivel curricular y carrera»): «creo que es mejor que estos gráficos usen eje
# x con un gris suave que muestre el 100%». Cada barra va sobre su pista, como la lista de los mapas
# (lamina_mapa_distribucion.R): la pista mide el 100% y la barra, su parte. La cifra sigue al final de la barra.
#
# Mando `pista_barras` del gráfico (graficos_metadata.R, en las agrupadas y las categóricas):
#   - "auto" (defecto): encendida cuando la escala ya va de 0 a 100% (`escala_completa`, el defecto de la agrupada de una
#     serie) y en los paneles de las láminas de población (`en_poblacion`, lo marca `.lam_laminas_mixta`);
#   - "siempre": encendida, y la escala pasa a ir de 0 a 100% (una pista corta no mostraría el 100%);
#   - "nunca": como antes, la barra sola.
# Sólo cambia el dibujo: largos y cifras son los de la espec.

#' Valores válidos del mando `pista_barras`
#' @keywords internal
.LAM_PISTA_MODOS <- c("auto", "siempre", "nunca")

#' ¿Las barras de esta espec van sobre su pista hasta el 100%?
#' @keywords internal
.lam_barras_pista_activa <- function(espec) {
  modo <- espec[["pista"]]
  if (is.logical(modo) && length(modo) == 1L && !is.na(modo)) return(modo)   # un plan escrito a mano con TRUE/FALSE
  modo <- as.character(modo %||% "auto")[1]
  if (is.na(modo) || !modo %in% .LAM_PISTA_MODOS) modo <- "auto"
  switch(modo, siempre = TRUE, nunca = FALSE, isTRUE(espec$escala_completa) || isTRUE(espec[["en_poblacion"]]))
}

#' Color de la pista: gris suave que se distingue del fondo de la lámina sin competir con la barra
#' @keywords internal
.lam_barras_pista_color <- function() .std_color("banda_clara")

#' Dibuja la pista de una barra: desde el origen hasta el 100% de la escala
#' @param x0 Origen de la barra. @param w100 Ancho que mide el 100%.
#' @keywords internal
.lam_barras_pista <- function(lz, x0, yb, w100, g) {
  if (w100 > 0.004) .lam_caja(lz, x0, yb, w100, g, .lam_barras_pista_color(), nombre = "barra:pista")
  invisible(lz)
}
