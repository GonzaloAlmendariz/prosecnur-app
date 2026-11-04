# =============================================================================
# hojas_ruta_cuotas_cpv2025.R — cuotas sexo × edad con la estructura CPV 2025
# (ADR 0131 §2, con la base de reparto 2025 activa)
# =============================================================================
#
# Con la base 2025 las rutas se reparten entre distritos con P̂25 = pob25 · u17 · a17.
# La cuota sexo × edad de cada distrito ya no escala la estructura 2017: sale de la
# edad simple × sexo del CPV 2025 por distrito (`cpv2025_edad_simple_distrito.csv.gz`,
# población censada; suma exacto pob25), escalada a P̂25 para que el total del
# distrito siga siendo el del reparto:
#
#   pob_celda = P̂25_d · P25(d, sexo, rango) / P25(d, 18+)
#
# Con la cuota por zona la celda 2017 reparte el distrito entre zonas; la zona
# conserva esa participación y toma la estructura 2025 del distrito:
#   pob_celda(zona) = pob_celda17(zona) · D25 / D17   para cada (distrito, sexo, rango).
#
# Apagada la base, nada de esto corre: las celdas son las de 2017 de siempre.
# =============================================================================

HOJAS_RUTA_CUOTAS_2025_FUENTE <- "CPV 2025 (población censada)"

.hojas_ruta_cpv2025_edad_memo <- new.env(parent = emptyenv())

#' Edad simple × sexo CPV 2025 por distrito: data.frame(ubigeo, edad, sexo, poblacion).
hojas_ruta_cpv2025_edad_simple <- function() {
  hit <- .hojas_ruta_cpv2025_edad_memo$df
  if (!is.null(hit)) return(hit)
  path <- .hojas_ruta_inst_path("hojas_ruta", "cpv2025_edad_simple_distrito.csv.gz")
  if (!file.exists(path)) .hojas_ruta_rb_incompleta("la edad simple × sexo del CPV 2025 (cpv2025_edad_simple_distrito.csv.gz)")
  df <- utils::read.csv(path, colClasses = c(ubigeo = "character"), stringsAsFactors = FALSE, encoding = "UTF-8")
  df <- data.frame(ubigeo = sprintf("%06s", df$ubigeo), edad = as.integer(df$edad), sexo = as.character(df$sexo),
                   poblacion = as.numeric(df$poblacion), stringsAsFactors = FALSE)
  .hojas_ruta_cpv2025_edad_memo$df <- df
  df
}

#' Celdas de cuota con la estructura 2025. `cells` son las celdas 2017
#' (territorio, ubigeo, sexo, rango_id, poblacion, …) de `.hojas_ruta_population_cells`.
hojas_ruta_cuotas_2025_celdas <- function(cells, cfg) {
  ub <- as.character(cells$ubigeo)
  ubigeos <- unique(ub)
  edad <- hojas_ruta_cpv2025_edad_simple()
  edad <- edad[edad$ubigeo %in% ubigeos, , drop = FALSE]
  faltan <- setdiff(ubigeos, edad$ubigeo)
  if (length(faltan)) .hojas_ruta_rb_incompleta(sprintf("la edad simple 2025 de %s", paste(faltan, collapse = ", ")))
  defs <- cfg$age_ranges %||% .hojas_ruta_age_defs_default()
  def_de <- stats::setNames(defs, vapply(defs, function(d) as.character(d$id), character(1)))
  # D25 por (distrito, sexo de la celda, rango).
  d25 <- vapply(seq_len(nrow(cells)), function(i) {
    d <- def_de[[as.character(cells$rango_id[[i]])]]
    if (is.null(d)) .hojas_ruta_rb_incompleta(sprintf("el rango de edad %s en la configuración", cells$rango_id[[i]]))
    mx <- if (is.null(d$max) || is.na(d$max)) Inf else as.numeric(d$max)
    sx <- if (identical(cells$sexo[[i]], "Total")) c("Hombre", "Mujer") else cells$sexo[[i]]
    sum(edad$poblacion[edad$ubigeo == ub[[i]] & edad$sexo %in% sx & edad$edad >= as.numeric(d$min) & edad$edad <= mx])
  }, numeric(1))
  # Participación de la celda dentro de su grupo (distrito, sexo, rango): 1 sin cuota por zona.
  grupo <- paste(ub, cells$sexo, cells$rango_id, sep = "|")
  p17 <- as.numeric(cells$poblacion)
  p17[is.na(p17)] <- 0
  d17 <- stats::ave(p17, grupo, FUN = sum)
  n_g <- stats::ave(p17, grupo, FUN = length)
  share <- ifelse(d17 > 0, p17 / d17, 1 / n_g)
  pob <- d25 * share
  # Escala a P̂25: Σ de las celdas del distrito = P̂25 · (P25 en los rangos / P25 18+).
  base <- hojas_ruta_reparto_base_distritos(ubigeos)
  adultos25 <- vapply(ubigeos, function(u) sum(edad$poblacion[edad$ubigeo == u & edad$edad >= 18L]), numeric(1))
  factor <- (base$p25 / adultos25)[match(ub, ubigeos)]
  if (any(!is.finite(factor) | factor <= 0)) .hojas_ruta_rb_incompleta("la población de 18 a más 2025 de algún distrito")
  cells$poblacion <- pob * factor
  cells
}
