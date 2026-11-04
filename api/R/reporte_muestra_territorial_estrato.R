# =============================================================================
# reporte_muestra_territorial_estrato.R — el estrato explícito en la memoria de
# cálculo (ADR 0131 §1, paso 2)
# =============================================================================

#' Frase de la nota técnica que declara el estrato explícito del sorteo, o NULL con
#' estrato distrito. `em` es `sample_size_preview$estrato_muestral`.
.reporte_mt_frase_estrato <- function(em) {
  if (!is.list(em) || !length(em$estratos)) return(NULL)
  lima <- identical(as.character(em$modo %||% "")[1], "provincia_lima_areas")
  minimo <- as.integer(em$minimo_rutas %||% HOJAS_RUTA_ESTRATO_MIN_RUTAS)
  rutas <- vapply(em$estratos, function(e) {
    sprintf("%s %d", as.character(e$etiqueta %||% e$estrato)[1], as.integer(e$rutas))
  }, character(1))
  sprintf(paste(
    "El estrato explícito es la provincia%s.",
    "Cada estrato recibe al menos %d rutas, para poder estimar su varianza, y el resto en proporción a su población.",
    "Dentro del estrato, las rutas se reparten entre distritos en proporción a la medida de tamaño de sus manzanas del marco elegible,",
    "con un redondeo sistemático aleatorio, y el distrito y la zona actúan como estratos implícitos.",
    "Rutas por estrato: %s."
  ), if (lima) ", con Lima Metropolitana en cinco áreas interdistritales y Callao como estrato propio" else "",
  minimo, paste(rutas, collapse = "; "))
}
