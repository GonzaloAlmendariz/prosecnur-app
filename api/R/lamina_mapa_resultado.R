# =============================================================================
# lamina_mapa_resultado.R — lámina 104 del recetario: resultado por distrito en el mapa de Lima (ADR 0093)
# =============================================================================
#
# El mapa de Lima y Callao pintado por clases de un indicador y, al lado, los distritos de mayor a menor con su cifra.
# Desde el ítem 4 del checklist del catálogo (Gonzalo, 2026-11-08) se dibuja con el lenguaje del mapa de distribución:
# tarjetas, mar y tierra de contexto, leyenda de clases bajo el mapa y lista con barra sobre pista
# (lamina_mapa_resultado_tarjeta.R). Antes: mapa sin tarjeta, leyenda vertical en el mar y ranking en una, dos o tres
# columnas con el panel titulado del recetario.

#' Lámina 104: mapa por clases, leyenda y lista de distritos (con el lenguaje del mapa de distribución)
#' @keywords internal
.lam_laminas_mapa_resultado <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                        layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  .lam_laminas_mapa_resultado_tarjeta(doc, espec, titulo, ante = ante, base = base, folio = folio, sub = sub, layout = layout,
                                      master = master, por_lamina = por_lamina)
}

#' ¿La 104 cabe? Hay cartografía y cada distrito con su cifra entra en una línea de la lista, en hasta cuatro columnas.
#' Sin distritos pintados también cabe: la lámina dice su vacío.
#' @keywords internal
.lam_mapa_resultado_cabe <- function(espec) {
  if (is.null(espec) || !identical(espec$forma, "resultado") || is.null(espec$ranking)) return(FALSE)
  .lam_mapa_res_tarjeta_cabe(espec)
}
