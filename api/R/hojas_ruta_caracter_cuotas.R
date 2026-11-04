# hojas_ruta_caracter_cuotas.R — meta o referencial por dimensión de la cuota territorial (ADR 0126).
#
# La cuota territorial nace aquí (ADR 0125 §2) y aquí se declara si cada dimensión se exige (meta) o sólo se
# describe (referencial). El total de la zona (su N) es siempre meta; se declaran `sexo` y `edad`. Sin
# declaración nada cambia: las dos son meta, que es como se trabaja hoy, y el campo se omite para que la
# huella de los envíos existentes no se mueva. Monitoreo lo lee de la foto del envío.

.HOJAS_RUTA_DIMENSIONES_DE_CUOTA <- c("sexo", "edad")

#' Normaliza `caracter_cuotas`: sólo dimensiones conocidas con un valor del vocabulario.
#' @param x lista `list(sexo = "meta" | "referencial", edad = ...)` o `NULL`.
#' @param subquota_var `"ninguna"` si la matriz no se divide por sexo: entonces
#'   no hay dimensión sexo que declarar y una marca guardada se descarta (si no,
#'   quedaba oculta en la pantalla y Monitoreo describía un «Total» 100/100).
#' @return lista con las dimensiones DECLARADAS referenciales o meta; `list()` si nada.
#' @keywords internal
hojas_ruta_caracter_cuotas_normalizar <- function(x, subquota_var = "sexo") {
  if (!is.list(x) || !length(x)) return(list())
  out <- list()
  dims <- .HOJAS_RUTA_DIMENSIONES_DE_CUOTA
  if (identical(subquota_var, "ninguna")) dims <- setdiff(dims, "sexo")
  for (dim in dims) {
    v <- tolower(trimws(as.character(x[[dim]] %||% "")[1]))
    if (!is.na(v) && v %in% c("meta", "referencial")) out[[dim]] <- v
  }
  # Declarar todo «meta» es no declarar nada: se omite y la huella no cambia.
  if (length(out) && all(unlist(out) == "meta")) return(list())
  out
}
