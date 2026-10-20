# =============================================================================
# helpers_bases_cache.R — memo de la normalización de fuentes por huella de sus entradas
# =============================================================================
#
# `.bases_normalize_source_contexts` limpia etiquetas de instrumento y datos de todas las bases y es lo más caro de
# reconstruir las fuentes de Gráficos (~60 % de `.graficos_processing_sources`). Plumber atiende un pedido a la vez y
# cada pedido de Gráficos (categorías del Top Two Box, miniaturas, cobertura, validar) la repetía desde cero: en
# Windows la lectura de la escala quedaba en cola detrás de varias de esas reconstrucciones (Arte, 2026-10-20).
#
# Es una función pura de sus entradas más el override de etiquetas «ambiente» (label_overrides.R), así que la clave
# es la huella de todo eso: datos e instrumento con sus atributos, `normalize_other` y el override activo. Cualquier
# cambio en los datos, el instrumento o las etiquetas da otra huella y se recalcula; no hay invalidación que olvidar.
# La huella cuesta milisegundos; el memo guarda pocas entradas (una por combinación de base activa y alcance).

.bases_norm_cache <- new.env(parent = emptyenv())
.BASES_NORM_CACHE_MAX <- 6L

#' Huella de una llamada a la normalización
#' @keywords internal
.bases_norm_cache_clave <- function(data_sources, inst_sources, normalize_other) {
  ambiente <- if (exists(".label_overrides_ambient", mode = "function")) .label_overrides_ambient() else NULL
  digest::digest(list(data_sources, inst_sources, isTRUE(normalize_other), ambiente), algo = "xxhash64")
}

#' El resultado de `calcular()` para esa clave, del memo si ya estaba
#' @keywords internal
.bases_norm_cache_usar <- function(clave, calcular) {
  hit <- .bases_norm_cache[[clave]]
  if (!is.null(hit)) {
    hit$usado <- Sys.time()
    assign(clave, hit, envir = .bases_norm_cache)
    return(hit$valor)
  }
  valor <- calcular()
  assign(clave, list(valor = valor, usado = Sys.time()), envir = .bases_norm_cache)
  claves <- ls(.bases_norm_cache, all.names = TRUE)
  if (length(claves) > .BASES_NORM_CACHE_MAX) {
    usados <- vapply(claves, function(k) as.numeric(.bases_norm_cache[[k]]$usado), numeric(1))
    rm(list = claves[order(usados)][seq_len(length(claves) - .BASES_NORM_CACHE_MAX)], envir = .bases_norm_cache)
  }
  valor
}

#' Vacía el memo (tests)
#' @keywords internal
.bases_norm_cache_vaciar <- function() {
  rm(list = ls(.bases_norm_cache, all.names = TRUE), envir = .bases_norm_cache)
  invisible(NULL)
}
