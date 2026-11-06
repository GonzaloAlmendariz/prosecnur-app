# Color que el equipo elige para cada público de Acreditación (Gonzalo, 30/10:
# «poder escoger nuestro color en Modelo»). Sin elección, el front usa el tono
# de la paleta (paletaPublicos.ts); con ella, el hex manda en todas las vistas.
# Vive en `config$publico_colores` como lista nombrada público -> "#rrggbb".

.MONITOREO_MAX_COLORES_PUBLICO <- 40L

.monitoreo_publico_colores <- function(colores) {
  vacio <- stats::setNames(list(), character(0))
  if (is.null(colores) || !is.list(colores) && !is.character(colores)) return(vacio)
  nombres <- names(colores)
  if (is.null(nombres)) return(vacio)
  out <- vacio
  for (i in seq_along(colores)) {
    publico <- trimws(as.character(nombres[[i]] %||% ""))
    valor <- colores[[i]]
    if (!nzchar(publico) || nchar(publico) > 120L || length(valor) != 1L) next
    hex <- tolower(trimws(as.character(valor)))
    if (is.na(hex)) next
    if (grepl("^#[0-9a-f]{3}$", hex)) {
      partes <- strsplit(substring(hex, 2L), "")[[1]]
      hex <- paste0("#", paste0(partes, partes, collapse = ""))
    }
    if (!grepl("^#[0-9a-f]{6}$", hex)) next
    out[[publico]] <- hex
    if (length(out) >= .MONITOREO_MAX_COLORES_PUBLICO) break
  }
  out
}
