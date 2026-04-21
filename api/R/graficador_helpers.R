# ============================================================
# Helpers para posición de títulos (hjust/vjust)
# ============================================================

hjust_from_pos <- function(pos) {
  # Pos puede venir en NULL, en español o en numérico.
  # Fallback: centro (0.5)
  if (is.null(pos)) return(0.5)

  # Si ya es numérico válido, se respeta
  if (is.numeric(pos) && length(pos) == 1L && is.finite(pos)) {
    return(max(0, min(1, pos)))
  }

  # Aceptar alias en texto
  pos <- tolower(as.character(pos))

  if (pos %in% c("izq", "izquierda", "left"))       return(0)
  if (pos %in% c("cen", "centro", "center", "centre")) return(0.5)
  if (pos %in% c("der", "derecha", "right"))        return(1)

  # Si viene algo raro, volvemos a centro
  0.5
}

vjust_from_pos <- function(pos) {
  # Mismo espíritu por si en algún momento se usa en títulos de eje, etc.
  if (is.null(pos)) return(0.5)

  if (is.numeric(pos) && length(pos) == 1L && is.finite(pos)) {
    return(max(0, min(1, pos)))
  }

  pos <- tolower(as.character(pos))

  if (pos %in% c("arriba", "top"))    return(1)
  if (pos %in% c("medio", "centro", "middle", "center")) return(0.5)
  if (pos %in% c("abajo", "bottom")) return(0)

  0.5
}
